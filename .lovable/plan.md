# Sidebar Logo Refresh — Corporate Minimalist

## Goal
Replace the current green/yellow shadowed "Virtual Deal Room" wordmark in the left sidebar with a sharper, corporate minimalist treatment, and align it with the "New Issue Board" page title row.

## What will change
1. **Logo mark**
   - Small emerald-500 square (approx 32×32 px) containing a rotated inner square cut-out in the dark sidebar colour.
2. **Wordmark**
   - "VIRTUAL" in bold uppercase slate-100/white.
   - "Deal Room" in normal-weight slate-400, same line.
   - Tight tracking, Inter-style sans-serif stack.
3. **Alignment**
   - Logo baseline sits on the same horizontal line as the "New Issue Board" page title in the main panel on `/messages`.
   - Remove the oversized centred green/yellow styling.
4. **Navigation state**
   - Keep the current active-route bold text treatment for selected menu items.

## Files to edit
- `src/components/AppLayout.tsx` — sidebar header/logo markup and alignment/spacing.
- `src/index.css` — add or update logo utility classes if needed (no hard-coded hex values; use existing semantic tokens where available).

## Out of scope
- No changes to menu order, labels, or route behaviour.
- No new pages or backend changes.
