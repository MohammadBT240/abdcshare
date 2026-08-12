import { createApiClient, type ApiClient } from '@abdcshare/api-client';

export function getApiBaseUrl(): string {
  return process.env.API_BASE_URL ?? 'http://localhost:4000';
}

export function createServerApiClient(
  accessToken?: string,
  forwardHeaders?: Record<string, string>,
): ApiClient {
  return createApiClient({
    baseUrl: getApiBaseUrl(),
    accessToken,
    forwardHeaders,
  });
}
