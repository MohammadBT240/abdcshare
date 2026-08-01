'use client';

import { CatalogueAdminPage } from '@/features/catalogues/components/catalogue-admin-page';
import { getCatalogueSection } from '@/features/catalogues/catalogue-sections';

const HREF = '/admin/catalogues/request-stages';

export default function RequestStagesPage() {
  const section = getCatalogueSection(HREF)!;

  return (
    <CatalogueAdminPage
      title={section.title}
      description={section.description}
      resource="request-stages"
      fields={['name', 'sortOrder']}
    />
  );
}
