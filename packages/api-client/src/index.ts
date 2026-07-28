import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './generated/schema';

export type { paths };
export type ApiPaths = paths;

export type AuthUser = paths['/api/auth/me']['get']['responses'][200]['content']['application/json'];
export type AuthTokens = paths['/api/auth/login']['post']['responses'][200]['content']['application/json'];

export interface CreateApiClientOptions {
  baseUrl: string;
  accessToken?: string;
}

/** Typed openapi-fetch client for the abdcshare API. */
export function createApiClient(options: CreateApiClientOptions) {
  const authMiddleware: Middleware = {
    onRequest({ request }) {
      if (options.accessToken) {
        request.headers.set('Authorization', `Bearer ${options.accessToken}`);
      }
      return request;
    },
  };

  const client = createClient<paths>({ baseUrl: options.baseUrl.replace(/\/+$/, '') });
  client.use(authMiddleware);
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;
