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

// Simulated AI extraction
function simulateAIExtraction(rawText: string): AISuggestion {
  const hasBorrower = /([A-Z][a-z]+(?: [A-Z][a-z]+)*(?:\s(?:AG|Inc|PLC|SA|Ltd))?)/g.exec(rawText);
  const hasAmount = /(\d[\d,.]+)/g.exec(rawText);
  const hasCurrency = /(EUR|USD|GBP|CHF)/g.exec(rawText);
  const hasTenor = /(\d+Y|\d+-year)/gi.exec(rawText);
  const hasSpread = /(MS[+\-]\d+(?:bps)?|[Ss]waps?\s*[+\-]\s*\d+)/g.exec(rawText);

  return {
    headline: `${hasBorrower?.[1] || 'Issuer'} ${hasCurrency?.[1] || ''} ${hasTenor?.[1] || ''} — New Issue Alert`,
    borrowerDetails: hasBorrower?.[1] || 'Unknown Borrower',
    dealSummary: `${hasCurrency?.[1] || 'EUR'} ${hasAmount?.[1] || 'TBD'} ${hasTenor?.[1] || ''} at ${hasSpread?.[1] || 'TBD'}`,
    keyTerms: {
      Borrower: hasBorrower?.[1] || 'TBD',
      Currency: hasCurrency?.[1] || 'TBD',
      Size: hasAmount?.[1] || 'TBD',
      Tenor: hasTenor?.[1] || 'TBD',
      Spread: hasSpread?.[1] || 'TBD',
    },
    confidence: 0.75 + Math.random() * 0.2,
  };
}

export default function AIDraftPage() {
  const { deals, users, distributionLists, createMessage, currentUser } = useApp();
  const { toast } = useToast();

  const [rawInput, setRawInput] = useState('');
  const [selectedDeal, setSelectedDeal] = useState('');
  const [suggestions, setSuggestions] = useState<AISuggestion | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Editable fields after AI extraction
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [keyTerms, setKeyTerms] = useState<Record<string, string>>({});
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [selectedDistList, setSelectedDistList] = useState('');

  const vendorUsers = users.filter(u => u.organizationType === 'vendor');

  const handleAIExtract = () => {
    if (!rawInput.trim()) return;
    setIsProcessing(true);
    // Simulate AI processing delay
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

  const handleCreateDraft = () => {
    if (!headline || !body || !selectedDeal || selectedRecipients.length === 0) {
      toast({ title: 'Missing Fields', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    createMessage({
      dealId: selectedDeal,
      subject: headline,
      body,
      status: 'draft',
      senderId: currentUser.id,
      recipients: selectedRecipients,
      attachments: [],
      aiSuggestions: suggestions || undefined,
    });
    toast({ title: 'Draft Created', description: 'AI-assisted draft saved. Review in Messages.' });
    // Reset
    setRawInput(''); setSuggestions(null); setHeadline(''); setBody(''); setKeyTerms({}); setSelectedRecipients([]); setSelectedDeal('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Bot className="h-6 w-6" />AI Draft Assistant</h1>
        <p className="text-muted-foreground text-sm">Paste deal info and let AI extract key fields and draft your alert</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">1. Paste Raw Deal Information</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={rawInput} onChange={e => setRawInput(e.target.value)} rows={8}
                placeholder="Paste deal details here, e.g.:&#10;Republic of Italy is mandating GlobalBank and EuroBank for a new EUR 5bn 10Y benchmark. Expected pricing MS+90 area. Rating BBB/Baa3." />
              <Button onClick={handleAIExtract} disabled={!rawInput.trim() || isProcessing} className="w-full">
                <Sparkles className="h-4 w-4 mr-2" />{isProcessing ? 'Processing...' : 'Extract with AI'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">2. Select Deal & Recipients</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Associated Deal</Label>
                <Select value={selectedDeal} onValueChange={setSelectedDeal}>
                  <SelectTrigger><SelectValue placeholder="Select deal..." /></SelectTrigger>
                  <SelectContent>
                    {deals.map(d => <SelectItem key={d.id} value={d.id}>{d.borrower} {d.currency} {d.tenor}</SelectItem>)}
                  </SelectContent>
                </Select>
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

        {/* AI Results Panel */}
        <div className="space-y-4">
          {suggestions ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">AI Extracted Fields</CardTitle>
                    <Badge variant="outline">{(suggestions.confidence * 100).toFixed(0)}% confidence</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(keyTerms).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Label className="w-24 text-xs shrink-0">{key}</Label>
                      <Input value={value} onChange={e => setKeyTerms(prev => ({ ...prev, [key]: e.target.value }))} className="text-sm" />
                      <Check className="h-4 w-4 text-success shrink-0" />
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
