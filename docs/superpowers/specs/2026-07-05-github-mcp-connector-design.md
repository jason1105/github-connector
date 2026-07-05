# GitHub MCP Connector — Design

## Goal

Build a ChatGPT App (connector) that lets ChatGPT operate on GitHub repositories through the Model Context Protocol (MCP): listing repo files, creating issues, commenting on issues/PRs, creating/editing files, opening PRs, and merging PRs.

## Architecture

- **Runtime:** TypeScript on Node.js.
- **Transport:** MCP Streamable HTTP (per MCP spec 2025-03-26), served from a single Vercel serverless function at `/mcp`, following the `vercel-labs/mcp-on-vercel` pattern.
- **GitHub client:** `octokit` (the batteries-included package), instantiated once from a `GITHUB_TOKEN` environment variable (a single personal access token — the connector acts as one fixed GitHub identity, not per-user OAuth).
- **Connector auth:** Since a single PAT with repo write access is used, the server requires a shared-secret header (e.g. `X-Connector-Secret`) on every incoming request. Requests missing or failing this check are rejected with HTTP 401 before any MCP/tool logic runs. The secret is generated once and stored in Vercel env vars; the ChatGPT connector configuration is set to send it on every call.
- **Repo scope:** Not fixed to one repo — every tool takes `owner`/`repo` as parameters, so the connector can act on any repository the PAT has access to.

## Components

```
github-connector/
  api/
    server.ts          # Vercel entry point: auth middleware + MCP StreamableHTTP handler
  src/
    github/
      client.ts         # Octokit instance built from GITHUB_TOKEN
      repos.ts           # list_repo_tree, get_file_content, create_or_update_file
      issues.ts           # create_issue, list_issues, get_issue, create_issue_comment
      pulls.ts            # create_pull_request, list_pull_requests, get_pull_request, merge_pull_request
    tools/
      index.ts           # registers all MCP tools, wires each to the matching github/* function
    auth.ts              # shared-secret header check middleware
  package.json
  tsconfig.json
  vercel.json
  .env.example
  README.md
```

Each `github/*.ts` module is a thin, independently testable wrapper: it takes plain parameters, calls Octokit, and returns/throws plain data — no MCP-specific types leak into this layer. `tools/index.ts` is the only place that knows about MCP tool schemas, so the mapping between "MCP tool" and "GitHub call" stays in one place and is easy to audit.

## Tools (11 total)

| # | Tool | Params | Notes |
|---|------|--------|-------|
| 1 | `list_repo_tree` | owner, repo, ref?, path? | Recursive tree via Git Trees API (`recursive=1`) |
| 2 | `get_file_content` | owner, repo, path, ref? | Reads and decodes a single file's content |
| 3 | `create_or_update_file` | owner, repo, path, content, message, branch, createBranch?, baseBranch? | If `createBranch` is true, branches from `baseBranch` (default: repo default branch) before committing. The tool itself looks up whether `path` already exists on `branch` (via a `GET contents` call) to obtain the current `sha`; if found, it's included in the update call as GitHub's Contents API requires it to overwrite an existing file. Caller never has to supply `sha` manually. |
| 4 | `create_issue` | owner, repo, title, body?, labels? | |
| 5 | `list_issues` | owner, repo, state? (open/closed/all) | |
| 6 | `get_issue` | owner, repo, issue_number | |
| 7 | `create_issue_comment` | owner, repo, issue_number, body | Shared endpoint — works for both issues and PRs since GitHub treats PRs as issues for comments |
| 8 | `create_pull_request` | owner, repo, title, head, base, body? | |
| 9 | `list_pull_requests` | owner, repo, state? (open/closed/all) | |
| 10 | `get_pull_request` | owner, repo, pull_number | |
| 11 | `merge_pull_request` | owner, repo, pull_number, merge_method? (merge/squash/rebase) | |

## Error handling

- GitHub API errors (404 not found, 403 forbidden, 422 unprocessable, rate limit, etc.) are caught in the `github/*` layer and re-thrown as MCP tool errors carrying GitHub's own error message, so ChatGPT sees actionable detail (e.g. "Reference already exists", "Not Found") instead of a generic failure.
- Missing/invalid required parameters are rejected before any GitHub call, with a clear validation message.
- Shared-secret auth failures short-circuit at the transport layer (`auth.ts`) with HTTP 401, never reaching tool logic.

## Testing approach

- Unit tests around parameter validation and response shaping in `github/*.ts`, with Octokit mocked (no real network calls in CI).
- No TDD ceremony for the thin pass-through calls to Octokit methods themselves — the value is in validation and error-shaping logic, not re-testing Octokit.
- One manual end-to-end verification pass against a real (disposable/test) GitHub repo before considering the connector done: exercise each of the 11 tools once via the deployed Vercel endpoint using the shared secret, confirming actual GitHub state changes (file created, issue created, PR opened/merged, etc.).

## Out of scope (v1)

- Per-user OAuth / multi-user identity (single fixed PAT only).
- Code-line-level PR review comments (only general issue/PR comments).
- Any repo other than what's reachable by the configured PAT.
- Deleting files, deleting branches, or other destructive operations not explicitly requested.
