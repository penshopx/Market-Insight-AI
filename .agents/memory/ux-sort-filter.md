---
name: UX polish — sort indicators and filter completeness
description: Patterns enforced across all konstruksi-riset pages for sort buttons and reset filter visibility.
---

## Sort direction rule
Every sort button must show the direction arrow (↑/↓) in BOTH the active AND inactive state.
Pattern: `{sortVar ? "↓ Label" : "↑ Label"}` — never a bare label without arrow in either branch.

**Why:** Inactive label without arrow gave no clue what direction clicking would produce.

**How to apply:** When adding a new sort button, always include the arrow in both ternary branches.

## Reset filter visibility rule
The visibility condition for any "Reset filter" button must include ALL filter state variables for that page — including toggles like `showOnlyWithNotes`, `showVocWithNotesOnly`, `showProblematicOnly`, `filterByHighFailure`, and search strings like `productSearch`.

**Why:** Partial conditions mean the button disappears when only one filter type is active (e.g. only a toggle), leaving no way to clear it from the filter bar.

**How to apply:** When adding a new filter state var, add it to the reset button's visibility condition AND its onClick handler.

## Sticky table headers
Main data tables in contractors, skk, tenders, research now have:
`<TableRow className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">`

**Why:** Long tables were unusable without knowing column context while scrolled.

## autoFocus on create dialog first Input
Every Dialog that opens a create form must have `autoFocus` on its first `<Input>`.
Pages covered: pain-points, contractors, skk, tenders, research, strategi-marketing, output-produk, ai-rekomendasi, modul-ebt (both dialogs), modul-pertambangan, modul-lingkungan.

## Export Excel count condition
Export button label shows `(N)` only when a filter is active. Condition must include ALL filter dimensions, not just search/bidang. skk.tsx includes jenjang/province/expiry/stars; contractors.tsx includes sbuLevel/expiry/starred/notes.
