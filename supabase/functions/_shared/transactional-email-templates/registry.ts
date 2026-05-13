import * as React from 'npm:react@18.3.1'
import { template as signupNotification } from './signup-notification.tsx'
import { template as supportRequest } from './support-request.tsx'
import { template as signupAcknowledgement } from './signup-acknowledgement.tsx'
import { template as accountApproved } from './account-approved.tsx'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'signup-notification': signupNotification,
  'support-request': supportRequest,
  'signup-acknowledgement': signupAcknowledgement,
  'account-approved': accountApproved,
}