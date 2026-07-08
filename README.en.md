# github-connector

**A ChatGPT App (MCP connector) for operating on GitHub repositories**

![version](https://img.shields.io/badge/version-1.0.0-blue) ![platform](https://img.shields.io/badge/platform-Vercel-black) ![built with](https://img.shields.io/badge/built%20with-TypeScript%20%2B%20Express-3178c6) ![auth](https://img.shields.io/badge/auth-OAuth%202.1-green)

[中文](README.md) | [English](README.en.md)

List files, read files, create/update files, manage issues, and manage pull requests — each ChatGPT user authenticates with their own GitHub account.

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
