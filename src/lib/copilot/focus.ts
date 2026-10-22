import { useSyncExternalStore } from "react";

/** What the top-bar Co-Pilot is currently focused on. The Digital Term Sheet
 *  mounts its own Co-Pilot for the open deal; board updates set
 *  a focus here so Co-Pilot follows the last item the user clicked. */
export type CopilotFocus = {
  kind: "update";
  dealId: string;
  label: string;
  /** Plain text of the update or recent chat, sent with each question (never stored). */
  context: string;
};

export const FOCUS_CONTEXT_MAX = 20000;

let current: CopilotFocus | null = null;
const listeners = new Set<() => void>();

export function setCopilotFocus(focus: CopilotFocus | null) {
  current = focus ? { ...focus, context: focus.context.slice(0, FOCUS_CONTEXT_MAX) } : null;
  listeners.forEach((l) => l());
}

export function getCopilotFocus() {
  return current;
}

export function useCopilotFocus() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => current,
  );
}

/** The text block the Co-Pilot receives describing the focused item. */
export function focusPrompt(f: Pick<CopilotFocus, "kind" | "label" | "context">) {
  const what = "New Issue Board update";
  return `The user is looking at this ${what}: "${f.label}". Answer with this item as your focus, alongside the deal's term sheet and documents.\n---\n${f.context}\n---`;
}
