'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Briefcase,
  Building2,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  Library,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from '@abdcshare/shared';
import { cn } from '@/lib/utils';
import { AppSidebarSkeleton } from '@/components/skeletons';
import { useAuthContext } from '@/components/providers/auth-provider';
import { useShell } from '@/components/layout/shell-context';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  anyOf?: Permission[];
}

interface NavSection {
  heading: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    heading: 'Dashboard',
    items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    heading: 'Workspace',
    items: [
      { label: 'Engagements', href: '#', icon: Briefcase, permission: 'engagement:view' },
      { label: 'Requests', href: '#', icon: Inbox, permission: 'request:view' },
      { label: 'Documents', href: '#', icon: FolderOpen, permission: 'document:view' },
    ],
  },
  {
    heading: 'User Management',
    items: [
      { label: 'Users', href: '/admin/users', icon: Users, permission: 'user:view' },
      { label: 'Clients', href: '/admin/clients', icon: UserRound, permission: 'client:view' },
      { label: 'Catalogues', href: '/admin/catalogues', icon: Library, permission: 'catalogue:view' },
    ],
  },
  {
    heading: 'Settings',
    items: [
      {
        label: 'Company Profile',
        href: '/admin/company-profile',
        icon: Building2,
        permission: 'company-profile:view',
      },
    ],
  },
  {
    heading: 'Reports',
    items: [
      { label: 'Partner Reports', href: '#', icon: BarChart3, permission: 'partner-report:view' },
    ],
  },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === '#') return false;
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();
  const { can, isPending } = useAuthContext();
  const { sidebarCollapsed } = useShell();

  if (isPending) return <AppSidebarSkeleton />;

  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!item.permission && !item.anyOf) return true;
      if (item.anyOf) return item.anyOf.some((p) => can(p));
      return item.permission ? can(item.permission) : true;
    }),
  })).filter((s) => s.items.length > 0);

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col bg-gradient-to-b from-sidebar-from to-sidebar-to lg:flex',
        sidebarCollapsed ? 'w-[76px] px-3 py-4' : 'w-64 px-4 py-4',
      )}
    >
      <Link
        href="/dashboard"
        className={cn(
          'flex items-center justify-center rounded-lg bg-white shadow-sm',
          sidebarCollapsed ? 'h-12 p-1.5' : 'h-14 px-4 py-2',
        )}
      >
        <Image
          src={sidebarCollapsed ? '/logos/abdc_logo_sm.png' : '/logos/abdc_logo_full.png'}
          alt="Abdulkadeer & Co. — Chartered accountants"
          width={sidebarCollapsed ? 36 : 168}
          height={sidebarCollapsed ? 36 : 44}
          className={cn('object-contain', sidebarCollapsed ? 'h-9 w-9' : 'h-10 w-auto')}
          priority
        />
      </Link>

      <nav className="mt-6 flex-1 space-y-5 overflow-y-auto">
        {visibleSections.map((section) => (
          <div key={section.heading}>
            {!sidebarCollapsed ? (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                {section.heading}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActivePath(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-md text-sm transition hover:bg-white/10',
                      sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2',
                      active ? 'bg-white/10 font-medium text-white' : 'text-white/75',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div
        className={cn(
          'mt-4 rounded-md bg-white/10 py-2 text-center text-xs font-medium text-white/80',
          sidebarCollapsed ? 'px-1' : 'px-3',
        )}
      >
        {sidebarCollapsed ? 'v1.0.0' : 'Abdulkadeer & Co. v1.0.0'}
      </div>
    </aside>
  );
}
