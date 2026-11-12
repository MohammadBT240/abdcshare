'use client';

import { useParams } from 'next/navigation';
import { LibraryItemPage } from '@/features/library/components/library-item-page';

export default function LibraryItemRoute() {
  const { id } = useParams<{ id: string }>();
  return <LibraryItemPage id={id} />;
}
