# Multi-user GitHub OAuth — Design

## Goal

Replace the connector's single shared GitHub PAT with real per-user GitHub OAuth: each ChatGPT user authenticates with their own GitHub account, and the connector proxies GitHub API calls under that user's own identity rather than one shared identity for everyone.

## Motivation

v1 shipped with a single `GITHUB_TOKEN` (PAT) shared by every caller, gated by a `CONNECTOR_SECRET` header. In testing, ChatGPT's custom-connector UI turned out to only support two authentication modes — "OAuth" or "No Auth" — with no way to send a custom header. This left the connector running with `ALLOW_NO_AUTH=true`, meaning anyone who discovers the deployment URL can operate on the connector's GitHub identity with no gate at all. Real OAuth both closes that hole and gives each user their own GitHub identity instead of a single shared one.

## Architecture

The MCP server takes on two OAuth roles simultaneously:

1. **OAuth Authorization Server to ChatGPT** — implements the MCP spec's OAuth 2.1 + PKCE flow (`/authorize`, `/token`, `/register`, `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`), using `@modelcontextprotocol/sdk`'s built-in `mcpAuthRouter` and `OAuthServerProvider` interface.
2. **OAuth Client to GitHub** — registers as a classic GitHub OAuth App, and internally exchanges GitHub's authorization code for a GitHub access token on the user's behalf.

These two roles are bridged by a custom `OAuthServerProvider` implementation (`src/oauth/authorization-server.ts`) that mints its own opaque `mcp_access_token`/`mcp_refresh_token` pair — distinct from GitHub's own token — and persists a `mcp_access_token → GitHub user's token` mapping in Redis. ChatGPT never sees GitHub's raw token; the server looks it up internally on every tool call via `verifyAccessToken`.

**Why not the SDK's built-in `ProxyOAuthServerProvider`:** inspected directly in the installed package, it's a thin pass-through that hands GitHub's own access token straight to ChatGPT as the "MCP token," with no persistent mapping. That would work mechanically, but loses the separation this design wants (GitHub's raw token is never ChatGPT-visible) and doesn't fit a persistent, revocable token store.

### Key decisions

- **Classic GitHub OAuth App, not a GitHub App.** Classic OAuth App tokens never expire on their own (only via manual/security revocation) — confirmed via GitHub's docs. This means there's no refresh-token dance needed on the GitHub side at all. (A GitHub App would support real 8-hour-token/6-month-refresh-token semantics, but requires a heavier "install app" consent step distinct from a standard OAuth authorize screen — rejected in favor of the simpler, more familiar consent flow.)
- **Token storage: Upstash Redis**, added via Vercel's Marketplace integration (`@upstash/redis`, REST/HTTP-based client — required for serverless compatibility, no persistent TCP connections). Even though GitHub tokens don't expire under this design, persistent storage is still required to map `mcp_access_token → GitHub token` across stateless serverless invocations.
- **MCP-level access token lifetime: 24 hours.** This is the token ChatGPT holds; when it expires, ChatGPT silently exchanges it via its own `refresh_token` — invisible to the user. This lifetime is independent of GitHub's token, which doesn't expire under the classic-OAuth-App model.
- **Isolation: 1:1.** One ChatGPT connector connection maps to one GitHub identity at a time. Verified safe for multiple ChatGPT accounts authenticating sequentially from the same machine: the `mcp_access_token` itself (not the browser or computer) is the credential each ChatGPT account presents on every request, and the OAuth `state` parameter prevents cross-talk between concurrent in-flight `/authorize` requests.
- **Backward compatibility: none.** The connector is becoming a general-purpose, public-facing multi-user tool, so the single-shared-PAT model no longer fits its intended use — the shared-secret path (`src/auth.ts`, `checkConnectorSecret`), `ALLOW_NO_AUTH`, and the single `GITHUB_TOKEN` are removed entirely, not kept as a fallback. `/mcp` becomes OAuth-only.

## Components

```
github-connector/
  api/
    server.ts                    # REPLACED: Express app (mcpAuthRouter + /callback +
                                  # bearer-auth-protected /mcp)
  src/
    oauth/
      github-client.ts           # NEW: raw-fetch wrapper for GitHub's own OAuth
                                  # endpoints (authorize URL, code-for-token exchange,
                                  # get authenticated user)
      store.ts                   # NEW: Redis-backed persistence (see key schema below)
      authorization-server.ts    # NEW: implements OAuthServerProvider; also exports
                                  # the /callback route handler
    github/
      client.ts                  # MODIFIED: getOctokit(token) — no more singleton
      repos.ts, issues.ts, pulls.ts  # MODIFIED: each of the 11 functions gains a
                                  # required leading `octokit: Octokit` parameter
    tools/
      register.ts                 # MODIFIED: tool handlers resolve the caller's
                                  # Octokit from the authenticated request context
    auth.ts                       # REMOVED (no backward-compat path)
  test/
    oauth/                        # NEW: github-client, store, authorization-server tests
    github/                       # MODIFIED: pass a fake Octokit instead of mocking
                                  # the client module
    helpers/fakeOctokit.ts        # NEW: shared fake-Octokit factory
```

## Data flow (OAuth handshake)

1. ChatGPT discovers the server's OAuth metadata via `.well-known/oauth-protected-resource` and `.well-known/oauth-authorization-server`.
2. ChatGPT redirects the user to the server's `/authorize` endpoint (with PKCE `code_challenge`, its own `state`).
3. The server stores a short-lived pending-state record, then redirects the user's browser to GitHub's own `/login/oauth/authorize`.
4. The user logs into GitHub and approves the `repo` scope.
5. GitHub redirects back to the server's `/callback` with its own authorization code.
6. The server exchanges that code for a GitHub access token (server-to-server, using `GITHUB_CLIENT_SECRET`, never exposed to ChatGPT), looks up the GitHub user's stable numeric ID, persists `githubToken` keyed by that ID, mints its own MCP-level authorization code, and redirects back to ChatGPT's original `redirect_uri`.
7. ChatGPT exchanges that code (with its PKCE `code_verifier`) at the server's `/token` endpoint for an `mcp_access_token`/`mcp_refresh_token` pair (24h/no-expiry).
8. Every subsequent `POST /mcp` tool call carries `Authorization: Bearer <mcp_access_token>`. The server's `verifyAccessToken` looks up the token, resolves the associated GitHub user's token, and makes that available to the tool handler as `extra.authInfo.extra.githubUserId` → `store.getGithubToken(userId)` → `getOctokit(token)`.

## Redis key schema

| Key | Value | TTL |
|---|---|---|
| `mcp:client:{clientId}` | `OAuthClientInformationFull` (ChatGPT's DCR'd registration) | none |
| `oauth:pending:{state}` | `{clientId, codeChallenge, redirectUri, resource?, chatgptState}` | 10 min |
| `mcp:authcode:{code}` | `{clientId, userId, codeChallenge, redirectUri, resource?}` | 10 min |
| `mcp:token:{mcpAccessToken}` | `{clientId, userId, scopes}` | 24 hours |
| `mcp:refresh:{mcpRefreshToken}` | `{clientId, userId, scopes}` | none |
| `github:token:{userId}` | `{accessToken}` | none (matches GitHub's non-expiring token) |

## Error handling

- If `verifyAccessToken` finds no matching (or expired) `mcp:token:{mcpAccessToken}` entry in Redis, the SDK's bearer-auth middleware rejects the request with a 401 before it reaches any tool handler — ChatGPT's own refresh-token exchange (per its 24h token lifetime) handles this transparently in normal operation.
- If GitHub's own token has been revoked externally (user revoked access, security event), the next Octokit call fails with a 401 from GitHub's API. This surfaces as a clear "reconnect your GitHub account" MCP tool error, not a generic failure — the user re-runs the OAuth flow to rebind.
- PKCE validation for the ChatGPT-facing flow is handled by the SDK itself (confirmed via direct inspection of the installed `handlers/token.js`): the SDK calls `challengeForAuthorizationCode` to fetch the stored challenge and does the SHA256+base64url comparison internally. `challengeForAuthorizationCode` must therefore be a non-destructive read; `exchangeAuthorizationCode` performs the actual single-use code consumption.

## Out of scope (this iteration)

- Refresh-token handling on the GitHub side (moot — classic OAuth App tokens don't expire).
- Multiple GitHub accounts bound to a single ChatGPT connector connection (1:1 only; re-authorizing switches the bound account).
- A "disconnect GitHub account" / token revocation UI feature (can be added later via GitHub's `DELETE /applications/{client_id}/grant`).
- Fine-grained per-repository GitHub permissions (classic OAuth Apps only support the coarse `repo` scope, not GitHub App-style fine-grained permissions — accepted tradeoff of choosing classic OAuth Apps).
