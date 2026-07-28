import { Text } from '@react-email/components';
import { EmailButton, EmailLayout } from './email-layout';

export interface AccountCreatedEmailProps {
  email: string;
  tempPassword: string;
  loginUrl: string;
}

export function AccountCreatedEmail({ email, tempPassword, loginUrl }: AccountCreatedEmailProps) {
  return (
    <EmailLayout preview="Your ABDC Share account is ready" title="Your account is ready">
      <Text>An account was created for you on ABDC Share.</Text>
      <Text>
        <strong>Username:</strong> {email}
        <br />
        <strong>Temporary password:</strong> {tempPassword}
      </Text>
      <Text>Sign in and you will be prompted to set a new password before continuing.</Text>
      <EmailButton href={loginUrl} label="Sign in" />
    </EmailLayout>
  );
}
