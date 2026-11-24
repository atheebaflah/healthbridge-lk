import { asgardeo } from '@asgardeo/nextjs/server';

export const BRIDGE_URL = process.env.BRIDGE_URL ?? 'http://127.0.0.1:9090';

export async function getAccessToken(): Promise<string | null> {
  const client = await asgardeo();
  const sessionId = await client.getSessionId();
  if (!sessionId) return null;
  try {
    return await client.getAccessToken(sessionId);
  } catch {
    return null;
  }
}

export async function bridgeFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not signed in');
  return fetch(`${BRIDGE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers, Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
}

// The bridge sends errors as {"message": "..."}
export function errorMessage(raw: string): string {
  try {
    return JSON.parse(raw).message ?? raw;
  } catch {
    return raw;
  }
}