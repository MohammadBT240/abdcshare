'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  IconBooks,
  IconChevronDown,
  IconFlag,
  IconFolderPlus,
  IconLayoutGrid,
  IconList,
  IconPlus,
  IconSearch,
  IconTag,
  IconX,
} from '@tabler/icons-react';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { FilterBar } from '@/components/data/filter-bar';
import { ErrorState } from '@/components/data/empty-state';
import { ListPagination } from '@/components/data/list-pagination';
import { useListParams } from '@/components/data/use-list-params';
import { AppSelect } from '@/components/forms';
import { useAuthContext } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { BffClientError } from '@/lib/bff/client';
import { useDepartments } from '@/features/users/hooks/use-users';
import {
  useLibraryCategories,
  useLibraryItems,
  useLibraryReportCount,
  useLibraryTags,
} from '@/features/library/hooks/use-library';
import { HelpTip } from '@/features/help/components/help-tip';
import { LibraryCategoryRail, type LibraryScope } from '@/features/library/components/library-category-rail';
import { LibraryItemCard } from '@/features/library/components/library-item-card';
import { LibraryItemsTable } from '@/features/library/components/library-items-table';
import { UploadLibraryItemDialog } from '@/features/library/components/upload-library-item-dialog';
import { FILE_TYPE_OPTIONS, SORT_OPTIONS } from '@/features/library/lib/library-files';
import { BulkUploadDialog } from '@/features/library/components/bulk-upload-dialog';
import { CollectionFormDialog } from '@/features/library/components/collection-form-dialog';
import { LibraryCollectionsTab } from '@/features/library/components/library-collections-tab';
import { COLLECTION_TYPES } from '@/features/library/lib/collection-types';

const PAGE_SIZE = 24;
const THIS_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [
  { value: '', label: 'Any year' },
  ...Array.from({ length: THIS_YEAR - 1989 }, (_, i) => String(THIS_YEAR - i)).map((y) => ({ value: y, label: y })),
];

function parseScope(raw: string | undefined): LibraryScope {
  return raw === 'mine' || raw === 'archived' ? raw : 'all';
}

export function LibraryBrowsePage() {
  const router = useRouter();
  const { can } = useAuthContext();
  const canContribute = can('library:contribute');
  const canCurate = can('library:curate');
  const reportCount = useLibraryReportCount(canCurate);
  const isCurator = can('library:curate');
  const { params, setParams, setSearchQueryDebounced } = useListParams({ pageSize: PAGE_SIZE });
  const [searchInput, setSearchInput] = useState(params.q);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);

  useEffect(() => setSearchInput(params.q), [params.q]);

  const filters = params.extra;
  const scope = parseScope(filters.scope);
  const view = filters.view === 'table' ? 'table' : 'cards';
  const tab = filters.tab === 'collections' ? 'collections' : 'items';
  const categoryId = filters.category ?? '';
  const sort = params.sort || (params.q ? 'relevance' : 'newest');

  const apiQuery = useMemo(() => {
    const qs = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
    if (params.q) qs.set('q', params.q);
    qs.set('sort', sort === 'relevance' && !params.q ? 'newest' : sort);
    if (categoryId) qs.set('categoryId', categoryId);
    if (filters.department) qs.set('departmentId', filters.department);
    if (filters.type) qs.set('fileType', filters.type);
    if (filters.year) qs.set('year', filters.year);
    if (filters.tag) qs.set('tag', filters.tag);
    if (scope === 'mine') qs.set('mine', 'true');
    if (scope === 'archived') {
      qs.set('status', 'Archived');
      if (!isCurator) qs.set('mine', 'true');
    }
    return qs.toString();
  }, [params.page, params.pageSize, params.q, sort, categoryId, filters, scope, isCurator]);

  const list = useLibraryItems(apiQuery);
  // (collections tab fetches its own list)
  const categories = useLibraryCategories();
  const departments = useDepartments();
  const popularTags = useLibraryTags('', !filters.tag);

  const setFilter = (key: string, value: string | undefined) => setParams({ extra: { [key]: value || undefined } });
  const hasFilters = Boolean(
    params.q || categoryId || filters.department || filters.type || filters.year || filters.tag || filters.ctype,
  );
  const clearFilters = () => {
    setSearchInput('');
    setParams({
      q: '',
      extra: { category: undefined, department: undefined, type: undefined, year: undefined, tag: undefined, ctype: undefined },
    });
  };

  const items = list.data?.data ?? [];
  const meta = list.data?.meta;
  const activeCategory = categories.data?.find((c) => c.id === categoryId);
  const heading =
    scope === 'mine' ? 'My uploads' : scope === 'archived' ? (isCurator ? 'Archived items' : 'My archived items') : activeCategory?.name ?? 'All items';

  return (
    <div>
      <PageToolbar
        title="Library"
        description="Reports, research papers and materials shared across the firm."
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Library' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <HelpTip slug="using-the-library" />
            {canCurate ? (
              <Button asChild type="button" variant="outline">
                <Link href="/library/review">
                  <IconFlag className="mr-1.5 h-4 w-4" aria-hidden />
                  Review queue
                  {reportCount.data?.open ? (
                    <span className="ml-1.5 rounded-full bg-amber-300/90 px-1.5 text-[10px] font-semibold text-amber-950">
                      {reportCount.data.open}
                    </span>
                  ) : null}
                </Link>
              </Button>
            ) : null}
            {canContribute ? (
              <Button type="button" variant="outline" onClick={() => setCollectionOpen(true)}>
                <IconFolderPlus className="mr-1.5 h-4 w-4" aria-hidden />
                New collection
              </Button>
            ) : null}
            {canContribute ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button">
                    <IconPlus className="mr-1.5 h-4 w-4" aria-hidden />
                    Upload
                    <IconChevronDown className="ml-1 h-4 w-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onSelect={() => setUploadOpen(true)}>One file</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setBulkOpen(true)}>Several files</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        <aside className="min-w-0">
          <LibraryCategoryRail
            categories={categories.data ?? []}
            categoryId={categoryId}
            scope={scope}
            onCategory={(id) => setFilter('category', id)}
            onScope={(s) => setFilter('scope', s === 'all' ? undefined : s)}
            showCategories={tab === 'items'}
          />
        </aside>

        <section aria-labelledby="library-heading" className="min-w-0">
          <div role="tablist" aria-label="Library view" className="mb-3 inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
            {(['items', 'collections'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setParams({ extra: { tab: t === 'items' ? undefined : t } })}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  tab === t ? 'bg-card font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'items' ? 'Items' : 'Collections'}
              </button>
            ))}
          </div>
          <FilterBar
            actions={
              tab === 'collections' ? null : <ToggleGroup
                type="single"
                value={view}
                onValueChange={(v) => v && setFilter('view', v === 'cards' ? undefined : v)}
                aria-label="Layout"
              >
                <ToggleGroupItem value="cards" aria-label="Card view" title="Cards">
                  <IconLayoutGrid className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="table" aria-label="Table view" title="Table">
                  <IconList className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            }
          >
            <div className="relative min-w-[10rem] flex-1 basis-56 sm:max-w-sm">
              <IconSearch
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setSearchQueryDebounced(e.target.value);
                }}
                placeholder={tab === 'collections' ? 'Search collections…' : 'Search titles, authors, tags…'}
                className="h-9 pl-9"
                aria-label="Search the library"
              />
            </div>
            <div className="w-36 lg:hidden">
              <AppSelect
                size="sm"
                options={[
                  { value: 'all', label: 'Browse' },
                  { value: 'mine', label: 'My uploads' },
                  { value: 'archived', label: 'Archived' },
                ]}
                value={scope}
                onValueChange={(v) => setFilter('scope', v === 'all' ? undefined : v)}
              />
            </div>
            {tab === 'collections' ? (
              <div className="w-36">
                <AppSelect
                  size="sm"
                  options={[{ value: '', label: 'Any kind' }, ...COLLECTION_TYPES.map((t) => ({ value: t.value, label: t.label }))]}
                  value={filters.ctype ?? ''}
                  onValueChange={(v) => setFilter('ctype', v)}
                />
              </div>
            ) : null}
            {tab === 'items' ? (
            <>
            <div className="w-44">
              <AppSelect
                size="sm"
                options={[
                  { value: '', label: 'All departments' },
                  ...(departments.data ?? []).filter((d) => d.isActive).map((d) => ({ value: String(d.id), label: d.name })),
                ]}
                value={filters.department ?? ''}
                onValueChange={(v) => setFilter('department', v)}
                isLoading={departments.isPending}
              />
            </div>
            <div className="w-32">
              <AppSelect
                size="sm"
                options={[{ value: '', label: 'Any type' }, ...FILE_TYPE_OPTIONS]}
                value={filters.type ?? ''}
                onValueChange={(v) => setFilter('type', v)}
              />
            </div>
            </>
            ) : null}
            <div className="w-32">
              <AppSelect
                size="sm"
                options={YEAR_OPTIONS}
                value={filters.year ?? ''}
                onValueChange={(v) => setFilter('year', v)}
              />
            </div>
            {tab === 'items' ? (
              <div className="w-40">
                <AppSelect
                  size="sm"
                  options={SORT_OPTIONS.filter((o) => o.value !== 'relevance' || params.q)}
                  value={sort}
                  onValueChange={(v) => setParams({ sort: v })}
                />
              </div>
            ) : null}
          </FilterBar>

          {tab === 'collections' ? (
            <LibraryCollectionsTab
              q={params.q}
              scope={scope}
              type={filters.ctype ?? ''}
              year={filters.year ?? ''}
              page={params.page}
              pageSize={params.pageSize}
              isCurator={isCurator}
              canContribute={canContribute}
              onPage={(page) => setParams({ page })}
              onPageSize={(pageSize) => setParams({ pageSize, page: 1 })}
              onNew={() => setCollectionOpen(true)}
              onClear={clearFilters}
            />
          ) : (
          <>
          <div className="mb-3 flex min-h-7 flex-wrap items-center gap-2">
            <h2 id="library-heading" className="mr-1 text-sm font-semibold text-foreground">
              {heading}
              {meta ? (
                <span className="ml-1.5 font-normal text-muted-foreground">
                  · {meta.total} item{meta.total === 1 ? '' : 's'}
                </span>
              ) : null}
            </h2>
            {filters.tag ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <IconTag className="h-3 w-3" aria-hidden />
                {filters.tag}
                <button
                  type="button"
                  onClick={() => setFilter('tag', undefined)}
                  aria-label={`Remove tag filter ${filters.tag}`}
                  className="text-primary/70 hover:text-primary"
                >
                  <IconX className="h-3 w-3" />
                </button>
              </span>
            ) : scope === 'all' && (popularTags.data?.length ?? 0) > 0 ? (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-xs text-muted-foreground">Popular:</span>
                {popularTags.data!.slice(0, 8).map((t) => (
                  <button
                    key={t.tag}
                    type="button"
                    onClick={() => setFilter('tag', t.tag)}
                    className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    #{t.tag}
                  </button>
                ))}
              </div>
            ) : null}
            {hasFilters ? (
              <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>

          {list.isError ? (
            <ErrorState
              message={list.error instanceof BffClientError ? list.error.message : 'Failed to load the library'}
            />
          ) : view === 'table' ? (
            <LibraryItemsTable
              items={items}
              meta={meta}
              isPending={list.isPending}
              pageSize={params.pageSize}
              onPageChange={(page) => setParams({ page })}
              onPageSizeChange={(pageSize) => setParams({ pageSize, page: 1 })}
              onRowClick={(item) => router.push(`/library/${item.id}`)}
            />
          ) : list.isPending ? (
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-52 w-full rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
              <IconBooks className="h-10 w-10 text-muted-foreground/60" aria-hidden />
              {hasFilters ? (
                <>
                  <p className="mt-3 text-sm font-medium text-foreground">Nothing matches these filters</p>
                  <p className="mt-1 text-sm text-muted-foreground">Try fewer filters or a different search.</p>
                  <Button type="button" variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                    Clear filters
                  </Button>
                </>
              ) : scope === 'all' ? (
                <>
                  <p className="mt-3 text-sm font-medium text-foreground">
                    {activeCategory ? `Nothing in ${activeCategory.name} yet` : 'The library is empty'}
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Share reports, research papers and training materials so the whole firm can find them.
                  </p>
                  {canContribute ? (
                    <Button type="button" size="sm" className="mt-4" onClick={() => setUploadOpen(true)}>
                      <IconPlus className="mr-1.5 h-4 w-4" aria-hidden /> Upload the first item
                    </Button>
                  ) : null}
                </>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  {scope === 'mine' ? "You haven't uploaded anything yet." : 'No archived items.'}
                </p>
              )}
            </div>
          ) : (
            <>
              <div
                className={`grid gap-4 sm:grid-cols-2 2xl:grid-cols-3 ${list.isFetching ? 'opacity-70 transition-opacity' : ''}`}
              >
                {items.map((item) => (
                  <LibraryItemCard key={item.id} item={item} onTagClick={(tag) => setFilter('tag', tag)} />
                ))}
              </div>
              {meta && meta.totalPages > 1 ? (
                <ListPagination
                  className="mt-6"
                  meta={meta}
                  pageSize={params.pageSize}
                  onPageChange={(page) => setParams({ page })}
                  onPageSizeChange={(pageSize) => setParams({ pageSize, page: 1 })}
                  isPending={list.isFetching}
                />
              ) : null}
            </>
          )}
          </>
          )}
        </section>
      </div>

      <UploadLibraryItemDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultCategoryId={categoryId || undefined}
      />
      <BulkUploadDialog open={bulkOpen} onOpenChange={setBulkOpen} />
      <CollectionFormDialog open={collectionOpen} onOpenChange={setCollectionOpen} />
    </div>
  );
}
