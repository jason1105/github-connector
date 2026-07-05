# GitHub MCP Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript MCP server, deployed on Vercel, that exposes 11 tools letting ChatGPT (via a custom connector) list repo files, read files, create/update files, create/list/get issues, comment on issues/PRs, and create/list/get/merge pull requests — all against any GitHub repo reachable by a single configured PAT.

**Architecture:** A single Vercel Node.js serverless function (`api/server.ts`) checks a shared-secret header, then hands the request to an MCP `StreamableHTTPServerTransport` (stateless mode) wired to an `McpServer` instance. The `McpServer` registers 11 tools, each a thin handler delegating to one of three GitHub wrapper modules (`repos.ts`, `issues.ts`, `pulls.ts`) built on a single shared `Octokit` instance.

**Tech Stack:** TypeScript, Node.js, `@modelcontextprotocol/sdk@^1.29.0`, `octokit@^5.0.5`, `zod@^4.0`, Vercel Node.js runtime (`@vercel/node` types), `vitest` for unit tests.

## Global Constraints

- Package versions: `@modelcontextprotocol/sdk@^1.29.0`, `octokit@^5.0.5`, `zod@^4.0`, verified compatible via direct install (peer dep range `^3.25 || ^4.0` for zod).
- Tool registration uses `server.registerTool(name, config, handler)` — NOT the deprecated `server.tool(...)` overloads.
- `inputSchema` in `registerTool` config is a **raw shape object** (e.g. `{ owner: z.string() }`), never `z.object({...})` — the SDK wraps it internally.
- Tool handlers return `{ content: [{ type: 'text', text: string }] }` on success, or throw an `Error` with a descriptive message on failure (the MCP SDK converts thrown errors into tool error results).
- `StreamableHTTPServerTransport` must be constructed with `{ sessionIdGenerator: undefined }` for stateless serverless operation, and a fresh `McpServer` + transport pair must be created per incoming request (no cross-request in-memory state, since Vercel functions are not guaranteed to reuse the same process).
- Shared-secret check happens in `api/server.ts` before any MCP logic runs; failure returns HTTP 401 with a JSON error body, no MCP handling attempted.
- All GitHub wrapper functions take plain parameters and return plain data or throw plain `Error`s — no MCP types in `src/github/*`.
- Every tool's `owner`/`repo` parameters are required strings; no default repo.
- Env vars required at runtime: `GITHUB_TOKEN` (PAT), `CONNECTOR_SECRET` (shared secret). Both documented in `.env.example`.
- `@modelcontextprotocol/sdk@1.29.0`'s package.json `exports` map does NOT expose `./server` as re-exporting `McpServer` or `StreamableHTTPServerTransport` — those live in `server/mcp.js` and `server/streamableHttp.js`, resolvable only via the package's `./*` wildcard export, which requires the literal `.js` extension in the import path. Verified by direct `npm install` + Node ESM import test. Always import as `@modelcontextprotocol/sdk/server/mcp.js` and `@modelcontextprotocol/sdk/server/streamableHttp.js` (with `.js`), never the bare `/server` subpath.

---

## File Structure

```
github-connector/
  api/
    server.ts              # Vercel entry point: shared-secret check + MCP request handling
  src/
    github/
      client.ts             # getOctokit(): singleton Octokit instance from GITHUB_TOKEN
      repos.ts              # listRepoTree, getFileContent, createOrUpdateFile
      issues.ts             # createIssue, listIssues, getIssue, createIssueComment
      pulls.ts               # createPullRequest, listPullRequests, getPullRequest, mergePullRequest
    tools/
      register.ts            # registerAllTools(server): wires all 11 MCP tools to github/* functions
    auth.ts                  # checkConnectorSecret(req): boolean
  test/
    github/
      repos.test.ts
      issues.test.ts
      pulls.test.ts
    auth.test.ts
  package.json
  tsconfig.json
  vercel.json
  .env.example
  README.md
```

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vercel.json`
- Create: `.env.example`
- Create: `.gitignore`
- Modify: `README.md`

**Interfaces:**
- Produces: a working `npm install`, `npm run build` (tsc typecheck), `npm test` (vitest) setup that all later tasks depend on.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "github-connector",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "octokit": "^5.0.5",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@vercel/node": "^3.2.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist"
  },
  "include": ["api", "src", "test"]
}
```

- [ ] **Step 3: Write `vercel.json`**

```json
{
  "functions": {
    "api/server.ts": {
      "maxDuration": 60
    }
  }
}
```

- [ ] **Step 4: Write `.env.example`**

```
# GitHub Personal Access Token with repo scope (contents, issues, pull-requests read/write)
GITHUB_TOKEN=

# Shared secret the ChatGPT connector must send as the X-Connector-Secret header
CONNECTOR_SECRET=
```

- [ ] **Step 5: Write `.gitignore`**

```
node_modules/
dist/
.env
.vercel
```

- [ ] **Step 6: Update `README.md`**

```markdown
# github-connector

A ChatGPT App (MCP connector) for operating on GitHub repositories: list files, read files, create/update files, manage issues, and manage pull requests.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `GITHUB_TOKEN` (a GitHub PAT with repo scope) and `CONNECTOR_SECRET` (any random string you generate).
3. `npm run build` to typecheck.
4. `npm test` to run unit tests.
5. Deploy to Vercel; set `GITHUB_TOKEN` and `CONNECTOR_SECRET` as Vercel project environment variables.
6. Configure the ChatGPT connector to call `https://<your-deployment>.vercel.app/mcp` with header `X-Connector-Secret: <CONNECTOR_SECRET>`.
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`
Expected: installs without error, creates `package-lock.json` and `node_modules/`.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vercel.json .env.example .gitignore README.md
git commit -m "chore: scaffold github-connector project"
```

---

### Task 2: Shared-secret auth middleware

**Files:**
- Create: `src/auth.ts`
- Test: `test/auth.test.ts`

**Interfaces:**
- Produces: `checkConnectorSecret(headerValue: string | string[] | undefined): boolean` — used by `api/server.ts` (Task 7).

- [ ] **Step 1: Write the failing test**

Create `test/auth.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkConnectorSecret } from '../src/auth.js';

describe('checkConnectorSecret', () => {
  const ORIGINAL_ENV = process.env.CONNECTOR_SECRET;

  beforeEach(() => {
    process.env.CONNECTOR_SECRET = 'test-secret-123';
  });

  afterEach(() => {
    process.env.CONNECTOR_SECRET = ORIGINAL_ENV;
  });

  it('returns true when header matches CONNECTOR_SECRET', () => {
    expect(checkConnectorSecret('test-secret-123')).toBe(true);
  });

  it('returns false when header does not match', () => {
    expect(checkConnectorSecret('wrong-secret')).toBe(false);
  });

  it('returns false when header is undefined', () => {
    expect(checkConnectorSecret(undefined)).toBe(false);
  });

  it('returns false when header is an array', () => {
    expect(checkConnectorSecret(['test-secret-123'])).toBe(false);
  });

  it('returns false when CONNECTOR_SECRET env var is unset', () => {
    delete process.env.CONNECTOR_SECRET;
    expect(checkConnectorSecret('test-secret-123')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/auth.test.ts`
Expected: FAIL — `src/auth.ts` does not exist / `checkConnectorSecret` not defined.

- [ ] **Step 3: Write minimal implementation**

Create `src/auth.ts`:

```typescript
export function checkConnectorSecret(headerValue: string | string[] | undefined): boolean {
  const expected = process.env.CONNECTOR_SECRET;
  if (!expected) return false;
  if (typeof headerValue !== 'string') return false;
  return headerValue === expected;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/auth.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/auth.ts test/auth.test.ts
git commit -m "feat: add shared-secret auth check"
```

---

### Task 3: GitHub client singleton

**Files:**
- Create: `src/github/client.ts`

**Interfaces:**
- Produces: `getOctokit(): Octokit` — a lazily-created singleton `Octokit` instance, used by Tasks 4–6.

- [ ] **Step 1: Write the implementation**

Create `src/github/client.ts`:

```typescript
import { Octokit } from 'octokit';

let instance: Octokit | undefined;

export function getOctokit(): Octokit {
  if (instance) return instance;
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
  }
  instance = new Octokit({ auth: token });
  return instance;
}
```

There is no test for this file directly — it has no branching logic worth a unit test beyond what's covered by Task 4's mocked tests, which patch `getOctokit()`. `GITHUB_TOKEN` presence is exercised implicitly whenever any `github/*` function is called with the env var unset in a fresh test module (not applicable here since tests mock `getOctokit()` entirely).

- [ ] **Step 2: Commit**

```bash
git add src/github/client.ts
git commit -m "feat: add Octokit client singleton"
```

---

### Task 4: Repo file tools (`list_repo_tree`, `get_file_content`, `create_or_update_file`)

**Files:**
- Create: `src/github/repos.ts`
- Test: `test/github/repos.test.ts`

**Interfaces:**
- Consumes: `getOctokit()` from `src/github/client.ts` (Task 3).
- Produces:
  - `listRepoTree(params: { owner: string; repo: string; ref?: string; path?: string }): Promise<Array<{ path: string; type: string; sha: string; size?: number }>>`
  - `getFileContent(params: { owner: string; repo: string; path: string; ref?: string }): Promise<{ path: string; content: string; sha: string }>`
  - `createOrUpdateFile(params: { owner: string; repo: string; path: string; content: string; message: string; branch: string; createBranch?: boolean; baseBranch?: string }): Promise<{ commitSha: string; contentSha: string }>`
  - Used by `src/tools/register.ts` (Task 7).

- [ ] **Step 1: Write the failing tests**

Create `test/github/repos.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTree = vi.fn();
const mockGetContent = vi.fn();
const mockCreateOrUpdateFileContents = vi.fn();
const mockGetRef = vi.fn();
const mockCreateRef = vi.fn();

vi.mock('../../src/github/client.js', () => ({
  getOctokit: () => ({
    rest: {
      git: {
        getTree: mockGetTree,
        getRef: mockGetRef,
        createRef: mockCreateRef,
      },
      repos: {
        getContent: mockGetContent,
        createOrUpdateFileContents: mockCreateOrUpdateFileContents,
      },
    },
  }),
}));

import { listRepoTree, getFileContent, createOrUpdateFile } from '../../src/github/repos.js';

describe('listRepoTree', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves ref to a tree sha via getContent when path is root, then lists recursively', async () => {
    mockGetTree.mockResolvedValue({
      data: {
        tree: [
          { path: 'src/index.ts', type: 'blob', sha: 'abc123', size: 42 },
          { path: 'src', type: 'tree', sha: 'def456' },
        ],
      },
    });

    const result = await listRepoTree({ owner: 'octo', repo: 'hello', ref: 'main' });

    expect(mockGetTree).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'octo', repo: 'hello', tree_sha: 'main', recursive: '1' })
    );
    expect(result).toEqual([
      { path: 'src/index.ts', type: 'blob', sha: 'abc123', size: 42 },
      { path: 'src', type: 'tree', sha: 'def456' },
    ]);
  });

  it('defaults ref to HEAD when not provided', async () => {
    mockGetTree.mockResolvedValue({ data: { tree: [] } });

    await listRepoTree({ owner: 'octo', repo: 'hello' });

    expect(mockGetTree).toHaveBeenCalledWith(
      expect.objectContaining({ tree_sha: 'HEAD' })
    );
  });

  it('filters results to under a given path prefix', async () => {
    mockGetTree.mockResolvedValue({
      data: {
        tree: [
          { path: 'src/index.ts', type: 'blob', sha: 'abc123' },
          { path: 'docs/readme.md', type: 'blob', sha: 'def456' },
        ],
      },
    });

    const result = await listRepoTree({ owner: 'octo', repo: 'hello', path: 'src' });

    expect(result).toEqual([{ path: 'src/index.ts', type: 'blob', sha: 'abc123' }]);
  });
});

describe('getFileContent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('decodes base64 content for a file', async () => {
    mockGetContent.mockResolvedValue({
      data: {
        type: 'file',
        path: 'README.md',
        content: Buffer.from('hello world').toString('base64'),
        sha: 'shavalue',
      },
    });

    const result = await getFileContent({ owner: 'octo', repo: 'hello', path: 'README.md' });

    expect(result).toEqual({ path: 'README.md', content: 'hello world', sha: 'shavalue' });
  });

  it('throws a descriptive error when path is a directory', async () => {
    mockGetContent.mockResolvedValue({ data: [{ path: 'src', type: 'dir' }] });

    await expect(
      getFileContent({ owner: 'octo', repo: 'hello', path: 'src' })
    ).rejects.toThrow(/directory, not a file/i);
  });
});

describe('createOrUpdateFile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a new file without sha when it does not exist yet', async () => {
    mockGetContent.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    mockCreateOrUpdateFileContents.mockResolvedValue({
      data: { commit: { sha: 'commitsha' }, content: { sha: 'contentsha' } },
    });

    const result = await createOrUpdateFile({
      owner: 'octo',
      repo: 'hello',
      path: 'new.txt',
      content: 'hi',
      message: 'add new.txt',
      branch: 'main',
    });

    expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'octo',
        repo: 'hello',
        path: 'new.txt',
        message: 'add new.txt',
        branch: 'main',
        content: Buffer.from('hi').toString('base64'),
      })
    );
    const callArgs = mockCreateOrUpdateFileContents.mock.calls[0][0];
    expect(callArgs.sha).toBeUndefined();
    expect(result).toEqual({ commitSha: 'commitsha', contentSha: 'contentsha' });
  });

  it('includes existing sha when file already exists', async () => {
    mockGetContent.mockResolvedValue({ data: { type: 'file', sha: 'existingsha' } });
    mockCreateOrUpdateFileContents.mockResolvedValue({
      data: { commit: { sha: 'commitsha2' }, content: { sha: 'contentsha2' } },
    });

    await createOrUpdateFile({
      owner: 'octo',
      repo: 'hello',
      path: 'existing.txt',
      content: 'updated',
      message: 'update existing.txt',
      branch: 'main',
    });

    expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({ sha: 'existingsha' })
    );
  });

  it('creates a new branch from baseBranch before committing when createBranch is true', async () => {
    mockGetRef.mockResolvedValue({ data: { object: { sha: 'basesha' } } });
    mockCreateRef.mockResolvedValue({ data: {} });
    mockGetContent.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    mockCreateOrUpdateFileContents.mockResolvedValue({
      data: { commit: { sha: 'commitsha3' }, content: { sha: 'contentsha3' } },
    });

    await createOrUpdateFile({
      owner: 'octo',
      repo: 'hello',
      path: 'feature.txt',
      content: 'feature content',
      message: 'add feature.txt',
      branch: 'feature-branch',
      createBranch: true,
      baseBranch: 'main',
    });

    expect(mockGetRef).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'octo', repo: 'hello', ref: 'heads/main' })
    );
    expect(mockCreateRef).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'octo',
        repo: 'hello',
        ref: 'refs/heads/feature-branch',
        sha: 'basesha',
      })
    );
    expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({ branch: 'feature-branch' })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/github/repos.test.ts`
Expected: FAIL — `src/github/repos.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/github/repos.ts`:

```typescript
import { getOctokit } from './client.js';

export interface TreeEntry {
  path: string;
  type: string;
  sha: string;
  size?: number;
}

export async function listRepoTree(params: {
  owner: string;
  repo: string;
  ref?: string;
  path?: string;
}): Promise<TreeEntry[]> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.git.getTree({
    owner: params.owner,
    repo: params.repo,
    tree_sha: params.ref ?? 'HEAD',
    recursive: '1',
  });

  const entries: TreeEntry[] = data.tree.map((entry) => ({
    path: entry.path ?? '',
    type: entry.type ?? 'blob',
    sha: entry.sha ?? '',
    size: entry.size,
  }));

  if (!params.path) return entries;
  const prefix = params.path.endsWith('/') ? params.path : `${params.path}/`;
  return entries.filter((e) => e.path === params.path || e.path.startsWith(prefix));
}

export async function getFileContent(params: {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}): Promise<{ path: string; content: string; sha: string }> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.repos.getContent({
    owner: params.owner,
    repo: params.repo,
    path: params.path,
    ref: params.ref,
  });

  if (Array.isArray(data) || data.type !== 'file' || !('content' in data)) {
    throw new Error(`${params.path} is a directory, not a file`);
  }

  return {
    path: data.path,
    content: Buffer.from(data.content, 'base64').toString('utf-8'),
    sha: data.sha,
  };
}

async function fetchExistingSha(
  octokit: ReturnType<typeof getOctokit>,
  owner: string,
  repo: string,
  path: string,
  branch: string
): Promise<string | undefined> {
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref: branch });
    if (!Array.isArray(data) && data.type === 'file') return data.sha;
    return undefined;
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
      return undefined;
    }
    throw err;
  }
}

export async function createOrUpdateFile(params: {
  owner: string;
  repo: string;
  path: string;
  content: string;
  message: string;
  branch: string;
  createBranch?: boolean;
  baseBranch?: string;
}): Promise<{ commitSha: string; contentSha: string }> {
  const octokit = getOctokit();

  if (params.createBranch) {
    const base = params.baseBranch ?? 'main';
    const { data: refData } = await octokit.rest.git.getRef({
      owner: params.owner,
      repo: params.repo,
      ref: `heads/${base}`,
    });
    await octokit.rest.git.createRef({
      owner: params.owner,
      repo: params.repo,
      ref: `refs/heads/${params.branch}`,
      sha: refData.object.sha,
    });
  }

  const sha = await fetchExistingSha(octokit, params.owner, params.repo, params.path, params.branch);

  const { data } = await octokit.rest.repos.createOrUpdateFileContents({
    owner: params.owner,
    repo: params.repo,
    path: params.path,
    message: params.message,
    content: Buffer.from(params.content, 'utf-8').toString('base64'),
    branch: params.branch,
    sha,
  });

  return {
    commitSha: data.commit.sha ?? '',
    contentSha: data.content?.sha ?? '',
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/github/repos.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/github/repos.ts test/github/repos.test.ts
git commit -m "feat: add repo file tools (list tree, get content, create/update file)"
```

---

### Task 5: Issue tools (`create_issue`, `list_issues`, `get_issue`, `create_issue_comment`)

**Files:**
- Create: `src/github/issues.ts`
- Test: `test/github/issues.test.ts`

**Interfaces:**
- Consumes: `getOctokit()` from `src/github/client.ts` (Task 3).
- Produces:
  - `createIssue(params: { owner: string; repo: string; title: string; body?: string; labels?: string[] }): Promise<{ number: number; url: string }>`
  - `listIssues(params: { owner: string; repo: string; state?: 'open' | 'closed' | 'all' }): Promise<Array<{ number: number; title: string; state: string; url: string }>>`
  - `getIssue(params: { owner: string; repo: string; issueNumber: number }): Promise<{ number: number; title: string; state: string; body: string | null; url: string }>`
  - `createIssueComment(params: { owner: string; repo: string; issueNumber: number; body: string }): Promise<{ url: string }>`
  - Used by `src/tools/register.ts` (Task 7).

- [ ] **Step 1: Write the failing tests**

Create `test/github/issues.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
const mockListForRepo = vi.fn();
const mockGet = vi.fn();
const mockCreateComment = vi.fn();

vi.mock('../../src/github/client.js', () => ({
  getOctokit: () => ({
    rest: {
      issues: {
        create: mockCreate,
        listForRepo: mockListForRepo,
        get: mockGet,
        createComment: mockCreateComment,
      },
    },
  }),
}));

import { createIssue, listIssues, getIssue, createIssueComment } from '../../src/github/issues.js';

describe('createIssue', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates an issue with title, body, and labels', async () => {
    mockCreate.mockResolvedValue({ data: { number: 42, html_url: 'https://github.com/o/r/issues/42' } });

    const result = await createIssue({
      owner: 'octo',
      repo: 'hello',
      title: 'Bug found',
      body: 'Details here',
      labels: ['bug'],
    });

    expect(mockCreate).toHaveBeenCalledWith({
      owner: 'octo',
      repo: 'hello',
      title: 'Bug found',
      body: 'Details here',
      labels: ['bug'],
    });
    expect(result).toEqual({ number: 42, url: 'https://github.com/o/r/issues/42' });
  });
});

describe('listIssues', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists issues filtered by state, defaulting to open', async () => {
    mockListForRepo.mockResolvedValue({
      data: [{ number: 1, title: 'First', state: 'open', html_url: 'url1', pull_request: undefined }],
    });

    const result = await listIssues({ owner: 'octo', repo: 'hello' });

    expect(mockListForRepo).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'octo', repo: 'hello', state: 'open' })
    );
    expect(result).toEqual([{ number: 1, title: 'First', state: 'open', url: 'url1' }]);
  });

  it('excludes pull requests from issue results', async () => {
    mockListForRepo.mockResolvedValue({
      data: [
        { number: 1, title: 'An issue', state: 'open', html_url: 'url1', pull_request: undefined },
        { number: 2, title: 'A PR', state: 'open', html_url: 'url2', pull_request: {} },
      ],
    });

    const result = await listIssues({ owner: 'octo', repo: 'hello' });

    expect(result).toEqual([{ number: 1, title: 'An issue', state: 'open', url: 'url1' }]);
  });
});

describe('getIssue', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gets a single issue by number', async () => {
    mockGet.mockResolvedValue({
      data: { number: 5, title: 'Title', state: 'closed', body: 'Body text', html_url: 'url5' },
    });

    const result = await getIssue({ owner: 'octo', repo: 'hello', issueNumber: 5 });

    expect(mockGet).toHaveBeenCalledWith({ owner: 'octo', repo: 'hello', issue_number: 5 });
    expect(result).toEqual({ number: 5, title: 'Title', state: 'closed', body: 'Body text', url: 'url5' });
  });
});

describe('createIssueComment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a comment on an issue or PR', async () => {
    mockCreateComment.mockResolvedValue({ data: { html_url: 'url-comment' } });

    const result = await createIssueComment({
      owner: 'octo',
      repo: 'hello',
      issueNumber: 7,
      body: 'Nice work!',
    });

    expect(mockCreateComment).toHaveBeenCalledWith({
      owner: 'octo',
      repo: 'hello',
      issue_number: 7,
      body: 'Nice work!',
    });
    expect(result).toEqual({ url: 'url-comment' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/github/issues.test.ts`
Expected: FAIL — `src/github/issues.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/github/issues.ts`:

```typescript
import { getOctokit } from './client.js';

export async function createIssue(params: {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
}): Promise<{ number: number; url: string }> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.issues.create({
    owner: params.owner,
    repo: params.repo,
    title: params.title,
    body: params.body,
    labels: params.labels,
  });
  return { number: data.number, url: data.html_url };
}

export async function listIssues(params: {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
}): Promise<Array<{ number: number; title: string; state: string; url: string }>> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.issues.listForRepo({
    owner: params.owner,
    repo: params.repo,
    state: params.state ?? 'open',
  });
  return data
    .filter((issue) => !issue.pull_request)
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      url: issue.html_url,
    }));
}

export async function getIssue(params: {
  owner: string;
  repo: string;
  issueNumber: number;
}): Promise<{ number: number; title: string; state: string; body: string | null; url: string }> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.issues.get({
    owner: params.owner,
    repo: params.repo,
    issue_number: params.issueNumber,
  });
  return {
    number: data.number,
    title: data.title,
    state: data.state,
    body: data.body ?? null,
    url: data.html_url,
  };
}

export async function createIssueComment(params: {
  owner: string;
  repo: string;
  issueNumber: number;
  body: string;
}): Promise<{ url: string }> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.issues.createComment({
    owner: params.owner,
    repo: params.repo,
    issue_number: params.issueNumber,
    body: params.body,
  });
  return { url: data.html_url };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/github/issues.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/github/issues.ts test/github/issues.test.ts
git commit -m "feat: add issue tools (create, list, get, comment)"
```

---

### Task 6: Pull request tools (`create_pull_request`, `list_pull_requests`, `get_pull_request`, `merge_pull_request`)

**Files:**
- Create: `src/github/pulls.ts`
- Test: `test/github/pulls.test.ts`

**Interfaces:**
- Consumes: `getOctokit()` from `src/github/client.ts` (Task 3).
- Produces:
  - `createPullRequest(params: { owner: string; repo: string; title: string; head: string; base: string; body?: string }): Promise<{ number: number; url: string }>`
  - `listPullRequests(params: { owner: string; repo: string; state?: 'open' | 'closed' | 'all' }): Promise<Array<{ number: number; title: string; state: string; url: string }>>`
  - `getPullRequest(params: { owner: string; repo: string; pullNumber: number }): Promise<{ number: number; title: string; state: string; body: string | null; mergeable: boolean | null; url: string }>`
  - `mergePullRequest(params: { owner: string; repo: string; pullNumber: number; mergeMethod?: 'merge' | 'squash' | 'rebase' }): Promise<{ merged: boolean; sha: string; message: string }>`
  - Used by `src/tools/register.ts` (Task 7).

- [ ] **Step 1: Write the failing tests**

Create `test/github/pulls.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
const mockList = vi.fn();
const mockGet = vi.fn();
const mockMerge = vi.fn();

vi.mock('../../src/github/client.js', () => ({
  getOctokit: () => ({
    rest: {
      pulls: {
        create: mockCreate,
        list: mockList,
        get: mockGet,
        merge: mockMerge,
      },
    },
  }),
}));

import { createPullRequest, listPullRequests, getPullRequest, mergePullRequest } from '../../src/github/pulls.js';

describe('createPullRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a PR with head/base/title/body', async () => {
    mockCreate.mockResolvedValue({ data: { number: 10, html_url: 'url-pr-10' } });

    const result = await createPullRequest({
      owner: 'octo',
      repo: 'hello',
      title: 'My PR',
      head: 'feature-branch',
      base: 'main',
      body: 'Description',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      owner: 'octo',
      repo: 'hello',
      title: 'My PR',
      head: 'feature-branch',
      base: 'main',
      body: 'Description',
    });
    expect(result).toEqual({ number: 10, url: 'url-pr-10' });
  });
});

describe('listPullRequests', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists PRs filtered by state, defaulting to open', async () => {
    mockList.mockResolvedValue({
      data: [{ number: 1, title: 'PR one', state: 'open', html_url: 'url1' }],
    });

    const result = await listPullRequests({ owner: 'octo', repo: 'hello' });

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'octo', repo: 'hello', state: 'open' })
    );
    expect(result).toEqual([{ number: 1, title: 'PR one', state: 'open', url: 'url1' }]);
  });
});

describe('getPullRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gets a single PR by number', async () => {
    mockGet.mockResolvedValue({
      data: {
        number: 3,
        title: 'PR three',
        state: 'open',
        body: 'body text',
        mergeable: true,
        html_url: 'url3',
      },
    });

    const result = await getPullRequest({ owner: 'octo', repo: 'hello', pullNumber: 3 });

    expect(mockGet).toHaveBeenCalledWith({ owner: 'octo', repo: 'hello', pull_number: 3 });
    expect(result).toEqual({
      number: 3,
      title: 'PR three',
      state: 'open',
      body: 'body text',
      mergeable: true,
      url: 'url3',
    });
  });
});

describe('mergePullRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('merges a PR with the given merge method, defaulting to merge', async () => {
    mockMerge.mockResolvedValue({ data: { merged: true, sha: 'mergesha', message: 'Pull Request successfully merged' } });

    const result = await mergePullRequest({ owner: 'octo', repo: 'hello', pullNumber: 3 });

    expect(mockMerge).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'octo', repo: 'hello', pull_number: 3, merge_method: 'merge' })
    );
    expect(result).toEqual({ merged: true, sha: 'mergesha', message: 'Pull Request successfully merged' });
  });

  it('passes through a custom merge_method', async () => {
    mockMerge.mockResolvedValue({ data: { merged: true, sha: 'sha2', message: 'ok' } });

    await mergePullRequest({ owner: 'octo', repo: 'hello', pullNumber: 4, mergeMethod: 'squash' });

    expect(mockMerge).toHaveBeenCalledWith(
      expect.objectContaining({ merge_method: 'squash' })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/github/pulls.test.ts`
Expected: FAIL — `src/github/pulls.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/github/pulls.ts`:

```typescript
import { getOctokit } from './client.js';

export async function createPullRequest(params: {
  owner: string;
  repo: string;
  title: string;
  head: string;
  base: string;
  body?: string;
}): Promise<{ number: number; url: string }> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.pulls.create({
    owner: params.owner,
    repo: params.repo,
    title: params.title,
    head: params.head,
    base: params.base,
    body: params.body,
  });
  return { number: data.number, url: data.html_url };
}

export async function listPullRequests(params: {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
}): Promise<Array<{ number: number; title: string; state: string; url: string }>> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.pulls.list({
    owner: params.owner,
    repo: params.repo,
    state: params.state ?? 'open',
  });
  return data.map((pr) => ({ number: pr.number, title: pr.title, state: pr.state, url: pr.html_url }));
}

export async function getPullRequest(params: {
  owner: string;
  repo: string;
  pullNumber: number;
}): Promise<{ number: number; title: string; state: string; body: string | null; mergeable: boolean | null; url: string }> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.pulls.get({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pullNumber,
  });
  return {
    number: data.number,
    title: data.title,
    state: data.state,
    body: data.body ?? null,
    mergeable: data.mergeable ?? null,
    url: data.html_url,
  };
}

export async function mergePullRequest(params: {
  owner: string;
  repo: string;
  pullNumber: number;
  mergeMethod?: 'merge' | 'squash' | 'rebase';
}): Promise<{ merged: boolean; sha: string; message: string }> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.pulls.merge({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pullNumber,
    merge_method: params.mergeMethod ?? 'merge',
  });
  return { merged: data.merged, sha: data.sha, message: data.message };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/github/pulls.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/github/pulls.ts test/github/pulls.test.ts
git commit -m "feat: add pull request tools (create, list, get, merge)"
```

---

### Task 7: MCP tool registration

**Files:**
- Create: `src/tools/register.ts`

**Interfaces:**
- Consumes:
  - `listRepoTree`, `getFileContent`, `createOrUpdateFile` from `src/github/repos.ts` (Task 4)
  - `createIssue`, `listIssues`, `getIssue`, `createIssueComment` from `src/github/issues.ts` (Task 5)
  - `createPullRequest`, `listPullRequests`, `getPullRequest`, `mergePullRequest` from `src/github/pulls.ts` (Task 6)
- Produces: `registerAllTools(server: McpServer): void` — used by `api/server.ts` (Task 8).

This task has no isolated unit test of its own: it is pure wiring (zod shapes → already-tested functions → text-serialization), and its correctness is exercised end-to-end in Task 9's manual verification. Keeping it test-free here avoids re-testing Octokit call shapes already covered in Tasks 4–6, per the spec's stated testing approach.

- [ ] **Step 1: Write the implementation**

Create `src/tools/register.ts`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listRepoTree, getFileContent, createOrUpdateFile } from '../github/repos.js';
import { createIssue, listIssues, getIssue, createIssueComment } from '../github/issues.js';
import { createPullRequest, listPullRequests, getPullRequest, mergePullRequest } from '../github/pulls.js';

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerAllTools(server: McpServer): void {
  server.registerTool(
    'list_repo_tree',
    {
      description: 'Recursively list files and directories in a GitHub repository (optionally scoped to a path).',
      inputSchema: {
        owner: z.string().describe('Repository owner (user or org)'),
        repo: z.string().describe('Repository name'),
        ref: z.string().optional().describe('Branch, tag, or commit SHA (defaults to the repo HEAD)'),
        path: z.string().optional().describe('Restrict results to this path prefix'),
      },
    },
    async ({ owner, repo, ref, path }) => textResult(await listRepoTree({ owner, repo, ref, path }))
  );

  server.registerTool(
    'get_file_content',
    {
      description: 'Read the decoded text content of a single file in a GitHub repository.',
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        path: z.string().describe('File path within the repository'),
        ref: z.string().optional().describe('Branch, tag, or commit SHA'),
      },
    },
    async ({ owner, repo, path, ref }) => textResult(await getFileContent({ owner, repo, path, ref }))
  );

  server.registerTool(
    'create_or_update_file',
    {
      description: 'Create a new file or update an existing file in a GitHub repository, committing directly to a branch.',
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        path: z.string(),
        content: z.string().describe('New file content as plain text (not base64)'),
        message: z.string().describe('Commit message'),
        branch: z.string().describe('Branch to commit to'),
        createBranch: z.boolean().optional().describe('If true, create `branch` from `baseBranch` before committing'),
        baseBranch: z.string().optional().describe('Branch to base the new branch on when createBranch is true (default: main)'),
      },
    },
    async ({ owner, repo, path, content, message, branch, createBranch, baseBranch }) =>
      textResult(
        await createOrUpdateFile({ owner, repo, path, content, message, branch, createBranch, baseBranch })
      )
  );

  server.registerTool(
    'create_issue',
    {
      description: 'Create a new issue in a GitHub repository.',
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        title: z.string(),
        body: z.string().optional(),
        labels: z.array(z.string()).optional(),
      },
    },
    async ({ owner, repo, title, body, labels }) =>
      textResult(await createIssue({ owner, repo, title, body, labels }))
  );

  server.registerTool(
    'list_issues',
    {
      description: 'List issues in a GitHub repository (pull requests are excluded from results).',
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        state: z.enum(['open', 'closed', 'all']).optional().describe('Defaults to open'),
      },
    },
    async ({ owner, repo, state }) => textResult(await listIssues({ owner, repo, state }))
  );

  server.registerTool(
    'get_issue',
    {
      description: 'Get details of a single issue by number.',
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        issueNumber: z.number().int().describe('Issue number'),
      },
    },
    async ({ owner, repo, issueNumber }) => textResult(await getIssue({ owner, repo, issueNumber }))
  );

  server.registerTool(
    'create_issue_comment',
    {
      description: 'Post a comment on an issue or a pull request (GitHub treats PRs as issues for comments).',
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        issueNumber: z.number().int().describe('Issue or pull request number'),
        body: z.string(),
      },
    },
    async ({ owner, repo, issueNumber, body }) =>
      textResult(await createIssueComment({ owner, repo, issueNumber, body }))
  );

  server.registerTool(
    'create_pull_request',
    {
      description: 'Create a pull request from one branch into another.',
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        title: z.string(),
        head: z.string().describe('Branch containing the changes'),
        base: z.string().describe('Branch to merge into'),
        body: z.string().optional(),
      },
    },
    async ({ owner, repo, title, head, base, body }) =>
      textResult(await createPullRequest({ owner, repo, title, head, base, body }))
  );

  server.registerTool(
    'list_pull_requests',
    {
      description: 'List pull requests in a GitHub repository.',
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        state: z.enum(['open', 'closed', 'all']).optional().describe('Defaults to open'),
      },
    },
    async ({ owner, repo, state }) => textResult(await listPullRequests({ owner, repo, state }))
  );

  server.registerTool(
    'get_pull_request',
    {
      description: 'Get details of a single pull request by number.',
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        pullNumber: z.number().int().describe('Pull request number'),
      },
    },
    async ({ owner, repo, pullNumber }) => textResult(await getPullRequest({ owner, repo, pullNumber }))
  );

  server.registerTool(
    'merge_pull_request',
    {
      description: 'Merge an open pull request.',
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        pullNumber: z.number().int().describe('Pull request number'),
        mergeMethod: z.enum(['merge', 'squash', 'rebase']).optional().describe('Defaults to merge'),
      },
    },
    async ({ owner, repo, pullNumber, mergeMethod }) =>
      textResult(await mergePullRequest({ owner, repo, pullNumber, mergeMethod }))
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/tools/register.ts
git commit -m "feat: register all 11 MCP tools"
```

---

### Task 8: Vercel entry point

**Files:**
- Create: `api/server.ts`

**Interfaces:**
- Consumes: `checkConnectorSecret` from `src/auth.ts` (Task 2), `registerAllTools` from `src/tools/register.ts` (Task 7).
- Produces: the default-exported Vercel Node.js handler `(req: VercelRequest, res: VercelResponse) => Promise<void>`, the connector's actual HTTP entry point.

- [ ] **Step 1: Write the implementation**

Create `api/server.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { checkConnectorSecret } from '../src/auth.js';
import { registerAllTools } from '../src/tools/register.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const secretHeader = req.headers['x-connector-secret'];
  if (!checkConnectorSecret(secretHeader)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const server = new McpServer({ name: 'github-connector', version: '1.0.0' });
  registerAllTools(server);

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: all tests from Tasks 2, 4, 5, 6 PASS (total 19 tests).

- [ ] **Step 4: Commit**

```bash
git add api/server.ts
git commit -m "feat: add Vercel MCP entry point with shared-secret auth"
```

---

### Task 9: Deploy and manual end-to-end verification

**Files:** None created — this task exercises the deployed system.

**Interfaces:**
- Consumes: the fully wired system from Tasks 1–8.
- Produces: confirmation that the connector works against real GitHub state, and a configured ChatGPT connector pointing at the deployment.

- [ ] **Step 1: Create a disposable test GitHub repo**

Using the GitHub web UI or `gh repo create <your-username>/mcp-connector-test --public`, create a throwaway repo to test against. Add one file (e.g. `README.md`) so the default branch has at least one commit (required before `git.createRef` can branch from it).

- [ ] **Step 2: Generate a GitHub PAT**

Create a fine-grained PAT (Settings → Developer settings → Personal access tokens) scoped to the test repo (or all repos, if broader use is intended), with permissions: Contents (read/write), Issues (read/write), Pull requests (read/write).

- [ ] **Step 3: Generate a connector secret**

Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
Save the output as your `CONNECTOR_SECRET`.

- [ ] **Step 4: Deploy to Vercel**

Run: `npx vercel --prod` (or connect the GitHub repo to Vercel via the dashboard for git-based deploys). Confirm the deployment.

In the Vercel project dashboard, set environment variables:
- `GITHUB_TOKEN` = the PAT from Step 2
- `CONNECTOR_SECRET` = the secret from Step 3

Redeploy if the environment variables were added after the first deploy (Vercel requires a redeploy to pick up new env vars).

- [ ] **Step 5: Smoke-test the deployed endpoint with curl**

Run (replace `<deployment-url>` and `<secret>`):

```bash
curl -i -X POST https://<deployment-url>/mcp \
  -H "Content-Type: application/json" \
  -H "X-Connector-Secret: <secret>" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Expected: HTTP 200 with a JSON-RPC response listing all 11 registered tools.

Run the same request without the `X-Connector-Secret` header.
Expected: HTTP 401 with `{"error":"Unauthorized"}`.

- [ ] **Step 6: Exercise each tool once against the test repo via curl**

For each of the 11 tools, send a `tools/call` request and confirm both the JSON-RPC response and the actual GitHub state change. Example for `create_issue`:

```bash
curl -s -X POST https://<deployment-url>/mcp \
  -H "Content-Type: application/json" \
  -H "X-Connector-Secret: <secret>" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"create_issue","arguments":{"owner":"<your-username>","repo":"mcp-connector-test","title":"Test issue","body":"Created via MCP connector"}}}'
```

Expected: response contains the created issue's number and URL; confirm the issue actually appears on GitHub.

Repeat this pattern for: `list_repo_tree`, `get_file_content`, `create_or_update_file` (both with and without `createBranch: true`), `list_issues`, `get_issue`, `create_issue_comment`, `create_pull_request` (using the branch created by `create_or_update_file`), `list_pull_requests`, `get_pull_request`, `merge_pull_request`.

For each, verify on github.com that the expected state change actually happened (file exists with correct content, issue/PR exists, comment posted, PR merged).

- [ ] **Step 7: Configure the ChatGPT connector**

In ChatGPT's connector/App settings (developer mode), add a new MCP connector pointing at `https://<deployment-url>/mcp`, configured to send the `X-Connector-Secret` header with every request (per whatever custom-header mechanism ChatGPT's connector UI exposes — confirm this exists at configuration time; if ChatGPT's UI doesn't support custom headers for developer-mode connectors, this is a gap to report back rather than silently work around).

- [ ] **Step 8: End-to-end test from ChatGPT itself**

In a ChatGPT conversation with the connector enabled, ask it to: list files in the test repo, create an issue, comment on that issue, create/update a file, open a PR, and merge it. Confirm each action succeeds and reflects on github.com.

- [ ] **Step 9: Commit any fixes discovered during verification**

If Step 6 or 8 surfaces bugs, fix them in the relevant `src/github/*.ts` or `src/tools/register.ts` file, add/update the corresponding unit test, re-run `npm test`, and commit with a message describing the fix.
