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
  IconHelpCircle,
  IconHistory,
  IconSettings,
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
    heading: "Work",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: IconLayoutDashboard },
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
      {
        label: "Final reports",
        href: "/final-reports",
        icon: IconFolderOpen,
        permission: "report-review:respond",
      },
      {
        label: "Reports",
        href: "/reports",
        icon: IconChartBar,
        permission: "partner-report:view",
      },
    ],
  },
  {
    heading: "Admin",
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
      {
        label: "Company Profiles",
        href: "/admin/company-profile",
        icon: IconBuilding,
        permission: "company-profile:view",
      },
      {
        label: "Activity log",
        href: "/admin/activity",
        icon: IconHistory,
        permission: "audit:view",
      },
      {
        label: "Final report reviews",
        href: "/admin/final-reports",
        icon: IconFolderOpen,
        permission: "report-review:manage",
      },
    ],
  },
  {
    heading: "Account",
    items: [
      {
        label: "Help",
        href: "/help",
        icon: IconHelpCircle,
      },
      {
        label: "Settings",
        href: "/settings/account",
        icon: IconSettings,
      },
    ],
  },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "#") return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href.startsWith("/settings")) return pathname.startsWith("/settings");
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
            "flex items-center justify-center rounded-xl ",
            collapsed ? "h-11 w-11 p-1.5" : "h-[3.25rem] flex-1 px-3 py-2",
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
              collapsed ? "h-8 w-8" : "h-10 w-auto",
            )}
            priority
          />
        </Link>
        {showClose ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 rounded-full px-0 text-white/80 hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label="Close menu"
          >
            <IconX className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <nav className="mt-7 flex-1 space-y-6 overflow-y-auto pb-2 [scrollbar-width:thin]">
        {visibleSections.map((section) => (
          <div key={section.heading}>
            {!collapsed ? (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                {section.heading}
              </p>
            ) : (
              <div className="mx-auto mb-2 h-px w-6 bg-white/10" aria-hidden />
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = isActivePath(pathname, item.href);
                const ItemIcon = item.icon;
                return (
                  <Link
                    key={`${section.heading}-${item.label}`}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg text-sm transition-colors",
                      collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
                      active
                        ? "bg-white/[0.12] font-medium text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]"
                        : "text-white/70 hover:bg-white/[0.08] hover:text-white/95",
                    )}
                  >
                    {active ? (
                      <span
                        className={cn(
                          "absolute rounded-full bg-emerald-300/90",
                          collapsed
                            ? "left-1 top-1/2 h-4 w-0.5 -translate-y-1/2"
                            : "left-1.5 top-1/2 h-4 w-0.5 -translate-y-1/2",
                        )}
                        aria-hidden
                      />
                    ) : null}
                    <ItemIcon
                      className={cn(
                        "h-[1.125rem] w-[1.125rem] shrink-0 transition-colors",
                        active
                          ? "text-emerald-200"
                          : "text-white/55 group-hover:text-white/85",
                      )}
                    />
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
          "mt-3 rounded-lg bg-white/[0.06] py-2 text-center text-[11px] font-medium tracking-wide text-white/55 ring-1 ring-inset ring-white/10",
          collapsed ? "px-1" : "px-3",
        )}
      >
        {collapsed ? "v1.0.0" : "Abdulkadeer & Co. · v1.0.0"}
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
          sidebarCollapsed ? "w-[76px] px-2.5 py-4" : "w-64 px-3.5 py-4",
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
            className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
            aria-label="Close menu"
            onClick={closeMobile}
          />
          <aside className="relative flex h-full w-[min(100%,18rem)] flex-col bg-gradient-to-b from-sidebar-from to-sidebar-to px-3.5 py-4 shadow-aca">
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
