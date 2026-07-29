'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthFormSkeleton } from '@/components/skeletons';
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from '@/features/auth/schemas/auth.schema';
import { useInvalidateAuth } from '@/features/auth/hooks/use-auth';
import { bffJson, BffClientError } from '@/lib/bff/client';
import { useAuthStore } from '@/store/useAuthStore';

export function ChangePasswordForm() {
  const router = useRouter();
  const invalidateAuth = useInvalidateAuth();
  const clearUser = useAuthStore((s) => s.clearUser);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  async function onSubmit(values: ChangePasswordFormValues) {
    setSubmitting(true);
    try {
      await bffJson('/api/bff/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });
      toast.success('Password updated — please sign in again');
      await bffJson('/api/bff/auth/logout', { method: 'POST' });
      clearUser();
      await invalidateAuth();
      router.replace('/login');
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Could not change password');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitting) return <AuthFormSkeleton />;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input id="currentPassword" type="password" {...form.register('currentPassword')} />
        {form.formState.errors.currentPassword && (
          <p className="text-sm text-destructive">{form.formState.errors.currentPassword.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <Input id="newPassword" type="password" {...form.register('newPassword')} />
        {form.formState.errors.newPassword && (
          <p className="text-sm text-destructive">{form.formState.errors.newPassword.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input id="confirmPassword" type="password" {...form.register('confirmPassword')} />
        {form.formState.errors.confirmPassword && (
          <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full">
        Update password
      </Button>
    </form>
  );
}
