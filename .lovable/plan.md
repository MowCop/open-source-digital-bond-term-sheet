

## Why Bookrunners Aren't Captured

In `AIDraftPage.tsx`, the `simulateAIExtraction` function only extracts 8 fields (Issuer, Currency, Size, Tenor, Spread, Rating, ISIN, LEI). **Bookrunners are never parsed**, even though phrases like *"has appointed BNP Paribas, Deutsche Bank, NatWest and Rabobank as joint lead managers"* clearly state them.

Then `createDealFromFields()` always passes `bookrunners: []`, so the column in Master Deal Alerts stays blank.

### Fix (2 small changes)

**1. `src/pages/AIDraftPage.tsx` — Extract bookrunners from text**

Add a regex pass to detect bank names following appointment cues:
- Trigger phrases: *"appointed"*, *"mandated"*, *"joint lead managers"*, *"bookrunners"*, *"global coordinators"*
- Capture the comma/`and`-separated list of bank names that follow
- Identify role: *"global coordinator"* → `isGlobalCoordinator: true`; *"passive"* → `role: 'passive'`; default → `role: 'active'`
- Maintain a known-bank dictionary (BNP Paribas, Deutsche Bank, JPMorgan, Goldman Sachs, Citi, HSBC, Barclays, NatWest, Rabobank, Morgan Stanley, BofA, UBS, Credit Agricole, Société Générale, etc.) to improve precision

Display detected bookrunners in the AI Field Extraction panel as chips.

**2. `src/pages/AIDraftPage.tsx` — Pass them into the deal**

Update `createDealFromFields()`:
```
bookrunners: aiBookrunners ?? []
```

### Result

Typing the EUROFIMA-style alert auto-detects *BNP Paribas, Deutsche Bank, NatWest, Rabobank* → they appear in the AI panel → on Save/Send the deal is created with those bookrunners → the Bookrunners column in Master Deal Alerts populates correctly.

No changes needed in `MessagesPage.tsx` (it already reads `deal.bookrunners`).

