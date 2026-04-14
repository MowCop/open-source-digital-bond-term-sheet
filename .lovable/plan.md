

## Revised Plan: ICMA-Aligned Deal Data with Bookrunner Roles & Multi-Deal Messages

This builds on the previously approved plan by adding a structured **Bookrunner** model to the ICMA taxonomy fields. The existing `leadManagers: string[]` field is replaced with a typed `bookrunners` array that captures role distinctions (active/passive, global coordinator status).

### Bookrunner data model

A new `Bookrunner` interface:

```text
interface Bookrunner {
  name: string;            // Bank name
  role: 'active' | 'passive';
  isGlobalCoordinator: boolean;
}
```

On the `Deal` interface, `leadManagers: string[]` is replaced by `bookrunners: Bookrunner[]`. This counts as **one field** toward the 35-field cap (replacing the existing `leadManagers` slot). The full 35 fields remain: Party (5), Issuance (16), Product (14) — with `bookrunners` sitting in the Party group alongside `issuerName`, `issuerLEI`, `issuerRating`, and `ratingOutlook`.

### Changes across files

1. **`src/types/bond.ts`**
   - Add `Bookrunner` interface
   - Add all ICMA taxonomy enums (`IssuanceType`, `FormOfNote`, `InterestType`, `DayCountFraction`, `BusinessDayConvention`, `GoverningLaw`, `StatusOfNote`)
   - Expand `Deal` with 35 ICMA fields; replace `leadManagers` with `bookrunners: Bookrunner[]`
   - Change `Message.dealId: string` → `dealIds: string[]`

2. **`src/data/mockData.ts`**
   - Update mock deals with ICMA fields and realistic bookrunner arrays (e.g., active + passive banks, one marked as global coordinator)
   - Update mock messages to use `dealIds: [...]`, including one multi-deal example

3. **`src/pages/DealsPage.tsx`**
   - Replace `leadManagers` display with bookrunner list showing role badges (Active/Passive/GC)
   - Add grouped detail sections (Party, Issuance, Product)
   - Update "New Deal" dialog to allow adding bookrunners with role selection

4. **`src/context/AppContext.tsx`**
   - Update `createDeal` signature for new `Deal` shape
   - Update `sendMessageAction` to iterate over `dealIds`

5. **`src/pages/MessagesPage.tsx`**
   - Update all `message.dealId` references to `message.dealIds`
   - Show multiple deal badges per message card

6. **`src/pages/AIDraftPage.tsx`**
   - Update AI extraction to populate bookrunner roles and expanded ICMA fields

### Bookrunner display example

```text
Bookrunners:
  ● JPMorgan        [Active] [Global Coordinator]
  ● Barclays        [Active]
  ● Deutsche Bank   [Passive]
```

