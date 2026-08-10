import { Card, CardContent } from '@/components/ui/card';
import { AuthBrand, AuthCardFooter } from '@/components/layout/auth-brand';
import { ChangePasswordForm } from '@/features/auth/components/change-password-form';

export default function ChangePasswordPage() {
  return (
    <Card>
      <CardContent className="space-y-6 p-8">
        <AuthBrand
          title="Change password"
          subtitle="Set a new password before continuing to your workspace."
        />
        <ChangePasswordForm />
        <AuthCardFooter />
      </CardContent>
    </Card>
  );
}
