import { PageToolbar } from '@/components/layout/page-toolbar';
import { DataTableSkeleton } from '@/components/skeletons';

export default function EngagementDocumentsLoading() {
  return (
    <div className="space-y-5">
      <PageToolbar
        title="Documents"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Engagements', href: '/engagements' },
        ]}
      />
      <DataTableSkeleton columns={6} />
    </div>
  );
}
