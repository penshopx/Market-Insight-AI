---
name: Boolean key warning source
description: React "same key, true/false" warning on dashboard — exhaustively investigated, no static source found.
---

## Rule
Do not spend more time hunting this statically. The source is dynamic (API data at runtime).

## What was investigated
- Every `.map()` key in dashboard.tsx (4727 lines) — all string or number keys.
- `RunStatusSummary`, `SchedulerStatusCard`, `BriefingDeliveryCard` — no array maps with boolean keys.
- `knowledge-sources-bar.tsx`, `FloatingChatbot.tsx` — all keys are strings.
- `chart.tsx:295 key={item.value}` and `:194 key={item.dataKey}` — Recharts legend/tooltip; `item.value` could be boolean if chart data uses boolean dataKeys, but no such charts found on dashboard.
- Explore subagent confirmed: no boolean-valued key expressions anywhere in the full `src/` tree.

## Timing pattern
- Fires every ~10s matching `refetchInterval: 10000` for `useGetSchedulerStatus`.
- Fires in pairs: key=true AND key=false simultaneously in the same render.
- Appeared after task #43 merge (high-failure sources filter), but no boolean key visible in that diff.

**Why:** Source is likely in a third-party component (Recharts legend payload `item.value`) or from runtime API data shape not visible statically.

**How to apply:** If this resurfaces, add a temporary `console.trace` inside `React.createElement` or use React DevTools Profiler to catch the component on re-render. Do not repeat static grep analysis.
