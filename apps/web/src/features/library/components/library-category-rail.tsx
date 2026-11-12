'use client';

import { IconArchive, IconBooks, IconUser } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import type { LibraryCategory } from '@/features/library/types';

export type LibraryScope = 'all' | 'mine' | 'archived';

function RailButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
        active ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

/** Left rail: scope (All / My uploads / Archived) and categories. Horizontal chips on mobile. */
export function LibraryCategoryRail({
  categories,
  categoryId,
  scope,
  onCategory,
  onScope,
}: {
  categories: LibraryCategory[];
  categoryId: string;
  scope: LibraryScope;
  onCategory: (id: string) => void;
  onScope: (scope: LibraryScope) => void;
}) {
  return (
    <>
      {/* Mobile */}
      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
        {[{ id: '', name: 'All categories' }, ...categories].map((c) => (
          <button
            key={c.id || 'all'}
            type="button"
            onClick={() => onCategory(c.id)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors',
              categoryId === c.id
                ? 'border-primary bg-primary/10 font-medium text-primary'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Desktop */}
      <nav aria-label="Library sections" className="hidden space-y-5 lg:block">
        <div className="space-y-0.5">
          <RailButton active={scope === 'all'} onClick={() => onScope('all')}>
            <IconBooks className="h-4 w-4" aria-hidden /> Browse
          </RailButton>
          <RailButton active={scope === 'mine'} onClick={() => onScope('mine')}>
            <IconUser className="h-4 w-4" aria-hidden /> My uploads
          </RailButton>
          <RailButton active={scope === 'archived'} onClick={() => onScope('archived')}>
            <IconArchive className="h-4 w-4" aria-hidden /> Archived
          </RailButton>
        </div>
        <div>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Categories
          </p>
          <div className="space-y-0.5">
            <RailButton active={categoryId === ''} onClick={() => onCategory('')}>
              All categories
            </RailButton>
            {categories.map((c) => (
              <RailButton key={c.id} active={categoryId === c.id} onClick={() => onCategory(c.id)}>
                <span className="truncate" title={c.description ?? undefined}>
                  {c.name}
                </span>
              </RailButton>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}
