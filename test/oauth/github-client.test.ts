import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildGithubAuthorizeUrl, exchangeCodeForGithubToken, getGithubUser } from '../../src/oauth/github-client.js';

describe('buildGithubAuthorizeUrl', () => {
  it('builds a correctly-formed GitHub authorize URL', () => {
    const url = buildGithubAuthorizeUrl({
      clientId: 'client-123',
      redirectUri: 'https://example.com/callback',
      state: 'state-abc',
      scope: 'repo',
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('client-123');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://example.com/callback');
    expect(parsed.searchParams.get('state')).toBe('state-abc');
    expect(parsed.searchParams.get('scope')).toBe('repo');
  });
});

describe('exchangeCodeForGithubToken', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('POSTs to GitHub token endpoint and returns the parsed token response', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'ghu_abc', token_type: 'bearer', scope: 'repo' }),
    });

    const result = await exchangeCodeForGithubToken({
      clientId: 'client-123',
      clientSecret: 'secret-xyz',
      code: 'auth-code-1',
      redirectUri: 'https://example.com/callback',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://github.com/login/oauth/access_token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Accept: 'application/json' }),
      })
    );
    expect(result).toEqual({ accessToken: 'ghu_abc', tokenType: 'bearer', scope: 'repo' });
  });

  it('throws a descriptive error when GitHub returns an error response', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ error: 'bad_verification_code', error_description: 'The code passed is incorrect or expired.' }),
    });

    await expect(
      exchangeCodeForGithubToken({
        clientId: 'client-123',
        clientSecret: 'secret-xyz',
        code: 'bad-code',
        redirectUri: 'https://example.com/callback',
      })
    ).rejects.toThrow(/bad_verification_code/);
  });
});

describe('getGithubUser', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('GETs the authenticated user and returns id/login', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 42, login: 'octocat' }),
    });

    const result = await getGithubUser('ghu_abc');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/user',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer ghu_abc' }),
      })
    );
    expect(result).toEqual({ id: 42, login: 'octocat' });
  });
});
