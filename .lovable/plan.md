# Al Rajhi Bank Tier 2 Social Sukuk: demo deal flow

## 1. Knowledge Library
- Store all six files in `reference/al-rajhi-tier2/`, keeping the 1.1 to 4.0 numbering. Word files are kept as readable text, and the PDFs are stored as file links rather than large copies in the code.
- Write a summary note (`reference/al-rajhi-tier2/README.md`) covering message order, the stage of each message, its key terms (IPTs T+200bp, books over $1.6bn, launch spread, priced terms) and which attachments went with message 1.1.
- Add a project memory entry so every part of the app uses this deal as the standard demo.

## 2. New separate demo deal
- Create a clean "Al Rajhi Bank – Tier 2 US$ Reg S 10.5NC5.5 Social Sukuk" deal. The existing Al Rajhi Sukuk Limited deal stays as it is.
- Store the Offering Circular and Supplement in its Documents tab, cited in its term sheet document list.

## 3. Deal Chat replay
- Seed illustrative pre-marketing chats first (mandate, investor calls, announcement), clearly labelled as illustrative.
- Add a "Next message" replay control to the demo deal's chat. Each click posts the next real blast (1.1, then 2.0, 3.0, 4.0) in order. Message 1.1 carries the two PDFs as attachments. A Reset button returns the replay to the start.

## 4. Digital Term Sheet sync (both modes)
- **Saved stage snapshots:** history versions for Announcement, IPT, Guidance/Books, Launch and Priced, built from the files, so you can switch between stages read-only.
- **Live review:** each replayed message is also sent through the normal parser, so its values appear as suggestions in Fill for you to accept. Nothing is applied automatically.
- The Deal Checker runs on each stage as usual.

## Technical details
- Text is extracted from the .docx files with the existing reader. The demo script lives in one data file (`src/data/alRajhiDemo.ts`) that drives the chat replay and the snapshots.
- Snapshots go into the existing immutable releases table, and seeded rows are tagged as demo data.
- Replay posts through the existing chat insert path and calls the existing extraction function for proposals.
- AGENTS.md gets one rule naming the demo script as the single source for this deal.
- Verify by stepping through the replay in the preview, checking the stage history and confirming Fill suggestions after each message.
