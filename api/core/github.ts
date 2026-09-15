// GitHub OAuth code exchange using the fetch API (available on Workers,
// Vercel Edge and Node.js 18+).

export interface GitHubProfile {
  id: number;
  login: string;
  avatarUrl: string;
}

export const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
export const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
export const GITHUB_USER_URL = 'https://api.github.com/user';

export function buildAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: 'read:user',
  });
  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string, clientId: string, clientSecret: string): Promise<string | null> {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  if (!response.ok) return null;
  const data = (await response.json().catch(() => null)) as { access_token?: string } | null;
  return data?.access_token || null;
}

export async function fetchGitHubProfile(accessToken: string): Promise<GitHubProfile | null> {
  const response = await fetch(GITHUB_USER_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'orbit-focus',
    },
  });
  if (!response.ok) return null;
  const data = (await response.json().catch(() => null)) as { id?: number; login?: string; avatar_url?: string } | null;
  if (!data || typeof data.id !== 'number' || !data.login) return null;
  return { id: data.id, login: data.login, avatarUrl: data.avatar_url || '' };
}
