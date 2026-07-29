'use client';

import { CatalogueAdminPage } from '@/features/catalogues/components/catalogue-admin-page';

export default function RequestStatusesPage() {
  return (
    <CatalogueAdminPage
      title="Request statuses"
      resource="request-statuses"
      fields={['name', 'sortOrder']}
    />
  );
}
