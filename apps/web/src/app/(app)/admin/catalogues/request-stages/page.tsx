'use client';

import { CatalogueAdminPage } from '@/features/catalogues/components/catalogue-admin-page';

export default function RequestStagesPage() {
  return (
    <CatalogueAdminPage title="Request stages" resource="request-stages" fields={['name', 'sortOrder']} />
  );
}
