## Technical details
- Remove every `FieldStatusSummary` usage (DealTermSheets, DealPhaseWorkspace header and Live DTS, TrancheSwitcher, TranchePanel, TermSheetFill) and the `statusFilter` state in TermSheetFill. The status metadata, the per-field marks and `externalState` filtering stay as they are.
- Add a small `InfoTip` component built on the shadcn Tooltip with a lucide `Info` icon, and use it for the muted help paragraphs in DealTermSheets and DealPhaseWorkspace.
- AppLayout: store the sidebar's open/closed state in localStorage. When closed, don't render the `<aside>` and show a fixed top-left `PanelLeftOpen` button. When open, show `PanelLeftClose` in the sidebar header.
