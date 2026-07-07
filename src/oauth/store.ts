import { Redis } from '@upstash/redis';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';

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

export async function getMcpClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
  const data = await getRedis().get<OAuthClientInformationFull>(`mcp:client:${clientId}`);
  return data ?? undefined;
}

export async function saveMcpClient(client: OAuthClientInformationFull): Promise<void> {
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
