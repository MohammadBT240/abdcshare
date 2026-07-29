'use client';

import { CatalogueAdminPage } from '@/features/catalogues/components/catalogue-admin-page';

export default function DepartmentsPage() {
  return (
    <CatalogueAdminPage
      title="Departments"
      resource="departments"
      managePermission="department:manage"
      fields={['name']}
    />
  );
}
