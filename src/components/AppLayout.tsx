import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FileText, Bell as BellIcon, Shield, ClipboardList, Bell, ChevronDown, Users, PenSquare, Inbox, LogOut, Settings, Menu, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useApp, resetDemoData } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { RoleBadge } from '@/components/RoleBadge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import GlobalSearch from '@/components/GlobalSearch';
import AgentBrowserTools from '@/components/AgentBrowserTools';

const navItems = [
  { path: '/messages', label: 'New Issue Board', icon: BellIcon },
  { path: '/deals', label: 'Digital Term Sheet', icon: FileText },
  { path: '/inbox', label: 'My Deal Chats', icon: Inbox },
  { path: '/ai-draft', label: 'Create New Issue', icon: PenSquare },
  { path: '/admin', label: 'Address Book & User Admin', icon: Users, adminOnly: true },
  { path: '/bond-console', label: 'Bond Console', icon: Settings },
  { path: '/master-admin', label: 'Master Admin', icon: Shield, masterOnly: true },
  { path: '/audit-log', label: 'Audit Log', icon: ClipboardList },
  { path: '/settings', label: 'Settings', icon: Sparkles },
  
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, setCurrentUser, users, notifications, markNotificationRead } = useApp();
  const { signOut, guest, profileName, isAdmin, isMaster } = useAuth();
  const myUnread = notifications.filter(n => !n.read && n.userId === currentUser.id);
  const unreadCount = myUnread.length;
  const hasChatInvite = myUnread.some(n => n.type === 'chat_invite');

  const handleBellClick = () => {
    // Going to My Deal Chats — mark chat-invite notifications as read.
    myUnread.filter(n => n.type === 'chat_invite').forEach(n => markNotificationRead(n.id));
    navigate('/inbox');
  };

  // Guests get a heavily restricted nav
  const visibleNav = guest
    ? navItems.filter(n => n.path === '/messages' || n.path === '/inbox')
    : navItems;

  return (
    <div className="flex h-screen overflow-hidden">
      <AgentBrowserTools />
      {/* Sidebar */}
      <aside className="hidden w-60 bg-sidebar text-sidebar-foreground md:flex flex-col shrink-0">
        <div className="flex items-center border-b border-sidebar-border px-4 pt-[72px] pb-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 bg-emerald-500 rounded-sm shrink-0">
              <div className="w-3.5 h-3.5 bg-sidebar rotate-45" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold tracking-tight text-slate-100">Virtual</span>
              <span className="text-lg font-normal tracking-tight text-slate-400">Deal Room</span>
            </div>
          </div>
        </div>
        <nav className={`flex-1 p-2 space-y-1 ${location.pathname === '/messages' ? 'pt-6' : ''}`}>

          {visibleNav.map(item => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            const visible = item.masterOnly ? isMaster : item.adminOnly ? isAdmin : true;
            if (!visible) return null;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white text-glow transition-colors ${isActive ? 'bg-sidebar-accent font-bold' : 'hover:bg-sidebar-accent/50'}`}>
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {/* User switcher */}
        <div className="p-3 border-t border-sidebar-border">
          {guest ? (
            <div className="text-xs">
              <div className="font-medium">{guest.name || guest.email}</div>
              <div className="text-sidebar-foreground/60">Guest · read-only</div>
              <Button variant="ghost" size="sm" onClick={signOut} className="w-full mt-2 justify-start h-7 text-xs">
                <LogOut className="h-3 w-3 mr-2" /> Log out
              </Button>
            </div>
          ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-between text-sidebar-foreground hover:bg-sidebar-accent text-xs h-auto py-2">
                <div className="text-left">
                  <RoleBadge role={currentUser.role} className="text-[10px] px-1.5 py-0" />

                </div>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem disabled>
                <div>
                  <div className="font-medium">{profileName || currentUser.name}</div>
                  <div className="text-xs text-muted-foreground">{currentUser.organization}</div>
                  <RoleBadge role={currentUser.role} className="mt-1 text-[10px] px-1.5 py-0" />
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { if (confirm('Reset all demo data to seeded mock data? This will reload the page.')) resetDemoData(); }}
            className="w-full mt-2 text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent justify-start h-7"
          >
            Reset demo data
          </Button>
        </div>
      </aside>
      {/* Main */}
      <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
        <header className="h-12 border-b flex items-center justify-between gap-2 px-2 sm:px-4 bg-card shrink-0">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden h-9 w-9 shrink-0" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(86vw,20rem)] bg-sidebar text-sidebar-foreground border-sidebar-border p-0 flex flex-col gap-0">
              <SheetHeader className="border-b border-sidebar-border px-4 py-5 text-left">
                <SheetTitle className="flex items-center gap-2 text-sidebar-foreground">
                  <span className="flex items-center justify-center w-8 h-8 bg-emerald-500 rounded-sm shrink-0" aria-hidden="true">
                    <span className="w-3.5 h-3.5 bg-sidebar rotate-45" />
                  </span>
                  <span><strong>Virtual</strong> <span className="text-sidebar-foreground/70 font-normal">Deal Room</span></span>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex-1 overflow-y-auto p-2 pt-4 space-y-1">
                {visibleNav.map(item => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;
                  const visible = item.masterOnly ? isMaster : item.adminOnly ? isAdmin : true;
                  if (!visible) return null;
                  return (
                    <SheetClose asChild key={item.path}>
                      <Link
                        to={item.path}
                        className={`flex items-center gap-3 px-3 py-3 rounded-md text-sm text-sidebar-foreground transition-colors ${isActive ? 'bg-sidebar-accent font-bold' : 'hover:bg-sidebar-accent/50'}`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    </SheetClose>
                  );
                })}
              </nav>
              <div className="p-3 border-t border-sidebar-border">
                <div className="mb-2 text-xs text-sidebar-foreground/70">
                  <div className="font-medium text-sidebar-foreground">{guest ? (guest.name || guest.email) : (profileName || currentUser.name)}</div>
                  <div>{guest ? 'Guest · read-only' : currentUser.organization}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent">
                  <LogOut className="h-4 w-4 mr-2" /> Log out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1 max-w-xl">
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={handleBellClick}
              className="relative p-1 -m-1 rounded hover:bg-accent/50 transition-colors"
              title={hasChatInvite ? 'Pending chat invite — open My Deal Chats' : 'Notifications'}
              aria-label="Notifications"
            >
              <Bell className={`h-5 w-5 ${hasChatInvite ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-destructive">{unreadCount}</Badge>
              )}
            </button>
            <Badge variant="outline" className="hidden sm:inline-flex text-xs">{currentUser.organization}</Badge>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-auto p-3 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
