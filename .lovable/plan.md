## Fix truncated deal title in SecureChat header

In `src/components/SecureChat.tsx`, the header crams shield icon + deal title + stage badge + AI Extract + expand/close into one row, forcing "Kingdom of Spain EUR 7Y" to truncate to "Kin…".

### Change

Split the header into two rows:

**Row 1 (full width, title line):**
- Shield icon
- Full deal title: `Kingdom of Spain EUR 7Y` (no truncation, allow wrap)
- Stage badge (`Books Open`)

**Row 2 (controls):**
- AI Extract button (left)
- Spacer
- Expand and Close icon buttons (right)

Participants toggle row stays as-is below.

### Technical notes
- File: `src/components/SecureChat.tsx` — `CardHeader` block only.
- Remove `truncate`/`max-w` constraints from the title span; let it wrap.
- Keep all existing handlers, props, and `activeDeal`/`activeChannel` logic unchanged.
- No changes to `AlertHistoryCard.tsx` or other files.
