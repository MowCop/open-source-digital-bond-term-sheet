/**
 * bond.ts  ·  v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop into: src/types/bond.ts
 *
 * CHANGES FROM v1.0
 * ─────────────────
 * • Deal.referenceRate added (FIX-6: FRN reference rate field).
 * • DealCheckerOverride interface added for audit-trail persistence.
 * • AuditLogEntry.action now covers 'deal_checker_override' events.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type DealStage = 'Mandate' | 'Announced' | 'Launched' | 'Books Open' | 'Books Closed' | 'Priced' | 'Settled';

export type UserRole = 'master_admin' | 'syndicate_admin' | 'vendor_user' | 'syndicate_readonly' | 'sales_readonly' | 'guest_readonly';

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

  // Party / Issuer
  issuerName: string;
  issuerLEI?: string;
  issuerRating?: string;
  ratingOutlook?: string;
  bookrunners: Bookrunner[];

  // Issuance
  issuanceType?: IssuanceType;
  currency: string;
  size: string;
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

  // Product
  isin?: string;
  cusip?: string;
  commonCode?: string;
  formOfNote?: FormOfNote;
  statusOfNote?: StatusOfNote;
  tenor: string;
  maturityDate?: string;
  interestType?: InterestType;
  interestRate?: string;
  /**
   * FIX-6: Reference rate for floating rate notes.
   * Examples: "EURIBOR", "SOFR", "SONIA", "ESTR", "3M EURIBOR".
   * If populated, interestRate may hold the all-in rate or spread notation.
   */
  referenceRate?: string;
  interestPaymentFrequency?: InterestPaymentFrequency;
  dayCountFraction?: DayCountFraction;
  businessDayConvention?: BusinessDayConvention;
  optionality?: string;
  taxonomy?: string;
}

export interface StageTransition {
  from: DealStage;
  to: DealStage;
  timestamp: Date;
  userId: string;
  note?: string;
}

// ─── Deal Checker Override audit record ──────────────────────────────────────
/**
 * Persisted whenever a Master Admin overrides a blocking Deal Checker error.
 * Store in your audit log collection, tagged with entityType: 'deal_checker_override'.
 *
 * Usage in AIDraftPage or wherever DealChecker is mounted:
 *
 *   <DealChecker
 *     ...
 *     userRole={currentUser.role}
 *     currentUserId={currentUser.id}
 *     currentUserName={currentUser.name}
 *     onAuditEntries={(entries) => {
 *       entries.forEach(e => auditLogStore.create({
 *         id: crypto.randomUUID(),
 *         action: 'deal_checker_override',
 *         entityType: 'deal_checker_override',
 *         entityId: dealId,
 *         userId: e.adminUserId,
 *         timestamp: new Date(e.timestamp),
 *         details: JSON.stringify(e),
 *       }));
 *     }}
 *   />
 */
export interface DealCheckerOverride {
  ruleId: string;
  ruleTitle: string;
  field: string;
  adminUserId: string;
  adminName: string;
  reason: string;
  dealSnapshot: Partial<Deal>;
  timestamp: string;
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
  file?: File;
  mimeType?: string;
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
  /** Extended with 'deal_checker_override' to capture Master Admin bypasses */
  action: string;
  entityType: 'deal' | 'message' | 'user' | 'permission' | 'deal_checker_override';
  entityId: string;
  userId: string;
  timestamp: Date;
  details: string;
  ipAddress?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'deal_update' | 'message_received' | 'message_retracted' | 'role_change' | 'chat_invite';
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
