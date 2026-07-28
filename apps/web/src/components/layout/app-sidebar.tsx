'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Permission } from '@abdcshare/shared';
import { cn } from '@/lib/utils';
import { AppSidebarSkeleton } from '@/components/skeletons';
import { useAuthContext } from '@/components/providers/auth-provider';

const NAV: { label: string; href: string; permission?: Permission; anyOf?: Permission[] }[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Engagements', href: '#', permission: 'engagement:view' },
  { label: 'Requests', href: '#', permission: 'request:view' },
  { label: 'Documents', href: '#', permission: 'document:view' },
  { label: 'Admin', href: '#', anyOf: ['user:view', 'catalogue:view'] },
  { label: 'Partner Reports', href: '#', permission: 'partner-report:view' },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { can, isPending } = useAuthContext();

  if (isPending) return <AppSidebarSkeleton />;

  const visible = NAV.filter((item) => {
    if (!item.permission && !item.anyOf) return true;
    if (item.anyOf) return item.anyOf.some((p) => can(p));
    return item.permission ? can(item.permission) : true;
  });

  return (
    <aside className="hidden w-64 shrink-0 bg-gradient-to-b from-sidebar-from to-sidebar-to p-4 text-white/90 lg:block">
      <div className="mb-6 px-2 text-lg font-bold text-white">abdcshare</div>
      <nav className="space-y-1">
        {visible.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'block rounded-md px-3 py-2 text-sm transition hover:bg-white/10',
                active ? 'bg-white/10 text-white' : 'text-white/80',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
