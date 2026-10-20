import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bot, Send, Loader2, ChevronDown, BellRing, X, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import { getAiModel } from "@/lib/aiModel";
import {
  cancelReminder, createReminder, listReminders, remindersChanged, validDraft, REMINDERS_CHANGED,
  type Reminder, type ReminderDraft,
} from "@/lib/copilot/reminders";

type Msg = { id?: string; role: "user" | "assistant"; content: string; links?: { label: string; path: string }[]; draft?: ReminderDraft | null; cancelIds?: string[] };

const FAQ = [
  "How do I create a new deal?",
  "Where is the Deal Checker?",
  "What does the bell icon show?",
  "Remind me when a deal is Free to Trade",
  "What reminders do I have?",
  "How do I add an entry in Bond Console?",
  "Who can approve Co-Pilot corrections?",
  "What do the deal stages mean?",
  "How do I invite a guest to a deal?",
  "Where can I see the audit log?",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Co-Pilot General mode: VDR help, navigation and user-confirmed reminders. */
export default function CopilotGeneral() {
  const { deals } = useApp();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [hi, setHi] = useState(-1);
  const [showSug, setShowSug] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const refreshReminders = () => listReminders().then(setReminders).catch(() => {});
  useEffect(() => {
    db.from("copilot_general_messages").select("id, role, content").order("created_at").limit(200)
      .then(({ data }: { data: Msg[] | null }) => data && setMsgs(data));
    refreshReminders();
    window.addEventListener(REMINDERS_CHANGED, refreshReminders);
    return () => window.removeEventListener(REMINDERS_CHANGED, refreshReminders);
  }, []);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ block: "end" }); }, [msgs, open]);

  const suggestions = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const past = msgs.filter((m) => m.role === "user").map((m) => m.content);
    const dealQs = deals.slice(0, 50).flatMap((d) => [`Remind me when ${d.issuerName} is Free to Trade`, `What stage is ${d.issuerName} at?`]);
    const seen = new Set<string>();
    return [...past.reverse(), ...FAQ, ...dealQs]
      .filter((s) => s.toLowerCase().includes(t) && s.toLowerCase() !== t && !seen.has(s) && seen.add(s))
      .slice(0, 6);
  }, [q, msgs, deals]);

  const save = async (role: Msg["role"], content: string) => {
    const { error } = await db.from("copilot_general_messages").insert({ role, content });
    if (error) console.error("[Co-Pilot] could not save message", error);
  };

  const ask = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setQ(""); setShowSug(false); setOpen(true); setBusy(true);
    const history = msgs.slice(-20).map(({ role, content }) => ({ role, content }));
    setMsgs((m) => [...m, { role: "user", content: question }]);
    void save("user", question);
    const { data, error } = await supabase.functions.invoke("copilot-general", { body: { question, history, path: pathname, model: getAiModel() } });
    let reply: Msg;
    if (error || !data || data.error) {
      let message = data?.message;
      try { message = message || (await (error as { context?: Response })?.context?.json())?.message; } catch { /* ignore */ }
      reply = { role: "assistant", content: message || "Co-Pilot could not answer right now." };
    } else {
      reply = { role: "assistant", content: data.answer || "…", links: data.links, draft: validDraft(data.reminder) ? data.reminder : null, cancelIds: data.cancel_ids };
      void save("assistant", reply.content);
    }
    setMsgs((m) => [...m, reply]);
    setBusy(false);
  };

  const resolve = (i: number) => setMsgs((m) => m.map((x, j) => (j === i ? { ...x, draft: null, cancelIds: [] } : x)));
  const confirmDraft = async (i: number, d: ReminderDraft) => {
    try { await createReminder(d); resolve(i); remindersChanged(); setMsgs((m) => [...m, { role: "assistant", content: `Reminder saved: ${d.label}` }]); }
    catch { setMsgs((m) => [...m, { role: "assistant", content: "Could not save that reminder." }]); }
  };
  const confirmCancel = async (i: number, ids: string[]) => {
    await Promise.all(ids.map((id) => cancelReminder(id).catch(() => {})));
    resolve(i); remindersChanged();
  };
  const newConversation = async () => {
    await db.from("copilot_general_messages").delete().not("id", "is", null);
    setMsgs([]);
  };
  const active = reminders.filter((r) => r.status === "active");
  const dealName = (id: string | null) => deals.find((d) => d.id === id)?.issuerName;

  return (
    <div className="relative w-full min-w-0">
      <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); ask(hi >= 0 && suggestions[hi] ? suggestions[hi] : q); }}>
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex h-8 shrink-0 items-center gap-2 px-2 text-sm">
          <Bot className="h-4 w-4 text-primary" />
          <span className="font-semibold">Deal Co-Pilot</span>
          <span className="hidden sm:inline text-xs text-muted-foreground">· General</span>
          {active.length > 0 && <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Active reminders"><BellRing className="h-3.5 w-3.5" />{active.length}</span>}
        </button>
        <div className="relative min-w-0 flex-1">
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setShowSug(true); setHi(-1); }}
            onFocus={() => setShowSug(true)}
            onBlur={() => setTimeout(() => setShowSug(false), 150)}
            onKeyDown={(e) => {
              if (!showSug || !suggestions.length) return;
              if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(suggestions.length - 1, h + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(-1, h - 1)); }
              else if (e.key === "Escape") setShowSug(false);
            }}
            placeholder="Ask anything about the VDR, or ‘remind me when…’"
            className="h-8 text-sm"
            aria-label="Ask Co-Pilot"
          />
          {showSug && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-9 z-50 rounded-md border border-border bg-popover py-1 text-sm shadow-lg" role="listbox">
              {suggestions.map((s, i) => (
                <li key={s} role="option" aria-selected={i === hi}>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); ask(s); }} className={`w-full px-3 py-1.5 text-left hover:bg-accent ${i === hi ? "bg-accent" : ""}`}>{s}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button type="submit" size="sm" disabled={busy || !q.trim()} className="h-8">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} className="h-8 w-8 p-0 text-muted-foreground" aria-label={open ? "Hide Co-Pilot" : "Show Co-Pilot"}>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
      </form>

      {open && (
        <div className="absolute left-0 right-0 top-10 z-40 flex max-h-[70vh] flex-col rounded-md border border-border bg-card shadow-xl">
          {active.length > 0 && (
            <div className="border-b border-border px-3 py-2 text-xs">
              <div className="mb-1 font-semibold text-muted-foreground">My reminders</div>
              {active.map((r) => (
                <div key={r.id} className="flex items-center gap-2 py-0.5">
                  <BellRing className="h-3 w-3 text-primary" />
                  <span className="flex-1 truncate">{r.label}{dealName(r.deal_id) ? ` — ${dealName(r.deal_id)}` : ""} <span className="text-muted-foreground">({r.trigger_kind === "date" ? new Date(r.due_at!).toLocaleString() : `at ${r.trigger_stage}`})</span></span>
                  <button type="button" onClick={() => cancelReminder(r.id).then(remindersChanged)} className="text-muted-foreground hover:text-destructive" aria-label={`Cancel reminder ${r.label}`}><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex-1 space-y-3 overflow-auto p-3 text-sm">
            {msgs.length === 0 && <p className="text-muted-foreground">Ask how to do something in the VDR, where to find a feature, or say “remind me when … is Free to Trade”.</p>}
            {msgs.map((m, i) => (
              <div key={m.id ?? i} className={m.role === "user" ? "ml-auto max-w-[85%] rounded-md bg-primary px-3 py-2 text-primary-foreground" : "max-w-[95%]"}>
                <div className="whitespace-pre-wrap">{m.content}</div>
                {!!m.links?.length && (
                  <div className="mt-1 flex flex-wrap gap-2">{m.links.map((l) => <Link key={l.path + l.label} to={l.path} onClick={() => setOpen(false)} className="text-xs text-primary underline">{l.label}</Link>)}</div>
                )}
                {m.draft && (
                  <div className="mt-2 rounded border border-border p-2 text-xs">
                    <div className="font-semibold">Set this reminder?</div>
                    <div>{m.draft.label}{dealName(m.draft.deal_id) ? ` — ${dealName(m.draft.deal_id)}` : ""} ({m.draft.trigger_kind === "date" ? new Date(m.draft.due_at!).toLocaleString() : `when stage reaches ${m.draft.trigger_stage}`})</div>
                    <div className="mt-1 flex gap-2">
                      <Button size="sm" className="h-7" onClick={() => confirmDraft(i, m.draft!)}><Check className="mr-1 h-3 w-3" />Confirm</Button>
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => resolve(i)}>Dismiss</Button>
                    </div>
                  </div>
                )}
                {!!m.cancelIds?.length && (
                  <div className="mt-2 flex gap-2 text-xs">
                    <Button size="sm" variant="destructive" className="h-7" onClick={() => confirmCancel(i, m.cancelIds!)}>Confirm cancel ({m.cancelIds.length})</Button>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => resolve(i)}>Keep</Button>
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Thinking…</div>}
            <div ref={endRef} />
          </div>
          {msgs.length > 0 && (
            <div className="border-t border-border px-3 py-1.5 text-right">
              <button type="button" onClick={newConversation} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><RotateCcw className="h-3 w-3" />New conversation</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
