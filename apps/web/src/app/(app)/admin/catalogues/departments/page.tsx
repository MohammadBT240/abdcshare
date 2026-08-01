'use client';

import { CatalogueAdminPage } from '@/features/catalogues/components/catalogue-admin-page';
import { getCatalogueSection } from '@/features/catalogues/catalogue-sections';

const HREF = '/admin/catalogues/departments';

export default function DepartmentsPage() {
  const section = getCatalogueSection(HREF)!;

  return (
    <CatalogueAdminPage
      title={section.title}
      description={section.description}
      resource="departments"
      managePermission="department:manage"
      fields={['name']}
    />
  );
}
