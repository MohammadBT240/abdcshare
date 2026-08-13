import { Text } from '@react-email/components';
import {
  EmailButton,
  EmailDetailPanel,
  EmailDetailRow,
  EmailLayout,
} from './email-layout';

export interface AccountCreatedEmailProps {
  email: string;
  tempPassword: string;
  loginUrl: string;
  appUrl?: string;
}

export function AccountCreatedEmail({
  email,
  tempPassword,
  loginUrl,
  appUrl,
}: AccountCreatedEmailProps) {
  return (
    <EmailLayout
      preview="Your ABDC Share account is ready"
      title="Your account is ready"
      appUrl={appUrl}
    >
      <Text style={paragraph}>
        An account was created for you on ABDC Share. Use the details below to sign in for the
        first time.
      </Text>
      <EmailDetailPanel>
        <EmailDetailRow label="Username" value={email} />
        <EmailDetailRow label="Temporary password" value={tempPassword} />
      </EmailDetailPanel>
      <Text style={paragraph}>
        After you sign in, you will be prompted to set a new password before continuing to your
        workspace.
      </Text>
      <EmailButton href={loginUrl} label="Sign in to ABDC Share" />
    </EmailLayout>
  );
}

const paragraph = {
  color: '#334155',
  fontSize: '15px',
  lineHeight: '1.55',
  margin: '12px 0',
};
