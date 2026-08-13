import { Text } from '@react-email/components';
import { EmailLayout } from './email-layout';

export interface PasswordChangedEmailProps {
  appUrl?: string;
}

export function PasswordChangedEmail({ appUrl }: PasswordChangedEmailProps = {}) {
  return (
    <EmailLayout
      preview="Your ABDC Share password was changed"
      title="Password changed"
      appUrl={appUrl}
    >
      <Text style={paragraph}>Your ABDC Share password was just changed successfully.</Text>
      <Text style={paragraph}>
        If you did not make this change, contact your administrator immediately so they can secure
        your account.
      </Text>
    </EmailLayout>
  );
}

const paragraph = {
  color: '#334155',
  fontSize: '15px',
  lineHeight: '1.55',
  margin: '12px 0',
};
