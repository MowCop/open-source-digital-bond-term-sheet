import { useQuery } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PublicMarketSnapshot } from '../../supabase/functions/_shared/public-market-data';

export default function PublicMarketFeeds() {
  const query = useQuery({
    queryKey: ['public-market-feeds'],
    queryFn: async (): Promise<PublicMarketSnapshot> => {
      const { data, error } = await supabase.functions.invoke('public-market-feeds', { body: {} });
      if (error) {
        if (error instanceof FunctionsHttpError) { const body = await error.context.json().catch(() => null); throw new Error(body?.error || 'Market feeds are unavailable'); }
        throw error;
      }
      return data;
    },
    refetchInterval: 300_000, staleTime: 60_000, retry: 1,
  });
  return <section className="space-y-4" aria-label="Public market rates and news">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div><h3 className="font-semibold">Public Market Data</h3><p className="text-xs text-muted-foreground">Latest published rates · Not real-time trading quotes</p></div>
      <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} />Refresh feeds</Button>
    </div>
    {query.isPending && <p role="status" className="text-sm text-muted-foreground">Loading published rates and headlines…</p>}
    {query.error && <p role="alert" className="text-sm text-destructive">{query.error.message}</p>}
    {query.data && <>
      <div className="flex gap-2 items-center flex-wrap text-xs text-muted-foreground"><Badge variant="outline">Public sources</Badge><span>Retrieved {new Date(query.data.fetchedAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</span></div>
      {query.data.errors.map(e => <p key={e.source} className="text-xs text-destructive" role="status">{e.source}: {e.message}</p>)}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {query.data.rates.map(rate => <div key={rate.id} className="border border-border rounded-md p-3 min-w-0">
          <div className="text-sm font-medium">{rate.label}</div><div className="text-xl font-semibold tabular-nums">{rate.value.toLocaleString('en-GB', { maximumFractionDigits: 5 })}{rate.unit === '%' ? '%' : ''}</div>
          <div className="text-xs text-muted-foreground">{rate.unit === 'per EUR' ? 'Per €1 · ' : ''}As of {rate.date}</div>
          <a className="text-xs text-primary underline break-words" href={rate.url} target="_blank" rel="noopener noreferrer">{rate.source}</a>
        </div>)}
      </div>
      {!query.data.rates.length && <p className="text-sm text-muted-foreground">No rates available from the public sources.</p>}
      <h3 className="text-sm font-semibold">Central Bank News</h3>
      <div className="divide-y divide-border">{query.data.headlines.slice(0, 16).map(item => <article key={item.url} className="py-3">
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 text-sm font-medium text-foreground hover:text-primary"><span className="min-w-0 break-words">{item.title}</span><ExternalLink className="h-3 w-3 shrink-0 mt-1" /></a>
        <p className="text-xs text-muted-foreground mt-1">{item.source} · {new Date(item.publishedAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</p>
      </article>)}</div>
      {!query.data.headlines.length && <p className="text-sm text-muted-foreground">No headlines available from the public sources.</p>}
    </>}
  </section>;
}