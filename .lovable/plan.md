

## Master Deal Alerts & User Management — Comprehensive Update

This plan covers 11 changes spanning Master Deal Alerts, Deal Data, AI parsing, and User Management. Grouped by area for clarity.

---

### A. Master Deal Alerts (items i–vi)

**i) Inline-editable headlines with predictive autofill**
- Make the **Headline** column on the main alert row directly editable on click (turns into an `Input` in place; blur or Enter saves via `updateMessage`).
- As the user types, show a small dropdown with predictive suggestions composed from the linked deal: `"{Borrower} — {Stage}"`, `"{Borrower} {Currency} {Tenor} — Mandate"`, etc. Suggestions derived from the message body via the existing `simulateAIExtraction` (borrower, currency, tenor) plus the current `deal.stage`.
- Clicking a suggestion fills the headline.

**ii) Delete button on every alert (all stages)**
- Add a `Trash2` icon button to each `AlertHistoryCard` next to Retract, available regardless of status (draft / sent / retracted).
- New `deleteMessage(id)` action in `AppContext` that removes the message from state, persists, and writes an audit entry. Confirmation toast with undo not needed for prototype.
- Also expose Delete on the main collapsed row (small icon on hover) — deletes the **entire alert thread** (all messages sharing the same `dealIds` group) after a `confirm()` prompt.

**iii) Multi-file attachments — drop, preview, download, delete (per alert)**
- In `AlertHistoryCard`, replace the current "📎 N attachments" line with a real attachments panel:
  - Drag-and-drop zone (PDF / DOCX / PPTX) that calls `updateMessage(id, { attachments: [...] })`.
  - Each file shown as a row with file-type icon, name, size, **View** (opens preview modal), **Download** (triggers blob download), **Delete** (×).
  - Preview modal: PDFs render inline via `<iframe src={url}>`; DOCX/PPTX show a placeholder card with filename + Download (true preview requires server-side conversion and is out of scope).
  - Files are stored as base64 data URLs in the existing `Attachment.url` field so they survive the localStorage persistence layer (small files only — warn if >2 MB to avoid blowing the storage quota).

**iv) VDR AI improvements — TBA defaults + document scanning**
- Update `simulateAIExtraction` and `mergeDealFromText` so any field that comes back empty is set to the literal string `"TBA"` instead of `''`. Apply throughout the app where deal fields render (`DealsPage.tsx` `fieldRow` already filters falsy — change it to render `"TBA"` when value is missing).
- Add a lightweight **document scanner**: when a PDF/DOCX is attached, extract its text on the client (PDF: `pdfjs-dist`; DOCX: `mammoth`) and feed it into `simulateAIExtraction` + `extractBookrunners` along with the message body. Detected fields appear in the AI Field Extraction panel with a small "from attachment" tag.
- The combined text (body + attachments) is what populates suggestions and the Deal record on Save/Send/Post Update.

**v) Vendor List sticks across all updates of a deal**
- Today, each clone in `handlePostUpdate` already copies `recipients` from the original. The missing piece is **visibility**: render the vendor list on every alert card.
- Add a "Distribution" section inside `AlertHistoryCard` (collapsible, default collapsed) that shows the recipient names + organisations resolved from `recipients` IDs, identical for the original and every update.
- For new updates, the recipients list is **locked** to the original by default; an "Edit recipients" affordance is hidden behind an Edit toggle for Master/Syndicate Admin only.

**vi) "Deal Alert Data" tab at the top of the expanded alert**
- When an alert row is expanded, show two tabs at the top: **Alerts History** (current view) and **Deal Alert Data**.
- "Deal Alert Data" navigates to `/deals?dealId={primaryDealId}` (or renders an inline tranche summary — see vii) — DealsPage will be updated to auto-select the deal from the URL param.

---

### B. Deal Data — Tranches per Alert (item vii)

A deal alert can spawn multiple **tranches** (e.g. GBP1bn 10Y + GBP2bn 30Y for one borrower). Today a Deal models a single tranche.

- Extend the data model: introduce a `Tranche` type holding the existing 35 ICMA fields (currency, size, tenor, ISIN, coupon, etc.). A `Deal` becomes `{ id, issuerName, issuerLEI, issuerRating, bookrunners, tranches: Tranche[] }`. Most other Deal fields move into `Tranche`.
- Migration: on load, wrap each existing Deal's flat fields into a single tranche so old localStorage data still works.
- `DealsPage`: each Deal card lists its tranches; selecting a tranche shows the full ICMA field list, with `"TBA"` for any missing value.
- Parsing: `mergeDealFromText` is updated to detect multiple tranches from cues like `"GBP1bn 10-year and GBP2bn 30-year"` and create/update tranches accordingly.
- Bookrunners stay at the Deal (issuer) level — shared by all tranches.

---

### C. User Management (items viii–xi)

**viii) New role: "Syndicate – Read Only"**
**ix) New role: "Sales – Read Only"**
- Extend `UserRole` type: add `'syndicate_readonly'` and `'sales_readonly'`.
- Add to `roleLabels` and the Add User role dropdown.
- Permission gating: both roles can read `messages` and `deals` only when the user appears in `recipients` (or distribution list members). They cannot create/edit/retract/delete anything. Update `MessagesPage` `visibleMessages` filter and hide all action buttons (`canManageMessages`) for these roles.

**x) Editable user profile + creation audit stamp**
- Wire up the `Pencil` icon in the user table to open an "Edit User" panel (same form as Add User, prefilled). Saves via `updateUser`.
- All fields editable: name, email, phone, organization, role, category. No expiry date — confirm in code that no expiry logic exists.
- Display "Created: {date} by {name}" already exists in the Created Details column — keep, ensure it's read-only and always shown in the edit view too.

**xi) Rename "Vendor" → "Read Only" in role dropdown; editable labels**
- In Add User / Edit User, change the role option label `"Vendor"` to `"Read Only"` (the underlying `vendor_user` enum value stays the same to avoid breaking existing data).
- Make the User Management text labels (column headers, tab names, section titles) configurable: store them in a `mem://design/user-management-labels` memory file and load from a small `labels` map at the top of `UserManagementPage`. A future "Edit labels" affordance is out of scope for this iteration; for now the labels are exposed as a single constant object so they can be updated in one place.

---

### Files Touched

- `src/types/bond.ts` — add `Tranche` type, extend `UserRole`, update `Deal`.
- `src/lib/alertParsing.ts` — TBA defaults, multi-tranche detection, attachment-text input.
- `src/lib/attachmentText.ts` (new) — extract text from PDF/DOCX using `pdfjs-dist` + `mammoth`.
- `src/components/AlertHistoryCard.tsx` — inline edit, delete, attachment panel with preview/download, distribution list, locked recipients.
- `src/pages/MessagesPage.tsx` — inline editable headline with predictive dropdown, row-level delete, Deal Alert Data tab, route param wiring.
- `src/pages/DealsPage.tsx` — render tranches per deal, accept `?dealId=` param, TBA fallback for empty fields.
- `src/pages/AIDraftPage.tsx` — feed attachment text into AI extraction, set TBA defaults.
- `src/pages/UserManagementPage.tsx` — new roles, edit user form, "Read Only" label, centralised labels map, role-based read-only enforcement.
- `src/context/AppContext.tsx` — add `deleteMessage`, migrate Deal → Deal+Tranches on rehydrate.

### Dependencies to Add

- `pdfjs-dist` — client-side PDF text extraction.
- `mammoth` — client-side DOCX text extraction.
- (PPTX text extraction is non-trivial; for now PPTX attachments are listed/downloadable but not scanned by the AI — explicitly noted in the AI panel.)

### Result

Master Deal Alerts becomes fully editable inline with predictive headlines, every alert can be deleted, attachments are first-class (drop/preview/download/delete) and feed the VDR AI, vendor recipients persist visibly across every update, and a Deal Alert Data tab links to per-tranche ICMA data with `"TBA"` defaults. User Management gains two read-only roles, full profile editing, and the "Vendor" label becomes "Read Only".

