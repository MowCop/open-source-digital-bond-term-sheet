# Bring Deal Co-Pilot into Virtual Deal Room

## Source and scope
Use the Deal Co-Pilot workspace found in **Your AI Agent Creator**, following its `COPILOT_TRANSFER.md` and `docs/host.vdr.template.md`.

Bring in its coordinating agent, document-diff reviews, automatic syndicate reviews, saved conversations, reports and proposed corrections. Do not add the specialist agents listed as future work in the source guide.

## User experience
- Add Deal Co-Pilot to each accessible deal, with saved conversation history, document comparisons, review results and pending corrections.
- Deal members can ask questions, review documents and propose changes.
- Saving terms starts one automatic review; completing a document review starts the corresponding automatic review. Uploads retain their originals and compare against saved terms and the previous completed document.
- Only people with VDR term-edit rights can approve changes. Approval requires an explicit human action; agents never approve or silently change terms.
- Show interrupted, paused and failed reviews honestly, with explicit resumption where supported. Retain comparison dates so older reports are not mistaken for current checks.

## Technical implementation
- Reuse the source agent/domain logic and review semantics. Adapt its server routes and AI Elements UI to VDR's React/Vite app and authenticated Cloud functions rather than importing its different application framework.
- Implement `DealHost` against the current saved authoritative `deals.bdt_state`; preserve the protected `src/lib/termsheet/` core and derive compatibility columns through the existing bridge.
- Recreate the persistence and job functions from source migrations 0000–0005, adapted to VDR deal IDs and server-enforced deal access instead of owner-only access. Include explicit grants, RLS, private document access, leases, checksum deduplication and atomic completion.
- Enforce term-edit authority on the server. Lock and compare the live original field value before approval; reject stale or already-decided corrections. Record approval and rejection in VDR's audit trail.
- Connect document review to VDR's private document repository and term-save events to durable review jobs. Preserve single-flight processing, superseded-result protection, evidence-only proposals and provider-block handling.
- Keep existing Deal Checker and on-demand Deep Audit intact. Update the living checker capability reference where the new review capabilities affect it.

## Saved data boundary
Recreate saved-data storage in VDR, linked to VDR deals. The source snapshot contains code, not live saved conversations or document records. If existing source records must also be imported, export them from the source project's chat and upload the export here, with the corresponding VDR deal mapping; this cannot be fetched from the snapshot.

## Verification
- Run the copied domain tests and new tests for deal access, term-editor-only decisions, stale approvals, deduplication and superseded jobs; retain the VDR core verification checks.
- Exercise the signed-in flow end to end: open a deal, chat, upload a real revised PDF, read its persisted diff, save terms and receive an automatic review, approve/reject, reload and confirm saved results.
- Verify a non-member cannot read conversations, reports or original documents, and a read-only member cannot approve or mutate terms.
- Check desktop and narrow layouts, preview errors and unchanged Fill/View behaviour.

## Completion
Report exactly what passed and any remaining blocker. Historical source-data import remains separate unless an export is supplied; no claim of complete end-to-end verification without exercising the authenticated flows.