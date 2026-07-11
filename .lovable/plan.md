## Sync Audit Log

Record each GitHub-related sync event (successes and errors) so admins can see when data last came in and why any attempt failed.

### 1. New table `public.sync_audit_log`
Columns (domain-specific):
- `source` — text, e.g. `'github'` (future-proofed for other sources)
- `repo` — text, nullable (e.g. `NewIssueVault`)
- `event_type` — text: `sync_started`, `sync_succeeded`, `sync_failed`
- `status` — text: `success` | `error`
- `records_processed` — int, nullable
- `error_message` — text, nullable
- `details` — jsonb, nullable (files touched, commit sha, duration_ms, etc.)
- `triggered_by` — uuid, nullable (auth user who initiated, if manual)

Plus standard `id`, `created_at`.

### 2. RLS + grants
- `GRANT SELECT ON public.sync_audit_log TO authenticated` (admins read via UI)
- `GRANT ALL ON public.sync_audit_log TO service_role` (edge functions write)
- Enable RLS
- Policy: only admins (`public.is_admin(auth.uid())`) can `SELECT`
- No client `INSERT` policy — writes go through service role from edge functions

### 3. Helper for edge functions
Small shared helper `supabase/functions/_shared/sync-audit.ts` exposing `logSyncEvent(admin, { source, repo, eventType, status, ... })` so any current or future sync function writes consistently.

### 4. Admin UI page: `/sync-log`
- New route in `App.tsx` (guarded, admin only, same pattern as `/audit-log`)
- New `src/pages/SyncAuditLogPage.tsx` — table of recent events with columns Timestamp, Source, Repo, Event, Status, Records, Error, Details. Filter by source and status; text search on error/details.
- Add nav link in `AppLayout` next to Audit Log for admins.

### 5. Wiring
No sync jobs exist yet. This plan only creates the log surface + shared helper. Any future GitHub import edge function will call `logSyncEvent` at start, on success, and in its catch block — no wiring changes elsewhere in this task.

### Out of scope
- Building the actual GitHub → panel data import (separate feature).
- Backfilling historical events (none exist).
- Alerting/email on failures.
