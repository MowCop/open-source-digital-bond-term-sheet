# Deal Co-Pilot transfer boundary

## Current standalone scope

One coordinating AI agent uses specialist tools for saved deal context, deterministic validation, source review, document reports and proposed field corrections. A separate document-review call automatically runs on upload; it extracts cited terms and creates reviewable differences. These are bounded capabilities, not independently orchestrated sub-agents. The current project has no live VDR access, registry integration, market pricing, calendar or legal-compliance verification.

## Document ingestion

Private PDF, DOCX, TXT, MD and CSV originals are retained per conversation. Upload triggers one streamed review; there is no unattended folder watcher or recurring scheduler. Durable jobs use checksum deduplication, a database lease, and atomic completion with proposals. Interrupted jobs require explicit resumption; AI access denials pause processing without retries. PDF extraction requires readable text on every page; scanned PDFs require external OCR. Word coverage is text only, not comments, images or tracked-revision interpretation. The Document Diff Agent compares evidenced terms against the latest saved term sheet at completion and the previous completed upload. Atomic completion locks the owner's term sheet, derives final differences from live values, and records the compared revision and time. Each completed report is a dated comparison, not a continuous watcher. Older reports remain labelled as upload-snapshot comparisons. Final edits still use the existing stale-value-checked approval function. In this standalone project, the term sheet is the conversation's saved deal context, not an external VDR term sheet.

Each private conversation has a stable `/chat/$threadId` URL, saved deal terms and full AI SDK UI-message history. Assistant messages have server-generated unique IDs. Corrections remain proposals until an owner approves them through the atomic database function; stale original values are rejected.

## Future VDR adaptation

## Autonomous syndicate review

Saved term changes enqueue a durable owner-scoped review; the save event streams one review automatically. Completed document uploads enqueue a review using the latest completed document's existing text and extracted terms, without re-reading the PDF binary. There is no scheduled watcher, unattended polling or per-document fan-out. Jobs are deduplicated by saved deal content (and document ID for uploads), single-flight per conversation, and atomically save risk reports and evidence-only pending corrections. Superseded terms cannot create stale fixes; existing matching pending corrections are not duplicated. Provider credit/access blocks persist globally and stop automatic calls. Interrupted queued work can be resumed explicitly in the review pane; failed or paused jobs are not automatically retried. These reviews run in the current standalone workspace, not VDR. Applying any proposed deal change still requires the existing human-approval boundary.

Verification: saved USD terms against EUR source text automatically returned a cited risk and pending EUR correction; USD remained saved until approval. Reload restored the report and proposal. Approval persisted EUR and triggered a follow-up review with no duplicate correction. A real revised PDF triggered document extraction and then syndicate review, which flagged conflicting 4.25%/5.00% coupon evidence while saved terms remained 4.25%. Screenshots were visually checked and no runtime errors occurred. Fourteen domain tests, targeted lint and preview build passed.

## VDR integration boundary

The agent reaches deal data through the `DealHost` contract (`src/lib/copilot/host.ts`): readDeal, listDocuments, proposeChange, decideChange. This workspace implements it in `host.cloud.server.ts`; the VDR fills in `docs/host.vdr.template.md`. The chat agent already uses the host; the document and syndicate review jobs still use this workspace's lease/complete database functions and move as-is (recreate those tables and functions in VDR, re-pointed at VDR deals). Host-independence is tested against an in-memory host.

### Move checklist (run inside the VDR project)
1. Copy `src/lib/copilot/*`, `src/components/copilot-*.tsx`, the AI Elements components and the `/api/chat`, `/api/documents/review`, `/api/syndicate/review` routes.
2. Recreate migrations 0000–0005 (conversations, messages, changes, documents, syndicate runs, triggers, claim/complete/decide functions), linking conversations to VDR deal IDs and VDR member checks instead of a single owner.
3. Implement the VDR host from the template; approval maps to the VDR role allowed to edit terms.
4. Test: sign-in, chat review, PDF upload diff, automatic review on save, approve/reject with stale-value rejection, and that a non-member sees nothing.

### Agent structure today and next
One coordinating agent with specialist tools, plus two automatic review jobs (document diff, syndicate review). Candidate independent specialists, not yet built: Compliance & Regulatory, Pricing & Benchmark, ESG, Syndicate Communications. Each must have agreed inputs, read-only tools and cited-evidence output; none gets approval authority. No changes to the VDR project were made from here.

## Verification

Live AI calls exercised deal/source reading, deterministic checks, proposed corrections, approval and persisted context. Two conversations restored independent histories; a two-turn memory test restored both assistant answers. Foreign conversations were hidden and stale approvals rejected. Desktop and phone screens rendered without runtime errors or horizontal overflow. Five unit/routing tests passed, the preview build passed, and the changed application files passed targeted lint.

Google and Lovable sign-in are enabled, but their external provider round-trips and email delivery were not exercised. The full-project lint command also reports formatting and a `prefer-const` issue in integration-generated files, which are intentionally not edited.

Document phase verification: real PDF and Word uploads returned live AI reviews; a USD-to-EUR correction was approved and read back after reload. A revised coupon was compared to both saved deal context and the prior PDF. Duplicate upload retained one document row, completed jobs could not be reclaimed, two completed reports persisted, and a second account could neither read the document rows nor download their originals. Ten unit/routing tests passed. Document screens were checked on desktop and phone without runtime errors or horizontal overflow; the long-review dialog is top-anchored to keep its heading reachable.

Live term-sheet verification: uploaded a real PDF while the saved currency was USD, changed the term sheet to GBP after document registration, and confirmed the completed review proposed GBP → EUR with its verbatim Page 1 quote and comparison timestamps. Approved the correction and read back EUR through the UI after reload. Report and approval screenshots were visually inspected with no overlap or clipping, and no browser runtime errors occurred. Eleven domain tests passed; targeted lint and the preview build passed.