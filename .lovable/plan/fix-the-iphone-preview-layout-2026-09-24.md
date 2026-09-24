# Fix the iPhone preview layout

## What will change

- Replace the permanently visible left menu with a compact phone header and menu button on small screens.
- Open the existing navigation in a slide-over panel when the menu button is tapped.
- Keep the current desktop sidebar unchanged on larger screens.
- Reduce phone-only page margins and allow wide deal content to scroll within its own area instead of cutting off the whole screen.
- Keep search, notifications, account details, and every existing menu destination available on iPhone.

## Validation

- Check the main board and Create New Issue at the current 402 × 725 iPhone viewport.
- Confirm the page uses the full phone width, the menu opens and closes, and no controls are hidden beyond the right edge.
- Confirm the desktop layout remains unchanged.

## Technical details

The app shell currently reserves a fixed 240px sidebar at every screen size. The update will add responsive mobile navigation while retaining the existing routes, permissions, labels, and desktop styling.
