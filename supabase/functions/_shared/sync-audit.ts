// Shared helper to record sync events into public.sync_audit_log.
// Use from any edge function that ingests data from an external source.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type SyncEventType = "sync_started" | "sync_succeeded" | "sync_failed";
export type SyncStatus = "success" | "error";

export interface SyncEvent {
  source: string;                 // e.g. "github"
  repo?: string | null;           // e.g. "open-source-digital-bond-term-sheet"
  eventType: SyncEventType;
  status: SyncStatus;
  recordsProcessed?: number | null;
  errorMessage?: string | null;
  details?: Record<string, unknown> | null;
  triggeredBy?: string | null;    // auth uid, if manual
}

export function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function logSyncEvent(
  admin: SupabaseClient,
  event: SyncEvent,
): Promise<void> {
  const { error } = await admin.from("sync_audit_log").insert({
    source: event.source,
    repo: event.repo ?? null,
    event_type: event.eventType,
    status: event.status,
    records_processed: event.recordsProcessed ?? null,
    error_message: event.errorMessage ?? null,
    details: event.details ?? null,
    triggered_by: event.triggeredBy ?? null,
  });
  if (error) console.error("logSyncEvent failed:", error.message);
}