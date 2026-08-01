'use client';

import { CatalogueAdminPage } from '@/features/catalogues/components/catalogue-admin-page';
import { getCatalogueSection } from '@/features/catalogues/catalogue-sections';
import { useCatalogueList } from '@/features/catalogues/hooks/use-catalogue';

const HREF = '/admin/catalogues/engagement-types';

export default function EngagementTypesPage() {
  const section = getCatalogueSection(HREF)!;
  const classes = useCatalogueList('request-classes', 'page=1&pageSize=100');

  return (
    <CatalogueAdminPage
      title={section.title}
      description={section.description}
      resource="engagement-types"
      fields={['name']}
      requestClasses={classes.data?.data ?? []}
      allowRequestClassMapping
    />
  );
}
