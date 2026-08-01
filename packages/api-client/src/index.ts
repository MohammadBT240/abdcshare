import createClient, { type Middleware } from 'openapi-fetch';
import type { components, paths } from './generated/schema';

export type { paths, components };
export type ApiPaths = paths;

/** Explicit response shapes — Nest Swagger often omits response content without @ApiOkResponse. */
export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
  partnerDesignation?: 'PrincipalPartner' | 'Partner' | null;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextCursor?: string | null;
};

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  link?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
};

export type NotificationList = {
  data: NotificationItem[];
  meta: PageMeta;
};

export type UnreadCount = { count: number };

export type CreateUserBody = components['schemas']['CreateUserDto'];
export type UpdateUserBody = components['schemas']['UpdateUserDto'];
export type CreateClientBody = components['schemas']['CreateClientDto'];
export type UpdateClientBody = components['schemas']['UpdateClientDto'];
export type RoleItem = components['schemas']['RoleResponseDto'];

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
