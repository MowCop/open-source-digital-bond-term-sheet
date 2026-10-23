# AGENTS
- Bond Console uses src/lib/vendors.ts defaults plus per-user browser overrides for add/edit/remove; built-ins remain immutable so custom management never changes real feed wiring. Public feeds use authenticated public-market-feeds with source dates/partial failures; URL rows open externally, commercial placeholders never imply real feeds.
- Board headings use shortBorrowerName for dash-separated descriptions; stored records stay unchanged.
- Digital Term Sheet View reads the live Fill state through src/lib/termSheetView.ts, not saved flat deal columns; empty authoritative fields remain empty — accepted proposals, edits and deletions must agree across tabs without auto-saving.
- New Deal and Fill share src/lib/documentIntake.ts for cached extraction and proposals; reviewed extra terms seed bdt_state, remaining terms await acceptance — never overwrite user entries.
- New Deal defaults and creation eligibility live in src/lib/newDeal.ts and are shared by the button and creation handler — optional fields must not accidentally block creation or introduce fallback bookrunners.
- Digital Term Sheet Fill fields come from the vendored `FIELDS` dictionary and are selected by path through `src/lib/bdt-bridge.ts`; app stage names are display overrides there (final stage = "Settled"), never dictionary edits — one definition per field.
- TermSheetField suppresses dictionary example placeholders and preserves full-contrast recorded values in disabled history fields — presentation must not imply that examples are recorded terms or that historical values are absent.
- The expanded-deal Deal Checker renders `unifiedChecks` above the term-sheet tabs — one visible validation surface for BDT and VDR rules.
- LEI checks are hybrid: offline MOD 97-10 baseline plus live GLEIF lookups via the gleif-lookup edge function, appended to the same Deal Checker list — typing never waits on the network, outages downgrade to a warning, and name-search suggestions are user-picked, never auto-applied.
- FIGI checks mirror the LEI pattern: offline format/check-digit baseline plus live OpenFIGI lookup via the openfigi-lookup edge function, appended to unifiedChecks with src openfigi; FIGI suggestions are never auto-applied — one ID-check source.
- Pass imperative handles as ingestRef, never React.forwardRef — fiber type changes blank hot reloads.
- Deal AI tools (document extraction, chat extraction, bulletin) route through supabase/functions/_shared/ai-model.ts, which allowlists the selectable models and calls the gateway's native messages endpoint; the browser only sends the chosen model id from src/lib/aiModel.ts — one place for models.
- Deal Checker navigation targets and 'Try to fix' repairs live in src/lib/checkActions.ts; fixes only edit the unsaved Fill state (user still saves) and ignored warnings are stored per deal in the browser — one place for checker actions, nothing auto-saved.
- Files dropped on a deal are stored in the private deal-documents bucket and indexed in public.deal_documents (src/lib/dealDocuments.ts), added to the unsaved term sheet Documentation list on drop (user still saves), and counted by the Deal Checker as attached — one store for deal files.

- reference/deal-checker-capabilities.md is the living summary of Deal Checker checks and sources; any change to checker rules, fixes or sources must update it in the same change.
- The Al Rajhi demo deal (seed, chat replay script, term sheet stage snapshots) is defined only in src/data/alRajhiDemo.ts and driven by src/components/AlRajhiDemoPanel.tsx — one source for the demo flow; replayed messages go through the normal Fill parser, never auto-accepted.
- Al Rajhi board bodies use Word-derived reference HTML while replay parsing uses plain text; legacy generated bodies are projected at display time without database writes or overwriting user edits — preserve original document structure and stage timing.
- Board-to-term-sheet links use src/lib/dtsNavigation.ts to resolve the selected update's deal, stage and publication time; Fill reads saved stage snapshots without modifying lifecycle or terms, and reports missing snapshots rather than inventing history — both board toolbars must share this navigation contract.
- AI Deep Audit (src/lib/deepAudit.ts + audit-deal-fields-ai) is on-demand only, compares Fill fields to stored deal document text, and emits warnings only (src 'ai') appended to unifiedChecks — deterministic checks stay AI-free.
- App MCP (src/lib/mcp/) is read-only, querying as the OAuth caller so RLS decides visibility.

- Board audits use boardUpdateAudit (board_update scope), separate from saved checks.
- Co-Pilot uses src/lib/copilot and the deal-copilot Cloud function; human term editors alone approve, with atomic stale-value checks — AI never approves.
- Co-Pilot General mode (CopilotGeneral, copilot-general) shows when unfocused; AI drafts reminders, users confirm, ReminderWatcher fires them client-side.
- Subdirectories may have their own AGENTS.md (e.g. supabase/functions/deal-copilot/); read it before changing files there.
