import { AISuggestion, Bookrunner, Deal, DealStage } from '@/types/bond';

const KNOWN_BANKS = [
  'BNP Paribas', 'Deutsche Bank', 'JPMorgan', 'JP Morgan', 'Goldman Sachs', 'Citi', 'Citigroup',
  'HSBC', 'Barclays', 'NatWest', 'Rabobank', 'Morgan Stanley', 'BofA', 'Bank of America',
  'UBS', 'Credit Agricole', 'Crédit Agricole', 'Societe Generale', 'Société Générale',
  'Nomura', 'Mizuho', 'MUFG', 'SMBC', 'Santander', 'BBVA', 'ING', 'Commerzbank',
  'UniCredit', 'Intesa Sanpaolo', 'Standard Chartered', 'Wells Fargo', 'RBC', 'TD Securities',
  'Scotiabank', 'CIBC', 'BMO', 'DZ Bank', 'LBBW', 'Helaba', 'Danske Bank', 'Nordea',
  'SEB', 'Swedbank', 'DBS', 'OCBC', 'ANZ', 'Westpac', 'NAB', 'Lloyds',
];

export function extractBookrunners(rawText: string): Bookrunner[] {
  const text = rawText.replace(/\s+/g, ' ');
  const cuePattern = /(appointed|mandated|joint lead managers?|bookrunners?|global coordinators?|lead managers?)/gi;
  const found = new Map<string, Bookrunner>();
  let match: RegExpExecArray | null;
  while ((match = cuePattern.exec(text)) !== null) {
    const windowText = text.slice(Math.max(0, match.index - 200), Math.min(text.length, match.index + 300));
    const isGC = /global coordinator/i.test(windowText);
    const isPassive = /passive/i.test(windowText);
    for (const bank of KNOWN_BANKS) {
      const bankRe = new RegExp(`\\b${bank.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (bankRe.test(windowText)) {
        const key = bank.toLowerCase();
        if (!found.has(key)) {
          found.set(key, { name: bank, role: isPassive ? 'passive' : 'active', isGlobalCoordinator: isGC });
        }
      }
    }
  }
  return Array.from(found.values());
}

export function simulateAIExtraction(rawText: string): AISuggestion {
  const hasBorrower = /([A-Z][a-z]+(?: [A-Z][a-z]+)*(?:\s(?:AG|Inc|PLC|SA|Ltd))?)/g.exec(rawText);
  const hasAmount = /(\d[\d,.]+)/g.exec(rawText);
  const hasCurrency = /(EUR|USD|GBP|CHF)/g.exec(rawText);
  const hasTenor = /(\d+Y|\d+-year)/gi.exec(rawText);
  const hasSpread = /(MS[+\-]\d+(?:bps)?|[Ss]waps?\s*[+\-]\s*\d+)/g.exec(rawText);
  const hasISIN = /([A-Z]{2}[A-Z0-9]{9}\d)/g.exec(rawText);
  const hasLEI = /([A-Z0-9]{20})/g.exec(rawText);
  const hasRating = /((?:AAA|AA\+|AA|AA-|A\+|A|A-|BBB\+|BBB|BBB-)(?:\/(?:Aaa|Aa[123]|A[123]|Baa[123]))?)/g.exec(rawText);

  return {
    headline: `${hasBorrower?.[1] || 'Issuer'} ${hasCurrency?.[1] || ''} ${hasTenor?.[1] || ''} — New Issue Alert`,
    borrowerDetails: hasBorrower?.[1] || '',
    dealSummary: `${hasCurrency?.[1] || ''} ${hasAmount?.[1] || ''} ${hasTenor?.[1] || ''} at ${hasSpread?.[1] || ''}`.trim(),
    keyTerms: {
      'Issuer Name': hasBorrower?.[1] || '',
      Currency: hasCurrency?.[1] || '',
      Size: hasAmount?.[1] || '',
      Tenor: hasTenor?.[1] || '',
      'Reoffer Spread': hasSpread?.[1] || '',
      'Issuer Rating': hasRating?.[1] || '',
      ISIN: hasISIN?.[1] || '',
      LEI: hasLEI?.[1] || '',
    },
    confidence: 0.75 + Math.random() * 0.2,
  };
}

export function detectStage(rawText: string): DealStage | null {
  const t = rawText.toLowerCase();
  if (/\bsettled\b/.test(t)) return 'Settled';
  if (/\bpriced (at|today)\b|\bfinal (terms|pricing)\b/.test(t)) return 'Priced';
  if (/\bbooks (are )?closed\b/.test(t)) return 'Books Closed';
  if (/\bbooks (are )?open\b|\bbooks open\b/.test(t)) return 'Books Open';
  if (/\blaunched\b|\blaunch\b/.test(t)) return 'Launched';
  if (/\bannounced\b|\bannouncement\b/.test(t)) return 'Announced';
  if (/\bmandated\b|\bappointed\b|\bmandate\b/.test(t)) return 'Mandate';
  return null;
}

const STAGE_ORDER: DealStage[] = ['Mandate', 'Announced', 'Launched', 'Books Open', 'Books Closed', 'Priced', 'Settled'];
export function isStageForward(from: DealStage, to: DealStage): boolean {
  return STAGE_ORDER.indexOf(to) > STAGE_ORDER.indexOf(from);
}

/**
 * Build a partial Deal patch from a re-parsed alert body. Fills blanks; overwrites
 * only when the new value is non-empty AND different. Bookrunners are merged by name.
 */
export function mergeDealFromText(
  existing: Deal,
  rawText: string,
): { patch: Partial<Deal>; detectedStage: DealStage | null } {
  const ai = simulateAIExtraction(rawText);
  const newBookrunners = extractBookrunners(rawText);
  const patch: Partial<Deal> = {};

  const setIfBetter = <K extends keyof Deal>(field: K, value: Deal[K] | undefined | '') => {
    if (value === undefined || value === '' || value === null) return;
    if ((existing[field] ?? '') !== value) {
      patch[field] = value as Deal[K];
    }
  };

  setIfBetter('issuerName', ai.keyTerms['Issuer Name'] || undefined);
  setIfBetter('currency', ai.keyTerms['Currency'] || undefined);
  setIfBetter('size', ai.keyTerms['Size'] || undefined);
  setIfBetter('tenor', ai.keyTerms['Tenor'] || undefined);
  setIfBetter('reofferSpread', ai.keyTerms['Reoffer Spread'] || undefined);
  setIfBetter('issuerRating', ai.keyTerms['Issuer Rating'] || undefined);
  setIfBetter('isin', ai.keyTerms['ISIN'] || undefined);
  setIfBetter('issuerLEI', ai.keyTerms['LEI'] || undefined);

  if (newBookrunners.length > 0) {
    const merged = new Map<string, typeof newBookrunners[number]>();
    for (const b of existing.bookrunners ?? []) merged.set(b.name.toLowerCase(), b);
    for (const b of newBookrunners) {
      const key = b.name.toLowerCase();
      const prev = merged.get(key);
      merged.set(key, {
        name: b.name,
        role: b.role === 'active' || prev?.role === 'active' ? 'active' : 'passive',
        isGlobalCoordinator: b.isGlobalCoordinator || prev?.isGlobalCoordinator || false,
      });
    }
    patch.bookrunners = Array.from(merged.values());
  }

  const detectedStage = detectStage(rawText);
  return { patch, detectedStage };
}
