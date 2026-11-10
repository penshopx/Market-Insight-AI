# Platform Riset Marketing Konstruksi Indonesia

Platform intelijen riset marketing untuk industri konstruksi Indonesia. Tim Riset (Direktur Marketing + AI Orchestrators) menggunakan platform ini untuk mengumpulkan, menganalisis, dan menyajikan data harian tren konstruksi, status SBU/SKK, data kontraktor/konsultan, pemegang SKK, peluang tender, dan pain points — siap di meja workroom setiap pagi pukul 07:00.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/konstruksi-riset run dev` — run the frontend (port 22550)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + Recharts
- API: Express 5 (port 8080, base path `/api`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for API contracts
- `lib/db/src/schema/` — Drizzle schema: researchItems, contractors, skkHolders, tenderOpportunities, painPoints
- `artifacts/api-server/src/routes/` — Express route handlers (researchItems, contractors, skkHolders, tenderOpportunities, painPoints, dashboard)
- `artifacts/konstruksi-riset/src/pages/` — Frontend pages

## Pages / Routes

- `/` — Dashboard Harian (Briefing 07:00): summary stats, trending topics, expiring certs, activity feed
- `/riset` — Data Proyek dan riset inti
- `/kontraktor` — Database Kontraktor & Konsultan (SBU level)
- `/skk` — Database Pemegang SKK (Jenjang 7, 8, 9)
- `/tender` — Peluang Tender Konstruksi
- `/pain-points` — Workroom Perumusan Masalah

## Research Categories (5 Domain Inti)

1. `LEGALITAS_PERIJINAN` — Legalitas dan perijinan konstruksi
2. `SBU` — Badan usaha dan sertifikasi badan usaha
3. `SKK` — Tenaga ahli dan sertifikat kompetensi kerja
4. `TENDER` — Tender dan pengadaan konstruksi
5. `PROYEK` — Pipeline dan informasi proyek konstruksi

Kategori lama tetap tersimpan sebagai data historis, tetapi tidak digunakan untuk crawl baru atau ditampilkan sebagai pilihan riset utama.

## Architecture decisions

- OpenAPI-first: spec di `lib/api-spec/openapi.yaml`, codegen ke React Query hooks + Zod schemas
- All integer types in OpenAPI use `type: number` (not `type: integer`) to avoid Zod v3 compatibility issues with Orval's `zod.int()` generation
- Dashboard endpoints are read-only aggregations computed from existing tables — no separate summary table needed
- SkkHolder.jenjang stored as text (not integer) in DB to avoid type coercion issues, parsed as string in route

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- OpenAPI spec: use `type: number` instead of `type: integer` — Orval generates `zod.int()` for integers which doesn't exist in Zod v3
- SkkHolder.jenjang: stored as text in DB, API accepts number but converts to string before insert
- Verify artifacts with `pnpm --filter @workspace/<slug> run typecheck`, not `build`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
