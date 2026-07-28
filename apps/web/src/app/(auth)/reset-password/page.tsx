'use client';

import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthFormSkeleton } from '@/components/skeletons';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';
import { useSearchParams } from 'next/navigation';

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  return <ResetPasswordForm token={token} />;
}

export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">abdcshare</h1>
        <p className="mt-1 text-sm text-muted-foreground">ABDC Practice Portal</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Reset password</CardTitle>
          <CardDescription>Choose a new password for your account</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<AuthFormSkeleton />}>
            <ResetPasswordInner />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
