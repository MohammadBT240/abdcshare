import { redirect } from 'next/navigation';

export default function NewUserPage() {
  redirect('/admin/users');
}
