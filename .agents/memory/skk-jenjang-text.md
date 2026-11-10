---
name: SKK Holder jenjang stored as text
description: jenjang column in skk_holders is text("7"/"8"/"9") not integer; coerce on all insert/update/filter paths.
---

**Rule:** `skkHoldersTable.jenjang` is `text` in Drizzle schema. When inserting, wrap with `String(parsedData.jenjang)`. When filtering by query param, compare with `String(queryParam.jenjang)`.

**Why:** OpenAPI spec uses `type: number` (not integer, see openapi-integer note) for jenjang, so Zod parses it as number. DB column is text to avoid Drizzle integer coercion issues during initial setup.

**How to apply:** In `artifacts/api-server/src/routes/skkHolders.ts`, the insert and update paths already coerce jenjang to string. The filter path uses `String()` comparison. Maintain this pattern for any new SKK-related routes.
