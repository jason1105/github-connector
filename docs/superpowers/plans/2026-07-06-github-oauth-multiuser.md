# Multi-user GitHub OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the connector's single shared GitHub PAT with real per-user GitHub OAuth — each ChatGPT user authenticates with their own GitHub account via a classic GitHub OAuth App; the MCP server acts as OAuth Authorization Server to ChatGPT and OAuth Client to GitHub, bridging the two via a Redis-backed opaque token mapping.

**Architecture:** A custom `OAuthServerProvider` implementation issues its own `mcp_access_token`/`mcp_refresh_token` pair (never GitHub's raw token) to ChatGPT, storing a `mcp_access_token → GitHub user's token` mapping in Upstash Redis. The SDK's built-in `mcpAuthRouter` handles the OAuth 2.1 + PKCE protocol mechanics against ChatGPT; a custom `/callback` route handles the GitHub-facing leg. Since the SDK's OAuth router hard-depends on Express, `api/server.ts` is rewritten as an Express app exported directly as the Vercel serverless function.

**Tech Stack:** TypeScript, Node.js, `@modelcontextprotocol/sdk@^1.29.0` (existing), `express@^5.2.1` (new), `@upstash/redis@^1.x` (new), `octokit@^5.0.5` (existing), `zod@^4.4.3` (existing), Vercel Node.js runtime, `vitest` (existing).

## Global Constraints

- Classic GitHub OAuth App (not a GitHub App) — GitHub tokens do not expire; no refresh-token logic on the GitHub side.
- MCP-level `mcp_access_token` TTL: exactly 24 hours (86400 seconds). `mcp_refresh_token`: no TTL.
- `challengeForAuthorizationCode` MUST be a non-destructive read (verified: the SDK's own `token.js` calls this separately from `exchangeAuthorizationCode` and does the PKCE SHA256+base64url comparison itself before calling `exchangeAuthorizationCode`).
- `OAuthServerProvider.authorize(client, params, res)`'s `res` parameter is literally Express's `Response` — the implementation must call `res.redirect(...)` itself; the method returns `Promise<void>`.
- `requireBearerAuth({verifier, ...})` accepts the slim `OAuthTokenVerifier` interface (`{verifyAccessToken(token): Promise<AuthInfo>}`), not the full `OAuthServerProvider` — pass the same provider instance since it satisfies this interface structurally.
- Do not use `ProxyOAuthServerProvider` — it passes GitHub's raw token straight through with no persistent mapping, contradicting this design.
- All 11 existing `src/github/*.ts` functions gain a new required leading `octokit: Octokit` parameter — no other logic in those files changes.
- No backward compatibility: the connector is becoming a general-purpose public multi-user tool, so the shared-secret path (`src/auth.ts`, `checkConnectorSecret`), `ALLOW_NO_AUTH`, and the single `GITHUB_TOKEN` are deleted entirely, not kept as a fallback. `/mcp` is OAuth-only.
- Every task's commits go on a feature branch, never directly to `main`. Do not push to `origin` or open the PR until explicitly instructed.
- Redis env var names are NOT assumed — Task 1 is a verification spike that must run before Task 2 writes any Redis code.

---

## File Structure

```
github-connector/
  api/
    server.ts                    # REPLACED: exports the assembled Express app
  src/
    oauth/
      github-client.ts           # NEW: GitHub's own OAuth endpoints (raw fetch)
      store.ts                   # NEW: Redis-backed persistence
      authorization-server.ts    # NEW: OAuthServerProvider implementation + /callback handler
    github/
      client.ts                  # MODIFIED: getOctokit(token) — no singleton
      repos.ts, issues.ts, pulls.ts  # MODIFIED: leading octokit param on all 11 fns
    tools/
      register.ts                 # MODIFIED: resolve Octokit from authenticated request
    auth.ts                       # DELETED (no backward-compat path)
  test/
    oauth/
      github-client.test.ts, store.test.ts, authorization-server.test.ts  # NEW
    github/
      repos.test.ts, issues.test.ts, pulls.test.ts  # MODIFIED
    helpers/
      fakeOctokit.ts               # NEW
  vercel.json                     # MODIFIED
  package.json                    # MODIFIED
  .env.example                    # MODIFIED
```

---

### Task 1: Upstash Redis env var verification spike

**Files:** None created — this is a manual/CLI verification step, not a code task.

- [ ] **Step 1: Add the Upstash integration**

In the Vercel dashboard, go to the `github-connector` project → Storage (or Integrations/Marketplace) tab → add the **Upstash** integration, creating a new Redis database (or connecting an existing one).

- [ ] **Step 2: Pull the actual injected env vars**

Run: `cd /Users/lvwei/MyProjects/lvwei/app/github-connector && vercel env pull .env.vercel-check`

- [ ] **Step 3: Inspect the actual variable names**

Run: `grep -i "redis\|upstash\|kv_" .env.vercel-check`

Expected: either `KV_REST_API_URL`/`KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` (or both). Record the exact names found — Task 2's `store.ts` must reference the real names, not assume one.

- [ ] **Step 4: Delete the temporary file (contains real secrets)**

Run: `rm .env.vercel-check`

- [ ] **Step 5: Report the exact variable names found**

Note them in the Task 2 dispatch — do not proceed to Task 2 until this is known.

---

### Task 2: `src/oauth/store.ts` — Redis persistence layer

**Files:**
- Create: `src/oauth/store.ts`
- Test: `test/oauth/store.test.ts`

**Interfaces:**
- Produces: `getMcpClient`, `saveMcpClient`, `savePendingAuthorization`, `consumePendingAuthorization`, `saveAuthCode`, `getAuthCode` (non-destructive), `consumeAuthCode` (destructive), `saveMcpTokenPair`, `getMcpAccessToken`, `consumeMcpRefreshToken`, `getGithubToken`, `saveGithubToken` — used by `src/oauth/authorization-server.ts` (Task 4) and `src/tools/register.ts` (Task 7).

- [ ] **Step 1: Write the failing tests**

Create `test/oauth/store.test.ts` (using the exact Redis env var names discovered in Task 1 — replace `<REDIS_URL_VAR>`/`<REDIS_TOKEN_VAR>` below with the real names before writing):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDel = vi.fn();

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(() => ({ get: mockGet, set: mockSet, del: mockDel })),
}));

import {
  getMcpClient,
  saveMcpClient,
  savePendingAuthorization,
  consumePendingAuthorization,
  saveAuthCode,
  getAuthCode,
  consumeAuthCode,
  saveMcpTokenPair,
  getMcpAccessToken,
  consumeMcpRefreshToken,
  getGithubToken,
  saveGithubToken,
} from '../../src/oauth/store.js';

describe('store', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('MCP client registration', () => {
    it('saves a client with no TTL', async () => {
      const client = { client_id: 'abc', redirect_uris: ['https://chatgpt.com/cb'] };
      await saveMcpClient(client as any);
      expect(mockSet).toHaveBeenCalledWith('mcp:client:abc', JSON.stringify(client));
    });

    it('retrieves a client by id', async () => {
      mockGet.mockResolvedValue({ client_id: 'abc' });
      const result = await getMcpClient('abc');
      expect(mockGet).toHaveBeenCalledWith('mcp:client:abc');
      expect(result).toEqual({ client_id: 'abc' });
    });

    it('returns undefined for an unknown client', async () => {
      mockGet.mockResolvedValue(null);
      const result = await getMcpClient('missing');
      expect(result).toBeUndefined();
    });
  });

  describe('pending authorization (GitHub-facing state correlation)', () => {
    it('saves a pending authorization with a 10-minute TTL', async () => {
      const data = { clientId: 'abc', codeChallenge: 'xyz', redirectUri: 'https://chatgpt.com/cb', chatgptState: 's1' };
      await savePendingAuthorization('internal-state-1', data);
      expect(mockSet).toHaveBeenCalledWith('oauth:pending:internal-state-1', JSON.stringify(data), { ex: 600 });
    });

    it('consumes (gets and deletes) a pending authorization', async () => {
      const data = { clientId: 'abc', codeChallenge: 'xyz', redirectUri: 'https://chatgpt.com/cb', chatgptState: 's1' };
      mockGet.mockResolvedValue(data);
      const result = await consumePendingAuthorization('internal-state-1');
      expect(mockGet).toHaveBeenCalledWith('oauth:pending:internal-state-1');
      expect(mockDel).toHaveBeenCalledWith('oauth:pending:internal-state-1');
      expect(result).toEqual(data);
    });

    it('returns undefined when consuming a missing pending authorization', async () => {
      mockGet.mockResolvedValue(null);
      const result = await consumePendingAuthorization('missing');
      expect(result).toBeUndefined();
      expect(mockDel).not.toHaveBeenCalled();
    });
  });

  describe('MCP authorization codes', () => {
    it('saves an auth code with a 10-minute TTL', async () => {
      const data = { clientId: 'abc', userId: '42', codeChallenge: 'xyz', redirectUri: 'https://chatgpt.com/cb' };
      await saveAuthCode('code-1', data);
      expect(mockSet).toHaveBeenCalledWith('mcp:authcode:code-1', JSON.stringify(data), { ex: 600 });
    });

    it('gets an auth code without deleting it', async () => {
      const data = { clientId: 'abc', userId: '42', codeChallenge: 'xyz', redirectUri: 'https://chatgpt.com/cb' };
      mockGet.mockResolvedValue(data);
      const result = await getAuthCode('code-1');
      expect(mockGet).toHaveBeenCalledWith('mcp:authcode:code-1');
      expect(mockDel).not.toHaveBeenCalled();
      expect(result).toEqual(data);
    });

    it('consumes (gets and deletes) an auth code', async () => {
      const data = { clientId: 'abc', userId: '42', codeChallenge: 'xyz', redirectUri: 'https://chatgpt.com/cb' };
      mockGet.mockResolvedValue(data);
      const result = await consumeAuthCode('code-1');
      expect(mockDel).toHaveBeenCalledWith('mcp:authcode:code-1');
      expect(result).toEqual(data);
    });
  });

  describe('MCP token pairs', () => {
    it('saves an access token (24h TTL) and refresh token (no TTL)', async () => {
      await saveMcpTokenPair('access-1', 'refresh-1', { clientId: 'abc', userId: '42', scopes: ['repo'] });
      expect(mockSet).toHaveBeenCalledWith(
        'mcp:token:access-1',
        JSON.stringify({ clientId: 'abc', userId: '42', scopes: ['repo'] }),
        { ex: 86400 }
      );
      expect(mockSet).toHaveBeenCalledWith(
        'mcp:refresh:refresh-1',
        JSON.stringify({ clientId: 'abc', userId: '42', scopes: ['repo'] })
      );
    });

    it('retrieves an access token entry', async () => {
      mockGet.mockResolvedValue({ clientId: 'abc', userId: '42', scopes: ['repo'] });
      const result = await getMcpAccessToken('access-1');
      expect(mockGet).toHaveBeenCalledWith('mcp:token:access-1');
      expect(result).toEqual({ clientId: 'abc', userId: '42', scopes: ['repo'] });
    });

    it('consumes (gets and deletes) a refresh token', async () => {
      mockGet.mockResolvedValue({ clientId: 'abc', userId: '42', scopes: ['repo'] });
      const result = await consumeMcpRefreshToken('refresh-1');
      expect(mockDel).toHaveBeenCalledWith('mcp:refresh:refresh-1');
      expect(result).toEqual({ clientId: 'abc', userId: '42', scopes: ['repo'] });
    });
  });

  describe('GitHub token storage', () => {
    it('saves a GitHub token with no TTL, keyed by userId', async () => {
      await saveGithubToken('42', { accessToken: 'ghu_abc' });
      expect(mockSet).toHaveBeenCalledWith('github:token:42', JSON.stringify({ accessToken: 'ghu_abc' }));
    });

    it('retrieves a GitHub token by userId', async () => {
      mockGet.mockResolvedValue({ accessToken: 'ghu_abc' });
      const result = await getGithubToken('42');
      expect(mockGet).toHaveBeenCalledWith('github:token:42');
      expect(result).toEqual({ accessToken: 'ghu_abc' });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/oauth/store.test.ts`
Expected: FAIL — `src/oauth/store.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/oauth/store.ts` (replace `<REDIS_URL_VAR>`/`<REDIS_TOKEN_VAR>` with the exact env var names discovered in Task 1 — e.g. if Task 1 found `KV_REST_API_URL`/`KV_REST_API_TOKEN`, use those literal names):

```typescript
import { Redis } from '@upstash/redis';

let client: Redis | undefined;

function getRedis(): Redis {
  if (client) return client;
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('Redis connection env vars are not set (checked KV_REST_API_URL/TOKEN and UPSTASH_REDIS_REST_URL/TOKEN)');
  }
  client = new Redis({ url, token });
  return client;
}

export interface McpClient {
  client_id: string;
  [key: string]: unknown;
}

export interface PendingAuthorization {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  resource?: string;
  chatgptState?: string;
}

export interface McpAuthCode {
  clientId: string;
  userId: string;
  codeChallenge: string;
  redirectUri: string;
  resource?: string;
}

export interface McpTokenData {
  clientId: string;
  userId: string;
  scopes: string[];
}

export interface GithubTokenData {
  accessToken: string;
}

export async function getMcpClient(clientId: string): Promise<McpClient | undefined> {
  const data = await getRedis().get<McpClient>(`mcp:client:${clientId}`);
  return data ?? undefined;
}

export async function saveMcpClient(client: McpClient): Promise<void> {
  await getRedis().set(`mcp:client:${client.client_id}`, JSON.stringify(client));
}

export async function savePendingAuthorization(state: string, data: PendingAuthorization): Promise<void> {
  await getRedis().set(`oauth:pending:${state}`, JSON.stringify(data), { ex: 600 });
}

export async function consumePendingAuthorization(state: string): Promise<PendingAuthorization | undefined> {
  const key = `oauth:pending:${state}`;
  const data = await getRedis().get<PendingAuthorization>(key);
  if (!data) return undefined;
  await getRedis().del(key);
  return data;
}

export async function saveAuthCode(code: string, data: McpAuthCode): Promise<void> {
  await getRedis().set(`mcp:authcode:${code}`, JSON.stringify(data), { ex: 600 });
}

export async function getAuthCode(code: string): Promise<McpAuthCode | undefined> {
  const data = await getRedis().get<McpAuthCode>(`mcp:authcode:${code}`);
  return data ?? undefined;
}

export async function consumeAuthCode(code: string): Promise<McpAuthCode | undefined> {
  const key = `mcp:authcode:${code}`;
  const data = await getRedis().get<McpAuthCode>(key);
  if (!data) return undefined;
  await getRedis().del(key);
  return data;
}

export async function saveMcpTokenPair(
  accessToken: string,
  refreshToken: string,
  data: McpTokenData
): Promise<void> {
  await getRedis().set(`mcp:token:${accessToken}`, JSON.stringify(data), { ex: 86400 });
  await getRedis().set(`mcp:refresh:${refreshToken}`, JSON.stringify(data));
}

export async function getMcpAccessToken(token: string): Promise<McpTokenData | undefined> {
  const data = await getRedis().get<McpTokenData>(`mcp:token:${token}`);
  return data ?? undefined;
}

export async function consumeMcpRefreshToken(token: string): Promise<McpTokenData | undefined> {
  const key = `mcp:refresh:${token}`;
  const data = await getRedis().get<McpTokenData>(key);
  if (!data) return undefined;
  await getRedis().del(key);
  return data;
}

export async function getGithubToken(userId: string): Promise<GithubTokenData | undefined> {
  const data = await getRedis().get<GithubTokenData>(`github:token:${userId}`);
  return data ?? undefined;
}

export async function saveGithubToken(userId: string, data: GithubTokenData): Promise<void> {
  await getRedis().set(`github:token:${userId}`, JSON.stringify(data));
}
```

Note: `@upstash/redis`'s `get<T>()` already deserializes JSON automatically (it does not return a raw string requiring `JSON.parse`) — this implementation stores via `JSON.stringify` explicitly for test-assertion clarity and reads back the deserialized object directly. If `@upstash/redis`'s actual runtime behavior double-encodes (verify during Step 4), adjust to store the plain object directly (`.set(key, data, {ex})` without `JSON.stringify`) instead — flag this as a verify-at-implementation-time detail.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/oauth/store.test.ts`
Expected: PASS. If failures relate to JSON encoding (per the note above), adjust `store.ts` to match `@upstash/redis`'s actual serialization behavior and re-run.

- [ ] **Step 5: Install the new dependency and typecheck**

Run: `npm install @upstash/redis && npm run build`
Expected: clean install, zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/oauth/store.ts test/oauth/store.test.ts package.json package-lock.json
git commit -m "feat: add Redis-backed OAuth token store"
```

---

### Task 3: `src/oauth/github-client.ts` — GitHub OAuth endpoint wrapper

**Files:**
- Create: `src/oauth/github-client.ts`
- Test: `test/oauth/github-client.test.ts`

**Interfaces:**
- Produces: `buildGithubAuthorizeUrl(params)`, `exchangeCodeForGithubToken(params)`, `getGithubUser(accessToken)` — used by `src/oauth/authorization-server.ts` (Task 4).

- [ ] **Step 1: Write the failing tests**

Create `test/oauth/github-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildGithubAuthorizeUrl, exchangeCodeForGithubToken, getGithubUser } from '../../src/oauth/github-client.js';

describe('buildGithubAuthorizeUrl', () => {
  it('builds a correctly-formed GitHub authorize URL', () => {
    const url = buildGithubAuthorizeUrl({
      clientId: 'client-123',
      redirectUri: 'https://example.com/callback',
      state: 'state-abc',
      scope: 'repo',
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('client-123');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://example.com/callback');
    expect(parsed.searchParams.get('state')).toBe('state-abc');
    expect(parsed.searchParams.get('scope')).toBe('repo');
  });
});

describe('exchangeCodeForGithubToken', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('POSTs to GitHub token endpoint and returns the parsed token response', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'ghu_abc', token_type: 'bearer', scope: 'repo' }),
    });

    const result = await exchangeCodeForGithubToken({
      clientId: 'client-123',
      clientSecret: 'secret-xyz',
      code: 'auth-code-1',
      redirectUri: 'https://example.com/callback',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://github.com/login/oauth/access_token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Accept: 'application/json' }),
      })
    );
    expect(result).toEqual({ accessToken: 'ghu_abc', tokenType: 'bearer', scope: 'repo' });
  });

  it('throws a descriptive error when GitHub returns an error response', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ error: 'bad_verification_code', error_description: 'The code passed is incorrect or expired.' }),
    });

    await expect(
      exchangeCodeForGithubToken({
        clientId: 'client-123',
        clientSecret: 'secret-xyz',
        code: 'bad-code',
        redirectUri: 'https://example.com/callback',
      })
    ).rejects.toThrow(/bad_verification_code/);
  });
});

describe('getGithubUser', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('GETs the authenticated user and returns id/login', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 42, login: 'octocat' }),
    });

    const result = await getGithubUser('ghu_abc');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/user',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer ghu_abc' }),
      })
    );
    expect(result).toEqual({ id: 42, login: 'octocat' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/oauth/github-client.test.ts`
Expected: FAIL — `src/oauth/github-client.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/oauth/github-client.ts`:

```typescript
export function buildGithubAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope: string;
}): string {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('state', params.state);
  url.searchParams.set('scope', params.scope);
  return url.toString();
}

export async function exchangeCodeForGithubToken(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string; tokenType: string; scope: string }> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`GitHub token exchange failed: ${data.error} — ${data.error_description ?? ''}`);
  }

  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    scope: data.scope,
  };
}

export async function getGithubUser(accessToken: string): Promise<{ id: number; login: string }> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub user: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return { id: data.id, login: data.login };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/oauth/github-client.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/oauth/github-client.ts test/oauth/github-client.test.ts
git commit -m "feat: add GitHub OAuth endpoint wrapper"
```

---

### Task 4: `src/oauth/authorization-server.ts` — OAuthServerProvider implementation

**Files:**
- Create: `src/oauth/authorization-server.ts`
- Test: `test/oauth/authorization-server.test.ts`

**Interfaces:**
- Consumes: everything from `src/oauth/store.ts` (Task 2) and `src/oauth/github-client.ts` (Task 3).
- Produces: `createAuthorizationServerProvider(): OAuthServerProvider` (a factory, so tests can construct fresh instances), plus `handleGithubCallback(req, res): Promise<void>` (the `/callback` Express route handler) — used by `api/server.ts` (Task 6).

- [ ] **Step 1: Write the failing tests**

Create `test/oauth/authorization-server.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';

const mockGetMcpClient = vi.fn();
const mockSaveMcpClient = vi.fn();
const mockSavePendingAuthorization = vi.fn();
const mockConsumePendingAuthorization = vi.fn();
const mockSaveAuthCode = vi.fn();
const mockGetAuthCode = vi.fn();
const mockConsumeAuthCode = vi.fn();
const mockSaveMcpTokenPair = vi.fn();
const mockGetMcpAccessToken = vi.fn();
const mockConsumeMcpRefreshToken = vi.fn();
const mockGetGithubToken = vi.fn();
const mockSaveGithubToken = vi.fn();

vi.mock('../../src/oauth/store.js', () => ({
  getMcpClient: mockGetMcpClient,
  saveMcpClient: mockSaveMcpClient,
  savePendingAuthorization: mockSavePendingAuthorization,
  consumePendingAuthorization: mockConsumePendingAuthorization,
  saveAuthCode: mockSaveAuthCode,
  getAuthCode: mockGetAuthCode,
  consumeAuthCode: mockConsumeAuthCode,
  saveMcpTokenPair: mockSaveMcpTokenPair,
  getMcpAccessToken: mockGetMcpAccessToken,
  consumeMcpRefreshToken: mockConsumeMcpRefreshToken,
  getGithubToken: mockGetGithubToken,
  saveGithubToken: mockSaveGithubToken,
}));

const mockBuildGithubAuthorizeUrl = vi.fn();
const mockExchangeCodeForGithubToken = vi.fn();
const mockGetGithubUser = vi.fn();

vi.mock('../../src/oauth/github-client.js', () => ({
  buildGithubAuthorizeUrl: mockBuildGithubAuthorizeUrl,
  exchangeCodeForGithubToken: mockExchangeCodeForGithubToken,
  getGithubUser: mockGetGithubUser,
}));

import { createAuthorizationServerProvider, handleGithubCallback } from '../../src/oauth/authorization-server.js';

describe('createAuthorizationServerProvider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clientsStore.getClient delegates to store.getMcpClient', async () => {
    mockGetMcpClient.mockResolvedValue({ client_id: 'abc' });
    const provider = createAuthorizationServerProvider();
    const result = await provider.clientsStore.getClient('abc');
    expect(mockGetMcpClient).toHaveBeenCalledWith('abc');
    expect(result).toEqual({ client_id: 'abc' });
  });

  it('clientsStore.registerClient generates a client_id/secret and saves via store', async () => {
    const provider = createAuthorizationServerProvider();
    const input = { redirect_uris: ['https://chatgpt.com/callback'] };
    const result = await provider.clientsStore.registerClient!(input as any);
    expect(result.client_id).toBeTruthy();
    expect(result.redirect_uris).toEqual(['https://chatgpt.com/callback']);
    expect(mockSaveMcpClient).toHaveBeenCalledWith(expect.objectContaining({ client_id: result.client_id }));
  });

  it('authorize() stores a pending authorization and redirects to GitHub', async () => {
    mockBuildGithubAuthorizeUrl.mockReturnValue('https://github.com/login/oauth/authorize?client_id=gh-client');
    const provider = createAuthorizationServerProvider();
    const res = { redirect: vi.fn() } as any;
    const client = { client_id: 'chatgpt-client', redirect_uris: ['https://chatgpt.com/callback'] };
    const params = { codeChallenge: 'challenge-xyz', redirectUri: 'https://chatgpt.com/callback', state: 'chatgpt-state-1' };

    await provider.authorize(client as any, params as any, res);

    expect(mockSavePendingAuthorization).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        clientId: 'chatgpt-client',
        codeChallenge: 'challenge-xyz',
        redirectUri: 'https://chatgpt.com/callback',
        chatgptState: 'chatgpt-state-1',
      })
    );
    expect(res.redirect).toHaveBeenCalledWith('https://github.com/login/oauth/authorize?client_id=gh-client');
  });

  it('challengeForAuthorizationCode returns the stored challenge without consuming the code', async () => {
    mockGetAuthCode.mockResolvedValue({ clientId: 'abc', userId: '42', codeChallenge: 'challenge-xyz', redirectUri: 'https://chatgpt.com/callback' });
    const provider = createAuthorizationServerProvider();
    const result = await provider.challengeForAuthorizationCode({ client_id: 'abc' } as any, 'code-1');
    expect(mockGetAuthCode).toHaveBeenCalledWith('code-1');
    expect(mockConsumeAuthCode).not.toHaveBeenCalled();
    expect(result).toBe('challenge-xyz');
  });

  it('exchangeAuthorizationCode consumes the code and mints an MCP token pair', async () => {
    mockConsumeAuthCode.mockResolvedValue({ clientId: 'abc', userId: '42', codeChallenge: 'challenge-xyz', redirectUri: 'https://chatgpt.com/callback' });
    const provider = createAuthorizationServerProvider();
    const result = await provider.exchangeAuthorizationCode({ client_id: 'abc' } as any, 'code-1');

    expect(mockConsumeAuthCode).toHaveBeenCalledWith('code-1');
    expect(mockSaveMcpTokenPair).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ clientId: 'abc', userId: '42' })
    );
    expect(result).toEqual(
      expect.objectContaining({ access_token: expect.any(String), token_type: 'Bearer', expires_in: 86400, refresh_token: expect.any(String) })
    );
  });

  it('exchangeRefreshToken consumes the refresh token and mints a fresh pair', async () => {
    mockConsumeMcpRefreshToken.mockResolvedValue({ clientId: 'abc', userId: '42', scopes: ['repo'] });
    const provider = createAuthorizationServerProvider();
    const result = await provider.exchangeRefreshToken({ client_id: 'abc' } as any, 'refresh-1');

    expect(mockConsumeMcpRefreshToken).toHaveBeenCalledWith('refresh-1');
    expect(mockSaveMcpTokenPair).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ access_token: expect.any(String), token_type: 'Bearer', expires_in: 86400 })
    );
  });

  it('exchangeRefreshToken throws when the refresh token is not found', async () => {
    mockConsumeMcpRefreshToken.mockResolvedValue(undefined);
    const provider = createAuthorizationServerProvider();
    await expect(provider.exchangeRefreshToken({ client_id: 'abc' } as any, 'bad-refresh')).rejects.toThrow();
  });

  it('verifyAccessToken returns AuthInfo with the githubUserId stashed in extra', async () => {
    mockGetMcpAccessToken.mockResolvedValue({ clientId: 'abc', userId: '42', scopes: ['repo'] });
    const provider = createAuthorizationServerProvider();
    const result = await provider.verifyAccessToken('mcp-token-1');

    expect(result).toEqual({
      token: 'mcp-token-1',
      clientId: 'abc',
      scopes: ['repo'],
      extra: { githubUserId: '42' },
    });
  });

  it('verifyAccessToken throws when the token is not found or expired', async () => {
    mockGetMcpAccessToken.mockResolvedValue(undefined);
    const provider = createAuthorizationServerProvider();
    await expect(provider.verifyAccessToken('missing-token')).rejects.toThrow();
  });
});

describe('handleGithubCallback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exchanges the GitHub code, persists the token, mints an MCP auth code, and redirects to ChatGPT', async () => {
    mockConsumePendingAuthorization.mockResolvedValue({
      clientId: 'chatgpt-client',
      codeChallenge: 'challenge-xyz',
      redirectUri: 'https://chatgpt.com/callback',
      chatgptState: 'chatgpt-state-1',
    });
    mockExchangeCodeForGithubToken.mockResolvedValue({ accessToken: 'ghu_abc', tokenType: 'bearer', scope: 'repo' });
    mockGetGithubUser.mockResolvedValue({ id: 42, login: 'octocat' });

    const req = { query: { code: 'github-code-1', state: 'internal-state-1' } } as any;
    const res = { redirect: vi.fn() } as any;

    await handleGithubCallback(req, res);

    expect(mockConsumePendingAuthorization).toHaveBeenCalledWith('internal-state-1');
    expect(mockExchangeCodeForGithubToken).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'github-code-1' })
    );
    expect(mockSaveGithubToken).toHaveBeenCalledWith('42', { accessToken: 'ghu_abc' });
    expect(mockSaveAuthCode).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ clientId: 'chatgpt-client', userId: '42', codeChallenge: 'challenge-xyz' })
    );
    expect(res.redirect).toHaveBeenCalledWith(
      expect.stringContaining('https://chatgpt.com/callback?code=')
    );
    expect(res.redirect).toHaveBeenCalledWith(
      expect.stringContaining('state=chatgpt-state-1')
    );
  });

  it('returns an error response when the pending authorization is missing/expired', async () => {
    mockConsumePendingAuthorization.mockResolvedValue(undefined);
    const req = { query: { code: 'github-code-1', state: 'unknown-state' } } as any;
    const res = { status: vi.fn().mockReturnThis(), send: vi.fn() } as any;

    await handleGithubCallback(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/oauth/authorization-server.test.ts`
Expected: FAIL — `src/oauth/authorization-server.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/oauth/authorization-server.ts`:

```typescript
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import * as store from './store.js';
import { buildGithubAuthorizeUrl, exchangeCodeForGithubToken, getGithubUser } from './github-client.js';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const MCP_ISSUER_URL = process.env.MCP_ISSUER_URL!;

function randomToken(): string {
  return randomBytes(32).toString('hex');
}

export function createAuthorizationServerProvider() {
  return {
    clientsStore: {
      async getClient(clientId: string) {
        return store.getMcpClient(clientId);
      },
      async registerClient(client: any) {
        const fullClient = {
          ...client,
          client_id: randomToken(),
          client_id_issued_at: Math.floor(Date.now() / 1000),
        };
        await store.saveMcpClient(fullClient);
        return fullClient;
      },
    },

    async authorize(client: any, params: any, res: Response): Promise<void> {
      const internalState = randomToken();
      await store.savePendingAuthorization(internalState, {
        clientId: client.client_id,
        codeChallenge: params.codeChallenge,
        redirectUri: params.redirectUri,
        resource: params.resource?.toString(),
        chatgptState: params.state,
      });

      const githubUrl = buildGithubAuthorizeUrl({
        clientId: GITHUB_CLIENT_ID,
        redirectUri: `${MCP_ISSUER_URL}/callback`,
        state: internalState,
        scope: 'repo',
      });

      res.redirect(githubUrl);
    },

    async challengeForAuthorizationCode(client: any, authorizationCode: string): Promise<string> {
      const data = await store.getAuthCode(authorizationCode);
      if (!data) {
        throw new Error('Authorization code not found or expired');
      }
      return data.codeChallenge;
    },

    async exchangeAuthorizationCode(
      client: any,
      authorizationCode: string,
      _codeVerifier?: string,
      _redirectUri?: string,
      _resource?: URL
    ) {
      const data = await store.consumeAuthCode(authorizationCode);
      if (!data) {
        throw new Error('Authorization code not found or expired');
      }

      const accessToken = randomToken();
      const refreshToken = randomToken();
      await store.saveMcpTokenPair(accessToken, refreshToken, {
        clientId: data.clientId,
        userId: data.userId,
        scopes: ['repo'],
      });

      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 86400,
        refresh_token: refreshToken,
        scope: 'repo',
      };
    },

    async exchangeRefreshToken(client: any, refreshToken: string, _scopes?: string[], _resource?: URL) {
      const data = await store.consumeMcpRefreshToken(refreshToken);
      if (!data) {
        throw new Error('Refresh token not found or expired');
      }

      const accessToken = randomToken();
      const newRefreshToken = randomToken();
      await store.saveMcpTokenPair(accessToken, newRefreshToken, data);

      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 86400,
        refresh_token: newRefreshToken,
        scope: data.scopes.join(' '),
      };
    },

    async verifyAccessToken(token: string) {
      const data = await store.getMcpAccessToken(token);
      if (!data) {
        throw new Error('Access token not found or expired');
      }
      return {
        token,
        clientId: data.clientId,
        scopes: data.scopes,
        extra: { githubUserId: data.userId },
      };
    },
  };
}

export async function handleGithubCallback(req: Request, res: Response): Promise<void> {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;

  if (!code || !state) {
    res.status(400).send('Missing code or state');
    return;
  }

  const pending = await store.consumePendingAuthorization(state);
  if (!pending) {
    res.status(400).send('Unknown or expired authorization request');
    return;
  }

  const githubToken = await exchangeCodeForGithubToken({
    clientId: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    code,
    redirectUri: `${MCP_ISSUER_URL}/callback`,
  });

  const githubUser = await getGithubUser(githubToken.accessToken);
  const userId = String(githubUser.id);

  await store.saveGithubToken(userId, { accessToken: githubToken.accessToken });

  const mcpAuthCode = randomBytes(32).toString('hex');
  await store.saveAuthCode(mcpAuthCode, {
    clientId: pending.clientId,
    userId,
    codeChallenge: pending.codeChallenge,
    redirectUri: pending.redirectUri,
    resource: pending.resource,
  });

  const redirectUrl = new URL(pending.redirectUri);
  redirectUrl.searchParams.set('code', mcpAuthCode);
  if (pending.chatgptState) {
    redirectUrl.searchParams.set('state', pending.chatgptState);
  }

  res.redirect(redirectUrl.toString());
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/oauth/authorization-server.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: no TypeScript errors. If `Response`/`Request` types from `express` aren't yet resolvable (Express isn't installed until Task 6), install it now: `npm install express && npm install --save-dev @types/express` (verify if `@types/express` is actually needed — Express 5 ships its own types per the plan's verified research; if `tsc` finds types without it, skip the devDependency).

- [ ] **Step 6: Commit**

```bash
git add src/oauth/authorization-server.ts test/oauth/authorization-server.test.ts package.json package-lock.json
git commit -m "feat: implement OAuthServerProvider and GitHub callback handler"
```

---

### Task 5: `src/github/client.ts` and `src/github/{repos,issues,pulls}.ts` — per-user Octokit

**Files:**
- Modify: `src/github/client.ts`
- Modify: `src/github/repos.ts`, `src/github/issues.ts`, `src/github/pulls.ts`
- Modify: `test/github/repos.test.ts`, `test/github/issues.test.ts`, `test/github/pulls.test.ts`
- Create: `test/helpers/fakeOctokit.ts`

**Interfaces:**
- Produces: `getOctokit(token: string): Octokit`; all 11 `github/*.ts` functions now take `(octokit: Octokit, params: {...})` — used by `src/tools/register.ts` (Task 7).

- [ ] **Step 1: Modify `src/github/client.ts`**

```typescript
import { Octokit } from 'octokit';

export function getOctokit(token: string): Octokit {
  return new Octokit({ auth: token });
}
```

- [ ] **Step 2: Modify `src/github/repos.ts`**

Change the signature of all 3 exported functions to take `octokit: Octokit` as the new first parameter, removing the internal `getOctokit()` call. The existing internal `fetchExistingSha(octokit, ...)` helper already takes `octokit` as a parameter — no change needed there, just stop calling `getOctokit()` to produce it and instead receive it from the caller. Example for `listRepoTree` (apply the same pattern to `getFileContent` and `createOrUpdateFile`):

```typescript
export async function listRepoTree(
  octokit: Octokit,
  params: {
    owner: string;
    repo: string;
    ref?: string;
    path?: string;
  }
): Promise<{ entries: TreeEntry[]; truncated: boolean }> {
  const { data } = await octokit.rest.git.getTree({
    owner: params.owner,
    repo: params.repo,
    tree_sha: params.ref ?? 'HEAD',
    recursive: '1',
  });
  // ... rest of the function body is UNCHANGED
```

Remove the `import { getOctokit } from './client.js';` line and replace with `import type { Octokit } from 'octokit';` (type-only import, since `client.ts` is no longer called from within this file).

- [ ] **Step 3: Modify `src/github/issues.ts`**

Same pattern: add `octokit: Octokit` as the leading parameter to `createIssue`, `listIssues`, `getIssue`, `createIssueComment`; remove the internal `getOctokit()` call and the `getOctokit` import; add `import type { Octokit } from 'octokit';`.

- [ ] **Step 4: Modify `src/github/pulls.ts`**

Same pattern: add `octokit: Octokit` as the leading parameter to `createPullRequest`, `listPullRequests`, `getPullRequest`, `mergePullRequest`; remove the internal `getOctokit()` call and the `getOctokit` import; add `import type { Octokit } from 'octokit';`.

- [ ] **Step 5: Create the shared fake-Octokit test helper**

Create `test/helpers/fakeOctokit.ts`:

```typescript
export function createFakeOctokit(mocks: {
  getTree?: any;
  getRef?: any;
  createRef?: any;
  getContent?: any;
  createOrUpdateFileContents?: any;
  create?: any;
  listForRepo?: any;
  get?: any;
  createComment?: any;
  list?: any;
  merge?: any;
}) {
  return {
    rest: {
      git: {
        getTree: mocks.getTree,
        getRef: mocks.getRef,
        createRef: mocks.createRef,
      },
      repos: {
        getContent: mocks.getContent,
        createOrUpdateFileContents: mocks.createOrUpdateFileContents,
      },
      issues: {
        create: mocks.create,
        listForRepo: mocks.listForRepo,
        get: mocks.get,
        createComment: mocks.createComment,
      },
      pulls: {
        create: mocks.create,
        list: mocks.list,
        get: mocks.get,
        merge: mocks.merge,
      },
    },
  } as any;
}
```

- [ ] **Step 6: Update `test/github/repos.test.ts`**

Remove the `vi.mock('../../src/github/client.js', ...)` block entirely. Keep the existing `mockGetTree`, `mockGetContent`, etc. `vi.fn()` declarations unchanged. Build a fake Octokit once per describe block (or inline), e.g.:

```typescript
import { createFakeOctokit } from '../helpers/fakeOctokit.js';
// ... existing mockGetTree, mockGetContent, mockCreateOrUpdateFileContents, mockGetRef, mockCreateRef declarations, unchanged

const fakeOctokit = createFakeOctokit({
  getTree: mockGetTree,
  getContent: mockGetContent,
  createOrUpdateFileContents: mockCreateOrUpdateFileContents,
  getRef: mockGetRef,
  createRef: mockCreateRef,
});
```

Update every call site, e.g. `await listRepoTree({ owner: 'octo', repo: 'hello', ref: 'main' })` becomes `await listRepoTree(fakeOctokit, { owner: 'octo', repo: 'hello', ref: 'main' })` — apply this mechanical change to all 9 test cases in this file. Assertions on `mockGetTree`/etc.'s call arguments are unaffected.

- [ ] **Step 7: Update `test/github/issues.test.ts`**

Same pattern: remove the `vi.mock('../../src/github/client.js', ...)` block, build `const fakeOctokit = createFakeOctokit({ create: mockCreate, listForRepo: mockListForRepo, get: mockGet, createComment: mockCreateComment });`, update all 5 test cases to pass `fakeOctokit` as the new leading argument.

- [ ] **Step 8: Update `test/github/pulls.test.ts`**

Same pattern: remove the `vi.mock('../../src/github/client.js', ...)` block, build `const fakeOctokit = createFakeOctokit({ create: mockCreate, list: mockList, get: mockGet, merge: mockMerge });`, update all 5 test cases to pass `fakeOctokit` as the new leading argument.

- [ ] **Step 9: Run the full test suite**

Run: `npx vitest run test/github/`
Expected: PASS (repos: 9, issues: 5, pulls: 5 — 19 tests total, matching the pre-existing counts).

- [ ] **Step 10: Typecheck**

Run: `npm run build`
Expected: zero errors.

- [ ] **Step 11: Commit**

```bash
git add src/github/client.ts src/github/repos.ts src/github/issues.ts src/github/pulls.ts test/github/repos.test.ts test/github/issues.test.ts test/github/pulls.test.ts test/helpers/fakeOctokit.ts
git commit -m "refactor: accept per-user Octokit instance instead of a shared singleton"
```

---

### Task 6: `api/server.ts` — Express app assembly

**Files:**
- Modify: `api/server.ts`
- Modify: `package.json` (add `express`)

**Interfaces:**
- Consumes: `createAuthorizationServerProvider`, `handleGithubCallback` from `src/oauth/authorization-server.ts` (Task 4); `registerAllTools` from `src/tools/register.ts` (Task 7 — note this task and Task 7 have a circular-looking dependency; write this task's `api/server.ts` first assuming Task 7's updated `registerAllTools` signature, then Task 7 implements it to match).
- Produces: the default-exported Express app, the connector's actual HTTP entry point.

This task has no new automated test — it's the integration point wiring together already-tested pieces (`mcpAuthRouter` from the SDK, `authorization-server.ts`, `registerAllTools`), and its correctness is exercised in Task 8's manual end-to-end verification, consistent with the same reasoning used for `api/server.ts` in the v1 plan.

- [ ] **Step 1: Install Express**

Run: `npm install express`

- [ ] **Step 2: Delete the legacy auth module and its test**

Run: `rm src/auth.ts test/auth.test.ts`

No backward compatibility is kept — the connector is becoming a general-purpose public multi-user tool, so `/mcp` is OAuth-only.

- [ ] **Step 3: Write the implementation**

Replace `api/server.ts` with:

```typescript
import express from 'express';
import type { Request, Response } from 'express';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createAuthorizationServerProvider, handleGithubCallback } from '../src/oauth/authorization-server.js';
import { registerAllTools } from '../src/tools/register.js';

const MCP_ISSUER_URL = process.env.MCP_ISSUER_URL!;

const provider = createAuthorizationServerProvider();

const app = express();

app.use(
  mcpAuthRouter({
    provider,
    issuerUrl: new URL(MCP_ISSUER_URL),
    scopesSupported: ['repo'],
    resourceServerUrl: new URL(`${MCP_ISSUER_URL}/mcp`),
  })
);

app.get('/callback', (req: Request, res: Response) => {
  handleGithubCallback(req, res).catch((err) => {
    console.error('GitHub callback error:', err);
    res.status(500).send('Internal error during GitHub OAuth callback');
  });
});

app.post(
  '/mcp',
  express.json(),
  requireBearerAuth({ verifier: provider }),
  async (req: Request, res: Response) => {
    const server = new McpServer({ name: 'github-connector', version: '1.0.0' });
    registerAllTools(server);

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req as any, res, req.body);
  }
);

export default app;
```

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: no TypeScript errors. If `requireBearerAuth`'s `verifier` parameter type complains that `provider` (the full `OAuthServerProvider`) isn't assignable to `OAuthTokenVerifier`, this indicates a structural mismatch — investigate and fix (should not happen, since `OAuthServerProvider` is a structural superset of `OAuthTokenVerifier`, but verify empirically since this is a new integration point).

- [ ] **Step 5: Commit**

```bash
git add api/server.ts package.json package-lock.json
git rm src/auth.ts test/auth.test.ts
git commit -m "feat: assemble Express app with OAuth router; remove legacy shared-secret auth"
```

---

### Task 7: `src/tools/register.ts` — resolve per-user Octokit from request context

**Files:**
- Modify: `src/tools/register.ts`

**Interfaces:**
- Consumes: `getGithubToken` from `src/oauth/store.ts` (Task 2); `getOctokit` from `src/github/client.ts` (Task 5); all 11 `github/*.ts` functions (Task 5).
- Produces: updated `registerAllTools(server: McpServer): void`, consumed by `api/server.ts` (Task 6).

No new test file for this task — matches the reasoning already established in the v1 plan for this exact file (pure wiring, exercised end-to-end manually).

- [ ] **Step 1: Add the resolver helper and update all 11 handlers**

Modify `src/tools/register.ts`: add an import of `getGithubToken` from `../oauth/store.js` and `getOctokit` from `../github/client.js`, add this helper near the top of the file:

```typescript
async function octokitFromExtra(extra: { authInfo?: { extra?: Record<string, unknown> } }) {
  const githubUserId = extra.authInfo?.extra?.githubUserId;
  if (typeof githubUserId !== 'string') {
    throw new Error('Not authenticated: missing GitHub user context');
  }
  const tokenData = await getGithubToken(githubUserId);
  if (!tokenData) {
    throw new Error('GitHub account not connected — please reconnect via the OAuth flow');
  }
  return getOctokit(tokenData.accessToken);
}
```

Then update every one of the 11 `server.registerTool(...)` handlers to accept the second `extra` argument, resolve the Octokit, and pass it as the new leading argument to the corresponding `github/*.ts` function. Example for `list_repo_tree` (apply the identical pattern to all 11):

```typescript
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
  async ({ owner, repo, ref, path }, extra) => {
    const octokit = await octokitFromExtra(extra);
    return textResult(await listRepoTree(octokit, { owner, repo, ref, path }));
  }
);
```

Apply the same three-line change (resolve `octokit`, pass as leading arg, wrap in a block body if the handler was previously a one-line arrow expression) to the remaining 10 tools: `get_file_content`, `create_or_update_file`, `create_issue`, `list_issues`, `get_issue`, `create_issue_comment`, `create_pull_request`, `list_pull_requests`, `get_pull_request`, `merge_pull_request`.

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: no errors. This will surface any signature mismatches from Task 5's changes not being fully threaded through — fix any that appear.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all existing tests (auth: 7, github/repos: 9, github/issues: 5, github/pulls: 5, oauth/store, oauth/github-client, oauth/authorization-server) pass. `register.ts` itself has no dedicated test file (consistent with the file's existing untested status), so this step is a regression check on everything else, not new coverage.

- [ ] **Step 4: Commit**

```bash
git add src/tools/register.ts
git commit -m "feat: resolve per-user Octokit from authenticated request context in all 11 tools"
```

---

### Task 8: `vercel.json` and `.env.example` updates

**Files:**
- Modify: `vercel.json`
- Modify: `.env.example`

- [ ] **Step 1: Update `vercel.json`**

Replace the `rewrites` array to route every new OAuth path to the same Express app, alongside the existing `/mcp` rewrite:

```json
{
  "outputDirectory": ".",
  "functions": {
    "api/server.ts": {
      "maxDuration": 60
    }
  },
  "rewrites": [
    { "source": "/mcp", "destination": "/api/server" },
    { "source": "/authorize", "destination": "/api/server" },
    { "source": "/token", "destination": "/api/server" },
    { "source": "/register", "destination": "/api/server" },
    { "source": "/revoke", "destination": "/api/server" },
    { "source": "/callback", "destination": "/api/server" },
    { "source": "/.well-known/oauth-authorization-server", "destination": "/api/server" },
    { "source": "/.well-known/oauth-protected-resource", "destination": "/api/server" }
  ]
}
```

- [ ] **Step 2: Update `.env.example`**

Replace the file contents with:

```
# GitHub OAuth App credentials (github.com → Settings → Developer settings → OAuth Apps)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# This server's own public base URL (must match the OAuth App's callback URL host + /callback)
MCP_ISSUER_URL=

# Upstash Redis (added via Vercel Marketplace integration — check actual injected names)
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

- [ ] **Step 3: Commit**

```bash
git add vercel.json .env.example
git commit -m "chore: route OAuth endpoints and document new env vars"
```

---

### Task 9: GitHub OAuth App registration (manual, user-performed)

**Files:** None — this is a manual step on github.com, not a code task.

- [ ] **Step 1: Register the OAuth App**

Go to github.com → Settings → Developer settings → OAuth Apps → New OAuth App. Application name: `github-connector`. Homepage URL: the deployment's custom domain (`https://github-connector.jason1105.uk`). **Authorization callback URL**: `https://github-connector.jason1105.uk/callback`.

- [ ] **Step 2: Generate credentials**

Note the **Client ID**; generate and note a **Client secret**.

- [ ] **Step 3: Set Vercel environment variables**

In the Vercel dashboard, set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `MCP_ISSUER_URL=https://github-connector.jason1105.uk` (matching the custom domain already in use).

---

### Task 10: End-to-end manual verification

**Files:** None created.

- [ ] **Step 1: Deploy and confirm the metadata endpoints**

After merging/deploying, run:
```bash
curl -s https://github-connector.jason1105.uk/.well-known/oauth-authorization-server | head -30
curl -s https://github-connector.jason1105.uk/.well-known/oauth-protected-resource | head -30
```
Expected: valid JSON metadata responses, not 404s.

- [ ] **Step 2: Manually exercise the full redirect flow in a browser**

Navigate to a constructed `/authorize` URL with a manually-generated PKCE challenge and a placeholder `client_id`/`redirect_uri` (or use a lightweight OAuth test client/script) to confirm: redirect to GitHub → login → redirect to `/callback` → redirect back to the test redirect URI with a `code` param.

- [ ] **Step 3: Exchange the resulting code for tokens via curl**

```bash
curl -s -X POST https://github-connector.jason1105.uk/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=<code_from_step_2>&client_id=<test_client_id>&code_verifier=<verifier>&redirect_uri=<redirect_uri>"
```
Expected: JSON response with `access_token`, `refresh_token`, `expires_in: 86400`.

- [ ] **Step 4: Call a real tool with the resulting bearer token**

```bash
curl -s -X POST https://github-connector.jason1105.uk/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token_from_step_3>" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_repo_tree","arguments":{"owner":"<your-username>","repo":"<a-real-repo>"}}}'
```
Expected: a real file listing from the authenticated user's own GitHub account.

- [ ] **Step 5: Reconfigure the ChatGPT connector**

Only after Steps 1-4 pass: in ChatGPT's connector settings, change the Authentication mode from "No Auth" to "OAuth" for this connector, and complete a real end-to-end authorization through ChatGPT's own UI. Exercise several of the 11 tools through a real conversation, confirming they operate against the correct GitHub account.

- [ ] **Step 6: Confirm the old shared-secret path is actually gone**

```bash
curl -s -X POST https://github-connector.jason1105.uk/mcp \
  -H "Content-Type: application/json" \
  -H "X-Connector-Secret: anything" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```
Expected: HTTP 401 (rejected by `requireBearerAuth`, since no `Authorization: Bearer` header was sent) — confirming the shared-secret header no longer grants access and `/mcp` is now OAuth-only.
