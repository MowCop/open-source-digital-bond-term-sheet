## Goal
Make the text inside the "Edit alert" dialog (subject input + rich-text body) render in the same white as the "Edit alert" headline, instead of the faded light-blue it currently inherits from Tailwind's `prose dark:prose-invert` palette.

## Root cause
- The body uses `RichTextEditor`, whose editor area is styled with `prose prose-sm dark:prose-invert`. Tailwind's `prose-invert` overrides text color via `--tw-prose-invert-body` (a desaturated blue-gray), which is what makes the body look light blue.
- `.tiptap` rules in `src/index.css` don't set a base color, so prose wins.
- The subject `<input>` already uses `text-foreground`, but visually reads cooler because the surrounding prose body is dimmer. Once the body is brightened, both will match.

## Change
Edit `src/index.css` only — add explicit color overrides scoped to `.tiptap` so the editor body (and the read-only `.tiptap` blocks used by `AlertHistoryCard`) inherit `hsl(var(--foreground))`:

```css
.tiptap,
.tiptap p,
.tiptap li,
.tiptap strong,
.tiptap em,
.tiptap h1,
.tiptap h2,
.tiptap h3 {
  color: hsl(var(--foreground));
}
```

This matches the `DialogTitle` ("Edit alert") which also resolves to `text-foreground`.

## Out of scope
- No component-level changes to `RichTextEditor.tsx` or `AlertHistoryCard.tsx`.
- Placeholder, blockquote, link, and inline-code colors stay as-is (intentional muted/primary styling).
- No changes to the design tokens themselves.

## Verification
- Open an alert on the Issue Board → click into the latest update → confirm subject text and body text render in the same bright white as the "Edit alert" title.
- Confirm read-only message bodies (which also use `.tiptap prose`) brighten consistently across the Issue Board.