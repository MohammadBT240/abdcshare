'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthFormSkeleton } from '@/components/skeletons';
import { loginSchema, type LoginFormValues } from '@/features/auth/schemas/auth.schema';
import { useInvalidateAuth } from '@/features/auth/hooks/use-auth';
import { bffJson, BffClientError } from '@/lib/bff/client';
import type { AuthUser } from '@abdcshare/api-client';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invalidateAuth = useInvalidateAuth();
  const [submitting, setSubmitting] = useState(false);
  const defaultEmail = searchParams.get('email') ?? '';

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: defaultEmail, password: '' },
  });

  async function onSubmit(values: LoginFormValues) {
    setSubmitting(true);
    try {
      const data = await bffJson<{ user: AuthUser }>('/api/bff/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      await invalidateAuth();
      if (data.user.mustChangePassword) {
        router.replace('/change-password');
      } else {
        const redirect = searchParams.get('redirect');
        router.replace(redirect && redirect.startsWith('/') ? redirect : '/dashboard');
      }
    } catch (err) {
      const msg = err instanceof BffClientError ? err.message : 'Login failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitting) return <AuthFormSkeleton />;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="current-password" {...form.register('password')} />
        {form.formState.errors.password && (
          <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        Sign in
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/forgot-password" className="text-primary hover:underline">
          Forgot password?
        </Link>
      </p>
    </form>
  );
}
