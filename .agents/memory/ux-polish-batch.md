---
name: UX polish batch — char counters, a11y, empty-state CTAs
description: Patterns and decisions from the systematic UX micro-improvement passes on konstruksi-riset pages.
---

## Character counters on textareas
- Only add counters on **controlled** textareas (those with `value=` + `onChange=`).
- Uncontrolled textareas must first be wired into existing `createValues` state before a counter can be shown.
- Counter format: `{value.length} / {maxLength}` in `text-[10px] font-mono text-muted-foreground text-right`.
- For data-collector.tsx per-source notes: counter is **conditional** — only render when length > 0 to avoid cluttering every card.
- For workroom note textareas (maxLength 1000): same conditional pattern (`state.note.length > 0`).
- When a textarea has both a validation error and a counter, use a flex row: error on left, counter on right; use `<span />` as spacer when no error is active.

## Module dialog controlled-open pattern
- `AddProyekDialog`, `AddTenderDialog`, `AddMiningDialog`, `AddEnvDialog` all use internal `useState(false)` for `open`.
- To allow an empty-state CTA to open them: add optional `open?: boolean` + `onOpenChange?: (v: boolean) => void` props; fall back to internal state when props are absent.
- Page adds `isAddXxxOpen` state, passes to header dialog + empty-state CTA button.

## Empty-state true-vs-filtered distinction
- Before showing a "Tambah" CTA in an empty state, distinguish `rawData.length === 0` (true empty) from `filtered.length === 0` (filter mismatch).
- True empty: show icon + descriptive text + CTA button (`setIsAddOpen(true)`).
- Filter empty: show icon + "Tidak ada yang cocok dengan filter" + reset link.

## div-as-button conversions
- All interactive `<div onClick>` / `<span onClick>` that are not anchors must become `<button type="button">`.
- Add `w-full text-left` to preserve layout when converting block-level divs.
- Remember to update the **closing tag** (`</div>` → `</button>`) — the TSC error "Expected corresponding JSX closing tag for 'button'" is the symptom of a missed closing tag.

## Custom overlay dialog semantics
- Plain `fixed inset-0` overlay divs need: `role="dialog"` + `aria-modal="true"` + `aria-label="..."` on the outer backdrop div.
- Add `onKeyDown={(e) => { if (e.key === "Escape") close(); }}` on the same div for keyboard dismiss.
- The inner content panel keeps `onClick={(e) => e.stopPropagation()}` to prevent backdrop click propagation.

## title= on truncated cells
- Any element with `truncate` or `line-clamp-*` on dynamic data needs `title={value}`.
- For city+province composite: `title={[city, province].filter(Boolean).join(", ")}`.
- Static labels (e.g. "BUKA URL") do not need title — only dynamic data values.

**Why:** These decisions emerged from systematic scanning passes and took multiple turns to standardize. Future passes should grep for `truncate` / `line-clamp` without `title=` to find remaining gaps.
