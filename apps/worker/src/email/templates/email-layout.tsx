import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';

export interface EmailLayoutProps {
  preview: string;
  title: string;
  /** Absolute web app origin for logo + links (e.g. https://abdcshare.com). */
  appUrl?: string;
  children: ReactNode;
}

function resolveAppUrl(appUrl?: string): string {
  const raw = appUrl ?? process.env.WEB_APP_URL ?? 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

/** Shared brand-forward transactional shell for ABDC Share. */
export function EmailLayout({ preview, title, appUrl, children }: EmailLayoutProps) {
  const base = resolveAppUrl(appUrl);
  const logoSrc = `${base}/logos/abdc_logo_email.png`;

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Row>
              <Column style={logoCol}>
                <Img
                  src={logoSrc}
                  width="48"
                  height="48"
                  alt="Abdulkadeer & Co."
                  style={logo}
                />
              </Column>
              <Column style={brandCol}>
                <Text style={firmName}>Abdulkadeer &amp; Co.</Text>
                <Text style={productName}>ABDC Share</Text>
              </Column>
            </Row>
          </Section>

          <Section style={titleSection}>
            <Heading as="h1" style={titleHeading}>
              {title}
            </Heading>
          </Section>

          <Section style={content}>{children}</Section>

          <Hr style={hr} />

          <Section style={footerSection}>
            <Text style={footerFirm}>Abdulkadeer &amp; Co. (Chartered Accountants)</Text>
            <Text style={footerNote}>
              This message was sent by ABDC Share. Please do not reply to this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailButton({ href, label }: { href: string; label: string }) {
  return (
    <Button href={href} style={button}>
      {label}
    </Button>
  );
}

/** Muted inset panel for credentials or key/value details. */
export function EmailDetailPanel({ children }: { children: ReactNode }) {
  return <Section style={detailPanel}>{children}</Section>;
}

export function EmailDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Text style={detailRow}>
      <span style={detailLabel}>{label}</span>
      <br />
      <span style={detailValue}>{value}</span>
    </Text>
  );
}

const body = {
  backgroundColor: '#f3f5f4',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: 0,
  padding: '32px 12px',
};

const container = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8e5',
  borderRadius: '12px',
  margin: '0 auto',
  maxWidth: '560px',
  padding: '0 0 8px',
};

const header = {
  backgroundColor: '#f8faf9',
  borderBottom: '1px solid #e2e8e5',
  borderRadius: '12px 12px 0 0',
  padding: '20px 28px',
};

const logoCol = {
  width: '56px',
  verticalAlign: 'middle' as const,
};

const brandCol = {
  verticalAlign: 'middle' as const,
  paddingLeft: '12px',
};

const logo = {
  borderRadius: '50%',
  display: 'block',
  border: '1px solid #e2e8e5',
};

const firmName = {
  color: '#14532d',
  fontSize: '16px',
  fontWeight: 700,
  lineHeight: '1.3',
  margin: '0 0 2px',
};

const productName = {
  color: '#64748b',
  fontSize: '12px',
  fontWeight: 500,
  letterSpacing: '0.04em',
  lineHeight: '1.2',
  margin: 0,
  textTransform: 'uppercase' as const,
};

const titleSection = {
  padding: '28px 28px 0',
};

const titleHeading = {
  color: '#0f172a',
  fontSize: '22px',
  fontWeight: 700,
  lineHeight: '1.3',
  margin: 0,
};

const content = {
  color: '#334155',
  fontSize: '15px',
  lineHeight: '1.55',
  padding: '8px 28px 8px',
};

const button = {
  backgroundColor: '#14532d',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: 600,
  lineHeight: '1',
  marginTop: '8px',
  padding: '14px 22px',
  textDecoration: 'none',
};

const detailPanel = {
  backgroundColor: '#f8faf9',
  border: '1px solid #e2e8e5',
  borderRadius: '8px',
  margin: '16px 0',
  padding: '4px 16px',
};

const detailRow = {
  color: '#0f172a',
  fontSize: '14px',
  lineHeight: '1.45',
  margin: '12px 0',
};

const detailLabel = {
  color: '#64748b',
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.02em',
  textTransform: 'uppercase' as const,
};

const detailValue = {
  color: '#0f172a',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: '14px',
  fontWeight: 600,
};

const hr = {
  borderColor: '#e2e8e5',
  borderTop: '1px solid #e2e8e5',
  margin: '20px 28px 12px',
};

const footerSection = {
  padding: '0 28px 20px',
};

const footerFirm = {
  color: '#475569',
  fontSize: '12px',
  fontWeight: 600,
  lineHeight: '1.4',
  margin: '0 0 4px',
};

const footerNote = {
  color: '#94a3b8',
  fontSize: '12px',
  lineHeight: '1.4',
  margin: 0,
};
