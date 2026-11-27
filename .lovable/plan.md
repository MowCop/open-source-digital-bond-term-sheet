# Move Documents to the first tab

Move the Documents tab so it sits first in the Deal Terms tab row, before Deal term sheets:

Documents · Deal term sheets · Standard text · XML · DLT · All fields

Deal term sheets stays the tab that opens by default. Documents keeps the same content.

## Technical details
- src/pages/DealsPage.tsx: move the `docs` TabsTrigger above `sheets` (line ~211 → 207). The order of the content panels and the default tab value stay the same.
