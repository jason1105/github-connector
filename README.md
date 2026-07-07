# github-connector

A ChatGPT App (MCP connector) for operating on GitHub repositories: list files, read files, create/update files, manage issues, and manage pull requests.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in:
   - `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` (from a GitHub OAuth App: github.com → Settings → Developer settings → OAuth Apps).
   - `MCP_ISSUER_URL` — this server's own public base URL (must match the OAuth App's callback URL host + `/callback`).
   - `KV_REST_API_URL` and `KV_REST_API_TOKEN` — Upstash Redis credentials (added via the Vercel Marketplace integration; check the actual injected variable names).
3. `npm run build` to typecheck.
4. `npm test` to run unit tests.
5. Deploy to Vercel; set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `MCP_ISSUER_URL`, `KV_REST_API_URL`, and `KV_REST_API_TOKEN` as Vercel project environment variables.
6. Configure the ChatGPT connector to call `https://<your-deployment>.vercel.app/mcp` with Authentication mode set to **OAuth**. ChatGPT auto-discovers the OAuth endpoints via the server's `.well-known` metadata, so no manual header configuration is needed.

## Live deployment

- Production: https://github-connector.jason1105.uk/mcp
