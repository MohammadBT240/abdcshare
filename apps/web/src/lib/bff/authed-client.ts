import type { ApiClient } from '@abdcshare/api-client';
import { createServerApiClient } from '@/lib/auth/api';
import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from '@/lib/auth/cookies';

/**
 * Returns an API client with a valid access token (silent refresh once).
 * Returns null when unauthenticated.
 */
export async function getAuthedApiClient(): Promise<ApiClient | null> {
  let access = await getAccessToken();
  const refresh = await getRefreshToken();
  if (!access && !refresh) return null;

  if (!access && refresh) {
    const refreshClient = createServerApiClient();
    const rotated = await refreshClient.POST('/api/auth/refresh', {
      body: { refreshToken: refresh },
    });
    if (rotated.data?.accessToken && rotated.data.refreshToken) {
      await setAuthCookies(rotated.data.accessToken, rotated.data.refreshToken);
      access = rotated.data.accessToken;
    } else {
      await clearAuthCookies();
      return null;
    }
  }

  return createServerApiClient(access);
}
