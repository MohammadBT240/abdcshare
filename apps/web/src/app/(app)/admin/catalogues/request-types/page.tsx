'use client';

import { useCatalogueList } from '@/features/catalogues/hooks/use-catalogue';
import { CatalogueAdminPage } from '@/features/catalogues/components/catalogue-admin-page';
import { getCatalogueSection } from '@/features/catalogues/catalogue-sections';

const HREF = '/admin/catalogues/request-types';

export default function RequestTypesPage() {
  const section = getCatalogueSection(HREF)!;
  const classes = useCatalogueList('request-classes', 'page=1&pageSize=100');

  return (
    <CatalogueAdminPage
      title={section.title}
      description={section.description}
      resource="request-types"
      fields={['name', 'requestClassId', 'expectedDocuments']}
      requestClasses={classes.data?.data ?? []}
    />
  );
}
