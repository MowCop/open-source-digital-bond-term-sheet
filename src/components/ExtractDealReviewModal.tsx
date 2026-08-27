import { useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import type { Deal, DealStage, Bookrunner } from '@/types/bond';

export interface AIExtraction {
  mode: 'new_deal' | 'update_existing';
  matchedDealId: string;
  matchReason: string;
  confidence: number;
  keyTerms: Record<string, string>;
  bookrunners: Bookrunner[];
  suggestedStage: string;
  alerts: string[];
}

// Map AI keyTerms keys -> Deal column keys
const FIELD_MAP: Array<{ label: string; key: keyof Deal; aiKey: string }> = [
  { label: 'Issuer Name',     key: 'issuerName',     aiKey: 'Issuer Name' },
  { label: 'Currency',        key: 'currency',       aiKey: 'Currency' },
  { label: 'Size',            key: 'size',           aiKey: 'Size' },
  { label: 'Tenor',           key: 'tenor',          aiKey: 'Tenor' },
  { label: 'Coupon',          key: 'coupon',         aiKey: 'Coupon' },
  { label: 'Reoffer Spread',  key: 'reofferSpread',  aiKey: 'Reoffer Spread' },
  { label: 'Reoffer Yield',   key: 'reofferYield',   aiKey: 'Reoffer Yield' },
  { label: 'Reoffer Price',   key: 'reofferPrice',   aiKey: 'Reoffer Price' },
  { label: 'Issue Price',     key: 'issuePrice',     aiKey: 'Issue Price' },
  { label: 'Mid-Swap Rate',   key: 'midSwapRate',    aiKey: 'Mid-Swap Rate' },
  { label: 'Issuer Rating',   key: 'issuerRating',   aiKey: 'Issuer Rating' },
  { label: 'ISIN',            key: 'isin',           aiKey: 'ISIN' },
  { label: 'LEI',             key: 'issuerLEI',      aiKey: 'LEI' },
  { label: 'Pricing Date',    key: 'pricingDate',    aiKey: 'Pricing Date' },
  { label: 'Settlement Date', key: 'settlementDate', aiKey: 'Settlement Date' },
  { label: 'Maturity Date',   key: 'maturityDate',   aiKey: 'Maturity Date' },
  { label: 'Denomination',    key: 'specifiedDenomination', aiKey: 'Denomination' },
  { label: 'Governing Law',   key: 'governingLaw',   aiKey: 'Governing Law' },
  { label: 'Listing Venue',   key: 'listingVenue',   aiKey: 'Listing' },
  { label: 'Day Count',       key: 'dayCountFraction', aiKey: 'Day Count' },
  { label: 'Interest Type',   key: 'interestType',   aiKey: 'Interest Type' },
];

const STAGES: DealStage[] = ['Mandate','Announced','Launched','Books Open','Books Closed','Priced','Settled'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extraction: AIExtraction | null;
  conversationLabel: string;
  sourceChannelId?: string;
}

export default function ExtractDealReviewModal({ open, onOpenChange, extraction, conversationLabel, sourceChannelId }: Props) {
  const { deals, createDeal, updateDeal, updateDealStage, addAuditEntry, currentUser } = useApp();
  const { toast } = useToast();

  // Allow user to override mode + match
  const [modeOverride, setModeOverride] = useState<'new_deal' | 'update_existing' | null>(null);
  const [matchOverride, setMatchOverride] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [bookrunnerAccepted, setBookrunnerAccepted] = useState<Record<string, boolean>>({});
  const [stageAccepted, setStageAccepted] = useState(true);

  const effectiveMode = modeOverride ?? extraction?.mode ?? 'new_deal';
  const effectiveDealId = matchOverride ?? extraction?.matchedDealId ?? '';
  const existingDeal: Deal | undefined = useMemo(
    () => (effectiveMode === 'update_existing' ? deals.find(d => d.id === effectiveDealId) : undefined),
    [deals, effectiveMode, effectiveDealId],
  );

  // Default-accept all fields where AI returned a non-empty value that differs
  // from the existing deal (or always for new_deal).
  const defaultAcceptanceKey = `${extraction ? 'x' : 'n'}-${effectiveMode}-${effectiveDealId}`;
  useMemo(() => {
    if (!extraction) return;
    const next: Record<string, boolean> = {};
    for (const f of FIELD_MAP) {
      const aiVal = (extraction.keyTerms[f.aiKey] ?? '').trim();
      if (!aiVal) continue;
      if (effectiveMode === 'new_deal') { next[f.aiKey] = true; continue; }
      const cur = String((existingDeal?.[f.key] as string | undefined) ?? '').trim();
      next[f.aiKey] = cur !== aiVal;
    }
    setAccepted(next);
    const brAcc: Record<string, boolean> = {};
    for (const b of extraction.bookrunners) brAcc[b.name.toLowerCase()] = true;
    setBookrunnerAccepted(brAcc);
    setStageAccepted(Boolean(extraction.suggestedStage));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultAcceptanceKey]);

  if (!extraction) return null;

  const candidateDeals = deals.slice().sort((a, b) => a.issuerName.localeCompare(b.issuerName));

  const handleConfirm = () => {
    const patch: Partial<Deal> = {};
    for (const f of FIELD_MAP) {
      if (!accepted[f.aiKey]) continue;
      const v = (extraction.keyTerms[f.aiKey] ?? '').trim();
      if (!v) continue;
      (patch as any)[f.key] = v;
    }

    // Bookrunners — merge accepted set with existing (for updates)
    const acceptedBr = extraction.bookrunners.filter(b => bookrunnerAccepted[b.name.toLowerCase()]);
    if (acceptedBr.length > 0) {
      if (effectiveMode === 'update_existing' && existingDeal) {
        const merged = new Map<string, Bookrunner>();
        for (const b of existingDeal.bookrunners ?? []) merged.set(b.name.toLowerCase(), b);
        for (const b of acceptedBr) {
          const prev = merged.get(b.name.toLowerCase());
          merged.set(b.name.toLowerCase(), {
            name: b.name,
            role: b.role === 'active' || prev?.role === 'active' ? 'active' : 'passive',
            isGlobalCoordinator: b.isGlobalCoordinator || prev?.isGlobalCoordinator || false,
          });
        }
        patch.bookrunners = Array.from(merged.values());
      } else {
        patch.bookrunners = acceptedBr;
      }
    }

    if (effectiveMode === 'new_deal') {
      // Required Deal fields
      const issuerName = patch.issuerName || 'Unknown Issuer';
      const currency = patch.currency || '';
      const size = patch.size || '';
      const tenor = patch.tenor || '';
      const coupon = patch.coupon || '';
      const stage = (stageAccepted && extraction.suggestedStage ? extraction.suggestedStage : 'Mandate') as DealStage;

      const created = createDeal({
        stage,
        issuerName,
        currency,
        size,
        tenor,
        coupon,
        bookrunners: patch.bookrunners ?? [],
        ...patch,
      } as any, undefined, { sourceChannelId });

      addAuditEntry({
        action: 'AI_EXTRACT_FROM_CHAT',
        entityType: 'deal',
        entityId: created.id,
        userId: currentUser.id,
        details: `Created deal from chat extraction (${conversationLabel}). Confidence ${(extraction.confidence * 100).toFixed(0)}%.`,
      });
      toast({ title: 'Deal created', description: `${issuerName} — review in Deal Data.` });
    } else if (existingDeal) {
      if (Object.keys(patch).length > 0) {
        updateDeal(existingDeal.id, patch);
      }
      if (stageAccepted && extraction.suggestedStage && extraction.suggestedStage !== existingDeal.stage) {
        updateDealStage(existingDeal.id, extraction.suggestedStage as DealStage, 'AI-detected from chat');
      }
      addAuditEntry({
        action: 'AI_EXTRACT_FROM_CHAT',
        entityType: 'deal',
        entityId: existingDeal.id,
        userId: currentUser.id,
        details: `Updated deal from chat extraction (${conversationLabel}). Fields: ${Object.keys(patch).join(', ') || 'stage only'}.`,
      });
      toast({ title: 'Deal updated', description: `${existingDeal.issuerName} — patched ${Object.keys(patch).length} field(s).` });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            AI Deal Extraction — Review
          </DialogTitle>
          <DialogDescription>
            From <span className="font-medium">{conversationLabel || 'chat'}</span>. Confidence{' '}
            <Badge variant="outline" className="ml-1">{(extraction.confidence * 100).toFixed(0)}%</Badge>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-4">
            {/* Mode selector */}
            <div className="rounded-md border border-border bg-card/40 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Action:</span>
                <Select
                  value={effectiveMode}
                  onValueChange={(v) => {
                    setModeOverride(v as any);
                    if (v === 'new_deal') setMatchOverride('');
                  }}
                >
                  <SelectTrigger className="h-7 w-44 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new_deal">Create new deal</SelectItem>
                    <SelectItem value="update_existing">Update existing deal</SelectItem>
                  </SelectContent>
                </Select>

                {effectiveMode === 'update_existing' && (
                  <Select value={effectiveDealId} onValueChange={(v) => setMatchOverride(v)}>
                    <SelectTrigger className="h-7 flex-1 text-xs">
                      <SelectValue placeholder="Select a deal..." />
                    </SelectTrigger>
                    <SelectContent>
                      {candidateDeals.map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.issuerName} {d.currency} {d.size} {d.tenor} — {d.stage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {extraction.matchReason && (
                <p className="text-xs text-muted-foreground italic">AI: {extraction.matchReason}</p>
              )}
            </div>

            {/* Suggested stage */}
            {extraction.suggestedStage && (
              <div className="flex items-center gap-2 text-xs">
                <Checkbox
                  id="stage-accept"
                  checked={stageAccepted}
                  onCheckedChange={(v) => setStageAccepted(Boolean(v))}
                />
                <label htmlFor="stage-accept" className="cursor-pointer">
                  Set stage to <Badge variant="outline">{extraction.suggestedStage}</Badge>
                  {existingDeal && existingDeal.stage !== extraction.suggestedStage && (
                    <span className="text-muted-foreground"> (currently {existingDeal.stage})</span>
                  )}
                </label>
              </div>
            )}

            {/* Fields diff table */}
            <div className="rounded-md border border-border">
              <div className="grid grid-cols-[24px_1fr_1fr_1fr] gap-2 px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border bg-muted/30">
                <span></span><span>Field</span><span>Current</span><span>AI suggests</span>
              </div>
              {FIELD_MAP.map(f => {
                const aiVal = (extraction.keyTerms[f.aiKey] ?? '').trim();
                const cur = String((existingDeal?.[f.key] as string | undefined) ?? '').trim();
                const hasSuggestion = aiVal.length > 0;
                const changed = hasSuggestion && cur !== aiVal;
                if (!hasSuggestion && !cur) return null;
                return (
                  <div
                    key={f.aiKey}
                    className={`grid grid-cols-[24px_1fr_1fr_1fr] gap-2 px-3 py-1.5 text-xs items-center border-b border-border/40 last:border-b-0 ${changed ? '' : 'opacity-60'}`}
                  >
                    <Checkbox
                      disabled={!hasSuggestion}
                      checked={Boolean(accepted[f.aiKey])}
                      onCheckedChange={(v) => setAccepted(s => ({ ...s, [f.aiKey]: Boolean(v) }))}
                    />
                    <span className="font-medium">{f.label}</span>
                    <span className="text-muted-foreground truncate" title={cur}>{cur || '—'}</span>
                    <span
                      className={
                        !hasSuggestion
                          ? 'text-muted-foreground'
                          : changed
                            ? 'text-accent font-bold'
                            : 'text-foreground font-semibold'
                      }
                      title={aiVal}
                    >
                      {aiVal || '—'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Bookrunners */}
            {extraction.bookrunners.length > 0 && (
              <div className="rounded-md border border-border p-3 space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Bookrunners</div>
                {extraction.bookrunners.map(b => (
                  <div key={b.name} className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={Boolean(bookrunnerAccepted[b.name.toLowerCase()])}
                      onCheckedChange={(v) => setBookrunnerAccepted(s => ({ ...s, [b.name.toLowerCase()]: Boolean(v) }))}
                    />
                    <span className="font-medium">{b.name}</span>
                    <Badge variant="outline" className="text-[10px]">{b.role}</Badge>
                    {b.isGlobalCoordinator && <Badge className="text-[10px] bg-accent/20 text-accent border-accent/40">GC</Badge>}
                  </div>
                ))}
              </div>
            )}

            {/* Lifecycle alerts (informational) */}
            {extraction.alerts.length > 0 && (
              <div className="rounded-md border border-border p-3 space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Lifecycle events observed</div>
                <ul className="text-xs list-disc pl-4 space-y-0.5 text-muted-foreground">
                  {extraction.alerts.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            disabled={effectiveMode === 'update_existing' && !existingDeal}
          >
            {effectiveMode === 'new_deal' ? 'Create deal' : 'Apply updates'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}