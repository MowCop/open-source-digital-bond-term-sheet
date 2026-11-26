import { ReactNode, useEffect, useRef, useState } from "react";
import { Radar } from "lucide-react";

/** Radar icon that opens the Co-Pilot text box. The panel stays mounted while
 *  closed so drafts and portalled Co-Pilots keep their state. */
export default function CopilotLauncher({ focus, children, align = "left" }: { focus?: string; children: ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Deal Co-Pilot${focus ? `, focus ${focus}` : ""}`}
        className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent/50"
      >
        <Radar className={`h-5 w-5 shrink-0 text-primary ${open ? "" : "animate-pulse"}`} />
        <span className="font-semibold">Co-Pilot</span>
        {focus && <span className="truncate text-xs text-muted-foreground">Focus: {focus}</span>}
      </button>
      <div
        hidden={!open}
        className={`absolute top-full z-50 mt-2 w-[min(48rem,90vw)] rounded-lg border border-border bg-card p-3 shadow-lg ${align === "right" ? "right-0" : "left-0"}`}
      >
        {children}
      </div>
    </div>
  );
}
