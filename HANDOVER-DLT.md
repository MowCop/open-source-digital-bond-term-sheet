# VDR draft 4: DLT view — handover

## What this adds
A **DLT view** tab beside **BDT XML**. The conventional term sheet stays the master record; the DLT view converts it on demand into:

1. **BDT 2.0 XML with the `DLTPlatform` group populated**: validates against `schema/icma-bond-data-taxonomy.xsd`.
2. **A token descriptor (JSON)**: supply, eligibility claims, coupon schedule, settlement. A mapping aid, not deployable code.

The bank chooses the model **per deal**: `native` (the token is the security) or `twin` (the ICSD global note stays the legal security; the ledger mirrors it).

## Files
| Path | What |
|---|---|
| `src/lib/termsheet/dlt.js` | New. All DLT logic. Pure ES module. |
| `verify-dlt.mjs` | New. Regression test. |
| `reference/dlt-reference-native.xml`, `reference/dlt-reference-twin.xml`, `reference/token-reference.json` | Expected outputs from the published draft 4 page. |
| `public/vdr-digital-term-sheet-reference.html` | Replaces the old reference page with draft 4. |

No existing file in `src/lib/termsheet/` changes.

## Invariants (do not break)
1. **Do not edit `bdt-xml.js`, `order.js` or `fields.js` for this feature.** `dlt.js` copies the conventional tree and edits the copy.
2. **The DLT view never changes the conventional record.** It reads `state`, writes only `state.dlt`.
3. **`PlatformIdentifier` keeps schema order** (MIC, LEI, DTI, BlockChainAddress). That node is marked `keep` so sorting skips it; `ORDER["Identifier"]` would put DTI first and break validation.
4. **Token unit = integral multiple** when one is set (one token per tradable increment); minimum holding = denomination ÷ unit.
5. **Native model removes** global note, safekeeping structure and place of deposit; it keeps ICSD clearing only when an ICSD link is set.
6. **Twin model sets `DLTBondIndicator` to false**: the legal security is still conventional.
7. **Readiness checks are advisory**: they never block a conventional release.
8. `node verify.mjs` and `node verify-dlt.mjs` must both pass.

## State
`state.dlt` (created by `dltDefault()` if missing; persist it with the deal record):
`model` (`""` | `"native"` | `"twin"`), `include` (send with releases), `roles[]`, `name`, `type`, `access`, `operator`, `operatorLei`, `decentralised`, `registrar`, `mic`, `dti`, `chainAddress`, `contractName`, `contractAddress`, `standard`, `symbol`, `fee`, `cash`, `cycle`, `record`, `bridge`, `platformLaw`, `fallback`.

## API (`import … from "src/lib/termsheet/dlt.js"`)
- `DLT_FIELDS`, `DLT_ROLES`, `DLT_E`: the form definition: sections, labels, input types, options, ICMA guide question numbers, hints.
- `buildDLTXML(state)`, `buildToken(state)`, `dltChecks(state)`, `dltDiffRows(state)`, `couponSchedule(state)`
- `withDltView(buildEnvelope(state), state)`: use wherever the envelope is built for release.
- `dltExample()`: assign to `state.dlt` when the worked example is loaded.

## Prompt for Lovable
Paste this after the files are pushed and the Knowledge note is updated:

> Add a "DLT view" tab to the Digital Term Sheet, placed immediately after the "BDT XML" tab. Use only `src/lib/termsheet/dlt.js` for logic; do not modify any other file in `src/lib/termsheet/`, and read `HANDOVER-DLT.md` first.
>
> Layout, matching `public/vdr-digital-term-sheet-reference.html` (open its DLT view tab after loading the worked example):
> 1. A heading and one-paragraph explanation.
> 2. Two large selectable cards: "DLT-native bond" and "Digital twin". Selecting one sets `state.dlt.model`. Until one is chosen, show only an empty state asking the user to choose.
> 3. Left column: four checkboxes from `DLT_ROLES` (`state.dlt.roles`), then the three sections from `DLT_FIELDS`. Each row shows the question number (e.g. "Q5a"), label, input and hint. Options for selects come from `DLT_E`.
> 4. Right column (sticky on desktop): readiness list from `dltChecks(state)` with a progress bar; a "What changes from the conventional record" table from `dltDiffRows(state)`; a checkbox "Send the DLT view with each release, alongside the standard term sheet" bound to `state.dlt.include`.
> 5. Below, two panels side by side (stacked on mobile): "BDT 2.0 XML with DLT group" showing `buildDLTXML(state)` and "Token descriptor" showing `JSON.stringify(buildToken(state), null, 2)`, each with Download and Copy buttons. Filenames: `<DocumentId>.dlt.xml` and `<DocumentId>.token.json`.
> 6. Hide the section navigation and the stage readiness column while this tab is open, so the page uses the full width.
>
> Also: persist `state.dlt` with the deal record; when the worked example loads, set `state.dlt = dltExample()`; wherever the release envelope is built, wrap it with `withDltView(envelope, state)`.
>
> Before writing any interface code, list the files you intend to create or change and confirm that no file in `src/lib/termsheet/` other than adding imports is touched. Then run `node verify.mjs` and `node verify-dlt.mjs` and report the results.
