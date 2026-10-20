import { supabase } from "@/integrations/supabase/client";
import type { Deal, DealStage } from "@/types/bond";

/** User-requested Co-Pilot reminders. They only go off in the browser while the
 *  VDR is open — no background schedule. The AI drafts; the user confirms. */
export type ReminderDraft = {
  deal_id: string | null;
  label: string;
  trigger_kind: "stage_reached" | "date";
  trigger_stage: string | null;
  due_at: string | null;
};
export type Reminder = ReminderDraft & { id: string; status: "active" | "fired" | "cancelled"; created_at: string; fired_at: string | null };

export const STAGE_ORDER: DealStage[] = ["Mandate", "Announced", "Launched", "Books Open", "Books Closed", "Priced", "Settled"];

/** Pure: is this reminder due now? */
export function isDue(r: Pick<Reminder, "status" | "trigger_kind" | "trigger_stage" | "due_at" | "deal_id">, deals: Pick<Deal, "id" | "stage">[], now: Date): boolean {
  if (r.status !== "active") return false;
  if (r.trigger_kind === "date") {
    if (!r.due_at) return false;
    const t = new Date(r.due_at).getTime();
    return Number.isFinite(t) && t <= now.getTime();
  }
  const deal = deals.find((d) => d.id === r.deal_id);
  const target = STAGE_ORDER.indexOf(r.trigger_stage as DealStage);
  if (!deal || target < 0) return false;
  return STAGE_ORDER.indexOf(deal.stage) >= target;
}

export function validDraft(d: unknown): d is ReminderDraft {
  const r = d as ReminderDraft;
  if (!r || typeof r.label !== "string" || !r.label.trim()) return false;
  if (r.trigger_kind === "date") return !!r.due_at && Number.isFinite(new Date(r.due_at).getTime());
  if (r.trigger_kind === "stage_reached") return !!r.deal_id && STAGE_ORDER.includes(r.trigger_stage as DealStage);
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function listReminders(): Promise<Reminder[]> {
  const { data, error } = await db.from("copilot_reminders").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data as Reminder[];
}
export async function createReminder(d: ReminderDraft) {
  const { error } = await db.from("copilot_reminders").insert({
    deal_id: d.deal_id, label: d.label.slice(0, 300), trigger_kind: d.trigger_kind,
    trigger_stage: d.trigger_kind === "stage_reached" ? d.trigger_stage : null,
    due_at: d.trigger_kind === "date" ? d.due_at : null,
  });
  if (error) throw error;
}
export async function cancelReminder(id: string) {
  const { error } = await db.from("copilot_reminders").update({ status: "cancelled" }).eq("id", id).eq("status", "active");
  if (error) throw error;
}
/** Atomically mark fired; returns true only for the caller that flipped it. */
export async function markFired(id: string): Promise<boolean> {
  const { data, error } = await db.from("copilot_reminders").update({ status: "fired", fired_at: new Date().toISOString() })
    .eq("id", id).eq("status", "active").select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

export const REMINDERS_CHANGED = "copilot:reminders-changed";
export const remindersChanged = () => window.dispatchEvent(new Event(REMINDERS_CHANGED));
