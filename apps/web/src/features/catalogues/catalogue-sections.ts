export interface CatalogueSection {
  href: string;
  title: string;
  description: string;
}

/** Default landing tab when visiting /admin/catalogues */
export const DEFAULT_CATALOGUE_HREF = '/admin/catalogues/engagement-types';

export const CATALOGUE_SECTIONS: CatalogueSection[] = [
  {
    href: '/admin/catalogues/engagement-types',
    title: 'Engagement types',
    description: 'Engagement categories and suggested request classes',
  },
  {
    href: '/admin/catalogues/request-classes',
    title: 'Request classes',
    description: 'High-level request groupings',
  },
  {
    href: '/admin/catalogues/request-types',
    title: 'Request types',
    description: 'Types within a request class',
  },
  {
    href: '/admin/catalogues/request-statuses',
    title: 'Request statuses',
    description: 'Ordered status catalogue',
  },
  {
    href: '/admin/catalogues/departments',
    title: 'Departments',
    description: 'Firm departments',
  },
];

export function isCatalogueSectionActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getCatalogueSection(href: string): CatalogueSection | undefined {
  return CATALOGUE_SECTIONS.find((s) => s.href === href);
}
