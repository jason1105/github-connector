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
