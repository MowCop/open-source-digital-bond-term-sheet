import { Deal, Message, User, AuditLogEntry, Notification, DistributionList } from '@/types/bond';

export const mockUsers: User[] = [
  { id: 'u1', name: 'Sarah Chen', email: 'sarah@globalbank.com', role: 'master_admin', organization: 'GlobalBank', organizationType: 'bank' },
  { id: 'u2', name: 'James Miller', email: 'james@globalbank.com', role: 'syndicate_admin', organization: 'GlobalBank', organizationType: 'bank' },
  { id: 'u3', name: 'Anna Schmidt', email: 'anna@eurobank.com', role: 'syndicate_admin', organization: 'EuroBank', organizationType: 'bank' },
  { id: 'u4', name: 'Mike Johnson', email: 'mike@bloomberg.com', role: 'vendor_user', organization: 'Bloomberg', organizationType: 'vendor' },
  { id: 'u5', name: 'Lisa Park', email: 'lisa@reuters.com', role: 'vendor_user', organization: 'Reuters', organizationType: 'vendor' },
  { id: 'u6', name: 'Tom Brown', email: 'tom@refinitiv.com', role: 'vendor_user', organization: 'Refinitiv', organizationType: 'vendor' },
];

export const mockDeals: Deal[] = [
  {
    id: 'd1',
    borrower: 'Republic of Italy',
    currency: 'EUR',
    size: '5,000,000,000',
    tenor: '10Y',
    coupon: '3.25%',
    spread: 'MS+85bps',
    stage: 'Books Open',
    leadManagers: ['GlobalBank', 'EuroBank'],
    createdAt: new Date('2024-03-15T08:00:00'),
    updatedAt: new Date('2024-03-18T14:30:00'),
    isin: 'IT0005580003',
    maturityDate: '2034-03-15',
    rating: 'BBB/Baa3',
    stageHistory: [
      { from: 'Mandate', to: 'Announced', timestamp: new Date('2024-03-15T10:00:00'), userId: 'u2' },
      { from: 'Announced', to: 'Launched', timestamp: new Date('2024-03-16T09:00:00'), userId: 'u2' },
      { from: 'Launched', to: 'Books Open', timestamp: new Date('2024-03-18T08:00:00'), userId: 'u2', note: 'IPT MS+90 area' },
    ],
  },
  {
    id: 'd2',
    borrower: 'Volkswagen AG',
    currency: 'EUR',
    size: '1,500,000,000',
    tenor: '5Y',
    coupon: '3.875%',
    spread: 'MS+120bps',
    stage: 'Priced',
    leadManagers: ['GlobalBank'],
    createdAt: new Date('2024-03-10T07:00:00'),
    updatedAt: new Date('2024-03-14T16:00:00'),
    rating: 'A-/A3',
    stageHistory: [
      { from: 'Mandate', to: 'Announced', timestamp: new Date('2024-03-10T08:00:00'), userId: 'u2' },
      { from: 'Announced', to: 'Launched', timestamp: new Date('2024-03-11T09:00:00'), userId: 'u2' },
      { from: 'Launched', to: 'Books Open', timestamp: new Date('2024-03-12T08:00:00'), userId: 'u2' },
      { from: 'Books Open', to: 'Books Closed', timestamp: new Date('2024-03-13T16:00:00'), userId: 'u3' },
      { from: 'Books Closed', to: 'Priced', timestamp: new Date('2024-03-14T10:00:00'), userId: 'u2', note: 'Final spread MS+120bps' },
    ],
  },
  {
    id: 'd3',
    borrower: 'Apple Inc.',
    currency: 'USD',
    size: '3,000,000,000',
    tenor: '30Y',
    coupon: 'TBD',
    spread: 'TBD',
    stage: 'Mandate',
    leadManagers: ['GlobalBank', 'EuroBank'],
    createdAt: new Date('2024-03-20T06:00:00'),
    updatedAt: new Date('2024-03-20T06:00:00'),
    rating: 'AA+/Aa1',
    stageHistory: [],
  },
];

export const mockMessages: Message[] = [
  {
    id: 'm1', dealId: 'd1', subject: 'Republic of Italy EUR 10Y - Books Open',
    body: 'Republic of Italy has opened books for a new EUR 5bn 10Y benchmark. IPT MS+90 area. Books subject to change.',
    status: 'sent', senderId: 'u2', recipients: ['u4', 'u5', 'u6'],
    attachments: [{ id: 'a1', name: 'Italy_10Y_TermSheet.pdf', type: 'pdf', size: 245000, url: '#' }],
    createdAt: new Date('2024-03-18T08:15:00'), updatedAt: new Date('2024-03-18T08:20:00'), sentAt: new Date('2024-03-18T08:20:00'),
    aiSuggestions: { headline: 'Republic of Italy EUR 10Y Benchmark - Books Open', borrowerDetails: 'Sovereign issuer, BBB/Baa3 rated', dealSummary: 'EUR 5bn 10Y at IPT MS+90 area', keyTerms: { Size: 'EUR 5bn', Tenor: '10Y', IPT: 'MS+90 area' }, confidence: 0.92 },
  },
  {
    id: 'm2', dealId: 'd1', subject: 'Republic of Italy EUR 10Y - Spread Update',
    body: 'Books over EUR 25bn. Spread revised to MS+85bps area.',
    status: 'draft', senderId: 'u2', recipients: ['u4', 'u5', 'u6'], attachments: [],
    createdAt: new Date('2024-03-18T14:00:00'), updatedAt: new Date('2024-03-18T14:00:00'),
    aiSuggestions: { headline: 'Republic of Italy EUR 10Y - Spread Tightening', borrowerDetails: 'Sovereign issuer, BBB/Baa3 rated', dealSummary: 'Spread revised to MS+85bps. Books over EUR 25bn.', keyTerms: { 'Book Size': '>EUR 25bn', 'Revised Spread': 'MS+85bps' }, confidence: 0.88 },
  },
  {
    id: 'm3', dealId: 'd2', subject: 'Volkswagen AG EUR 5Y - Priced',
    body: 'Volkswagen AG has priced its EUR 1.5bn 5Y at MS+120bps, coupon 3.875%. Books closed at EUR 4.2bn.',
    status: 'sent', senderId: 'u2', recipients: ['u4', 'u5'],
    attachments: [{ id: 'a2', name: 'VW_5Y_FinalTerms.pdf', type: 'pdf', size: 180000, url: '#' }, { id: 'a3', name: 'VW_Investor_Presentation.pptx', type: 'pptx', size: 3200000, url: '#' }],
    createdAt: new Date('2024-03-14T10:30:00'), updatedAt: new Date('2024-03-14T10:35:00'), sentAt: new Date('2024-03-14T10:35:00'),
  },
  {
    id: 'm4', dealId: 'd1', subject: 'RE: Republic of Italy EUR 10Y - Books Open',
    body: 'Thank you for the update. We have disseminated the alert. Can you confirm the minimum denomination?',
    status: 'sent', senderId: 'u4', recipients: ['u2'], attachments: [],
    createdAt: new Date('2024-03-18T08:45:00'), updatedAt: new Date('2024-03-18T08:45:00'), sentAt: new Date('2024-03-18T08:45:00'),
    threadId: 'm1', parentMessageId: 'm1',
  },
];

export const mockAuditLog: AuditLogEntry[] = [
  { id: 'al1', action: 'DEAL_CREATED', entityType: 'deal', entityId: 'd1', userId: 'u2', timestamp: new Date('2024-03-15T08:00:00'), details: 'Created deal: Republic of Italy EUR 10Y' },
  { id: 'al2', action: 'DEAL_STAGE_CHANGED', entityType: 'deal', entityId: 'd1', userId: 'u2', timestamp: new Date('2024-03-18T08:00:00'), details: 'Stage changed from Launched to Books Open' },
  { id: 'al3', action: 'MESSAGE_SENT', entityType: 'message', entityId: 'm1', userId: 'u2', timestamp: new Date('2024-03-18T08:20:00'), details: 'Sent alert: Republic of Italy EUR 10Y - Books Open to 3 vendors' },
  { id: 'al4', action: 'MESSAGE_CREATED', entityType: 'message', entityId: 'm2', userId: 'u2', timestamp: new Date('2024-03-18T14:00:00'), details: 'Draft created: Republic of Italy EUR 10Y - Spread Update' },
  { id: 'al5', action: 'USER_ROLE_CHANGED', entityType: 'user', entityId: 'u3', userId: 'u1', timestamp: new Date('2024-03-12T09:00:00'), details: 'Role changed to syndicate_admin for Anna Schmidt' },
  { id: 'al6', action: 'DEAL_PRICED', entityType: 'deal', entityId: 'd2', userId: 'u2', timestamp: new Date('2024-03-14T10:00:00'), details: 'Volkswagen AG EUR 5Y priced at MS+120bps' },
  { id: 'al7', action: 'MESSAGE_SENT', entityType: 'message', entityId: 'm3', userId: 'u2', timestamp: new Date('2024-03-14T10:35:00'), details: 'Sent pricing alert for Volkswagen AG EUR 5Y' },
];

export const mockNotifications: Notification[] = [
  { id: 'n1', userId: 'u4', type: 'message_received', title: 'New Deal Alert', body: 'Republic of Italy EUR 10Y - Books Open', read: false, timestamp: new Date('2024-03-18T08:20:00'), dealId: 'd1', messageId: 'm1' },
  { id: 'n2', userId: 'u5', type: 'deal_update', title: 'Deal Stage Updated', body: 'Volkswagen AG EUR 5Y has been priced', read: true, timestamp: new Date('2024-03-14T10:00:00'), dealId: 'd2' },
];

export const mockDistributionLists: DistributionList[] = [
  { id: 'dl1', name: 'All Vendors', vendorIds: ['u4', 'u5', 'u6'], createdBy: 'u2' },
  { id: 'dl2', name: 'Tier 1 Vendors', vendorIds: ['u4', 'u5'], createdBy: 'u2' },
];
