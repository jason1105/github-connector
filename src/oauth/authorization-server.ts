import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import * as store from './store.js';
import { buildGithubAuthorizeUrl, exchangeCodeForGithubToken, getGithubUser } from './github-client.js';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const MCP_ISSUER_URL = process.env.MCP_ISSUER_URL!;

function randomToken(): string {
  return randomBytes(32).toString('hex');
}

export function createAuthorizationServerProvider() {
  return {
    clientsStore: {
      async getClient(clientId: string) {
        return store.getMcpClient(clientId);
      },
      async registerClient(client: any) {
        const fullClient = {
          ...client,
          client_id: randomToken(),
          client_id_issued_at: Math.floor(Date.now() / 1000),
        };
        await store.saveMcpClient(fullClient);
        return fullClient;
      },
    },

    async authorize(client: any, params: any, res: Response): Promise<void> {
      const internalState = randomToken();
      await store.savePendingAuthorization(internalState, {
        clientId: client.client_id,
        codeChallenge: params.codeChallenge,
        redirectUri: params.redirectUri,
        resource: params.resource?.toString(),
        chatgptState: params.state,
      });

      const githubUrl = buildGithubAuthorizeUrl({
        clientId: GITHUB_CLIENT_ID,
        redirectUri: `${MCP_ISSUER_URL}/callback`,
        state: internalState,
        scope: 'repo',
      });

      res.redirect(githubUrl);
    },

    async challengeForAuthorizationCode(client: any, authorizationCode: string): Promise<string> {
      const data = await store.getAuthCode(authorizationCode);
      if (!data) {
        throw new Error('Authorization code not found or expired');
      }
      return data.codeChallenge;
    },

    async exchangeAuthorizationCode(
      client: any,
      authorizationCode: string,
      _codeVerifier?: string,
      _redirectUri?: string,
      _resource?: URL
    ) {
      const data = await store.consumeAuthCode(authorizationCode);
      if (!data) {
        throw new Error('Authorization code not found or expired');
      }

      const accessToken = randomToken();
      const refreshToken = randomToken();
      await store.saveMcpTokenPair(accessToken, refreshToken, {
        clientId: data.clientId,
        userId: data.userId,
        scopes: ['repo'],
      });

      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 86400,
        refresh_token: refreshToken,
        scope: 'repo',
      };
    },

    async exchangeRefreshToken(client: any, refreshToken: string, _scopes?: string[], _resource?: URL) {
      const data = await store.consumeMcpRefreshToken(refreshToken);
      if (!data) {
        throw new Error('Refresh token not found or expired');
      }

      const accessToken = randomToken();
      const newRefreshToken = randomToken();
      await store.saveMcpTokenPair(accessToken, newRefreshToken, data);

      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 86400,
        refresh_token: newRefreshToken,
        scope: data.scopes.join(' '),
      };
    },

    async verifyAccessToken(token: string) {
      const data = await store.getMcpAccessToken(token);
      if (!data) {
        throw new Error('Access token not found or expired');
      }
      return {
        token,
        clientId: data.clientId,
        scopes: data.scopes,
        extra: { githubUserId: data.userId },
      };
    },
  };
}

export async function handleGithubCallback(req: Request, res: Response): Promise<void> {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;

  if (!code || !state) {
    res.status(400).send('Missing code or state');
    return;
  }

  const pending = await store.consumePendingAuthorization(state);
  if (!pending) {
    res.status(400).send('Unknown or expired authorization request');
    return;
  }

  const githubToken = await exchangeCodeForGithubToken({
    clientId: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    code,
    redirectUri: `${MCP_ISSUER_URL}/callback`,
  });

  const githubUser = await getGithubUser(githubToken.accessToken);
  const userId = String(githubUser.id);

  await store.saveGithubToken(userId, { accessToken: githubToken.accessToken });

  const mcpAuthCode = randomBytes(32).toString('hex');
  await store.saveAuthCode(mcpAuthCode, {
    clientId: pending.clientId,
    userId,
    codeChallenge: pending.codeChallenge,
    redirectUri: pending.redirectUri,
    resource: pending.resource,
  });

  const redirectUrl = new URL(pending.redirectUri);
  redirectUrl.searchParams.set('code', mcpAuthCode);
  if (pending.chatgptState) {
    redirectUrl.searchParams.set('state', pending.chatgptState);
  }

  res.redirect(redirectUrl.toString());
}
