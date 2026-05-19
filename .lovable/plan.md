## Goal

Replace the current basic PDF `<iframe>` preview with the **Adobe PDF Embed API** so Syndicate Admins and Vendor Users can view, annotate, comment, and (where supported) fill forms on deal attachments — with edits saved back to Lovable Cloud and recorded in the audit log.

Redaction and e-signature are explicitly **out of scope** for this round (Adobe Embed does not support them).

---

## What the user will see

1. Open any PDF attachment on an alert, deal document, or Issue Board.
2. A full Adobe viewer opens in a modal (replacing today's iframe) with a toolbar for:
   - Highlight, strikethrough, underline
   - Sticky-note comments
   - Freehand drawing
   - Form-field fill (for PDFs that contain AcroForm fields)
3. A **Save** button persists annotations.
4. A version history shows: annotation layers (per user) + flattened PDF snapshots.
5. Every save writes an entry to the audit log (`user`, `action`, `attachment_id`, `deal_id`, timestamp).

---

## Architecture

```text
┌────────────────────────┐   load PDF   ┌─────────────────────┐
│  React <PdfEditor>     │ ───────────► │ Lovable Cloud       │
│  (Adobe Embed SDK)     │              │ Storage: pdf-docs/  │
│                        │ ◄─────────── │                     │
└──────────┬─────────────┘   save XFDF  └─────────────────────┘
           │  + flattened
           ▼
┌────────────────────────┐              ┌─────────────────────┐
│ pdf_annotations table  │              │ audit_log table     │
│ pdf_versions table     │              │                     │
└────────────────────────┘              └─────────────────────┘
```

---

## Implementation steps

### 1. Adobe credentials
- User registers a free Adobe PDF Embed API client ID at `https://acrobatservices.adobe.com/dc-integration-creation-app-cdn/main.html` for the BondVDR preview domain + custom domain (`eurobondmarkets.com`).
- Store as a **public** env var `VITE_ADOBE_EMBED_CLIENT_ID` (Adobe Embed keys are domain-locked, so the publishable key in code is fine).

### 2. Storage
- Reuse the existing `message-attachments` bucket; add a sibling private bucket `pdf-versions` for flattened snapshots.
- Migrate existing localStorage/base64 attachments to cloud storage on first open (lazy upload).

### 3. Database (new tables)
- `pdf_annotations` — `id`, `attachment_id`, `user_id`, `xfdf` (text), `created_at`
- `pdf_versions` — `id`, `attachment_id`, `version_no`, `storage_path`, `created_by`, `created_at`, `note`
- RLS: a user can read/write annotations on attachments they can see (reuse the existing visibility rules via `has_role` + deal membership).

### 4. React component
- New file `src/components/PdfEditor.tsx`:
  - Loads Adobe View SDK from CDN once (`https://acrobatservices.adobe.com/view-sdk/viewer.js`).
  - Initializes with `clientId`, file URL (signed Supabase storage URL), embed mode `FULL_WINDOW`, and `showAnnotationTools: true`.
  - Registers callbacks: `ANNOTATION_ADDED`, `ANNOTATION_UPDATED`, `ANNOTATION_DELETED` → debounced save to `pdf_annotations`.
  - "Save flattened version" button → uses Adobe's `getPDFBlob()` (or server-side merge of XFDF via `pdf-lib`) → upload to `pdf-versions` bucket → insert `pdf_versions` row.
- Replace the iframe in `AlertHistoryCard.tsx` preview dialog with `<PdfEditor>` when `attachment.type === 'pdf'`.
- Add the same editor as a button on Deal Checker / `AIDraftPage` attachments.

### 5. Audit log
- Each save fires `logAudit({ action: 'pdf_annotated' | 'pdf_version_saved', ... })` via the existing audit pipeline.

### 6. Permissions
- **Syndicate Admin**: can annotate and save versions on deals they own.
- **Vendor User**: can annotate and save (their annotations only).
- **Master Admin**: read-only on others' annotations + can delete.

### 7. QA checklist
- Open a small PDF, large PDF (>10 MB), and a malformed PDF.
- Confirm annotations round-trip across sessions and users.
- Confirm Adobe key works on both `*.lovable.app` and `eurobondmarkets.com`.
- Confirm audit log entries appear.

---

## Files touched

- **New**: `src/components/PdfEditor.tsx`, `src/lib/adobeViewer.ts`, migration for `pdf_annotations` + `pdf_versions` + new bucket.
- **Edited**: `src/components/AlertHistoryCard.tsx` (replace iframe preview), `src/pages/AIDraftPage.tsx` (use editor for PDF attachments), `index.html` (Adobe SDK script tag), `.env` (Adobe client ID).

---

## Out of scope (for later if needed)

- **Redaction** — would need server-side `pdf-lib` or a paid SDK (Nutrient/Apryse).
- **E-signature** — would need Adobe Sign or DocuSign integration.
- **Real-time multi-user co-annotation** — Adobe Embed doesn't ship with this; would require building a CRDT layer on top of XFDF.
- **DOCX / PPTX editing** — Adobe Embed is PDF-only. We'd need to convert via the existing `docxToHtml` flow or add Office.js.

---

## Open question

Adobe PDF Embed API is **free but requires an Adobe Developer account** (no credit card). You'll need to create the client ID yourself and paste it once. Confirm you're happy to do that, then I'll build it.
