import NewDealSourceReview, { type IntakeValue } from '@/components/NewDealSourceReview';
import { TEMPLATE_LABELS, withExpected, transitionField, externalState, selectTemplate, type FieldMetadata } from '@/lib/fieldStatus';
import type { RateType } from '@/lib/dealWorkspace';
import { searchLeiByName, type LeiCandidate } from '@/lib/gleif';
import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import { Deal, DealStage, BookrunnerRole, UserRole, Message } from '@/types/bond';
import { format } from 'date-fns';
import { Plus, ChevronRight, ChevronDown, X, Trash2, Megaphone, FileText, Loader2, Undo2, Maximize2, Minimize2, Save } from 'lucide-react';
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
import DealDocuments from '@/components/termsheet/DealDocuments';
import DealCopilot from '@/components/DealCopilot';
import { buildXML, refreshAuto } from '@/lib/termsheet/index.js';
import { setupDemoDeal } from '@/components/DemoDealPanel';
import { isDemoDeal } from '@/data/demoDeal';
import { useApp } from '@/context/AppContext';
import { dealToBdtState, fieldByPath, type BdtState } from '@/lib/bdt-bridge';
import TermSheetField from '@/components/termsheet/TermSheetField';
import { INITIAL_DOCUMENT_PATHS } from '@/lib/documentIntake';
import { termSheetView } from '@/lib/termSheetView';
import { dealBorrowerName } from '@/lib/borrowerName';
import { parseDtsStage } from '@/lib/dtsNavigation';
import { emptyNewDeal, canCreateNewDeal, extractNewDealTerms, mergeNewDealDraft, mergeNewDealBookrunners, mergeDocumentFields } from '@/lib/newDeal';
import RichTextEditor from '@/components/RichTextEditor';
import { bulletinDocuments } from '@/lib/bulletin';
import { Textarea } from '@/components/ui/textarea';
import { findBulletinDraft } from '@/lib/bulletinDraft';
import SendUpdateDialog from '@/components/SendUpdateDialog';
import LiveMsgPanel from '@/components/LiveMsgPanel';
import { Send } from 'lucide-react';
import { downloadBdtFile, validateBdt, type BdtDocument, type ValidationReport } from '@/lib/taxonomy';
import BankIntakeDialog from '@/components/termsheet/BankIntakeDialog';
import DealTermSheets from '@/components/termsheet/DealTermSheets';
import TrancheSwitcher from '@/components/termsheet/TrancheSwitcher';
import { trancheBdtState } from '@/lib/trancheState';
import type { DealWorkspace } from '@/lib/dealWorkspace';
import DealPhaseWorkspace from '@/components/DealPhaseWorkspace';
import { dealPhase, mayEditField } from '@/lib/dealPhase';
import { fromLegacy } from '@/lib/dealWorkspace';
import TrancheStructureEditor, { parseStructureAmount } from '@/components/termsheet/TrancheStructureEditor';
import { parseAmount } from '@/lib/bdt-bridge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/context/AuthContext';
import { setCopilotFocus, getCopilotFocus } from '@/lib/copilot/focus';

function BdtXmlPanel({ deal, override }: { deal: Deal; override?: BdtState }) {
  const state = useMemo(() => { const s = JSON.parse(JSON.stringify(externalState(override ?? dealToBdtState(deal)))); refreshAuto(s); return s; }, [deal, override]);
  const xml = useMemo(() => buildXML(state) as string, [state]);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [intake, setIntake] = useState(false);
  const doc = state as unknown as BdtDocument;
  const base = deal.issuerName || deal.id;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline">More exports</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onSelect={() => downloadBdtFile(doc,'xml',base)}>Download BDT XML</DropdownMenuItem><DropdownMenuItem onSelect={() => downloadBdtFile(doc,'json',base)}>Download BDT JSON</DropdownMenuItem><DropdownMenuItem onSelect={() => downloadBdtFile(doc,'text',base)}>Download standard text</DropdownMenuItem><DropdownMenuItem onSelect={() => setReport(validateBdt(doc))}>BDT validation report</DropdownMenuItem><DropdownMenuItem onSelect={() => setIntake(true)}>Request SDK / API access</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      </div>
      {report && (
        <div className="rounded-md border p-3 text-sm space-y-1">
          <div className="font-medium">{report.isValid ? '✓' : '✗'} {report.summary}</div>
          {report.errors.map((e, i) => <div key={`e${i}`} className="text-destructive">Error: {e.message}</div>)}
          {report.warnings.map((w, i) => <div key={`w${i}`} className="text-muted-foreground">Warning: {w.message}</div>)}
        </div>
      )}
      <pre className="max-h-[600px] overflow-auto rounded-md border border-border/70 bg-card/60 p-3 text-[11px]">{xml}</pre>
      <BankIntakeDialog open={intake} onOpenChange={setIntake} dealId={deal.id} />
    </div>
  );
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
  requestedStage?: number;
  requestedAt?: string;
  onSaveFields: (patch: Partial<Deal>) => Promise<void>;
  initialFiles?: File[];
  onInitialFilesConsumed?: () => void;
}

function DealDetail({ deal, canManage, fromBoard, requestedStage, requestedAt, onSaveFields, initialFiles, onInitialFilesConsumed }: DealDetailProps) {
  const { roles } = useAuth();
  const actualPhase = dealPhase(deal);
  const role = (['master_admin','syndicate_admin','dcm','issuer_legal','counsel'] as UserRole[]).find(r => roles.includes(r)) ?? 'vendor_user';
  const fieldPermission = (p: string) => mayEditField(role, actualPhase, p);
  const canEdit = actualPhase !== 'closed' && (canManage || role === 'dcm' || (actualPhase === 'setup' && (role === 'issuer_legal' || role === 'counsel')));
  const [checkerState, setCheckerState] = useState<BdtState>(() => dealToBdtState(deal));
  const [hasUnsavedTerms, setHasUnsavedTerms] = useState(false);
  const [ws, setWs] = useState<DealWorkspace | null>(null);
  const [trancheIdx, setTrancheIdx] = useState(0);
  useEffect(() => { setTrancheIdx(0); }, [deal.id]);
  const idx = Math.min(trancheIdx, Math.max(0, (ws?.tranches.length ?? 1) - 1));
  const trancheState = useMemo(() => trancheBdtState(checkerState, ws, idx), [checkerState, ws, idx]);
  const savedTrancheState = useMemo(() => trancheBdtState(dealToBdtState(deal), ws, idx), [deal, ws, idx]);
  const view = useMemo(() => termSheetView(trancheState), [trancheState]);
  const switcher = (note?: string) => <TrancheSwitcher state={checkerState} ws={ws} selected={idx} onSelect={setTrancheIdx} note={note} />;
  const navigate = useNavigate();
  const fillRef = useRef<TermSheetFillHandle>(null);
  const [tab, setTab] = useState('sheets');
  const [messageOpen, setMessageOpen] = useState(false);
  const [sendMessageOpen, setSendMessageOpen] = useState(false);
  const { messages } = useApp();
  const [shownStage, setShownStage] = useState<number>(requestedStage ?? 1);
  const consumedFiles = useRef<File[] | null>(null);
  // Board links still pass the stage to All fields, but the deal always opens on Deal term sheets.

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
  useEffect(() => {
    let active = true;
    void supabase.from('deals').select('deal_workspace').eq('id',deal.id).single().then(({data})=>{
      if (!active) return;
      const saved = data?.deal_workspace as unknown as DealWorkspace | null;
      if (saved?.version === 1) setWs(saved);
      else { const base=fromLegacy(null,deal.currency,parseAmount(deal.size)); base.tranches[0].tenor=deal.tenor; base.tranches[0].rateType=deal.bdtState?.template??selectTemplate('',deal.bdtState?.f??{}); setWs(base); }
    });
    return () => {active=false;};
  },[deal.id,deal.updatedAt]);
  const [copilotSlot, setCopilotSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setCopilotSlot(document.getElementById('copilot-slot')); }, []);
  const focusLabel = dealBorrowerName(deal);
  useEffect(() => {
    setCopilotFocus({ kind: 'deal', dealId: deal.id, label: focusLabel, context: '' });
    return () => {
      if (getCopilotFocus()?.dealId === deal.id && getCopilotFocus()?.kind === 'deal') setCopilotFocus(null);
    };
  }, [deal.id, focusLabel]);
  const [ingestSlot, setIngestSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setIngestSlot(document.getElementById(`ingest-slot-${deal.id}`)); }, [deal.id]);

  return (
    <div className="border-t p-5 bg-card/40 space-y-6">
      {copilotSlot && createPortal(<DealCopilot key={deal.id} deal={deal} hasUnsavedTerms={hasUnsavedTerms} mode="drawer" onSendUpdate={canManage && actualPhase !== 'closed' ? () => setSendMessageOpen(true) : undefined} />, copilotSlot)}
      
      <DealPhaseWorkspace deal={deal} phase={actualPhase} ws={ws} dirty={hasUnsavedTerms} canSend={canManage && actualPhase !== 'closed'} onSend={() => setSendMessageOpen(true)} onEditorOpen={t => setTab(t ?? 'sheets')}
        intake={<><IngestDropzone onFiles={ingest} className="w-full min-w-0" compact /><DealDocuments dealId={deal.id} canManage={canEdit} /></>}>
      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        {/* pl-[13px] = the 1px panel border + 12px inner padding used above, so
            this icon sits in the same column as the drop-zone and checker icons. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2 pl-[13px]">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span className="shrink-0 text-sm font-semibold uppercase tracking-wider whitespace-nowrap">Deal Terms</span>
          <UnifiedDealChecker
          state={checkerState}
          ws={ws}
          dealId={deal.id}
          onNavigate={t => { setTab('fill'); setTimeout(() => fillRef.current?.focusTarget(t), 30); }}
          onFix={canEdit ? fn => { setTab('fill'); return fillRef.current?.applyFix(fn) ?? false; } : undefined}
          onDocFix={canEdit ? c => { setTab('fill'); return fillRef.current?.fixFromDocument(c) ?? []; } : undefined}
      />


          <TabsList className="w-full min-w-0 h-auto flex-wrap justify-start">
            <TabsTrigger value="sheets">Deal term sheets</TabsTrigger>
            <TabsTrigger value="view">Standard text</TabsTrigger>
            <TabsTrigger value="xml">XML</TabsTrigger>
            <TabsTrigger value="dlt">DLT</TabsTrigger>
            <TabsTrigger value="fill">All fields</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="fill" forceMount className="mt-4 data-[state=inactive]:hidden">
          <TermSheetFill ingestRef={fillRef} deal={deal} canEdit={canEdit} canEditField={fieldPermission} onSave={onSaveFields} onStateChange={setCheckerState} onDirtyChange={setHasUnsavedTerms} onDisplayedStage={setShownStage} requestedStage={requestedStage} requestedAt={requestedAt} />
        </TabsContent>
        <TabsContent value="sheets" className="mt-4">
          <DealTermSheets deal={deal} canEdit={canEdit} canEditField={fieldPermission} onOpenAllFields={() => setTab('fill')} selected={idx} onSelect={setTrancheIdx} onWorkspace={setWs} />
        </TabsContent>
        <TabsContent value="docs" className="mt-4">
          <DealDocuments dealId={deal.id} canManage={canEdit} defaultOpen />
        </TabsContent>
        <TabsContent value="xml" className="mt-4">
          {switcher()}
          <BdtXmlPanel deal={deal} override={idx > 0 ? savedTrancheState : undefined} />
        </TabsContent>
        <TabsContent value="dlt" className="mt-4">
          {switcher(idx > 0 ? 'Read-only here — edit in the tranche term sheet' : undefined)}
          <TermSheetDlt key={`dlt-${idx}`} deal={deal} canEdit={canManage && actualPhase !== 'closed' && idx === 0} onSave={onSaveFields} override={idx > 0 ? savedTrancheState : undefined} />
        </TabsContent>
        <TabsContent value="view" className="mt-4">
          {switcher()}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Party / Issuer */}
        <div className="space-y-2">
          <h3 className="font-medium text-sm border-b pb-1">Party / Issuer</h3>
          <div className="text-sm space-y-1">
            {fieldRow('Issuer', view.issuerName)}
            {fieldRow('LEI', view.issuerLEI)}
            {fieldRow('Rating', view.issuerRating)}
            {fieldRow('Outlook', view.ratingOutlook)}
          </div>
          <div className="mt-2">
            <h4 className="text-xs font-medium text-muted-foreground mb-1">Bookrunners</h4>
            <div className="space-y-1">
              {view.bookrunners.map((br, i) => (
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
            {fieldRow('Type', view.issuanceType)}
            {fieldRow('Currency', view.currency)}
            {fieldRow('Size', view.size)}
            {fieldRow('Denomination', view.specifiedDenomination)}
            {fieldRow('Coupon', view.coupon)}
            {fieldRow('Issue Price', view.issuePrice)}
            {fieldRow('Reoffer Price', view.reofferPrice)}
            {fieldRow('Reoffer Yield', view.reofferYield)}
            {fieldRow('Reoffer Spread', view.reofferSpread)}
            {fieldRow('Mid-Swap Rate', view.midSwapRate)}
            {fieldRow('Benchmark', view.benchmark)}
            {fieldRow('Pricing Date', view.pricingDate)}
            {fieldRow('Issue Date', view.issueDate)}
            {fieldRow('Settlement Date', view.settlementDate)}
            {fieldRow('Governing Law', view.governingLaw?.replace(/_/g, ' '))}
            {fieldRow('Selling Restrictions', view.sellingRestrictions)}
            {fieldRow('Listing Venue', view.listingVenue)}
          </div>
        </div>

        {/* Product */}
        <div className="space-y-2">
          <h3 className="font-medium text-sm border-b pb-1">Product</h3>
          <div className="text-sm space-y-1">
            {fieldRow('ISIN', view.isin)}
            {fieldRow('CUSIP', view.cusip)}
            {fieldRow('Common Code', view.commonCode)}
            {fieldRow('Form of Note', view.formOfNote?.replace(/_/g, ' '))}
            {fieldRow('Status', view.statusOfNote?.replace(/_/g, ' '))}
            {fieldRow('Tenor', view.tenor)}
            {fieldRow('Maturity', view.maturityDate)}
            {fieldRow('Interest Type', view.interestType)}
            {fieldRow('Interest Rate', view.interestRate)}
            {fieldRow('Payment Freq.', view.interestPaymentFrequency?.replace(/_/g, ' '))}
            {fieldRow('Day Count', view.dayCountFraction?.replace(/_/g, '/'))}
            {fieldRow('Biz Day Conv.', view.businessDayConvention?.replace(/_/g, ' '))}
            {fieldRow('Optionality', view.optionality)}
            {fieldRow('ESG/Label', view.taxonomy)}
          </div>
        </div>
      </div>
        </TabsContent>
      </Tabs>
      </DealPhaseWorkspace>
      {sendMessageOpen && <SendUpdateDialog deal={deal} onClose={() => setSendMessageOpen(false)} />}


      {/* Stage History retained in the compact timeline. */}
      <div className="hidden">
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
  const { isAdmin: authenticatedAdmin, roles: authenticatedRoles, authUser } = useAuth();
  const { deals, messages, createDeal, updateDeal, deleteDeal, undoExtraction, publishBulletinFromDeal, saveBulletinDraft, currentUser, addAuditEntry } = useScopedApp();
  const fullApp = useApp();
  const [demoBusy, setDemoBusy] = useState(false);
  const demoDeal = deals.find(isDemoDeal);
  const loadDemo = async () => {
    if (demoDeal) { setExpandedDealId(demoDeal.id); setFullscreenDealId(demoDeal.id); return; }
    setDemoBusy(true);
    try {
      const d = await setupDemoDeal(fullApp);
      setExpandedDealId(d.id); setFullscreenDealId(d.id);
      toast.success('Demo deal ready', { description: 'Use "Next message" to replay the syndicate blasts.' });
    } catch (e) {
      toast.error('Could not set up the demo deal', { description: (e as Error).message });
    } finally { setDemoBusy(false); }
  };
  const [expandedDealId, setExpandedDealId] = useState<string | null>(null);
  const [fullscreenDealId, setFullscreenDealId] = useState<string | null>(null);
  useEffect(() => { if (fullscreenDealId && fullscreenDealId !== expandedDealId) setFullscreenDealId(null); }, [expandedDealId, fullscreenDealId]);
  const [bulletinDealId, setBulletinDealId] = useState<string | null>(null);
  const [alertDealId, setAlertDealId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createStep,setCreateStep] = useState(1);
  const [template,setTemplate] = useState<RateType>('fixed');
  const [structure,setStructure] = useState<DealWorkspace|null>(null);
  const [reviewValues,setReviewValues] = useState<IntakeValue[]>([]);
  const [intakeSources,setIntakeSources] = useState<Record<string,{source:string;snippet:string}>>({});
  const [issuerLei,setIssuerLei] = useState('');
  const [leiCandidates,setLeiCandidates] = useState<LeiCandidate[]>([]);
  const [newDealFiles, setNewDealFiles] = useState<File[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<{ dealId: string; files: File[] } | null>(null);
  const [newDeal, setNewDeal] = useState(emptyNewDeal);
  const [documentFields, setDocumentFields] = useState<Record<string, string>>({});
  const documentFieldsRef = useRef(documentFields); documentFieldsRef.current = documentFields;
  const documentFieldLocks = useRef(new Set<string>());
  const [extractingIssuer, setExtractingIssuer] = useState(false);
  const issuerRevision = useRef(0);
  const extractionSession = useRef(0);
  useEffect(() => {
    extractionSession.current += 1;
    setExtractingIssuer(false);
  }, [showCreate]);
  const [newBookrunners, setNewBookrunners] = useState<{ name: string; role: BookrunnerRole; isGlobalCoordinator: boolean }[]>([]);
  const newDealRef = useRef(newDeal); newDealRef.current = newDeal;
  const newBookrunnersRef = useRef(newBookrunners); newBookrunnersRef.current = newBookrunners;
  const [brName, setBrName] = useState('');
  const [brRole, setBrRole] = useState<BookrunnerRole>('active');
  const [brGC, setBrGC] = useState(false);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const navigate = useNavigate();

  const canManageDeals = authenticatedAdmin;
  const bulletinDeal = deals.find(d => d.id === bulletinDealId);

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
    const draftDeal = {
      issuerName: newDeal.issuerName.trim(),
      currency: newDeal.currency,
      size: newDeal.size,
      tenor: newDeal.tenor,
      coupon: newDeal.coupon,
      stage: 'Mandate' as const,
      bookrunners: newBookrunners,
      issuerRating: newDeal.issuerRating || undefined,
      issuanceType: (newDeal.issuanceType as any) || undefined,
      governingLaw: (newDeal.governingLaw as any) || undefined,
    };
    const bdtState = dealToBdtState({ ...draftDeal, id: '', createdAt: new Date(), updatedAt: new Date(), stageHistory: [] });
    bdtState.f = { ...bdtState.f, ...documentFields, 'IssuanceDataGroup/Product/InterestPayment/InterestType': template==='floating'?'FLOATING':template==='zero'?'ZERO_COUPON':'FIXED' };
    bdtState.template = template; bdtState.fieldMeta = {};
    if (issuerLei) { const issuer=bdtState.parties.find(p=>p.Roles.includes('ISSUER')); if(issuer)issuer.LEIIdentifier=issuerLei; }
    for(const [p,v] of Object.entries(bdtState.f)) if(v) { const evidence=intakeSources[p]; const next=transitionField(bdtState,p,v,authUser?.id??currentUser.id,evidence?`Document: ${evidence.source} — ${evidence.snippet}`:'Manual creation');bdtState.fieldMeta=next.fieldMeta; }
    if(/target|benchmark/i.test(newDeal.size)) for(const p of ['IssuanceDataGroup/Issuance/TotalAggregateAmount/Value','IssuanceDataGroup/Product/AggregateNominalAmount/Value']) if(bdtState.fieldMeta[p])bdtState.fieldMeta[p].status='open';
    for(const g of ['parties','docs','ratings','ids'] as const) if(bdtState[g]?.length)bdtState.fieldMeta[`group:${g}`]={status:'set',source:'Reviewed deal creation',by:authUser?.id??currentUser.id,at:new Date().toISOString()};
    bdtState.fieldMeta = withExpected(bdtState).fieldMeta;
    refreshAuto(bdtState);
    const ws = structure ?? (() => { const b = fromLegacy(null, newDeal.currency, parseStructureAmount(newDeal.size)); b.tranches[0].tenor = newDeal.tenor; b.tranches[0].rateType = template; return b; })();
    const created = createDeal({ ...draftDeal, bdtState }, undefined, { workspace: ws });
    setExpandedDealId(created.id);
    // A newly created deal opens like any deal clicked from the list: expanded and full size.
    setFullscreenDealId(created.id);
    if (newDealFiles.length) {
      setPendingDocuments({ dealId: created.id, files: newDealFiles });
      setExpandedDealId(created.id);
    }
    setNewDealFiles([]); setReviewValues([]); setCreateStep(1); setStructure(null); setIssuerLei(''); setLeiCandidates([]);
    setShowCreate(false);
    setNewDeal(emptyNewDeal());
    setDocumentFields({}); documentFieldLocks.current.clear();
    setNewBookrunners([]);
  };

  const handleNewDealFiles = async (files: FileList) => {
    const selected = Array.from(files);
    setNewDealFiles(prev => [...prev, ...selected]);
    if (extractingIssuer) return;
    const revision = issuerRevision.current;
    const session = extractionSession.current;
    setExtractingIssuer(true);
    let count = 0;
    try {
      for (const file of selected) {
        const { draft, bookrunners, fields = {}, text = '', template: suggested } = await extractNewDealTerms(file);
        if (session !== extractionSession.current) return;
        if(suggested)setTemplate(suggested);
        const quote=(value:string)=>{const pos=text.toLowerCase().indexOf(value.toLowerCase());return pos<0?'':text.slice(Math.max(0,pos-100),Math.min(text.length,pos+value.length+200));};
        const pending:IntakeValue[]=[...Object.entries(draft).filter(([,v])=>v).map(([key,value])=>({key,label:key.replace(/([A-Z])/g,' $1'),value:String(value),source:file.name,snippet:quote(String(value)),kind:'draft' as const})),...Object.entries(fields).map(([key,value])=>({key,label:fieldByPath(key)?.l??key,value,source:file.name,snippet:quote(value),kind:'field' as const})),...(bookrunners.length?[{key:'bookrunners',label:'Bookrunners',value:bookrunners.map(b=>b.name).join(', '),source:file.name,snippet:quote(bookrunners[0].name),kind:'bookrunners' as const}]:[])];
        setReviewValues(v=>[...v,...pending]);setCreateStep(2);count+=pending.length;
      }
      if (count) toast.success(`Found ${count} values to review`);
      else toast.info('No new terms found; please enter them manually');
    } catch {
      if (session === extractionSession.current) toast.info('Document added, but terms could not be read; please enter them manually');
    } finally {
      if (session === extractionSession.current) setExtractingIssuer(false);
    }
  };

  const [searchParams] = useSearchParams();
  useEffect(() => {
    const dealId = searchParams.get('dealId');
    if (dealId && deals.some(d => d.id === dealId)) {
      setExpandedDealId(dealId); setFullscreenDealId(dealId);
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
      if (fullscreenDealId) { setFullscreenDealId(null); return; }
      setExpandedDealId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expandedDealId, fullscreenDealId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Digital Term Sheet</h1>
          <p className="text-muted-foreground text-sm">Track bond deals from Mandate to Settled · ICMA Bond Data Taxonomy aligned</p>
        </div>
        {canManageDeals && (
          <Button variant="outline" className="ml-auto mr-2" onClick={loadDemo} disabled={demoBusy}>
            {demoBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {demoDeal ? 'Open demo deal' : 'Load demo deal'}
          </Button>
        )}
        {canManageDeals && (
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="lg" className="font-semibold"><Plus className="h-5 w-5 mr-2" />Create New Deal</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl w-[calc(100%-2rem)] max-h-[85vh] overflow-y-auto border-2 border-active-panel">
              <DialogHeader><DialogTitle className="flex items-center gap-2">Create New Deal<span className="ml-auto mr-6"><AiModelPicker compact /></span></DialogTitle></DialogHeader>
              <nav className="flex gap-2 border-b border-border pb-2">{[[1,'Document'],[2,'Review'],[3,'Template']].map(([n,l])=><Button key={n} size="sm" variant={createStep===n?'secondary':'ghost'} onClick={()=>setCreateStep(Number(n))}>{n}. {l}</Button>)}</nav>
              {createStep===1&&<div className="space-y-3"><IngestDropzone onFiles={handleNewDealFiles} className="w-full min-w-0"/>{extractingIssuer&&<p role="status">Reading deal terms…</p>}<Button variant="outline" onClick={()=>setCreateStep(2)}>Enter manually</Button></div>}
              {createStep===2&&reviewValues.length>0&&<NewDealSourceReview values={reviewValues} onChange={(i,value)=>setReviewValues(v=>v.map((r,n)=>n===i?{...r,value}:r))} onReject={i=>setReviewValues(v=>v.filter((_,n)=>n!==i))} onAccept={i=>{const r=reviewValues[i];if(!r)return;if(r.kind==='draft')setNewDeal(v=>({...v,[r.key]:r.value}));else if(r.kind==='field')setDocumentFields(v=>({...v,[r.key]:r.value}));else setNewBookrunners(v=>[...v,...r.value.split(',').map(name=>({name:name.trim(),role:'active' as const,isGlobalCoordinator:false}))]);setIntakeSources(v=>({...v,[r.key]:{source:r.source,snippet:r.snippet}}));setReviewValues(v=>v.filter((_,n)=>n!==i));}}/>}
              {createStep===2&&<div className="min-w-0 space-y-3">
                <div><Label htmlFor="new-deal-issuer">Issuer Name *</Label><Input id="new-deal-issuer" required value={newDeal.issuerName} onChange={e => { issuerRevision.current += 1; setNewDeal(p => ({ ...p, issuerName: e.target.value })); }} placeholder="e.g. Republic of France" /></div>
                <div className="flex flex-wrap items-center gap-2"><Input aria-label="Issuer LEI" value={issuerLei} onChange={e=>setIssuerLei(e.target.value)} placeholder="LEI" className="flex-1"/><Button variant="outline" disabled={!newDeal.issuerName} onClick={async()=>setLeiCandidates(await searchLeiByName(newDeal.issuerName))}>GLEIF suggestions</Button></div>{leiCandidates.map(c=><Button key={c.lei} size="sm" variant="ghost" className="h-auto whitespace-normal text-left" onClick={()=>{setIssuerLei(c.lei);setLeiCandidates([]);}}>{c.legalName} · {c.lei}</Button>)}
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

                {newDealFiles.length > 0 && (
                  <div className="space-y-3 border-t border-border pt-3">
                    <h3 className="text-sm font-medium">Document terms</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {INITIAL_DOCUMENT_PATHS.map(path => {
                        const fd = fieldByPath(path);
                        return fd ? <TermSheetField key={path} fd={fd} value={documentFields[path] ?? ''} onChange={value => {
                          documentFieldLocks.current.add(path);
                          setDocumentFields(current => ({ ...current, [path]: value }));
                        }} /> : null;
                      })}
                    </div>
                  </div>
                )}
                <Button onClick={()=>{const b=fromLegacy(null,newDeal.currency,parseStructureAmount(newDeal.size));b.tranches[0].tenor=newDeal.tenor;b.tranches[0].rateType=template;setStructure(b);setCreateStep(3);}} disabled={extractingIssuer || reviewValues.length>0}>Choose template</Button>
                {extractingIssuer && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Reading deal terms…</p>}
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
              </div>}
              {createStep===3&&<div className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div className="text-lg font-semibold">Deal structure</div><div className="space-y-1"><Label htmlFor="new-deal-aggregate">Aggregate Total (USD Equiv.)</Label><Input id="new-deal-aggregate" className="h-8 sm:w-56" placeholder="Optional" onChange={e=>setStructure(w=>w&&{...w,aggregateUsd:parseStructureAmount(e.target.value)})}/></div></div>{structure&&<TrancheStructureEditor value={structure} onChange={w=>{setStructure(w);setTemplate(w.tranches[0].rateType);}}/>}<Label>Deal template (Tranche A)</Label><Select value={template} onValueChange={v=>{setTemplate(v as RateType);setStructure(w=>w&&{...w,tranches:w.tranches.map((t,i)=>i===0?{...t,rateType:v as RateType}:t)});}}><SelectTrigger aria-label="Deal template"><SelectValue/></SelectTrigger><SelectContent>{Object.entries(TEMPLATE_LABELS).map(([k,l])=><SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select><Button onClick={handleCreateDeal} className="w-full" disabled={extractingIssuer || reviewValues.length>0 || !canCreateNewDeal(newDeal.issuerName,newBookrunners)}>Create Deal</Button></div>}
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
          const full = expanded && fullscreenDealId === deal.id;
          return (
            <Card key={deal.id} ref={(el) => { rowRefs.current[deal.id] = el; }} className={`transition-colors ${expanded ? 'border-2 border-active-panel' : ''} ${full ? 'fixed inset-x-0 top-12 bottom-0 z-30 overflow-auto rounded-none' : 'overflow-hidden'}`}>
              <div className="flex items-center">
                {expanded && (
                  <button
                    type="button"
                    onClick={() => setFullscreenDealId(full ? null : deal.id)}
                    aria-label={full ? 'Exit full screen' : 'Expand term sheet to full screen'}
                    title={full ? 'Exit full screen (Esc)' : 'Expand to full screen'}
                    className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-border text-foreground hover:bg-accent"
                  >
                    {full ? <Minimize2 className="h-4 w-4" strokeWidth={3} /> : <Maximize2 className="h-4 w-4" strokeWidth={3} />}
                  </button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setExpandedDealId(expanded ? null : deal.id);
                    setFullscreenDealId(expanded ? null : deal.id);
                  }}
                  className={`${expanded ? 'flex-none' : 'flex-1 min-w-0'} h-auto justify-start rounded-none text-left px-4 py-3 flex items-center gap-3 hover:bg-accent/40 transition-colors`}
                >
                  <span className="text-muted-foreground shrink-0">
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </span>
                  <DealCheckFlag deal={deal} />
                  <span className="font-semibold text-sm truncate">{dealBorrowerName(deal)}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {deal.currency} {deal.size} · {deal.tenor}
                  </span>
                  {!expanded && (
                    <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
                      Updated {format(deal.updatedAt, 'MMM d, HH:mm')}
                    </span>
                  )}
                </Button>
                {expanded && (
                  <>
                    <div id={`ingest-slot-${deal.id}`} className="flex min-w-0 flex-1 items-center px-2" />
                    <span className="hidden px-2 text-[10px] text-muted-foreground whitespace-nowrap md:inline">
                      Updated {format(deal.updatedAt, 'MMM d, HH:mm')}
                    </span>
                  </>
                )}
                {canManageDeals && (
                  <>
                    {findBulletinDraft(messages, deal.id) ? (
                      <Button type="button" variant="outline" size="icon"
                        aria-label="View bulletin draft" title="Bulletin draft — view saved draft"
                        className="m-2 h-9 w-9 border-[3px] border-warning text-warning hover:border-warning hover:text-warning"
                        onClick={e => { e.stopPropagation(); setBulletinDealId(deal.id); }}>
                        <Megaphone className="h-4 w-4" />
                      </Button>
                    ) : bulletinByDeal.has(deal.id) ? (
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
                  {!expanded && deal.stage !== 'Settled' && <Button type="button" variant="outline" size="icon" aria-label="Send update" title="Send update — email new-issue alert"
                    className="m-2 ml-0 h-9 w-9" onClick={e => { e.stopPropagation(); setAlertDealId(deal.id); }}>
                    <Send className="h-4 w-4" />
                  </Button>}
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
                    requestedStage={searchParams.get('dealId') === deal.id ? parseDtsStage(searchParams.get('stage')) : undefined}
                    requestedAt={searchParams.get('at') ?? undefined}
                    onSaveFields={async (patch) => {
                      if (authenticatedRoles.includes('dcm') && !authenticatedAdmin && patch.bdtState) {
                        const original = dealToBdtState(deal);
                        const state = { ...original, f: { ...original.f }, parties: patch.bdtState.parties, fieldMeta: {...original.fieldMeta} };
                        for(const [p,m] of Object.entries((patch.bdtState.fieldMeta??{}) as FieldMetadata))if(mayEditField('dcm',dealPhase(deal),p))state.fieldMeta[p]=m;
                        for (const [p,v] of Object.entries(patch.bdtState.f)) if (mayEditField('dcm',dealPhase(deal),p)) state.f[p] = String(v);
                        patch = { bdtState:state, currency:patch.currency, size:patch.size, tenor:patch.tenor, maturityDate:patch.maturityDate, interestType:patch.interestType, bookrunners:patch.bookrunners };
                      }
                      await updateDeal(deal.id, { ...patch, updatedAt: new Date() });
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

      {alertDealId && deals.find(d => d.id === alertDealId) && (
        <SendUpdateDialog key={alertDealId} deal={deals.find(d => d.id === alertDealId)!} onClose={() => setAlertDealId(null)} />
      )}
      {bulletinDeal && (
        <GenerateBulletinDialog
          key={bulletinDeal.id}
          deal={bulletinDeal}
          draft={findBulletinDraft(messages, bulletinDeal.id)}
          saveDraft={saveBulletinDraft}
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
  draft,
  saveDraft,
}: {
  deal: Deal;
  onClose: () => void;
  onPublished: (msgId: string) => void;
  publish: (dealId: string, args: { subject: string; body: string }, draftId?: string) => Promise<Message>;
  draft?: Message;
  saveDraft: (dealId: string, args: { subject: string; body: string }) => Promise<Message>;
}) {
  const [loading, setLoading] = useState(!draft);
  const [saving, setSaving] = useState(false);
  const [subject, setSubject] = useState(draft?.subject ?? '');
  const [body, setBody] = useState(draft?.body ?? '');
  const [error, setError] = useState<string | null>(null);
  const [aiModel] = useAiModel();
  const [generation, setGeneration] = useState(0);
  const [sourceWarning, setSourceWarning] = useState('');
  const editedRef = useRef('');

  useEffect(() => {
    if (draft && generation === 0) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSourceWarning('');
    bulletinDocuments(deal.id).then(async ({ docs, failed }) => {
      if (cancelled) return { data: null, error: null };
      if (failed.length) setSourceWarning(`Could not read: ${failed.join(', ')}. These documents were not used.`);
      return supabase.functions.invoke('generate-bulletin-from-deal', { body: { dealId: deal.id, model: aiModel, docs, editedBulletin: editedRef.current.split('<h3>Legal Notices</h3>')[0] || undefined } });
    })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          let detail = error.message || 'Failed to generate bulletin';
          void (async () => {
            try { const response = await (error as { context?: Response }).context?.json(); detail = response?.message || detail; } catch { /* keep error */ }
            if (!cancelled) setError(detail);
          })();
          setError(detail);
          setLoading(false);
          return;
        }
        setSubject((data as any)?.subject || `${deal.issuerName} ${deal.currency} ${deal.size} ${deal.tenor}`);
        const fresh: string = (data as any)?.body || '';
        const keptLegal = editedRef.current.includes('<h3>Legal Notices</h3>') ? '<h3>Legal Notices</h3>' + editedRef.current.split('<h3>Legal Notices</h3>')[1] : '';
        setBody(keptLegal && !(data as any)?.hasLegalNotices ? fresh.split('<h3>Legal Notices</h3>')[0] + keptLegal : fresh);
        if (!data?.hasLegalNotices) setSourceWarning(w => [w, 'No sourced legal notices found. Add the official announcement before publishing if required.'].filter(Boolean).join(' '));
        setLoading(false);
      }).catch(e => { if (!cancelled) { setError(e instanceof Error ? e.message : 'Could not read deal documents.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [deal.id, aiModel, generation]);

  const handleSave = async (asDraft: boolean) => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Bulletin needs a headline and body.');
      return;
    }
    setSaving(true);
    try {
      if (asDraft) {
        await saveDraft(deal.id, { subject: subject.trim(), body });
        toast.success('Bulletin draft saved in Digital Term Sheet');
        onClose();
      } else {
        const msg = await publish(deal.id, { subject: subject.trim(), body }, draft?.id);
        toast.success('Bulletin published to New Issue Board');
        onPublished(msg.id);
      }
    } catch (e) {
      toast.error(asDraft ? 'Could not save bulletin draft' : 'Could not publish bulletin', { description: e instanceof Error ? e.message : 'Please retry.' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-card via-card to-navy-deep/80 border border-border/60 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.6)] backdrop-blur-sm">
        <DialogHeader className="border-b border-border/50 pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-success/15 text-success">
              <Megaphone className="h-4 w-4" />
            </span>
            {draft ? 'New Issue Bulletin — Draft' : 'Generate New Issue Bulletin'}
            <span className="ml-auto mr-6"><AiModelPicker compact /></span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-3">
          <Button variant="outline" disabled={loading || saving} onClick={() => { editedRef.current = body; setGeneration(g => g + 1); }}><Undo2 className="h-4 w-4 mr-2" />Regenerate bulletin</Button>
          <span className="text-xs text-muted-foreground">Keeps your edits and adds the latest saved Fill and Execution Essentials terms.</span>
        </div>
        {sourceWarning && <p role="status" className="text-sm text-warning">{sourceWarning}</p>}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading documents and drafting bulletin…
          </div>
        ) : error ? (
          <div className="text-sm text-destructive py-6">{error}</div>
        ) : (
          <div className="space-y-5">
            <div>
              <Label htmlFor="bulletin-headline" className="text-xs font-medium text-muted-foreground">Headline</Label>
              <Input id="bulletin-headline" disabled={saving} value={subject} onChange={e => setSubject(e.target.value)} className="mt-1" />
            </div>

            <div className="rounded-lg border-2 border-success/70 bg-card/60 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_32px_-12px_rgba(34,197,94,0.25)]">
              <div className="flex items-center justify-between px-3 py-2 border-b border-success/20">
                <span className="text-xs font-semibold uppercase tracking-wide text-success">Preview</span>
                <span className="text-[10px] text-muted-foreground">Click to edit</span>
              </div>
              <RichTextEditor value={body} onChange={setBody} className="max-h-[55vh] border-0" contentClassName="p-5 text-sm text-white [&_p]:text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_li]:text-white [&_strong]:text-white [&_th]:text-white [&_td]:text-white" />
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-border/50">
              <Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
              <Button variant="outline" disabled={saving} onClick={() => void handleSave(true)}>
                <Save className="h-4 w-4 mr-1" /> Save as Draft
              </Button>
              <Button disabled={saving} onClick={() => void handleSave(false)} className="bg-success text-success-foreground hover:bg-success/90">
                <Megaphone className="h-4 w-4 mr-1" /> Publish to New Issue Board
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
