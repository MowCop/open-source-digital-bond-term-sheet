## Goal

Make the Attachments / Add files / Drop-zone functionality available inside the **Edit alert** modal (currently only available in the collapsed read view), and ensure attachments carry through every iteration of an alert's history.

## Changes

### 1. `src/components/AlertHistoryCard.tsx` — Edit alert dialog

Add an attachments panel into the modal, between the editor body and the Cancel/Save/Save & Send footer.

The panel will reuse the existing handlers already in the component (`handleFiles`, `removeAttachment`, `downloadAttachment`, `setPreviewAttachment`, `fileInputRef`, `dragOver`) — no new state needed. Layout mirrors the read-view panel:

- Header row: "ATTACHMENTS (n)" label + "Add files" button (opens the same hidden file input).
- Drop zone: "Drop PDF, DOCX, or PPTX here" with the same drag highlight.
- File list: each attachment shown with name, size, Preview, Download, and Remove buttons.

Because `handleFiles` / `removeAttachment` call `onUpdate(message.id, { attachments: ... })`, attachment changes save immediately to the message and are independent of the modal's Cancel button (matching today's behavior in the read view). The existing preview Dialog already renders alongside.

### 2. Cross-version persistence — verify only, no change needed

`MessagesPage.handlePostUpdate` (line 203) already passes `attachments: original.attachments` when creating the new draft version via "Save & Send", so attachments are inherited by each new iteration. No code change required here; this satisfies the "stay attached throughout every iteration" requirement.

## Verification

- Open Issue Board → click the latest update panel → Edit alert modal opens.
- New Attachments section visible above the footer with existing files listed.
- "Add files" and drag-and-drop add files; Remove deletes them; Preview/Download work.
- Click Save & Send → new version is created and carries the attachments forward (already-working behavior, re-confirm).
