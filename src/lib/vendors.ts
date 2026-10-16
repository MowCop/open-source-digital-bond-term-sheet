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
}

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
  { id: 'clearstream', name: 'Clearstream', category: 'Settlement & Custody', description: 'CreationConnect & Xact APIs', status: 'available' },
  { id: 'dtcc', name: 'DTCC', category: 'Settlement & Custody', description: 'NIIDS, MyMarketData', status: 'available' },
  { id: 'icma', name: 'ICMA New Issue Process', category: 'Industry & Standards', description: 'NIP and Bond Data Taxonomy', status: 'connected' },
  { id: 'anna', name: 'ANNA DSB', category: 'Industry & Standards', description: 'ISIN & OTC ISIN issuance', status: 'available' },
  { id: 'cusip', name: 'CUSIP Global Services', category: 'Industry & Standards', description: 'CUSIP allocation API', status: 'available' },
  { id: 'ipreo', name: 'Ipreo / IHS Markit Bookbuilding', category: 'Syndicate Tools', description: 'Investorlink, BookBuilder', status: 'available' },
  { id: 'symphony', name: 'Symphony Messaging', category: 'Communications', description: 'Compliant chat bridge', status: 'connected' },
  { id: 'primarynexus', name: 'PrimaryNexus', category: 'Syndicate Tools', description: 'Primary markets intelligence & league tables', status: 'available' },
  { id: 'finsight', name: 'Finsight', category: 'Market Data', description: 'Capital markets deal data & analytics', status: 'available' },
  { id: '9fin', name: '9fin (Bond Radar)', category: 'Market Data', description: 'High yield & leveraged finance intelligence', status: 'available' },
  { id: 'globalcapital', name: 'GlobalCapital', category: 'Market Data', description: 'New issue news feeds', status: 'available' },
  { id: 'igm', name: 'IGM', category: 'News & Wires', description: 'Capital markets intelligence & commentary', status: 'available' },
  { id: 'octus', name: 'Octus', category: 'News & Wires', description: 'Credit news, restructurings & distressed intelligence', status: 'available' },
  { id: 'dealologic', name: 'Dealologic', category: 'Syndicate Tools', description: 'Syndicate workflow & bookbuilding automation', status: 'available' },
  { id: 'cbonds', name: 'Cbonds', category: 'Market Data', description: 'Global bond database & pricing', status: 'available' },
  { id: 'factset', name: 'FactSet', category: 'Market Data', description: 'Reference data & fixed income analytics', status: 'available' },
  { id: 'dowjones', name: 'Dow Jones', category: 'News & Wires', description: 'Newswires: Dow Jones, WSJ, MarketWatch', status: 'available' },
  { id: 'origin', name: 'Origin Markets', category: 'Syndicate Tools', description: 'Digital bond issuance & investor platform', status: 'available' },
  { id: 'directbooks', name: 'DirectBooks', category: 'Syndicate Tools', description: 'Investor distribution & e-delivery', status: 'available' },
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
  'primarynexus', 'igm', 'octus', 'dealologic', 'dowjones', 'origin', 'directbooks',
];

export function isCommercialFeed(v: VendorAPI): boolean {
  return !v.url && (v.category === 'Market Data' || COMMERCIAL_FEED_IDS.includes(v.id));
}
