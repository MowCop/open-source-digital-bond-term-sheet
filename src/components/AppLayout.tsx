import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FileText, Bell as BellIcon, Shield, ClipboardList, Bell, ChevronDown, Users, PenSquare, Inbox, LogOut, Settings, RefreshCw } from 'lucide-react';
import { useApp, resetDemoData } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { RoleBadge } from '@/components/RoleBadge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import GlobalSearch from '@/components/GlobalSearch';

const navItems = [
  { path: '/messages', label: 'New Issue Board', icon: BellIcon },
  { path: '/inbox', label: 'My Deal Chats', icon: Inbox },
  { path: '/ai-draft', label: 'Create New Issue', icon: PenSquare },
  { path: '/admin', label: 'Address Book & User Admin', icon: Users, adminOnly: true },
  { path: '/deals', label: 'Termsheet Data', icon: FileText },
  { path: '/bond-console', label: 'Bond Console', icon: Settings },
  { path: '/master-admin', label: 'Master Admin', icon: Shield, masterOnly: true },
  { path: '/audit-log', label: 'Audit Log', icon: ClipboardList },
  { path: '/sync-log', label: 'Sync Log', icon: RefreshCw, adminOnly: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
      {/* Sidebar */}
      <aside className="w-60 bg-sidebar text-sidebar-foreground flex flex-col shrink-0">
        <div className="flex items-center justify-center min-h-[100px] border-b border-sidebar-border px-4">
          <p className="text-center text-2xl font-extrabold text-logo text-logo-depth">Virtual Deal Room</p>
        </div>
        <nav className={`flex-1 p-2 space-y-1 ${location.pathname === '/messages' ? 'pt-11' : ''}`}>
          {visibleNav.map(item => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            const visible = item.masterOnly ? isMaster : item.adminOnly ? isAdmin : true;
            if (!visible) return null;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-bold' : 'hover:bg-sidebar-accent/50'}`}>
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
                  <div className="font-medium">{profileName || currentUser.name}</div>
                  <RoleBadge role={currentUser.role} className="mt-0.5 text-[10px] px-1.5 py-0" />
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
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 border-b flex items-center justify-between px-4 bg-card shrink-0">
          <div className="flex-1 max-w-xl">
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-3">
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
            <Badge variant="outline" className="text-xs">{currentUser.organization}</Badge>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
