import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">abdcshare</h1>
        <p className="mt-1 text-sm text-muted-foreground">ABDC Practice Portal</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Forgot password</CardTitle>
          <CardDescription>We will email reset instructions if the account exists</CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
