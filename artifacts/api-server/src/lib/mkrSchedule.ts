/**
 * MKR-aware crawl schedule.
 *
 * Maps each DATA_SOURCE id to its crawl frequency tier (derived from the
 * Master Knowledge Registry metadata) so the daily scheduler only hits
 * sources that are actually due on a given day — instead of hammering every
 * external site every 24 hours.
 *
 * Frequency tiers:
 *   REALTIME / HARIAN  → crawl every day  (priority 1–2)
 *   MINGGUAN           → crawl on Mondays  (priority 3)
 *   BULANAN            → crawl on the 1st  (priority 4)
 *   SKIP               → manual / not yet active (priority 5)
 */

import type { DataSourceConfig } from "./dataSources";

export type CrawlFrequency = "REALTIME" | "HARIAN" | "MINGGUAN" | "BULANAN" | "SKIP";

export interface MkrCrawlConfig {
  frequency: CrawlFrequency;
  /** 1 = highest, 5 = lowest / disabled */
  priority: 1 | 2 | 3 | 4 | 5;
  mkrSourceId: string;
  businessValue: number; // 1–10, from MKR
}

// ─── Per-source schedule config ───────────────────────────────────────────────
// Keys match DataSourceConfig.id from dataSources.ts

export const MKR_CRAWL_CONFIG: Record<string, MkrCrawlConfig> = {
  // ── Tender & Pengadaan ──────────────────────────────────────────────────────
  "spse-inaproc":            { frequency: "HARIAN",   priority: 1, mkrSourceId: "TDR-LPSE-001",     businessValue: 10 },
  "lpse-kemenpupr":          { frequency: "HARIAN",   priority: 1, mkrSourceId: "TDR-LPSE-001",     businessValue: 10 },
  "indotender":              { frequency: "HARIAN",   priority: 2, mkrSourceId: "TDR-DATA-001",     businessValue: 8  },
  "pengadaan-co-id":         { frequency: "HARIAN",   priority: 2, mkrSourceId: "TDR-DATA-001",     businessValue: 7  },
  "tender-indonesia":        { frequency: "HARIAN",   priority: 2, mkrSourceId: "TDR-DATA-001",     businessValue: 7  },
  "lpse-kemen-bumn":         { frequency: "HARIAN",   priority: 1, mkrSourceId: "TDR-SIRUP-001",    businessValue: 9  },
  "pln-procurement":         { frequency: "HARIAN",   priority: 2, mkrSourceId: "BUMN-PLN-001",     businessValue: 8  },
  "pertamina-eprocure":      { frequency: "HARIAN",   priority: 2, mkrSourceId: "BUMN-PERTAMINA",   businessValue: 8  },
  "bpjt-tol":                { frequency: "MINGGUAN", priority: 3, mkrSourceId: "GOV-BPJT-001",     businessValue: 7  },
  "tender-bumn-infra":       { frequency: "HARIAN",   priority: 2, mkrSourceId: "BUMN-WIKA-001",    businessValue: 7  },
  "hutama-karya-procurement":{ frequency: "HARIAN",   priority: 2, mkrSourceId: "BUMN-HK-001",      businessValue: 7  },
  "kai-procurement":         { frequency: "MINGGUAN", priority: 3, mkrSourceId: "BUMN-KAI-001",     businessValue: 6  },
  "eppid-ikn":               { frequency: "HARIAN",   priority: 1, mkrSourceId: "BUMN-IKN-001",     businessValue: 9  },

  // ── Kontraktor, SBU & Perizinan ─────────────────────────────────────────────
  "lpjk-pupr":               { frequency: "HARIAN",   priority: 1, mkrSourceId: "GOV-LPJK-001",     businessValue: 10 },
  "lpjk-smap":               { frequency: "MINGGUAN", priority: 2, mkrSourceId: "GOV-LPJK-001",     businessValue: 9  },
  "oss-rba":                 { frequency: "HARIAN",   priority: 1, mkrSourceId: "GOV-OSS-001",      businessValue: 9  },
  "ijintender":              { frequency: "HARIAN",   priority: 1, mkrSourceId: "MKT-IJINTENDER-001",businessValue: 10 },
  "indokontraktor":          { frequency: "MINGGUAN", priority: 3, mkrSourceId: "MKT-INDOKONTRAKTOR",businessValue: 7  },
  "gapensi":                 { frequency: "MINGGUAN", priority: 3, mkrSourceId: "ASOS-GAPENSI-001",  businessValue: 7  },
  "gapeksindo":              { frequency: "MINGGUAN", priority: 3, mkrSourceId: "ASOS-GAPEKSINDO",   businessValue: 6  },
  "inkindo":                 { frequency: "MINGGUAN", priority: 3, mkrSourceId: "ASOS-INKINDO",      businessValue: 6  },
  "aspekindo":               { frequency: "BULANAN",  priority: 4, mkrSourceId: "ASOS-ASPEKINDO",    businessValue: 5  },
  "sertifikasi-pupr":        { frequency: "HARIAN",   priority: 2, mkrSourceId: "GOV-PUPR-001",     businessValue: 9  },

  // ── SKK, Sertifikasi & Tenaga Kerja ─────────────────────────────────────────
  "kemnaker":                { frequency: "MINGGUAN", priority: 3, mkrSourceId: "GOV-KEMNAKER-001",  businessValue: 8  },
  "sibima-pupr":             { frequency: "HARIAN",   priority: 2, mkrSourceId: "REG-SIBIMA-001",    businessValue: 9  },
  "bnsp":                    { frequency: "MINGGUAN", priority: 3, mkrSourceId: "REG-BNSP-001",      businessValue: 8  },
  "lsp-konstruksi":          { frequency: "MINGGUAN", priority: 3, mkrSourceId: "REG-LSP-001",       businessValue: 8  },
  "tukang-com":              { frequency: "BULANAN",  priority: 4, mkrSourceId: "MKT-TUKANG",        businessValue: 5  },

  // ── Regulasi & Standar ───────────────────────────────────────────────────────
  "jdih-pupr":               { frequency: "HARIAN",   priority: 1, mkrSourceId: "REG-JDIH-001",     businessValue: 10 },
  "bsn-sni":                 { frequency: "MINGGUAN", priority: 2, mkrSourceId: "GOV-BSN-001",      businessValue: 9  },
  "peraturan-go-id":         { frequency: "HARIAN",   priority: 2, mkrSourceId: "REG-JDIH-001",     businessValue: 8  },
  "bpk-peraturan":           { frequency: "MINGGUAN", priority: 3, mkrSourceId: "REG-BPK-001",      businessValue: 7  },
  "iso-konstruksi":          { frequency: "BULANAN",  priority: 4, mkrSourceId: "STD-ISO-001",      businessValue: 8  },

  // ── Pemerintah & Kebijakan ───────────────────────────────────────────────────
  "pupr-gov-id":             { frequency: "HARIAN",   priority: 1, mkrSourceId: "GOV-PUPR-001",     businessValue: 10 },
  "esdm-gov-id":             { frequency: "HARIAN",   priority: 2, mkrSourceId: "GOV-ESDM-001",     businessValue: 8  },
  "bkpm-investasi":          { frequency: "HARIAN",   priority: 2, mkrSourceId: "GOV-BKPM-001",     businessValue: 9  },
  "bps-konstruksi":          { frequency: "BULANAN",  priority: 3, mkrSourceId: "GOV-BPS-001",      businessValue: 8  },

  // ── Media & Berita ───────────────────────────────────────────────────────────
  "bisnis-indonesia":        { frequency: "HARIAN",   priority: 2, mkrSourceId: "MED-BISNISIND-001",businessValue: 8  },
  "kontan":                  { frequency: "HARIAN",   priority: 2, mkrSourceId: "MED-KONTAN-001",   businessValue: 7  },
  "republika-konstruksi":    { frequency: "HARIAN",   priority: 3, mkrSourceId: "MED-REPUBLIKA",    businessValue: 6  },
  "detik-properti":          { frequency: "HARIAN",   priority: 3, mkrSourceId: "MED-DETIK",        businessValue: 6  },
  "majalah-konstruksi":      { frequency: "BULANAN",  priority: 4, mkrSourceId: "MED-MAJKONS-001",  businessValue: 6  },
  "kompas-properti":         { frequency: "HARIAN",   priority: 3, mkrSourceId: "MED-KOMPAS-001",   businessValue: 7  },
  "katadata":                { frequency: "HARIAN",   priority: 2, mkrSourceId: "MED-KATADATA",     businessValue: 8  },

  // ── Asosiasi & Komunitas ─────────────────────────────────────────────────────
  "linkedin-konstruksi":     { frequency: "HARIAN",   priority: 2, mkrSourceId: "MKT-LINKEDIN-001", businessValue: 9  },
  "kaskus-properti":         { frequency: "MINGGUAN", priority: 4, mkrSourceId: "KOM-KASKUS-001",   businessValue: 5  },
  "telegram-konstruksi":     { frequency: "HARIAN",   priority: 3, mkrSourceId: "KOM-TELEGRAM-001", businessValue: 6  },
};

/** Default config for sources not explicitly mapped. */
const DEFAULT_CONFIG: MkrCrawlConfig = {
  frequency: "MINGGUAN",
  priority: 3,
  mkrSourceId: "UNKNOWN",
  businessValue: 5,
};

export function getConfig(sourceId: string): MkrCrawlConfig {
  return MKR_CRAWL_CONFIG[sourceId] ?? DEFAULT_CONFIG;
}

/**
 * Returns the subset of sources that should be crawled on `date`.
 *
 * Rules:
 *  - SKIP / priority 5 → never included
 *  - REALTIME / HARIAN → included every day
 *  - MINGGUAN → included on Mondays (getDay() === 1)
 *  - BULANAN  → included on the 1st of the month
 *
 * During manual triggers the caller can pass `forceAll: true` to bypass date
 * filtering and crawl everything that isn't SKIP.
 */
export function getTodaysCrawlBatch(
  sources: DataSourceConfig[],
  date: Date = new Date(),
  forceAll = false,
): { sources: DataSourceConfig[]; skipped: DataSourceConfig[]; scheduleInfo: Record<string, MkrCrawlConfig> } {
  const dow = date.getDay();   // 0=Sun … 6=Sat
  const dom = date.getDate();  // 1–31

  const included: DataSourceConfig[] = [];
  const skipped: DataSourceConfig[] = [];
  const scheduleInfo: Record<string, MkrCrawlConfig> = {};

  for (const src of sources) {
    const cfg = getConfig(src.id);
    scheduleInfo[src.id] = cfg;

    if (cfg.frequency === "SKIP" || cfg.priority === 5) {
      skipped.push(src);
      continue;
    }
    if (forceAll) {
      included.push(src);
      continue;
    }

    let due = false;
    if (cfg.frequency === "REALTIME" || cfg.frequency === "HARIAN") {
      due = true;
    } else if (cfg.frequency === "MINGGUAN") {
      due = dow === 1; // Mondays
    } else if (cfg.frequency === "BULANAN") {
      due = dom === 1; // 1st of month
    }

    if (due) included.push(src);
    else skipped.push(src);
  }

  // Sort included by priority ascending (1 = first)
  included.sort((a, b) => (getConfig(a.id).priority) - (getConfig(b.id).priority));

  return { sources: included, skipped, scheduleInfo };
}

/**
 * Returns a summary matrix used by the API endpoint and frontend tab.
 */
export interface ScheduleMatrixEntry {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  category: string;
  description: string;
  frequency: CrawlFrequency;
  priority: number;
  mkrSourceId: string;
  businessValue: number;
  dueToday: boolean;
  dueThisWeek: boolean;
  dueThisMonth: boolean;
  /** ISO timestamp of the last successful crawl for this source, or null if never crawled. */
  lastCrawledAt: string | null;
  /** ISO timestamp of the next scheduled crawl for this source (based on frequency). */
  nextScheduledAt: string | null;
  /** Human-readable crawl priority label derived from MKR prioritasCrawl. */
  prioritasCrawl: string;
}

/** Returns only source IDs with no successful/partial crawl history. */
export function getNeverCrawledSourceIds(matrix: ScheduleMatrixEntry[]): string[] {
  return matrix
    .filter((entry) => entry.lastCrawledAt === null)
    .map((entry) => entry.sourceId);
}

/**
 * Whether a source is considered "high priority" and should be crawled every
 * 6 hours instead of once daily.  Matches the sub-daily scheduler logic.
 */
export function isHighPrioritySource(cfg: MkrCrawlConfig): boolean {
  return (cfg.frequency === "HARIAN" || cfg.frequency === "REALTIME") && cfg.businessValue >= 9;
}

/** Returns the sourceIds that the sub-daily (every 6 h) scheduler should run. */
export function getHighPrioritySourceIds(sources: DataSourceConfig[]): string[] {
  return sources
    .filter((s) => {
      const cfg = MKR_CRAWL_CONFIG[s.id];
      return cfg ? isHighPrioritySource(cfg) : false;
    })
    .map((s) => s.id);
}

/**
 * Returns the sourceIds for the daily batch, EXCLUDING high-priority sources
 * (those are handled every 6 hours by the sub-daily scheduler, including at 07:00 WIB).
 * This prevents each source from being crawled twice at the 07:00 WIB boundary.
 */
export function getStandardCrawlSourceIds(sources: DataSourceConfig[], date: Date = new Date()): string[] {
  const { sources: todayBatch } = getTodaysCrawlBatch(sources, date);
  const highPriorityIds = new Set(getHighPrioritySourceIds(sources));
  return todayBatch.filter((s) => !highPriorityIds.has(s.id)).map((s) => s.id);
}

/**
 * Returns ms until the next 6-hour crawl boundary for high-priority sources.
 * Boundaries are at UTC 00:00, 06:00, 12:00, 18:00 (= 07:00, 13:00, 19:00, 01:00 WIB).
 */
export function msUntilNextHighPriorityRun(from: Date = new Date()): number {
  const INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
  const msIntoDay = (from.getUTCHours() * 60 + from.getUTCMinutes()) * 60 * 1000 + from.getUTCSeconds() * 1000 + from.getUTCMilliseconds();
  const msIntoInterval = msIntoDay % INTERVAL_MS;
  return INTERVAL_MS - msIntoInterval; // ms until next 6-hour boundary
}

/**
 * Computes the next scheduled run time for a source based on its frequency.
 * High-priority HARIAN/REALTIME sources (businessValue >= 9) run every 6 hours;
 * all others run at 07:00 WIB (00:00 UTC) on their configured cadence.
 */
export function getNextScheduledAt(
  frequency: CrawlFrequency,
  businessValue: number,
  from: Date = new Date(),
): string | null {
  if (frequency === "SKIP") return null;

  // High-priority HARIAN/REALTIME → next 6-hour boundary
  if ((frequency === "HARIAN" || frequency === "REALTIME") && businessValue >= 9) {
    const ms = msUntilNextHighPriorityRun(from);
    return new Date(from.getTime() + ms).toISOString();
  }

  const next = new Date(from);
  // Start with today at 00:00 UTC (= 07:00 WIB)
  next.setUTCHours(0, 0, 0, 0);

  if (frequency === "REALTIME" || frequency === "HARIAN") {
    // If today's 07:00 WIB has already passed, schedule tomorrow
    if (next <= from) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next.toISOString();
  }

  if (frequency === "MINGGUAN") {
    // Next Monday
    const dow = next.getUTCDay(); // 0=Sun, 1=Mon, ...
    const daysUntilMonday = dow === 1 ? (next <= from ? 7 : 0) : (8 - dow) % 7 || 7;
    next.setUTCDate(next.getUTCDate() + daysUntilMonday);
    return next.toISOString();
  }

  if (frequency === "BULANAN") {
    // 1st of next month at 00:00 UTC
    next.setUTCDate(1);
    if (next <= from) {
      next.setUTCMonth(next.getUTCMonth() + 1);
    }
    return next.toISOString();
  }

  return null;
}

/** Human-readable priority label from MKR.
 *  REALTIME is treated the same as HARIAN for scheduling purposes:
 *  businessValue >= 9 → every 6 hours, otherwise once daily.
 */
function prioritasCrawlLabel(frequency: CrawlFrequency, businessValue: number): string {
  if (frequency === "REALTIME" || frequency === "HARIAN") return businessValue >= 9 ? "setiap 6 jam" : "harian";
  if (frequency === "MINGGUAN") return "mingguan";
  if (frequency === "BULANAN") return "bulanan";
  return "manual";
}

export function getScheduleMatrix(
  sources: DataSourceConfig[],
  date: Date = new Date(),
  lastCrawledBySource: Record<string, string> = {},
): ScheduleMatrixEntry[] {
  const dow = date.getDay();
  const dom = date.getDate();

  return sources.map((src) => {
    const cfg = getConfig(src.id);
    const dueToday =
      cfg.frequency === "REALTIME" ||
      cfg.frequency === "HARIAN" ||
      (cfg.frequency === "MINGGUAN" && dow === 1) ||
      (cfg.frequency === "BULANAN" && dom === 1);

    const lastCrawledAt = lastCrawledBySource[src.id] ?? null;
    const nextScheduledAt = getNextScheduledAt(cfg.frequency, cfg.businessValue, date);

    return {
      sourceId: src.id,
      sourceName: src.name,
      sourceUrl: src.url,
      category: src.category,
      description: src.description,
      frequency: cfg.frequency,
      priority: cfg.priority,
      mkrSourceId: cfg.mkrSourceId,
      businessValue: cfg.businessValue,
      dueToday,
      dueThisWeek: cfg.frequency !== "BULANAN" && cfg.frequency !== "SKIP",
      dueThisMonth: cfg.frequency !== "SKIP",
      lastCrawledAt,
      nextScheduledAt,
      prioritasCrawl: prioritasCrawlLabel(cfg.frequency, cfg.businessValue),
    };
  });
}
