# Contributing to NewIssueVault — Virtual Deal Room

Thank you for contributing. This project is open source in support of one goal: making new bond issues reach pricing with term-sheet data that every participant can trust. Contributions are welcome from participating banks, syndicate / DCM and legal professionals, and developers.

## Ground rules

- **ICMA Bond Data Taxonomy (BDT 2.0) is the underlying schema standard.** Every deal, term-sheet field, validation rule and interchange format must conform to the ICMA BDT 2.0 structure. If a change adds or alters fields, it must map them through the single field dictionary and bridge layer used by this codebase — one definition per field. Do not fork the schema locally.
- **Participating banks** contribute through their nominated engineering and syndicate contacts: workflow rules, validation checks, market conventions and integration connectors. Proposals that encode a firm's own practice should be framed as options, not defaults, unless the community agrees otherwise.
- **Developers** contribute code, tests, documentation and tooling. Domain questions should be raised in an issue before coding if the convention is not already established in the codebase.
- **Vendored standards files** (the bundled ICMA field/order definitions) are kept as-is. Raise an issue instead of editing them directly.
- Everything platform-affecting is auditable: changes must respect the platform's audit-logging duties (GDPR and financial compliance), role model (Master Admin, Syndicate Admin, Vendor User), and data-privacy boundaries. Never commit real client data, deal documents, or credentials.

## How to submit a pull request

1. Open an issue describing the change (or claiming an existing one) before significant work.
2. Fork the repository and create a feature branch from `main`.
3. Keep pull requests small and focused; one concern per PR.
4. Ensure the project builds cleanly and the verification scripts (`node verify.mjs`, `node verify-dlt.mjs`) pass before marking the PR ready.
5. PRs are submitted against `main`. A maintainer review is required for merge; changes to schema mappings, validation rules or role/permission logic need a second reviewer with domain (syndicate/DCM) sign-off.
6. Describe in the PR what behaviour changes, for whom, and any ICMA BDT 2.0 mapping affected.

## Code style

- TypeScript with strict typing; React 18 + Vite on the front end. Match the patterns already in the codebase.
- Semantic design tokens only — no hardcoded colour values in components.
- One definition per term-sheet field; the bridge layer is the only path between the dictionary and app state.
- Deterministic checks (validation, compliance rules) stay AI-free; AI features are additive, warnings-only, and never auto-apply suggestions without human approval.
- Write or update tests for behavioural rules you add, and keep the living reference docs (e.g. `reference/deal-checker-capabilities.md`) in the same change.
- Commit messages: short imperative subject line; explain the why in the body.

## Responsible vulnerability disclosure

Do not open public issues for security vulnerabilities.

- Email **security@eurobondmarkets.com** with a description, affected paths, reproduction steps and (if possible) a minimal proof of concept.
- We acknowledge reports within 5 business days and will keep you informed through remediation.
- Please allow a reasonable window (90 days) for a fix before any public disclosure, and do not test against the hosted portal at www.eurobondmarkets.com in ways that could affect live deal communications or other users' data.

## Licensing

By submitting a contribution, you agree that it is licensed under the Apache License, Version 2.0 (see [LICENSE](LICENSE)) and that you have the right to license it as such.
