export interface PublishedRate { id: string; label: string; value: number; unit: '%' | 'per EUR'; date: string; source: string; url: string }
export interface PublicHeadline { title: string; url: string; publishedAt: string; source: string }
export interface PublicMarketSnapshot { fetchedAt: string; rates: PublishedRate[]; headlines: PublicHeadline[]; errors: Array<{ source: string; message: string }> }
type RecordValue = Record<string, unknown>;
const record = (v: unknown): RecordValue => v && typeof v === 'object' ? v as RecordValue : {};
const list = (v: unknown): unknown[] => Array.isArray(v) ? v : v == null ? [] : [v];
const text = (v: unknown): string => typeof v === 'string' ? v.trim() : '';

export function parseFedRates(input: unknown, type: 'SOFR' | 'EFFR'): PublishedRate[] {
  const rows = list(record(input).refRates).map(record).filter(r => r.type === type && /^\d{4}-\d{2}-\d{2}$/.test(text(r.effectiveDate)) && typeof r.percentRate === 'number' && Number.isFinite(r.percentRate));
  rows.sort((a, b) => text(b.effectiveDate).localeCompare(text(a.effectiveDate)));
  const latest = rows[0];
  return latest ? [{ id: type.toLowerCase(), label: type, value: Number(latest.percentRate), unit: '%', date: text(latest.effectiveDate), source: 'Federal Reserve Bank of New York', url: type === 'SOFR' ? 'https://www.newyorkfed.org/markets/reference-rates/sofr' : 'https://www.newyorkfed.org/markets/reference-rates/effr' }] : [];
}

export function parseEcbFx(input: unknown): PublishedRate[] {
  const envelope = record(record(input)['gesmes:Envelope']);
  const dated = record(record(envelope.Cube).Cube);
  const date = text(dated['@_time']);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  return list(dated.Cube).map(record).filter(r => ['USD', 'GBP', 'CHF', 'JPY'].includes(text(r['@_currency'])) && Number.isFinite(Number(r['@_rate'])) && Number(r['@_rate']) > 0).map(r => ({
    id: `eur-${text(r['@_currency']).toLowerCase()}`, label: `EUR/${text(r['@_currency'])}`, value: Number(r['@_rate']), unit: 'per EUR', date, source: 'European Central Bank', url: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html',
  }));
}

export function parsePublicNews(input: unknown, source: string, allowedHost: string): PublicHeadline[] {
  return list(record(record(record(input).rss).channel).item).map(record).flatMap(r => {
    const title = text(r.title), url = text(r.link), publishedAt = text(r.pubDate);
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.hostname !== allowedHost || !title || !Number.isFinite(Date.parse(publishedAt))) return [];
      return [{ title, url, publishedAt: new Date(publishedAt).toISOString(), source }];
    } catch { return []; }
  }).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 12);
}