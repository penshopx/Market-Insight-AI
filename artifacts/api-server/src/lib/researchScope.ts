import { DATA_SOURCES, type DataSourceConfig } from "./dataSources";

export const CORE_RESEARCH_DOMAINS = [
  "LEGALITAS_PERIJINAN",
  "SBU",
  "SKK",
  "TENDER",
  "PROYEK",
] as const;

export type CoreResearchDomain = (typeof CORE_RESEARCH_DOMAINS)[number];

export const CORE_RESEARCH_LABELS: Record<CoreResearchDomain, string> = {
  LEGALITAS_PERIJINAN: "Legalitas & Perijinan",
  SBU: "SBU",
  SKK: "SKK",
  TENDER: "Tender",
  PROYEK: "Proyek",
};

const SOURCE_DOMAIN: Record<string, CoreResearchDomain> = {
  // Tender
  "spse-inaproc": "TENDER",
  indotender: "TENDER",
  "pengadaan-co-id": "TENDER",
  "tender-indonesia": "TENDER",
  "lpse-kemenpupr": "TENDER",
  "lpse-kemen-bumn": "TENDER",
  "pln-procurement": "TENDER",
  "pertamina-eprocure": "TENDER",
  "tender-bumn-infra": "TENDER",
  "hutama-karya-procurement": "TENDER",
  "kai-procurement": "TENDER",
  "dunia-tender": "TENDER",
  datalpse: "TENDER",
  "pengadaan-info": "TENDER",
  "datalelang-id": "TENDER",

  // Proyek
  "bpjt-tol": "PROYEK",
  "eppid-ikn": "PROYEK",
  "bappenas-proyek": "PROYEK",
  dokumenproyek: "PROYEK",
  "ruptl-pln": "PROYEK",
  "bci-asia": "PROYEK",
  "bci-jakarta": "PROYEK",
  "top-konstruksi": "PROYEK",
  "simpul-kpbu": "PROYEK",

  // Legalitas & Perijinan
  "oss-rba": "LEGALITAS_PERIJINAN",
  ijintender: "LEGALITAS_PERIJINAN",
  "jdih-pupr": "LEGALITAS_PERIJINAN",

  // SBU
  "lpjk-pupr": "SBU",
  "lpjk-smap": "SBU",
  indokontraktor: "SBU",
  gapensi: "SBU",
  gapeksindo: "SBU",
  inkindo: "SBU",
  aspekindo: "SBU",
  "sertifikasi-pupr": "SBU",
  "citra-data": "SBU",
  "lkpp-pemenang": "SBU",

  // SKK
  kemnaker: "SKK",
  "sibima-pupr": "SKK",
  bnsp: "SKK",
  "lsp-konstruksi": "SKK",
};

export const LEGACY_CORE_RESEARCH_CATEGORIES = [
  "REGULATORY_CHANGE",
  "CONTRACTOR_DATA",
  "SBU_SKK_EXPIRY",
  "SBU_SKK_DIFFICULTY",
  "SKK_HOLDERS",
  "TENDER_OPPORTUNITY",
  "TENDER_DIFFICULTY",
] as const;

export const VISIBLE_RESEARCH_CATEGORIES = [
  ...CORE_RESEARCH_DOMAINS,
  ...LEGACY_CORE_RESEARCH_CATEGORIES,
] as const;

export function isCoreResearchCategory(category: string): boolean {
  return (VISIBLE_RESEARCH_CATEGORIES as readonly string[]).includes(category);
}

export function getCoreResearchDomain(sourceId: string): CoreResearchDomain | null {
  return SOURCE_DOMAIN[sourceId] ?? null;
}

export function toCoreResearchSource(source: DataSourceConfig): DataSourceConfig | null {
  const domain = getCoreResearchDomain(source.id);
  return domain ? { ...source, category: domain } : null;
}

export const CORE_DATA_SOURCES: DataSourceConfig[] = DATA_SOURCES.flatMap((source) => {
  const scoped = toCoreResearchSource(source);
  return scoped ? [scoped] : [];
});
