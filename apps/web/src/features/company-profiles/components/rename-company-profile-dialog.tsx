'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FormDialog, FormField, LoadingButton } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BffClientError } from '@/lib/bff/client';
import {
  useRenameCompanyProfile,
  type CompanyProfileRecord,
} from '@/features/company-profiles/hooks/use-company-profiles';

export function RenameCompanyProfileDialog({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: CompanyProfileRecord | null;
}) {
  const rename = useRenameCompanyProfile();
  const [name, setName] = useState('');

  useEffect(() => {
    if (profile) setName(profile.name);
  }, [profile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !name.trim()) return;
    try {
      await rename.mutateAsync({ id: profile.id, name: name.trim() });
      toast.success('Renamed');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Rename failed');
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Rename company profile"
      maxWidthClass="sm:max-w-md"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            form="rename-company-profile-form"
            loading={rename.isPending}
            disabled={!name.trim()}
          >
            Save
          </LoadingButton>
        </>
      }
    >
      <form id="rename-company-profile-form" onSubmit={handleSubmit}>
        <FormField label="Name" required htmlFor="rename-company-profile-name">
          <Input
            id="rename-company-profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={255}
          />
        </FormField>
      </form>
    </FormDialog>
  );
}
