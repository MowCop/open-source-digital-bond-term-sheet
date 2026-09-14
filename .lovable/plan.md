# NewIssueVault definitions: documentation + in-app glossary + workflow diagram

Take the Digital Term Sheet / VDR definitions you supplied and turn them into structured project documentation, an in-app glossary, and a visual workflow diagram. Then use the same definitions to identify and close the highest-impact functional gaps in the prototype.

## 1. Individual concept files

Create a `docs/` folder at the project root and write one focused markdown file per concept. Each file uses your wording, adds only light editing for grammar, and does not invent metrics or client names.

- `docs/01-term-sheet.md` — what the TS is, that it is the source of truth, physical (PDF) or digital (XML), and the role of lawyers / syndicates / DCM.
- `docs/02-vdr.md` — digital synchronisation of the TS with stakeholders, real-time term updates, deal blasts, and external API/MCP feeds.
- `docs/03-term-sheet-options.md` — drop-in TS self-population, create-deal from scratch, manual updates, and AI parse (partial or full).
- `docs/04-deal-blasts-and-chat.md` — AI parser from chat, AI parser from message blast, and AI creating / suggesting a blast when none exists.
- `docs/05-ai-deal-checker.md` — background compliance and bond-semantics checking for 100% VDR accuracy.
- `docs/06-usps.md` — ICMA BDT 2.0 schema, compliance/security, legal/syndicate TS support, automatic internal-deal-data sync.

## 2. README as the index

Rewrite `README.md` so it becomes a short landing page that links into the `docs/` files and keeps the workflow ASCII diagram. No duplication of full definitions.

## 3. In-app glossary page

Add a `/glossary` route and a sidebar entry labelled **Definitions**.

- Render the six concept sections as a scrollable page with anchor links.
- Use existing shadcn UI components (Card, Accordion, ScrollArea) and the project colour tokens.
- Add a search input that filters terms by heading and body text.
- Keep the tone identical to the docs; no invented claims.

## 4. Workflow diagram image

Generate a clean, corporate workflow diagram that matches the Corporate Minimalist direction already in use.

- Nodes: Digital digital term sheet drop-in / Create deal → Digital Term Sheet in VDR → Syndication (chat + blasts, AI parse) → AI Deal Checker → Distribution (email blasts + API/MCP feeds).
- Style: dark slate background, emerald and gold accents, rounded boxes, subtle depth/shadow.
- Save to `src/assets/vdr-workflow-diagram.png` and embed it in `README.md` and the glossary page.

## 5. Functional gap analysis and implementation

Use the definitions to audit the current app and close the gaps that are most visible to users. Investigate first, then build.

### 5.1 Digital digital term sheet drop-in at deal creation
- Check whether the create-deal flow accepts a TS file upload (PDF/XML) and auto-populates fields.
- If missing, add a file drop zone on the create-deal screen, parse the filename/type for now, and store the file reference against the deal.

### 5.2 AI parser from chat and from blast
- Verify the chat AI DataParse button and the blast AI DataParse path both feed the same extraction pipeline.
- If either path is absent or inconsistent, unify them behind the existing `extract-deal-from-chat` logic and expose the source in the review modal.

### 5.3 AI-drafted blast when no message exists
- Check whether the system can suggest a deal blast from deal terms alone.
- If missing, add a **Suggest blast** action on the edit screen that calls the AI gateway with the current deal terms and returns a draft headline/body for user review.

### 5.4 Background AI Deal Checker
- Confirm the Deal Checker is triggered automatically on save/send or only on manual open.
- If it is manual-only, add a lightweight background run that fires after each published update and stores the result; surface a status indicator on the board and edit screen.

### 5.5 External API / MCP feeds
- Check existing connector/MCP integration status.
- If none exists, add a placeholder **Market Data Connectors** panel (reusing the slide 9 wording) with a coming-soon state and the permanent-API-link headline.

## 6. Verification

- Typecheck the React changes.
- Open the glossary route and the edit screen in Playwright to confirm the new page renders and no existing controls break.
- Confirm the generated diagram appears in both README preview and the glossary page.
