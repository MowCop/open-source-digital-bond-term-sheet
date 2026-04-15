import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, MessageSquare, Bot, Shield, ClipboardList, Bell, ChevronDown } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/deals', label: 'Deal Data', icon: FileText },
  { path: '/messages', label: 'Master Deal Alerts', icon: MessageSquare },
  { path: '/ai-draft', label: 'AI Draft', icon: Bot },
  { path: '/admin', label: 'Admin', icon: Shield },
  { path: '/audit-log', label: 'Audit Log', icon: ClipboardList },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { currentUser, setCurrentUser, users, notifications } = useApp();
  const unreadCount = notifications.filter(n => !n.read && n.userId === currentUser.id).length;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-sidebar text-sidebar-foreground flex flex-col shrink-0">
        <div className="p-4 border-b border-sidebar-border">
          <h1 className="text-lg font-bold text-sidebar-primary-foreground">BondVDR</h1>
          <p className="text-xs text-sidebar-foreground/60">Virtual Data Room</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            const visible = item.path === '/admin' ? currentUser.role === 'master_admin' : true;
            if (!visible) return null;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/50'}`}>
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {/* User switcher */}
        <div className="p-3 border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-between text-sidebar-foreground hover:bg-sidebar-accent text-xs h-auto py-2">
                <div className="text-left">
                  <div className="font-medium">{currentUser.name}</div>
                  <div className="text-sidebar-foreground/60">{currentUser.role.replace('_', ' ')}</div>
                </div>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {users.map(u => (
                <DropdownMenuItem key={u.id} onClick={() => setCurrentUser(u)}>
                  <div>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.role.replace('_', ' ')} — {u.organization}</div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 border-b flex items-center justify-between px-4 bg-card shrink-0">
          <div />
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-destructive">{unreadCount}</Badge>
              )}
            </div>
            <Badge variant="outline" className="text-xs">{currentUser.organization}</Badge>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
