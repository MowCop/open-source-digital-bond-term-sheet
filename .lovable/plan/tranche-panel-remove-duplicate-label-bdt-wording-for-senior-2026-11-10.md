# Tranche panel: remove duplicate label, BDT wording for "Senior unsecured"

## Answers
- **Is "Senior unsecured" BDT compliant?** Not as a single value. BDT 2.0 has no field called "Senior unsecured". It records a bond's ranking under **Status of the Notes** (`StatusOfNote`) as separate fields: Seniority = SENIOR, Subordination = UNSUBORDINATED, Security = UNSECURED (and Preference for preferred/non-preferred bank debt).
- **Why is it repeated under Seniority/Subordination?** The "Senior unsecured" dropdown is a shortcut. Picking it fills in those BDT fields for you, so the same information shows twice: the shortcut, then the real BDT fields it fills.
- **BDT-compliant label:** "Status of the Notes".

## Changes
1. Delete the small "Tranche A" text beside the dropdown. The title and the table row already show it.
2. Put the label **Status of the Notes** in front of the dropdown and keep its plain-English options (Senior unsecured, Senior preferred, Tier 2, AT1, Covered...). A short hint reads "Sets Seniority, Subordination and Security below".
3. Seniority, Subordination and Security stay in the panel as the saved BDT values. The shortcut itself is not exported.

## Technical details
- `src/components/termsheet/TranchePanel.tsx`: remove the `Tranche {label}` span; add a "Status of the Notes" label and hint around the existing Select. No change to `SENIORITY_PRESET` or saved data.
