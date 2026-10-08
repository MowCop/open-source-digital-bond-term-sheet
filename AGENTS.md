# AGENTS
- Digital Term Sheet Fill fields come from the vendored `FIELDS` dictionary and are selected by path through `src/lib/bdt-bridge.ts` — this keeps one definition per field.
- The expanded-deal Deal Checker renders `unifiedChecks` above the term-sheet tabs — this keeps BDT and VDR rules in one visible validation surface.
- LEI checks are hybrid: the offline MOD 97-10 test is the instant baseline; live GLEIF registry lookups run through the gleif-lookup edge function and are appended to the same Deal Checker list — typing never waits on the network and an outage only downgrades to a warning.
- LEI suggestions from GLEIF name search are shown for the user to pick and are never auto-applied — common names match several legal entities.
- FIGI checks mirror the LEI pattern: offline format/check-digit baseline plus live OpenFIGI lookup via the openfigi-lookup edge function, appended to unifiedChecks with src openfigi; FIGI suggestions are never auto-applied — one source of truth for identifier validation.
- Imperative handles are passed as a plain prop (ingestRef), never React.forwardRef — a default-exported function component that becomes a forwardRef object changes the fiber type and hot reloads blank the preview with "Component is not a function".
