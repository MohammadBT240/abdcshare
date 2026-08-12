'use client';

import { Suspense } from 'react';
import { AuthBrand } from '@/components/layout/auth-brand';
import { AuthFormSkeleton } from '@/components/skeletons';
import { LoginForm } from '@/features/auth/components/login-form';

export default function LoginPage() {
  return (
    <div className="space-y-8">
      <AuthBrand
        title="Sign in"
        subtitle="Enter your account details to access your workspace."
      />
      <Suspense fallback={<AuthFormSkeleton />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
