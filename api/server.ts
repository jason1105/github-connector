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
