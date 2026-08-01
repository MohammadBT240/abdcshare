import { CatalogueShell } from '@/features/catalogues/components/catalogue-shell';

export default function CataloguesLayout({ children }: { children: React.ReactNode }) {
  return <CatalogueShell>{children}</CatalogueShell>;
}
