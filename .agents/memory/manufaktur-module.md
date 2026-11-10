---
name: Manufaktur module
description: Industry tab added to Data Riset page for manufacturing training/certification opportunities
---

## What was built
- `artifacts/konstruksi-riset/src/components/manufaktur-section.tsx` — standalone component with 8 category cards, stats, heatmap, add form, filterable table
- `artifacts/konstruksi-riset/src/pages/research.tsx` — added industry tab switcher (🏗️ Konstruksi / 🏭 Manufaktur); MFG_ items excluded from konstruksi filteredItems

## Category IDs (MFG_ prefix)
MFG_ISO, MFG_K3, MFG_MANAJEMEN, MFG_KEUANGAN, MFG_BNSP, MFG_IOT_AI, MFG_PERPAJAKAN, MFG_HRD

## Key design decisions
- No DB schema change needed — `category` column is free text; MFG_ prefix distinguishes manufaktur items from konstruksi items
- ManufakturSection accepts `allItems` prop from parent (avoids duplicate API call)
- Construksi filteredItems and categories dropdown now exclude MFG_ items

**Why:** Reusing existing research_items table avoids migration and keeps the API surface identical. Prefix convention (`MFG_`) is the separator between the two industry domains.

**How to apply:** Any future industry domain can follow the same pattern — pick a unique prefix, create a section component, add a tab.
