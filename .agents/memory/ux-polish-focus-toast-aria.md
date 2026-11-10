---
name: UX Polish — focus-visible, toast.success, aria-label, whitespace-nowrap
description: Systematic micro-polish applied across all konstruksi-riset pages covering focus rings, toast feedback, accessibility labels, date formatting, status coloring, aria-live, and SelectTrigger aria-labels.
---

## Coverage (applied to ALL pages)

### focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none
Added to every interactive element that lacked it:
- All filter/sort/reset/clear buttons across all pages
- Clear search X buttons (absolute-positioned inside inputs)
- Empty-state reset/reload CTAs
- Export buttons, copy buttons (with focus-visible:opacity-100 too)
- Delete trigger + confirm buttons (red ring variant: ring-red-400)
- Module (ebt/pertambangan/lingkungan/iso-k3) filter + reset + copy buttons
- inspirasi.tsx urgency filter + view toggle buttons (with aria-pressed)
- surat-penawaran.tsx AMBIL DATA and LIHAT DETAIL buttons

### toast.success(...)
All positive user actions converted from bare `toast(...)`:
- Copy handlers → toast.success("... disalin")
- Save/pin/star/read toggles → toast.success(...)
- Status updates → toast.success(...)
- Exception: data-collector.tsx uses useToast hook (not sonner), keep toast({ title })

### aria-label on icon-only and confirm-delete buttons
- All trash/delete trigger buttons: aria-label="Hapus {item}"
- All confirm "✓ Yakin hapus?" buttons: aria-label="Konfirmasi hapus {item}"
- All copy buttons: aria-label="Salin {field}"
- All clear-search X buttons: aria-label="Hapus pencarian"
- Archive/action toggle buttons with dynamic title: aria-label matching title

### aria-label on SelectTrigger (filter bars + dialogs)
Added to ALL SelectTrigger elements:
- Filter bars: regulasi (domain/status/dampak/kategori), knowledge-registry (kelompok/level/domain), ai-rekomendasi (status/prioritas), modul-ebt/pertambangan/lingkungan (filter bars)
- Create dialogs: pain-points (domain/segmen/prioritas), strategi-marketing (tipe strategi), skk (ketersediaan), modul-ebt/pertambangan/lingkungan (all dialog triggers)

### aria-live="polite" aria-atomic="true" on dynamic counts
Added to result-count spans across all pages:
- contractors, skk, tenders, research, pain-points, workroom, regulasi, kompetitor, knowledge-registry, sinyal-pasar, inspirasi, perumusan-masalah

### whitespace-nowrap on date cells
- All hover-revealed date spans across all pages
- All visible date spans showing toLocaleDateString output

### title= on truncated text
- All elements with className containing "truncate" verified to have title= on same element
- kompetitor.tsx: competitor pricing item name (truncate max-w-xs → +title)
- output-produk.tsx: formatCostRange span (+truncate +title)
- data-collector.tsx: source.category span (+title)
- strategi-marketing.tsx: channel tag spans (+title)

### Status coloring (card-level)
- output-produk.tsx: ARCHIVED cards opacity-60 + grayscale-[30%] + border-dashed for DRAFT; grid + list views
- data-collector.tsx: pinned source cards get border-amber-300 bg-amber-50/40
- knowledge-registry.tsx AssetCard: pinned → border-amber-300 bg-amber-50/30; reviewed → bg-emerald-50/20

### hover:shadow + cursor + transition-all
- output-produk.tsx grid cards: hover:shadow-md + transition-all
- workroom.tsx ProspekTab contractor cards: cursor-pointer
- regulasi.tsx compliance matrix tr rows: hover:shadow-sm transition-all (replace_all)
- laporan-intelijen.tsx: VOC card transition-all; heatmap rows hover:shadow-sm transition-all
- ai-rekomendasi.tsx: recommendation TableRow hover:shadow-sm transition-all

### Empty states
- ai-rekomendasi.tsx: filtered empty state added Search icon + h-32
- data-collector.tsx: pinned tab empty state (Star icon + hint text when size===0)

### Placeholder improvements (example values)
- contractors.tsx: registrationNumber → "Cth: 0-9975-08-012-1-12-123456"
- skk.tsx: skkNumber → "Cth: 211.2.1.2.0000001"; currentEmployer → "Cth: PT. Wijaya Karya"
- workroom.tsx: serviceName → concrete example; risks → concrete example

### Baru badge consistency
- knowledge-registry.tsx: px-1.5 → px-1 to match all other pages

### data-collector.tsx monitoring table
- hover:bg-muted/40 (was /20); numeric cells +font-mono

### font-mono additions
- modul-ebt.tsx: MW capacity values

## Why
Systematic UX polish rounds 341–368 to bring ALL interactive elements to the same keyboard/visual accessibility standard across the platform.
