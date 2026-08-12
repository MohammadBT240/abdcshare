import { AuthBrand } from '@/components/layout/auth-brand';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-8">
      <AuthBrand
        title="Forgot password"
        subtitle="We will email reset instructions if the account exists."
      />
      <ForgotPasswordForm />
    </div>
  );
}
