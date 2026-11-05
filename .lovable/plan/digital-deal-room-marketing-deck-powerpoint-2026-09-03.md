# Digital Deal Room — Marketing Deck (PowerPoint)

A 10-slide, light-corporate PowerPoint that walks a bank syndicate audience through the Digital Deal Room workflow in chronological order of execution. Delivered as a `.pptx` file, with use-case commentary in the speaker notes pane.

## Look and feel

- Light corporate pitchbook: white / soft grey backgrounds, navy structure, gold accent, one sky-blue highlight for AI moments.
- Dark navy title and closing slides to bookend the deck.
- One repeated motif: numbered stage chips running along a lifecycle spine, so every slide shows where you are in the deal timeline.
- Header font Georgia, body Calibri. Titles 40-48pt, body 20-24pt.
- Every slide carries a visual: clean vector-style diagrams for flow and roles, real app screenshots for the modules.

## Slides (chronological)

1. **Title** — Digital Deal Room: instant new-issue execution for bookrunners. Dark navy, gold rule, tagline.
2. **The problem** — Fragmented chats, spreadsheets and manual termsheets; data reaches investors late and inconsistently. Icon rows, no screenshot.
3. **The lifecycle at a glance** — Full diagram: Mandate → Announced → Launched → Books Open → Books Closed → Priced → Settled, with the data-convergence idea shown underneath (Benchmark → $1bn+ → $1bn–1.5bn → $1.25bn).
4. **Step 1 — Create New Issue + Chat Room** — Screenshot of the New Issue Board / create flow; caption on the deal + chat pairing.
5. **Step 2 — AI DataParse from inter-bank chat** — Screenshot of the chat thread plus the AI Termsheet Data Extraction Review modal; explains confidence scoring and accept/override.
6. **Step 3 — Termsheet Data converges** — Screenshot of the Termsheet Data panel; diagram strip showing a size term tightening through the day.
7. **AI Deal Checker** — Screenshot of the checker flagging an inconsistency; explains red-flag rules at creation and through execution.
8. **Step 4 — Blasts, Address Book and email distribution** — Diagram of bookrunners → blast → Address Book → email/Outlook → vendors, investors, guests, with the read-only permission boundary drawn explicitly.
9. **Step 5 — API data delivery from Bond Console** — Diagram: blast sent → termsheet auto-updates → data pushed to vendor platforms in real time; the permanent API link set up once per client.
10. **Audit log + closing** — Dark navy. Every action recorded for compliance; short recap of the five steps and a closing line.

## Speaker notes

Each slide gets 80-150 words of commentary covering: what the user is doing at that point, the use case it solves, and who benefits (syndicate desk, borrower, investor, vendor). Written for a presenter pitching to a bank.

## Technical notes

- Built with `pptxgenjs` from scratch (no template supplied), images embedded as base64.
- Screenshots captured from the running app via Playwright at 1280×1800 for slides 4-7 and cropped to the relevant panel; if a screen cannot be captured cleanly, a labelled diagram stands in.
- Output validated (schema check), rendered to images and visually reviewed before delivery.
- Deck delivered as a downloadable `.pptx` in the documents area. No changes to the application source.

## Content integrity

No invented metrics, client names, or performance claims. The size-evolution example uses the illustrative figures from your brief and is labelled as illustrative.
