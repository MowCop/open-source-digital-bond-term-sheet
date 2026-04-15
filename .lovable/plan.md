

## Why Your New Alert Is Invisible

The alert was saved successfully, but **it doesn't appear** because of how Master Deal Alerts groups messages. The `createMessage` call in `AIDraftPage.tsx` sets `dealIds: []` (empty array). In `MessagesPage.tsx`, the grouping logic looks up the first deal ID to find the associated deal object — when `dealIds` is empty, `deals.find(d => d.id === undefined)` returns nothing, and the group is silently skipped.

### Fix

Two changes:

1. **`src/pages/AIDraftPage.tsx`** — When saving/sending, auto-create a deal from AI-extracted fields (issuer name, currency, tenor) using `createDeal`, then attach the new deal's ID to the message's `dealIds`. If AI extraction didn't find enough data, create a placeholder deal using the headline as the issuer name.

2. **`src/pages/MessagesPage.tsx`** — Add a fallback section for "unlinked" alerts (messages with empty `dealIds`) so they still appear in the list, with borrower shown as "Unlinked" or derived from the subject line. This ensures no alert is ever invisible.

### Technical detail

In `AIDraftPage.tsx`, the `handleSave` and `handleSend` functions will be updated to:

```
const deal = createDeal({
  issuerName: aiFields?.['Issuer Name'] || headline.split(' ')[0] || 'New Deal',
  currency: aiFields?.['Currency'] || '',
  tenor: aiFields?.['Tenor'] || '',
  size: aiFields?.['Size'] || '',
  stage: 'Mandate',
  // ... minimal required fields
});
createMessage({ dealIds: [deal.id], ... });
```

In `MessagesPage.tsx`, messages with empty `dealIds` will be shown as a separate group with a synthetic borrower label extracted from the subject.

