import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { ArrowRight, FileText, MessageSquare, AlertTriangle, TrendingUp } from 'lucide-react';

const stageColors: Record<string, string> = {
  Mandate: 'stage-mandate',
  Announced: 'stage-mandate',
  Launched: 'stage-launched',
  'Books Open': 'stage-launched',
  'Books Closed': 'stage-launched',
  Priced: 'stage-priced',
  Settled: 'stage-closed',
};

export default function Dashboard() {
  const { deals, messages, auditLog, currentUser } = useApp();

  const activeDeals = deals.filter(d => d.stage !== 'Settled');
  const draftMessages = messages.filter(m => m.status === 'draft');
  const recentActivity = auditLog.slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Welcome back, {currentUser.name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active Deals</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{activeDeals.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Draft Messages</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{draftMessages.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Sent Today</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{messages.filter(m => m.status === 'sent' && m.sentAt && format(m.sentAt, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Messages</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{messages.length}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Active Deals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Active Deals</CardTitle>
            <Link to="/deals" className="text-sm text-primary flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeDeals.map(deal => (
              <div key={deal.id} className="flex items-center justify-between p-3 rounded-md border">
                <div>
                  <div className="font-medium text-sm">{deal.borrower}</div>
                  <div className="text-xs text-muted-foreground">{deal.currency} {deal.size} — {deal.tenor}</div>
                </div>
                <Badge className={stageColors[deal.stage]}>{deal.stage}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <Link to="/audit-log" className="text-sm text-primary flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentActivity.map(entry => (
              <div key={entry.id} className="flex items-start gap-3 py-2 border-b last:border-b-0">
                <div className="mt-0.5">
                  {entry.entityType === 'deal' && <FileText className="h-4 w-4 text-primary" />}
                  {entry.entityType === 'message' && <MessageSquare className="h-4 w-4 text-accent" />}
                  {entry.entityType === 'user' && <AlertTriangle className="h-4 w-4 text-warning" />}
                  {entry.entityType === 'permission' && <TrendingUp className="h-4 w-4 text-info" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{entry.details}</div>
                  <div className="text-xs text-muted-foreground">{format(entry.timestamp, 'MMM d, HH:mm')}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
