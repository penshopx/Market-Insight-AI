---
name: DB Package TypeScript Build
description: DB package uses composite TS project references — new schema files need explicit tsc emit before dependent packages see them.
---

When adding new schema files to `lib/db/src/schema/`, run:
```
cd lib/db && npx tsc -p tsconfig.json
```
This emits `.d.ts` files to `lib/db/dist/schema/`. Without this step, API server typecheck fails with "Module '@workspace/db' has no exported member 'newTable'".

**Why:** The DB package uses `"composite": true`, `"emitDeclarationOnly": true` in tsconfig — TypeScript project references consume compiled `.d.ts` from `dist/`, not raw source. The DB package has no build script in package.json, so you must invoke `tsc` manually.

**How to apply:** Any time you add a new table to `lib/db/src/schema/` and update `lib/db/src/schema/index.ts`, run the tsc emit command before typechecking downstream packages.
