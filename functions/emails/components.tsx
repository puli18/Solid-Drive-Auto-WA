/**
 * Shared React Email building blocks, branded for Solid Drive Auto WA:
 * near-black header with the chrome logo, SDA red accent, light body, business footer.
 */
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
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';

export const BRAND = {
  black: '#0A0A0B',
  graphite: '#17181B',
  chrome: '#C9CCD1',
  red: '#D7261E',
  bg: '#F5F5F4',
  white: '#FFFFFF',
  muted: '#5F6368',
  border: '#E4E4E7',
} as const;

export interface EmailBusiness {
  name: string;
  phone: string;
  email: string;
  /** One-line address. */
  address: string;
  dealerLicenceNo?: string;
  abn?: string;
}

export interface BaseEmailProps {
  siteUrl: string;
  business: EmailBusiness;
}

const font = "'Geist', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export function Layout({
  preview,
  siteUrl,
  business,
  children,
}: BaseEmailProps & { preview: string; children: ReactNode }) {
  return (
    <Html lang="en-AU">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: BRAND.bg, margin: 0, padding: '24px 0', fontFamily: font, color: BRAND.graphite }}>
        <Container style={{ maxWidth: 600, margin: '0 auto', backgroundColor: BRAND.white, borderRadius: 12, overflow: 'hidden' }}>
          <Section style={{ backgroundColor: BRAND.black, padding: '24px 32px' }}>
            <Link href={siteUrl}>
              <Img
                src={`${siteUrl}/brand/logo-full-transparent.png`}
                alt={business.name}
                width={180}
                style={{ display: 'block', maxWidth: 180, height: 'auto' }}
              />
            </Link>
          </Section>
          <Section style={{ height: 4, backgroundColor: BRAND.red, lineHeight: '4px', fontSize: 0 }}>&nbsp;</Section>
          <Section style={{ padding: '32px 32px 8px' }}>{children}</Section>
          <Section style={{ padding: '8px 32px 32px' }}>
            <Hr style={{ borderColor: BRAND.border, margin: '24px 0 16px' }} />
            <Text style={{ fontSize: 12, lineHeight: '18px', color: BRAND.muted, margin: 0 }}>
              <strong style={{ color: BRAND.graphite }}>{business.name}</strong>
              <br />
              {business.address}
              <br />
              {business.phone} · <Link href={`mailto:${business.email}`} style={{ color: BRAND.muted }}>{business.email}</Link>
              {business.dealerLicenceNo ? (
                <>
                  <br />
                  Dealer licence {business.dealerLicenceNo}
                  {business.abn ? ` · ABN ${business.abn}` : ''}
                </>
              ) : null}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <Heading as="h1" style={{ fontSize: 24, lineHeight: '30px', fontWeight: 800, margin: '0 0 12px', color: BRAND.black }}>
      {children}
    </Heading>
  );
}

export function P({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <Text style={{ fontSize: 15, lineHeight: '24px', margin: '0 0 14px', color: muted ? BRAND.muted : BRAND.graphite }}>
      {children}
    </Text>
  );
}

/** Label / value table. Empty values are skipped. */
export function Details({ rows }: { rows: [string, ReactNode | null | undefined][] }) {
  return (
    <Section style={{ border: `1px solid ${BRAND.border}`, borderRadius: 8, padding: '8px 16px', margin: '8px 0 20px' }}>
      {rows
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([label, value]) => (
          <Row key={label} style={{ padding: '6px 0' }}>
            <Column style={{ width: '40%', fontSize: 13, color: BRAND.muted, verticalAlign: 'top', paddingRight: 8 }}>{label}</Column>
            <Column style={{ fontSize: 14, color: BRAND.graphite, fontWeight: 600, verticalAlign: 'top' }}>{value}</Column>
          </Row>
        ))}
    </Section>
  );
}

export function Cta({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section style={{ margin: '4px 0 20px' }}>
      <Button
        href={href}
        style={{
          backgroundColor: BRAND.red,
          color: BRAND.white,
          fontSize: 15,
          fontWeight: 700,
          padding: '12px 22px',
          borderRadius: 8,
          textDecoration: 'none',
          display: 'inline-block',
        }}
      >
        {children}
      </Button>
    </Section>
  );
}

/** Highlighted notice box (non-refundable terms, conflicts). */
export function Notice({ children, tone = 'red' }: { children: ReactNode; tone?: 'red' | 'grey' }) {
  return (
    <Section
      style={{
        borderLeft: `4px solid ${tone === 'red' ? BRAND.red : BRAND.chrome}`,
        backgroundColor: tone === 'red' ? '#FDF2F1' : BRAND.bg,
        padding: '12px 16px',
        margin: '8px 0 20px',
        borderRadius: 4,
      }}
    >
      <Text style={{ fontSize: 14, lineHeight: '22px', margin: 0, color: BRAND.graphite }}>{children}</Text>
    </Section>
  );
}
