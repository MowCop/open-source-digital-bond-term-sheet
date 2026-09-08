/**
 * DealChecker.tsx  ·  v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop into: src/components/DealChecker.tsx
 *
 * CHANGES FROM v1.0
 * ─────────────────
 * • validateDeal() now returns { results, auditEntries } — component handles both.
 * • Master-Admin override modal: when a Master Admin clicks an Error badge they
 *   get a dialog to enter a reason; confirming calls validateDeal() with the
 *   OverrideContext, which downgrades the error, annotates it, and emits audit
 *   entries that are passed back to the parent via onAuditEntries().
 * • New field mappings for referenceRate (FIX-6) and governingLaw (FIX-7).
 * • DealCheckerProps gains: userRole, currentUserId, currentUserName,
 *   onAuditEntries callback.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useMemo, useState, useEffect, useRef } from 'react';
import {
  Shield, ChevronDown, ChevronUp, AlertTriangle, XCircle,
  Info, CheckCircle2, ExternalLink, ShieldAlert, RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Bookrunner, Deal, DayCountFraction, InterestType, BusinessDayConvention,
} from '@/types/bond';
import {
  validateDeal, countBySeverity, isReadyToPublish,
  ValidationResult, Severity, OverrideContext, DealCheckerAuditEntry,
} from '@/lib/bondValidator';
import type { UserRole } from '@/types/bond';

// ─── Props ────────────────────────────────────────────────────────────────────

interface DealCheckerProps {
  aiFields?: Record<string, string> | null;
  /** Live deal record — used instead of aiFields once a deal exists */
  deal?: Deal;
  /** Alert subject + body wording, scanned for wrong-benchmark pricing text */
  alertText?: string;
  aiBookrunners?: Bookrunner[];
  /** Role of the currently logged-in user */
  userRole?: UserRole;
  /** ID used to stamp override audit entries */
  currentUserId?: string;
  /** Display name used to stamp override audit entries */
  currentUserName?: string;
  /** Called whenever override audit entries are emitted — persist to AuditLog */
  onAuditEntries?: (entries: DealCheckerAuditEntry[]) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    issuerName:            fields['Issuer Name']          || undefined,
    issuerLEI:             fields['LEI']                  || undefined,
    issuerRating:          fields['Issuer Rating']        || undefined,
    currency:              fields['Currency']             || 'EUR',
    size:                  fields['Size']                 || undefined,
    coupon:                fields['Coupon']               || undefined,
    reofferSpread:         fields['Reoffer Spread']       || undefined,
    reofferYield:          fields['Reoffer Yield']        || undefined,
    reofferPrice:          fields['Reoffer Price']        || undefined,
    issuePrice:            fields['Issue Price']          || undefined,
    midSwapRate:           fields['Mid-Swap Rate']        || undefined,
    pricingDate:           fields['Pricing Date']         || undefined,
    issueDate:             fields['Issue Date']           || undefined,
    settlementDate:        fields['Settlement Date']      || undefined,
    maturityDate:          fields['Maturity Date']        || undefined,
    tenor:                 fields['Tenor']                || undefined,
    isin:                  fields['ISIN']                 || undefined,
    specifiedDenomination: fields['Denomination']         || undefined,
    listingVenue:          fields['Listing']              || undefined,
    sellingRestrictions:   fields['Selling Restrictions'] || undefined,
    governingLaw:          (fields['Governing Law'] as any) || undefined,
    // FIX-6: reference rate mapped from "Reference Rate" or "Interest Rate" field
    interestRate:          fields['Reference Rate'] || fields['Interest Rate'] || undefined,
    dayCountFraction:      mapDayCount(fields['Day Count']),
    interestType:          mapInterestType(fields['Interest Type']),
    bookrunners,
  };
}

// ─── AI Deal Checker logo ─────────────────────────────────────────────────────

function DealCheckerLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        width="56"
        height="56"
        viewBox="0 0 56 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-lg"
      >
        {/* Rounded green square with gold border */}
        <rect
          x="2"
          y="2"
          width="48"
          height="48"
          rx="10"
          fill="#064e3b"
          stroke="#fbbf24"
          strokeWidth="2"
        />
        {/* Shield outline */}
        <path
          d="M26 12C26 12 14 16 14 24C14 34 26 42 26 42C26 42 38 34 38 24C38 16 26 12 26 12Z"
          stroke="#fef3c7"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Checkmark */}
        <path
          d="M20 26L24 30L32 22"
          stroke="#fef3c7"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Top-right notification dot */}
        <circle cx="44" cy="10" r="6" fill="#fbbf24" stroke="#064e3b" strokeWidth="2" />
      </svg>
    </div>
  );
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

function ValidationRow({
  result,
  canOverride,
  onRequestOverride,
}: {
  result: ValidationResult;
  canOverride: boolean;
  onRequestOverride?: (result: ValidationResult) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[result.severity];
  const isOverridden = Boolean(result.overriddenBy);

  return (
    <div
      className={`rounded border px-3 py-2 text-xs transition-colors ${cfg.rowClass} ${isOverridden ? 'opacity-70 border-dashed' : ''}`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`${cfg.labelClass} cursor-pointer`}
          onClick={() => setExpanded(p => !p)}
        >
          {cfg.icon}
        </span>
        <div className="flex-1 min-w-0" onClick={() => setExpanded(p => !p)}>
          <div className="flex items-center gap-2 flex-wrap cursor-pointer">
            <span className={`font-medium ${cfg.labelClass}`}>{result.title}</span>
            <Badge variant="outline" className={`text-[9px] h-4 px-1.5 border ${cfg.badgeClass}`}>
              {result.field}
            </Badge>
            {isOverridden && (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 border border-violet-800/60 bg-violet-900/30 text-violet-400">
                overridden
              </Badge>
            )}
          </div>
          {expanded && (
            <div className="mt-1.5 text-muted-foreground leading-relaxed">
              {result.detail}
              {result.icmaRef && (
                <span className="block mt-1 text-[10px] opacity-60">
                  Ref: {result.icmaRef}
                </span>
              )}
              {isOverridden && (
                <span className="block mt-1 text-[10px] text-violet-400">
                  Overridden by {result.overriddenBy} at {result.overriddenAt}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {/* Master Admin override button — only shown on non-overridden errors */}
          {canOverride && result.severity === 'error' && !isOverridden && (
            <button
              title="Override this error (Master Admin)"
              onClick={() => onRequestOverride?.(result)}
              className="text-violet-400 hover:text-violet-300 transition-colors"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
            </button>
          )}
          <span
            className="text-muted-foreground cursor-pointer"
            onClick={() => setExpanded(p => !p)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </span>
        </div>
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

// ─── Master Admin Override Modal ──────────────────────────────────────────────

interface OverrideModalProps {
  result: ValidationResult | null;
  onConfirm: (ruleId: string, reason: string) => void;
  onCancel: () => void;
}

function OverrideModal({ result, onConfirm, onCancel }: OverrideModalProps) {
  const [reason, setReason] = useState('');
  if (!result) return null;
  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <ShieldAlert className="h-4 w-4 text-violet-400" />
            Override validation error
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          <div className="rounded border border-red-900/40 bg-red-950/20 px-3 py-2">
            <p className="font-medium text-red-400">{result.title}</p>
            <p className="mt-1 text-muted-foreground">{result.detail}</p>
          </div>
          <p className="text-muted-foreground">
            As Master Admin you may override this blocking error. The override will be logged
            in the audit trail with your identity, reason and a snapshot of the current deal fields.
          </p>
          <div>
            <label className="block mb-1 font-medium text-foreground">
              Reason for override <span className="text-red-400">*</span>
            </label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Settlement calendar exception confirmed with operations desk on 12 May 2025."
              className="text-xs min-h-[80px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!reason.trim()}
            className="bg-violet-700 hover:bg-violet-600 text-white"
            onClick={() => { onConfirm(result.id, reason.trim()); setReason(''); }}
          >
            Confirm override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Rule groups shown when everything passes ────────────────────────────────

const RULE_GROUPS = [
  'Dates and business-day conventions',
  'Pricing consistency (spread, yield, price)',
  'Identifiers (ISIN, LEI)',
  'Ratings and issuer details',
  'Bookrunners and syndicate roles',
  'Stage completeness',
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function DealChecker({
  aiFields = null,
  deal,
  alertText,
  aiBookrunners = [],
  userRole,
  currentUserId = 'unknown',
  currentUserName = 'Unknown Admin',
  onAuditEntries,
}: DealCheckerProps) {
  const [results, setResults]         = useState<ValidationResult[]>([]);
  const timerRef                       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filterSev, setFilterSev]     = useState<Severity | 'all'>('all');
  const [overrideModal, setOverrideModal] = useState<ValidationResult | null>(null);
  const [overrides, setOverrides]     = useState<OverrideContext['overriddenRuleIds']>([]);
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({});
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);

  const isMasterAdmin = userRole === 'master_admin';

  // Stable signature of the inputs — avoids re-running on new array/object identities
  const inputSignature = useMemo(
    () => JSON.stringify([deal ?? null, aiFields ?? null, aiBookrunners ?? [], alertText ?? '', overrides, overrideReasons]),
    [deal, aiFields, aiBookrunners, alertText, overrides, overrideReasons],
  );

  const auditCbRef = useRef(onAuditEntries);
  auditCbRef.current = onAuditEntries;
  const latestInputs = useRef({ deal, aiFields, aiBookrunners, alertText, overrides, overrideReasons });
  latestInputs.current = { deal, aiFields, aiBookrunners, alertText, overrides, overrideReasons };

  // Re-run validation whenever fields, bookrunners, or active overrides change
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus('running');
    timerRef.current = setTimeout(() => {
      const cur = latestInputs.current;
      const partial: Partial<Deal> = cur.deal ?? aiFieldsToPartialDeal(cur.aiFields ?? null, cur.aiBookrunners ?? []);
      const ctx: OverrideContext | undefined = cur.overrides.length > 0 && isMasterAdmin
        ? {
            adminUserId: currentUserId,
            adminName: currentUserName,
            reason: cur.overrides.map(id => cur.overrideReasons[id] ?? '').join('; '),
            overriddenRuleIds: cur.overrides,
          }
        : undefined;
      const { results: r, auditEntries } = validateDeal(partial, ctx, cur.deal?.stage, cur.alertText);
      setResults(r);
      setLastRunAt(new Date());
      setStatus('done');
      if (auditEntries.length > 0) auditCbRef.current?.(auditEntries);
    }, 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputSignature, isMasterAdmin, currentUserId, currentUserName, refreshTick]);


  function handleRefresh() {
    setRefreshing(true);
    setRefreshTick(t => t + 1);
    setTimeout(() => setRefreshing(false), 600);
  }


  const counts = useMemo(() => countBySeverity(results), [results]);
  const ready  = useMemo(() => isReadyToPublish(results), [results]);

  const fieldCount = deal
    ? Object.values(deal as unknown as Record<string, unknown>).filter(v => typeof v === 'string' && v.trim()).length
    : aiFields
    ? Object.values(aiFields).filter(v => v && v.trim()).length
    : 0;

  const filtered = filterSev === 'all' ? results : results.filter(r => r.severity === filterSev);

  const headerAccent =
    counts.error > 0   ? 'text-red-400' :
    counts.warning > 0 ? 'text-amber-400' :
    results.length > 0 ? 'text-green-400' :
    'text-muted-foreground';

  function handleOverrideConfirm(ruleId: string, reason: string) {
    setOverrides(prev => [...prev, ruleId]);
    setOverrideReasons(prev => ({ ...prev, [ruleId]: reason }));
    setOverrideModal(null);
  }

  return (
    <>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Shield className={`h-4 w-4 shrink-0 ${headerAccent}`} />
          <span className="font-semibold text-sm uppercase tracking-wider text-foreground">
            Deal Checker
          </span>
          {overrides.length > 0 && (
            <Badge variant="outline" className="ml-1 text-[9px] bg-violet-900/30 text-violet-400 border-violet-800/60">
              {overrides.length} override{overrides.length > 1 ? 's' : ''} active
            </Badge>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            title="Re-run Deal Checker"
            className={`${results.length > 0 ? '' : 'ml-auto'} inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors`}
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {results.length > 0 && (
            <Badge
              variant="outline"
              className={`text-[10px] border ${
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
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <Shield className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-xs text-center">
                Start typing or drop a document — deal terms will be validated automatically.
              </p>
            </div>
          ) : status !== 'done' ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <RefreshCw className="h-4 w-4 text-green-400 animate-spin" />
              Analysing {fieldCount} extracted field{fieldCount > 1 ? 's' : ''}…
            </div>
          ) : results.length === 0 ? (
            <div className="space-y-2">
              <div className="rounded-md border border-green-800/60 bg-green-900/20 p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                  <span className="text-xs font-semibold text-green-300">All checks passed</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {fieldCount} field{fieldCount === 1 ? '' : 's'} checked
                  {lastRunAt ? ` · last run ${lastRunAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                </p>
              </div>
              <div className="space-y-1">
                {RULE_GROUPS.map(g => (
                  <div key={g} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                    {g}
                  </div>
                ))}
              </div>
            </div>

          ) : (
            <>
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

              {!ready && (
                <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-0.5">
                  {filtered.map(r => (
                    <ValidationRow
                      key={r.id}
                      result={r}
                      canOverride={isMasterAdmin}
                      onRequestOverride={setOverrideModal}
                    />
                  ))}
                </div>
              )}

              {isMasterAdmin && overrides.length > 0 && (
                <p className="text-[10px] text-violet-400/70 pt-1 flex items-center gap-1">
                  <ShieldAlert className="h-2.5 w-2.5" />
                  {overrides.length} error{overrides.length > 1 ? 's' : ''} overridden — all activity logged to audit trail.
                </p>
              )}

              {results.some(r => r.icmaRef) && (
                <p className="text-[10px] text-muted-foreground/50 pt-1 flex items-center gap-1">
                  <ExternalLink className="h-2.5 w-2.5" />
                  References: ICMA BDT, ISO 6166, ISO 17442, GLEIF, CSDR
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Override modal — only rendered when isMasterAdmin clicks a red error */}
      {isMasterAdmin && (
        <OverrideModal
          result={overrideModal}
          onConfirm={handleOverrideConfirm}
          onCancel={() => setOverrideModal(null)}
        />
      )}
    </>
  );
}
