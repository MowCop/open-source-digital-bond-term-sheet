# Co-Pilot amount-unit verification

## Rule
350m means 350 million everywhere. A bare 350 must not be silently treated as 350 million. Missing units and stale original values require clarification, not a server crash. A preview never changes a deal; execution requires human approval.

## Checked paths
| User-facing flow | Code read | Outcome |
| --- | --- | --- |
| DTS inline and expanded Co-Pilot; Board update Co-Pilot | DealCopilot, CopilotDraftDialog, CopilotFocusHost, copilot/client | Same command service and shared draft. No independent amount scaling. DTS signed-in clarification verified. Board mounting checked in code, not separately exercised. |
| Direct from/to and target-only commands | _shared/copilot-commands, deal-copilot/index | Before-value mismatch returns a normal clarification. Explicit units normalize; ambiguous small bare targets against million-sized saved amounts are withheld. Both mismatch and missing-target-unit replies verified HTTP 200 without a new preview. |
| AI-planned grouped commands and Send Update drafts | deal-copilot/agent, prepareUpdates in index, prepareCommand | Same amount guards; validation results are returned to the agent for clarification. Drafts remain human-approved; legal notices and historical publications are not rewritten. Read and pure planner tested, not separately exercised through an AI turn in this sweep. |
| Individual corrections, portable client and server | copilot/deal, deal-copilot/domain/deal, copilot/host | Fixed: explicit size units normalize to raw before/after numbers; omitted units are not inferred; stale original values stay blocked. Client and server regression tests pass. |
| Uploaded-document reviews and saved-term automatic reviews | client process/onCopilotDocumentSaved/onCopilotTermsSaved, index review jobs, domain/documents and domain/syndicate, client documents/syndicate mirrors, evidence filters | Fixed: extracted size units normalize; an extracted 350 paired with a quote saying 350 million is withheld with a warning, not turned into a correction. Shared document-report guard also covers specialist terms merged into syndicate reports. Source/evidence tests pass; background jobs not separately triggered in this sweep. |
| Live database context/propose/complete/decide/execute/cache | Live definitions of copilot_context, copilot_propose, copilot_complete, copilot_decide, copilot_execute_command, copilot_amount_cache | Current values remain raw numbers. Proposal/decision stale-value checks and execution's full terms/workspace/notes snapshot checks remain intact. No live function or permission changes. Isolated database tests pass; no live approval executed in this sweep. |
| Manual tranche panels and Deal structure | TranchePanel, DealTermSheets, dealWorkspace | Numeric entry stores base currency units; structure parser respects explicit m/b suffixes. Planning USD equivalence remains separate. Read, unchanged. |
| Intake and derived outputs | documentIntake, bdt-bridge parseAmount/formatAmount, trancheState, newIssueAlerts dealTermsText | Explicit suffixes parse into base units; selected-tranche overlays preserve recorded values; bulletins format saved numbers with units. Read, unchanged. No alert was sent. |
| General Co-Pilot | CopilotGeneral, copilot-general | Help/navigation/reminders, not a deal-term command executor. Read, unchanged. |

## Verification
- 65 tests passed across commands, client/server corrections, source reviews, evidence, portable host and isolated database approvals.
- Signed-in DTS: original-value mismatch and missing target units returned normal HTTP 200 clarification replies without Execute or sending.
- Window dragging, resizing and Esc draft preservation verified during the same signed-in checks.
- Settled records, sent emails, historical publications, permissions, settings and demo data were left unchanged.