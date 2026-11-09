import { validateConnectivity, sanitizeConnectivity, type ConnectivityProfile } from './connectivity';

/**
 * Bond Console connector catalogue.
 *
 * Rows are presentation-only unless they carry a `url`: a `url` row is a real,
 * live external link (opened in a new tab), never a demo toggle. Commercial
 * vendor feeds stay "Not connected" until licensed access exists.
 */

export interface VendorAPI {
  id: string;
  name: string;
  category: string;
  description: string;
  status: 'connected' | 'available';
  /** Live external link. When present the row renders as a clickable label. */
  url?: string;
  /** How deal data moves: push to the venue, pull/enrichment, or email distribution. */
  direction?: ConnectorDirection;
  /** How the vendor is connected (record only; secret names, never values). */
  connectivity?: ConnectivityProfile[];
}

export type ConnectorDirection = 'push' | 'pull' | 'email';
export const CONNECTOR_DIRECTIONS: ConnectorDirection[] = ['push', 'pull', 'email'];

export const EDGAR_424B_URL =
  'https://www.sec.gov/cgi-bin/browse-edgar?company=&CIK=&type=424B&owner=include&count=20&action=getcurrent';

export const VENDOR_APIS: VendorAPI[] = [
  { id: 'bloomberg', name: 'Bloomberg Terminal', category: 'Market Data', description: 'BLOOMBERG <GO> · FIT, ALLQ, MSG1', status: 'connected' },
  { id: 'refinitiv', name: 'Refinitiv Eikon / LSEG Workspace', category: 'Market Data', description: 'IFR new issue feed & pricing', status: 'connected' },
  { id: 'ice', name: 'ICE Data Services', category: 'Market Data', description: 'Reference data & evaluated pricing', status: 'available' },
  { id: 'sp', name: 'S&P Global Market Intelligence', category: 'Ratings & Data', description: 'Ratings, RatingsDirect, CapitalIQ', status: 'available' },
  { id: 'moodys', name: "Moody's Analytics", category: 'Ratings & Data', description: 'Credit ratings and research', status: 'available' },
  { id: 'fitch', name: 'Fitch Ratings', category: 'Ratings & Data', description: 'Issuer & instrument ratings', status: 'available' },
  { id: 'tradeweb', name: 'Tradeweb', category: 'Trading Venue', description: 'AiPrice, NIIP, EU MTF connectivity', status: 'available' },
  { id: 'marketaxess', name: 'MarketAxess', category: 'Trading Venue', description: 'Open Trading & RFQ APIs', status: 'available' },
  { id: 'bondcliq', name: 'BondCliQ', category: 'Trading Venue', description: 'Consolidated corporate bond quotes', status: 'available' },
  { id: 'euroclear', name: 'Euroclear', category: 'Settlement & Custody', description: 'CSDR, EasyWay & post-trade', status: 'connected' },
  { id: 'clearstream', name: 'Clearstream', category: 'Settlement & Custody', description: 'PMI/D7 API: ISIN and instrument data (XS ISINs)', status: 'available' },
  { id: 'dtcc', name: 'DTCC', category: 'Settlement & Custody', description: 'US municipal new issues (NIIDS)', status: 'available' },
  { id: 'icma', name: 'ICMA New Issue Process', category: 'Industry & Standards', description: 'NIP and Bond Data Taxonomy', status: 'connected' },
  { id: 'anna', name: 'ANNA DSB', category: 'Industry & Standards', description: 'OTC derivatives ISINs only, not a bond ISIN source', status: 'available' },
  { id: 'xs-isin', name: 'Euroclear / Clearstream XS ISIN allocation', category: 'Industry & Standards', description: 'XS ISIN requests with instrument data to the ICSDs', status: 'available' },
  { id: 'cusip', name: 'CUSIP Global Services', category: 'Industry & Standards', description: 'CUSIP allocation API', status: 'available' },
  { id: 'ipreo', name: 'S&P Global IssueNet / InvestorAccess', category: 'Syndicate Tools', description: 'Bookbuilding sync across syndicate banks; DealServices API and FIX', status: 'available' },
  { id: 'symphony', name: 'Symphony Messaging', category: 'Communications', description: 'Compliant chat bridge', status: 'connected' },
  { id: 'finsight', name: 'Finsight', category: 'Market Data', description: 'Capital markets deal data & analytics', status: 'available' },
  { id: '9fin', name: '9fin (Bond Radar)', category: 'Market Data', description: 'High yield & leveraged finance intelligence', status: 'available' },
  { id: 'globalcapital', name: 'GlobalCapital', category: 'Market Data', description: 'New issue news feeds', status: 'available' },
  { id: 'igm', name: 'IGM', category: 'News & Wires', description: 'Capital markets intelligence & commentary', status: 'available' },
  { id: 'octus', name: 'Octus', category: 'News & Wires', description: 'Credit news, restructurings & distressed intelligence', status: 'available' },
  { id: 'dealologic', name: 'Dealogic (ION Group)', category: 'Syndicate Tools', description: 'Syndicate workflow (DealManager) and Primary Market Deals feed', status: 'available' },
  { id: 'cbonds', name: 'Cbonds', category: 'Market Data', description: 'Global bond database & pricing', status: 'available' },
  { id: 'factset', name: 'FactSet', category: 'Market Data', description: 'Reference data & fixed income analytics', status: 'available' },
  { id: 'dowjones', name: 'Dow Jones', category: 'News & Wires', description: 'Newswires: Dow Jones, WSJ, MarketWatch', status: 'available' },
  { id: 'origin', name: 'Origin Markets', category: 'Syndicate Tools', description: 'Digital bond issuance & investor platform', status: 'available' },
  { id: 'directbooks', name: 'DirectBooks', category: 'Syndicate Tools', description: 'Investor distribution & e-delivery', status: 'available' },
  { id: 'debtwire', name: 'Debtwire (ION)', category: 'News & Wires', description: 'New issue distribution by email', status: 'available' },
  { id: 'kanganews', name: 'KangaNews', category: 'News & Wires', description: 'New issue distribution by email', status: 'available' },
  { id: 'mni', name: 'MNI Market News', category: 'News & Wires', description: 'New issue distribution by email', status: 'available' },
  { id: 'prospectnews', name: 'Prospect News', category: 'News & Wires', description: 'New issue distribution by email', status: 'available' },
  { id: 'edi', name: 'Exchange Data International (EDI)', category: 'News & Wires', description: 'New issue distribution by email', status: 'available' },
  { id: 'ft', name: 'Financial Times', category: 'News & Wires', description: 'New issue distribution by email', status: 'available' },
  {
    id: 'edgar',
    name: 'Edgar SEC filings',
    category: 'Syndicate Tools',
    description: 'SEC EDGAR — live 424B prospectus filing search',
    status: 'available',
    url: EDGAR_424B_URL,
  },
];

/** Connector ids whose data is only available under a commercial licence. */
export const COMMERCIAL_FEED_IDS = [
  'igm', 'octus', 'dealologic', 'dowjones', 'origin', 'directbooks',
  'debtwire', 'kanganews', 'mni', 'prospectnews', 'edi', 'ft',
];

export const PUSH_CONNECTOR_IDS = ['directbooks', 'ipreo', 'clearstream', 'symphony', 'cusip', 'xs-isin'];
export const EMAIL_CONNECTOR_IDS = ['debtwire', 'kanganews', 'mni', 'prospectnews', 'edi', 'ft'];

export function connectorDirection(v: VendorAPI): ConnectorDirection {
  if (v.direction) return v.direction;
  if (PUSH_CONNECTOR_IDS.includes(v.id)) return 'push';
  if (EMAIL_CONNECTOR_IDS.includes(v.id)) return 'email';
  return 'pull';
}

/** Old built-in defaults; saved overrides identical to these are stale and dropped on load. */
const LEGACY_DEFAULTS: Record<string, Pick<VendorAPI, 'name' | 'description'>> = {
  dealologic: { name: 'Dealologic', description: 'Syndicate workflow & bookbuilding automation' },
  ipreo: { name: 'Ipreo / IHS Markit Bookbuilding', description: 'Investorlink, BookBuilder' },
  anna: { name: 'ANNA DSB', description: 'ISIN & OTC ISIN issuance' },
  dtcc: { name: 'DTCC', description: 'NIIDS, MyMarketData' },
  clearstream: { name: 'Clearstream', description: 'CreationConnect & Xact APIs' },
};
const REMOVED_IDS = ['primarynexus'];
function isStaleOverride(v: VendorAPI): boolean {
  if (REMOVED_IDS.includes(v.id)) return true;
  const old = LEGACY_DEFAULTS[v.id];
  return Boolean(old && old.name === v.name && old.description === v.description && !v.url && !v.direction && !v.connectivity);
}

export function isCommercialFeed(v: VendorAPI): boolean {
  return !v.url && (v.category === 'Market Data' || COMMERCIAL_FEED_IDS.includes(v.id));
}

export const VENDOR_CATEGORIES = [...new Set(VENDOR_APIS.map(v => v.category))];
export interface CatalogueOverrides {
  entries: VendorAPI[];
  deletedIds: string[];
}
export const emptyCatalogue = (): CatalogueOverrides => ({ entries: [], deletedIds: [] });
export const catalogueStorageKey = (userId: string) => `bond-console-catalogue:${userId}`;

export function validateVendor(v: VendorAPI): string | null {
  if (!v.name.trim()) return 'Enter a name.';
  if (!VENDOR_CATEGORIES.includes(v.category)) return 'Select a console section.';
  if (v.url) {
    try {
      const url = new URL(v.url);
      if (url.protocol !== 'https:' || url.username || url.password) return 'Use a public HTTPS URL without credentials.';
    } catch { return 'Enter a valid HTTPS URL.'; }
  }
  return validateConnectivity(v.connectivity);
}

export function resolveCatalogue(overrides: CatalogueOverrides): VendorAPI[] {
  const entries = new Map(VENDOR_APIS.map(v => [v.id, v]));
  overrides.entries.forEach(v => { if (!validateVendor(v)) entries.set(v.id, v); });
  const deleted = new Set(overrides.deletedIds);
  return [...entries.values()].filter(v => !deleted.has(v.id));
}

export function saveCatalogueEntry(state: CatalogueOverrides, entry: VendorAPI): CatalogueOverrides {
  const error = validateVendor(entry);
  if (error) throw new Error(error);
  const clean = entry.connectivity ? { ...entry, connectivity: sanitizeConnectivity(entry.connectivity) } : entry;
  return { ...state, entries: [...state.entries.filter(v => v.id !== entry.id), clean] };
}

export function deleteCatalogueEntry(state: CatalogueOverrides, id: string, confirmation: string): CatalogueOverrides {
  if (confirmation !== 'delete') throw new Error('Type delete to confirm.');
  return { entries: state.entries.filter(v => v.id !== id), deletedIds: [...new Set([...state.deletedIds, id])] };
}

export function loadCatalogue(storage: Pick<Storage, 'getItem'>, userId: string): CatalogueOverrides {
  try {
    const raw = JSON.parse(storage.getItem(catalogueStorageKey(userId)) || 'null');
    if (!raw || !Array.isArray(raw.entries) || !Array.isArray(raw.deletedIds)) return emptyCatalogue();
    return {
      entries: raw.entries.map((v: unknown) => (v && typeof v === 'object' && 'connectivity' in v)
        ? { ...(v as object), connectivity: sanitizeConnectivity((v as { connectivity: unknown }).connectivity) } : v).filter((v: unknown): v is VendorAPI => {
        if (!v || typeof v !== 'object') return false;
        const entry = v as Partial<VendorAPI>;
        return typeof entry.id === 'string' && typeof entry.name === 'string' && typeof entry.category === 'string'
          && typeof entry.description === 'string' && (entry.status === 'available' || entry.status === 'connected')
          && (entry.url === undefined || typeof entry.url === 'string')
          && (entry.direction === undefined || CONNECTOR_DIRECTIONS.includes(entry.direction))
          && !validateVendor(entry as VendorAPI) && !isStaleOverride(entry as VendorAPI);
      }),
      deletedIds: raw.deletedIds.filter((id: unknown) => typeof id === 'string' && !REMOVED_IDS.includes(id)),
    };
  } catch { return emptyCatalogue(); }
}
