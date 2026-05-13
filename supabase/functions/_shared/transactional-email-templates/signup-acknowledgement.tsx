import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props { name?: string; organization?: string }

export const SignupAcknowledgementEmail = ({ name = 'there', organization }: Props) => (
  <Html>
    <Head />
    <Preview>We received your BondVDR access request</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
      <Container style={{ padding: '24px', maxWidth: '560px' }}>
        <Heading style={{ fontSize: '20px', color: '#0f172a' }}>Thanks, {name}</Heading>
        <Text style={{ fontSize: '14px', color: '#334155', lineHeight: '1.55' }}>
          We have received your request to access BondVDR{organization ? ` on behalf of ${organization}` : ''}.
        </Text>
        <Section style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px', marginTop: '12px' }}>
          <Text style={{ margin: 0, fontSize: '14px', color: '#0f172a' }}>
            Your account is <strong>pending review</strong> by the project administrator. You will receive a separate
            email as soon as your access has been approved.
          </Text>
        </Section>
        <Text style={{ fontSize: '12px', color: '#64748b', marginTop: '20px' }}>
          If you did not request this account, you can safely ignore this email.
        </Text>
        <Text style={{ fontSize: '12px', color: '#64748b', marginTop: '12px' }}>
          — The BondVDR team
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SignupAcknowledgementEmail,
  subject: 'Your BondVDR access request has been received',
  displayName: 'Signup acknowledgement',
  previewData: { name: 'Jane Doe', organization: 'Acme Capital' },
} satisfies TemplateEntry
