## What's wrong

The screenshot is the **Create New Issue** composer (`src/pages/AIDraftPage.tsx`). The body field there is a plain `<Textarea>` — by design textareas can't render clickable hyperlinks, so the EUROFIMA URLs in the message stay as raw text and can't be opened.

In other places the URLs already render correctly:
- `AlertHistoryCard` (sent / saved alerts) → uses `LinkifiedText`
- `InboxPage` and `SecureChat` (chat) → use `LinkifiedText`

So the fix is scoped to the composer view only.

A secondary check on the regex: `LinkifiedText`'s pattern `/https?:\/\/[^\s<]+[^\s<).,;:!?]/gi` correctly matches URLs containing `(1)` like the EUROFIMA `Slides(1).pdf` link, but it currently strips a trailing closing parenthesis on URLs that end with `)`. We'll tighten that so balanced `()` inside a URL are preserved.

## Plan

1. **Add an Edit / Preview toggle to the Create New Issue composer**
   - In `src/pages/AIDraftPage.tsx`, wrap the body `<Textarea>` in a small two-tab control: "Write" (default, current Textarea) and "Preview".
   - Preview pane renders `body` inside a `whitespace-pre-wrap` block using `<LinkifiedText text={body} />`, so all `https://…` URLs become clickable, open in a new tab, and match the styling used in alert history.
   - No changes to save/send logic, attachments, AI extraction, or distribution.

2. **Improve `LinkifiedText` URL detection (small, safe tweak)**
   - In `src/components/LinkifiedText.tsx`, update the regex / trimming so a URL keeps internal balanced parentheses (e.g. `Slides(1).pdf`) and only strips a trailing `)` when there is no matching `(` earlier in the URL. Trailing punctuation handling (`.,;:!?`) stays the same.
   - This benefits every place that already uses `LinkifiedText` (alert history, inbox, chat) without changing their markup.

3. **Manual verification after implementation**
   - In Create New Issue, paste the EUROFIMA body from the screenshot, switch to Preview, confirm all three URLs are clickable and open in a new tab.
   - Open an existing sent alert in New Issue Board → expand → confirm the same URLs render as links (regression check on `AlertHistoryCard`).

## Out of scope

- No backend/database changes.
- No changes to who can see which deal (separate scoping work already shipped).
- No rich-text editor — Preview is read-only rendering of the same plain text.
