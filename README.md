# github-connector

A ChatGPT App (MCP connector) for operating on GitHub repositories: list files, read files, create/update files, manage issues, and manage pull requests.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `GITHUB_TOKEN` (a GitHub PAT with repo scope) and `CONNECTOR_SECRET` (any random string you generate).
3. `npm run build` to typecheck.
4. `npm test` to run unit tests.
5. Deploy to Vercel; set `GITHUB_TOKEN` and `CONNECTOR_SECRET` as Vercel project environment variables.
6. Configure the ChatGPT connector to call `https://<your-deployment>.vercel.app/mcp` with header `X-Connector-Secret: <CONNECTOR_SECRET>`.

## Live deployment

- Production: https://github-connector.jason1105.uk/mcp
