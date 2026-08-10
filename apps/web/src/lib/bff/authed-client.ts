import type { ApiClient } from '@abdcshare/api-client';
import { createServerApiClient } from '@/lib/auth/api';
import { getAccessTokenWithRefresh } from '@/lib/bff/upstream';

/** Returns an API client with a valid access token (silent refresh once). */
export async function getAuthedApiClient(options?: {
  forceRefresh?: boolean;
}): Promise<ApiClient | null> {
  const access = await getAccessTokenWithRefresh({ force: options?.forceRefresh });
  if (!access) return null;
  return createServerApiClient(access);
}

/**
 * Run an OpenAPI call; on 401 force-refresh once and retry.
 * `execute` receives a fresh client each attempt.
 */
export async function withAuthedRetry<T>(
  execute: (client: ApiClient) => Promise<{ data?: T; response: Response; error?: unknown }>,
): Promise<{ data?: T; response: Response; error?: unknown } | null> {
  let client = await getAuthedApiClient();
  if (!client) return null;

  let result = await execute(client);
  if (result.response.status !== 401) return result;

  client = await getAuthedApiClient({ forceRefresh: true });
  if (!client) return null;
  return execute(client);
}
