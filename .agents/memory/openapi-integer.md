---
name: OpenAPI integer vs number (Orval + Zod v3)
description: Must use type:number not type:integer in openapi.yaml to avoid Orval generating zod.int() which doesn't exist in Zod v3.
---

**Rule:** In `lib/api-spec/openapi.yaml`, always write `type: number` for numeric fields. Never use `type: integer`.

**Why:** Orval v8.23.0 maps `type: integer` → `zod.integer()` which does not exist in Zod v3 (only Zod v4 has it). This breaks codegen and all generated type declarations.

**How to apply:** Any time you add a new field to the OpenAPI spec that is numeric, use `type: number` regardless of whether the value is integer or float. After spec changes always run `pnpm --filter @workspace/api-spec run codegen`.
