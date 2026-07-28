import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';

export interface EmailLayoutProps {
  preview: string;
  title: string;
  children: ReactNode;
}

/** Shared transactional email shell for ABDC Share. */
export function EmailLayout({ preview, title, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={brand}>ABDC Share</Heading>
            <Text style={subtitle}>{title}</Text>
          </Section>
          <Section style={content}>{children}</Section>
          <Hr style={hr} />
          <Text style={footer}>This message was sent by ABDC Share. Please do not reply.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailButton({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} style={button}>
      {label}
    </Link>
  );
}

const body = {
  backgroundColor: '#f4f6f8',
  fontFamily: 'Arial, Helvetica, sans-serif',
  margin: 0,
  padding: '24px 0',
};

const container = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  margin: '0 auto',
  maxWidth: '560px',
  padding: '24px',
};

const header = { marginBottom: '16px' };

const brand = {
  color: '#14532d',
  fontSize: '22px',
  fontWeight: 700,
  margin: '0 0 4px',
};

const subtitle = {
  color: '#374151',
  fontSize: '16px',
  margin: 0,
};

const content = {
  color: '#111827',
  fontSize: '15px',
  lineHeight: '1.5',
};

const button = {
  backgroundColor: '#14532d',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: 600,
  marginTop: '16px',
  padding: '12px 18px',
  textDecoration: 'none',
};

const hr = { borderColor: '#e5e7eb', margin: '24px 0 16px' };

const footer = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '1.4',
  margin: 0,
};
