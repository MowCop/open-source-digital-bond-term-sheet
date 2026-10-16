import { describe, it, expect } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import { parseFedRates, parseEcbFx, parsePublicNews } from '../../supabase/functions/_shared/public-market-data';
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
describe('Public market feeds', () => {
  it('uses the latest effective rate, never a fabricated missing value', () => {
    expect(parseFedRates({ refRates: [{ type: 'SOFR', percentRate: 3.89, effectiveDate: '2026-10-13' }, { type: 'SOFR', percentRate: 3.88, effectiveDate: '2026-10-14' }] }, 'SOFR')[0]).toMatchObject({ value: 3.88, date: '2026-10-14', unit: '%' });
    expect(parseFedRates({ refRates: [{ type: 'SOFR', percentRate: null, effectiveDate: '2026-10-14' }] }, 'SOFR')).toEqual([]);
  });
  it('preserves the ECB publication date and per-euro units', () => {
    const xml = parser.parse('<gesmes:Envelope><Cube><Cube time="2026-10-15"><Cube currency="USD" rate="1.1208"/><Cube currency="GBP" rate="0.84610"/></Cube></Cube></gesmes:Envelope>');
    expect(parseEcbFx(xml)).toMatchObject([{ label: 'EUR/USD', value: 1.1208, date: '2026-10-15', unit: 'per EUR' }, { label: 'EUR/GBP', value: 0.8461 }]);
  });
  it('keeps source dates and rejects off-source or unsafe news links', () => {
    const items = ['https://www.ecb.europa.eu/press/a', 'javascript:alert(1)', 'https://other.example/'].map(link => ({ title: 'Release', link, pubDate: 'Wed, 14 Oct 2026 09:45:15 +0200' }));
    expect(parsePublicNews({ rss: { channel: { item: items } } }, 'European Central Bank', 'www.ecb.europa.eu')).toEqual([{ title: 'Release', url: items[0].link, publishedAt: '2026-10-14T07:45:15.000Z', source: 'European Central Bank' }]);
  });
});