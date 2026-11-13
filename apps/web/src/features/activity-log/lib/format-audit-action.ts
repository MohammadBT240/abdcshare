/** Human-readable labels for interceptor-style and LOGIN actions. */
export function formatAuditAction(action: string): string {
  if (action === 'LOGIN') return 'Signed in';

  const match = /^(POST|PATCH|PUT|DELETE)\s+(\S+)/i.exec(action.trim());
  if (!match) return action;

  const method = match[1]!.toUpperCase();
  const segments = match[2]!.split('/').filter((s) => s && s !== 'api');
  const words = (s: string) => s.replace(/-/g, ' ');
  const title = (s: string) => words(s).replace(/\b\w/g, (c) => c.toUpperCase());
  const sentence = (s: string) => {
    const w = words(s);
    return w.charAt(0).toUpperCase() + w.slice(1);
  };

  // `/users/:id/reset-password`, `/clients/:id/contacts` — something done to, or under, one record.
  const lastFixed = segments.findLastIndex((s) => !s.startsWith(':'));
  const firstParam = segments.findIndex((s) => s.startsWith(':'));
  if (lastFixed > 0 && firstParam !== -1 && firstParam < lastFixed) {
    const parent = segments.slice(0, firstParam).filter((s) => !s.startsWith(':'));
    const label = `${title(parent.join(' '))} › ${sentence(segments[lastFixed]!)}`;
    if (method === 'POST') return label;
    if (method === 'DELETE') return `Deleted ${label}`;
    return `Updated ${label}`;
  }

  const label = title(segments.filter((s) => !s.startsWith(':')).join(' ') || 'resource');
  if (method === 'POST') return `Created ${label}`;
  if (method === 'DELETE') return `Deleted ${label}`;
  return `Updated ${label}`;
}

export function truncateId(id: string, keep = 8): string {
  if (id.length <= keep * 2 + 1) return id;
  return `${id.slice(0, keep)}…${id.slice(-keep)}`;
}
