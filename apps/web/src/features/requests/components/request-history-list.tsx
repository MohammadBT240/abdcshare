'use client';

import { useRequestHistory } from '@/features/requests/hooks/use-requests';

interface RequestHistoryListProps {
  requestId: string;
  enabled?: boolean;
}

export function RequestHistoryList({ requestId, enabled = true }: RequestHistoryListProps) {
  const history = useRequestHistory(requestId, enabled);
  const items = history.data?.data ?? [];

  if (history.isPending) {
    return <p className="text-sm text-muted-foreground">Loading history…</p>;
  }

  if (history.isError) {
    return <p className="text-sm text-destructive">Failed to load history</p>;
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No history yet</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-md border border-border p-3">
          <div className="mb-1 flex items-start justify-between gap-2">
            <p className="text-sm font-medium">{item.eventType}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(item.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            {item.fromValue ? (
              <div>
                <span className="line-through">{item.fromValue}</span>
                {item.toValue ? (
                  <>
                    {' '}
                    → <span className="font-medium text-foreground">{item.toValue}</span>
                  </>
                ) : null}
              </div>
            ) : item.toValue || item.note ? (
              <span className="font-medium text-foreground">{item.toValue ?? item.note}</span>
            ) : null}
          </div>
          {item.actorName ? (
            <p className="mt-1 text-xs text-muted-foreground">by {item.actorName}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
