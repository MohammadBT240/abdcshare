'use client';

import { DashboardSkeleton } from '@/components/skeletons';
import { useAuthContext } from '@/components/providers/auth-provider';
import { useDashboard } from '@/features/dashboard/hooks/use-dashboard';
import { DashboardHero } from '@/features/dashboard/components/decor';
import { GovernanceDashboard } from '@/features/dashboard/components/governance-dashboard';
import { FirmDashboard } from '@/features/dashboard/components/firm-dashboard';
import { StaffDashboard } from '@/features/dashboard/components/staff-dashboard';
import { ClientDashboard } from '@/features/dashboard/components/client-dashboard';
import { GuestDashboard } from '@/features/dashboard/components/guest-dashboard';

const TAGLINES: Record<string, string> = {
  governance: 'Platform health, people, and configuration at a glance.',
  firm: 'Every engagement, request, and report across the firm.',
  staff: 'Your assignments, deadlines, and reviews for the week.',
  client: 'Track requests, documents, and reports for your engagements.',
  guest: 'Draft and submit your partner reports to the Principal.',
};

export default function DashboardPage() {
  const { user, isPending } = useAuthContext();
  const summary = useDashboard();

  if (isPending || !user) return <DashboardSkeleton />;

  const kind = summary.data?.kind;

  return (
    <div className="space-y-5">
      <DashboardHero
        name={user.fullName}
        role={user.role}
        tagline={kind ? TAGLINES[kind] ?? '' : 'Loading your workspace…'}
        unread={summary.data?.notifications.unread ?? 0}
      />

      {summary.isPending ? (
        <DashboardSkeleton />
      ) : summary.isError || !summary.data ? (
        <p className="text-sm text-destructive">Unable to load dashboard stats</p>
      ) : summary.data.kind === 'governance' ? (
        <GovernanceDashboard data={summary.data} />
      ) : summary.data.kind === 'firm' ? (
        <FirmDashboard data={summary.data} />
      ) : summary.data.kind === 'staff' ? (
        <StaffDashboard data={summary.data} />
      ) : summary.data.kind === 'client' ? (
        <ClientDashboard data={summary.data} />
      ) : (
        <GuestDashboard data={summary.data} />
      )}
    </div>
  );
}
