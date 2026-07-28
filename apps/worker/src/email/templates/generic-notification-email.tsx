import { Text } from '@react-email/components';
import { EmailButton, EmailLayout } from './email-layout';

export interface GenericNotificationEmailProps {
  title: string;
  body: string;
  link?: string;
}

export function GenericNotificationEmail({ title, body, link }: GenericNotificationEmailProps) {
  return (
    <EmailLayout preview={title} title={title}>
      <Text>{body}</Text>
      {link ? <EmailButton href={link} label="Open in ABDC Share" /> : null}
    </EmailLayout>
  );
}
