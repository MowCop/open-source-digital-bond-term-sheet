/** Static VDR help library for Co-Pilot General mode. Keep in step with the app's pages. */
export const VDR_HELP = `
PAGES (sidebar):
- New Issue Board (/messages): published deal updates (Mandate → Announced → Launched → Books Open → Books Closed → Priced → Settled). Filter by status/stage; click a row to expand; the chat icon opens the deal chat. Clicking an update focuses Co-Pilot on it.
- Digital Term Sheet (/deals): every deal's term sheet. Tabs: Fill (default, edit fields), View, XML, DLT, Documents. The Deal Checker sits above the tabs and runs live checks (LEI via GLEIF, FIGI via OpenFIGI, calendars, ICMA rules). Warnings can be clicked to jump to the field, use "Try to fix", or be ignored/restored. Changes are saved only when you press Save. Drop files on a deal to store them in its document list. Co-Pilot here focuses on that deal and proposes corrections that only term editors can approve.
- My Deal Chats (/inbox): chats per deal; clicking a chat focuses Co-Pilot on it.
- Create New Issue (/compose): write and publish a board update; AI can parse pasted text or files.
- Address Book & User Admin (/users): contacts, distribution lists, guests.
- Bond Console (/bond-console): market data, connectors, vendors, syndicate tools (incl. Edgar SEC filings), news & wires. Add/edit/delete your own entries; built-ins are fixed; deleting asks you to type "delete".
- Master Admin (/admin): user approvals and roles (Master Admin only).
- Audit Log (/audit): every platform action, for compliance.
- Settings (/settings): AI model choice (Claude) and preferences.
ROLES: Master Admin manages users; Syndicate Admin manages deals and updates; Vendor User receives updates; read-only roles view only; guests see only invited deals.
NEW DEAL: needs Issuer Name, Currency, Benchmark, Tenor and at least one Bookrunner.
BELL (top right): shows unread alerts — chat invites, deal updates and your Co-Pilot reminders. Clicking it opens My Deal Chats.
FREE TO TRADE: a bond is free to trade once it settles — the settlement date, or when the deal reaches the "Settled" stage.
REMINDERS: Co-Pilot can set reminders only when you ask, and you confirm each one. They go off while you have the VDR open and appear on the bell.
SEARCH: the magnifier top left searches deals, updates and chats.
`;
