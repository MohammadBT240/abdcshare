'use client';

import { useParams } from 'next/navigation';
import { LibraryCollectionPage } from '@/features/library/components/library-collection-page';

export default function LibraryCollectionRoute() {
  const { id } = useParams<{ id: string }>();
  return <LibraryCollectionPage id={id} />;
}
