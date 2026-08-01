'use client';

import { CompanyProfileCard } from '@/features/company-profiles/components/company-profile-card';
import type { CompanyProfileRecord } from '@/features/company-profiles/hooks/use-company-profiles';

export function CompanyProfilesGrid({
  profiles,
  canManage,
  onDownload,
  onRename,
  onReplace,
  onRemove,
}: {
  profiles: CompanyProfileRecord[];
  canManage: boolean;
  onDownload: (profile: CompanyProfileRecord) => void;
  onRename: (profile: CompanyProfileRecord) => void;
  onReplace: (profile: CompanyProfileRecord) => void;
  onRemove: (profile: CompanyProfileRecord) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {profiles.map((profile) => (
        <CompanyProfileCard
          key={profile.id}
          profile={profile}
          canManage={canManage}
          onDownload={() => onDownload(profile)}
          onRename={() => onRename(profile)}
          onReplace={() => onReplace(profile)}
          onRemove={() => onRemove(profile)}
        />
      ))}
    </div>
  );
}
