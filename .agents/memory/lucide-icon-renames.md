---
name: Lucide icon renames v0.545
description: lucide-react@0.545.0 renamed many icons; old names are invalid exports and crash at runtime with ReferenceError. Complete map and fix strategy.
---

## The Problem
lucide-react@0.545.0 is a very new release where many icons were renamed to a consistent "Shape+Description" or "Description+Shape" pattern. Using the OLD names in JSX causes `<OldName> is not defined` ReferenceError crashes at runtime (NOT TypeScript errors, because the .d.ts also changed).

## Valid detection
```python
import re
dts = open('.../lucide-react.d.ts').read()
VALID = set(re.findall(r'declare const ([A-Za-z][a-zA-Z0-9]*):', dts))
```
Note: single-char icons like `X` need `[A-Za-z]` (not `[A-Z][a-zA-Z0-9]+`) — the `+` requires 2+ chars.

## Complete rename map (old → new in v0.545)
| Old (invalid) | New (valid) |
|---|---|
| AlertTriangle | TriangleAlert |
| AlertCircle | CircleAlert |
| AlertOctagon | OctagonAlert |
| CheckCircle | CircleCheck |
| CheckCircle2 | CircleCheck (or CircleCheckBig) |
| CheckSquare | SquareCheckBig |
| XCircle | CircleX |
| BarChart2 | ChartColumnBig |
| BarChart3 | ChartBar |
| LineChart | ChartLine |
| PieChart | ChartPie |
| Loader2 | LoaderCircle |
| Filter | ListFilter |
| Grid3X3 | (invalid — use LayoutGrid or Grid3x3 which is valid too) |
| FileSignature | FilePen |
| ImageIcon | Image |
| Users2 | Users |
| PlayCircle | Play |
| Sliders | SlidersHorizontal |
| Layout | LayoutGrid |

## Fix strategy
1. Global sed/Python replacement across ALL tsx files (both imports AND JSX)
2. Order matters: replace `CheckCircle2` before `CheckCircle` to avoid partial matches
3. After replacement: re-run scanner to check for icons in JSX that are now missing from imports
4. Multi-pass scanner needed because some icons (like BarChart2→ChartColumnBig) get renamed but not added to the import block

## Scanner script pattern
```python
# Find JSX tags used but missing from import
used_jsx = set(re.findall(r'<([A-Z][a-zA-Z0-9]+)[\s/>]', content))
missing = [t for t in used_jsx if t in VALID and t not in imported and t not in NON_LUCIDE_SKIP]
```

## Why undefined variables also crash (ReferenceError)
Task-agent-added static panels reference variables like `assets`, `products`, `problems` that are never declared at component scope. Even with `?.` optional chaining, JavaScript throws ReferenceError for completely undeclared variables.
**Fix:** add `const varName: never[] = [];` AFTER the hook declarations in the main component function (not inside callbacks).

**Warning:** When injecting code after a multi-line hook call like:
```ts
const { data: foo } = useHook(
  arg1,   ← DO NOT INJECT HERE
  arg2
);
```
Always find the CLOSING `);` of the hook before injecting.
