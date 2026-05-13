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
  name?: string
  email?: string
  subject?: string
  message?: string
  submittedAt?: string
}

export const SupportRequestEmail = ({
  name = 'Unknown',
  email = 'unknown@example.com',
  subject = '(no subject)',
  message = '',
  submittedAt = new Date().toISOString(),
}: Props) => (
  <Html>
    <Head />
    <Preview>Support request from {name}: {subject}</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
      <Container style={{ padding: '24px', maxWidth: '560px' }}>
        <Heading style={{ fontSize: '20px', color: '#0f172a' }}>
          New support request
        </Heading>
        <Text style={{ fontSize: '14px', color: '#334155' }}>
          A user submitted the contact-support form on BondVDR / eurobondmarkets.com.
          Reply directly to this email to respond to the submitter.
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
            <strong>From:</strong> {name} &lt;{email}&gt;
          </Text>
          <Text style={{ margin: '4px 0', fontSize: '14px' }}>
            <strong>Subject:</strong> {subject}
          </Text>
          <Text style={{ margin: '4px 0', fontSize: '14px' }}>
            <strong>Submitted at:</strong> {submittedAt}
          </Text>
        </Section>
        <Section
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            padding: '16px',
            marginTop: '16px',
          }}
        >
          <Text style={{ fontSize: '12px', color: '#64748b', margin: '0 0 8px' }}>
            Message
          </Text>
          <Text
            style={{
              fontSize: '14px',
              color: '#0f172a',
              whiteSpace: 'pre-wrap',
              margin: 0,
            }}
          >
            {message}
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SupportRequestEmail,
  subject: (data: Props) => `[BondVDR Support] ${data?.subject ?? '(no subject)'}`,
  displayName: 'Support request',
  to: 'karl.mallalieu@gmail.com',
  previewData: {
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    subject: 'Cannot access my deal room',
    message: 'Hi, I signed up yesterday but still cannot see the deal I was invited to.',
    submittedAt: new Date().toISOString(),
  },
} satisfies TemplateEntry