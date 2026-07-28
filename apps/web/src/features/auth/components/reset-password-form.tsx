'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthFormSkeleton } from '@/components/skeletons';
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from '@/features/auth/schemas/auth.schema';
import { bffJson, BffClientError } from '@/lib/bff/client';

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  async function onSubmit(values: ResetPasswordFormValues) {
    setSubmitting(true);
    try {
      await bffJson('/api/bff/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: values.newPassword }),
      });
      toast.success('Password reset — you can sign in now');
      router.replace('/login');
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Reset failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <p className="text-center text-sm text-destructive">
        Invalid reset link.{' '}
        <Link href="/forgot-password" className="underline">
          Request a new one
        </Link>
      </p>
    );
  }

  if (submitting) return <AuthFormSkeleton />;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <Input id="newPassword" type="password" {...form.register('newPassword')} />
        {form.formState.errors.newPassword && (
          <p className="text-sm text-destructive">{form.formState.errors.newPassword.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input id="confirmPassword" type="password" {...form.register('confirmPassword')} />
        {form.formState.errors.confirmPassword && (
          <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full">
        Reset password
      </Button>
    </form>
  );
}
