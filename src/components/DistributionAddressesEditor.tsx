import { useState } from 'react';
import { Mail, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DISTRIBUTION_HINT, isValidDistributionEmail } from '@/lib/newIssueAlerts';

/** New-issues email distribution list for one vendor (organisation-wide). */
export function DistributionAddressesEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const add = () => {
    const a = draft.trim().toLowerCase();
    if (!a) return;
    if (!isValidDistributionEmail(a)) { setError('Enter a valid email address, e.g. newissues@vendor.com'); return; }
    if (!value.includes(a)) onChange([...value, a]);
    setDraft(''); setError('');
  };
  return (
    <fieldset className="space-y-2 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> New-issues email distribution</legend>
      <p className="text-xs text-muted-foreground">{DISTRIBUTION_HINT} Shared with your organisation.</p>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map(a => (
            <li key={a} className="inline-flex items-center gap-1 rounded border bg-muted/40 px-2 py-0.5 text-xs">
              {a}<button type="button" aria-label={`Remove ${a}`} onClick={() => onChange(value.filter(x => x !== a))}><X className="h-3 w-3" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Label htmlFor="dist-add" className="sr-only">Add distribution address</Label>
        <Input id="dist-add" type="email" placeholder="newissues@vendor.com" value={draft} maxLength={254}
          onChange={e => { setDraft(e.target.value); setError(''); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <Button type="button" variant="outline" onClick={add} className="gap-1"><Plus className="h-3.5 w-3.5" /> Add</Button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </fieldset>
  );
}
