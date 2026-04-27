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

const KNOWN_SUPRAS = [
  'European Investment Bank',
  'European Bank for Reconstruction and Development',
  'Asian Development Bank',
  'Inter-American Development Bank',
  'African Development Bank',
  'Council of Europe Development Bank',
  'International Finance Corporation',
  'World Bank',
  'Eurofima',
  'KfW',
  'Nordic Investment Bank',
  'Islamic Development Bank',
];

const BORROWER_TERMINATORS = /\b(plans?|priced|prices|pricing|mandates?|mandated|announces?|announced|launches?|launched|opens?|closes?|settled|today|tomorrow|tap|taps|issues?|issued|issuing|completes?|completed|prints?|printed|set|sets|to)\b/i;

function trimBorrower(name: string): string {
  return name
    .replace(/[\s,;:.\-–—]+$/g, '')
    .replace(/\s+(of|and|for|the|de|du|la|von|van)$/i, '')
    .trim();
}

export function extractBorrowerName(rawText: string): string {
  const text = rawText.replace(/\s+/g, ' ').trim();
  if (!text) return '';

  const candidates: Array<{ start: number; value: string }> = [];

  // Layer 1: known supranationals
  for (const supra of KNOWN_SUPRAS) {
    const re = new RegExp(`\\b${supra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const m = re.exec(text);
    if (m) candidates.push({ start: m.index, value: supra });
  }

  // Layer 2: sovereign patterns
  const sovereignPatterns: RegExp[] = [
    /\b(?:Federal |Democratic |Islamic |People's )?Republic of [A-Z][\w'-]+(?: and [A-Z][\w'-]+)*/,
    /\bKingdom of [A-Z][\w'-]+/,
    /\bGrand Duchy of [A-Z][\w'-]+/,
    /\b(?:State|Commonwealth|Principality|Sultanate|Emirate) of [A-Z][\w'-]+/,
    /\bUnited (?:States|Kingdom|Arab Emirates|Mexican States)(?: of [A-Z][\w'-]+)?/,
  ];
  for (const re of sovereignPatterns) {
    const m = re.exec(text);
    if (m) candidates.push({ start: m.index, value: m[0] });
  }

  // Layer 3: corporate suffix anchor
  const corpRe = /\b([A-Z][\w&.'-]+(?:\s+[A-Z][\w&.'-]+){0,5})\s+(AG|Inc|PLC|SA|Ltd|NV|SpA|GmbH|Holdings|Group|Corp|Corporation|Bank|Capital)\b/;
  const corpMatch = corpRe.exec(text);
  if (corpMatch) candidates.push({ start: corpMatch.index, value: `${corpMatch[1]} ${corpMatch[2]}` });

  // Layer 4: connector-aware capitalized run, terminated by verbs
  const connectorRe = /\b[A-Z][\w'-]+(?:\s+(?:[A-Z][\w'-]+|of|and|for|the|de|du|la|von|van)){0,6}/;
  const connMatch = connectorRe.exec(text);
  if (connMatch) {
    let value = connMatch[0];
    // Cut at any terminator verb inside the match
    const termMatch = BORROWER_TERMINATORS.exec(value);
    if (termMatch) value = value.slice(0, termMatch.index).trim();
    if (value) candidates.push({ start: connMatch.index, value });
  }

  if (candidates.length === 0) return '';

  // Pick longest match; tiebreak by leftmost
  const trimmed = candidates.map(c => ({ ...c, value: trimBorrower(c.value) })).filter(c => c.value);
  trimmed.sort((a, b) => b.value.length - a.value.length || a.start - b.start);
  return trimmed[0].value;
}

export function simulateAIExtraction(rawText: string): AISuggestion {
  const borrower = extractBorrowerName(rawText);
  const compactText = rawText.replace(/\s+/g, ' ');
  const hasAmount = /(?:\b(?:EUR|USD|GBP|CHF)\s*)?(\d[\d,.]+\s*(?:bn|mm|m|million|billion)?)/i.exec(compactText);
  const hasCurrency = /(EUR|USD|GBP|CHF)/g.exec(rawText);
  const hasTenor = /(\d+\s*Y|\d+\s*-\s*year|due\s+\d{4})/gi.exec(rawText);
  const hasSpread = /(MS[+\-]\d+(?:bps)?|[Ss]waps?\s*[+\-]\s*\d+)/g.exec(rawText);
  const hasISIN = /([A-Z]{2}[A-Z0-9]{9}\d)/g.exec(rawText);
  const hasLEI = /([A-Z0-9]{20})/g.exec(rawText);
  const hasRating = /((?:AAA|AA\+|AA|AA-|A\+|A|A-|BBB\+|BBB|BBB-)(?:\/(?:Aaa|Aa[123]|A[123]|Baa[123]))?)/g.exec(rawText);
  const hasCoupon = /(?:coupon|cpn)\s*[:\-]?\s*([\d.]+\s*%|[\d.]+\s*per cent|TBD)/i.exec(compactText);
  const hasIssuePrice = /issue\s+price\s*[:\-]?\s*([\d.]+)/i.exec(compactText);
  const hasReofferPrice = /reoffer\s+price\s*[:\-]?\s*([\d.]+)/i.exec(compactText);
  const hasReofferYield = /reoffer\s+yield\s*[:\-]?\s*([\d.]+\s*%?)/i.exec(compactText);
  const hasMidSwap = /mid\s*-?\s*swap(?:\s+rate)?\s*[:\-]?\s*([\d.]+\s*%?)/i.exec(compactText);
  const hasSettlementDate = /(?:settlement|settle(?:ment)?\s+date)\s*[:\-]?\s*([A-Z][a-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Z][a-z]+\s+\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i.exec(compactText);
  const hasPricingDate = /pricing\s+date\s*[:\-]?\s*([A-Z][a-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Z][a-z]+\s+\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i.exec(compactText);
  const hasMaturityDate = /maturity\s+date\s*[:\-]?\s*([A-Z][a-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Z][a-z]+\s+\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i.exec(compactText);
  const hasDenomination = /(?:denom(?:ination)?s?)\s*[:\-]?\s*([A-Z]{3}\s*[\d,]+(?:\s*x\s*[\d,]+)?)/i.exec(compactText);
  const hasListing = /listing\s*[:\-]?\s*([^.;\n]+)/i.exec(rawText);
  const hasLaw = /(English Law|New York Law|German Law|French Law|Swiss Law)/i.exec(compactText);

  return {
    headline: `${borrower || 'Issuer'} ${hasCurrency?.[1] || ''} ${hasTenor?.[1] || ''} — New Issue Alert`.replace(/\s+/g, ' ').trim(),
    borrowerDetails: borrower,
    dealSummary: `${hasCurrency?.[1] || ''} ${hasAmount?.[1] || ''} ${hasTenor?.[1] || ''} at ${hasSpread?.[1] || ''}`.trim(),
    keyTerms: {
      'Issuer Name': borrower,
      Currency: hasCurrency?.[1] || '',
      Size: hasAmount?.[1] || '',
      Tenor: hasTenor?.[1] || '',
      'Reoffer Spread': hasSpread?.[1] || '',
      'Issuer Rating': hasRating?.[1] || '',
      ISIN: hasISIN?.[1] || '',
      LEI: hasLEI?.[1] || '',
      Coupon: hasCoupon?.[1] || '',
      'Issue Price': hasIssuePrice?.[1] || '',
      'Reoffer Price': hasReofferPrice?.[1] || '',
      'Reoffer Yield': hasReofferYield?.[1] || '',
      'Mid-Swap Rate': hasMidSwap?.[1] || '',
      'Pricing Date': hasPricingDate?.[1] || '',
      'Settlement Date': hasSettlementDate?.[1] || '',
      'Maturity Date': hasMaturityDate?.[1] || '',
      Denomination: hasDenomination?.[1] || '',
      'Governing Law': hasLaw?.[1] || '',
      Listing: hasListing?.[1]?.trim() || '',
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
