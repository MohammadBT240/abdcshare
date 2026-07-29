import Link from 'next/link';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const LINKS = [
  { href: '/admin/catalogues/engagement-types', title: 'Engagement types', desc: 'Engagement categories and allowed request classes' },
  { href: '/admin/catalogues/request-classes', title: 'Request classes', desc: 'High-level request groupings' },
  { href: '/admin/catalogues/request-types', title: 'Request types', desc: 'Types within a request class' },
  { href: '/admin/catalogues/request-stages', title: 'Request stages', desc: 'Ordered workflow stages' },
  { href: '/admin/catalogues/request-statuses', title: 'Request statuses', desc: 'Ordered status catalogue' },
  { href: '/admin/catalogues/departments', title: 'Departments', desc: 'Firm departments' },
];

export default function CataloguesIndexPage() {
  return (
    <div>
      <PageToolbar
        title="Catalogues"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Catalogues' },
        ]}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {LINKS.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full transition hover:border-primary/40">
              <CardHeader>
                <CardTitle className="text-base">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{item.desc}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
