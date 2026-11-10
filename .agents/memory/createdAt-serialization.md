---
name: createdAt serialization in API routes
description: All API route list/single-item endpoints must serialize Date objects to ISO string before Zod parse
---

## Rule
Every `.returning()` result from Drizzle that goes through a Zod response schema must have `createdAt` converted:

```ts
res.json(ListFooResponse.parse(items.map(r => ({
  ...r,
  createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt
}))));
```

Same for single-item PATCH/POST responses.

**Why:** Drizzle returns `createdAt` as a JS `Date` object. Orval-generated Zod schemas declare `createdAt: z.string()` (from OpenAPI `type: string`). Zod v3 strict mode rejects `Date` where `string` is expected → 500 error.

**How to apply:** Any new route that returns a row with `createdAt` timestamp must include this serialization. Fixed in: contractors, researchItems, skkHolders, tenderOpportunities, painPoints, outputProducts (list + PATCH), aiRecommendations, marketingStrategies.
