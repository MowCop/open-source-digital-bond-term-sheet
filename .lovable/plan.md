# Email new-issue alerts — plan

## What exists today (checked)
- `src/lib/bulletinDraft.ts`: finds/builds a single "deal_data" bulletin as a `messages` row (draft or sent), recipients always empty. No stage, no snapshot link, no diff.
- `src/lib/bulletin.ts`: only reads deal documents for the AI bulletin generator.
- `generate-bulletin-from-deal` function: AI writes prose + term table from saved deal data; legal notices appended outside AI (`format.ts`). It is run once on request, never re-rendered when terms change.
- `deal_term_sheet_releases`: versioned saved BDT snapshots per stage (snapshot, XML, diff summary) — the natural "snapshot used" for each send.
- `src/lib/termsheet/bdt-xml.js` `buildXML(state)` produces BDT 2.0 XML.
- `audit_log` table + `addAuditEntry` in the app.
- Email: Lovable Emails is set up (sender `notify.eurobondmarkets.com`) for sign-up/approval/support mails. No vendor emailing exists. Connector rows (`src/lib/vendors.ts`) have no email field; overrides live in the browser.

## Delivery method (decision needed)
Lovable's built-in app emails only allow one recipient per triggered event, forbid sending one template to a list, and do not support attachments. New-issue alerts go to many vendor desks with an XML attachment, so they don't fit. Proposal: **Resend** (connector, key held as a backend secret only), sending one email per recipient from a verified Resend domain (e.g. `alerts.eurobondmarkets.com` — must be a different subdomain from `notify.` to avoid DNS conflict). XML attached directly. Fallback if you'd rather not add Resend: Lovable Emails with a signed download link to the XML instead of an attachment, one send per vendor — confirm this is acceptable for vendor desks.

## 1. Bond Console — distribution addresses
- New "New-issues email distribution" block in Edit entry: list of addresses, add/remove, format validation, hint "Use desk or distribution-list addresses, not individuals." Empty by default.
- Row shows a small mail icon with the address count.
- Stored in the backend per organisation (not the browser): table `vendor_distribution`.
- New "Recipients" tab/section: every vendor with ≥1 address, enable/disable toggle, last-sent date.

## 2. Live bulletin
- Bulletin split into three parts:
  - `intro` / `notes`: user free text, stored separately, never regenerated.
  - `terms block`: rendered deterministically (no AI) from the latest **saved** BDT state via `src/lib/termSheetView.ts`.
  - `legal notices`: appended outside AI as today.
- Re-render the terms block whenever the term sheet is saved or the stage changes (subscribe to deal `updated_at`/stage). Because notes are separate fields, re-render cannot overwrite them. The existing AI generator stays an optional "Draft intro with AI" button that only fills `intro` if empty or on explicit request.
- "Terms changed since last send" banner with field-level diff (field, before, after) between the current saved snapshot and the snapshot of the last successful send.

## 3. Sending
- "Send update" button on the deal, with event picker: Mandate, Announced/IPT, Guidance, Books update, Launch, Pricing, Final terms (defaults to current stage).
- Subject builder: `ISSUER – CCY SIZE TENOR – <event text>` e.g. "ACME – EUR 500m 5Y – IPTs T+200bp area"; editable.
- Preview dialog: subject, body, recipient list (enabled vendors + optional BCC to bank syndicate mailbox), attachment name; "Approve and send" requires a ticked confirmation. No automatic sends anywhere.
- Before sending, a release snapshot is taken (or the latest unchanged one reused); its id is sent to the backend, which re-reads saved terms itself and rejects if they changed since preview.
- Send log per deal shown in the deal's history/audit panel, with per-recipient status and "Retry" for failed ones (retries reuse the same snapshot; idempotency key per send+recipient).

## 4. Later channels
"Send update" calls a channel list; email is the only channel now. Bloomberg MSG, DirectBooks, Symphony etc. will be extra channels using the same snapshot, approval and log, keyed by `channel` on each recipient row.

## 5. Docs
- `reference/dts-external-distribution-connectors.md` §7: add distribution address storage, approval, logging and channel rules.
- `AGENTS.md`: one rule for alerts (saved snapshot only, human-approved, per-org addresses in backend, channel-extensible log).

## Technical details

Tables (all with GRANTs + RLS; org = `current_user_org()`):
```text
vendor_distribution(id, org, vendor_id, addresses text[], enabled bool, updated_by, updated_at)
  unique(org, vendor_id); read: approved org members; write: admins of that org
deal_bulletin_notes(deal_id, org, intro, notes, updated_by, updated_at)
alert_sends(id, deal_id, org, event, subject, body_html, release_id -> deal_term_sheet_releases,
  bdt_hash, sender_id, bcc, approved_at, created_at)
alert_send_recipients(id, send_id, vendor_id, address, channel 'email', status
  queued|sent|failed, provider_message_id, error, attempts, updated_at)
```
Logs are insert-only from the function (service role); users read via `can_access_deal`. Each send also writes `audit_log` (`alert_sent`, `alert_retry`).

Functions:
- `send-deal-alert` (new): validates admin + deal access, loads release snapshot, checks hash vs current saved terms, builds XML with `buildXML` (vendored copy in `_shared`), loads enabled recipients server-side (browser never supplies addresses except optional BCC, which is validated), sends one email per recipient, writes log rows.
- `retry-deal-alert` (or `action: retry` on same function): only for failed rows, same snapshot.

Frontend files:
- `src/lib/vendors.ts` (type only), `src/lib/distribution.ts` (validation, load/save), `src/components/VendorEditDialog`/ConnectivityEditor area for the address field, `src/pages/BondConsolePage.tsx` (row icon, Recipients view).
- `src/lib/liveBulletin.ts` (render terms block, diff, subject builder), `src/components/SendUpdateDialog.tsx`, `src/components/AlertSendLog.tsx`, wiring in `src/pages/DealsPage.tsx` and `GenerateBulletinDialog`.

Tests (`src/test/`):
- `distribution.test.ts`: valid/invalid emails, duplicates, empty default.
- `liveBulletin.test.ts`: changing a saved term changes the rendered block while intro/notes stay identical; diff lists the changed field.
- `alertSend.test.ts`: send helper refuses without approval flag; payload carries release id/hash; disabled vendors and vendors without addresses excluded from recipients.

Open questions: Resend vs Lovable-Emails-with-link; the sender domain to use; and whether the BCC syndicate mailbox is one per organisation (stored in settings) or typed per send.
