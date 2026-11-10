---
name: UX polish progress
description: Running log of what has been done in the ongoing UX polish sprint for konstruksi-riset pages.
---

## Completed in this sprint

### Toast confirmations
- All create/delete/update mutations now show sonner toasts across: pain-points, research, contractors, tenders, skk, strategi-marketing, output-produk, modul-ebt, modul-lingkungan, modul-pertambangan, knowledge-registry (pin/unpin), regulasi, sinyal-pasar (VOC)
- Star/unstar toasts: skk (toggleSkkStar), contractors (toggleStar), knowledge-registry (togglePin), research (toggleStar)
- Watchlist toggle toast: tenders (toggleWatch)
- Bulk-update summary toast: pain-points bulkUpdate now calls toast.success("N pain point status → X")
- Removed noisy update toast from pain-points (fires on every inline status click)

### Auto-save indicators
- regulasi.tsx: "✓ Tersimpan" inline indicator for regulasi notes (savedNoteId state + timer)
- sinyal-pasar.tsx: "✓ Tersimpan" for VOC notes (savedVocNoteId state + timer)

### Empty-state CTAs
- contractors: "BELUM ADA KONTRAKTOR" → + TAMBAH KONTRAKTOR button
- tenders: "BELUM ADA TENDER" → + TAMBAH TENDER button
- skk: "BELUM ADA TENAGA AHLI" → + TAMBAH TENAGA AHLI button
- pain-points: distinguishes backend-empty (shows CTA) from filter-empty
- research: distinguishes backend-empty (shows CTA) from filter-empty
- output-produk: "BELUM ADA PRODUK" → + TAMBAH PRODUK button
- strategi-marketing kanban: empty column dashed box is now clickable "+ TAMBAH"

### Filtered subtitle counts
- skk: "X dari Y tenaga ahli" (client-side filters) / "X hasil pencarian" (API-level)
- pain-points: "X dari Y masalah" when domainFilter/priorityFilter/agentFilter/showOnlyWithNotes active
- contractors: "X dari Y perusahaan" (includes expiryFilter)

### Clickable filter badges
- contractors: SBU expiry stat cards (≤30, ≤90, expired) now clickable to filter — expiryFilter state
- dashboard StatCards: all 6 now have href props linking to relevant pages

### Keyboard shortcuts
- "/" to focus search input: tenders, contractors, research, pain-points, skk, output-produk, knowledge-registry, sinyal-pasar VOC, modul-iso-k3
- All already had "n" for create dialog

### Delete confirmations
- Replaced window.confirm with inline two-click "× Hapus" → "✓ Yakin hapus?" pattern (pendingDeleteId state) in: contractors, tenders, skk, output-produk, research
- strategi-marketing archive: pendingArchiveId two-click pattern

## Still to check / pending
- pain-points CPKBCard delete still uses window.confirm (line ~437) — needs pendingDeleteId in CPKBCard component
- workroom.tsx canvas reset uses window.confirm (~1918)
- blur-fires-before-click risk in research/output-produk inline confirm buttons
