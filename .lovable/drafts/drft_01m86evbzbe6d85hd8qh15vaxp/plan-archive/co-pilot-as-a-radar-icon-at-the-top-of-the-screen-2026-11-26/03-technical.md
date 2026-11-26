## Technical details
- New `CopilotLauncher` (lucide `Radar` icon + focus label) toggling a popover holding the existing `DealCopilot` / `CopilotGeneral` input; reuse `CopilotDraftDialog` for expansion.
- `AppLayout` top bar: replace inline `copilot-slot` / `CopilotGeneral` with the launcher; focus label from route or `useCopilotFocus`.
- `DealPhaseWorkspace`: remove set-up drawer button; mount launcher in the deal header (portal like the drop bar), keyed by deal ID, all phases.
- `DealCopilot`: remove the pass/warn/fail squares (lines ~455-458).
- Update AGENTS.md Co-Pilot placement rule; Playwright check on menu page and expanded deal in set-up and execution.
