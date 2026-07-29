'use client';

import { useCatalogueList } from '@/features/catalogues/hooks/use-catalogue';
import { CatalogueAdminPage } from '@/features/catalogues/components/catalogue-admin-page';

export default function RequestTypesPage() {
  const classes = useCatalogueList('request-classes', 'page=1&pageSize=100');
  return (
    <CatalogueAdminPage
      title="Request types"
      resource="request-types"
      fields={['name', 'requestClassId', 'expectedDocuments']}
      requestClasses={classes.data?.data ?? []}
    />
  );
}
