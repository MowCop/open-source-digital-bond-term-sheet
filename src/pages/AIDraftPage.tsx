import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Attachment } from '@/types/bond';
import { Checkbox } from '@/components/ui/checkbox';
import { Bookrunner } from '@/types/bond';
import { extractBookrunners, simulateAIExtraction } from '@/lib/alertParsing';
import { Sparkles, Paperclip, Send, Save, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function AIDraftPage() {
  const { distributionLists, createMessage, createDeal, currentUser, users } = useApp();
  const { toast } = useToast();

  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [aiFields, setAiFields] = useState<Record<string, string> | null>(null);
  const [aiBookrunners, setAiBookrunners] = useState<Bookrunner[]>([]);
  const [aiConfidence, setAiConfidence] = useState<number>(0);
  const [sendTarget, setSendTarget] = useState<'all' | 'selected'>('all');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isExtractingAttachment, setIsExtractingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Vendor/distribution recipients
  const vendorUsers = users.filter(u => u.organizationType === 'vendor');

  // Auto-extract AI fields when headline or body changes
  useEffect(() => {
    const combined = `${headline} ${body}`.trim();
    if (combined.length < 10) {
      setAiFields(null);
      setAiBookrunners([]);
      return;
    }
    const timer = setTimeout(() => {
      const result = simulateAIExtraction(combined);
      const nonEmpty = Object.entries(result.keyTerms).filter(([, v]) => v);
      const bookrunners = extractBookrunners(combined);
      if (nonEmpty.length > 0 || bookrunners.length > 0) {
        setAiFields(result.keyTerms);
        setAiConfidence(result.confidence);
        setAiBookrunners(bookrunners);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [headline, body]);

  const toAttachment = (file: File): Attachment => ({
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: file.name,
    type: file.name.endsWith('.pdf') ? 'pdf' : file.name.endsWith('.docx') ? 'docx' : 'pptx',
    size: file.size,
    url: '',
  });

  const applyExtractedText = (text: string, fileName: string) => {
    const clean = text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
    if (!clean) return;
    const result = simulateAIExtraction(clean);
    const subjectLine = result.headline && !result.headline.startsWith('Issuer ')
      ? result.headline
      : fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');

    setHeadline(prev => prev.trim() ? prev : subjectLine);
    setBody(prev => prev.trim() ? `${prev.trim()}\n\n${clean}` : clean);
    setAiFields(result.keyTerms);
    setAiConfidence(result.confidence);
    setAiBookrunners(extractBookrunners(clean));
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setAttachments(prev => [...prev, ...files.map(toAttachment)]);

    const docxFiles = files.filter(file => file.name.toLowerCase().endsWith('.docx'));
    if (docxFiles.length === 0) {
      toast({ title: 'Files attached', description: `${files.length} file(s) added` });
      return;
    }

    setIsExtractingAttachment(true);
    try {
      const mammoth = (await import('mammoth/mammoth.browser')).default;
      for (const file of docxFiles) {
        const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        applyExtractedText(value, file.name);
      }
      toast({ title: 'AI extraction complete', description: `Extracted terms from ${docxFiles.length} Word attachment(s).` });
    } catch (error) {
      console.error('Attachment extraction failed', error);
      toast({ title: 'Extraction failed', description: 'The Word attachment could not be read.', variant: 'destructive' });
    } finally {
      setIsExtractingAttachment(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    void handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    void handleFiles(files);
    e.target.value = '';
  };

  const toggleRecipient = (id: string) => {
    setSelectedRecipients(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedRecipients(vendorUsers.map(u => u.id));
  };

  const deselectAll = () => {
    setSelectedRecipients([]);
  };

  const createDealFromFields = () => {
    return createDeal({
      issuerName: aiFields?.['Issuer Name'] || headline.split(/\s+/).slice(0, 3).join(' ') || 'New Deal',
      currency: aiFields?.['Currency'] || '',
      size: aiFields?.['Size'] || '',
      tenor: aiFields?.['Tenor'] || '',
      coupon: aiFields?.['Coupon'] || '',
      stage: 'Mandate',
      bookrunners: aiBookrunners ?? [],
      issuerRating: aiFields?.['Issuer Rating'] || undefined,
      issuerLEI: aiFields?.['LEI'] || undefined,
      isin: aiFields?.['ISIN'] || undefined,
      reofferSpread: aiFields?.['Reoffer Spread'] || undefined,
      issuePrice: aiFields?.['Issue Price'] || undefined,
      reofferPrice: aiFields?.['Reoffer Price'] || undefined,
      reofferYield: aiFields?.['Reoffer Yield'] || undefined,
      midSwapRate: aiFields?.['Mid-Swap Rate'] || undefined,
      pricingDate: aiFields?.['Pricing Date'] || undefined,
      settlementDate: aiFields?.['Settlement Date'] || undefined,
      maturityDate: aiFields?.['Maturity Date'] || undefined,
      specifiedDenomination: aiFields?.['Denomination'] || undefined,
      governingLaw: aiFields?.['Governing Law'] ? aiFields['Governing Law'].toUpperCase().replace(/ /g, '_') as any : undefined,
      listingVenue: aiFields?.['Listing'] || undefined,
    });
  };

  const handleSave = () => {
    if (!headline.trim()) {
      toast({ title: 'Missing headline', description: 'Please enter a deal headline', variant: 'destructive' });
      return;
    }
    const deal = createDealFromFields();
    createMessage({
      dealIds: [deal.id],
      subject: headline,
      body,
      status: 'draft',
      senderId: currentUser.id,
      recipients: selectedRecipients,
      attachments,
      aiSuggestions: aiFields ? { headline, borrowerDetails: '', dealSummary: '', keyTerms: aiFields, confidence: aiConfidence } : undefined,
    });
    toast({ title: 'Draft Saved', description: 'Issue saved as draft in New Issue Board.' });
  };

  const handleSend = () => {
    if (!headline.trim()) {
      toast({ title: 'Missing headline', description: 'Please enter a deal headline', variant: 'destructive' });
      return;
    }
    if (selectedRecipients.length === 0) {
      toast({ title: 'No recipients', description: 'Select at least one distribution recipient', variant: 'destructive' });
      return;
    }
    const deal = createDealFromFields();
    createMessage({
      dealIds: [deal.id],
      subject: headline,
      body,
      status: 'sent',
      senderId: currentUser.id,
      recipients: selectedRecipients,
      attachments,
      aiSuggestions: aiFields ? { headline, borrowerDetails: '', dealSummary: '', keyTerms: aiFields, confidence: aiConfidence } : undefined,
    });
    toast({ title: 'Alert Sent', description: `Sent to ${selectedRecipients.length} recipient(s)` });
    setHeadline(''); setBody(''); setAttachments([]); setSelectedRecipients([]); setAiFields(null); setAiBookrunners([]);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Create New Issue</h1>
        <p className="text-muted-foreground text-sm">Draft a new message to automatically generate deal records.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Left: Main compose area */}
        <div className="col-span-2 flex flex-col">
          <div className="bg-card border border-border rounded-lg flex-1 flex flex-col">
            {/* Headline */}
            <Input
              value={headline}
              onChange={e => setHeadline(e.target.value)}
              placeholder="Enter deal headline (e.g. Republic of Italy EUR 1.5bn 10Y BTP Syndication)"
              className="border-0 border-b border-border rounded-none text-base px-4 py-4 h-auto bg-transparent focus-visible:ring-0 placeholder:text-muted-foreground/50"
            />
            {/* Body */}
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Enter message body..."
              className="border-0 rounded-none flex-1 min-h-[200px] px-4 py-3 bg-transparent focus-visible:ring-0 resize-none placeholder:text-muted-foreground/50"
            />
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={`px-4 py-4 border-t border-border text-sm text-muted-foreground/50 transition-colors ${isDragOver ? 'bg-accent/10' : ''}`}
            >
              {attachments.length > 0 ? (
                <div className="space-y-1">
                  {isExtractingAttachment && (
                    <div className="flex items-center gap-2 text-xs text-accent">
                      <Sparkles className="h-3 w-3 animate-pulse" />
                      Extracting headline, body, and deal fields from attachment…
                    </div>
                  )}
                  {attachments.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-foreground">
                      <Paperclip className="h-3 w-3" />
                      <span>{f.name}</span>
                      <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-destructive ml-auto text-[10px]">✕</button>
                    </div>
                  ))}
                </div>
              ) : (
                'Drag and drop PDF, Word, or PPT files here to attach them.'
              )}
            </div>
          </div>

          {/* Bottom action bar */}
          <div className="flex items-center gap-3 mt-3 px-1">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-4 w-4 mr-1" /> Attach
            </Button>
            <div className="flex-1" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Send to <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {distributionLists.map(dl => (
                  <DropdownMenuItem key={dl.id} onClick={() => setSelectedRecipients(dl.memberIds || [])}>
                    {dl.name} ({(dl.memberIds || []).length})
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={handleSave}>
              <Save className="h-4 w-4 mr-1" /> Save
            </Button>
            <Button size="sm" onClick={handleSend} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Send className="h-4 w-4 mr-1" /> Send
            </Button>
          </div>
        </div>

        {/* Right: AI extraction + Distribution */}
        <div className="space-y-4">
          {/* AI Field Extraction */}
          <div className="bg-card border border-border rounded-lg">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="font-semibold text-sm">AI Field Extraction</span>
              {aiFields && (
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {(aiConfidence * 100).toFixed(0)}%
                </Badge>
              )}
            </div>
            <div className="p-4">
              {aiFields ? (
                <div className="space-y-2">
                  {Object.entries(aiFields).map(([key, value]) => (
                    value ? (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground w-24 shrink-0">{key}</span>
                        <span className="text-foreground font-medium">{value}</span>
                      </div>
                    ) : null
                  ))}
                  {aiBookrunners.length > 0 && (
                    <div className="flex items-start gap-2 text-xs pt-2 border-t border-border">
                      <span className="text-muted-foreground w-24 shrink-0 mt-1">Bookrunners</span>
                      <div className="flex flex-wrap gap-1">
                        {aiBookrunners.map(b => (
                          <Badge key={b.name} variant="secondary" className="text-[10px]">
                            {b.name}{b.isGlobalCoordinator ? ' (GC)' : ''}{b.role === 'passive' ? ' (P)' : ''}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {Object.values(aiFields).every(v => !v) && aiBookrunners.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No fields detected yet.</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Sparkles className="h-10 w-10 mb-3 opacity-20" />
                  <p className="text-xs text-center">Start typing a headline or message body to auto-extract deal fields.</p>
                </div>
              )}
            </div>
          </div>

          {/* Distribution */}
          <div className="bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-semibold text-sm uppercase tracking-wider">Distribution</span>
              <button
                onClick={selectedRecipients.length === vendorUsers.length ? deselectAll : selectAll}
                className="text-xs text-accent hover:underline"
              >
                {selectedRecipients.length === vendorUsers.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="divide-y divide-border">
              {vendorUsers.map(v => (
                <label key={v.id} className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-card/60 transition-colors">
                  <span className="text-sm">{v.organization}</span>
                  <Checkbox
                    checked={selectedRecipients.includes(v.id)}
                    onCheckedChange={() => toggleRecipient(v.id)}
                  />
                </label>
              ))}
              {distributionLists.map(dl => (
                <label key={dl.id} className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-card/60 transition-colors">
                  <span className="text-sm">{dl.name} <span className="text-muted-foreground text-xs">({(dl.memberIds || []).length})</span></span>
                  <Checkbox
                    checked={(dl.memberIds || []).every(id => selectedRecipients.includes(id))}
                    onCheckedChange={checked => {
                      if (checked) {
                        setSelectedRecipients(prev => [...new Set([...prev, ...(dl.memberIds || [])])]);
                      } else {
                        setSelectedRecipients(prev => prev.filter(id => !(dl.memberIds || []).includes(id)));
                      }
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
