import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Bell, MessageSquare, Users as UsersIcon, X } from 'lucide-react';
import { useScopedApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { stripHtml } from '@/lib/htmlText';

type ResultGroup = 'Deals' | 'Alerts' | 'Chats' | 'People';
type Result = {
  id: string;
  group: ResultGroup;
  label: string;
  sub: string;
  to: string;
  score: number;
};

const ICONS: Record<ResultGroup, typeof FileText> = {
  Deals: FileText,
  Alerts: Bell,
  Chats: MessageSquare,
  People: UsersIcon,
};

function highlight(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-primary/20 text-foreground rounded-sm px-0.5">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export default function GlobalSearch() {
  const navigate = useNavigate();
  const { deals, messages, chatChannels, chatMessages, users } = useScopedApp();
  const { isAdmin, isMaster, guest } = useAuth();
  const [raw, setRaw] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setQuery(raw.trim()), 120);
    return () => clearTimeout(t);
  }, [raw]);

  // Cmd/Ctrl+K shortcut opens the panel and focuses it; Escape closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Focus the input whenever the panel opens
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else {
      setActiveIdx(0);
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const results = useMemo<Result[]>(() => {
    const q = query.toLowerCase();
    if (!q) return [];
    const out: Result[] = [];

    const scoreOf = (hay: string, exact?: string) => {
      const h = hay.toLowerCase();
      if (exact && h === exact.toLowerCase()) return 100;
      if (h.startsWith(q)) return 50;
      if (h.includes(q)) return 20;
      return 0;
    };

    // Deals
    for (const d of deals) {
      const fields = [d.issuerName, d.isin || '', d.currency, d.tenor, d.stage, d.coupon || '', d.cusip || ''];
      const s = Math.max(...fields.map(f => scoreOf(f, d.isin || d.issuerName)));
      if (s > 0) {
        out.push({
          id: `deal-${d.id}`,
          group: 'Deals',
          label: `${d.issuerName} ${d.currency} ${d.tenor}`,
          sub: `${d.stage}${d.isin ? ` · ${d.isin}` : ''}${d.coupon ? ` · ${d.coupon}%` : ''}`,
          to: `/deals?dealId=${d.id}`,
          score: s,
        });
      }
    }

    // Alerts (messages)
    for (const m of messages) {
      const body = stripHtml(m.body || '');
      const s = Math.max(scoreOf(m.subject), scoreOf(body));
      if (s > 0) {
        const dealId = m.dealIds[0];
        out.push({
          id: `alert-${m.id}`,
          group: 'Alerts',
          label: m.subject || '(no subject)',
          sub: `${m.status}${dealId ? ` · ${deals.find(d => d.id === dealId)?.issuerName ?? ''}` : ''}`,
          to: dealId ? `/messages?dealId=${dealId}` : '/messages',
          score: s,
        });
      }
    }

    // Chats — channels + recent messages
    for (const ch of chatChannels) {
      const s = scoreOf(ch.label);
      if (s > 0) {
        out.push({
          id: `chat-${ch.id}`,
          group: 'Chats',
          label: ch.label,
          sub: ch.dealId ? (deals.find(d => d.id === ch.dealId)?.issuerName ?? 'Deal thread') : 'Direct thread',
          to: ch.dealId ? `/inbox?dealId=${ch.dealId}` : '/inbox',
          score: s,
        });
      }
    }
    const seenChat = new Set(out.filter(r => r.group === 'Chats').map(r => r.id));
    for (const cm of chatMessages) {
      const s = scoreOf(cm.body);
      if (s > 0) {
        const ch = chatChannels.find(c => c.id === cm.channelId);
        if (!ch) continue;
        const key = `chat-${ch.id}`;
        if (seenChat.has(key)) continue;
        seenChat.add(key);
        out.push({
          id: `chatmsg-${cm.id}`,
          group: 'Chats',
          label: cm.body.slice(0, 80),
          sub: `${cm.senderName} · ${ch.label}`,
          to: ch.dealId ? `/inbox?dealId=${ch.dealId}` : '/inbox',
          score: s,
        });
      }
    }

    // People — admins only, not guests
    if ((isAdmin || isMaster) && !guest) {
      for (const u of users) {
        const s = Math.max(scoreOf(u.name), scoreOf(u.email), scoreOf(u.organization));
        if (s > 0) {
          out.push({
            id: `user-${u.id}`,
            group: 'People',
            label: u.name,
            sub: `${u.email} · ${u.organization}`,
            to: '/admin',
            score: s,
          });
        }
      }
    }

    out.sort((a, b) => b.score - a.score);
    // Cap per group
    const counts: Record<string, number> = {};
    return out.filter(r => {
      counts[r.group] = (counts[r.group] || 0) + 1;
      return counts[r.group] <= 5;
    });
  }, [query, deals, messages, chatChannels, chatMessages, users, isAdmin, isMaster, guest]);

  // Group ordering
  const grouped = useMemo(() => {
    const order: ResultGroup[] = ['Deals', 'Alerts', 'Chats', 'People'];
    return order
      .map(g => ({ group: g, items: results.filter(r => r.group === g) }))
      .filter(g => g.items.length > 0);
  }, [results]);

  const flat = useMemo(() => grouped.flatMap(g => g.items), [grouped]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  const choose = (r: Result) => {
    setOpen(false);
    setRaw('');
    navigate(r.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flat[activeIdx]) {
      e.preventDefault();
      choose(flat[activeIdx]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="p-2 -m-0.5 rounded-md hover:bg-accent/50 transition-colors"
        aria-label="Search deals, alerts, chats, people"
        aria-expanded={open}
        title="Search (⌘K)"
      >
        <Search className="h-5 w-5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 w-[min(92vw,30rem)] rounded-md border bg-popover text-popover-foreground shadow-lg overflow-hidden">
          <div className="relative flex items-center border-b">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search deals, alerts, chats, people…"
              className="w-full h-10 pl-9 pr-9 text-sm bg-transparent placeholder:text-muted-foreground/70 focus:outline-none"
              aria-label="Global search"
            />
            <button
              type="button"
              onClick={() => { setOpen(false); setRaw(''); }}
              className="absolute right-2 p-1 rounded hover:bg-accent/50"
              aria-label="Close search"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            {raw.length > 0 && grouped.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">No matches for “{query}”.</div>
            ) : raw.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">Start typing to search deals, alerts, chats and people.</div>
            ) : (
              grouped.map(({ group, items }) => (
                <div key={group} className="py-1">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</div>
                  {items.map(r => {
                    const Icon = ICONS[r.group];
                    const idx = flat.indexOf(r);
                    const isActive = idx === activeIdx;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onMouseEnter={() => setActiveIdx(idx)}
                        onClick={() => choose(r)}
                        className={`w-full flex items-start gap-2 px-3 py-2 text-left text-sm transition-colors ${isActive ? 'bg-accent' : 'hover:bg-accent/50'}`}
                      >
                        <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{highlight(r.label, query)}</div>
                          <div className="truncate text-xs text-muted-foreground">{highlight(r.sub, query)}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
