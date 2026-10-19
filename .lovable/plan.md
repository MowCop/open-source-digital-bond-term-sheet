# Add an info icon next to "Deal Co-Pilot"

## What you'll see
A small "i" icon right after the **Deal Co-Pilot** title in each deal. Hovering it (or focusing it with the keyboard) shows a short explanation:

> **Deal Co-Pilot** reviews this deal's saved term sheet and uploaded documents, answers questions, and proposes evidenced corrections. Only people with term-edit rights can approve changes, and nothing is sent externally.
>
> It works with four specialists. Ask by name in the chat:
> - **Compliance & Regulatory**: "Run a compliance review"
> - **Pricing & Benchmark**: "Check the pricing and settlement date"
> - **ESG & Sustainable Finance**: "Review the ESG disclosures"
> - **Syndicate Communications**: "Draft the investor bulletin" (drafts are never sent)
>
> Say "Run the full specialist panel" to get all four at once. They also run automatically when you save terms or upload a document.

Hovering the icon won't open or close the panel.

## Technical details
- File: `src/components/DealCopilot.tsx` only.
- Use the existing shadcn `Tooltip` with lucide `Info` inside the collapsible trigger. Call `stopPropagation` on click so the panel doesn't toggle, and give the icon `aria-label="About Deal Co-Pilot"`.
- Use semantic tokens only, with a max width of about 360px.
