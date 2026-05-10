export type DealStage = 'Mandate' | 'Announced' | 'Launched' | 'Books Open' | 'Books Closed' | 'Priced' | 'Settled';

export type UserRole = 'master_admin' | 'syndicate_admin' | 'vendor_user' | 'syndicate_readonly' | 'sales_readonly';

export type UserCategory = 'Vendor' | 'Syndicate' | 'Buy Side' | 'Legal' | 'Guest' | 'DCM' | 'Sales';

export type MessageStatus = 'draft' | 'pending_review' | 'confirmed' | 'sent' | 'retracted';

// ICMA Taxonomy Enums
export type IssuanceType = 'STANDALONE' | 'PROGRAMME';
export type FormOfNote = 'BEARER_GLOBAL' | 'REGISTERED' | 'DEMATERIALISED';
export type StatusOfNote = 'SENIOR_UNSECURED' | 'SENIOR_SECURED' | 'SUBORDINATED' | 'JUNIOR_SUBORDINATED' | 'COVERED';
export type InterestType = 'FIXED' | 'FLOATING' | 'ZERO_COUPON';
export type InterestPaymentFrequency = 'ANNUAL' | 'SEMI_ANNUAL' | 'QUARTERLY' | 'MONTHLY';
export type DayCountFraction = 'ACT_ACT' | 'ACT_360' | 'ACT_365' | '30_360' | '30E_360';
export type BusinessDayConvention = 'MODIFIED_FOLLOWING' | 'FOLLOWING' | 'PRECEDING';
export type GoverningLaw = 'ENGLISH_LAW' | 'FRENCH_LAW' | 'GERMAN_LAW' | 'NEW_YORK_LAW' | 'SWISS_LAW';
export type BookrunnerRole = 'active' | 'passive';

export interface Bookrunner {
  name: string;
  role: BookrunnerRole;
  isGlobalCoordinator: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  organization: string;
  organizationType: 'bank' | 'vendor';
  category?: UserCategory;
  createdAt?: Date;
  createdBy?: string;
  createdByOrg?: string;
}

export interface Deal {
  id: string;
  stage: DealStage;
  createdAt: Date;
  updatedAt: Date;
  stageHistory: StageTransition[];
  createdByOrg?: string;

  // Party / Issuer (5 fields)
  issuerName: string;        // borrower / PartyName ISSUER
  issuerLEI?: string;
  issuerRating?: string;     // e.g. "BBB/Baa3/BBB Fitch"
  ratingOutlook?: string;    // STABLE / POSITIVE / NEGATIVE
  bookrunners: Bookrunner[];

  // Issuance (16 fields)
  issuanceType?: IssuanceType;
  currency: string;
  size: string;              // AggregateNominalAmount
  specifiedDenomination?: string;
  pricingDate?: string;
  issueDate?: string;
  settlementDate?: string;
  issuePrice?: string;
  reofferPrice?: string;
  reofferYield?: string;
  reofferSpread?: string;
  midSwapRate?: string;
  coupon: string;
  governingLaw?: GoverningLaw;
  sellingRestrictions?: string;
  listingVenue?: string;

  // Product (14 fields)
  isin?: string;
  cusip?: string;
  commonCode?: string;
  formOfNote?: FormOfNote;
  statusOfNote?: StatusOfNote;
  tenor: string;
  maturityDate?: string;
  interestType?: InterestType;
  interestRate?: string;
  interestPaymentFrequency?: InterestPaymentFrequency;
  dayCountFraction?: DayCountFraction;
  businessDayConvention?: BusinessDayConvention;
  optionality?: string;      // CALL / PUT / NONE
  taxonomy?: string;         // ESG/Green/Social label
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
  dealIds: string[];
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
  memberIds: string[];
  vendorIds: string[];
  createdBy: string;
  createdByOrg?: string;
  lastUsed?: Date;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  dealId?: string;
  senderId: string;
  senderName: string;
  senderType: 'bank' | 'vendor' | 'system';
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
