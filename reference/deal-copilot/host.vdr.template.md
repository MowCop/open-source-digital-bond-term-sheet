# Virtual Deal Room host template (fill in inside the VDR project)

Implement `DealHost` from `src/lib/copilot/host.ts` against VDR data:

| Method | VDR source to use | Required permission |
| --- | --- | --- |
| readDeal | the deal's current term sheet (map to issuer, currency, size, coupon, maturity, isin, governingLaw, sourceText) | user is a member of the deal |
| listDocuments | completed agent reviews for that deal's data-room documents | user may view those documents |
| proposeChange | VDR change-request / pending-edit record, status pending | any deal member (agent acts as the user) |
| decideChange | VDR's own approval action, atomic with a stale-value check | deal role allowed to edit terms (e.g. lead manager / deal admin) |

Rules that must hold after the move:
- The agent and its automatic reviews may check, flag risks and propose; they never call decideChange.
- Only a person with term-edit rights approves; stale original values are rejected.
- Authorization is enforced on the server, never trusted from the browser.
