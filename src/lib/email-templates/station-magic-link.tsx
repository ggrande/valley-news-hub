import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  link?: string
  siteName?: string
}

const StationMagicLinkEmail = ({
  link = 'https://wkna49.com/station/verify?token=preview',
  siteName = 'WKNA 49 Network',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your sign-in link for {siteName} (expires in 15 minutes)</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Sign in to {siteName}</Heading>
        <Text style={text}>
          Click the button below to securely access your station admin. This
          link expires in 15 minutes and can only be used once.
        </Text>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button style={button} href={link}>
            Sign in to {siteName}
          </Button>
        </Section>
        <Text style={small}>
          Or paste this link into your browser:
          <br />
          <span style={code}>{link}</span>
        </Text>
        <Text style={footer}>
          If you didn't request this link, you can safely ignore this email — no
          account was created or accessed.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: StationMagicLinkEmail,
  subject: (data) => `Sign in to ${data?.siteName ?? 'your station'}`,
  displayName: 'Station Magic Link',
  previewData: {
    link: 'https://wkna49.com/station/verify?token=preview',
    siteName: 'Fresh Test Station',
  },
} satisfies TemplateEntry

export default StationMagicLinkEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}
const container = { padding: '32px 24px', maxWidth: '560px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 700,
  color: '#0a0a0a',
  margin: '0 0 16px',
}
const text = {
  fontSize: '15px',
  color: '#3f3f46',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const small = {
  fontSize: '12px',
  color: '#71717a',
  lineHeight: '1.5',
  margin: '20px 0 0',
  wordBreak: 'break-all' as const,
}
const code = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '11px',
  color: '#52525b',
}
const button = {
  backgroundColor: '#dc2626',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600,
  borderRadius: '8px',
  padding: '12px 24px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = {
  fontSize: '12px',
  color: '#a1a1aa',
  margin: '32px 0 0',
  borderTop: '1px solid #e4e4e7',
  paddingTop: '16px',
}
