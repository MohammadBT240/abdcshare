import { redirect } from 'next/navigation';

export default function NewClientPage() {
  redirect('/admin/clients');
}
