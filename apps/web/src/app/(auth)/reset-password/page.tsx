'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { AuthBrand, AuthCardFooter } from '@/components/layout/auth-brand';
import { AuthFormSkeleton } from '@/components/skeletons';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  return <ResetPasswordForm token={token} />;
}

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardContent className="space-y-6 p-8">
        <AuthBrand title="Reset password" subtitle="Choose a new password for your account." />
        <Suspense fallback={<AuthFormSkeleton />}>
          <ResetPasswordInner />
        </Suspense>
        <AuthCardFooter />
      </CardContent>
    </Card>
  );
}
