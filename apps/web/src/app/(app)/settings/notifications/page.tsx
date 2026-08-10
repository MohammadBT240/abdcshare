'use client';

import { useMemo } from 'react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { BffClientError } from '@/lib/bff/client';
import {
  useNotificationCatalog,
  useNotificationPreferences,
  useSetNotificationPreference,
} from '@/features/notifications/hooks/use-notifications';

const CATEGORY_LABELS: Record<string, string> = {
  engagement: 'Engagements',
  request: 'Requests',
  document: 'Documents',
  collaboration: 'Collaboration',
  review: 'Reviews',
  'partner-report': 'Reports',
};

export default function NotificationPreferencesPage() {
  const catalog = useNotificationCatalog();
  const prefs = useNotificationPreferences();
  const setPref = useSetNotificationPreference();

  const prefMap = useMemo(() => {
    const map = new Map<string, { emailEnabled: boolean; inAppEnabled: boolean }>();
    for (const p of prefs.data ?? []) {
      map.set(p.notificationType, {
        emailEnabled: p.emailEnabled,
        inAppEnabled: p.inAppEnabled,
      });
    }
    return map;
  }, [prefs.data]);

  const grouped = useMemo(() => {
    const rows = catalog.data ?? [];
    const byCat = new Map<string, typeof rows>();
    for (const item of rows) {
      const list = byCat.get(item.category) ?? [];
      list.push(item);
      byCat.set(item.category, list);
    }
    return byCat;
  }, [catalog.data]);

  async function update(
    type: string,
    patch: { emailEnabled?: boolean; inAppEnabled?: boolean },
  ) {
    const current = prefMap.get(type) ?? { emailEnabled: true, inAppEnabled: true };
    try {
      await setPref.mutateAsync({
        type,
        emailEnabled: patch.emailEnabled ?? current.emailEnabled,
        inAppEnabled: patch.inAppEnabled ?? current.inAppEnabled,
      });
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Failed to update preference');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Choose which events send in-app alerts and email. Both are on by default.
        </p>
      </div>

      {catalog.isPending || prefs.isPending ? (
        <p className="text-sm text-muted-foreground">Loading preferences…</p>
      ) : catalog.isError || prefs.isError ? (
        <p className="text-sm text-destructive">Failed to load notification preferences.</p>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([category, items]) => (
            <section key={category} className="space-y-3">
              <h3 className="text-sm font-semibold">
                {CATEGORY_LABELS[category] ?? category}
              </h3>
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {items.map((item) => {
                  const current = prefMap.get(item.type) ?? {
                    emailEnabled: true,
                    inAppEnabled: true,
                  };
                  return (
                    <li
                      key={item.type}
                      className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-5">
                        <label className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={current.inAppEnabled}
                            disabled={setPref.isPending}
                            onCheckedChange={(v) =>
                              void update(item.type, { inAppEnabled: v === true })
                            }
                          />
                          In-app
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={current.emailEnabled}
                            disabled={setPref.isPending}
                            onCheckedChange={(v) =>
                              void update(item.type, { emailEnabled: v === true })
                            }
                          />
                          Email
                        </label>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
