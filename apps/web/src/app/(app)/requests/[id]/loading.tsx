import { PageToolbar } from '@/components/layout/page-toolbar';

export default function RequestDetailLoading() {
  return (
    <div className="space-y-5">
      <PageToolbar
        title="Loading..."
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Requests', href: '/requests' },
        ]}
      />
      <p className="text-sm text-muted-foreground">Loading request…</p>
    </div>
  );
}
