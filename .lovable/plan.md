## Goal

In the Create New Issue screen's attachment strip, each attached file should support three actions:

1. **Download** — get the original file back exactly as uploaded.
2. **Delete** — remove the attachment (already works as a bare ✕, will be relabelled).
3. **Replace** — swap the file for a newly uploaded one in the same slot, optionally re-running AI extraction on the new file.

## Why this needs a small data change

The current `Attachment` is metadata-only: `{ id, name, type, size, url }` with `url` left blank. The actual `File` bytes are dropped after extraction, so there's nothing to download or replace from. We need to keep the bytes around until the draft is sent.

For the prototype (no Storage round-trip yet), the simplest approach is to keep the `File` in-memory and create an object URL on demand. No DB migration needed.

## Approach

### 1. Extend the Attachment type (non-breaking)

`src/types/bond.ts` — add two optional fields:

```ts
export interface Attachment {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'pptx';
  size: number;
  url: string;
  file?: File;      // in-memory blob for download / replace (not persisted)
  mimeType?: string;
}
```

Existing message records continue to work because both fields are optional.

### 2. Persist the File in `handleFiles`

In `src/pages/AIDraftPage.tsx`:

- `toAttachment(file)` stores the live `File` and its `mimeType` alongside the metadata.
- Keep the same array; nothing else upstream changes.

### 3. New row UI in the attachment strip

Replace the current chip row with a single line per attachment:

```
📎 aldar_term_sheet.pdf  · 184 KB        [Download] [Replace] [Remove]
```

- **Download** — creates a Blob URL from `attachment.file`, triggers an `<a download={name}>` click, then revokes the URL.
- **Replace** — opens a hidden `<input type="file">` scoped to that attachment id; on change, swaps the entry in-place (keeping the same `id` and array position) and re-runs the existing PDF/DOCX extractor on the new file so headline/body/AI fields refresh from the replacement.
- **Remove** — the existing delete behaviour, just relabelled with a trash icon for clarity.

Compact layout that still fits the 642px viewport: filename truncates with `truncate`, action buttons stay right-aligned with `text-[11px]`.

### 4. Helper to trigger a browser download

Small inline util in the page (or `src/lib/download.ts` if reused elsewhere):

```ts
function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

If an attachment has no `file` (e.g. came back from a saved draft after refresh), the Download and Replace buttons render disabled with a tooltip ("Original file no longer available — re-attach to download").

### 5. Replace flow details

- A single hidden `<input type="file">` is shared; clicking Replace stores the target attachment id in a ref, then `.click()`s the input.
- On change, `handleReplace(id, newFile)`:
  - swaps the array entry (same index, new metadata + new `file`),
  - calls `handleFiles([newFile])` minus the append step — refactor extraction into a `extractFromFile(file)` helper used by both initial drop and replace, so AI fields update.
  - shows a toast: "Replaced *old.pdf* with *new.pdf*".

## Files touched

- `src/types/bond.ts` — add optional `file?: File; mimeType?: string` to `Attachment`.
- `src/pages/AIDraftPage.tsx` — store `File` in attachments, refactor extraction into a reusable helper, add Download / Replace / Remove row UI, hidden replace input.

## Out of scope (call out if needed)

- No backend upload — files live in the browser session only. After sending or page refresh, downloads from the inbox side won't work yet. If you want recipients to be able to download the original file too, the next step is a Cloud Storage bucket (`message-attachments`) plus a small upload-on-send step.

Let me know if you want me to include the Storage backend now or keep this as a session-only prototype.
