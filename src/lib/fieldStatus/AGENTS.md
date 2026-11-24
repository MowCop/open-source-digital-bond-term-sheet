# Field certainty
- Keep per-path and per-tranche certainty in bdt_state.fieldMeta; inferred values remain suggestion metadata, never authoritative f values, so unconfirmed suggestions cannot leak into exports.
- Derive template field lists from trancheFields and the vendored BDT dictionary; Origin files are reference crosswalks, never a source of example deal values.
- Approval attribution and status audits are enforced by the database save trigger; keep existing stale checks and field edit guards.
