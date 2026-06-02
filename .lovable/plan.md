## Move 'Enter deal headline' input above the chat strip

In `src/pages/AIDraftPage.tsx`:

1. Lift the headline `<Input>` (currently inside the Bulletin card around lines 553–559) out of that card and render it directly under the page header (after the "Draft a new message…" paragraph, before `<DraftChatStrip />`).
   - Wrap it in its own full-width `bg-card border border-border rounded-lg` container so it visually reads as a standalone panel matching the chat strip width.
   - Keep its existing value/onChange/placeholder. Drop the bottom-border styling that only made sense when it sat above the editor; use normal input padding.

2. Leave `<DraftChatStrip />` in place — it still reads `headline` from state, so the chat title continues to mirror live as the user types.

3. Inside the left compose column, remove the now-empty headline row but keep:
   - The "New Issue Bulletin" label (unchanged styling).
   - The drag-and-drop card containing the `RichTextEditor` (and the existing extraction overlay/toolbar).
   - Adjust the card so the top of the editor no longer has a leftover divider where the Input used to be.

### Out of scope
- No change to AI extraction, scp logic, recipients, or chat persistence.
- No change to `DraftChatStrip` itself.
