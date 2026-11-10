// ─── Per-page knowledge config ────────────────────────────────────────────────
// Extracted from knowledge-sources-bar.tsx to avoid Vite Fast Refresh warning.
// (React Fast Refresh requires files with components to only export components.)

export interface PageKnowledgeConfig {
  agentIds: string[];           // AI agent yang melayani halaman ini
  extraSourceIds?: string[];    // sumber tambahan di luar agent dependency
}

export const PAGE_KNOWLEDGE_CONFIG: Record<string, PageKnowledgeConfig> = {
  regulasi: {
    agentIds: ["AI-REG-001"],
    extraSourceIds: ["GOV-BSN-001", "REG-BPK-001"],
  },
  kompetitor: {
    agentIds: ["AI-COMP-001", "AI-MARKET-001"],
    extraSourceIds: ["MED-BISNISIND-001", "MED-KONTAN-001"],
  },
  "sinyal-pasar": {
    agentIds: ["AI-MARKET-001", "AI-VOC-001"],
    extraSourceIds: ["GOV-BPS-001", "GOV-BKPM-001"],
  },
  tender: {
    agentIds: ["AI-TENDER-001"],
    extraSourceIds: ["TDR-DATA-001", "BUMN-PLN-001", "BUMN-IKN-001", "TDR-INAPROC-001"],
  },
  "data-collector": {
    agentIds: ["AI-TENDER-001", "AI-COMP-001"],
    extraSourceIds: ["MKT-IJINTENDER-001", "REG-LPJK-001", "GOV-BSN-001"],
  },
  riset: {
    agentIds: ["AI-MARKET-001"],
    extraSourceIds: ["MED-BISNISIND-001", "TDR-DATA-001"],
  },
  "surat-penawaran": {
    agentIds: ["AI-COMP-001", "AI-TENDER-001"],
    extraSourceIds: ["MKT-IJINTENDER-001", "REG-LPJK-001"],
  },
  "ai-rekomendasi": {
    agentIds: ["AI-MARKET-001", "AI-COMP-001"],
    extraSourceIds: ["GOV-BPS-001", "MED-BISNISIND-001"],
  },
  inspirasi: {
    agentIds: ["AI-MARKET-001", "AI-VOC-001"],
    extraSourceIds: ["TDR-DATA-001", "REG-LPJK-001"],
  },
  "output-produk": {
    agentIds: ["AI-MARKET-001"],
    extraSourceIds: ["MED-KONTAN-001", "MED-BISNISIND-001"],
  },
  skk: {
    agentIds: ["AI-REG-001"],
    extraSourceIds: ["REG-LPJK-001", "GOV-KEMENPUPR-001"],
  },
  kontraktor: {
    agentIds: ["AI-COMP-001"],
    extraSourceIds: ["REG-LPJK-001", "GOV-KEMENPUPR-001", "TDR-DATA-001"],
  },
  workroom: {
    agentIds: ["AI-MARKET-001", "AI-VOC-001"],
    extraSourceIds: ["GOV-BPS-001", "MED-BISNISIND-001"],
  },
  "strategi-marketing": {
    agentIds: ["AI-MARKET-001", "AI-VOC-001"],
    extraSourceIds: ["MED-BISNISIND-001", "MED-KONTAN-001", "GOV-BKPM-001"],
  },
};
