import { PageToolbar } from '@/components/layout/page-toolbar';

export default function EngagementWorkspaceLoading() {
  return (
    <div className="space-y-5">
      <PageToolbar
        title="Loading..."
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Engagements', href: '/engagements' },
        ]}
      />
      <p className="text-sm text-muted-foreground">Loading workspace...</p>
    </div>
  );
}
