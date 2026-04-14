import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AISuggestion } from '@/types/bond';
import { Bot, Sparkles, Check, Edit2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function simulateAIExtraction(rawText: string): AISuggestion {
  const hasBorrower = /([A-Z][a-z]+(?: [A-Z][a-z]+)*(?:\s(?:AG|Inc|PLC|SA|Ltd))?)/g.exec(rawText);
  const hasAmount = /(\d[\d,.]+)/g.exec(rawText);
  const hasCurrency = /(EUR|USD|GBP|CHF)/g.exec(rawText);
  const hasTenor = /(\d+Y|\d+-year)/gi.exec(rawText);
  const hasSpread = /(MS[+\-]\d+(?:bps)?|[Ss]waps?\s*[+\-]\s*\d+)/g.exec(rawText);
  const hasISIN = /([A-Z]{2}[A-Z0-9]{9}\d)/g.exec(rawText);
  const hasLEI = /([A-Z0-9]{20})/g.exec(rawText);
  const hasRating = /((?:AAA|AA\+|AA|AA-|A\+|A|A-|BBB\+|BBB|BBB-)(?:\/(?:Aaa|Aa[123]|A[123]|Baa[123]))?)/g.exec(rawText);

  return {
    headline: `${hasBorrower?.[1] || 'Issuer'} ${hasCurrency?.[1] || ''} ${hasTenor?.[1] || ''} — New Issue Alert`,
    borrowerDetails: hasBorrower?.[1] || 'Unknown Borrower',
    dealSummary: `${hasCurrency?.[1] || 'EUR'} ${hasAmount?.[1] || 'TBD'} ${hasTenor?.[1] || ''} at ${hasSpread?.[1] || 'TBD'}`,
    keyTerms: {
      'Issuer Name': hasBorrower?.[1] || 'TBD',
      Currency: hasCurrency?.[1] || 'TBD',
      Size: hasAmount?.[1] || 'TBD',
      Tenor: hasTenor?.[1] || 'TBD',
      'Reoffer Spread': hasSpread?.[1] || 'TBD',
      'Issuer Rating': hasRating?.[1] || 'TBD',
      ISIN: hasISIN?.[1] || 'TBD',
      LEI: hasLEI?.[1] || 'TBD',
    },
    confidence: 0.75 + Math.random() * 0.2,
  };
}

export default function AIDraftPage() {
  const { deals, users, distributionLists, createMessage, currentUser } = useApp();
  const { toast } = useToast();

  const [rawInput, setRawInput] = useState('');
  const [selectedDeals, setSelectedDeals] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [keyTerms, setKeyTerms] = useState<Record<string, string>>({});
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [selectedDistList, setSelectedDistList] = useState('');

  const vendorUsers = users.filter(u => u.organizationType === 'vendor');

  const handleAIExtract = () => {
    if (!rawInput.trim()) return;
    setIsProcessing(true);
    setTimeout(() => {
      const result = simulateAIExtraction(rawInput);
      setSuggestions(result);
      setHeadline(result.headline);
      setBody(`${result.dealSummary}\n\n${rawInput}`);
      setKeyTerms(result.keyTerms);
      setIsProcessing(false);
    }, 1500);
  };

  const handleDistListChange = (listId: string) => {
    setSelectedDistList(listId);
    const list = distributionLists.find(l => l.id === listId);
    if (list) setSelectedRecipients(list.vendorIds);
  };

  const toggleDeal = (dealId: string) => {
    setSelectedDeals(prev => prev.includes(dealId) ? prev.filter(id => id !== dealId) : [...prev, dealId]);
  };

  const handleCreateDraft = () => {
    if (!headline || !body || selectedDeals.length === 0 || selectedRecipients.length === 0) {
      toast({ title: 'Missing Fields', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    createMessage({
      dealIds: selectedDeals,
      subject: headline,
      body,
      status: 'draft',
      senderId: currentUser.id,
      recipients: selectedRecipients,
      attachments: [],
      aiSuggestions: suggestions || undefined,
    });
    toast({ title: 'Draft Created', description: 'AI-assisted draft saved. Review in Messages.' });
    setRawInput(''); setSuggestions(null); setHeadline(''); setBody(''); setKeyTerms({}); setSelectedRecipients([]); setSelectedDeals([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Bot className="h-6 w-6" />AI Draft Assistant</h1>
        <p className="text-muted-foreground text-sm">Paste deal info and let AI extract ICMA taxonomy fields and draft your alert</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">1. Paste Raw Deal Information</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={rawInput} onChange={e => setRawInput(e.target.value)} rows={8}
                placeholder="Paste deal details here, e.g.:&#10;Republic of Italy is mandating GlobalBank and EuroBank for a new EUR 5bn 10Y benchmark. Expected pricing MS+90 area. Rating BBB/Baa3. ISIN IT0005580003." />
              <Button onClick={handleAIExtract} disabled={!rawInput.trim() || isProcessing} className="w-full">
                <Sparkles className="h-4 w-4 mr-2" />{isProcessing ? 'Processing...' : 'Extract with AI'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">2. Select Deal(s) & Recipients</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Associated Deal(s) <span className="text-xs text-muted-foreground">(select one or more)</span></Label>
                <div className="space-y-1 mt-1 max-h-32 overflow-auto border rounded p-2">
                  {deals.map(d => (
                    <div key={d.id} className="flex items-center gap-2">
                      <Checkbox checked={selectedDeals.includes(d.id)} onCheckedChange={() => toggleDeal(d.id)} />
                      <span className="text-sm">{d.issuerName} {d.currency} {d.tenor}</span>
                      <Badge className="text-[9px] ml-auto">{d.stage}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label>Distribution List</Label>
                <Select value={selectedDistList} onValueChange={handleDistListChange}>
                  <SelectTrigger><SelectValue placeholder="Select list..." /></SelectTrigger>
                  <SelectContent>
                    {distributionLists.map(dl => <SelectItem key={dl.id} value={dl.id}>{dl.name} ({dl.vendorIds.length} vendors)</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Or select individually:</Label>
                <div className="space-y-2 mt-1">
                  {vendorUsers.map(v => (
                    <div key={v.id} className="flex items-center gap-2">
                      <Checkbox checked={selectedRecipients.includes(v.id)}
                        onCheckedChange={checked => setSelectedRecipients(prev => checked ? [...prev, v.id] : prev.filter(id => id !== v.id))} />
                      <span className="text-sm">{v.name} ({v.organization})</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {suggestions ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">AI Extracted Fields (ICMA Taxonomy)</CardTitle>
                    <Badge variant="outline">{(suggestions.confidence * 100).toFixed(0)}% confidence</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(keyTerms).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Label className="w-28 text-xs shrink-0">{key}</Label>
                      <Input value={value} onChange={e => setKeyTerms(prev => ({ ...prev, [key]: e.target.value }))} className="text-sm" />
                      <Check className="h-4 w-4 text-green-600 shrink-0" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Edit2 className="h-4 w-4" />3. Review & Edit Draft</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Headline</Label>
                    <Input value={headline} onChange={e => setHeadline(e.target.value)} />
                  </div>
                  <div>
                    <Label>Message Body</Label>
                    <Textarea value={body} onChange={e => setBody(e.target.value)} rows={6} />
                  </div>
                  <Button onClick={handleCreateDraft} className="w-full">
                    <Send className="h-4 w-4 mr-2" />Save as Draft
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Bot className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">Paste deal information and click "Extract with AI" to get started</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
