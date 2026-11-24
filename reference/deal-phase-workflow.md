# Phase-based deal workspace — Step 2

## Delivered
Stage-derived Set-up / Execution / Closed views, administrator layout override, actor checklist, deal-team assignment and waiting strip, execution-centred Co-Pilot with prompt starters, compact tranche summaries and full DTS overlay, Live MSG and timeline, preserved formats/parsing/checker/knowledge/citations/approval/audit workflows. Co-Pilot Edit rejects the superseded preview and returns its request to the input for a fresh, stale-checked proposal; it never modifies a stored approval snapshot.

DCM can change structure fields and bookrunners only; assigned legal and counsel edit during set-up and are read-only during execution. Settled terms are read-only. Role labels derive from authenticated roles, not remembered browser choices. The readiness service evaluates the existing deterministic checks for every saved tranche; a locked snapshot and twelve actor sign-offs are checked before the audited IPT transition. Direct lifecycle writes cannot bypass this gate. Sign-offs reopen conservatively after any saved terms, structure or document change.

## Verification
- All regression tests passed, including phase derivation, readiness, actor access and SQL enforcement, and existing propose → approve → atomic save/audit tests.
- Signed-in example deal: typed size command, reviewed before/after preview, approved it, read updated tranche summary and Live MSG immediately, reopened Send update without sending, and confirmed terms after reload. Original example terms and structure restored; verification audit remains in this draft.
- Signed-in example issuer legal: execution inputs disabled, no approval/save buttons; set-up own governing-law status saved as In review and survived reload. Temporary role/team/review changes restored after verification.
- Desktop 1560×1000 and mobile 390×844 checked; no runtime errors or document-width overflow; mobile Message tab renders the blast.
- Readiness success and missing/stale/actor checks covered in isolated database tests. A fully completed twelve-sign-off transition was not exercised through the preview; source-grounded AI suggestions and all starter variants were not individually re-tested. Stage-specific chips are editable prompt starters, not autonomous stage transitions; unsupported or ambiguous requests use existing clarification behaviour.
- No emails or Bloomberg messages sent. Existing delivery configuration and explicit send approval remain unchanged.

## Changed files
### Workspace, roles and saved-state integration
`src/lib/dealPhase.ts`, `src/hooks/useDealTeam.ts`, `src/components/DealPhaseWorkspace.tsx`, `src/components/DealCopilot.tsx`, `src/components/CopilotCommandPreview.tsx`, `src/components/RoleBadge.tsx`, `src/components/AppLayout.tsx`, `src/pages/DealsPage.tsx`, `src/pages/UserManagementPage.tsx`, `src/components/termsheet/TermSheetFill.tsx`, `src/components/termsheet/DealTermSheets.tsx`, `src/components/termsheet/TranchePanel.tsx`, `src/context/AppContext.tsx`, `src/integrations/supabase/cloudData.ts`, `src/integrations/supabase/types.ts`, `src/types/bond.ts`, `src/index.css`.

### Services and tests
`supabase/functions/deal-execution-gate/index.ts`, `supabase/functions/deal-copilot/index.ts`, `supabase/functions/_shared/execution-validator.js`, `scripts/gen-execution-validator.mjs`, `supabase/functions/deal-copilot/knowledge/library.ts`, `src/test/dealPhase.test.ts`, `src/test/dealActors.database.test.ts`.

### Documentation
`README.md`, `roadmap.md`, `reference/deal-checker-capabilities.md`, this file.

### Recorded migrations
- `0009_deal_actor_roles.sql` — additive actor enum values.
- `0010_deal_team_signoffs.sql` — membership/sign-off records, RLS, edit enforcement, audit and invalidation.
- `0011_deal_execution_gate.sql` — team assignment, locked audited transition and server actor context.
- `0012_deal_actor_safety.sql` — all-tranche DCM enforcement, bypass prevention, history access, team directory and role management.
- `0013_dcm_structure_consistency.sql` — BDT currency and bookrunner role consistency.
- Corresponding generated snapshots and journal entries in `drizzle/migrations/meta/`.

Accepting this draft applies its recorded structure changes automatically. This draft's own example rows and verification data never move into the app.

## Maintenance
Regenerate the execution validator with `node scripts/gen-execution-validator.mjs` whenever shared phase/evidence or deterministic checker logic changes. It bundles the existing pure validator, not a parallel rules implementation. Refresh the Co-Pilot library when its checker reference changes. Root AGENTS.md is at its protected size budget; these new structural rules are recorded here rather than shortening existing rules.