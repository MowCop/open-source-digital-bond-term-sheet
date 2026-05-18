## Problem

The label "EU MiFID II and UK MiFIR Target Market / PRIIPS" wraps to two lines in the PDF, with the value ("Eligible counterparties...") starting alongside the first label line. In the current output:

- The first line is rendered as a paragraph **outside** any table ("EU MiFID II and UK MiFIR Target Eligible counterparties and professional clients only...").
- A second small table contains only `Market / PRIIPS` | `No EU PRIIPs...`.

## Root cause

In `src/lib/pdfToHtml.ts`, `looksLikeKV()` requires the label text to be either ≤ 60 chars ending in `:` OR ≤ 6 whitespace-separated words.

The seed line label "EU MiFID II and UK MiFIR Target" is **7 words** and does not end with `:`, so `looksLikeKV` returns false. The line is therefore treated as a normal paragraph, its value half gets merged into the paragraph, and the wrapped label "Market / PRIIPS" on the next line becomes the start of a separate KV table.

## Fix (single file: `src/lib/pdfToHtml.ts`)

Relax the `looksLikeKV` label heuristic so realistic financial-term-sheet labels (which often run 7–10 words) are detected:

1. Accept a label of up to **10 words** (was 6) and up to **80 chars** (was 60), provided the internal gap is large (≥ 25–30 pt).
2. As a stronger signal, also accept any line where the largest internal gap is **≥ 40 pt** and the left text is ≤ 80 chars, regardless of word count — a 40-pt gap is unambiguous two-column layout.
3. Keep all existing guards (must have a non-empty left and right text; gap must split the line into clear left/right groups).

This will let the "EU MiFID II and UK MiFIR Target" line seed the KV block; the existing label-continuation logic (added previously) will then merge "Market / PRIIPS" into the same label cell, and value-column continuations ("No EU PRIIPs...", "as the securities...", "EEA or the United Kingdom") will fold into the same value cell.

## Validation

Re-upload the Aldar PDF and confirm:
- A single bordered row appears with label `EU MiFID II and UK MiFIR Target Market / PRIIPS` and the full value text in one cell.
- No orphan paragraph above the row.
- Other rows (Issuer, Coupon, Interest, Structuring Advisor & Global Coordinator (B&D), etc.) still render correctly.
- No regression on the Slovak Republic PDF.