import { ReactNode, useEffect, useRef, useState } from "react";
import { Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COPILOT_ASK, type CopilotAsk } from "@/lib/copilot/liveChecks";
import { getCopilotFocus } from "@/lib/copilot/focus";

/** Radar icon that opens the Co-Pilot text box. The panel stays mounted while
 *  closed so drafts and portalled Co-Pilots keep their state. */
export default function CopilotLauncher({ focus, children, align = "left" }: { focus?: string; children: ReactNode; align?: "left" | "right" | "center" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ask = (event: Event) => {
      if ((event as CustomEvent<CopilotAsk>).detail?.dealId === getCopilotFocus()?.dealId) setOpen(true);
    };
    window.addEventListener(COPILOT_ASK, ask);
    return () => window.removeEventListener(COPILOT_ASK, ask);
  }, []);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Element;
      if (ref.current?.contains(t) || t.closest?.('[role="dialog"]')) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  return (
    <div ref={ref} className="relative min-w-0">
      <Button
        variant="ghost"
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Deal Co-Pilot${focus ? `, focus ${focus}` : ""}`}
        title={`Co-Pilot${focus ? ` — Focus: ${focus}` : ""}`}
        className="flex h-auto w-full min-w-0 items-center gap-2 px-2 py-1 text-sm"
      >
        <Radar className={`h-5 w-5 shrink-0 text-primary ${open ? "" : "animate-pulse"}`} />
        <span className="hidden sm:inline font-semibold">Co-Pilot</span>
        {focus && <span className="truncate text-xs text-muted-foreground">Focus: {focus}</span>}
      </Button>
      <div
        hidden={!open}
        className={`absolute top-full z-50 mt-2 max-h-[calc(100dvh-4rem)] overflow-y-auto w-[min(48rem,90vw)] md:w-[min(48rem,calc(100vw-17rem))] rounded-lg border border-border bg-card p-3 shadow-lg ${align === "center" ? "left-1/2 -translate-x-1/2" : align === "right" ? "right-0" : "left-0"}`}
      >
        {children}
      </div>
    </div>
  );
}
