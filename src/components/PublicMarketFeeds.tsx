import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { RefreshCw, ExternalLink, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PublicMarketSnapshot } from '../../supabase/functions/_shared/public-market-data';

/** A titled block whose body opens and closes when its heading is clicked. */
function Fold({
  title,
  titleClassName = 'text-sm font-semibold',
  subtitle,
  defaultOpen = true,
  actions,
  children,
}: {
  title: string;
  titleClassName?: string;
  subtitle?: string;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <section className="border border-border rounded-md" aria-label={title}>
      <div className="flex items-start justify-between gap-3 flex-wrap p-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen(o => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="min-w-0">
            <span className={titleClassName}>{title}</span>
            {subtitle && <span className="block text-xs font-normal text-muted-foreground">{subtitle}</span>}
          </span>
          <ChevronDown
            aria-hidden
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
        {actions}
      </div>
      {open && <div id={bodyId} className="space-y-3 px-3 pb-3">{children}</div>}
    </section>
  );
}

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
    <Fold
      title="Public Market Data"
      titleClassName="font-semibold"
      subtitle="Latest published rates · Not real-time trading quotes"
      actions={<Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} />Refresh feeds</Button>}
    >
      {query.isPending && <p role="status" className="text-sm text-muted-foreground">Loading published rates…</p>}
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
      </>}
    </Fold>
    <Fold title="Central Bank News">
      {query.isPending && <p role="status" className="text-sm text-muted-foreground">Loading headlines…</p>}
      {query.error && <p role="alert" className="text-sm text-destructive">{query.error.message}</p>}
      {query.data && <>
        <div className="divide-y divide-border">{query.data.headlines.slice(0, 16).map(item => <article key={item.url} className="py-3">
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 text-sm font-medium text-foreground hover:text-primary"><span className="min-w-0 break-words">{item.title}</span><ExternalLink className="h-3 w-3 shrink-0 mt-1" /></a>
          <p className="text-xs text-muted-foreground mt-1">{item.source} · {new Date(item.publishedAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</p>
        </article>)}</div>
        {!query.data.headlines.length && <p className="text-sm text-muted-foreground">No headlines available from the public sources.</p>}
      </>}
    </Fold>
  </section>;
}
