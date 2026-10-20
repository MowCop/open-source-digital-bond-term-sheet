import { ChevronDown, Plus, Pencil, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RoleBadge } from '@/components/RoleBadge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  Settings, User, Plug, Bell, Shield, KeyRound, CreditCard, Globe,
  Palette, FileDown, Webhook, ScrollText, HelpCircle, CheckCircle2, Circle, Sparkles, ExternalLink,
} from 'lucide-react';
import { AI_TRIGGER_MODE_KEY, getAITriggerMode, type AITriggerMode } from '@/pages/AIDraftPage';
import PublicMarketFeeds from '@/components/PublicMarketFeeds';
import { VENDOR_APIS, VENDOR_CATEGORIES, isCommercialFeed, loadCatalogue, resolveCatalogue, saveCatalogueEntry, deleteCatalogueEntry, catalogueStorageKey, type VendorAPI, type CatalogueOverrides } from '@/lib/vendors';
import { ConsoleEntryEditor, ConsoleEntryDelete } from '@/components/ConsoleEntryEditor';


/** A Bond Console section: click its heading to open or close everything inside. */
function FoldCard({ children, initialOpen = false }: { children: React.ReactNode; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <Card
      data-open={open}
      className="relative [&>*:first-child]:cursor-pointer [&>*:first-child]:pr-12 [&:not([data-open=true])>*:not(:first-child):not(.fold-chev)]:hidden"
      onClick={e => { if ((e.currentTarget.firstElementChild as HTMLElement | null)?.contains(e.target as Node)) setOpen(o => !o); }}
    >
      {children}
      <ChevronDown aria-hidden className={`fold-chev pointer-events-none absolute right-5 top-6 h-5 w-5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
    </Card>
  );
}

export default function BondConsolePage() {
  const { currentUser } = useApp();
  const { profileName } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(profileName || currentUser.name);
  const [email, setEmail] = useState(`${currentUser.name.toLowerCase().replace(/\s+/g, '.')}@${(currentUser.organization || 'example').toLowerCase().replace(/\s+/g, '')}.com`);
  const [phone, setPhone] = useState('+44 20 7946 0000');
  const [title, setTitle] = useState('Syndicate Manager');

  const [vendors, setVendors] = useState<Record<string, boolean>>(
    () => Object.fromEntries(VENDOR_APIS.map(v => [v.id, v.status === 'connected']))
  );
  const [catalogue, setCatalogue] = useState(() => loadCatalogue(window.localStorage, currentUser.id));
  const [editingEntry, setEditingEntry] = useState<VendorAPI | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<VendorAPI | null>(null);
  useEffect(() => {
    setCatalogue(loadCatalogue(window.localStorage, currentUser.id));
    setEditingEntry(null);
    setDeletingEntry(null);
  }, [currentUser.id]);

  const persistCatalogue = (next: CatalogueOverrides) => {
    try {
      window.localStorage.setItem(catalogueStorageKey(currentUser.id), JSON.stringify(next));
      setCatalogue(next);
      return true;
    } catch {
      toast({ title: 'Entry not saved', description: 'Browser storage is unavailable. No changes were made.', variant: 'destructive' });
      return false;
    }
  };

  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [desktopAlerts, setDesktopAlerts] = useState(true);
  const [digest, setDigest] = useState(true);
  const [twoFA, setTwoFA] = useState(true);
  const [ssoEnabled, setSsoEnabled] = useState(false);

  // AI Control & Compliance trigger mode — controls how aggressively
  // AIDraftPage runs AI extraction on the New Issue Bulletin.
  const [aiTrigger, setAiTrigger] = useState<AITriggerMode>(() => getAITriggerMode());
  useEffect(() => {
    try { window.localStorage.setItem(AI_TRIGGER_MODE_KEY, aiTrigger); } catch { /* ignore quota */ }
  }, [aiTrigger]);

  const groupedVendors = resolveCatalogue(catalogue).reduce<Record<string, VendorAPI[]>>((acc, v) => {
    (acc[v.category] = acc[v.category] || []).push(v);
    return acc;
  }, Object.fromEntries(VENDOR_CATEGORIES.map(category => [category, []])));

  const toggleVendor = (id: string) => {
    setVendors(p => ({ ...p, [id]: !p[id] }));
    toast({ title: 'Demo only', description: 'Vendor connection toggles are placeholders for prototyping.' });
  };

  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2);

  return (
    <div className="space-y-6 max-w-5xl">
      {editingEntry && <ConsoleEntryEditor key={editingEntry.id} entry={editingEntry} onClose={() => setEditingEntry(null)} onSave={entry => persistCatalogue(saveCatalogueEntry(catalogue, entry))} />}
      {deletingEntry && <ConsoleEntryDelete key={deletingEntry.id} entry={deletingEntry} onClose={() => setDeletingEntry(null)} onDelete={confirmation => persistCatalogue(deleteCatalogueEntry(catalogue, deletingEntry.id, confirmation))} />}
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Bond Console</h1>
          <p className="text-sm text-muted-foreground">Settings, integrations and account preferences</p>
        </div>
        <Badge variant="outline" className="ml-auto text-xs">Some settings are demo</Badge>
      </div>

      {/* PROFILE */}
      <FoldCard>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4" /> Profile</CardTitle>
          <CardDescription>Your personal details visible to other syndicate users</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/10 text-primary text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="space-x-2">
              <Button size="sm" variant="outline">Upload photo</Button>
              <Button size="sm" variant="ghost">Remove</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title">Job title</Label>
              <Input id="title" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Organisation</Label>
              <Input value={currentUser.organization} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <div className="h-9 flex items-center">
                <RoleBadge role={currentUser.role} className="text-xs px-2 py-0.5" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost">Cancel</Button>
            <Button onClick={() => toast({ title: 'Profile saved (demo)', description: 'No changes were persisted.' })}>Save profile</Button>
          </div>
        </CardContent>
      </FoldCard>

      {/* AI CONTROL & COMPLIANCE */}
      <FoldCard>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" /> AI Control &amp; Compliance
          </CardTitle>
          <CardDescription>
            How aggressively the New Issue Bulletin builder runs AI extraction over headline, body and dropped documents.
            Field-level differences are always surfaced for review — extracted values never silently overwrite existing ones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {([
            { id: 'live', label: 'Live (debounced)', desc: 'Re-runs as you type and on every document drop. Highest AI cost.' },
            { id: 'onSave', label: 'On Save + on document drop', desc: 'Default. Runs on every document drop and when you Save. Balanced cost.' },
            { id: 'manual', label: 'Manual only', desc: 'Only runs when you click "Run AI" in the Bulletin builder. Cheapest.' },
          ] as Array<{ id: AITriggerMode; label: string; desc: string }>).map(opt => {
            const active = aiTrigger === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAiTrigger(opt.id)}
                className={`w-full text-left flex items-start gap-3 border rounded-md p-3 transition-colors ${
                  active ? 'border-primary bg-primary/5' : 'border-border bg-card/40 hover:bg-accent/10'
                }`}
              >
                <div className="mt-0.5">
                  {active ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.desc}</div>
                </div>
                {active && <Badge className="text-[9px] h-4 px-1.5 bg-primary/15 text-primary border-0">Active</Badge>}
              </button>
            );
          })}
        </CardContent>
      </FoldCard>

      {/* VENDOR CONNECTORS */}
      <FoldCard initialOpen>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Plug className="h-4 w-4" /> Vendor & Market Data Connectors</CardTitle>
          <CardDescription>
            Public published rates and central bank news. Commercial vendor feeds require licensed access; other connector toggles remain demonstrations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <PublicMarketFeeds />
          <Separator />
          {Object.entries(groupedVendors).map(([category, items]) => (
            <div key={category} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{category}</div>
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={`Add entry to ${category}`} title={`Add entry to ${category}`} onClick={() => setEditingEntry({ id: `custom-${crypto.randomUUID()}`, category, name: '', description: '', status: 'available' })}><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {items.map(v => {
                  const isLink = Boolean(v.url);
                  const commercialFeed = isCommercialFeed(v);
                  const on = !commercialFeed && vendors[v.id];
                  return (
                    <div key={v.id} className="flex flex-wrap items-start gap-3 border rounded-md p-3 bg-card/40">
                      <div className="mt-0.5">
                        {isLink ? <ExternalLink className="h-4 w-4 text-primary" /> : on ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-[120px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isLink ? (
                            <a
                              href={v.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                            >
                              {v.name}
                            </a>
                          ) : (
                            <span className="text-sm font-medium">{v.name}</span>
                          )}
                          {on && <Badge className="text-[9px] h-4 px-1.5 bg-green-500/15 text-green-600 border-0">Connected</Badge>}
                          {isLink && <Badge variant="outline" className="text-[9px] h-4 px-1.5">Live link</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground break-words">{v.description}</div>
                      </div>
                      {isLink ? (
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 inline-flex h-7 items-center gap-1 rounded-md border border-primary/40 px-2.5 text-[11px] font-medium text-primary hover:bg-primary/10"
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : commercialFeed || v.id.startsWith('custom-') ? <Badge variant="outline" className="text-[10px] shrink-0">Not connected</Badge> : <Switch checked={Boolean(on)} onCheckedChange={() => toggleVendor(v.id)} />}
                      <div className="flex shrink-0 items-center gap-1 ml-auto">
                        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Edit ${v.name}`} title={`Edit ${v.name}`} onClick={() => setEditingEntry(v)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label={`Delete ${v.name}`} title={`Delete ${v.name}`} onClick={() => setDeletingEntry(v)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </FoldCard>

      {/* NOTIFICATIONS */}
      <FoldCard>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4" /> Notifications</CardTitle>
          <CardDescription>How you receive new issue alerts and chat activity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Email alerts', desc: 'New issue announcements and updates', value: emailAlerts, set: setEmailAlerts },
            { label: 'SMS alerts', desc: 'Critical pricing & books-closed events', value: smsAlerts, set: setSmsAlerts },
            { label: 'Desktop notifications', desc: 'Browser push when this tab is open', value: desktopAlerts, set: setDesktopAlerts },
            { label: 'Daily digest', desc: 'Morning summary at 07:30 London time', value: digest, set: setDigest },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between py-1">
              <div>
                <div className="text-sm font-medium">{row.label}</div>
                <div className="text-xs text-muted-foreground">{row.desc}</div>
              </div>
              <Switch checked={row.value} onCheckedChange={row.set} />
            </div>
          ))}
        </CardContent>
      </FoldCard>

      {/* SECURITY */}
      <FoldCard>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4" /> Security & Access</CardTitle>
          <CardDescription>Authentication, sessions and access controls</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Two-factor authentication</div>
              <div className="text-xs text-muted-foreground">Authenticator app (TOTP)</div>
            </div>
            <Switch checked={twoFA} onCheckedChange={setTwoFA} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Single Sign-On (SSO)</div>
              <div className="text-xs text-muted-foreground">SAML 2.0 / Okta · Azure AD</div>
            </div>
            <Switch checked={ssoEnabled} onCheckedChange={setSsoEnabled} />
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline"><KeyRound className="h-4 w-4 mr-2" /> Change password</Button>
            <Button variant="outline">Manage active sessions</Button>
            <Button variant="outline">Trusted IP allowlist</Button>
            <Button variant="outline">Recovery codes</Button>
          </div>
        </CardContent>
      </FoldCard>

      {/* API & WEBHOOKS */}
      <FoldCard>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Webhook className="h-4 w-4" /> API Keys & Webhooks</CardTitle>
          <CardDescription>Outbound integrations into your own systems</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between border rounded p-3">
            <div>
              <div className="text-sm font-medium">Personal API key</div>
              <div className="text-xs text-muted-foreground font-mono">bvdr_sk_••••••••••••••3f9a</div>
            </div>
            <div className="space-x-2">
              <Button size="sm" variant="outline">Reveal</Button>
              <Button size="sm" variant="outline">Rotate</Button>
            </div>
          </div>
          <div className="flex items-center justify-between border rounded p-3">
            <div>
              <div className="text-sm font-medium">Outbound webhook</div>
              <div className="text-xs text-muted-foreground font-mono">https://intranet.example.com/hooks/bondvdr</div>
            </div>
            <Button size="sm" variant="outline">Edit endpoint</Button>
          </div>
        </CardContent>
      </FoldCard>

      {/* APPEARANCE & LOCALE */}
      <div className="grid grid-cols-2 gap-4">
        <FoldCard>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4" /> Appearance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between items-center"><span>Theme</span><Button size="sm" variant="outline">System</Button></div>
            <div className="flex justify-between items-center"><span>Density</span><Button size="sm" variant="outline">Comfortable</Button></div>
            <div className="flex justify-between items-center"><span>Accent colour</span><Button size="sm" variant="outline">Default</Button></div>
          </CardContent>
        </FoldCard>
        <FoldCard>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Globe className="h-4 w-4" /> Locale & Time</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between items-center"><span>Time zone</span><Button size="sm" variant="outline">Europe/London</Button></div>
            <div className="flex justify-between items-center"><span>Date format</span><Button size="sm" variant="outline">DD MMM YYYY</Button></div>
            <div className="flex justify-between items-center"><span>Number format</span><Button size="sm" variant="outline">1,234.56</Button></div>
            <div className="flex justify-between items-center"><span>Default currency</span><Button size="sm" variant="outline">EUR</Button></div>
          </CardContent>
        </FoldCard>
      </div>

      {/* BILLING & DATA */}
      <div className="grid grid-cols-2 gap-4">
        <FoldCard>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-4 w-4" /> Billing & Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Plan</span><Badge>Enterprise</Badge></div>
            <div className="flex justify-between text-muted-foreground"><span>Seats</span><span>24 / 50</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Renewal</span><span>31 Dec 2026</span></div>
            <Button size="sm" variant="outline" className="w-full mt-2">Manage subscription</Button>
            <Button size="sm" variant="outline" className="w-full">Download invoices</Button>
          </CardContent>
        </FoldCard>
        <FoldCard>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><FileDown className="h-4 w-4" /> Data & Compliance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Button size="sm" variant="outline" className="w-full justify-start"><FileDown className="h-3 w-3 mr-2" /> Export my data (GDPR)</Button>
            <Button size="sm" variant="outline" className="w-full justify-start"><ScrollText className="h-3 w-3 mr-2" /> Audit log export</Button>
            <Button size="sm" variant="outline" className="w-full justify-start">Data retention policy</Button>
            <Button size="sm" variant="outline" className="w-full justify-start text-destructive">Delete account</Button>
          </CardContent>
        </FoldCard>
      </div>

      {/* SUPPORT */}
      <FoldCard>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><HelpCircle className="h-4 w-4" /> Support & About</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm">
          <Button variant="outline" className="justify-start">Contact support</Button>
          <Button variant="outline" className="justify-start">Documentation</Button>
          <Button variant="outline" className="justify-start">Release notes</Button>
          <Button variant="outline" className="justify-start">Status page</Button>
          <div className="col-span-2 text-xs text-muted-foreground pt-2">BondVDR v1.0.0 · © 2026 EuroBondMarkets</div>
        </CardContent>
      </FoldCard>
    </div>
  );
}
