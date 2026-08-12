import { Text } from '@react-email/components';
import { EmailButton, EmailLayout } from './email-layout';

export interface GenericNotificationEmailProps {
  title: string;
  body: string;
  link?: string;
  appUrl?: string;
}

export function GenericNotificationEmail({
  title,
  body,
  link,
  appUrl,
}: GenericNotificationEmailProps) {
  return (
    <EmailLayout preview={title} title={title} appUrl={appUrl}>
      <Text style={paragraph}>{body}</Text>
      {link ? <EmailButton href={link} label="Open in ABDC Share" /> : null}
    </EmailLayout>
  );
}

const paragraph = {
  color: '#334155',
  fontSize: '15px',
  lineHeight: '1.55',
  margin: '12px 0',
};
