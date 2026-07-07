export function buildGithubAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope: string;
}): string {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('state', params.state);
  url.searchParams.set('scope', params.scope);
  return url.toString();
}

export async function exchangeCodeForGithubToken(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string; tokenType: string; scope: string }> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`GitHub token exchange failed: ${data.error} — ${data.error_description ?? ''}`);
  }

  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    scope: data.scope,
  };
}

export async function getGithubUser(accessToken: string): Promise<{ id: number; login: string }> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub user: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return { id: data.id, login: data.login };
}
