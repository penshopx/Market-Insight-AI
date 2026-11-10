---
name: regulasi.tsx parameter tag corruption
description: A stray <parameter name="old_string"> XML tag was injected into regulasi.tsx JSX from a failed edit, causing silent "Unterminated JSX contents" parse error at end-of-file masked by Vite's module cache.
---

## The rule
After ANY workflow restart that reveals "Unterminated JSX contents" at the last closing `</div>`, immediately run `grep -n "<parameter" src/pages/*.tsx` to check for injected tool-call XML corruption before debugging JSX structure.

**Why:** A `<parameter name="old_string">` tag was inserted literally into regulasi.tsx JSX at line 3436 (R106 panel area) during a previous edit operation. Babel parsed it as an unclosed JSX element, propagating the error to EOF. Vite's incremental compile cache masked it — the error only became visible when the workflow restarted and recompiled all files from scratch.

**How to apply:** When "Unterminated JSX contents" appears at the LAST `</div>` of a file (not at a mid-file location), suspect a stray XML tag or unmatched opener somewhere earlier. Use `grep -n "<parameter\|</parameter>"` across all pages first, then use Babel directly: `node --input-type=module -e "import {parse} from '.../@babel+parser.../lib/index.js'; import {readFileSync} from 'fs'; try { parse(readFileSync('file.tsx','utf8'), {sourceType:'module',plugins:['typescript','jsx']}); console.log('CLEAN') } catch(e) { console.log(e.loc?.line, e.message) }"`.

The fix: remove just the `<parameter name="old_string">` prefix from the corrupted line, keeping the rest of the JSX intact.

## Batch Babel verification
After any round of edits across multiple files, verify all pages at once:
```js
import { parse } from '.../node_modules/.pnpm/@babel+parser@7.29.7/node_modules/@babel/parser/lib/index.js';
import { readFileSync, readdirSync } from 'fs';
const dir = 'artifacts/konstruksi-riset/src/pages';
for (const f of readdirSync(dir).filter(f => f.endsWith('.tsx'))) {
  const src = readFileSync(`${dir}/${f}`, 'utf8');
  try { parse(src, { sourceType:'module', plugins:['typescript','jsx'] }); process.stdout.write(`✓ ${f}\n`); }
  catch(e) { process.stdout.write(`✗ ${f} — L${e.loc?.line}: ${e.message?.slice(0,60)}\n`); }
}
```
This runs faster than waiting for HMR and catches errors before workflow restart exposes them.
