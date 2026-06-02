import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useScopedApp } from '@/context/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Deal, DealStage, BookrunnerRole } from '@/types/bond';
import { format } from 'date-fns';
import { Plus, ChevronRight, ChevronDown, X, ArrowLeft, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const STAGES: DealStage[] = ['Mandate', 'Announced', 'Launched', 'Books Open', 'Books Closed', 'Priced', 'Settled'];
const stageColors: Record<string, string> = {
  Mandate: 'stage-mandate', Announced: 'stage-mandate', Launched: 'stage-launched',
  'Books Open': 'stage-launched', 'Books Closed': 'stage-launched', Priced: 'stage-priced', Settled: 'stage-closed',
};
const roleColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  passive: 'bg-gray-100 text-gray-700',
};

const fieldRow = (label: string, value: string | undefined) => (
  <div><span className="text-muted-foreground">{label}:</span> {value && value.trim() ? value : 'TBA'}</div>
);

const getNextStage = (current: DealStage): DealStage | null => {
  const idx = STAGES.indexOf(current);
  return idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
};

interface DealDetailProps {
  deal: Deal;
  canManage: boolean;
  onAdvance: (next: DealStage, note?: string) => void;
  fromBoard?: boolean;
}

function DealDetail({ deal, canManage, onAdvance, fromBoard }: DealDetailProps) {
  const [stageNote, setStageNote] = useState('');
  const next = getNextStage(deal.stage);
  const navigate = useNavigate();

  return (
    <div className="border-t p-5 bg-card/40 space-y-6">
      <div className="flex items-center justify-between">
        {fromBoard && (
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-muted-foreground hover:text-foreground -ml-2"
            onClick={() => navigate(`/messages?dealId=${deal.id}`)}
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            Back to New Issue Board
          </Button>
        )}
        {canManage && next && (
          <div className="flex items-center gap-2">
          <Input value={stageNote} onChange={e => setStageNote(e.target.value)} placeholder="Stage transition note..." className="w-64 h-8 text-xs" />
          <Button size="sm" onClick={() => { onAdvance(next, stageNote || undefined); setStageNote(''); }}>
            Advance to {next} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Party / Issuer */}
        <div className="space-y-2">
          <h3 className="font-medium text-sm border-b pb-1">Party / Issuer</h3>
          <div className="text-sm space-y-1">
            {fieldRow('Issuer', deal.issuerName)}
            {fieldRow('LEI', deal.issuerLEI)}
            {fieldRow('Rating', deal.issuerRating)}
            {fieldRow('Outlook', deal.ratingOutlook)}
          </div>
          <div className="mt-2">
            <h4 className="text-xs font-medium text-muted-foreground mb-1">Bookrunners</h4>
            <div className="space-y-1">
              {deal.bookrunners.map((br, i) => (
                <div key={i} className="flex items-center gap-1.5 text-sm">
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  <span className="flex-1">{br.name}</span>
                  <Badge className={`text-[9px] px-1 py-0 ${roleColors[br.role]}`}>{br.role === 'active' ? 'Active' : 'Passive'}</Badge>
                  {br.isGlobalCoordinator && <Badge className="text-[9px] px-1 py-0 bg-purple-100 text-purple-800">GC</Badge>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Issuance */}
        <div className="space-y-2">
          <h3 className="font-medium text-sm border-b pb-1">Issuance</h3>
          <div className="text-sm space-y-1">
            {fieldRow('Type', deal.issuanceType)}
            {fieldRow('Size', `${deal.currency} ${deal.size}`)}
            {fieldRow('Denomination', deal.specifiedDenomination)}
            {fieldRow('Coupon', deal.coupon)}
            {fieldRow('Issue Price', deal.issuePrice)}
            {fieldRow('Reoffer Price', deal.reofferPrice)}
            {fieldRow('Reoffer Yield', deal.reofferYield)}
            {fieldRow('Reoffer Spread', deal.reofferSpread)}
            {fieldRow('Mid-Swap Rate', deal.midSwapRate)}
            {fieldRow('Pricing Date', deal.pricingDate)}
            {fieldRow('Issue Date', deal.issueDate)}
            {fieldRow('Settlement Date', deal.settlementDate)}
            {fieldRow('Governing Law', deal.governingLaw?.replace(/_/g, ' '))}
            {fieldRow('Selling Restrictions', deal.sellingRestrictions)}
            {fieldRow('Listing Venue', deal.listingVenue)}
          </div>
        </div>

        {/* Product */}
        <div className="space-y-2">
          <h3 className="font-medium text-sm border-b pb-1">Product</h3>
          <div className="text-sm space-y-1">
            {fieldRow('ISIN', deal.isin)}
            {fieldRow('CUSIP', deal.cusip)}
            {fieldRow('Common Code', deal.commonCode)}
            {fieldRow('Form of Note', deal.formOfNote?.replace(/_/g, ' '))}
            {fieldRow('Status', deal.statusOfNote?.replace(/_/g, ' '))}
            {fieldRow('Tenor', deal.tenor)}
            {fieldRow('Maturity', deal.maturityDate)}
            {fieldRow('Interest Type', deal.interestType)}
            {fieldRow('Interest Rate', deal.interestRate)}
            {fieldRow('Payment Freq.', deal.interestPaymentFrequency?.replace(/_/g, ' '))}
            {fieldRow('Day Count', deal.dayCountFraction?.replace(/_/g, '/'))}
            {fieldRow('Biz Day Conv.', deal.businessDayConvention?.replace(/_/g, ' '))}
            {fieldRow('Optionality', deal.optionality)}
            {fieldRow('ESG/Label', deal.taxonomy)}
          </div>
        </div>
      </div>

      {/* Stage History */}
      <div className="space-y-2">
        <h3 className="font-medium text-sm border-b pb-1">Stage History</h3>
        {deal.stageHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transitions yet</p>
        ) : (
          <div className="space-y-2">
            {deal.stageHistory.map((t, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div>
                  <div>{t.from} → {t.to}</div>
                  <div className="text-xs text-muted-foreground">{format(t.timestamp, 'MMM d, HH:mm')}{t.note && ` — ${t.note}`}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DealsPage() {
  const { deals, createDeal, updateDealStage, deleteDeal, currentUser } = useScopedApp();
  const [expandedDealId, setExpandedDealId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newDeal, setNewDeal] = useState({
    issuerName: '', currency: 'EUR', size: '', tenor: '', coupon: 'TBD',
    issuerRating: '', issuanceType: '' as string, governingLaw: '' as string,
  });
  const [newBookrunners, setNewBookrunners] = useState<{ name: string; role: BookrunnerRole; isGlobalCoordinator: boolean }[]>([]);
  const [brName, setBrName] = useState('');
  const [brRole, setBrRole] = useState<BookrunnerRole>('active');
  const [brGC, setBrGC] = useState(false);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const canManageDeals = currentUser.role === 'syndicate_admin' || currentUser.role === 'master_admin';

  const sortedDeals = useMemo(
    () => [...deals].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    [deals]
  );

  const handleAddBookrunner = () => {
    if (!brName.trim()) return;
    setNewBookrunners(prev => [...prev, { name: brName.trim(), role: brRole, isGlobalCoordinator: brGC }]);
    setBrName(''); setBrRole('active'); setBrGC(false);
  };

  const handleCreateDeal = () => {
    createDeal({
      issuerName: newDeal.issuerName,
      currency: newDeal.currency,
      size: newDeal.size,
      tenor: newDeal.tenor,
      coupon: newDeal.coupon,
      stage: 'Mandate',
      bookrunners: newBookrunners.length > 0 ? newBookrunners : [{ name: currentUser.organization, role: 'active', isGlobalCoordinator: true }],
      issuerRating: newDeal.issuerRating || undefined,
      issuanceType: (newDeal.issuanceType as any) || undefined,
      governingLaw: (newDeal.governingLaw as any) || undefined,
    });
    setShowCreate(false);
    setNewDeal({ issuerName: '', currency: 'EUR', size: '', tenor: '', coupon: 'TBD', issuerRating: '', issuanceType: '', governingLaw: '' });
    setNewBookrunners([]);
  };

  const [searchParams] = useSearchParams();
  useEffect(() => {
    const dealId = searchParams.get('dealId');
    if (dealId && deals.some(d => d.id === dealId)) {
      setExpandedDealId(dealId);
      // Scroll once the row mounts
      setTimeout(() => {
        rowRefs.current[dealId]?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }, 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, deals]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deal Data</h1>
          <p className="text-muted-foreground text-sm">Track bond deals from Mandate to Settled · ICMA Bond Data Taxonomy aligned</p>
        </div>
        {canManageDeals && (
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Deal</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create New Deal</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Issuer Name</Label><Input value={newDeal.issuerName} onChange={e => setNewDeal(p => ({ ...p, issuerName: e.target.value }))} placeholder="e.g. Republic of France" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Currency</Label>
                    <Select value={newDeal.currency} onValueChange={v => setNewDeal(p => ({ ...p, currency: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="EUR">EUR</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="GBP">GBP</SelectItem><SelectItem value="CHF">CHF</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Size</Label><Input value={newDeal.size} onChange={e => setNewDeal(p => ({ ...p, size: e.target.value }))} placeholder="e.g. 2,000,000,000" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Tenor</Label><Input value={newDeal.tenor} onChange={e => setNewDeal(p => ({ ...p, tenor: e.target.value }))} placeholder="e.g. 10Y" /></div>
                  <div><Label>Rating</Label><Input value={newDeal.issuerRating} onChange={e => setNewDeal(p => ({ ...p, issuerRating: e.target.value }))} placeholder="e.g. AA/Aa2" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Issuance Type</Label>
                    <Select value={newDeal.issuanceType} onValueChange={v => setNewDeal(p => ({ ...p, issuanceType: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent><SelectItem value="STANDALONE">Standalone</SelectItem><SelectItem value="PROGRAMME">Programme</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Governing Law</Label>
                    <Select value={newDeal.governingLaw} onValueChange={v => setNewDeal(p => ({ ...p, governingLaw: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ENGLISH_LAW">English Law</SelectItem>
                        <SelectItem value="NEW_YORK_LAW">New York Law</SelectItem>
                        <SelectItem value="GERMAN_LAW">German Law</SelectItem>
                        <SelectItem value="FRENCH_LAW">French Law</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Bookrunners */}
                <div className="border rounded-md p-3 space-y-2">
                  <Label className="font-medium">Bookrunners</Label>
                  {newBookrunners.map((br, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="flex-1">{br.name}</span>
                      <Badge className={`text-[10px] ${roleColors[br.role]}`}>{br.role}</Badge>
                      {br.isGlobalCoordinator && <Badge className="text-[10px] bg-purple-100 text-purple-800">GC</Badge>}
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setNewBookrunners(prev => prev.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button>
                    </div>
                  ))}
                  <div className="flex items-end gap-2">
                    <div className="flex-1"><Input value={brName} onChange={e => setBrName(e.target.value)} placeholder="Bank name" className="h-8 text-xs" /></div>
                    <Select value={brRole} onValueChange={v => setBrRole(v as BookrunnerRole)}>
                      <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="passive">Passive</SelectItem></SelectContent>
                    </Select>
                    <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                      <input type="checkbox" checked={brGC} onChange={e => setBrGC(e.target.checked)} /> GC
                    </label>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleAddBookrunner}>Add</Button>
                  </div>
                </div>

                <Button onClick={handleCreateDeal} className="w-full" disabled={!newDeal.issuerName || !newDeal.size}>Create Deal</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Deal Pipeline */}
      <div className="grid grid-cols-7 gap-2">
        {STAGES.map(stage => (
          <div key={stage} className="text-center">
            <div className={`text-xs font-medium px-2 py-1 rounded ${stageColors[stage]}`}>{stage}</div>
            <div className="text-lg font-bold mt-1">{deals.filter(d => d.stage === stage).length}</div>
          </div>
        ))}
      </div>

      {/* Headline list */}
      <div className="space-y-2">
        {sortedDeals.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">No deals yet</div>
        )}
        {sortedDeals.map(deal => {
          const expanded = expandedDealId === deal.id;
          return (
            <Card key={deal.id} ref={(el) => { rowRefs.current[deal.id] = el; }} className="overflow-hidden">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setExpandedDealId(prev => prev === deal.id ? null : deal.id)}
                  className="flex-1 min-w-0 text-left px-4 py-3 flex items-center gap-3 hover:bg-accent/40 transition-colors"
                >
                  <span className="text-muted-foreground shrink-0">
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </span>
                  <span className="font-semibold text-sm truncate">{deal.issuerName}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {deal.currency} {deal.size} · {deal.tenor}
                  </span>
                  <Badge className={`text-[10px] ${stageColors[deal.stage]}`}>{deal.stage}</Badge>
                  <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
                    Updated {format(deal.updatedAt, 'MMM d, HH:mm')}
                  </span>
                </button>
                {canManageDeals && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Delete deal"
                        className="m-2 h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={e => e.stopPropagation()}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this deal?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete &ldquo;{deal.issuerName} {deal.currency} {deal.size} · {deal.tenor}&rdquo; along with all related alerts, chat threads, chat messages and notifications. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => deleteDeal(deal.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
              {expanded && (
                <CardContent className="p-0">
                  <DealDetail
                    deal={deal}
                    canManage={canManageDeals}
                    onAdvance={(next, note) => updateDealStage(deal.id, next, note)}
                    fromBoard={!!searchParams.get('dealId')}
                  />
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
