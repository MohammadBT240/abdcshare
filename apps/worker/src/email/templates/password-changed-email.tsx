import { Text } from '@react-email/components';
import { EmailLayout } from './email-layout';

export function PasswordChangedEmail() {
  return (
    <EmailLayout preview="Your ABDC Share password was changed" title="Password changed">
      <Text>Your ABDC Share password was just changed.</Text>
      <Text>If this was not you, contact your administrator immediately.</Text>
    </EmailLayout>
  );
}
