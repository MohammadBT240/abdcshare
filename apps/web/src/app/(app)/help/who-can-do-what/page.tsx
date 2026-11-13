'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { IconCheck, IconChevronRight, IconMinus } from '@tabler/icons-react';
import { DESIGNATION_PERMISSIONS, ROLE_NAMES, ROLE_PERMISSIONS, type Permission } from '@abdcshare/shared';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { PERMISSION_GROUPS, PERMISSION_NOTES, type PermissionRow } from '@/features/help/lib/permission-labels';
import { cn } from '@/lib/utils';

type Column = { key: string; label: string; sub?: string; has: (p: Permission) => boolean; base?: (p: Permission) => boolean };

/** A designation adds to the Super Admin role, so its column checks both. */
const saHas = (p: Permission) => ROLE_PERMISSIONS['Super Admin'].includes(p);

const COLUMNS: Column[] = [
  ...ROLE_NAMES.map((r) => ({ key: r, label: r, has: (p: Permission) => ROLE_PERMISSIONS[r].includes(p) })),
  {
    key: 'Partner',
    label: 'Partner',
    sub: 'Super Admin +',
    has: (p: Permission) => DESIGNATION_PERMISSIONS.Partner.includes(p),
    base: saHas,
  },
  {
    key: 'PrincipalPartner',
    label: 'Principal Partner',
    sub: 'Super Admin +',
    has: (p: Permission) => DESIGNATION_PERMISSIONS.PrincipalPartner.includes(p),
    base: saHas,
  },
];

/**
 * Whether a column can do a row's action. Designation columns show only what the designation adds;
 * extra checks (`alsoNeeds`) may be met by the Super Admin role underneath.
 */
function allows(c: Column, item: PermissionRow): boolean {
  if (!c.has(item.permission)) return false;
  return (item.alsoNeeds ?? []).every((p) => c.has(p) || Boolean(c.base?.(p)));
}

/** HC6 — generated from the same permission tables the API enforces, so it can't go stale. */
export default function WhoCanDoWhatPage() {
  const { user } = useAuth();
  const mine = new Set([user?.role, user?.partnerDesignation].filter(Boolean) as string[]);

  return (
    <div className="max-w-5xl pb-16" data-testid="roles-matrix">
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/help" className="hover:text-primary hover:underline">
          Help Center
        </Link>
        <IconChevronRight className="h-3 w-3" aria-hidden /> Reference
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">Who can do what</h1>
      <p className="mt-2 max-w-3xl text-base text-muted-foreground">
        What each role can do in the portal. This table is built from the same rules the system enforces, so it is always
        current. Your own column is highlighted.
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card shadow-aca">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border">
              <th scope="col" className="w-[38%] px-4 py-3 text-left font-semibold text-foreground">
                Permission
              </th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn('px-2 py-3 text-center align-bottom text-xs font-semibold text-foreground', mine.has(c.key) && 'bg-primary/10')}
                >
                  {c.label}
                  {c.sub ? <span className="block font-normal text-muted-foreground">{c.sub}</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((g) => (
              <Fragment key={g.area}>
                <tr className="border-b border-border bg-muted/50">
                  <th colSpan={COLUMNS.length + 1} scope="colgroup" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-foreground/80">
                    {g.area}
                  </th>
                </tr>
                {g.items.map((item) => (
                  <tr key={[item.permission, ...(item.alsoNeeds ?? [])].join('+')} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <th scope="row" className="px-4 py-2 text-left font-normal text-foreground">
                      {item.label}
                    </th>
                    {COLUMNS.map((c) => (
                      <td key={c.key} className={cn('px-2 py-2 text-center', mine.has(c.key) && 'bg-primary/5')}>
                        {allows(c, item) ? (
                          <IconCheck className="mx-auto h-4 w-4 text-primary" aria-label="Yes" />
                        ) : (
                          <IconMinus className="mx-auto h-3.5 w-3.5 text-muted-foreground/40" aria-label="No" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-lg font-semibold text-foreground">Good to know</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
        {PERMISSION_NOTES.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}
