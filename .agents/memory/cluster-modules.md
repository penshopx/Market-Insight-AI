---
name: Cluster Industry Modules
description: Three new industry cluster modules added to the platform — EBT, Pertambangan, Lingkungan. Schema, routes, codegen, and pages all wired.
---

## Three Cluster Modules Built

### DB Tables (lib/db/src/schema/)
- `ebtProjectsTable` — RUPTL/IPP projects (judul, teknologi, kapasitasMw, status, provinsi, pemrakarsa, jenisPemrakarsa, tahunTarget)
- `ebtTendersTable` — PLN EBT tenders (judul, klien, teknologi, nilaiEstimasi, deadline, status)
- `miningProjectsTable` — IUP database (nomorIup, pemegang, komoditas, statusIup, jenisIup, luasHa, statusRkab)
- `environmentProjectsTable` — AMDAL/karbon/PROPER (judul, jenis, sektor, statusAmdal, peringkatProper, nilaiKarbon)

All pushed to DB via `cd lib/db && pnpm run push`.

### API Routes
- `artifacts/api-server/src/routes/ebt.ts` — GET/POST /ebt-projects, GET/PATCH /ebt-projects/:id, GET/POST /ebt-tenders, GET/PATCH /ebt-tenders/:id
- `artifacts/api-server/src/routes/mining.ts` — GET/POST /mining-projects, GET/PATCH /mining-projects/:id
- `artifacts/api-server/src/routes/environment.ts` — GET/POST /environment-projects, GET/PATCH /environment-projects/:id
- All registered in `artifacts/api-server/src/routes/index.ts`

### OpenAPI + Codegen
- Tags `ebt`, `mining`, `environment` added to `lib/api-spec/openapi.yaml`
- Schemas: EbtProject/Input/Update, EbtTender/Input/Update, MiningProject/Input/Update, EnvironmentProject/Input/Update
- Run `cd lib/api-spec && pnpm run codegen` to regenerate hooks

### Generated Hooks (from @workspace/api-client-react)
Read queries: `useListEbtProjects`, `useListEbtTenders`, `useListMiningProjects`, `useListEnvironmentProjects`
Mutations: `useCreateEbtProject`, `useUpdateEbtProject`, `useCreateEbtTender`, `useUpdateEbtTender`, `useCreateMiningProject`, `useUpdateMiningProject`, `useCreateEnvironmentProject`, `useUpdateEnvironmentProject`
Query key helpers: `getListEbtProjectsQueryKey`, `getListEbtTendersQueryKey`, `getListMiningProjectsQueryKey`, `getListEnvironmentProjectsQueryKey`

**Why:** Orval generates mutations as `export const` not `export function` — `grep "export function use"` will miss them. Search for `export const use` or just check codegen output.

### Navigation + Pages
- `shell.tsx`: new "Cluster Industri" nav section with Zap/Mountain/Leaf icons
- `clusterNavItems`: Modul EBT → /modul-ebt, Modul Pertambangan → /modul-pertambangan, Modul Lingkungan & Transisi → /modul-lingkungan
- Pages: `src/pages/modul-ebt.tsx`, `src/pages/modul-pertambangan.tsx`, `src/pages/modul-lingkungan.tsx`

### Data Sources Added (dataSources.ts)
EBT: pln-eproc-ebt, esdm-ebt, ruptl-pln, iesr-ebt, cnbc-energi
Mining: modi-esdm, esdm-minerba, tambang-co-id, mining-co-id, apbi-batubara
Environment: klhk-amdal, idx-carbon, klhk-proper, greennetwork-id, mongabay-indonesia
