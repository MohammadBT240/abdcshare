import type { ApiClient } from '@abdcshare/api-client';
import { createServerApiClient } from '@/lib/auth/api';
import { getAccessTokenWithRefresh } from '@/lib/bff/upstream';

/** Returns an API client with a valid access token (silent refresh once). */
export async function getAuthedApiClient(): Promise<ApiClient | null> {
  const access = await getAccessTokenWithRefresh();
  if (!access) return null;
  return createServerApiClient(access);
}
