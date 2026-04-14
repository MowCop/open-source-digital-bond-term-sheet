import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Deal, DealStage } from '@/types/bond';
import { format } from 'date-fns';
import { Plus, ChevronRight } from 'lucide-react';

const STAGES: DealStage[] = ['Mandate', 'Announced', 'Launched', 'Books Open', 'Books Closed', 'Priced', 'Settled'];
const stageColors: Record<string, string> = {
  Mandate: 'stage-mandate', Announced: 'stage-mandate', Launched: 'stage-launched',
  'Books Open': 'stage-launched', 'Books Closed': 'stage-launched', Priced: 'stage-priced', Settled: 'stage-closed',
};

export default function DealsPage() {
  const { deals, createDeal, updateDealStage, currentUser } = useApp();
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [stageNote, setStageNote] = useState('');
  const [newDeal, setNewDeal] = useState({ borrower: '', currency: 'EUR', size: '', tenor: '', coupon: 'TBD', spread: 'TBD', rating: '' });

  const canManageDeals = currentUser.role === 'syndicate_admin' || currentUser.role === 'master_admin';

  const handleCreateDeal = () => {
    createDeal({ ...newDeal, stage: 'Mandate', leadManagers: [currentUser.organization] });
    setShowCreate(false);
    setNewDeal({ borrower: '', currency: 'EUR', size: '', tenor: '', coupon: 'TBD', spread: 'TBD', rating: '' });
  };

  const getNextStage = (current: DealStage): DealStage | null => {
    const idx = STAGES.indexOf(current);
    return idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deal Data</h1>
          <p className="text-muted-foreground text-sm">Track bond deals from Mandate to Settled</p>
        </div>
        {canManageDeals && (
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Deal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create New Deal</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Borrower</Label><Input value={newDeal.borrower} onChange={e => setNewDeal(p => ({ ...p, borrower: e.target.value }))} placeholder="e.g. Republic of France" /></div>
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
                  <div><Label>Rating</Label><Input value={newDeal.rating} onChange={e => setNewDeal(p => ({ ...p, rating: e.target.value }))} placeholder="e.g. AA/Aa2" /></div>
                </div>
                <Button onClick={handleCreateDeal} className="w-full" disabled={!newDeal.borrower || !newDeal.size}>Create Deal</Button>
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
                <CardTitle className="text-sm">{deal.borrower}</CardTitle>
                <Badge className={stageColors[deal.stage]}>{deal.stage}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>{deal.currency} {deal.size} — {deal.tenor}</div>
                <div>Coupon: {deal.coupon} | Spread: {deal.spread}</div>
                {deal.rating && <div>Rating: {deal.rating}</div>}
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
              <CardTitle>{selectedDeal.borrower} — {selectedDeal.currency} {selectedDeal.tenor}</CardTitle>
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
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="font-medium text-sm">Deal Details</h3>
                <div className="text-sm space-y-1">
                  <div><span className="text-muted-foreground">Size:</span> {selectedDeal.currency} {selectedDeal.size}</div>
                  <div><span className="text-muted-foreground">Tenor:</span> {selectedDeal.tenor}</div>
                  <div><span className="text-muted-foreground">Coupon:</span> {selectedDeal.coupon}</div>
                  <div><span className="text-muted-foreground">Spread:</span> {selectedDeal.spread}</div>
                  {selectedDeal.isin && <div><span className="text-muted-foreground">ISIN:</span> {selectedDeal.isin}</div>}
                  {selectedDeal.rating && <div><span className="text-muted-foreground">Rating:</span> {selectedDeal.rating}</div>}
                  <div><span className="text-muted-foreground">Lead Managers:</span> {selectedDeal.leadManagers.join(', ')}</div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium text-sm">Stage History</h3>
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
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
