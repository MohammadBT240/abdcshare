'use client';

import { Suspense, useState } from 'react';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { toast } from 'sonner';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { FilterBar } from '@/components/data/filter-bar';
import { EmptyState, ErrorState } from '@/components/data/empty-state';
import { useListParams } from '@/components/data/use-list-params';
import { ConfirmDialog } from '@/components/forms';
import { FileViewerDialog } from '@/components/files/file-viewer-dialog';
import { useAuthContext } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { BffClientError } from '@/lib/bff/client';
import { CompanyProfilesGrid } from '@/features/company-profiles/components/company-profiles-grid';
import { UploadCompanyProfileDialog } from '@/features/company-profiles/components/upload-company-profile-dialog';
import { RenameCompanyProfileDialog } from '@/features/company-profiles/components/rename-company-profile-dialog';
import { ReplaceCompanyProfileFileDialog } from '@/features/company-profiles/components/replace-company-profile-file-dialog';
import {
  downloadCompanyProfile,
  fetchCompanyProfilePreview,
  useCompanyProfilesList,
  useDeleteCompanyProfile,
  type CompanyProfileRecord,
} from '@/features/company-profiles/hooks/use-company-profiles';

function CompanyProfilesPageInner() {
  const { can } = useAuthContext();
  const canManage = can('company-profile:manage');
  const { params, setSearchQueryDebounced, queryString } = useListParams({ pageSize: 24 });
  const list = useCompanyProfilesList(queryString);
  const remove = useDeleteCompanyProfile();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<CompanyProfileRecord | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<CompanyProfileRecord | null>(null);
  const [removeTarget, setRemoveTarget] = useState<CompanyProfileRecord | null>(null);
  const [viewerTarget, setViewerTarget] = useState<CompanyProfileRecord | null>(null);
  const [searchInput, setSearchInput] = useState(params.q);

  async function handleDownload(profile: CompanyProfileRecord) {
    try {
      await downloadCompanyProfile(profile.id);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Download failed');
    }
  }

  return (
    <div>
      <PageToolbar
        title="Company Profiles"
        description="Reference documents for staff — capability packs and firm profiles."
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Settings' },
          { label: 'Company Profiles' },
        ]}
        actions={
          canManage ? (
            <Button type="button" onClick={() => setUploadOpen(true)}>
              <IconPlus className="mr-1.5 h-4 w-4" aria-hidden />
              Upload
            </Button>
          ) : null
        }
      />

      <FilterBar>
        <div className="relative min-w-[12rem] flex-1 basis-48 sm:max-w-sm">
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
            placeholder="Search by name…"
            className="h-9 pl-9"
          />
        </div>
      </FilterBar>

      <div className="mt-4 rounded-2xl bg-gradient-to-b from-primary/[0.04] to-transparent p-1 sm:p-2">
        {list.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        ) : list.isError ? (
          <ErrorState
            message={
              list.error instanceof BffClientError
                ? list.error.message
                : 'Failed to load company profiles'
            }
          />
        ) : !list.data?.data.length ? (
          <EmptyState message="No company profiles yet. Upload a document to get started." />
        ) : (
          <CompanyProfilesGrid
            profiles={list.data.data}
            canManage={canManage}
            onOpen={setViewerTarget}
            onDownload={handleDownload}
            onRename={setRenameTarget}
            onReplace={setReplaceTarget}
            onRemove={setRemoveTarget}
          />
        )}
      </div>

      <UploadCompanyProfileDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      <RenameCompanyProfileDialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        profile={renameTarget}
      />
      <ReplaceCompanyProfileFileDialog
        open={Boolean(replaceTarget)}
        onOpenChange={(open) => {
          if (!open) setReplaceTarget(null);
        }}
        profile={replaceTarget}
      />
      {viewerTarget ? (
        <FileViewerDialog
          open
          onOpenChange={(open) => {
            if (!open) setViewerTarget(null);
          }}
          fileName={viewerTarget.fileName ?? 'document'}
          mimeType={viewerTarget.mimeType}
          sizeBytes={viewerTarget.sizeBytes}
          getPreview={() => fetchCompanyProfilePreview(viewerTarget.id)}
          onDownload={() => downloadCompanyProfile(viewerTarget.id)}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title="Remove company profile?"
        description={
          removeTarget
            ? `“${removeTarget.name}” will no longer appear in the library.`
            : ''
        }
        confirmLabel="Remove"
        variant="destructive"
        confirming={remove.isPending}
        onConfirm={async () => {
          if (!removeTarget) return;
          try {
            await remove.mutateAsync(removeTarget.id);
            toast.success('Removed');
            setRemoveTarget(null);
          } catch (err) {
            toast.error(err instanceof BffClientError ? err.message : 'Remove failed');
          }
        }}
      />
    </div>
  );
}

export default function CompanyProfilesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-lg" />
            ))}
          </div>
        </div>
      }
    >
      <CompanyProfilesPageInner />
    </Suspense>
  );
}
