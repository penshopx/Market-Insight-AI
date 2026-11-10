---
name: Landing page positioning — Intel Konstruksi
description: Brand positioning decisions and new sections added to the landing page based on ChatGPT strategic conversation.
---

## Positioning shift applied
- Old headline: "Pasar Konstruksi Sudah Terbaca."
- New headline: "Tim Intel Digital Untuk Bisnis Anda."
- New subhead: "Setiap perusahaan konstruksi Indonesia layak memiliki tim intelijen digital..."
- Footer tagline: "Tim Intel Digital untuk perusahaan konstruksi Indonesia — mengubah data menjadi intelijen, dan intelijen menjadi keputusan."

**Why:** ChatGPT analysis said to sell the *result* (Tim Intel Digital), not the technology (AI/data platform). Bloomberg-style "langganan intel" framing.

## Pricing section (id="harga")
Three tiers added before the CTA section:
- **Intel Konstruksi** — Rp 499rb/bln — 6 core features, 3 users
- **Intel Bisnis Pro** — Rp 1.5jt/bln — full platform + Business Health Score + modules, 10 users (highlighted "Paling Populer")
- **Intel Enterprise** — Kustom — API, ERP integration, unlimited users

Nav now includes "Harga" link pointing to `#harga`.

## Business Health Score teaser section
Added visual mockup showing the "viral" concept from ChatGPT:
- Circular SVG gauge showing 82/100
- 8 dimension grid (Pasar & Tender, Retensi Klien, Data Intelligence, etc.)
- "Aksi Hari Ini" panel with color-coded action items (URGENT/PELUANG/INTEL)
- Positioned before pricing section

## Business Health Index — dashboard
Already existed at dashboard.tsx line ~1748 as "MJP Business Health Index" widget with static data. No changes needed there.

## Nav logo size
- Before: `Radar w-5 h-5`, `font-bold text-base`
- After: `Radar w-6 h-6`, `font-bold text-xl`
- Same change applied in footer: `w-6 h-6`, `text-lg`
