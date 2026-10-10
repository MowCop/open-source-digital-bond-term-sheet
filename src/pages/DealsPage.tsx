import { useState, useEffect, useMemo, useRef } from 'react';
import { useAiModel } from '@/lib/aiModel';
import AiModelPicker from '@/components/AiModelPicker';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useScopedApp } from '@/context/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Deal, DealStage, BookrunnerRole, UserRole } from '@/types/bond';
import { format } from 'date-fns';
import { Plus, ChevronRight, ChevronDown, X, ArrowLeft, Trash2, Megaphone, FileText, Loader2, Undo2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import DealCheckFlag from '@/components/DealCheckFlag';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TermSheetFill, { type TermSheetFillHandle } from '@/components/termsheet/TermSheetFill';
import IngestDropzone from '@/components/termsheet/IngestDropzone';
import TermSheetDlt from '@/components/termsheet/TermSheetDlt';
import UnifiedDealChecker from '@/components/termsheet/UnifiedDealChecker';
import { buildXML, refreshAuto } from '@/lib/termsheet/index.js';
import { dealToBdtState, type BdtState } from '@/lib/bdt-bridge';
import { emptyNewDeal, canCreateNewDeal, extractNewDealIssuer, fillEmptyIssuer } from '@/lib/newDeal';

function BdtXmlPanel({ deal }: { deal: Deal }) {
  const xml = useMemo(() => { const s = dealToBdtState(deal); refreshAuto(s); return buildXML(s) as string; }, [deal]);
  return <pre className="max-h-[600px] overflow-auto rounded-md border border-border/70 bg-card/60 p-3 text-[11px]">{xml}</pre>;
}

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

interface DealDetailProps {
  deal: Deal;
  canManage: boolean;
  fromBoard?: boolean;
  onSaveFields: (patch: Partial<Deal>) => void;
  initialFiles?: File[];
  onInitialFilesConsumed?: () => void;
}

function DealDetail({ deal, canManage, fromBoard, onSaveFields, initialFiles, onInitialFilesConsumed }: DealDetailProps) {
  const [checkerState, setCheckerState] = useState<BdtState>(() => dealToBdtState(deal));
  const navigate = useNavigate();
  const fillRef = useRef<TermSheetFillHandle>(null);
  const [tab, setTab] = useState('fill');
  const consumedFiles = useRef<File[] | null>(null);

  useEffect(() => {
    if (!initialFiles?.length || consumedFiles.current === initialFiles || !fillRef.current) return;
    consumedFiles.current = initialFiles;
    setTab('fill');
    void fillRef.current.ingestFiles(initialFiles).finally(() => onInitialFilesConsumed?.());
  }, [initialFiles, onInitialFilesConsumed]);

  // The drop panel sits in this header row; the Fill tab owns the proposals.
  const ingest = async (files: FileList) => {
    const found = await fillRef.current?.ingestFiles(files);
    if (found) setTab('fill');
  };

  useEffect(() => {
    setCheckerState(dealToBdtState(deal));
  }, [deal.id, deal.bdtState]);

  return (
    <div className="border-t p-5 bg-card/40 space-y-6">
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
      {canManage && (
        <div className="flex w-full items-center">
          <IngestDropzone onFiles={ingest} className="flex-1" />
        </div>
      )}

      <UnifiedDealChecker state={checkerState} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="fill">Fill</TabsTrigger>
          <TabsTrigger value="view">View</TabsTrigger>
          <TabsTrigger value="xml">BDT XML</TabsTrigger>
          <TabsTrigger value="dlt">DLT view</TabsTrigger>
        </TabsList>
        <TabsContent value="fill" forceMount className="mt-4 data-[state=inactive]:hidden">
          <TermSheetFill ingestRef={fillRef} deal={deal} canEdit={canManage} onSave={onSaveFields} onStateChange={setCheckerState} />
        </TabsContent>
        <TabsContent value="xml" className="mt-4">
          <BdtXmlPanel deal={deal} />
        </TabsContent>
        <TabsContent value="dlt" className="mt-4">
          <TermSheetDlt deal={deal} canEdit={canManage} onSave={onSaveFields} />
        </TabsContent>
        <TabsContent value="view" className="mt-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        </TabsContent>
      </Tabs>

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
  const { deals, messages, createDeal, updateDeal, deleteDeal, undoExtraction, publishBulletinFromDeal, currentUser, addAuditEntry } = useScopedApp();
  const [expandedDealId, setExpandedDealId] = useState<string | null>(null);
  const [bulletinDealId, setBulletinDealId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newDealFiles, setNewDealFiles] = useState<File[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<{ dealId: string; files: File[] } | null>(null);
  const [newDeal, setNewDeal] = useState(emptyNewDeal);
  const [extractingIssuer, setExtractingIssuer] = useState(false);
  const issuerRevision = useRef(0);
  const extractionSession = useRef(0);
  useEffect(() => {
    extractionSession.current += 1;
    setExtractingIssuer(false);
  }, [showCreate]);
  const [newBookrunners, setNewBookrunners] = useState<{ name: string; role: BookrunnerRole; isGlobalCoordinator: boolean }[]>([]);
  const [brName, setBrName] = useState('');
  const [brRole, setBrRole] = useState<BookrunnerRole>('active');
  const [brGC, setBrGC] = useState(false);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const navigate = useNavigate();

  const canManageDeals = currentUser.role === 'syndicate_admin' || currentUser.role === 'master_admin';

  const bulletinByDeal = useMemo(() => {
    const m = new Map<string, string>(); // dealId -> messageId
    for (const msg of messages) {
      if (msg.bulletinSource === 'deal_data' && msg.status === 'sent') {
        for (const did of msg.dealIds) if (!m.has(did)) m.set(did, msg.id);
      }
    }
    return m;
  }, [messages]);

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
    if (!canCreateNewDeal(newDeal.issuerName, newBookrunners)) return;
    const created = createDeal({
      issuerName: newDeal.issuerName.trim(),
      currency: newDeal.currency,
      size: newDeal.size,
      tenor: newDeal.tenor,
      coupon: newDeal.coupon,
      stage: 'Mandate',
      bookrunners: newBookrunners,
      issuerRating: newDeal.issuerRating || undefined,
      issuanceType: (newDeal.issuanceType as any) || undefined,
      governingLaw: (newDeal.governingLaw as any) || undefined,
    });
    if (newDealFiles.length) {
      setPendingDocuments({ dealId: created.id, files: newDealFiles });
      setExpandedDealId(created.id);
    }
    setNewDealFiles([]);
    setShowCreate(false);
    setNewDeal(emptyNewDeal());
    setNewBookrunners([]);
  };

  const handleNewDealFiles = async (files: FileList) => {
    const selected = Array.from(files);
    setNewDealFiles(prev => [...prev, ...selected]);
    if (newDeal.issuerName.trim() || extractingIssuer) return;
    const revision = issuerRevision.current;
    const session = extractionSession.current;
    setExtractingIssuer(true);
    try {
      for (const file of selected) {
        const issuer = await extractNewDealIssuer(file);
        if (session !== extractionSession.current || revision !== issuerRevision.current) return;
        if (issuer) {
          setNewDeal(prev => ({ ...prev, issuerName: fillEmptyIssuer(prev.issuerName, issuer) }));
          toast.success(`Issuer found in ${file.name}; please check the name`);
          return;
        }
      }
      toast.info('No issuer name found; please enter it manually');
    } catch {
      if (session === extractionSession.current) toast.info('Document added, but the issuer could not be identified; please enter it manually');
    } finally {
      if (session === extractionSession.current) setExtractingIssuer(false);
    }
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

  // Esc collapses any open deal panel back to the main list
  useEffect(() => {
    if (!expandedDealId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Ignore when typing in inputs or when a dialog/modal is open
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      setExpandedDealId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expandedDealId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Digital Term Sheet</h1>
          <p className="text-muted-foreground text-sm">Track bond deals from Mandate to Settled · ICMA Bond Data Taxonomy aligned</p>
        </div>
        {canManageDeals && (
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Deal</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg w-[calc(100%-2rem)] max-h-[85vh] overflow-y-auto border-2 border-active-panel">
              <DialogHeader><DialogTitle className="flex items-center gap-2">Create New Deal<span className="ml-auto mr-6"><AiModelPicker compact /></span></DialogTitle></DialogHeader>
              <div className="min-w-0 space-y-3">
                <div><Label htmlFor="new-deal-issuer">Issuer Name *</Label><Input id="new-deal-issuer" required value={newDeal.issuerName} onChange={e => { issuerRevision.current += 1; setNewDeal(p => ({ ...p, issuerName: e.target.value })); }} placeholder="e.g. Republic of France" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Currency</Label>
                    <Select value={newDeal.currency} onValueChange={v => setNewDeal(p => ({ ...p, currency: v }))}>
                      <SelectTrigger aria-label="Currency"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent><SelectItem value="EUR">EUR</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="GBP">GBP</SelectItem><SelectItem value="CHF">CHF</SelectItem><SelectItem value="multi currency">multi currency</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Size</Label><Input value={newDeal.size} onChange={e => setNewDeal(p => ({ ...p, size: e.target.value }))} placeholder="Benchmark" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Tenor</Label><Input value={newDeal.tenor} onChange={e => setNewDeal(p => ({ ...p, tenor: e.target.value }))} placeholder="e.g. 10Y or multi tranche" /></div>
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
                  <Label className="font-medium">Bookrunners *</Label>
                  {newBookrunners.map((br, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="flex-1">{br.name}</span>
                      <Badge className={`text-[10px] ${roleColors[br.role]}`}>{br.role}</Badge>
                      {br.isGlobalCoordinator && <Badge className="text-[10px] bg-purple-100 text-purple-800">GC</Badge>}
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setNewBookrunners(prev => prev.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button>
                    </div>
                  ))}
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1"><Input value={brName} onChange={e => setBrName(e.target.value)} placeholder="Bank name" className="h-8 text-xs" /></div>
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

                <Button onClick={handleCreateDeal} className="w-full" disabled={!canCreateNewDeal(newDeal.issuerName, newBookrunners)}>Create Deal</Button>
                <IngestDropzone onFiles={handleNewDealFiles} className="w-full min-w-0 overflow-hidden" />
                {extractingIssuer && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Looking for issuer name…</p>}
                {newDealFiles.length > 0 && (
                  <div className="space-y-1">
                    {newDealFiles.map((file, i) => (
                      <div key={`${file.name}-${i}`} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{file.name}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={`Remove ${file.name}`} onClick={() => setNewDealFiles(prev => prev.filter((_, index) => index !== i))}><X className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>
                )}
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
                  <DealCheckFlag deal={deal} />
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
                  <>
                    {bulletinByDeal.has(deal.id) ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Bulletin published"
                        title="Bulletin published — view on New Issue Board"
                        className="m-2 h-9 w-9 opacity-50 text-muted-foreground"
                        onClick={e => { e.stopPropagation(); navigate(`/messages?dealId=${deal.id}`); }}
                      >
                        <Megaphone className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Generate New Issue Bulletin"
                        title="Generate New Issue Bulletin"
                        className="m-2 h-9 w-9 btn-champagne"
                        onClick={e => { e.stopPropagation(); setBulletinDealId(deal.id); }}
                      >
                        <Megaphone className="h-4 w-4" style={{ color: '#f3d98a' }} />
                      </Button>
                    )}
                  {deal.extractionSnapshot && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Undo AI Extraction"
                          title="Undo AI Extraction — delete this deal and restore the original chat thread"
                          className="m-2 h-8 w-8 text-muted-foreground hover:text-amber-600"
                          onClick={e => e.stopPropagation()}
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Undo AI Extraction?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will delete the extracted deal &ldquo;{deal.issuerName} {deal.currency} {deal.size} · {deal.tenor}&rdquo; and restore the source chat thread to its state before the AI Extraction was run. Bulletins, alerts, and deal-scoped notifications for this deal will be removed. The original chat messages are preserved.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => undoExtraction(deal.id)}>
                            Undo extraction
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
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
                  </>
                )}
              </div>
              {expanded && (
                <CardContent className="p-0">
                  <DealDetail
                    deal={deal}
                    canManage={canManageDeals}
                    initialFiles={pendingDocuments?.dealId === deal.id ? pendingDocuments.files : undefined}
                    onInitialFilesConsumed={() => setPendingDocuments(null)}
                    fromBoard={!!searchParams.get('dealId')}
                    onSaveFields={(patch) => {
                      updateDeal(deal.id, { ...patch, updatedAt: new Date() });
                      addAuditEntry({
                        action: 'deal_termsheet_updated',
                        entityType: 'deal',
                        entityId: deal.id,
                        userId: currentUser.id,
                        details: `Digital Term Sheet updated: ${Object.keys(patch).join(', ')}`,
                      });
                    }}
                  />
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {bulletinDealId && (
        <GenerateBulletinDialog
          deal={deals.find(d => d.id === bulletinDealId)!}
          onClose={() => setBulletinDealId(null)}
          onPublished={(msgId) => {
            setBulletinDealId(null);
            navigate(`/messages?dealId=${bulletinDealId}`);
          }}
          publish={publishBulletinFromDeal}
        />
      )}
    </div>
  );
}

function GenerateBulletinDialog({
  deal,
  onClose,
  onPublished,
  publish,
}: {
  deal: Deal;
  onClose: () => void;
  onPublished: (msgId: string) => void;
  publish: (dealId: string, args: { subject: string; body: string }) => { id: string };
}) {
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aiModel] = useAiModel();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase.functions.invoke('generate-bulletin-from-deal', { body: { dealId: deal.id, model: aiModel } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message || 'Failed to generate bulletin');
          setLoading(false);
          return;
        }
        setSubject((data as any)?.subject || `${deal.issuerName} ${deal.currency} ${deal.size} ${deal.tenor}`);
        setBody((data as any)?.body || '');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [deal.id, aiModel]);

  const handlePublish = () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Bulletin needs a headline and body.');
      return;
    }
    const msg = publish(deal.id, { subject: subject.trim(), body });
    toast.success('Bulletin published to New Issue Board');
    onPublished(msg.id);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-card via-card to-navy-deep/80 border border-border/60 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.6)] backdrop-blur-sm">
        <DialogHeader className="border-b border-border/50 pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-success/15 text-success">
              <Megaphone className="h-4 w-4" />
            </span>
            Generate New Issue Bulletin
            <span className="ml-auto mr-6"><AiModelPicker compact /></span>
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Drafting bulletin from Digital Term Sheet…
          </div>
        ) : error ? (
          <div className="text-sm text-destructive py-6">{error}</div>
        ) : (
          <div className="space-y-5">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Headline</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} className="mt-1" />
            </div>

            <div className="rounded-lg border-2 border-success/70 bg-card/60 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_32px_-12px_rgba(34,197,94,0.25)]">
              <div className="flex items-center justify-between px-3 py-2 border-b border-success/20">
                <span className="text-xs font-semibold uppercase tracking-wide text-success">Preview</span>
                <span className="text-[10px] text-muted-foreground">Announcement preview</span>
              </div>
              <div className="max-h-[55vh] overflow-y-auto rounded-md bg-background/70 p-5 text-sm prose prose-sm max-w-none text-white [&_p]:text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_h4]:text-white [&_li]:text-white [&_strong]:text-white [&_em]:text-white [&_a]:text-white [&_a]:underline" dangerouslySetInnerHTML={{ __html: body }} />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handlePublish} className="bg-success text-success-foreground hover:bg-success/90">
                <Megaphone className="h-4 w-4 mr-1" /> Publish to New Issue Board
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
