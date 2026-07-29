'use client';

import { CatalogueAdminPage } from '@/features/catalogues/components/catalogue-admin-page';
import { useCatalogueList } from '@/features/catalogues/hooks/use-catalogue';

export default function EngagementTypesPage() {
  const classes = useCatalogueList('request-classes', 'page=1&pageSize=100');

  return (
    <CatalogueAdminPage
      title="Engagement types"
      resource="engagement-types"
      fields={['name']}
      requestClasses={classes.data?.data ?? []}
      allowRequestClassMapping
    />
  );
}
