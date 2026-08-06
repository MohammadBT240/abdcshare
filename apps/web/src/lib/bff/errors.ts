export interface BffErrorBody {
  message: string;
  statusCode: number;
  fieldErrors?: Record<string, string[]>;
}

function coalesceMessage(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value)) {
    const parts = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
    return parts.length > 0 ? parts.join(', ') : null;
  }
  return null;
}

export function mapApiError(status: number, body: unknown): BffErrorBody {
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    // API AllExceptionsFilter uses `error`; Nest defaults / some routes use `message`.
    const message =
      coalesceMessage(o.message) ?? coalesceMessage(o.error) ?? 'Request failed';
    return { message, statusCode: status };
  }
  return { message: 'Request failed', statusCode: status };
}
