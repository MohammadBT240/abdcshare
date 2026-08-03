"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBooks,
  IconBriefcase,
  IconBuilding,
  IconChartBar,
  IconChecklist,
  IconFolderOpen,
  IconBell,
  IconInbox,
  IconLayoutDashboard,
  IconUser,
  IconUsers,
  IconX,
  type Icon,
} from "@tabler/icons-react";
import type { Permission } from "@abdcshare/shared";
import { cn } from "@/lib/utils";
import { AppSidebarSkeleton } from "@/components/skeletons";
import { useAuthContext } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/useUIStore";

interface NavItem {
  label: string;
  href: string;
  icon: Icon;
  permission?: Permission;
  anyOf?: Permission[];
}

interface NavSection {
  heading: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    heading: "Dashboard",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: IconLayoutDashboard },
    ],
  },
  {
    heading: "Workspace",
    items: [
      {
        label: "Engagements",
        href: "/engagements",
        icon: IconBriefcase,
        permission: "engagement:view",
      },
      {
        label: "Requests",
        href: "/requests",
        icon: IconInbox,
        permission: "request:view",
      },
      {
        label: "Reviews",
        href: "/reviews",
        icon: IconChecklist,
        permission: "review:decide",
      },
    ],
  },
  {
    heading: "User Management",
    items: [
      {
        label: "Users",
        href: "/admin/users",
        icon: IconUsers,
        permission: "user:view",
      },
      {
        label: "Clients",
        href: "/admin/clients",
        icon: IconUser,
        permission: "client:view",
      },
      {
        label: "Catalogues",
        href: "/admin/catalogues",
        icon: IconBooks,
        permission: "catalogue:view",
      },
    ],
  },
  {
    heading: "Settings",
    items: [
      {
        label: "Notifications",
        href: "/settings/notifications",
        icon: IconBell,
        permission: "notification:receive",
      },
      {
        label: "Company Profiles",
        href: "/admin/company-profile",
        icon: IconBuilding,
        permission: "company-profile:view",
      },
    ],
  },
  {
    heading: "Reports",
    items: [
      {
        label: "Final Reports",
        href: "/final-reports",
        icon: IconFolderOpen,
        permission: "report-review:respond",
      },
      {
        label: "Partner Reports",
        href: "#",
        icon: IconChartBar,
        permission: "partner-report:view",
      },
    ],
  },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "#") return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface SidebarPanelProps {
  collapsed: boolean;
  pathname: string;
  visibleSections: NavSection[];
  onNavigate?: () => void;
  showClose?: boolean;
  onClose?: () => void;
}

function SidebarPanel({
  collapsed,
  pathname,
  visibleSections,
  onNavigate,
  showClose,
  onClose,
}: SidebarPanelProps) {
  return (
    <>
      <div
        className={cn(
          "flex items-center",
          collapsed ? "justify-center" : "justify-between gap-2",
        )}
      >
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className={cn(
            "flex items-center justify-center rounded-lg shadow-sm",
            collapsed ? "h-12 p-1.5" : "h-18 flex-1 px-4 py-2",
          )}
        >
          <Image
            src={
              collapsed
                ? "/logos/abdc_logo_sm.png"
                : "/logos/abdc_logo_full.png"
            }
            alt="Abdulkadeer & Co. — Chartered accountants"
            width={collapsed ? 36 : 168}
            height={collapsed ? 36 : 44}
            className={cn(
              "object-contain",
              collapsed ? "h-9 w-9" : "h-15 w-auto",
            )}
            priority
          />
        </Link>
        {showClose ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 rounded-full px-0 text-white hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label="Close menu"
          >
            <IconX className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <nav className="mt-6 flex-1 space-y-5 overflow-y-auto">
        {visibleSections.map((section) => (
          <div key={section.heading}>
            {!collapsed ? (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                {section.heading}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActivePath(pathname, item.href);
                const ItemIcon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-md text-sm transition hover:bg-white/10",
                      collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
                      active
                        ? "bg-white/10 font-medium text-white"
                        : "text-white/75",
                    )}
                  >
                    <ItemIcon className="h-4 w-4 shrink-0" />
                    {!collapsed ? (
                      <span className="truncate">{item.label}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div
        className={cn(
          "mt-4 rounded-md bg-white/10 py-2 text-center text-xs font-medium text-white/80",
          collapsed ? "px-1" : "px-3",
        )}
      >
        {collapsed ? "v1.0.0" : "Abdulkadeer & Co. v1.0.0"}
      </div>
    </>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { can, isPending } = useAuthContext();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const mobileSidebarOpen = useUIStore((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname, setMobileSidebarOpen]);

  useEffect(() => {
    document.body.style.overflow = mobileSidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileSidebarOpen]);

  if (isPending) return <AppSidebarSkeleton />;

  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!item.permission && !item.anyOf) return true;
      if (item.anyOf) return item.anyOf.some((p) => can(p));
      return item.permission ? can(item.permission) : true;
    }),
  })).filter((s) => s.items.length > 0);

  const closeMobile = () => setMobileSidebarOpen(false);

  return (
    <>
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col bg-gradient-to-b from-sidebar-from to-sidebar-to lg:flex",
          sidebarCollapsed ? "w-[76px] px-3 py-4" : "w-64 px-4 py-4",
        )}
      >
        <SidebarPanel
          collapsed={sidebarCollapsed}
          pathname={pathname}
          visibleSections={visibleSections}
        />
      </aside>

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={closeMobile}
          />
          <aside className="relative flex h-full w-[min(100%,18rem)] flex-col bg-gradient-to-b from-sidebar-from to-sidebar-to px-4 py-4 shadow-aca">
            <SidebarPanel
              collapsed={false}
              pathname={pathname}
              visibleSections={visibleSections}
              onNavigate={closeMobile}
              showClose
              onClose={closeMobile}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}
