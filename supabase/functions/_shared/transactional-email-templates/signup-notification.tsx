import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  email?: string
  name?: string
  organization?: string
  signedUpAt?: string
}

export const SignupNotificationEmail = ({
  email = 'unknown@example.com',
  name = 'Unknown',
  organization = 'Unknown',
  signedUpAt = new Date().toISOString(),
}: Props) => (
  <Html>
    <Head />
    <Preview>New BondVDR signup: {email}</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
      <Container style={{ padding: '24px', maxWidth: '560px' }}>
        <Heading style={{ fontSize: '20px', color: '#0f172a' }}>
          New user signup
        </Heading>
        <Text style={{ fontSize: '14px', color: '#334155' }}>
          A new user has just created an account on BondVDR and is pending review.
        </Text>
        <Section
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            padding: '16px',
            marginTop: '16px',
          }}
        >
          <Text style={{ margin: '4px 0', fontSize: '14px' }}>
            <strong>Email:</strong> {email}
          </Text>
          <Text style={{ margin: '4px 0', fontSize: '14px' }}>
            <strong>Name:</strong> {name}
          </Text>
          <Text style={{ margin: '4px 0', fontSize: '14px' }}>
            <strong>Organization:</strong> {organization}
          </Text>
          <Text style={{ margin: '4px 0', fontSize: '14px' }}>
            <strong>Signed up at:</strong> {signedUpAt}
          </Text>
        </Section>
        <Text style={{ fontSize: '12px', color: '#64748b', marginTop: '24px' }}>
          Review and approve in the User Admin area of BondVDR.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SignupNotificationEmail,
  subject: (data: Props) => `New BondVDR signup: ${data?.email ?? 'unknown'}`,
  displayName: 'Signup Notification',
  // No fixed `to`: the caller (notify-author-on-signup) picks the recipient —
  // karl.mallalieu@gmail.com primary, karl@eurobondmarkets.com fallback.
  previewData: {
    email: 'jane.doe@example.com',
    name: 'Jane Doe',
    organization: 'Example Bank',
    signedUpAt: new Date().toISOString(),
  },
} satisfies TemplateEntry