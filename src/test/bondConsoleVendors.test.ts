import { describe, it, expect } from 'vitest';
import { VENDOR_APIS, EDGAR_424B_URL, isCommercialFeed } from '../lib/vendors';

describe('Bond Console connector catalogue', () => {
  const edgar = VENDOR_APIS.find(v => v.id === 'edgar');

  it('lists "Edgar SEC filings" under Syndicate Tools as a live https link', () => {
    expect(edgar?.name).toBe('Edgar SEC filings');
    expect(edgar?.category).toBe('Syndicate Tools');
    expect(edgar?.url).toBe(
      'https://www.sec.gov/cgi-bin/browse-edgar?company=&CIK=&type=424B&owner=include&count=20&action=getcurrent'
    );
    expect(new URL(edgar!.url!).host).toBe('www.sec.gov');
    expect(new URL(edgar!.url!).searchParams.get('type')).toBe('424B');
  });

  it('renders link rows as links, never as commercial "Not connected" or demo toggles', () => {
    expect(isCommercialFeed(edgar!)).toBe(false);
    for (const v of VENDOR_APIS) {
      if (v.url) {
        expect(v.url.startsWith('https://')).toBe(true);
        expect(isCommercialFeed(v)).toBe(false);
      }
    }
    // Commercial market-data vendors must still be reported as unlicensed,
    // including the ones already flagged "connected" in the catalogue.
    expect(isCommercialFeed(VENDOR_APIS.find(v => v.id === 'cbonds')!)).toBe(true);
    expect(isCommercialFeed(VENDOR_APIS.find(v => v.id === 'bloomberg')!)).toBe(true);
    // A non-licensed tool row keeps its demo toggle.
    expect(isCommercialFeed(VENDOR_APIS.find(v => v.id === 'ipreo')!)).toBe(false);
  });

  it('keeps the EDGAR url identical to the constant used in the UI', () => {
    expect(EDGAR_424B_URL).toContain('type=424B');
    expect(EDGAR_424B_URL).toContain('action=getcurrent');
  });
});

import { COMMERCIAL_FEED_IDS, connectorDirection } from '../lib/vendors';
const find = (id: string) => VENDOR_APIS.find(v => v.id === id);
describe('Connector catalogue corrections', () => {
  it('uses corrected names and descriptions', () => {
    expect(find('dealologic')?.name).toBe('Dealogic (ION Group)');
    expect(find('ipreo')?.name).toBe('S&P Global IssueNet / InvestorAccess');
    expect(find('anna')?.description).toContain('OTC derivatives ISINs only');
    expect(find('dtcc')?.description).toBe('US municipal new issues (NIIDS)');
    expect(find('xs-isin')?.category).toBe('Industry & Standards');
  });
  it('removes the PrimaryNexus placeholder', () => {
    expect(find('primarynexus')).toBeUndefined();
    expect(COMMERCIAL_FEED_IDS).not.toContain('primarynexus');
  });
  const news = ['debtwire', 'kanganews', 'mni', 'prospectnews', 'edi', 'ft'];
  it('adds email news recipients as commercial News & Wires entries', () => {
    for (const id of news) { expect(find(id)?.category).toBe('News & Wires'); expect(isCommercialFeed(find(id)!)).toBe(true); }
  });
  it('labels push, email and pull connectors', () => {
    const push = ['directbooks', 'ipreo', 'clearstream', 'symphony', 'cusip', 'xs-isin'];
    for (const v of VENDOR_APIS) {
      expect(connectorDirection(v)).toBe(push.includes(v.id) ? 'push' : news.includes(v.id) ? 'email' : 'pull');
    }
  });
});
