import { redirect } from 'next/navigation';

/** Request types live under Request classes as expandable sub-rows. */
export default function RequestTypesRedirectPage() {
  redirect('/admin/catalogues/request-classes');
}
