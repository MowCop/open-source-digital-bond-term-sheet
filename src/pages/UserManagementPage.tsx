import { useState, useEffect } from 'react';
import { useApp, useScopedApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserRole, UserCategory, User, DistributionList } from '@/types/bond';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Trash2, ArrowLeft, Users, ListTree, UserPlus, ListPlus, MessageSquare, Activity } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/context/AuthContext';
import { KeyRound, UserCheck } from 'lucide-react';
import GuestsTab from '@/components/GuestsTab';
import PendingApprovalsTab from '@/components/PendingApprovalsTab';

const roleLabels: Record<UserRole, string> = {
  master_admin: 'Master Admin',
  syndicate_admin: 'Syndicate Admin',
  vendor_user: 'Read Only',
  syndicate_readonly: 'Syndicate – Read Only',
  sales_readonly: 'Sales – Read Only',
  guest_readonly: 'Guest Read Only',
};

// Centralised editable UI labels for User Management.
const UM_LABELS = {
  pageTitle: 'Address Book & User Admin',
  pageSubtitle: 'Manage users, roles, and distribution lists.',
  addUser: 'Add User',
  createList: 'Create List',
  tabLists: 'Distribution Lists',
  tabUsers: 'Users',
  colNameContact: 'Name & Contact',
  colOrganization: 'Organization',
  colRole: 'Role',
  colCreated: 'Created Details',
  colActions: 'Actions',
};

const categoryOptions: UserCategory[] = ['Vendor', 'Syndicate', 'Buy Side', 'Legal', 'Guest', 'DCM', 'Sales'];

export default function UserManagementPage() {
  const { users, currentUser, deals, messages, distributionLists, chatChannels, addUser, deleteUser, updateUser, addDistributionList, updateDistributionList, deleteDistributionList } = useScopedApp();
  const { toast } = useToast();
  const { isAdmin, isMaster } = useAuth();

  const [activeTab, setActiveTab] = useState('users');
  const [showAddUser, setShowAddUser] = useState(false);
  const [showCreateList, setShowCreateList] = useState(false);
  const [editingList, setEditingList] = useState<DistributionList | null>(null);

  // Login activity (Option A — derived from auth.users)
  const [loginStats, setLoginStats] = useState<Record<string, { lastSignInAt: string | null; confirmedAt: string | null }>>({});
  const [loginStatsLoading, setLoginStatsLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin && currentUser.role !== 'master_admin') return;
    let cancelled = false;
    const load = async () => {
      setLoginStatsLoading(true);
      const { data, error } = await supabase.rpc('get_user_login_stats');
      if (!cancelled && !error && Array.isArray(data)) {
        const map: Record<string, { lastSignInAt: string | null; confirmedAt: string | null }> = {};
        for (const row of data as any[]) {
          if (row?.email) {
            map[String(row.email).toLowerCase()] = {
              lastSignInAt: row.last_sign_in_at ?? null,
              confirmedAt: row.confirmed_at ?? null,
            };
          }
        }
        setLoginStats(map);
      }
      if (!cancelled) setLoginStatsLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [isAdmin, currentUser.role]);

  const formatRelative = (iso: string | null): string => {
    if (!iso) return 'Never';
    const then = new Date(iso).getTime();
    const diffMs = Date.now() - then;
    const m = Math.floor(diffMs / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    const mo = Math.floor(d / 30);
    return `${mo}mo ago`;
  };

  const loginStatusFor = (email: string): { label: string; tone: 'active' | 'dormant' | 'never' | 'unconfirmed'; lastIso: string | null } => {
    const stats = loginStats[email.toLowerCase()];
    if (!stats) return { label: 'Never', tone: 'never', lastIso: null };
    if (!stats.confirmedAt) return { label: 'Unconfirmed', tone: 'unconfirmed', lastIso: stats.lastSignInAt };
    if (!stats.lastSignInAt) return { label: 'Never', tone: 'never', lastIso: null };
    const ageDays = (Date.now() - new Date(stats.lastSignInAt).getTime()) / 86400000;
    if (ageDays > 30) return { label: 'Dormant', tone: 'dormant', lastIso: stats.lastSignInAt };
    return { label: 'Active', tone: 'active', lastIso: stats.lastSignInAt };
  };

  // Aggregate login metrics across all listed users (master-admin visible tiles).
  const loginMetrics = (() => {
    const now = Date.now();
    const buckets = { d1: 0, d7: 0, d30: 0, never: 0, unconfirmed: 0, total: users.length };
    for (const u of users) {
      const s = loginStats[u.email.toLowerCase()];
      if (!s) { buckets.never++; continue; }
      if (!s.confirmedAt) buckets.unconfirmed++;
      if (!s.lastSignInAt) { buckets.never++; continue; }
      const ageMs = now - new Date(s.lastSignInAt).getTime();
      if (ageMs <= 86400000) buckets.d1++;
      if (ageMs <= 7 * 86400000) buckets.d7++;
      if (ageMs <= 30 * 86400000) buckets.d30++;
    }
    return buckets;
  })();

  const formatFullTimestamp = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never signed in';

  // Add User form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newOrg, setNewOrg] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('syndicate_admin');
  const [newCategory, setNewCategory] = useState<UserCategory>('Syndicate');

  // Edit User state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editOrg, setEditOrg] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('syndicate_admin');
  const [editCategory, setEditCategory] = useState<UserCategory>('Syndicate');

  // Create List form state
  const [listName, setListName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberFilter, setMemberFilter] = useState<'all' | 'vendors' | 'syndicate'>('all');

  // Edit list state
  const [editListName, setEditListName] = useState('');
  const [editMembers, setEditMembers] = useState<string[]>([]);

  if (!isAdmin && currentUser.role !== 'master_admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <Card><CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Access restricted to administrators</p>
        </CardContent></Card>
      </div>
    );
  }

  const handleCreateUser = () => {
    if (!newName || !newEmail || !newOrg) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    const orgType: 'vendor' | 'bank' = newRole === 'vendor_user' ? 'vendor' : 'bank';
    addUser({ name: newName, email: newEmail, phone: newPhone, role: newRole, organization: newOrg, organizationType: orgType, category: newCategory });
    toast({ title: 'User Created', description: `${newName} has been added` });
    setShowAddUser(false);
    setNewName(''); setNewEmail(''); setNewPhone(''); setNewOrg('');
  };

  const openEditUser = (u: User) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPhone(u.phone || '');
    setEditOrg(u.organization);
    setEditRole(u.role);
    setEditCategory(u.category || 'Syndicate');
  };

  const handleSaveEditUser = () => {
    if (!editingUser) return;
    if (!editName || !editEmail || !editOrg) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    const orgType: 'vendor' | 'bank' = editRole === 'vendor_user' ? 'vendor' : 'bank';
    updateUser(editingUser.id, {
      name: editName, email: editEmail, phone: editPhone,
      organization: editOrg, organizationType: orgType,
      role: editRole, category: editCategory,
    });
    toast({ title: 'User Updated', description: `${editName} has been saved` });
    setEditingUser(null);
  };

  const handleDeleteUser = (u: User) => {
    deleteUser(u.id);
    toast({ title: 'User Deleted', description: `${u.name} has been removed` });
  };

  const handleSaveList = () => {
    if (!listName) {
      toast({ title: 'Error', description: 'Please enter a list name', variant: 'destructive' });
      return;
    }
    const vendorIds = selectedMembers.filter(id => users.find(u => u.id === id)?.organizationType === 'vendor');
    addDistributionList({ name: listName, memberIds: selectedMembers, vendorIds, createdBy: currentUser.id });
    toast({ title: 'List Created', description: `${listName} has been created` });
    setShowCreateList(false);
    setListName(''); setSelectedMembers([]);
  };

  const handleUpdateList = () => {
    if (!editingList) return;
    const vendorIds = editMembers.filter(id => users.find(u => u.id === id)?.organizationType === 'vendor');
    updateDistributionList(editingList.id, { name: editListName, memberIds: editMembers, vendorIds });
    toast({ title: 'List Updated', description: `${editListName} has been saved` });
    setEditingList(null);
  };

  const handleDeleteList = (dl: DistributionList) => {
    deleteDistributionList(dl.id);
    toast({ title: 'List Deleted', description: `${dl.name} has been removed` });
  };

  const openEditList = (dl: DistributionList) => {
    setEditingList(dl);
    setEditListName(dl.name);
    setEditMembers([...dl.memberIds]);
  };

  const toggleMember = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  };

  const filteredUsersForList = users.filter(u => {
    if (memberFilter === 'vendors') return u.organizationType === 'vendor';
    if (memberFilter === 'syndicate') return u.organizationType === 'bank';
    return true;
  });

  const allVendors = users.filter(u => u.organizationType === 'vendor');
  const allVendorIds = allVendors.map(u => u.id);
  const allSelected = allVendorIds.every(id => selectedMembers.includes(id));

  const formatDate = (d?: Date) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const creatorName = (id: string) => {
    if (id === 'System') return 'System';
    return users.find(u => u.id === id)?.name || 'Unknown';
  };

  // Compute authorised deals per user:
  // - bank users: deals where their org is creator or a bookrunner
  // - all users: deals where they are a recipient on any sent message
  const norm = (s?: string | null) => (s ?? '').trim().toLowerCase();
  const dealsForUser = (u: User) => {
    const ids = new Set<string>();
    const org = norm(u.organization);
    if (u.organizationType === 'bank' && org) {
      for (const d of deals) {
        if (norm(d.createdByOrg) === org || (d.bookrunners ?? []).some(b => norm(b.name) === org)) {
          ids.add(d.id);
        }
      }
    }
    for (const m of messages) {
      if ((m.recipients ?? []).includes(u.id)) {
        for (const did of (m.dealIds ?? [])) ids.add(did);
      }
    }
    return deals.filter(d => ids.has(d.id));
  };

  // Split a user's authorised deals into active (manage/edit) and passive (read-only).
  // Active: the user's org created the deal, or is listed as an "active" bookrunner.
  // Passive: everything else they have access to (passive bookrunner, or recipient-only).
  const splitDealsForUser = (u: User) => {
    const all = dealsForUser(u);
    const org = norm(u.organization);
    const active: typeof all = [];
    const passive: typeof all = [];
    for (const d of all) {
      const br = (d.bookrunners ?? []).find(b => norm(b.name) === org);
      const isActive =
        (u.organizationType === 'bank' && !!org && norm(d.createdByOrg) === org) ||
        (br && br.role === 'active');
      if (isActive) active.push(d);
      else passive.push(d);
    }
    return { active, passive };
  };

  // Editing a distribution list view
  if (editingList) {
    return (
      <div className="space-y-6">
        <button onClick={() => setEditingList(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Lists
        </button>
        <Card className="border-border">
          <CardContent className="p-6 space-y-6">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Distribution List Name</Label>
              <Input value={editListName} onChange={e => setEditListName(e.target.value)} className="mt-2 bg-background border-border" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Members ({editMembers.length})</Label>
              <div className="mt-3 space-y-1">
                {users.map(u => (
                  <div key={u.id} className={`flex items-center justify-between p-3 rounded-md border border-border ${editMembers.includes(u.id) ? 'bg-primary/10 border-primary/30' : 'bg-card'}`}>
                    <div>
                      <div className="font-medium text-sm">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                      <div className="text-xs text-muted-foreground">{u.organization} · {u.category?.toLowerCase() || u.role.replace('_', ' ')}</div>
                    </div>
                    <Checkbox checked={editMembers.includes(u.id)} onCheckedChange={() => toggleMember(u.id, editMembers, setEditMembers)} />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setEditingList(null)}>Cancel</Button>
              <Button onClick={handleUpdateList}>Save Changes</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{UM_LABELS.pageTitle}</h1>
          <p className="text-muted-foreground text-sm">Manage users, roles, and distribution lists.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { setShowAddUser(true); setActiveTab('users'); }}>
            <UserPlus className="h-4 w-4 mr-2" /> Add User
          </Button>
          <Button onClick={() => { setShowCreateList(true); setActiveTab('lists'); }}>
            <ListPlus className="h-4 w-4 mr-2" /> Create List
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-transparent border-b border-border rounded-none w-full justify-start gap-6 h-auto pb-0">
          <TabsTrigger value="users" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none pb-2 bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            <Users className="h-4 w-4 mr-2" /> Users
          </TabsTrigger>
          <TabsTrigger value="lists" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none pb-2 bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            <ListTree className="h-4 w-4 mr-2" /> Distribution Lists
          </TabsTrigger>
          {isMaster && (
            <TabsTrigger value="approvals" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none pb-2 bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              <UserCheck className="h-4 w-4 mr-2" /> Approvals
            </TabsTrigger>
          )}
          <TabsTrigger value="guests" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none pb-2 bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            <KeyRound className="h-4 w-4 mr-2" /> Guests
          </TabsTrigger>
        </TabsList>

        {/* Distribution Lists Tab */}
        <TabsContent value="lists" className="mt-6">
          {showCreateList ? (
            <Card className="border-border max-w-2xl">
              <CardContent className="p-6 space-y-5">
                <h2 className="text-lg font-semibold">Create New Distribution List</h2>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">List Name</Label>
                  <Input value={listName} onChange={e => setListName(e.target.value)} placeholder="e.g. Tier 1 European Accounts" className="mt-2 bg-background border-border" />
                </div>
                <div>
                  <Tabs value={memberFilter} onValueChange={v => setMemberFilter(v as any)}>
                    <TabsList className="bg-card border border-border">
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="vendors">Vendors</TabsTrigger>
                      <TabsTrigger value="syndicate">Syndicate Users</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="mt-3 space-y-1">
                    {memberFilter === 'vendors' && (
                      <div className="flex items-center justify-between p-3 rounded-md border border-border bg-card font-medium text-sm">
                        Select All Vendors
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={() => {
                            if (allSelected) setSelectedMembers(selectedMembers.filter(id => !allVendorIds.includes(id)));
                            else setSelectedMembers([...new Set([...selectedMembers, ...allVendorIds])]);
                          }}
                        />
                      </div>
                    )}
                    {filteredUsersForList.map(u => (
                      <div key={u.id} className="flex items-center justify-between p-3 rounded-md border border-border bg-card text-sm">
                        <span>{u.organization || u.name}</span>
                        <Checkbox checked={selectedMembers.includes(u.id)} onCheckedChange={() => toggleMember(u.id, selectedMembers, setSelectedMembers)} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => { setShowCreateList(false); setListName(''); setSelectedMembers([]); }}>Cancel</Button>
                  <Button onClick={handleSaveList}>Save List</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Distribution List Name</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Last Used</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-center">Total Users</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distributionLists.map(dl => (
                  <TableRow key={dl.id} className="border-border">
                    <TableCell className="font-medium">{dl.name}</TableCell>
                    <TableCell className="text-timestamp">{formatDate(dl.lastUsed)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="px-3">{dl.memberIds.length}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditList(dl)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteList(dl)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-6">
          {!showAddUser && isMaster && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              {[
                { label: 'Active (24h)', value: loginMetrics.d1, tone: 'text-green-500' },
                { label: 'Active (7d)', value: loginMetrics.d7, tone: 'text-green-500' },
                { label: 'Active (30d)', value: loginMetrics.d30, tone: 'text-emerald-400' },
                { label: 'Never signed in', value: loginMetrics.never, tone: 'text-muted-foreground' },
                { label: 'Unconfirmed email', value: loginMetrics.unconfirmed, tone: 'text-blue-500' },
              ].map(tile => (
                <Card key={tile.label} className="border-border">
                  <CardContent className="p-4">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{tile.label}</div>
                    <div className={`text-2xl font-bold mt-1 ${tile.tone}`}>
                      {loginStatsLoading ? '…' : tile.value}
                      <span className="text-xs font-normal text-muted-foreground ml-1">/ {loginMetrics.total}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {showAddUser ? (
            <Card className="border-border max-w-2xl">
              <CardContent className="p-6 space-y-5">
                <h2 className="text-lg font-semibold">Add New User</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Full Name</Label>
                    <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Enter full name" className="mt-2 bg-background border-border" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Work Email</Label>
                    <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Enter work email" className="mt-2 bg-background border-border" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Phone Number</Label>
                    <Input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Enter phone number" className="mt-2 bg-background border-border" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Organization</Label>
                    <Input value={newOrg} onChange={e => setNewOrg(e.target.value)} placeholder="Enter organization" className="mt-2 bg-background border-border" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">User Role</Label>
                    <Select value={newRole} onValueChange={v => setNewRole(v as UserRole)}>
                      <SelectTrigger className="mt-2 bg-background border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="syndicate_admin">Syndicate Admin</SelectItem>
                        <SelectItem value="vendor_user">Read Only</SelectItem>
                        <SelectItem value="syndicate_readonly">Syndicate – Read Only</SelectItem>
                        <SelectItem value="sales_readonly">Sales – Read Only</SelectItem>
                        <SelectItem value="guest_readonly">Guest Read Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Category</Label>
                    <Select value={newCategory} onValueChange={v => setNewCategory(v as UserCategory)}>
                      <SelectTrigger className="mt-2 bg-background border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setShowAddUser(false)}>Cancel</Button>
                  <Button onClick={handleCreateUser}>Create User</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Name & Contact</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Organization</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Role</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Deals</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" /> Login Activity</span>
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Created Details</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => {
                  const userDeals = dealsForUser(u);
                  const { active: activeDeals, passive: passiveDeals } = splitDealsForUser(u);
                  return (
                  <TableRow key={u.id} className="border-border">
                    <TableCell>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                      {u.phone && <div className="text-xs text-muted-foreground">{u.phone}</div>}
                    </TableCell>
                    <TableCell>{u.organization}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === 'master_admin' ? 'default' : u.role === 'syndicate_admin' ? 'secondary' : 'outline'}>
                        {u.category || roleLabels[u.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {userDeals.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button type="button" className="text-left group">
                              <Badge variant="outline" className="cursor-pointer group-hover:bg-accent">
                                {userDeals.length} deal{userDeals.length === 1 ? '' : 's'}
                              </Badge>
                              <div className="text-xs text-muted-foreground mt-1 line-clamp-2 max-w-[220px]">
                                {userDeals.slice(0, 2).map(d => `${d.issuerName} ${d.currency}${d.size}`).join(', ')}
                                {userDeals.length > 2 ? ` +${userDeals.length - 2}` : ''}
                              </div>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="w-96 p-0">
                            <div className="p-3 border-b border-border">
                              <div className="text-xs uppercase tracking-wider text-muted-foreground">Authorised Deals</div>
                              <div className="text-sm font-medium">{u.name} · {userDeals.length} deal{userDeals.length === 1 ? '' : 's'}</div>
                              <div className="text-[11px] text-muted-foreground mt-1">
                                {activeDeals.length} active (manage/edit) · {passiveDeals.length} passive (read-only)
                              </div>
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                              {[
                                { label: 'Active — manage & edit', list: activeDeals, tone: 'default' as const, labelClass: 'font-bold text-green-500' },
                                { label: 'Passive — read only', list: passiveDeals, tone: 'outline' as const, labelClass: 'font-bold text-white' },
                              ].map(section => (
                                <div key={section.label}>
                                  <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between">
                                    <span className={`text-[11px] uppercase tracking-wider ${section.labelClass}`}>{section.label}</span>
                                    <Badge variant={section.tone} className="text-[10px]">{section.list.length}</Badge>
                                  </div>
                                  {section.list.length === 0 ? (
                                    <div className="px-3 py-2 text-xs text-muted-foreground">None</div>
                                  ) : (
                                    <div className="divide-y divide-border">
                                      {section.list.map(d => (
                                        <div key={d.id} className="p-3 text-sm">
                                          <div className="font-medium">{d.issuerName}</div>
                                          <div className="text-xs text-muted-foreground">
                                            {d.currency} {d.size} · {d.tenor} · {d.coupon}
                                          </div>
                                          <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-[10px]">{d.stage}</Badge>
                                            {d.createdByOrg && (
                                              <span className="text-[11px] text-muted-foreground">Created by {d.createdByOrg}</span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const status = loginStatusFor(u.email);
                        const dotClass =
                          status.tone === 'active' ? 'bg-green-500' :
                          status.tone === 'dormant' ? 'bg-amber-500' :
                          status.tone === 'unconfirmed' ? 'bg-blue-500' :
                          'bg-muted-foreground/40';
                        return (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                              <span className="text-xs font-medium">{status.label}</span>
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {loginStatsLoading ? '…' : `Last: ${formatRelative(status.lastIso)}`}
                            </div>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-timestamp">{formatDate(u.createdAt)}</div>
                      <div className="text-xs text-muted-foreground">by {creatorName(u.createdBy || 'System')}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditUser(u)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(u)} disabled={u.id === currentUser.id}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TabsContent>
        {isMaster && (
          <TabsContent value="approvals" className="mt-6">
            <PendingApprovalsTab />
          </TabsContent>
        )}
        <TabsContent value="guests" className="mt-6">
          <GuestsTab />
        </TabsContent>
      </Tabs>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Full Name</Label>
                  <Input value={editName} onChange={e => setEditName(e.target.value)} className="mt-2 bg-background border-border" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Work Email</Label>
                  <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} className="mt-2 bg-background border-border" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Phone Number</Label>
                  <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="mt-2 bg-background border-border" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Organization</Label>
                  <Input value={editOrg} onChange={e => setEditOrg(e.target.value)} className="mt-2 bg-background border-border" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">User Role</Label>
                  <Select value={editRole} onValueChange={v => setEditRole(v as UserRole)}>
                    <SelectTrigger className="mt-2 bg-background border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="syndicate_admin">Syndicate Admin</SelectItem>
                      <SelectItem value="vendor_user">Read Only</SelectItem>
                      <SelectItem value="syndicate_readonly">Syndicate – Read Only</SelectItem>
                      <SelectItem value="sales_readonly">Sales – Read Only</SelectItem>
                      <SelectItem value="guest_readonly">Guest Read Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Category</Label>
                  <Select value={editCategory} onValueChange={v => setEditCategory(v as UserCategory)}>
                    <SelectTrigger className="mt-2 bg-background border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-md bg-muted/40 border border-border px-3 py-2 text-xs text-muted-foreground">
                Created: {formatDate(editingUser.createdAt)} by {creatorName(editingUser.createdBy || 'System')}
              </div>
              {/* Deal Chats this user is invited into */}
              <div className="border border-border rounded-md">
                <div className="px-3 py-2 border-b border-border flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-accent" />
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Deal Chats — invited</span>
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {chatChannels.filter(c => (c.participantIds ?? []).includes(editingUser.id)).length}
                  </Badge>
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-border">
                  {(() => {
                    const myChannels = chatChannels.filter(c => (c.participantIds ?? []).includes(editingUser.id));
                    if (myChannels.length === 0) {
                      return <div className="px-3 py-3 text-xs text-muted-foreground">This user is not a participant in any New Issue chat.</div>;
                    }
                    return myChannels.map(ch => {
                      const d = deals.find(x => x.id === ch.dealId);
                      return (
                        <div key={ch.id} className="px-3 py-2 text-sm flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{d ? d.issuerName : ch.label}</div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {d ? `${d.currency} ${d.size} · ${d.tenor}` : ch.label}
                            </div>
                          </div>
                          {d && <Badge variant="outline" className="text-[10px]">{d.stage}</Badge>}
                        </div>
                      );
                    });
                  })()}
                </div>
                <div className="px-3 py-2 border-t border-border text-[11px] text-muted-foreground">
                  Per-deal chat membership. Global User Role above is independent.
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
                <Button onClick={handleSaveEditUser}>Save Changes</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
