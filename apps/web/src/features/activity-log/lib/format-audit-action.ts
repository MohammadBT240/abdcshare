/** Human-readable labels for interceptor-style and LOGIN actions. */
export function formatAuditAction(action: string): string {
  if (action === 'LOGIN') return 'Signed in';

  const match = /^(POST|PATCH|PUT|DELETE)\s+(\S+)/i.exec(action.trim());
  if (!match) return action;

  const method = match[1]!.toUpperCase();
  const path = match[2]!;
  const segments = path
    .split('/')
    .filter((s) => s && s !== 'api' && !s.startsWith(':'));
  const resource = (segments[0] ?? 'resource').replace(/-/g, ' ');
  const label = resource.replace(/\b\w/g, (c) => c.toUpperCase());

  if (method === 'POST') return `Created ${label}`;
  if (method === 'DELETE') return `Deleted ${label}`;
  return `Updated ${label}`;
}

export function truncateId(id: string, keep = 8): string {
  if (id.length <= keep * 2 + 1) return id;
  return `${id.slice(0, keep)}…${id.slice(-keep)}`;
}
