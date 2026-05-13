import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props { name?: string; role?: string; loginUrl?: string }

export const AccountApprovedEmail = ({
  name = 'there',
  role,
  loginUrl = 'https://eurobondmarkets.com/auth',
}: Props) => (
  <Html>
    <Head />
    <Preview>Your BondVDR access has been approved</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
      <Container style={{ padding: '24px', maxWidth: '560px' }}>
        <Heading style={{ fontSize: '20px', color: '#0f172a' }}>You're in, {name}</Heading>
        <Text style={{ fontSize: '14px', color: '#334155', lineHeight: '1.55' }}>
          Your BondVDR account has been approved by the project administrator
          {role ? <> and assigned the <strong>{role}</strong> role</> : null}. You can now sign in and start using the platform.
        </Text>
        <Section style={{ marginTop: '20px' }}>
          <Button
            href={loginUrl}
            style={{
              backgroundColor: '#0f172a',
              color: '#ffffff',
              padding: '12px 20px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Sign in to BondVDR
          </Button>
        </Section>
        <Text style={{ fontSize: '12px', color: '#64748b', marginTop: '24px' }}>
          If the button does not work, copy and paste this URL into your browser:{' '}
          <span style={{ color: '#0f172a' }}>{loginUrl}</span>
        </Text>
        <Text style={{ fontSize: '12px', color: '#64748b', marginTop: '12px' }}>— The BondVDR team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AccountApprovedEmail,
  subject: 'Your BondVDR access has been approved',
  displayName: 'Account approved',
  previewData: { name: 'Jane Doe', role: 'syndicate_readonly', loginUrl: 'https://eurobondmarkets.com/auth' },
} satisfies TemplateEntry
