# Update slide 8 of the NewIssueVault workflow deck

Replace the existing slide-8 diagram with the provided New Issue Board screenshot and rewrite the caption to frame Distribution as centralised syndicate control.

## What the user gets

1. **Slide 8 visual replaced entirely** — the provided screenshot (New Issue Board focus mode for The Kingdom of Nania, showing the full toolbar: TermSheet Data, Edit Latest, AI DataParse, Chat, OrderBook, Deal Checker, History, Save, Save & Send, Retract) becomes the main image on slide 8.
2. **Existing diagram shapes removed** — all current flow-diagram shapes, arrows, permission-boundary boxes and their text labels on slide 8 are deleted.
3. **Caption rewritten** — new subtitle/body text explains that "Distribution" means centralised control for data, message blasts, chats and compliant AI checker administration of execution for syndicate managers.
4. **Preview first** — a draft slide-8 PNG is produced for approval before the deck is rebuilt.
5. **Deck rebuilt as v3** — after approval, a new `NewIssueVault-Workflow-Deck-v3.pptx` is generated, validated and rendered for QA.

## Slide 8 content

- **Step / stage chip:** keep "STEP 4 · DISTRIBUTION" and the lifecycle spine (Mandate → Announced → Launched → Books Open → Books Closed → Priced → Settled) so the deck motif stays consistent.
- **Title:** "Distribution: centralised syndicate control"
- **Body / caption:** "One place controls data, message blasts, inter-bank chats and the compliant AI Deal Checker that runs through pricing — giving syndicate managers end-to-end command of execution."
- **Visual:** the provided screenshot, embedded full-width below the title, cropped to the available slide area while keeping all toolbar buttons readable.
- **Speaker notes:** updated to describe the screenshot, the centralised toolbar, and how bookrunners use it to blast, chat, check and deliver deal data from one panel.

## Technical approach

- The original `pptxgenjs` build script lived in `/tmp/deck` and is no longer present, so slide 8 will be rebuilt by editing the existing `NewIssueVault-Workflow-Deck-v2.pptx` directly with `python-pptx`.
- Read the current slide 8 to preserve the slide master, background, step chip and lifecycle spine positioning.
- Remove all non-spine diagram shapes and the old picture.
- Embed the provided screenshot as a new picture, scaling it to fit the slide body without distortion.
- Add the new title and caption text boxes, matching the existing font family (Georgia / Calibri) and colour palette (navy, gold, white).
- Export a draft PNG of slide 8 for review.
- On approval, write the updated deck to `/mnt/documents/NewIssueVault-Workflow-Deck-v3.pptx`, run OOXML validation, render all slides to images, and inspect them for overflow or clipping.

## Out of scope

- No changes to slides 1-7 or 9-10 beyond the lifecycle spine consistency already on slide 8.
- No application code changes.
