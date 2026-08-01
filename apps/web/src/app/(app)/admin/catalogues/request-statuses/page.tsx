'use client';

import { CatalogueAdminPage } from '@/features/catalogues/components/catalogue-admin-page';
import { getCatalogueSection } from '@/features/catalogues/catalogue-sections';

const HREF = '/admin/catalogues/request-statuses';

export default function RequestStatusesPage() {
  const section = getCatalogueSection(HREF)!;

  return (
    <CatalogueAdminPage
      title={section.title}
      description={section.description}
      resource="request-statuses"
      fields={['name', 'sortOrder']}
    />
  );
}
