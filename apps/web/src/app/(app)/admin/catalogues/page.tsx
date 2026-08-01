import { redirect } from 'next/navigation';
import { DEFAULT_CATALOGUE_HREF } from '@/features/catalogues/catalogue-sections';

export default function CataloguesIndexPage() {
  redirect(DEFAULT_CATALOGUE_HREF);
}
