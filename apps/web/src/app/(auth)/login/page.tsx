'use client';

import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AuthBrand, AuthCardFooter } from '@/components/layout/auth-brand';
import { AuthFormSkeleton } from '@/components/skeletons';
import { LoginForm } from '@/features/auth/components/login-form';

export default function LoginPage() {
  return (
    <Card>
      <CardContent className="space-y-6 p-8">
        <AuthBrand
          title="Sign in"
          subtitle="Enter your account details to access your workspace."
          hint="Welcome back to ABDC"
        />
        <Suspense fallback={<AuthFormSkeleton />}>
          <LoginForm />
        </Suspense>
        <AuthCardFooter />
      </CardContent>
    </Card>
  );
}
