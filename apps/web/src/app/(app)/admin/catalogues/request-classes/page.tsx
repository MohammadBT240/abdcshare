'use client';

import { CatalogueAdminPage } from '@/features/catalogues/components/catalogue-admin-page';
import { getCatalogueSection } from '@/features/catalogues/catalogue-sections';

const HREF = '/admin/catalogues/request-classes';

export default function RequestClassesPage() {
  const section = getCatalogueSection(HREF)!;

  return (
    <CatalogueAdminPage
      title={section.title}
      description={section.description}
      resource="request-classes"
      fields={['name', 'code', 'description']}
    />
  );
}
