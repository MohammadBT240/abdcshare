export interface BffErrorBody {
  message: string;
  statusCode: number;
  fieldErrors?: Record<string, string[]>;
}

export function mapApiError(status: number, body: unknown): BffErrorBody {
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    const message =
      typeof o.message === 'string'
        ? o.message
        : Array.isArray(o.message)
          ? o.message.join(', ')
          : 'Request failed';
    return { message, statusCode: status };
  }
  return { message: 'Request failed', statusCode: status };
}
