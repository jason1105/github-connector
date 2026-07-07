import { describe, it, expect, vi, beforeEach } from 'vitest';

// The store lazily constructs a Redis client from env vars on first use.
// Since @upstash/redis is mocked below, these values are never used to make
// a real network connection — they only need to be present so the module's
// env-var guard doesn't throw before the mocked client is exercised.
process.env.KV_REST_API_URL ??= 'https://example-test.upstash.io';
process.env.KV_REST_API_TOKEN ??= 'test-token';

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
