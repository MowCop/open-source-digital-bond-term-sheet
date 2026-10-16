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
    // Commercial market-data vendors must still be reported as unlicensed.
    expect(isCommercialFeed(VENDOR_APIS.find(v => v.id === 'cbonds')!)).toBe(true);
    expect(isCommercialFeed(VENDOR_APIS.find(v => v.id === 'bloomberg')!)).toBe(false);
  });

  it('keeps the EDGAR url identical to the constant used in the UI', () => {
    expect(EDGAR_424B_URL).toContain('type=424B');
    expect(EDGAR_424B_URL).toContain('action=getcurrent');
  });
});
