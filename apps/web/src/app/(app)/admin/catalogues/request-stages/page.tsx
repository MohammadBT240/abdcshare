'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_CATALOGUE_HREF } from '@/features/catalogues/catalogue-sections';

/** Request stages are system-inferred; catalogue management is disabled. */
export default function RequestStagesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(DEFAULT_CATALOGUE_HREF);
  }, [router]);
  return null;
}
