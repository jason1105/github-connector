import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';

// The authorization-server module reads GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET /
// MCP_ISSUER_URL from env at module-load time (top-level `const` with the `!`
// non-null assertion). The store (github-client / redis) calls that consume them
// are mocked below, so these values are never used to make a real request — they
// only need to be present so the module doesn't capture `undefined` and leak it
// into request URLs / assertions. This mirrors the established defensive pattern
// in test/oauth/store.test.ts (seed dummy env vars with `??=` before import).
process.env.GITHUB_CLIENT_ID ??= 'test-gh-client-id';
process.env.GITHUB_CLIENT_SECRET ??= 'test-gh-client-secret';
process.env.MCP_ISSUER_URL ??= 'https://mcp.example.com';

// NOTE (deviation from brief, mechanical only): the mock fns are declared via
// `vi.hoisted()` instead of plain top-level `const … = vi.fn()`. In this
// project's vitest (v2.1.9) config, when a test statically imports a source
// module that itself imports a vi.mock'd module, vitest's hoisting of the
// `vi.mock` factory runs BEFORE the plain `const mock*` declarations are
// initialized, throwing "Cannot access 'mockGetMcpClient' before
// initialization". `vi.hoisted()` is vitest's documented fix: it hoists these
// declarations alongside the mock factories so they exist when the factory
// runs. This changes ONLY how the mock fns are declared — every vi.mock
// factory, mock name, and assertion below is byte-for-byte the brief's.
const {
  mockGetMcpClient,
  mockSaveMcpClient,
  mockSavePendingAuthorization,
  mockConsumePendingAuthorization,
  mockSaveAuthCode,
  mockGetAuthCode,
  mockConsumeAuthCode,
  mockSaveMcpTokenPair,
  mockGetMcpAccessToken,
  mockConsumeMcpRefreshToken,
  mockGetGithubToken,
  mockSaveGithubToken,
  mockBuildGithubAuthorizeUrl,
  mockExchangeCodeForGithubToken,
  mockGetGithubUser,
} = vi.hoisted(() => ({
  mockGetMcpClient: vi.fn(),
  mockSaveMcpClient: vi.fn(),
  mockSavePendingAuthorization: vi.fn(),
  mockConsumePendingAuthorization: vi.fn(),
  mockSaveAuthCode: vi.fn(),
  mockGetAuthCode: vi.fn(),
  mockConsumeAuthCode: vi.fn(),
  mockSaveMcpTokenPair: vi.fn(),
  mockGetMcpAccessToken: vi.fn(),
  mockConsumeMcpRefreshToken: vi.fn(),
  mockGetGithubToken: vi.fn(),
  mockSaveGithubToken: vi.fn(),
  mockBuildGithubAuthorizeUrl: vi.fn(),
  mockExchangeCodeForGithubToken: vi.fn(),
  mockGetGithubUser: vi.fn(),
}));

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
