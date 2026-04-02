export type DealStage = 'Mandate' | 'Announced' | 'Launched' | 'Books Open' | 'Books Closed' | 'Priced' | 'Settled';

export type UserRole = 'master_admin' | 'syndicate_admin' | 'vendor_user';

export type MessageStatus = 'draft' | 'pending_review' | 'confirmed' | 'sent' | 'retracted';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organization: string;
  organizationType: 'bank' | 'vendor';
}

export interface Deal {
  id: string;
  borrower: string;
  currency: string;
  size: string;
  tenor: string;
  coupon: string;
  spread: string;
  stage: DealStage;
  leadManagers: string[];
  createdAt: Date;
  updatedAt: Date;
  stageHistory: StageTransition[];
  isin?: string;
  maturityDate?: string;
  rating?: string;
}

export interface StageTransition {
  from: DealStage;
  to: DealStage;
  timestamp: Date;
  userId: string;
  note?: string;
}

export interface Message {
  id: string;
  dealId: string;
  subject: string;
  body: string;
  status: MessageStatus;
  senderId: string;
  recipients: string[];
  attachments: Attachment[];
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
  retractedAt?: Date;
  retractedBy?: string;
  threadId?: string;
  parentMessageId?: string;
  aiSuggestions?: AISuggestion;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'pptx';
  size: number;
  url: string;
}

export interface AISuggestion {
  headline: string;
  borrowerDetails: string;
  dealSummary: string;
  keyTerms: Record<string, string>;
  confidence: number;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: 'deal' | 'message' | 'user' | 'permission';
  entityId: string;
  userId: string;
  timestamp: Date;
  details: string;
  ipAddress?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'deal_update' | 'message_received' | 'message_retracted' | 'role_change';
  title: string;
  body: string;
  read: boolean;
  timestamp: Date;
  dealId?: string;
  messageId?: string;
}

export interface DistributionList {
  id: string;
  name: string;
  vendorIds: string[];
  createdBy: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  body: string;
  attachments: Attachment[];
  linkedMessageId?: string;
  timestamp: Date;
}

export interface ChatChannel {
  id: string;
  participantIds: string[];
  dealId?: string;
  label: string;
  createdAt: Date;
}
