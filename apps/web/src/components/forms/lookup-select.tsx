'use client';

import { AppSelect, type AppSelectProps } from '@/components/forms/app-select';
import { useLookup } from '@/features/users/hooks/use-users';

export interface LookupSelectProps
  extends Omit<AppSelectProps, 'options' | 'isLoading'> {
  /** Reference lookup type, e.g. `titles`, `genders`, `client-types`. */
  type: string;
}

/** Data-aware select backed by `/api/reference/:type`. */
export function LookupSelect({ type, ...props }: LookupSelectProps) {
  const lookup = useLookup(type);
  const options = (lookup.data ?? []).map((row) => ({
    value: String(row.id),
    label: row.name,
  }));

  return <AppSelect {...props} options={options} isLoading={lookup.isPending} />;
}
