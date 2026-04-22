import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Deal, DealStage, BookrunnerRole } from '@/types/bond';
import { format } from 'date-fns';
import { Plus, ChevronRight, X } from 'lucide-react';

const STAGES: DealStage[] = ['Mandate', 'Announced', 'Launched', 'Books Open', 'Books Closed', 'Priced', 'Settled'];
const stageColors: Record<string, string> = {
  Mandate: 'stage-mandate', Announced: 'stage-mandate', Launched: 'stage-launched',
  'Books Open': 'stage-launched', 'Books Closed': 'stage-launched', Priced: 'stage-priced', Settled: 'stage-closed',
};

const roleColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  passive: 'bg-gray-100 text-gray-700',
};

export default function DealsPage() {
  const { deals, createDeal, updateDealStage, currentUser } = useApp();
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [stageNote, setStageNote] = useState('');
  const [newDeal, setNewDeal] = useState({
    issuerName: '', currency: 'EUR', size: '', tenor: '', coupon: 'TBD',
    issuerRating: '', issuanceType: '' as string, governingLaw: '' as string,
  });
  const [newBookrunners, setNewBookrunners] = useState<{ name: string; role: BookrunnerRole; isGlobalCoordinator: boolean }[]>([]);
  const [brName, setBrName] = useState('');
  const [brRole, setBrRole] = useState<BookrunnerRole>('active');
  const [brGC, setBrGC] = useState(false);

  const canManageDeals = currentUser.role === 'syndicate_admin' || currentUser.role === 'master_admin';

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

  const getNextStage = (current: DealStage): DealStage | null => {
    const idx = STAGES.indexOf(current);
    return idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
  };

  const fieldRow = (label: string, value: string | undefined) => {
    return <div><span className="text-muted-foreground">{label}:</span> {value && value.trim() ? value : 'TBA'}</div>;
  };

  const [searchParams] = useSearchParams();
  useEffect(() => {
    const dealId = searchParams.get('dealId');
    if (dealId) {
      const d = deals.find(x => x.id === dealId);
      if (d) setSelectedDeal(d);
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

      {/* Deal List */}
      <div className="grid grid-cols-3 gap-4">
        {deals.map(deal => (
          <Card key={deal.id} className={`cursor-pointer transition-shadow hover:shadow-md ${selectedDeal?.id === deal.id ? 'ring-2 ring-primary' : ''}`} onClick={() => setSelectedDeal(deal)}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{deal.issuerName}</CardTitle>
                <Badge className={stageColors[deal.stage]}>{deal.stage}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>{deal.currency} {deal.size} — {deal.tenor}</div>
                <div>Coupon: {deal.coupon} | Spread: {deal.reofferSpread || 'TBD'}</div>
                {deal.issuerRating && <div>Rating: {deal.issuerRating}</div>}
                {deal.taxonomy && <Badge className="text-[9px] bg-emerald-100 text-emerald-800 mt-1">{deal.taxonomy}</Badge>}
                <div className="pt-1 text-muted-foreground/70">Updated: {format(deal.updatedAt, 'MMM d, HH:mm')}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Deal Detail Panel */}
      {selectedDeal && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{selectedDeal.issuerName} — {selectedDeal.currency} {selectedDeal.tenor}</CardTitle>
              {canManageDeals && getNextStage(selectedDeal.stage) && (
                <div className="flex items-center gap-2">
                  <Input value={stageNote} onChange={e => setStageNote(e.target.value)} placeholder="Stage transition note..." className="w-64" />
                  <Button onClick={() => { updateDealStage(selectedDeal.id, getNextStage(selectedDeal.stage)!, stageNote || undefined); setStageNote(''); setSelectedDeal({ ...selectedDeal, stage: getNextStage(selectedDeal.stage)! }); }}>
                    Advance to {getNextStage(selectedDeal.stage)} <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              {/* Party / Issuer */}
              <div className="space-y-2">
                <h3 className="font-medium text-sm border-b pb-1">Party / Issuer</h3>
                <div className="text-sm space-y-1">
                  {fieldRow('Issuer', selectedDeal.issuerName)}
                  {fieldRow('LEI', selectedDeal.issuerLEI)}
                  {fieldRow('Rating', selectedDeal.issuerRating)}
                  {fieldRow('Outlook', selectedDeal.ratingOutlook)}
                </div>
                <div className="mt-2">
                  <h4 className="text-xs font-medium text-muted-foreground mb-1">Bookrunners</h4>
                  <div className="space-y-1">
                    {selectedDeal.bookrunners.map((br, i) => (
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
                  {fieldRow('Type', selectedDeal.issuanceType)}
                  {fieldRow('Size', `${selectedDeal.currency} ${selectedDeal.size}`)}
                  {fieldRow('Denomination', selectedDeal.specifiedDenomination)}
                  {fieldRow('Coupon', selectedDeal.coupon)}
                  {fieldRow('Issue Price', selectedDeal.issuePrice)}
                  {fieldRow('Reoffer Price', selectedDeal.reofferPrice)}
                  {fieldRow('Reoffer Yield', selectedDeal.reofferYield)}
                  {fieldRow('Reoffer Spread', selectedDeal.reofferSpread)}
                  {fieldRow('Mid-Swap Rate', selectedDeal.midSwapRate)}
                  {fieldRow('Pricing Date', selectedDeal.pricingDate)}
                  {fieldRow('Issue Date', selectedDeal.issueDate)}
                  {fieldRow('Settlement Date', selectedDeal.settlementDate)}
                  {fieldRow('Governing Law', selectedDeal.governingLaw?.replace(/_/g, ' '))}
                  {fieldRow('Selling Restrictions', selectedDeal.sellingRestrictions)}
                  {fieldRow('Listing Venue', selectedDeal.listingVenue)}
                </div>
              </div>

              {/* Product */}
              <div className="space-y-2">
                <h3 className="font-medium text-sm border-b pb-1">Product</h3>
                <div className="text-sm space-y-1">
                  {fieldRow('ISIN', selectedDeal.isin)}
                  {fieldRow('CUSIP', selectedDeal.cusip)}
                  {fieldRow('Common Code', selectedDeal.commonCode)}
                  {fieldRow('Form of Note', selectedDeal.formOfNote?.replace(/_/g, ' '))}
                  {fieldRow('Status', selectedDeal.statusOfNote?.replace(/_/g, ' '))}
                  {fieldRow('Tenor', selectedDeal.tenor)}
                  {fieldRow('Maturity', selectedDeal.maturityDate)}
                  {fieldRow('Interest Type', selectedDeal.interestType)}
                  {fieldRow('Interest Rate', selectedDeal.interestRate)}
                  {fieldRow('Payment Freq.', selectedDeal.interestPaymentFrequency?.replace(/_/g, ' '))}
                  {fieldRow('Day Count', selectedDeal.dayCountFraction?.replace(/_/g, '/'))}
                  {fieldRow('Biz Day Conv.', selectedDeal.businessDayConvention?.replace(/_/g, ' '))}
                  {fieldRow('Optionality', selectedDeal.optionality)}
                  {fieldRow('ESG/Label', selectedDeal.taxonomy)}
                </div>
              </div>
            </div>

            {/* Stage History */}
            <div className="mt-6 space-y-2">
              <h3 className="font-medium text-sm border-b pb-1">Stage History</h3>
              {selectedDeal.stageHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No transitions yet</p>
              ) : (
                <div className="space-y-2">
                  {selectedDeal.stageHistory.map((t, i) => (
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
