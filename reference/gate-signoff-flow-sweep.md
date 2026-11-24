# Gate and sign-off flow sweep

## Rule
Only assigned actors require reviews. A normal move requires those reviews and no blocking checks; an administrator bypass requires an explicit audited note. Only reviews covering changed data reopen. Settled reviews and already-sent snapshots remain unchanged.

## Entry points read in this sweep
| Entry point | Result |
| --- | --- |
| DealPhaseWorkspace / useDealTeam: desktop and mobile phases, team assignment, waiting strip, checklist, override badge | Reads shared mapping, requires assigned actors, disables normal move for blockers; explicit override. Added saved-event and bulletin subscriptions for review refresh. Override, note requirement, reload, governing-law badge and mobile were browser-verified in the preceding turn. |
| dealPhase / executionReadiness / checklistEvidence | Shared required-role filtering; fixed empty-collection hydration supports incomplete legacy records. Existing evidence rules are unchanged. |
| deal-execution-gate | Reads authenticated roles, saved terms, team/mapping and document count; deterministic checks across all tranches; observations cannot replace server checks; mandatory audit note; locked normal/override RPC. |
| SQL move_deal_to_execution, both signatures; guard_execution_transition | Team-dependent manual review checks; override snapshot audited; direct authenticated stage bypass remains blocked. Service-only compatibility signature uses normal sign-off checks; only the edge gate is an application caller. |
| SQL deal_actor_context / deal_phase_audit / signoff_item_fields / signoff_mapped_values | Team-aware actor context and member-scoped audit display; single mapping including per-tranche values and role-filtered parties. |
| SQL reopen_deal_signoffs / audit_deal_signoff / guard_signoff_identity | Mapped changes only; identity and existing review permissions retained. Added settled-review preservation. |
| Document upload/delete, parsing and Co-Pilot document registration; SQL reopen_document_signoffs | Repository changes reopen only Documents reviewed; parsing only proposes values until saved. Added settled-review preservation. |
| All fields save; tranche panel/structure save; cloudData.updateDealRow / AppContext.updateDeal | Saved BDT/workspace changes reach the same selective trigger; immutable term-sheet release rows are not rewritten. |
| Co-Pilot grouped approval SQL / client / coordinator; saved-term and document background reviews | Human atomic approvals update deals through the selective trigger; background jobs persist reports/proposals, never apply approvals or overrides. Existing approval regression tests included; no fresh AI end-to-end replay in this sweep. |
| SendUpdateDialog Save notes / packNotes / unpackNotes; Co-Pilot bulletin drafts | Found legal notices stored outside BDT. New mapping dependency and bulletin trigger reopen only Notices when the verbatim legal block changes; ordinary Terms/hash changes reopen nothing. Authenticated save and reopened checklist badge verified after reload; local save refresh added. |
| Live MSG / useLiveMessage | Reads saved terms/notes and previous sent snapshots; no sign-off writes. |
| send-deal-alert send/retry | Existing approved snapshot/chunk delivery remains unchanged. Not sent or retried in verification. |
| DemoDealPanel play/reset and AppContext.updateDealStage | Database gate still protects these differently-built stage paths. Existing deals can use normal gate/override and then progress to Priced (database-tested). Demo replay does not await stage persistence; generic stage updates optimistically display before persistence. These pre-existing UI issues are outside the two targeted fixes and were left unchanged pending permission. |
| Standard text / XML / DLT and historical release views | No independent sign-off or gate rules; remain projections of saved/working terms with existing editing permissions. Wiring read in DealsPage/TermSheetFill; formats were not individually exercised again. |

## Verification and limits
- New regression cases cover legal-notice insert/update/delete, commentary/hash no-op and settled reviews across terms/documents/notices, alongside partial teams, override, audit and mapped changes.
- Normal browser success remains unverified: example terms were incomplete and correctly blocked. Normal successful transitions and continuation to Priced are database-tested.
- No settled or sent record was repaired; no role, setting or existing example deal was changed. Temporary verification deals were removed.
- Migration added in this sweep: `0016_signoff_notice_and_closed_coverage.sql`; prior targeted fixes remain in `0014` and `0015`.
- Root AGENTS.md is over its protected budget, so the added structural rule is documented here: signoff_item_fields() supplies all review dependencies, including bulletin legal blocks; triggers preserve settled reviews.