'use client';

import { useQuery } from '@tanstack/react-query';
import { IconLockOff } from '@tabler/icons-react';
import { useAuthContext } from '@/components/providers/auth-provider';
import { fetchDepartmentLibraryImpact } from '@/features/library/hooks/use-library';

/**
 * Shown in the "Deactivate department?" dialog (S3, D30): how many restricted library items and
 * collections would be left visible to curators and owners only.
 */
export function DepartmentLibraryImpact({ departmentId }: { departmentId: number }) {
  const { can } = useAuthContext();
  const impact = useQuery({
    queryKey: ['library', 'admin', 'department-impact', departmentId],
    queryFn: () => fetchDepartmentLibraryImpact(departmentId),
    enabled: can('library:curate') && Number.isFinite(departmentId),
    staleTime: 0,
  });
  const n = impact.data;
  if (!n || (n.items === 0 && n.collections === 0)) return null;
  const parts = [
    n.items ? `${n.items} library item${n.items === 1 ? '' : 's'}` : null,
    n.collections ? `${n.collections} collection${n.collections === 1 ? '' : 's'}` : null,
  ].filter(Boolean);
  return (
    <p
      className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100"
      data-testid="department-library-impact"
    >
      <IconLockOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        {parts.join(' and ')} {n.items + n.collections === 1 ? 'is' : 'are'} restricted to this department only. After
        deactivating, only curators and the uploaders will see {n.items + n.collections === 1 ? 'it' : 'them'} — they will
        appear under Library › Review queue › Needs attention.
      </span>
    </p>
  );
}
