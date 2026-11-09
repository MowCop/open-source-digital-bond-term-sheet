import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ConnectivityEditor } from '@/components/ConnectivityEditor';
import { connectivityFor } from '@/lib/connectivity';
import { validateVendor, connectorDirection, type VendorAPI, type ConnectorDirection } from '@/lib/vendors';

export function ConsoleEntryEditor({ entry, onSave, onClose }: { entry: VendorAPI; onSave: (v: VendorAPI) => boolean; onClose: () => void }) {
  const [name, setName] = useState(entry.name);
  const [description, setDescription] = useState(entry.description);
  const [url, setUrl] = useState(entry.url || '');
  const [direction, setDirection] = useState<ConnectorDirection>(connectorDirection(entry));
  const [connectivity, setConnectivity] = useState(() => connectivityFor(entry).filter(p => !p.id.endsWith('-tbc')));
  const [error, setError] = useState('');
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl w-[calc(100%-2rem)] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry.name ? 'Edit entry' : 'Add entry'} · {entry.category}</DialogTitle>
          <DialogDescription>Saved for your account in this browser. A link does not connect a live data feed.</DialogDescription>
        </DialogHeader>
        <form onSubmit={e => {
          e.preventDefault();
          const next = { ...entry, name: name.trim(), description: description.trim(), url: url.trim() || undefined, direction, connectivity };
          const issue = validateVendor(next);
          if (issue) { setError(issue); return; }
          if (onSave(next)) onClose();
        }} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="entry-name">Name</Label><Input id="entry-name" autoFocus required maxLength={160} value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="entry-description">Description</Label><Input id="entry-description" maxLength={500} value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="entry-url">Website / source URL (optional)</Label><Input id="entry-url" type="url" placeholder="https://" maxLength={2048} value={url} onChange={e => setUrl(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="entry-direction">Direction</Label>
            <select id="entry-direction" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={direction} onChange={e => setDirection(e.target.value as ConnectorDirection)}>
              <option value="pull">Pull / enrichment</option><option value="push">Push</option><option value="email">Email</option>
            </select></div>
          <ConnectivityEditor value={connectivity} onChange={setConnectivity} />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save entry</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConsoleEntryDelete({ entry, onDelete, onClose }: { entry: VendorAPI; onDelete: (confirmation: string) => boolean; onClose: () => void }) {
  const [confirmation, setConfirmation] = useState('');
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg w-[calc(100%-2rem)]">
        <DialogHeader><DialogTitle>Delete {entry.name}?</DialogTitle><DialogDescription>This removes the entry from your console in this browser, not from the provider’s service.</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (confirmation === 'delete' && onDelete(confirmation)) onClose(); }}>
          <div className="space-y-2"><Label htmlFor="delete-confirmation">Type delete to confirm</Label><Input id="delete-confirmation" autoFocus autoComplete="off" value={confirmation} onChange={e => setConfirmation(e.target.value)} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" variant="destructive" disabled={confirmation !== 'delete'}>Delete entry</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}