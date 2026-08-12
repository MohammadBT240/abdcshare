import { AuthBrand } from '@/components/layout/auth-brand';
import { ChangePasswordForm } from '@/features/auth/components/change-password-form';

export default function ChangePasswordPage() {
  return (
    <div className="space-y-8">
      <AuthBrand
        title="Change password"
        subtitle="Set a new password before continuing to your workspace."
      />
      <ChangePasswordForm />
    </div>
  );
}
