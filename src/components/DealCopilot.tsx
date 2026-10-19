import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { COPILOT_ASK, getLiveChecks, onLiveChecks, tally, type CopilotAsk } from "@/lib/copilot/liveChecks";
import {
  Bot,
  Check,
  X,
  Send,
  Upload,
  RefreshCw,
  Loader2,
  FileSearch,
  ChevronDown,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import AiModelPicker from "@/components/AiModelPicker";
import {
  callCopilot,
  changed,
  COPILOT_CHANGED,
  processCopilot,
  reviewSavedDocument,
} from "@/lib/copilot/client";
import {
  listDealDocuments,
  openDealDocument,
  uploadDealDocument,
  type DealDocument,
} from "@/lib/dealDocuments";
import { toast } from "sonner";
import {
  specialistNames,
  type SpecialistReport,
} from "@/lib/copilot/specialists";
import type { Deal } from "@/types/bond";

function SpecialistReports({ reports }: { reports: SpecialistReport[] }) {
  return (
    <div className="space-y-2 min-w-0">
      <p className="text-xs font-medium text-muted-foreground">
        Specialist panel
      </p>
      {reports.map((report) => (
        <details key={report.id} className="border-t border-border pt-2 text-xs min-w-0">
          <summary className="cursor-pointer font-medium break-words">
            {specialistNames[report.id]}
          </summary>
          <div className="mt-2 space-y-2 break-words">
            <p className="whitespace-pre-wrap">{report.summary}</p>
            {report.findings.map((finding, index) => (
              <div key={index}>
                <p className="font-medium">{finding.topic}</p>
                <p>{finding.message}</p>
                <blockquote className="mt-1 border-l-2 border-border pl-2 text-muted-foreground">
                  “{finding.quote}”
                </blockquote>
              </div>
            ))}
            {!!report.missingEvidence.length && (
              <div>
                <h4 className="font-medium">Evidence needed</h4>
                <ul className="mt-1 list-disc pl-4 space-y-1">
                  {report.missingEvidence.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.warnings.map((warning, i) => (
              <p key={i} className="text-muted-foreground">
                {warning}
              </p>
            ))}
            {report.bulletin && (
              <div>
                <h4 className="font-medium">Investor bulletin · Draft</h4>
                <p className="whitespace-pre-wrap">{report.bulletin}</p>
              </div>
            )}
            {report.announcement && (
              <div>
                <h4 className="font-medium">Deal announcement · Draft</h4>
                <p className="whitespace-pre-wrap">{report.announcement}</p>
              </div>
            )}
            {report.xmlDraft && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([report.xmlDraft], { type: "application/xml" }),
                  );
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "deal-announcement-draft.xml";
                  link.click();
                  URL.revokeObjectURL(url);
                }}
              >
                XML draft (unvalidated)
              </Button>
            )}
            <p className="text-muted-foreground">
              {new Date(report.reviewedAt).toLocaleString("en-GB")}
            </p>
          </div>
        </details>
      ))}
    </div>
  );
}
type Msg = { id: string; role: string; body: string };
type Change = {
  id: string;
  field: string;
  before_value: string;
  after_value: string;
  reason: string;
  status: string;
};
type Report = {
  summary?: string;
  warnings?: string[];
  differences?: {
    field: string;
    before: string;
    after: string;
    quote: string;
  }[];
  versionDifferences?: { field: string; before: string; after: string }[];
  risks?: { message: string; quote: string }[];
  deterministic?: { message: string; field: string }[];
  comparison?: { comparedAt: string };
  specialists?: SpecialistReport[];
  dealChecker?: { tally: { pass: number; warn: number; fail: number }; capturedAt: string };
  checkerFindings?: { check: string; level: 'warn' | 'fail'; resolution: 'proposed' | 'needs_input'; field?: string; note?: string }[];
};
type Run = {
  id: string;
  kind: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  report: Report | null;
  error: string | null;
};
export default function DealCopilot({
  deal,
  hasUnsavedTerms,
  checker,
}: {
  deal: Deal;
  hasUnsavedTerms: boolean;
  /** The Deal Checker, rendered inside the Co-Pilot panel and always visible. */
  checker?: ReactNode;
}) {
  const [thread, setThread] = useState<string>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [docs, setDocs] = useState<DealDocument[]>([]);
  const [editor, setEditor] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [lights, setLights] = useState(() => tally(getLiveChecks(deal.id)));
  useEffect(() => onLiveChecks((id) => { if (id === deal.id) setLights(tally(getLiveChecks(id))); }), [deal.id]);
  const input = useRef<HTMLInputElement>(null);
  const refresh = useCallback(
    async (id: string) => {
      const [m, c, r, d] = await Promise.all([
        supabase
          .from("copilot_messages")
          .select("*")
          .eq("thread_id", id)
          .order("created_at")
          .limit(200),
        supabase
          .from("copilot_changes")
          .select("*")
          .eq("thread_id", id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("copilot_runs")
          .select("*")
          .eq("thread_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
        listDealDocuments(deal.id),
      ]);
      for (const result of [m, c, r]) if (result.error) throw result.error;
      setMessages(m.data ?? []);
      setChanges(c.data ?? []);
      setRuns((r.data ?? []) as unknown as Run[]);
      setDocs(d);
    },
    [deal.id],
  );
  useEffect(() => {
    let alive = true;
    if (!open) return;
    void (async () => {
      const [t, p] = await Promise.all([
        supabase.rpc("copilot_open", { _deal: deal.id }),
        supabase.rpc("copilot_editor", { _deal: deal.id }),
      ]);
      if (t.error) throw t.error;
      if (p.error) throw p.error;
      if (!alive) return;
      setThread(t.data);
      setEditor(p.data);
      await refresh(t.data);
      await processCopilot(t.data);
      if (alive) await refresh(t.data);
    })().catch((e) => {
      if (alive) setError(e.message);
    });
    return () => {
      alive = false;
    };
  }, [open, deal.id, refresh]);
  useEffect(() => {
    if (!thread) return;
    const h = (e: Event) => {
      if ((e as CustomEvent).detail === thread)
        void refresh(thread).catch((e) => setError(e.message));
    };
    window.addEventListener(COPILOT_CHANGED, h);
    return () => window.removeEventListener(COPILOT_CHANGED, h);
  }, [thread, refresh]);
  const perform = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      if (thread) await refresh(thread);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };
  // "Ask Co-Pilot" on a Deal Checker row: open the chat and send once the thread is ready.
  const [pendingAsk, setPendingAsk] = useState<string>();
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<CopilotAsk>).detail;
      if (d?.dealId !== deal.id) return;
      setOpen(true);
      setPendingAsk(d.text);
    };
    window.addEventListener(COPILOT_ASK, h);
    return () => window.removeEventListener(COPILOT_ASK, h);
  }, [deal.id]);
  useEffect(() => {
    if (!pendingAsk || !thread || busy) return;
    const value = pendingAsk;
    setPendingAsk(undefined);
    setText(value);
    setTimeout(() => document.getElementById(`copilot-chat-${deal.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    void perform(async () => {
      await callCopilot(thread, "chat", value, getLiveChecks(deal.id));
      setText("");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAsk, thread, busy]);
  /** The header chat box: opens the panel and sends, queueing until the thread exists. */
  const send = (raw: string) => {
    const message = raw.trim();
    if (!message || busy) return;
    setOpen(true);
    setText("");
    if (!thread) {
      setPendingAsk(message);
      return;
    }
    void perform(async () => {
      await callCopilot(thread, "chat", message, getLiveChecks(deal.id));
    });
  };
  const decide = (id: string, approve: boolean) =>
    perform(async () => {
      if (approve && hasUnsavedTerms)
        throw new Error("Save or discard unsaved term-sheet edits first.");
      const { error } = await supabase.rpc("copilot_decide", {
        _change: id,
        _approve: approve,
      });
      if (error) throw error;
      if (approve) window.dispatchEvent(new Event("vdr:copilot-approved"));
      toast.success(
        approve ? "Correction approved and saved" : "Correction rejected",
      );
      if (thread) {
        changed(thread);
        await processCopilot(thread);
      }
    });
  const review = (d: DealDocument) =>
    perform(async () => {
      if (!thread) return;
      const { data, error } = await supabase.storage
        .from("deal-documents")
        .download(d.path);
      if (error || !data) throw error ?? new Error("Document unavailable");
      await reviewSavedDocument(
        thread,
        d.id,
        new File([data], d.name, { type: d.mime ?? data.type }),
      );
    });
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="space-y-3 rounded-md border border-border p-3"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 shrink-0 gap-2 px-2 text-sm hover:bg-transparent"
          >
            <Bot className="h-4 w-4 shrink-0 text-primary" />
            <span className="font-semibold">Deal Co-Pilot</span>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    role="img"
                    tabIndex={0}
                    aria-label="About Deal Co-Pilot"
                    className="inline-flex text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                  >
                    <Info className="h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-[360px] whitespace-normal break-words space-y-2 text-left text-xs font-normal leading-relaxed">
                  <p>
                    <strong>Deal Co-Pilot</strong> reviews this deal's saved term
                    sheet and uploaded documents, answers questions, and proposes
                    evidenced corrections. Only people with term-edit rights can
                    approve changes, and nothing is sent externally.
                  </p>
                  <p>
                    The <strong>Deal Checker</strong> lights sit inside this panel.
                    Click <strong>Ask Co-Pilot</strong> on any warning or fail for
                    an explanation and an evidenced fix to approve.
                  </p>
                  <p>It works with four specialists. Ask by name in the chat:</p>
                  <ul className="list-disc space-y-1 pl-4">
                    <li><strong>Compliance &amp; Regulatory</strong>: "Run a compliance review"</li>
                    <li><strong>Pricing &amp; Benchmark</strong>: "Check the pricing and settlement date"</li>
                    <li><strong>ESG &amp; Sustainable Finance</strong>: "Review the ESG disclosures"</li>
                    <li><strong>Syndicate Communications</strong>: "Draft the investor bulletin" (drafts are never sent)</li>
                  </ul>
                  <p>
                    Say "Run the full specialist panel" to get all four at once.
                    They also run automatically when you save terms or upload a
                    document.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="ml-1 flex items-center gap-1 text-[11px] font-normal" aria-label="Deal Checker results" title="Live Deal Checker results (ignored warnings excluded)">
              <span className="rounded bg-success/15 px-1.5 text-success">{lights.pass}</span>
              <span className="rounded bg-warning/15 px-1.5 text-warning">{lights.warn}</span>
              <span className="rounded bg-destructive/15 px-1.5 text-destructive">{lights.fail}</span>
            </span>
          </Button>
        </CollapsibleTrigger>
        <form
          id={`copilot-chat-${deal.id}`}
          className="flex min-w-[12rem] flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <Textarea
            aria-label="Message Deal Co-Pilot"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={12000}
            rows={1}
            placeholder="Ask about this deal…"
            className="h-9 max-h-28 min-h-0 flex-1 resize-none py-2 text-sm"
          />
          <Button
            type="submit"
            size="sm"
            className="h-9 shrink-0"
            disabled={busy || !text.trim()}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send
          </Button>
        </form>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 shrink-0 gap-2 px-2 text-xs font-normal text-muted-foreground"
          >
            {open ? "Hide chat & reviews" : "Chat, corrections & reviews"}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </Button>
        </CollapsibleTrigger>
      </div>
      {checker}
      <CollapsibleContent className="space-y-5 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Saved terms · Human approval</Badge>
          <AiModelPicker />
          <Button
            variant="outline"
            size="sm"
            disabled={!thread || busy}
            onClick={() =>
              perform(async () => {
                if (thread) {
                  await callCopilot(thread, "resume");
                  await processCopilot(thread);
                }
              })
            }
          >
            <RefreshCw className="mr-2 h-3 w-3" />
            Resume reviews
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Refresh Co-Pilot"
            disabled={!thread || busy}
            onClick={() =>
              perform(async () => {
                if (thread) await refresh(thread);
              })
            }
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
        {error && (
          <p
            role="alert"
            className="border-l-2 border-destructive pl-3 text-sm text-destructive whitespace-pre-wrap"
          >
            {error}
          </p>
        )}
        <div className="grid min-w-0 gap-6 xl:grid-cols-2">
          <section className="min-w-0 space-y-3">
            <h4 className="text-sm font-semibold">Conversation</h4>
            <div
              className="max-h-[480px] min-h-24 overflow-y-auto space-y-4"
              aria-label="Co-Pilot conversation"
            >
              {!messages.length && (
                <p className="text-sm text-muted-foreground">
                  No messages yet.
                </p>
              )}
              {messages.map((m) => (
                <div key={m.id} className="border-l-2 border-border pl-3">
                  <span className="text-xs font-semibold text-primary">
                    {m.role === "user" ? "Deal member" : "Deal Co-Pilot"}
                  </span>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                    {m.body}
                  </p>
                </div>
              ))}
            </div>
          </section>
          <section className="min-w-0 space-y-3">
            <h4 className="text-sm font-semibold">Proposed corrections</h4>
            {!changes.length && (
              <p className="text-sm text-muted-foreground">
                No corrections proposed.
              </p>
            )}
            {changes.map((c) => (
              <div key={c.id} className="border-b border-border pb-3 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <strong className="text-sm">{c.field}</strong>
                  <Badge variant="outline">{c.status}</Badge>
                </div>
                <p className="text-sm break-words">
                  {c.before_value || "Empty"} → <strong>{c.after_value}</strong>
                </p>
                <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                  {c.reason}
                </p>
                {c.status === "pending" && editor && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busy || hasUnsavedTerms}
                      title={
                        hasUnsavedTerms
                          ? "Save or discard unsaved edits first"
                          : "Approve correction"
                      }
                      onClick={() => decide(c.id, true)}
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => decide(c.id, false)}
                    >
                      <X className="mr-1 h-3 w-3" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </section>
        </div>
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold">
              Document diffs & automatic reviews
            </h4>
            <Button
              size="sm"
              variant="outline"
              disabled={!thread || busy}
              onClick={() => input.current?.click()}
            >
              <Upload className="mr-2 h-3 w-3" />
              Upload document
            </Button>
            <input
              ref={input}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.txt,.md,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void perform(() => uploadDealDocument(deal.id, f));
              }}
            />
          </div>
          {docs.map((d) => (
            <div
              key={d.id}
              className="flex flex-wrap items-center gap-2 text-sm"
            >
              <Button
                variant="link"
                className="h-auto min-w-0 max-w-full p-0 text-left whitespace-normal break-all"
                onClick={() => openDealDocument(d.path)}
              >
                {d.name}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!thread || busy}
                onClick={() => review(d)}
              >
                <FileSearch className="mr-1 h-3 w-3" />
                Review
              </Button>
            </div>
          ))}
          {!runs.length && (
            <p className="text-sm text-muted-foreground">No reviews yet.</p>
          )}
          {runs.map((r) => (
            <div key={r.id} className="border-b border-border py-3 space-y-2">
              <div className="flex flex-wrap gap-2 items-center">
                <strong className="text-sm">
                  {r.kind === "document"
                    ? "Document comparison"
                    : "Automatic syndicate review"}
                </strong>
                <Badge variant="outline">{r.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.completed_at ?? r.created_at).toLocaleString()}
                </span>
              </div>
              {r.error && <p className="text-sm text-destructive">{r.error}</p>}
              {r.report && (
                <>
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {r.report.summary}
                  </p>
                  {r.report.dealChecker && (
                    <p className="text-xs text-muted-foreground">
                      Deal Checker at review: {r.report.dealChecker.tally.pass} pass · {r.report.dealChecker.tally.warn} warning · {r.report.dealChecker.tally.fail} fail
                    </p>
                  )}
                  {r.report.checkerFindings && r.report.checkerFindings.length > 0 && (
                    <div className="space-y-1 text-xs">
                      <p className="font-medium">
                        Checker findings: {r.report.checkerFindings.filter(f => f.resolution === "proposed").length} fixes proposed, {r.report.checkerFindings.filter(f => f.resolution === "needs_input").length} need human input
                      </p>
                      <ul className="space-y-0.5">
                        {r.report.checkerFindings.map((f, i) => (
                          <li key={i} className="break-words">
                            <span className={f.level === "fail" ? "text-destructive" : "text-warning"}>{f.level === "fail" ? "Fail" : "Warning"}</span>{" "}
                            {f.check} — {f.resolution === "proposed" ? <span className="text-primary">correction proposed for {f.field} (awaiting approval)</span> : <span className="text-muted-foreground">{f.note}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Compared{" "}
                    {r.report.comparison?.comparedAt
                      ? new Date(
                          r.report.comparison.comparedAt,
                        ).toLocaleString()
                      : "at completion"}
                  </p>
                  {r.report.differences?.map((d, i) => (
                    <div
                      key={i}
                      className="border-l-2 border-primary pl-3 text-sm break-words"
                    >
                      <strong>{d.field}</strong>: {d.before || "Empty"} →{" "}
                      {d.after}
                      <blockquote className="mt-1 text-xs text-muted-foreground">
                        “{d.quote}”
                      </blockquote>
                    </div>
                  ))}
                  {r.report.versionDifferences?.map((d, i) => (
                    <p key={i} className="text-xs break-words">
                      Previous document: {d.field} {d.before} → {d.after}
                    </p>
                  ))}
                  {r.report.risks?.map((risk, i) => (
                    <p key={i} className="text-sm break-words">
                      {risk.message}{" "}
                      <span className="text-muted-foreground">
                        “{risk.quote}”
                      </span>
                    </p>
                  ))}
                  {r.report.warnings?.map((w, i) => (
                    <p
                      key={i}
                      className="text-xs text-muted-foreground break-words"
                    >
                      {w}
                    </p>
                  ))}
                  {r.report.deterministic?.map((d, i) => (
                    <p key={i} className="text-xs">
                      Deterministic · {d.field}: {d.message}
                    </p>
                  ))}
                  {!!r.report.specialists?.length && (
                    <SpecialistReports reports={r.report.specialists} />
                  )}
                </>
              )}
            </div>
          ))}
        </section>
      </CollapsibleContent>
    </Collapsible>
  );
}
