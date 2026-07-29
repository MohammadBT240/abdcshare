'use client';

import { CatalogueAdminPage } from '@/features/catalogues/components/catalogue-admin-page';

export default function RequestClassesPage() {
  return (
    <CatalogueAdminPage
      title="Request classes"
      resource="request-classes"
      fields={['name', 'code', 'description']}
    />
  );
}
