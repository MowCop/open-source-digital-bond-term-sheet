/**
 * DealChecker.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop into: src/components/DealChecker.tsx
 *
 * A self-contained validation panel designed to slot into the right column of
 * AIDraftPage.tsx, directly below the "AI Field Extraction" card.
 *
 * Usage in AIDraftPage.tsx:
 *   import DealChecker from '@/components/DealChecker';
 *   // inside JSX, in the right column <div className="space-y-4">:
 *   <DealChecker aiFields={aiFields} aiBookrunners={aiBookrunners} />
 *
 * Props:
 *   aiFields      — the keyTerms object from simulateAIExtraction()
 *   aiBookrunners — the Bookrunner[] from extractBookrunners()
 *
 * The component maps those raw strings onto a partial Deal object and runs
 * validateDeal() from bondValidator.ts, re-running on every prop change with
 * a 400ms debounce so it doesn't flicker while the user types.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useMemo, useState, useEffect, useRef } from 'react';
import { Shield, ChevronDown, ChevronUp, AlertTriangle, XCircle, Info, CheckCircle2, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Bookrunner, Deal, DayCountFraction, InterestType, BusinessDayConvention } from '@/types/bond';
import { validateDeal, countBySeverity, isReadyToPublish, ValidationResult, Severity } from '@/lib/bondValidator';

// ─── Props ────────────────────────────────────────────────────────────────────

interface DealCheckerProps {
  aiFields: Record<string, string> | null;
  aiBookrunners?: Bookrunner[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map the raw AI-extracted key-terms string to our DayCountFraction enum */
function mapDayCount(raw: string | undefined): DayCountFraction | undefined {
  if (!raw) return undefined;
  const u = raw.toUpperCase().replace(/[/ ]/g, '_');
  const map: Record<string, DayCountFraction> = {
    'ACT_ACT': 'ACT_ACT', 'ACTUAL_ACTUAL': 'ACT_ACT',
    'ACT_360': 'ACT_360', 'ACTUAL_360': 'ACT_360',
    'ACT_365': 'ACT_365', 'ACTUAL_365': 'ACT_365',
    '30_360': '30_360',
    '30E_360': '30E_360',
  };
  return map[u];
}

function mapInterestType(raw: string | undefined): InterestType | undefined {
  if (!raw) return undefined;
  const u = raw.toUpperCase();
  if (u === 'FIXED') return 'FIXED';
  if (u === 'FLOATING' || u === 'FRN') return 'FLOATING';
  if (u === 'ZERO_COUPON' || u === 'ZERO COUPON' || u === 'ZC') return 'ZERO_COUPON';
  return undefined;
}

function aiFieldsToPartialDeal(
  fields: Record<string, string> | null,
  bookrunners: Bookrunner[],
): Partial<Deal> {
  if (!fields) return {};
  return {
    issuerName:          fields['Issuer Name']      || undefined,
    issuerLEI:           fields['LEI']              || undefined,
    issuerRating:        fields['Issuer Rating']    || undefined,
    currency:            fields['Currency']         || 'EUR',
    size:                fields['Size']             || undefined,
    coupon:              fields['Coupon']           || undefined,
    reofferSpread:       fields['Reoffer Spread']   || undefined,
    reofferYield:        fields['Reoffer Yield']    || undefined,
    reofferPrice:        fields['Reoffer Price']    || undefined,
    issuePrice:          fields['Issue Price']      || undefined,
    midSwapRate:         fields['Mid-Swap Rate']    || undefined,
    pricingDate:         fields['Pricing Date']     || undefined,
    issueDate:           fields['Issue Date']       || undefined,
    settlementDate:      fields['Settlement Date']  || undefined,
    maturityDate:        fields['Maturity Date']    || undefined,
    tenor:               fields['Tenor']            || undefined,
    isin:                fields['ISIN']             || undefined,
    specifiedDenomination: fields['Denomination']  || undefined,
    listingVenue:        fields['Listing']          || undefined,
    sellingRestrictions: fields['Selling Restrictions'] || undefined,
    dayCountFraction:    mapDayCount(fields['Day Count']),
    interestType:        mapInterestType(fields['Interest Type']),
    bookrunners,
  };
}

// ─── Severity UI config ───────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<Severity, {
  icon: React.ReactNode;
  labelClass: string;
  rowClass: string;
  badgeClass: string;
  label: string;
}> = {
  error: {
    icon: <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />,
    labelClass: 'text-red-400',
    rowClass: 'border-red-900/40 bg-red-950/20',
    badgeClass: 'bg-red-900/40 text-red-400 border-red-800/60',
    label: 'Error',
  },
  warning: {
    icon: <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />,
    labelClass: 'text-amber-400',
    rowClass: 'border-amber-900/40 bg-amber-950/15',
    badgeClass: 'bg-amber-900/40 text-amber-400 border-amber-800/60',
    label: 'Warning',
  },
  info: {
    icon: <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />,
    labelClass: 'text-blue-400',
    rowClass: 'border-blue-900/40 bg-blue-950/15',
    badgeClass: 'bg-blue-900/40 text-blue-400 border-blue-800/60',
    label: 'Info',
  },
};

// ─── Single validation row ────────────────────────────────────────────────────

function ValidationRow({ result }: { result: ValidationResult }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[result.severity];

  return (
    <div
      className={`rounded border px-3 py-2 text-xs cursor-pointer transition-colors ${cfg.rowClass}`}
      onClick={() => setExpanded(p => !p)}
    >
      <div className="flex items-start gap-2">
        <span className={cfg.labelClass}>{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium ${cfg.labelClass}`}>{result.title}</span>
            <Badge variant="outline" className={`text-[9px] h-4 px-1.5 border ${cfg.badgeClass}`}>
              {result.field}
            </Badge>
          </div>
          {expanded && (
            <div className="mt-1.5 text-muted-foreground leading-relaxed">
              {result.detail}
              {result.icmaRef && (
                <span className="block mt-1 text-[10px] opacity-60">
                  Ref: {result.icmaRef}
                </span>
              )}
            </div>
          )}
        </div>
        <span className="text-muted-foreground shrink-0 mt-0.5">
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </span>
      </div>
    </div>
  );
}

// ─── Summary bar ─────────────────────────────────────────────────────────────

function SummaryBar({
  counts,
  ready,
  fieldCount,
}: {
  counts: Record<Severity, number>;
  ready: boolean;
  fieldCount: number;
}) {
  if (fieldCount === 0) return null;

  if (ready) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded border border-green-800/50 bg-green-950/20 text-xs text-green-400">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium">All checks passed — ready to send</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {counts.error > 0 && (
        <span className="flex items-center gap-1 text-[11px] text-red-400 font-medium">
          <XCircle className="h-3 w-3" /> {counts.error} error{counts.error > 1 ? 's' : ''}
        </span>
      )}
      {counts.warning > 0 && (
        <span className="flex items-center gap-1 text-[11px] text-amber-400 font-medium">
          <AlertTriangle className="h-3 w-3" /> {counts.warning} warning{counts.warning > 1 ? 's' : ''}
        </span>
      )}
      {counts.info > 0 && (
        <span className="flex items-center gap-1 text-[11px] text-blue-400">
          <Info className="h-3 w-3" /> {counts.info} notice{counts.info > 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DealChecker({ aiFields, aiBookrunners = [] }: DealCheckerProps) {
  // Debounced results so we don't re-validate on every keystroke
  const [results, setResults] = useState<ValidationResult[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filterSev, setFilterSev] = useState<Severity | 'all'>('all');

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const partial = aiFieldsToPartialDeal(aiFields, aiBookrunners);
      setResults(validateDeal(partial));
    }, 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [aiFields, aiBookrunners]);

  const counts = useMemo(() => countBySeverity(results), [results]);
  const ready  = useMemo(() => isReadyToPublish(results), [results]);

  const fieldCount = aiFields
    ? Object.values(aiFields).filter(v => v && v.trim()).length
    : 0;

  const filtered = filterSev === 'all' ? results : results.filter(r => r.severity === filterSev);

  // Determine header accent colour based on worst severity
  const headerAccent =
    counts.error > 0   ? 'text-red-400' :
    counts.warning > 0 ? 'text-amber-400' :
    results.length > 0 ? 'text-green-400' :
    'text-muted-foreground';

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Shield className={`h-4 w-4 shrink-0 ${headerAccent}`} />
        <span className="font-semibold text-sm uppercase tracking-wider text-foreground">
          Deal Checker
        </span>
        {results.length > 0 && (
          <Badge
            variant="outline"
            className={`ml-auto text-[10px] border ${
              counts.error > 0
                ? 'bg-red-900/30 text-red-400 border-red-800/60'
                : counts.warning > 0
                ? 'bg-amber-900/30 text-amber-400 border-amber-800/60'
                : 'bg-green-900/30 text-green-400 border-green-800/60'
            }`}
          >
            {results.length} check{results.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      <div className="p-3 space-y-2.5">
        {fieldCount === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Shield className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-xs text-center">
              Start typing or drop a document — deal terms will be validated automatically.
            </p>
          </div>
        ) : results.length === 0 ? (
          /* Loading / no issues */
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            Analysing {fieldCount} extracted field{fieldCount > 1 ? 's' : ''}…
          </div>
        ) : (
          <>
            {/* Summary + filter tabs */}
            <SummaryBar counts={counts} ready={ready} fieldCount={fieldCount} />

            {!ready && (
              <div className="flex items-center gap-1 flex-wrap pt-0.5">
                {(['all', 'error', 'warning', 'info'] as const).map(sev => {
                  const active = filterSev === sev;
                  const count = sev === 'all' ? results.length : counts[sev];
                  if (sev !== 'all' && count === 0) return null;
                  return (
                    <button
                      key={sev}
                      onClick={() => setFilterSev(sev)}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                        active
                          ? 'border-primary/60 bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-muted-foreground'
                      }`}
                    >
                      {sev === 'all' ? `All (${count})` : `${sev.charAt(0).toUpperCase() + sev.slice(1)} (${count})`}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Results list */}
            {!ready && (
              <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-0.5">
                {filtered.map(r => (
                  <ValidationRow key={r.id} result={r} />
                ))}
              </div>
            )}

            {/* ICMA reference footnote */}
            {results.some(r => r.icmaRef) && (
              <p className="text-[10px] text-muted-foreground/50 pt-1 flex items-center gap-1">
                <ExternalLink className="h-2.5 w-2.5" />
                References: ICMA Bond Data Taxonomy, ISO 6166, GLEIF, CSDR
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
