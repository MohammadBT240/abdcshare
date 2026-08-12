import { Text } from '@react-email/components';
import { EmailButton, EmailLayout } from './email-layout';

export interface PasswordResetEmailProps {
  resetUrl: string;
  appUrl?: string;
}

export function PasswordResetEmail({ resetUrl, appUrl }: PasswordResetEmailProps) {
  return (
    <EmailLayout
      preview="Reset your ABDC Share password"
      title="Reset your password"
      appUrl={appUrl}
    >
      <Text style={paragraph}>We received a request to reset your ABDC Share password.</Text>
      <Text style={paragraph}>
        This link expires soon. If you did not request a reset, you can safely ignore this email —
        your password will remain unchanged.
      </Text>
      <EmailButton href={resetUrl} label="Reset password" />
    </EmailLayout>
  );
}

const paragraph = {
  color: '#334155',
  fontSize: '15px',
  lineHeight: '1.55',
  margin: '12px 0',
};
