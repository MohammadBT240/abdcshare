export class BffClientError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'BffClientError';
  }
}

async function parseBffResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (typeof body.message === 'string' && body.message) ||
      (typeof body.error === 'string' && body.error) ||
      'Request failed';
    throw new BffClientError(message, res.status);
  }
  return body as T;
}

export async function bffJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  return parseBffResponse<T>(res);
}

/** Authed Nest paths via the generic BFF proxy (`/api/users` → `/api/bff/proxy/users`). */
export async function bffApi<T>(apiPath: string, init?: RequestInit): Promise<T> {
  const normalized = apiPath.replace(/^\/api\//, '').replace(/^\//, '');
  return bffJson<T>(`/api/bff/proxy/${normalized}`, init);
}

/** Multipart FormData via BFF — do not set Content-Type (browser sets boundary). */
export async function bffFormData<T>(
  apiPath: string,
  formData: FormData,
  method: 'POST' | 'PUT' | 'PATCH' = 'POST',
): Promise<T> {
  const normalized = apiPath.replace(/^\/api\//, '').replace(/^\//, '');
  const res = await fetch(`/api/bff/proxy/${normalized}`, {
    method,
    body: formData,
  });
  return parseBffResponse<T>(res);
}

