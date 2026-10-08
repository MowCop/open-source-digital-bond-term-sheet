# AGENTS
- Digital Term Sheet Fill fields come from the vendored `FIELDS` dictionary and are selected by path through `src/lib/bdt-bridge.ts` — this keeps one definition per field.
- The expanded-deal Deal Checker renders `unifiedChecks` above the term-sheet tabs — this keeps BDT and VDR rules in one visible validation surface.
- LEI checks are hybrid: the offline MOD 97-10 test is the instant baseline; live GLEIF registry lookups run through the gleif-lookup edge function and are appended to the same Deal Checker list — typing never waits on the network and an outage only downgrades to a warning.
