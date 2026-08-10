'use client';

import { IconLoader2 } from '@tabler/icons-react';
import { Button, type ButtonProps } from '@/components/ui/button';

export interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
}

export function LoadingButton({ loading, disabled, children, ...props }: LoadingButtonProps) {
  return (
    <Button disabled={disabled || loading} {...props}>
      {loading ? <IconLoader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}
