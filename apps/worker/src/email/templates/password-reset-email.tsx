import { Text } from '@react-email/components';
import { EmailButton, EmailLayout } from './email-layout';

export interface PasswordResetEmailProps {
  resetUrl: string;
}

export function PasswordResetEmail({ resetUrl }: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Reset your ABDC Share password" title="Reset your password">
      <Text>We received a request to reset your ABDC Share password.</Text>
      <Text>This link expires soon. If you did not request a reset, you can ignore this email.</Text>
      <EmailButton href={resetUrl} label="Reset password" />
    </EmailLayout>
  );
}
