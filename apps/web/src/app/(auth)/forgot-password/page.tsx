import { Card, CardContent } from '@/components/ui/card';
import { AuthBrand, AuthCardFooter } from '@/components/layout/auth-brand';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardContent className="space-y-6 p-8">
        <AuthBrand
          title="Forgot password"
          subtitle="We will email reset instructions if the account exists."
        />
        <ForgotPasswordForm />
        <AuthCardFooter />
      </CardContent>
    </Card>
  );
}
