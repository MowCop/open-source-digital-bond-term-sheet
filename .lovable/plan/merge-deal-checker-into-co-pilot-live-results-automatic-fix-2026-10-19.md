# Merge Deal Checker into Co-Pilot: live results + automatic fix proposals after save

## Where things stand
- The Deal Checker already renders inside the Co-Pilot panel (top of each deal), and "Ask Co-Pilot" per check goes through normal chat.
- After a term-sheet save, Co-Pilot runs its automatic review and receives the browser's latest checker results — but those results can be the pre-save snapshot, and the review is not told to work through them check by check.

## What changes for the user
1. **One panel, one verdict.** The Co-Pilot panel header shows the checker's pass / warning / fail counts next to the title, so results are visible even when chat is hidden. Detailed checks stay inside the panel as today.
2. **After every save, Co-Pilot works the checker list.** Once the save completes and the checker has recalculated, Co-Pilot automatically reviews each open fail/warning and, where the deal documents or registries give evidence, proposes a correction.
3. **Proposals, never changes.** Each proposed fix appears in the panel as a pending change with its evidence quote and the check it resolves. Only term editors can Approve; the existing stale-value protection still applies. Nothing is saved automatically.
4. **Clear status.** A small line in the panel shows "Reviewing N checker findings…" then "N fixes proposed, M need human input". Ignored warnings are skipped.
5. **Deterministic checks unchanged.** The rule-based checker stays AI-free and remains the measurement; Co-Pilot only adds proposals.

## Technical details
- `src/lib/copilot/liveChecks.ts`: add a "settled" publish — wait for UnifiedDealChecker to publish results for the post-save state (version stamp from the saved Fill state) before `onCopilotTermsSaved` calls `processCopilot`; exclude browser-ignored warnings.
- `src/lib/copilot/client.ts`: `onCopilotTermsSaved` awaits the fresh snapshot (short timeout, falls back to latest with a note).
- `supabase/functions/deal-copilot` (index.ts, agent.ts): saved-terms jobs get a "checker remediation" instruction — iterate non-pass checks, use readLiveChecks/lookupLei/lookupFigi/checkCalendar/document evidence, emit evidenced change proposals linked to the check id; no proposal without evidence. Report JSON keeps v2 shape plus a `checkerFindings` section.
- `DealCopilot.tsx`: header counts badge; proposal cards show the linked check; status line.
- Tests: snapshot-version wait, ignored warnings excluded, proposal requires evidence. Update `reference/deal-checker-capabilities.md`, deal-copilot AGENTS.md and roadmap. `verify.mjs` / `verify-dlt.mjs` must pass; deploy deal-copilot and verify end to end on the walkthrough deal (save → proposals → editor approve).
- No new paid integrations, schedules or distribution. Automatic reviews still run only when a person saves or uploads.
