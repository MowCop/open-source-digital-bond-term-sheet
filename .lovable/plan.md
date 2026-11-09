# New-issue alerts: one email per send, deal-admin sender, provider abstraction

## Answers to your questions

- **Microsoft 365 connector:** Yes. This workspace has a **Microsoft Outlook App User Connector**, where each app user signs in with their own Microsoft account and the app sends as them (delegated `Mail.Send`, `/me/sendMail`). That gives us the "sends as Jane.Saunders@BNPParibas.com" model. The plan therefore uses it for `microsoft_graph`. The standard Outlook connector would send from one shared account, so it is not suitable. Each bank's Microsoft 365 tenant admin must still consent to the app registration. Until that happens, the provider shows "Not connected" and refuses to send.
- **alerts.eurobondmarkets.com:** Resend verifies each sending domain separately. A subdomain counts as its own domain and needs its own DNS records (SPF/DKIM, plus MX for bounce return-path). If `alerts.eurobondmarkets.com` is not already listed as verified in Resend, you'll need to add it there and publish its DNS records. Step 1 checks this. Until it is verified, Resend sends will be refused with a clear message. Sends will not quietly fall back to the old address.

## What changes for the user

1. **One email per send.** To = the deal admin. BCC = every enabled vendor address plus the org's syndicate mailbox. If there are more than 50 total addresses (To + BCC), the send splits into several emails of up to 50 each. The deal admin is in To on every email.
2. **Sender = deal admin.** This is the lead bookrunner's DTS admin on the deal. Their name, email and organisation are recorded on every send.
3. **Org settings (Bond Console → Recipients):**
   - Email provider: Resend / Microsoft 365 / Gmail (coming later).
   - Connection status per provider: Resend "Ready" or "Domain not verified"; Microsoft 365 "Not connected" until the admin connects; Gmail "Not available".
   - Syndicate mailbox: a required org-level BCC address. It replaces the per-send browser BCC field.
4. **Preview dialog shows:** From, Reply-To, To (deal admin), BCC count with an expandable list, and number of emails (chunks). There is also a blocking message when the selected provider can't send. You switch provider in settings, never inside the send.
5. **History:** one row per email (chunk), showing status, recipient list and attempts. Retry re-sends that chunk with the same saved snapshot.

## Provider behaviour

- **resend:**
  - From: `"<Admin name> (<Bank>) via DTS" <newissues@alerts.eurobondmarkets.com>`
  - Reply-To: the admin's email
  - BDT XML attached
- **microsoft_graph:**
  - The deal admin's own token via the Outlook App User Connector, calling `POST /me/sendMail`
  - `toRecipients` = admin, `bccRecipients` = chunk, XML as a `fileAttachment`, `saveToSentItems: true`
  - If the sender is not the connected user, or nobody is connected, the send is refused with "Microsoft 365 is not connected for <admin>. Connect it in Bond Console → Recipients, or choose another provider."
- **gmail:** interface stub that always refuses with "Gmail sending is not available yet."
- **No fallback:** a failed or unconnected provider never retries via another provider.

## Technical details

### Database (one migration)
- New `org_alert_settings`:
  - Columns: `org` (pk), `provider` (`resend` | `microsoft_graph` | `gmail`, default `resend`), `syndicate_mailbox` (text, validated), `updated_by`, `updated_at`.
  - GRANTs, RLS: org members read; org admins update.
- `alert_sends`: add `sender_email`, `sender_org`, `provider`, `reply_to`, `to_address`. Keep `sender_name`. Mark the `bcc` column deprecated (comment only).
- New `alert_send_chunks`:
  - Columns: `id`, `send_id`, `chunk_index`, `to_address`, `bcc_addresses text[]`, `vendor_ids text[]`, `status`, `provider_message_id`, `error`, `attempts`, `updated_at`.
  - GRANTs. RLS mirrors `alert_send_recipients` (read via deal access; writes only from the backend function).
- **Backfill:** for each existing `alert_sends` row, insert one chunk per 50 rows of its `alert_send_recipients`. Status is `failed` if any of them failed, otherwise `sent`. Attempts = the max of the old rows. Then comment `alert_send_recipients` as `DEPRECATED: replaced by alert_send_chunks`. The table is left in place, not dropped.

### Backend function `send-deal-alert`
- `_shared/mail/types.ts`: `AlertMessage` = from, fromName, replyTo, to, bcc[], subject, html, attachment.
- `_shared/mail/index.ts`: `sendAlertEmail(provider, message, ctx)` returns `{ok, id} | {ok:false, error, code}`.
- Provider files: `_shared/mail/resend.ts`, `_shared/mail/graph.ts` (App User Connector token for the caller), `_shared/mail/gmail.ts` (stub).
- `_shared/mail/chunk.ts` holds `chunkRecipients(to, bcc, max=50)`. It counts To in every chunk, so each chunk has at most 49 BCC addresses. It is shared with the browser preview through a mirrored `src/lib/alertMail.ts`, kept consistent by tests.
- Steps: resolve the deal admin and require caller = deal admin (or master admin acting as them; Graph still requires the connected admin) → load org settings → refuse with a clear 400 if the syndicate mailbox is missing or the provider is unconnected → build chunks → send each → write `alert_sends` plus `alert_send_chunks` → audit log.
- Retry: `{ retryChunkId }` re-sends the stored chunk with the stored snapshot, the same provider and the same recipients.

### Frontend
- `src/lib/alertMail.ts`: `chunkRecipients`, `buildFromHeader`, `providerStatus`, `canSend(provider, status)`.
- `src/lib/distribution.ts`: load/save `org_alert_settings`.
- `src/components/AlertProviderSettings.tsx`: provider select, status badge, syndicate mailbox field and a Connect Microsoft 365 button. Placed in the Bond Console Recipients view.
- `src/components/SendUpdateDialog.tsx`: remove the BCC input; add the From/Reply-To/To/BCC-count/chunks preview and the per-chunk history with Retry.
- `src/pages/BondConsolePage.tsx`: mount the settings component.
- Microsoft Outlook App User Connector: provision the client (requires an Entra app registration; tenant admin consent per bank). If provisioning needs credentials you don't have yet, the interface, settings and "Not connected" state ship now and the Connect button stays disabled.

### Docs
- `AGENTS.md`: replace the new-issue alerts rule with: one email per chunk (≤50 incl. To) via `sendAlertEmail`; deal admin is sender and Reply-To; org syndicate mailbox always BCC; per-org provider; no silent fallback; chunk-level logs.
- `reference/dts-external-distribution-connectors.md` §7: same rules, the provider table, and the Resend subdomain/DNS note.

### Tests (`src/test/newIssueAlerts.test.ts`, plus new `src/test/alertMail.test.ts`)
- 1 To + 120 BCC → 3 chunks, each with ≤50 total addresses, To present in every chunk, all BCC addresses covered once.
- Exactly 49 BCC → 1 chunk; 50 BCC → 2 chunks.
- `buildFromHeader` → `"Jane Saunders (BNP Paribas) via DTS" <newissues@alerts.eurobondmarkets.com>`; Reply-To = `jane.saunders@bnpparibas.com`.
- Syndicate mailbox is always in BCC, even with zero enabled vendors, and is deduped if a vendor also lists it.
- The send request/log record carries sender name, email and org.
- `canSend('microsoft_graph', 'not_connected')` is false with the clear message. Resend is never chosen automatically when Graph is selected. Gmail always refuses.
- Existing tests kept: disabled vendors excluded, no send without approval, snapshot recorded.
