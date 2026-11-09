# Bond Console connector catalogue update

## What changes for users
- The connector names and descriptions match the reference document: Dealogic, S&P Global IssueNet / InvestorAccess, ANNA DSB (OTC derivatives only), and DTCC (US muni new issues).
- PrimaryNexus is removed.
- Six news recipients are added under News & Wires: Debtwire, KangaNews, MNI Market News, Prospect News, EDI and Financial Times.
- Each connector row shows a "Push" or "Pull" badge.
- Any changes a user has saved to the list in their browser are kept, except the ones that only refer to old defaults or to PrimaryNexus.

## Catalogue edits (src/lib/vendors.ts)
1. `dealologic`: the id stays the same, so no id change is needed. The name becomes "Dealogic (ION Group)". The description becomes "Syndicate workflow (DealManager) and Primary Market Deals feed".
2. `ipreo`: the id stays the same. The name becomes "S&P Global IssueNet / InvestorAccess". The description becomes "Bookbuilding sync across syndicate banks; DealServices API and FIX".
3. `anna`: the description becomes "OTC derivatives ISINs only, not a bond ISIN source".
   - **Proposal:** keep ANNA DSB for derivatives. Add a separate route for XS ISINs instead of reusing the ANNA row. Update the `clearstream` description to "PMI/D7 API: ISIN and instrument data (XS ISINs)". Add one Industry & Standards entry, `xs-isin` "Euroclear / Clearstream XS ISIN allocation". Its direction is Push, because the bank sends the ISIN request and instrument data to the ICSD. This keeps Euroclear and Clearstream as the only bond ISIN source.
4. `dtcc`: the description becomes "US municipal new issues (NIIDS)".
5. Delete `primarynexus` from `VENDOR_APIS` and from `COMMERCIAL_FEED_IDS`.
6. Add six News & Wires entries, each set to "available", with direction "email", because they receive deals by email today. These are organisation names only, with no personal email addresses:
   - `debtwire` Debtwire (ION)
   - `kanganews` KangaNews
   - `mni` MNI Market News
   - `prospectnews` Prospect News
   - `edi` Exchange Data International (EDI)
   - `ft` Financial Times
   - All six also go into `COMMERCIAL_FEED_IDS`, so they stay "Not connected" and never look like real feeds.
7. Add `direction?: 'push' | 'pull' | 'email'` to `VendorAPI`.
   - Add the helpers `PUSH_CONNECTOR_IDS = ['directbooks','ipreo','clearstream','symphony','cusip','xs-isin']` and `EMAIL_CONNECTOR_IDS = ['debtwire','kanganews','mni','prospectnews','edi','ft']`, plus a function `connectorDirection(v)`.
   - The function returns the saved `direction` if there is one. Otherwise it returns "push" for ids in the push list, "email" for ids in the email list, and "pull" for everything else.
   - New custom entries default to "pull".

## Saved catalogue changes in the browser (`loadCatalogue`)
Built-in ids stay the same, so a user's own edits still apply. Saved changes are cleaned up once, each time they are loaded (no version number is needed):
- Drop any saved entry or deletion for `primarynexus`.
- Drop any saved entry for a renamed id (`dealologic`, `ipreo`, `anna`, `dtcc`, `clearstream`) if its fields exactly match the old built-in default. A user who edited the row keeps their edit.
- Accept an optional `direction` field when it is "push", "pull" or "email". Older entries without it get the default.
- No backend change is needed.

## UI
- `src/pages/BondConsolePage.tsx`: add a small Push, Pull or Email badge, styled with theme colours, next to each connector name in the External API/MCP Connectors groups.
- `src/components/ConsoleEntryEditor.tsx`: add a Push / Pull / Email selector, defaulting to Pull.

## Reference document (reference/dts-external-distribution-connectors.md)
- Fix the TMCnet link to `https://www.tmcnet.com/usubmit/2026/06/08/10395764.htm`.
- Change the PrimaryNexus row in section 5 and item 5 of section 8 to say: "Placeholder; removed from the catalogue."
- Update `reference/deal-checker-capabilities.md`? Not needed, because the Deal Checker is not affected.

## Tests
- `src/test/bondConsoleVendors.test.ts`:
  - Check the new names and descriptions.
  - Check that `primarynexus` is absent from both lists.
  - Check that the six news entries exist and are commercial.
  - Check that `connectorDirection` returns push for exactly the six push ids (including `xs-isin`), email for the six news ids, and pull for the rest.
  - Keep the existing check that `ipreo` is not commercial.
- `src/test/vendorManagement.test.ts`:
  - Saved `primarynexus` overrides and deletions are dropped.
  - An unchanged old default for `dealologic` is dropped, so the new name shows.
  - An edited `dealologic` row is kept.
  - A saved `direction` value of push, pull or email is kept when loaded, and an invalid value is rejected.

## Later: per-connector settings (section 7, not built now)
Add an optional `settings?: ConnectorSettings` to `VendorAPI`. It would hold:
- channel type
- endpoint
- an auth *reference* (the secret's name only, never the value)
- environment (UAT/prod)
- message types
- schema profile and gap log
- licence reference
- fallback rule
- recipient type

These would most likely be stored in the backend per organisation, not in browser storage, because they include credentials references.
