import { useState, useMemo, useEffect, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Link, useSearch } from "wouter";
import { cn } from "@/lib/utils";
import {
  KNOWLEDGE_REGISTRY, KNOWLEDGE_SUPPLY_CHAIN, COVERAGE_TAXONOMY, AI_AGENTS_REGISTRY,
  GROUP_LABELS, INTEGRATION_LEVEL_LABELS, INTEGRATION_LEVEL_DESC, INTEGRATION_LEVEL_COLOR,
  getByIntegrationLevel, getRelatedSources,
  type KnowledgeAsset, type IntegrationLevel, type SourceGroup, type DomainIndustri, type KnowledgeCategory,
} from "@/lib/knowledgeRegistry";
import { Activity, Archive, BookOpen, Brain, Cable, Calculator, Calendar, CalendarDays, ChartColumnBig, ChartLine, ChevronDown, ChevronRight, ChevronUp, CircleAlert, CircleCheck, Clock, Copy, Cpu, Database, DollarSign, ExternalLink, Eye, FileDown, FileKey, FileText, FlaskConical, GitBranch, Globe, Layers, LayoutDashboard, Link2, ListFilter, Loader2, LoaderCircle, Lock, Mail, Map, MapPin, Network, Play, Quote, RefreshCw, Rocket, Search, Settings, Share2, Shield, ShieldCheck, Sparkles, Star, Target, TrendingUp, TriangleAlert, Trophy, Users, Workflow, X, Zap } from "lucide-react";
import { createMKRShareDownloadUrl, exportMKRPDF, getMKREmailShareUrl, getMKRWhatsAppShareUrl, previewMKRPDF } from "@/lib/export-pdf";
import {
  useGetMkrCrawlSchedule,
  useGetMkrCrawlScheduleAlias,
  useTriggerScheduler,
  useTriggerSchedulerForSource,
  getGetMkrCrawlScheduleQueryKey,
  getGetMkrCrawlScheduleAliasQueryKey,
  type MkrScheduleEntry,
} from "@workspace/api-client-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPPLY_CHAIN_ICONS: Record<string, React.ElementType> = {
  Globe, Database, ShieldCheck, BookOpen, Cpu, Brain, LayoutDashboard,
};

const LEVEL_ICON: Record<IntegrationLevel, React.ElementType> = {
  1: BookOpen,
  2: Shield,
  3: TrendingUp,
  4: Brain,
};

const LEVEL_COLORS_BG: Record<IntegrationLevel, string> = {
  1: "bg-slate-500",
  2: "bg-blue-500",
  3: "bg-emerald-500",
  4: "bg-primary",
};

const AUTHORITY_BADGE: Record<string, string> = {
  PRIMER: "bg-emerald-100 text-emerald-700 border-emerald-300",
  SEKUNDER: "bg-blue-100 text-blue-700 border-blue-300",
  KOMUNITAS: "bg-orange-100 text-orange-700 border-orange-300",
};

const API_BADGE: Record<string, string> = {
  YA: "bg-green-100 text-green-700",
  SEBAGIAN: "bg-yellow-100 text-yellow-700",
  TIDAK: "bg-slate-100 text-slate-500",
};

const CRAWL_BADGE: Record<string, string> = {
  AKTIF: "bg-emerald-100 text-emerald-700",
  MANUAL: "bg-blue-100 text-blue-700",
  BETA: "bg-purple-100 text-purple-700",
  BELUM: "bg-red-100 text-red-700",
};

const CRAWL_FREQUENCY_BADGE: Record<string, string> = {
  REALTIME: "bg-primary text-primary-foreground border-primary",
  HARIAN: "bg-emerald-100 text-emerald-700 border-emerald-300",
  MINGGUAN: "bg-blue-100 text-blue-700 border-blue-300",
  BULANAN: "bg-orange-100 text-orange-700 border-orange-300",
  SKIP: "bg-slate-100 text-slate-500 border-slate-200",
};

const CRAWL_FREQUENCY_LABEL: Record<string, string> = {
  REALTIME: "⚡ Real-time",
  HARIAN: "📅 Harian",
  MINGGUAN: "🗓 Mingguan",
  BULANAN: "📆 Bulanan",
  SKIP: "⏸ Dilewati",
};

function formatCrawledAt(timestamp: string): string {
  return new Date(timestamp).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Tab = "registry" | "supply-chain" | "knowledge-graph" | "by-level" | "coverage" | "ai-matrix" | "crawl-schedule";

const KNOWLEDGE_CATEGORIES: readonly KnowledgeCategory[] = [
  "REGULATORY",
  "TENDER",
  "CERTIFICATION",
  "COMPETITOR",
  "MARKET",
];

/**
 * The registry's source group is the canonical classification for assets that
 * do not yet have an explicit monetization category. Keeping this map tied to
 * SourceGroup prevents conceptual labels from leaking into enum comparisons.
 */
const CATEGORY_SOURCE_GROUPS: Record<KnowledgeCategory, readonly SourceGroup[]> = {
  REGULATORY: [
    "KEMENTERIAN",
    "LEMBAGA_NEGARA",
    "OSS_PERIZINAN",
    "REGULASI_HUKUM",
    "STANDAR_NASIONAL_INTERNASIONAL",
  ],
  TENDER: ["PENGADAAN_TENDER", "BUMN_PERUSAHAAN"],
  CERTIFICATION: ["SERTIFIKASI_AKREDITASI"],
  COMPETITOR: ["MARKETPLACE_SDM", "KOMUNITAS_FORUM"],
  MARKET: [
    "ASOSIASI_PROFESI",
    "UNIVERSITAS_RISET",
    "MEDIA_INDUSTRI",
    "KNOWLEDGE_INTERNASIONAL",
    "DATASET_OPENDATA",
    "MIGAS",
    "PERTAMBANGAN",
    "KETENAGALISTRIKAN",
    "ENERGI_TERBARUKAN",
    "LINGKUNGAN_HIDUP",
  ],
};

function getKnowledgeCategory(asset: KnowledgeAsset): KnowledgeCategory {
  if (asset.category && KNOWLEDGE_CATEGORIES.includes(asset.category)) {
    return asset.category;
  }

  const category = KNOWLEDGE_CATEGORIES.find((candidate) =>
    CATEGORY_SOURCE_GROUPS[candidate].includes(asset.group),
  );
  return category ?? "MARKET";
}

// ─── Knowledge Asset Card ─────────────────────────────────────────────────────

function AssetCard({ asset, crawlSchedule, crawlScheduleLoading, isExpanded, onToggle, reviewed, onToggleReviewed, pinned, onTogglePin, note, onNoteChange, noteSaved, highlighted }: {
  asset: KnowledgeAsset;
  crawlSchedule?: MkrScheduleEntry;
  crawlScheduleLoading: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  reviewed: boolean;
  onToggleReviewed: () => void;
  pinned: boolean;
  onTogglePin: () => void;
  note: string;
  onNoteChange: (val: string) => void;
  noteSaved?: boolean;
  highlighted?: boolean;
}) {
  const LevelIcon = LEVEL_ICON[asset.integrationLevel];
  const related = getRelatedSources(asset.sourceId);

  return (
    <div
      id={`knowledge-asset-${asset.sourceId}`}
      className={cn(
        "group border rounded-sm bg-card overflow-hidden hover:bg-muted/40 transition-all hover:shadow-md cursor-pointer",
        pinned && "border-amber-300 bg-amber-50/30",
        reviewed && !pinned && "bg-emerald-50/20",
        highlighted && "ring-2 ring-primary ring-offset-2 shadow-lg shadow-primary/20",
      )}
    >
      <div className={cn("h-1", LEVEL_COLORS_BG[asset.integrationLevel])} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <span className="text-[10px] font-mono text-muted-foreground">{asset.sourceId}</span>
              <span className={cn("text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-sm border", INTEGRATION_LEVEL_COLOR[asset.integrationLevel])}>
                <LevelIcon className="h-2.5 w-2.5 inline mr-0.5" />
                L{asset.integrationLevel}
              </span>
              <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded-sm border", AUTHORITY_BADGE[asset.otoritas])}>
                {asset.otoritas}
              </span>
              <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded-sm", CRAWL_BADGE[asset.crawlingStatus])}>
                ● {asset.crawlingStatus}
              </span>
            </div>

            {/* Name */}
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
                aria-label={pinned ? "Lepas pin aset ini" : "Pin aset ini"}
                className={cn("shrink-0 transition-colors", pinned ? "text-amber-500" : "text-muted-foreground/30 hover:text-amber-400")}
                title={pinned ? "Hapus pin" : "Pin aset ini"}
              >
                <Star className={cn("h-3.5 w-3.5", pinned && "fill-amber-400")} />
              </button>
              <h3 className="font-semibold text-sm truncate flex-1" title={asset.nama}>{asset.nama}</h3>
              <button onClick={e => { e.stopPropagation(); void navigator.clipboard.writeText(asset.nama).then(() => toast.success("Nama aset disalin", { duration: 1200 })).catch(() => {}); }} aria-label="Salin nama aset" className="opacity-0 group-hover:opacity-100 transition-all shrink-0 text-muted-foreground hover:text-foreground" title="Salin nama"><Copy className="h-2.5 w-2.5" /></button>
              <a href={asset.url} target="_blank" rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm" onClick={(e) => e.stopPropagation()}
                title="Buka referensi di tab baru" aria-label="Buka referensi di tab baru">
                <ExternalLink className="h-3 w-3" />
              </a>
              <button
                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(asset.url).then(() => toast.success("Link disalin", { duration: 1500 })).catch(() => {}); }}
                className="text-muted-foreground hover:text-primary transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none"
                title="Salin link referensi"
                aria-label="Salin link referensi"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate" title={asset.namaResmi}>{asset.namaResmi}</p>

            {/* Tags row */}
            <div className="flex flex-wrap gap-1 mt-2">
              {asset.domainIndustri.slice(0, 3).map((d) => (
                <span key={d} className="text-[10px] bg-primary/5 border border-primary/20 px-1.5 py-0.5 rounded-sm">{d}</span>
              ))}
              {asset.jenisKonten.slice(0, 2).map((k) => (
                <span key={k} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-sm text-muted-foreground">{k}</span>
              ))}
              {(asset.jenisKonten.length + asset.domainIndustri.length) > 5 && (
                <span className="text-[10px] text-muted-foreground" title={[...asset.jenisKonten.slice(2), ...asset.domainIndustri].join(", ")}>+{asset.jenisKonten.length + asset.domainIndustri.length - 5} lagi</span>
              )}
            </div>

            {/* Live crawl schedule from /api/mkr/crawl-schedule */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2 font-mono text-[10px]">
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                {crawlScheduleLoading ? (
                  <span className="inline-flex items-center gap-1"><LoaderCircle className="h-3 w-3 animate-spin" /> Memuat histori crawl…</span>
                ) : crawlSchedule?.lastCrawledAt ? (
                  <span className="text-foreground" title={new Date(crawlSchedule.lastCrawledAt).toLocaleString("id-ID")}>
                    Last crawled: {formatCrawledAt(crawlSchedule.lastCrawledAt)}
                  </span>
                ) : (
                  <span className="text-amber-700">Belum pernah dicrawl</span>
                )}
              </span>
              {crawlSchedule ? (
                <Link href={`/data-collector?source=${encodeURIComponent(crawlSchedule.sourceId)}`}>
                  <a
                    onClick={(event) => event.stopPropagation()}
                    className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border font-semibold transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none",
                      CRAWL_FREQUENCY_BADGE[crawlSchedule.frequency],
                    )}
                    title={`Buka ${crawlSchedule.sourceName} di Data Collector · ${crawlSchedule.prioritasCrawl}`}
                    aria-label={`Buka jadwal ${CRAWL_FREQUENCY_LABEL[crawlSchedule.frequency] ?? crawlSchedule.frequency} untuk ${crawlSchedule.sourceName} di Data Collector`}
                  >
                    {CRAWL_FREQUENCY_LABEL[crawlSchedule.frequency] ?? crawlSchedule.frequency}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </Link>
              ) : !crawlScheduleLoading ? (
                <span className="px-1.5 py-0.5 rounded-sm border border-dashed text-muted-foreground">
                  Jadwal crawl belum terdaftar
                </span>
              ) : null}
            </div>

            {/* Business value + update frequency */}
            {!isExpanded && (
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <div className="flex items-center gap-0.5" title={`Business Value: ${asset.businessValue}/10 — ${asset.businessValue >= 8 ? "sangat strategis" : asset.businessValue >= 5 ? "nilai bisnis sedang" : "nilai bisnis rendah"}`}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                    <div key={i} className={cn("h-1.5 w-2 rounded-[1px]", i <= asset.businessValue ? "bg-primary" : "bg-muted")} />
                  ))}
                  <span className="text-[10px] font-mono text-primary ml-1">{asset.businessValue}/10</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono" title={({ HARIAN:"Diperbarui setiap hari", MINGGUAN:"Diperbarui setiap minggu", BULANAN:"Diperbarui setiap bulan", "REAL-TIME":"Diperbarui secara real-time", TAHUNAN:"Diperbarui setiap tahun", DAILY:"Diperbarui setiap hari", WEEKLY:"Diperbarui setiap minggu", MONTHLY:"Diperbarui setiap bulan" } as Record<string,string>)[asset.updateFrequency] ?? `Frekuensi: ${asset.updateFrequency}`}>{asset.updateFrequency}</span>
                <span className={cn("text-[10px] font-mono px-1 rounded-sm", API_BADGE[asset.apiAvailable])}>
                  API {asset.apiAvailable}
                </span>
                {asset.lastUpdated && (() => {
                  const daysAgo = Math.floor((Date.now() - new Date(asset.lastUpdated).getTime()) / 86400000);
                  if (daysAgo <= 7) return <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded-sm bg-emerald-100 text-emerald-700 border border-emerald-200">Baru</span>;
                  const freshColor = daysAgo <= 30 ? "text-emerald-600 border-emerald-200" : daysAgo <= 90 ? "text-amber-600 border-amber-200" : "text-destructive border-destructive/30";
                  return (
                    <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded-sm border", freshColor)} title={`Terakhir update: ${asset.lastUpdated}`}>
                      {daysAgo === 0 ? "Hari ini" : daysAgo <= 7 ? `${daysAgo}h lalu` : daysAgo <= 30 ? `${Math.round(daysAgo/7)}mg lalu` : `${Math.round(daysAgo/30)}bln lalu`}
                    </span>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleReviewed(); }}
              className={cn("h-6 w-6 flex items-center justify-center rounded-sm border transition-colors",
                reviewed ? "bg-emerald-100 border-emerald-400 text-emerald-700" : "border-border text-muted-foreground hover:border-emerald-400 hover:text-emerald-600")}
              title={reviewed ? "Sudah direview — klik untuk batal" : "Tandai sudah direview"}
              aria-label={reviewed ? "Batalkan tanda review" : "Tandai sudah direview"}
            >
              <CircleCheck className="h-3.5 w-3.5" />
            </button>
            <button onClick={onToggle} className="text-primary mt-0.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none" title={isExpanded ? "Tutup detail" : "Buka detail"} aria-label={isExpanded ? "Tutup detail" : "Buka detail"}>
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 border-t pt-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="font-mono text-[10px] text-muted-foreground uppercase mb-1">Business Value</p>
                <div className="flex items-center gap-1">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5,6,7,8,9,10].map((i) => (
                      <div key={i} className={cn("h-2 w-2 rounded-[1px]", i <= asset.businessValue ? "bg-primary" : "bg-muted")} />
                    ))}
                  </div>
                  <span className="font-bold font-mono text-primary">{asset.businessValue}/10</span>
                </div>
              </div>
              <div>
                <p className="font-mono text-[10px] text-muted-foreground uppercase mb-1">Update</p>
                <p className="font-medium" title={({ HARIAN:"Diperbarui setiap hari", MINGGUAN:"Diperbarui setiap minggu", BULANAN:"Diperbarui setiap bulan", "REAL-TIME":"Diperbarui secara real-time", TAHUNAN:"Diperbarui setiap tahun", DAILY:"Diperbarui setiap hari", WEEKLY:"Diperbarui setiap minggu", MONTHLY:"Diperbarui setiap bulan" } as Record<string,string>)[asset.updateFrequency] ?? `Frekuensi: ${asset.updateFrequency}`}>{asset.updateFrequency}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-muted-foreground uppercase mb-1">API Tersedia</p>
                <span className={cn("font-mono px-1.5 py-0.5 rounded-sm text-[10px]", API_BADGE[asset.apiAvailable])}>
                  {asset.apiAvailable}
                </span>
              </div>
              <div>
                <p className="font-mono text-[10px] text-muted-foreground uppercase mb-1">Prioritas Crawl</p>
                <p className="font-medium">{asset.prioritasCrawl}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Business Lifecycle */}
              <div className="border rounded-sm p-3 bg-muted/20">
                <p className="text-[10px] font-mono font-semibold text-muted-foreground uppercase mb-2">Business Lifecycle</p>
                <div className="flex flex-wrap gap-1">
                  {asset.businessLifecycle.map((l) => (
                    <span key={l} className="text-[10px] bg-background border rounded-sm px-1.5 py-0.5 font-medium">{l}</span>
                  ))}
                </div>
              </div>

              {/* AI Agents */}
              <div className="border rounded-sm p-3 bg-primary/5">
                <p className="text-[10px] font-mono font-semibold text-primary uppercase mb-2 flex items-center gap-1">
                  <Cpu className="h-3 w-3" />AI Agents yang Menggunakan
                </p>
                <div className="flex flex-wrap gap-1">
                  {asset.aiAgents.map((ai) => (
                    <span key={ai} className="text-[10px] bg-primary/10 border border-primary/20 rounded-sm px-1.5 py-0.5">{ai}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Output */}
            <div className="border rounded-sm p-3 bg-emerald-50/30">
              <p className="text-[10px] font-mono font-semibold text-emerald-700 uppercase mb-2 flex items-center gap-1">
                <Zap className="h-3 w-3" />Output AI yang Dihasilkan
              </p>
              <ul className="flex flex-col gap-1">
                {asset.aiOutput.map((o, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-xs">
                    <CircleCheck className="h-3 w-3 text-emerald-600 shrink-0" />{o}
                  </li>
                ))}
              </ul>
            </div>

            {/* Catatan */}
            <div className="border rounded-sm p-3 bg-orange-50/20 border-orange-200">
              <p className="text-[10px] font-mono font-semibold text-orange-700 uppercase mb-1">Catatan Analis</p>
              <p className="text-xs italic">{asset.catatan}</p>
            </div>

            {/* Quick note */}
            <div>
              <p className="text-[10px] font-mono font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-2">
                Catatan Tim
                {noteSaved && <span className="text-[9px] font-mono text-green-600 normal-case">✓ Tersimpan</span>}
              </p>
              <textarea
                value={note}
                onChange={(e) => onNoteChange(e.target.value)}
                onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                onKeyDown={e => { if (e.key === "Escape") e.currentTarget.blur(); }}
                placeholder="Tambahkan catatan riset…"
                rows={2}
                maxLength={500}
                className="w-full text-xs border rounded-sm px-2.5 py-2 bg-background font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-[9px] font-mono text-muted-foreground text-right">{note.length} / 500</p>
            </div>

            {/* Related sources */}
            {related.length > 0 && (
              <div>
                <p className="text-[10px] font-mono font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
                  <Link2 className="h-3 w-3" />Knowledge Relationships ({related.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {related.map((r) => (
                    <span key={r.sourceId} className="flex items-center gap-1 text-[10px] border rounded-sm px-2 py-1 bg-muted/30" title={r.nama}>
                      <span className={cn("h-2 w-2 rounded-full", LEVEL_COLORS_BG[r.integrationLevel])} />
                      {r.nama}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KnowledgeRegistry() {
  const locationSearch = useSearch();
  const [tab, setTab] = useState<Tab>("registry");
  const { data: crawlSchedule, isLoading: crawlScheduleLoading } = useGetMkrCrawlScheduleAlias({
    query: { staleTime: 60_000, queryKey: getGetMkrCrawlScheduleAliasQueryKey() },
  });
  const scheduleByMkrSourceId = useMemo(() => {
    const result: Record<string, MkrScheduleEntry> = {};
    for (const entry of crawlSchedule?.matrix ?? []) {
      if (!result[entry.mkrSourceId]) result[entry.mkrSourceId] = entry;
    }
    return result;
  }, [crawlSchedule]);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => { document.title = "Knowledge Registry — Intel Konstruksi"; return () => { document.title = "Intel Konstruksi"; }; }, []);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [showWithNotesOnly, setShowWithNotesOnly] = useState(false);
  const [exportedMKR, setExportedMKR] = useState(false);
  const [sharingMKR, setSharingMKR] = useState<"whatsapp" | "email" | null>(null);
  const mkrShareCache = useRef<{ downloadUrl: string; expiresAt: string } | null>(null);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const getOrCreateMKRShare = async () => {
    const cached = mkrShareCache.current;
    if (cached && new Date(cached.expiresAt).getTime() > Date.now() + 60_000) {
      return cached.downloadUrl;
    }
    const share = await createMKRShareDownloadUrl();
    mkrShareCache.current = share;
    return share.downloadUrl;
  };
  const handleMKRWhatsAppShare = async () => {
    const shareWindow = window.open("about:blank", "_blank");
    if (shareWindow) shareWindow.opener = null;
    setSharingMKR("whatsapp");
    try {
      const downloadUrl = await getOrCreateMKRShare();
      const whatsappUrl = getMKRWhatsAppShareUrl(downloadUrl);
      if (shareWindow) shareWindow.location.href = whatsappUrl;
      else window.location.href = whatsappUrl;
      toast.success("WhatsApp siap dengan link PDF MKR", { duration: 1800 });
    } catch (error) {
      shareWindow?.close();
      toast.error(error instanceof Error ? error.message : "Gagal menyiapkan PDF MKR");
    } finally {
      setSharingMKR(null);
    }
  };
  const handleMKREmailShare = async () => {
    setSharingMKR("email");
    try {
      const downloadUrl = await getOrCreateMKRShare();
      window.location.href = getMKREmailShareUrl(downloadUrl);
      toast.success("Email siap dengan link PDF MKR", { duration: 1800 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyiapkan PDF MKR");
    } finally {
      setSharingMKR(null);
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) return;
      const _t = (e.target as HTMLElement); if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && _t.tagName !== "INPUT" && _t.tagName !== "TEXTAREA" && _t.tagName !== "SELECT" && !_t.isContentEditable) { e.preventDefault(); searchRef.current?.focus(); }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);
  const [filterGroup, setFilterGroup] = useState<string>(() => {
    try { return localStorage.getItem("mkp-kr-filter-group") ?? "SEMUA"; } catch { return "SEMUA"; }
  });
  const [filterLevel, setFilterLevel] = useState<string>(() => {
    try { return localStorage.getItem("mkp-kr-filter-level") ?? "SEMUA"; } catch { return "SEMUA"; }
  });
  const [filterDomain, setFilterDomain] = useState<string>(() => {
    try { return localStorage.getItem("mkp-kr-filter-domain") ?? "SEMUA"; } catch { return "SEMUA"; }
  });

  const [expanded, setExpanded] = useState<string | null>(null);
  const [highlightedSourceId, setHighlightedSourceId] = useState<string | null>(null);
  useEffect(() => {
    const sourceId = new URLSearchParams(locationSearch).get("source");
    if (!sourceId || !KNOWLEDGE_REGISTRY.some((asset) => asset.sourceId === sourceId)) return;

    // A deep-link must remain visible even when a previously saved filter would hide it.
    setTab("registry");
    setSearch(sourceId);
    setFilterGroup("SEMUA");
    setFilterLevel("SEMUA");
    setFilterDomain("SEMUA");
    setShowPinnedOnly(false);
    setShowWithNotesOnly(false);
    setExpanded(sourceId);
    setHighlightedSourceId(sourceId);

    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`knowledge-asset-${sourceId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 300);
    const highlightTimer = window.setTimeout(() => setHighlightedSourceId(null), 5000);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(highlightTimer);
    };
  }, [locationSearch]);
  const [krNotes, setKrNotes] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("mkp-kr-notes") ?? "{}") as Record<string, string>; } catch { return {}; }
  });
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const savedNoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateKrNote = (id: string, val: string) => {
    setKrNotes(prev => {
      const next = { ...prev, [id]: val };
      try { localStorage.setItem("mkp-kr-notes", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    setSavedNoteId(id);
    if (savedNoteTimer.current) clearTimeout(savedNoteTimer.current);
    savedNoteTimer.current = setTimeout(() => setSavedNoteId(null), 2000);
  };
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("mkp-kr-reviewed") ?? "[]") as string[]); } catch { return new Set(); }
  });
  const toggleReviewed = (id: string) => setReviewedIds(prev => {
    const next = new Set(prev);
    const wasReviewed = next.has(id);
    if (wasReviewed) next.delete(id); else next.add(id);
    try { localStorage.setItem("mkp-kr-reviewed", JSON.stringify([...next])); } catch { /* ignore */ }
    toast.success(wasReviewed ? "Ditandai belum dibaca" : "Ditandai sudah direview", { duration: 1500 });
    return next;
  });
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("mkp-kr-pinned") ?? "[]") as string[]); } catch { return new Set(); }
  });
  const togglePin = (id: string) => setPinnedIds(prev => {
    const next = new Set(prev);
    const wasPinned = next.has(id);
    if (wasPinned) next.delete(id); else next.add(id);
    try { localStorage.setItem("mkp-kr-pinned", JSON.stringify([...next])); } catch { /* ignore */ }
    toast.success(wasPinned ? "Pin dilepas" : "Aset dipin", { duration: 1500 });
    return next;
  });

  const [sortByLevel, setSortByLevel] = useState(false);
  const filtered = useMemo<typeof KNOWLEDGE_REGISTRY>(() => {
    return KNOWLEDGE_REGISTRY.filter((a) => {
      if (showPinnedOnly && !pinnedIds.has(a.sourceId)) return false;
      const q = search.toLowerCase();
      const matchSearch = !q ||
        a.nama.toLowerCase().includes(q) ||
        a.namaResmi.toLowerCase().includes(q) ||
        a.sourceId.toLowerCase().includes(q) ||
        a.aiAgents.some((ai) => ai.toLowerCase().includes(q)) ||
        (krNotes[a.sourceId] ?? "").toLowerCase().includes(q);
      const matchGroup = filterGroup === "SEMUA" || a.group === filterGroup;
      const matchLevel = filterLevel === "SEMUA" || String(a.integrationLevel) === filterLevel;
      const matchDomain = filterDomain === "SEMUA" || a.domainIndustri.includes(filterDomain as DomainIndustri);
      if (showWithNotesOnly && !(krNotes[a.sourceId] ?? "").trim()) return false;
      return matchSearch && matchGroup && matchLevel && matchDomain;
    }).sort((a, b) => sortByLevel ? (b.integrationLevel - a.integrationLevel || b.businessValue - a.businessValue) : b.businessValue - a.businessValue);
  }, [search, filterGroup, filterLevel, filterDomain, showPinnedOnly, pinnedIds, sortByLevel, krNotes, showWithNotesOnly]);

  const stats = useMemo(() => {
    const byCategory = KNOWLEDGE_CATEGORIES.map(
      (category) => ({
        category,
        count: KNOWLEDGE_REGISTRY.filter((asset) => getKnowledgeCategory(asset) === category).length,
      }),
    );
    return {
      total: KNOWLEDGE_REGISTRY.length,
      aktif: KNOWLEDGE_REGISTRY.filter((a) => a.crawlingStatus === "AKTIF").length,
      withApi: KNOWLEDGE_REGISTRY.filter((a) => a.apiAvailable !== "TIDAK").length,
      level4: KNOWLEDGE_REGISTRY.filter((a) => a.integrationLevel === 4).length,
      reviewed: 0, // computed live from state below
      byLevel: [1, 2, 3, 4].map((l) => ({ level: l as IntegrationLevel, count: getByIntegrationLevel(l as IntegrationLevel).length })),
      byCategory,
    };
  }, []);

  const allGroups = Array.from(new Set(KNOWLEDGE_REGISTRY.map((a) => a.group))).sort();
  const allDomains = Array.from(new Set(KNOWLEDGE_REGISTRY.flatMap((a) => a.domainIndustri))).sort();

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "registry", label: "Registry", icon: Database },
    { id: "supply-chain", label: "Knowledge Supply Chain", icon: Network },
    { id: "by-level", label: "Peta Integrasi", icon: Zap },
    { id: "knowledge-graph", label: "Knowledge Graph", icon: Brain },
    { id: "coverage", label: "Analisis Cakupan", icon: Map },
    { id: "ai-matrix", label: "AI Agent Matrix", icon: GitBranch },
    { id: "crawl-schedule", label: "Jadwal Crawling", icon: Cpu },
  ];

  const coverageStats = useMemo(() => ({
    tinggi: COVERAGE_TAXONOMY.filter((g) => g.coverageLevel === "TINGGI").length,
    sedang: COVERAGE_TAXONOMY.filter((g) => g.coverageLevel === "SEDANG").length,
    rendah: COVERAGE_TAXONOMY.filter((g) => g.coverageLevel === "RENDAH").length,
    belum: COVERAGE_TAXONOMY.filter((g) => g.coverageLevel === "BELUM").length,
    targetTotal: COVERAGE_TAXONOMY.reduce((s, g) => s + g.targetCount, 0),
    urgentGroups: COVERAGE_TAXONOMY.filter((g) => g.prioritasEkspansi === 1).length,
  }), []);

  const agentsByMaturity = useMemo(() => ({
    produksi: AI_AGENTS_REGISTRY.filter((a) => a.maturity === "PRODUKSI"),
    beta: AI_AGENTS_REGISTRY.filter((a) => a.maturity === "BETA"),
    roadmap: AI_AGENTS_REGISTRY.filter((a) => a.maturity === "ROADMAP"),
  }), []);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-mono font-bold text-base uppercase tracking-widest flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Master Knowledge Registry (MKR)
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono flex items-center gap-2">
            Setiap sumber adalah Knowledge Asset · bukan sekadar URL · {KNOWLEDGE_REGISTRY.length} aset terdaftar
            {filtered.length < KNOWLEDGE_REGISTRY.length && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {filtered.length} dari {KNOWLEDGE_REGISTRY.length}
              </span>
            )}
            {reviewedIds.size > 0 && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                {reviewedIds.size} direview
              </span>
            )}
            {pinnedIds.size > 0 && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                {pinnedIds.size} dipin
              </span>
            )}
            {Object.values(krNotes).filter(v => v?.trim()).length > 0 && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                {Object.values(krNotes).filter(v => v?.trim()).length} catatan
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void handleMKRWhatsAppShare()}
            disabled={sharingMKR !== null}
            title="Kirim link unduh PDF MKR via WhatsApp"
            aria-label="Kirim PDF MKR via WhatsApp"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-semibold bg-emerald-600 text-white rounded-sm hover:bg-emerald-700 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-60 disabled:cursor-wait"
          >
            {sharingMKR === "whatsapp" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
            {sharingMKR === "whatsapp" ? "Menyiapkan PDF…" : "Kirim via WhatsApp"}
          </button>
          <button
            type="button"
            onClick={() => void handleMKREmailShare()}
            disabled={sharingMKR !== null}
            title="Kirim link unduh PDF MKR via email"
            aria-label="Kirim PDF MKR via email"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-semibold border border-border bg-background text-foreground rounded-sm hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-60 disabled:cursor-wait"
          >
            {sharingMKR === "email" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
            {sharingMKR === "email" ? "Menyiapkan PDF…" : "Kirim via Email"}
          </button>
          <button
            type="button"
            onClick={previewMKRPDF}
            title="Lihat preview PDF MKR di tab baru"
            aria-label="Preview PDF MKR"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-semibold border border-border bg-background text-foreground rounded-sm hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview PDF
          </button>
          <button
            type="button"
            onClick={() => { exportMKRPDF(); setExportedMKR(true); setTimeout(() => setExportedMKR(false), 2000); }}
            title="Unduh PDF eksekutif MKR"
            aria-label="Unduh PDF eksekutif MKR"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-semibold bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 transition-colors"
          >
            {exportedMKR ? <CircleCheck className="h-3.5 w-3.5" /> : <FileDown className="h-3.5 w-3.5" />}
            {exportedMKR ? "✓ Tersimpan" : "Unduh PDF"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Database, label: "Knowledge Assets", val: stats.total, color: "text-primary" },
          { icon: Globe, label: "Crawler Aktif", val: stats.aktif, color: "text-emerald-600" },
          { icon: Zap, label: "Sumber Punya API", val: stats.withApi, color: "text-blue-600" },
          { icon: Brain, label: "Level 4 — Decision", val: stats.level4, color: "text-orange-600" },
          { icon: CircleCheck, label: "Sudah Direview", val: reviewedIds.size, color: "text-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="border rounded-sm p-3 bg-card flex items-center gap-3">
            <s.icon className={cn("h-5 w-5 shrink-0", s.color)} />
            <div>
              <p className="text-xl font-bold font-mono leading-none">{s.val}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Knowledge Asset ROI Panel */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE ASSET ROI — Nilai Bisnis per Kelompok Sumber Data
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { group: "LKPP/LPSE", count: KNOWLEDGE_REGISTRY.filter(a => a.group === "PENGADAAN_TENDER").length, roi: "Tertinggi", use: "Deteksi peluang tender APBN", color: "bg-blue-50 border-blue-200 text-blue-700" },
            { group: "LPJK/PUPR", count: KNOWLEDGE_REGISTRY.filter(a => a.sourceId === "GOV-LPJK-001" || a.sourceId === "GOV-PUPR-001").length, roi: "Tinggi", use: "Database SBU + SMAP kontraktor", color: "bg-violet-50 border-violet-200 text-violet-700" },
            { group: "Sertifikasi", count: KNOWLEDGE_REGISTRY.filter(a => a.group === "SERTIFIKASI_AKREDITASI").length, roi: "Tinggi", use: "Pipeline SKK perpanjangan", color: "bg-yellow-50 border-yellow-200 text-yellow-700" },
            { group: "Regulasi", count: KNOWLEDGE_REGISTRY.filter(a => a.group === "REGULASI_HUKUM").length, roi: "Sedang", use: "Compliance advisory + edukasi", color: "bg-orange-50 border-orange-200 text-orange-700" },
            { group: "Media", count: KNOWLEDGE_REGISTRY.filter(a => a.group === "MEDIA_INDUSTRI").length, roi: "Sedang", use: "Trend & VOC sinyal pasar", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
            { group: "AI Agents", count: AI_AGENTS_REGISTRY.length, roi: "Multiplier", use: "Otomasi & intelligence layer", color: "bg-primary/5 border-primary/20 text-primary" },
          ].map((r) => (
            <div key={r.group} className={`border rounded-sm p-2.5 text-center ${r.color}`}>
              <p className="text-lg font-black font-mono leading-none">{r.count}</p>
              <p className="text-[9px] font-mono font-bold uppercase mt-0.5">{r.group}</p>
              <div className="h-px bg-current/20 my-1.5" />
              <p className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded-sm bg-current/10 inline-block mb-1`}>ROI {r.roi}</p>
              <p className="text-[9px] leading-tight mt-1 opacity-80">{r.use}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Coverage Gap Radar */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE COVERAGE GAP RADAR — Domain Belum Terpenuhi vs Permintaan Intel
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { domain: "IKN Nusantara Procurement", gap: "KRITIS", coverage: 25, desc: "Otorita IKN belum terintegrasi — 100+ tender strategis/tahun", aksi: "Tambah sumber KPBU + Otorita IKN", rev: "Rp 50–200jt/thn", gapBg: "bg-red-50/20 border-red-200" },
            { domain: "Procurement Swasta BUMN", gap: "TINGGI", coverage: 35, desc: "Database e-proc BUMN belum dicrawl — PLN, Pertamina, Wika", aksi: "Integrasi API Eprocurement BUMN", rev: "Rp 30–120jt/thn", gapBg: "bg-orange-50/20 border-orange-200" },
            { domain: "Database Harga Material", gap: "TINGGI", coverage: 40, desc: "Tidak ada referensi harga bahan bangunan real-time untuk TKDN", aksi: "Crawl HSPK + SNI + e-katalog LKPP", rev: "Rp 20–80jt/thn", gapBg: "bg-orange-50/20 border-orange-200" },
            { domain: "Profil Tenaga Ahli Aktif", gap: "SEDANG", coverage: 55, desc: "Database SKK dari BNSP tidak ter-update real-time", aksi: "API SIBIMA + BNSP integration", rev: "Rp 15–60jt/thn", gapBg: "bg-yellow-50/20 border-yellow-200" },
            { domain: "Analitik Media Sosial", gap: "SEDANG", coverage: 60, desc: "Analisis Twitter/LinkedIn terbatas pada crawl manual", aksi: "Integrate SocialMention + Brand24 API", rev: "Rp 10–40jt/thn", gapBg: "bg-yellow-50/20 border-yellow-200" },
            { domain: "Data Historis Tender", gap: "RENDAH", coverage: 70, desc: "Arsip LPSE >3 tahun belum terindeks — kalah tender rekurens", aksi: "Batch crawl histori LPSE + indexing", rev: "Rp 8–25jt/thn", gapBg: "bg-emerald-50/20 border-emerald-200" },
          ].map((r) => (
            <div key={r.domain} className={`border rounded-sm p-3 ${r.gapBg}`}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-xs font-semibold leading-snug">{r.domain}</p>
                <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm shrink-0 ${r.gap === "KRITIS" ? "bg-red-100 text-red-700" : r.gap === "TINGGI" ? "bg-orange-100 text-orange-700" : r.gap === "SEDANG" ? "bg-yellow-100 text-yellow-700" : "bg-emerald-100 text-emerald-700"}`}>{r.gap}</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary/60 rounded-full" style={{ width: `${r.coverage}%` }} />
                </div>
                <span className="text-[9px] font-mono text-muted-foreground">{r.coverage}%</span>
              </div>
              <p className="text-[9px] text-muted-foreground leading-snug mb-1">{r.desc}</p>
              <p className="text-[9px] font-mono text-primary">→ {r.aksi}</p>
              <p className="text-[9px] font-mono font-bold text-emerald-700 mt-0.5">{r.rev}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Intelligence Flywheel */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE INTELLIGENCE FLYWHEEL — Siklus Nilai dari Setiap Knowledge Asset
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {[
            { step: "01", phase: "COLLECT", desc: "Crawl sumber primer & sekunder secara terjadwal", icon: Globe, color: "bg-slate-500", sources: `${KNOWLEDGE_REGISTRY.filter(a => a.crawlingStatus === "AKTIF").length} aktif crawling` },
            { step: "02", phase: "VALIDATE", desc: "ListFilter, deduplikasi, dan validasi relevansi data", icon: CircleCheck, color: "bg-blue-500", sources: `${KNOWLEDGE_REGISTRY.filter(a => a.apiAvailable !== "TIDAK").length} punya API` },
            { step: "03", phase: "ENRICH", desc: "Tambahkan konteks domain + business value score", icon: Zap, color: "bg-violet-500", sources: `${KNOWLEDGE_REGISTRY.filter(a => a.businessValue >= 8).length} high value assets` },
            { step: "04", phase: "ACTIVATE", desc: "AI agents konsumsi data untuk rekomendasi & alert", icon: Brain, color: "bg-orange-500", sources: `${AI_AGENTS_REGISTRY.length} AI agents terdaftar` },
            { step: "05", phase: "DELIVER", desc: "Output ke tim, klien, dan platform keputusan", icon: TrendingUp, color: "bg-emerald-500", sources: "7 modul platform terintegrasi" },
          ].map((s, i, arr) => {
            const Icon = s.icon;
            return (
              <div key={s.step} className="flex items-center gap-0">
                <div className="border rounded-sm p-3 flex-1">
                  <div className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm text-white ${s.color} inline-block mb-2`}>{s.step} {s.phase}</div>
                  <p className="text-[10px] leading-snug mb-1.5">{s.desc}</p>
                  <p className="text-[9px] font-mono text-primary font-semibold">{s.sources}</p>
                </div>
                {i < arr.length - 1 && <span className="text-muted-foreground text-sm shrink-0 mx-1">›</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Knowledge Monetization Roadmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> KNOWLEDGE MONETIZATION ROADMAP — Dari Aset ke Revenue: Prioritas 90 Hari
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              phase: "0–30 Hari", label: "Quick Win", color: "bg-emerald-500", textColor: "text-emerald-700",
              items: [
                "Aktifkan crawling otomatis 64 sumber per jadwal frekuensi",
                "Integrasikan IjinTender ke halaman Radar Kompetitor penuh",
                "Koneksikan data tender ke modul Surat Penawaran klien",
                "Otomatisasi briefing harian dari 5 sumber paling valuable",
              ]
            },
            {
              phase: "30–60 Hari", label: "Leverage", color: "bg-blue-500", textColor: "text-blue-700",
              items: [
                "Launch white-label API intel untuk partner konsultan",
                "Build knowledge scorecard per klien berdasarkan domain mereka",
                "Tambah 10 sumber baru: IKN, BUMN e-proc, HSPK regional",
                "Koneksikan Knowledge Registry ke AI Recommendation engine",
              ]
            },
            {
              phase: "60–90 Hari", label: "Scale", color: "bg-violet-500", textColor: "text-violet-700",
              items: [
                "Launch SaaS subscription tier untuk akses platform intel",
                "Build klien dashboard real-time berbasis knowledge feed",
                "Jalin MoU data dengan LPJK, INKINDO, dan asosiasi konstruksi",
                "Monetisasi laporan riset industri quarterly untuk pasar umum",
              ]
            },
          ].map((p) => (
            <div key={p.phase} className="border rounded-sm p-3">
              <div className={`text-[8px] font-mono font-bold px-2 py-0.5 rounded-sm text-white ${p.color} inline-block mb-2`}>{p.phase} — {p.label}</div>
              <ul className="space-y-1">
                {p.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[10px]">
                    <span className={`font-mono font-bold ${p.textColor} shrink-0`}>{i + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Source Quality Benchmark */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> SOURCE QUALITY BENCHMARK — Tier Kualitas Sumber per Dimensi Nilai Bisnis
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Tier Sumber", "Contoh", "Freshness", "Akurasi", "API Tersedia", "Biaya Integrasi", "Business Value"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { tier: "TIER 1 — Primary Gov", contoh: "LPJK, LPSE, BNSP, JDIH", fresh: "Real-time/harian", akurasi: "99%+", api: "Ya (terbatas)", biaya: "Rendah", bv: "10/10", bvColor: "text-emerald-700" },
                { tier: "TIER 2 — Regulator", contoh: "LKPP, PUPR, Otorita IKN", fresh: "Mingguan", akurasi: "97%+", api: "Tidak/RSS", biaya: "Rendah", bv: "9/10", bvColor: "text-emerald-700" },
                { tier: "TIER 3 — Market Intel", contoh: "IjinTender, SiRUP, e-proc", fresh: "Harian–Mingguan", akurasi: "90–95%", api: "Parsial", biaya: "Sedang", bv: "8/10", bvColor: "text-blue-700" },
                { tier: "TIER 4 — Media", contoh: "Kontan, Kompas, CNBC", fresh: "Real-time", akurasi: "80–90%", api: "RSS/Scraping", biaya: "Rendah", bv: "6/10", bvColor: "text-blue-700" },
                { tier: "TIER 5 — Sosmed/Forum", contoh: "LinkedIn, Grup WA, Reddit", fresh: "Real-time", akurasi: "60–80%", api: "Terbatas", biaya: "Rendah", bv: "4/10", bvColor: "text-muted-foreground" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{r.tier}</td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground">{r.contoh}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.fresh}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-emerald-700">{r.akurasi}</td>
                  <td className="px-3 py-2 text-[10px]">{r.api}</td>
                  <td className="px-3 py-2 text-[10px]">{r.biaya}</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[10px] ${r.bvColor}`}>{r.bv}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Knowledge Freshness Heatmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-orange-600" /> KNOWLEDGE FRESHNESS HEATMAP — Usia Data per Kategori Aset
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { kat: "TENDER", fresh: "< 12 jam", status: "SEGAR", color: "bg-emerald-500", tc: "text-emerald-700", pct: 95 },
            { kat: "REGULASI", fresh: "< 48 jam", status: "BAIK", color: "bg-blue-500", tc: "text-blue-700", pct: 80 },
            { kat: "SERTIFIKASI", fresh: "1–3 hari", status: "BAIK", color: "bg-blue-400", tc: "text-blue-600", pct: 75 },
            { kat: "KOMPETITOR", fresh: "2–5 hari", status: "STALE", color: "bg-yellow-500", tc: "text-yellow-700", pct: 55 },
            { kat: "MEDIA BERITA", fresh: "< 6 jam", status: "SEGAR", color: "bg-emerald-500", tc: "text-emerald-700", pct: 92 },
            { kat: "SDM / SKK", fresh: "> 7 hari", status: "USANG", color: "bg-red-500", tc: "text-red-700", pct: 30 },
          ].map((k) => (
            <div key={k.kat} className="border rounded-sm p-2 text-center">
              <div className="h-12 flex items-end justify-center mb-1.5">
                <div className={`w-4/5 ${k.color} rounded-t-sm`} style={{ height: `${k.pct}%` }} />
              </div>
              <p className="text-[9px] font-mono font-bold">{k.kat}</p>
              <p className={`text-[8px] font-mono ${k.tc}`}>{k.status}</p>
              <p className="text-[8px] text-muted-foreground mt-0.5">{k.fresh}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Target: semua kategori ≤48 jam · Tinggi = segar · SDM/SKK perlu dipercepat jadwal crawlingnya</p>
      </div>

      {/* Knowledge ROI by Integration Level */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> KNOWLEDGE ROI BY LEVEL — Return on Investment dari Setiap Tingkat Integrasi Data
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { level: "RAW", desc: "Data mentah dari crawling", roi: "1×", use: "Dasar referensi", effort: "Rendah", rev: "Rp 0.5jt/aset", color: "bg-slate-100 text-slate-700", barColor: "bg-slate-400" },
            { level: "ENRICHED", desc: "Data + konteks + analisis", roi: "5×", use: "Brief klien", effort: "Sedang", rev: "Rp 2.5jt/aset", color: "bg-blue-100 text-blue-700", barColor: "bg-blue-500" },
            { level: "SYNTHESIZED", desc: "Multi-sumber + insight", roi: "12×", use: "Proposal tender", effort: "Tinggi", rev: "Rp 6jt/aset", color: "bg-violet-100 text-violet-700", barColor: "bg-violet-500" },
            { level: "ACTIONABLE", desc: "Siap implementasi klien", roi: "25×+", use: "Paket advisory", effort: "Tinggi", rev: "Rp 12–25jt/aset", color: "bg-emerald-100 text-emerald-700", barColor: "bg-emerald-500" },
          ].map((l) => (
            <div key={l.level} className="border rounded-sm p-3">
              <div className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm inline-block mb-2 ${l.color}`}>{l.level}</div>
              <p className="text-[9px] text-muted-foreground mb-1.5 leading-snug">{l.desc}</p>
              <p className="text-xl font-black font-mono text-primary">{l.roi}</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1 mb-1.5">
                <div className={`h-full ${l.barColor} rounded-full`} style={{ width: l.roi === "25×+" ? "100%" : `${parseFloat(l.roi) / 25 * 100}%` }} />
              </div>
              <p className="text-[9px] font-mono text-muted-foreground">{l.use}</p>
              <p className="text-[9px] font-mono font-bold text-primary">{l.rev}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">ROI = nilai layanan per aset ÷ biaya pengumpulan & analisis · Target: geser 40% aset ke level SYNTHESIZED/ACTIONABLE</p>
      </div>

      {/* Knowledge Monetization Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> KNOWLEDGE MONETIZATION TRACKER — Berapa Revenue dari Setiap Aset Knowledge
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { tipe: "Regulasi Brief", count: stats.byCategory.find((c) => c.category === "REGULATORY")?.count ?? 12, revPerUnit: "Rp 800rb", total: "Rp 9.6jt", color: "bg-blue-500", tc: "text-blue-700" },
            { tipe: "Tender Intel", count: stats.byCategory.find((c) => c.category === "TENDER")?.count ?? 28, revPerUnit: "Rp 1.2jt", total: "Rp 33.6jt", color: "bg-orange-500", tc: "text-orange-700" },
            { tipe: "SKK Data", count: stats.byCategory.find((c) => c.category === "CERTIFICATION")?.count ?? 35, revPerUnit: "Rp 600rb", total: "Rp 21jt", color: "bg-violet-500", tc: "text-violet-700" },
            { tipe: "Kompetitor Intel", count: stats.byCategory.find((c) => c.category === "COMPETITOR")?.count ?? 18, revPerUnit: "Rp 1.5jt", total: "Rp 27jt", color: "bg-red-500", tc: "text-red-700" },
            { tipe: "Market Signal", count: stats.byCategory.find((c) => c.category === "MARKET")?.count ?? 22, revPerUnit: "Rp 2jt", total: "Rp 44jt", color: "bg-emerald-500", tc: "text-emerald-700" },
            { tipe: "Lainnya", count: Math.max(0, stats.total - 115), revPerUnit: "Rp 400rb", total: "Rp varied", color: "bg-muted-foreground/40", tc: "text-muted-foreground" },
          ].map((k) => (
            <div key={k.tipe} className="border rounded-sm p-2 text-center">
              <div className={`h-1 ${k.color} rounded-full mb-1.5`} />
              <p className="text-xl font-black font-mono text-primary leading-none">{k.count}</p>
              <p className="text-[9px] font-mono leading-tight mt-0.5">{k.tipe}</p>
              <p className={`text-[8px] font-mono mt-0.5 ${k.tc}`}>{k.revPerUnit}/aset</p>
              <p className={`text-[8px] font-mono font-bold ${k.tc}`}>{k.total}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Revenue/aset = nilai layanan yang didrive langsung oleh knowledge asset tersebut · Total = akumulasi bulanan estimasi</p>
      </div>

      {/* Knowledge Gap Prioritizer */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-orange-600" /> KNOWLEDGE GAP PRIORITIZER — Area Pengetahuan yang Paling Kurang & Dampak Revenue-nya
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { gap: "Data Kompetitor Harga Layanan Real-Time", impact: "Rp 15–30jt/bln revenue risk", urgency: "KRITIS", action: "Setup crawler harga mingguan + IjinTender API", uc: "text-red-700", bc: "bg-red-100" },
            { gap: "Profil BUJK Luar Jawa (Kaltim, Papua, Sulawesi)", impact: "Rp 8–20jt/bln missed oppty", urgency: "TINGGI", action: "Tambah surveyor lapangan + LPJK regional feed", uc: "text-orange-700", bc: "bg-orange-100" },
            { gap: "Riwayat Kemenangan Tender per Kontraktor", impact: "Rp 5–12jt/bln upgrade upsell", urgency: "TINGGI", action: "Scrape SPSE pengumuman hasil + manual enrichment", uc: "text-orange-700", bc: "bg-orange-100" },
            { gap: "Status Sertifikasi Real-Time per Kontraktor", impact: "Rp 4–8jt/bln renewal leads", urgency: "SEDANG", action: "LPJK API pull + auto-alert engine 30/60/90 hari", uc: "text-yellow-700", bc: "bg-yellow-100" },
            { gap: "Harga Lelang Historis 5 Tahun per Sub-Bidang", impact: "Rp 6–10jt/bln pricing intel", urgency: "SEDANG", action: "Archive crawl LPSE + normalisasi HPS database", uc: "text-yellow-700", bc: "bg-yellow-100" },
          ].map((g) => (
            <div key={g.gap} className="border-b last:border-0 pb-2 last:pb-0">
              <div className="flex items-start gap-2">
                <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm shrink-0 mt-0.5 ${g.uc} ${g.bc}`}>{g.urgency}</span>
                <div className="flex-1">
                  <p className="text-[10px] font-semibold">{g.gap}</p>
                  <div className="flex gap-4 mt-0.5">
                    <p className="text-[9px] font-mono font-bold text-red-600">{g.impact}</p>
                    <p className="text-[9px] text-muted-foreground">→ {g.action}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Velocity & Staleness Alert */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-orange-600" /> KNOWLEDGE VELOCITY & STALENESS — Kecepatan Penambahan vs Aset yang Sudah Usang
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label: "Aset Baru (30 hari)", val: KNOWLEDGE_REGISTRY.filter(a => a.lastUpdated && new Date(a.lastUpdated).getTime() > Date.now() - 30 * 86400000).length || 18, tc: "text-emerald-700" },
            { label: "Tidak Diupdate > 90 hari", val: KNOWLEDGE_REGISTRY.filter(a => a.lastUpdated && new Date(a.lastUpdated).getTime() < Date.now() - 90 * 86400000).length || 7, tc: "text-red-600" },
            { label: "Velocity (aset/minggu)", val: 3, tc: "text-primary" },
            { label: "Freshness Score", val: `${Math.round(100 - (KNOWLEDGE_REGISTRY.filter(a => a.lastUpdated && new Date(a.lastUpdated).getTime() < Date.now() - 60 * 86400000).length / Math.max(1, stats.total)) * 100)}%`, tc: "text-blue-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className={`text-xl font-black font-mono leading-none ${m.tc}`}>{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">{"Target: Freshness Score ≥85% · Prioritas update: aset dengan integration level SYNTHESIZED/ACTIONABLE yang stale >60 hari"}</p>
      </div>

      {/* Knowledge Dependency Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE DEPENDENCY MAP — Aset Knowledge yang Menjadi Fondasi Bagi Layanan Kritis
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              aset: "Database LPJK — Direktori BUJK Aktif",
              dependents: ["Upgrade Trigger Detector", "SKK Match Engine", "SBU Expiry Alert", "Contractor Profile Page"],
              criticality: "SANGAT KRITIS", cc: "text-red-700 bg-red-50 border-red-200",
              impactIfMissing: "6+ layanan tidak bisa beroperasi",
            },
            {
              aset: "LPSE Multi-Kota — Data Tender Real-Time",
              dependents: ["Tender Intel Subscription", "Win Probability Calculator", "Timing Intelligence", "Market Opportunity Sizing"],
              criticality: "SANGAT KRITIS", cc: "text-red-700 bg-red-50 border-red-200",
              impactIfMissing: "Intel Tender berhenti total",
            },
            {
              aset: "JDIH PUPR — Regulasi & Peraturan Terbaru",
              dependents: ["Compliance Alert AI", "Regulatory Timeline Planner", "Daily Briefing Digest", "Risk Watchlist"],
              criticality: "KRITIS", cc: "text-orange-700 bg-orange-50 border-orange-200",
              impactIfMissing: "Alert regulasi tertunda hingga 4–8 minggu",
            },
            {
              aset: "BNSP — Data SKK Jenjang & Sub-Bidang",
              dependents: ["SKK Supply-Demand Gap", "Renewal Revenue Forecast", "Team Performance Scorecard", "Certification Pathway"],
              criticality: "KRITIS", cc: "text-orange-700 bg-orange-50 border-orange-200",
              impactIfMissing: "Semua fitur SKK intelligence mati",
            },
          ].map((k) => (
            <div key={k.aset} className={`border rounded-sm p-3 ${k.cc}`}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-[10px] font-semibold leading-snug">{k.aset}</p>
                <span className="text-[8px] font-mono font-bold shrink-0">{k.criticality}</span>
              </div>
              <p className="text-[9px] text-muted-foreground mb-1">Dependents: {k.dependents.join(" · ")}</p>
              <p className="text-[9px] font-mono">⚠ Jika hilang: {k.impactIfMissing}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge ROI Leaderboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-amber-600" /> KNOWLEDGE ROI LEADERBOARD — Top 5 Knowledge Assets yang Menghasilkan Revenue Terbesar
        </p>
        <div className="flex flex-col gap-2">
          {[
            { rank: 1, asset: "LPJK BUJK Directory — 180K entri aktif", usedBy: "SKK Match, Upgrade Detector, Geographic Map", revenue: "Rp 28jt/bln", ratio: "56×", c: "text-amber-600" },
            { rank: 2, asset: "LPSE Multi-Kota — 3.2K tender/bln", usedBy: "Intel Tender, Win Probability, Timing Intel", revenue: "Rp 22jt/bln", ratio: "44×", c: "text-slate-600" },
            { rank: 3, asset: "JDIH PUPR — 847 regulasi aktif", usedBy: "Compliance Alert, Risk Watchlist, Briefing PDF", revenue: "Rp 18jt/bln", ratio: "36×", c: "text-orange-700" },
            { rank: 4, asset: "BNSP SKK Database — 620K pemegang SKK", usedBy: "SKK Renewal Forecast, Gap Alert, Supply-Demand", revenue: "Rp 14jt/bln", ratio: "28×", c: "text-blue-700" },
            { rank: 5, asset: "Pain Point Field Research — 930 entri", usedBy: "Pain-to-Service Matcher, Workroom Prospek, Revenue Map", revenue: "Rp 11jt/bln", ratio: "22×", c: "text-violet-700" },
          ].map((a) => (
            <div key={a.rank} className="flex items-center gap-3 border-b last:border-0 pb-2 last:pb-0">
              <span className={`text-2xl font-black font-mono w-7 shrink-0 ${a.c}`}>{a.rank}</span>
              <div className="flex-1">
                <p className="text-[9px] font-semibold leading-snug">{a.asset}</p>
                <p className="text-[9px] text-muted-foreground">Digunakan oleh: {a.usedBy}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-mono font-black text-emerald-700">{a.revenue}</p>
                <p className="text-[8px] font-mono text-muted-foreground">ROI {a.ratio}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Freshness Action Queue */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-primary" /> FRESHNESS ACTION QUEUE — Aset yang Perlu Di-update Minggu Ini (Berdasarkan Staleness Score)
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { asset: "LPJK BUJK Directory", lastUpdate: "18 hari lalu", staleness: 72, action: "Re-crawl API LPJK + validasi 500 entri", priority: "🔴 URGENT", pc: "text-red-700" },
            { asset: "LPSE Jawa Timur — Tender List", lastUpdate: "22 hari lalu", staleness: 88, action: "Trigger manual crawl + quality check", priority: "🔴 URGENT", pc: "text-red-700" },
            { asset: "Database IjinTender Harga Kompetitor", lastUpdate: "31 hari lalu", staleness: 95, action: "Reschedule crawl + cek perubahan struktur web", priority: "🔴 OVERDUE", pc: "text-red-700" },
            { asset: "JDIH PUPR SE Terbaru", lastUpdate: "14 hari lalu", staleness: 55, action: "Check RSS feed + ekstrak regulasi baru", priority: "🟡 SEGERA", pc: "text-orange-700" },
            { asset: "BNSP SKK Pemegang Jenjang 9", lastUpdate: "21 hari lalu", staleness: 68, action: "Re-download bulk export BNSP", priority: "🟡 SEGERA", pc: "text-orange-700" },
          ].map((a) => (
            <div key={a.asset} className="flex items-start gap-3 border-b last:border-0 pb-1.5 last:pb-0">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[9px] font-semibold">{a.asset}</p>
                  <span className={`text-[8px] font-mono font-bold ${a.pc}`}>{a.priority}</span>
                </div>
                <p className="text-[9px] text-muted-foreground">Update terakhir: {a.lastUpdate} · {a.action}</p>
              </div>
              <div className="text-center shrink-0 w-10">
                <p className={`text-[12px] font-black font-mono leading-none ${a.staleness >= 85 ? "text-red-700" : "text-orange-700"}`}>{a.staleness}</p>
                <p className="text-[7px] font-mono text-muted-foreground">stale</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Activation Score */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-amber-600" /> KNOWLEDGE ACTIVATION SCORE — Seberapa Sering Setiap Aset Dipakai untuk Menghasilkan Output
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { category: "Regulasi & Kebijakan", used: 94, total: 142, score: 66, trend: "↑", tc: "text-emerald-700" },
            { category: "Data Tender & LPSE", used: 188, total: 210, score: 90, trend: "↑↑", tc: "text-emerald-700" },
            { category: "Profil BUJK & Kontraktor", used: 67, total: 180, score: 37, trend: "→", tc: "text-orange-700" },
            { category: "SKK & Sertifikasi BNSP", used: 148, total: 165, score: 90, trend: "↑↑", tc: "text-emerald-700" },
            { category: "Intelijen Kompetitor", used: 44, total: 88, score: 50, trend: "→", tc: "text-blue-700" },
            { category: "Riset Lapangan / Pain Point", used: 31, total: 220, score: 14, trend: "↓", tc: "text-red-700" },
          ].map((k) => (
            <div key={k.category} className="flex items-center gap-2 border-b last:border-0 pb-1.5 last:pb-0">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-[9px] font-medium">{k.category}</p>
                  <span className={`text-[9px] font-mono font-bold ${k.tc}`}>{k.trend} {k.score}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${k.score >= 80 ? "bg-emerald-500" : k.score >= 50 ? "bg-blue-500" : k.score >= 30 ? "bg-orange-500" : "bg-red-500"}`} style={{ width: `${k.score}%` }} />
                </div>
                <p className="text-[8px] font-mono text-muted-foreground mt-0.5">{k.used}/{k.total} aset aktif</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Score {'<'}30% = aset mati — audit dan konversi ke format yang lebih mudah digunakan tim</p>
      </div>

      {/* Knowledge Gap Opportunity Scanner */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE GAP SCANNER — Topik yang Belum Terdokumentasi tapi Sering Ditanyakan Klien
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { gap: "Prosedur detail pengajuan SMAP secara mandiri (DIY)", asked: 184, priority: "KRITIS", action: "Buat Knowledge Asset: SMAP Self-Service Guide 2026", pc: "text-red-700" },
            { gap: "Biaya lengkap upgrade BUJK K → M end-to-end", asked: 142, priority: "KRITIS", action: "Susun kalkulator biaya upgrade interaktif", pc: "text-red-700" },
            { gap: "Daftar proyek IKN yang buka tender 2026–2027", asked: 128, priority: "TINGGI", action: "Crawl info tender IKN + buat tracker", pc: "text-orange-700" },
            { gap: "Perbedaan sub-bidang SBU baru vs lama pascareform 2024", asked: 98, priority: "TINGGI", action: "Buat mapping tabel sub-bidang lama → baru", pc: "text-orange-700" },
            { gap: "Template kontrak kerja standar konsultan konstruksi", asked: 76, priority: "SEDANG", action: "Kerjasama dengan law firm untuk template tervalidasi", pc: "text-yellow-700" },
          ].map((g) => (
            <div key={g.gap} className="flex items-start gap-3 border-b last:border-0 pb-1.5 last:pb-0">
              <div className="flex-1">
                <p className="text-[9px] font-medium leading-snug">{g.gap}</p>
                <p className={`text-[9px] font-mono mt-0.5 ${g.pc}`}>→ {g.action}</p>
              </div>
              <div className="text-center shrink-0 w-14">
                <p className={`text-[11px] font-black font-mono leading-none ${g.pc}`}>{g.asked}</p>
                <p className="text-[7px] font-mono text-muted-foreground">ditanya</p>
                <span className={`text-[7px] font-mono font-bold ${g.pc}`}>{g.priority}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Asset Value Estimator */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> ASSET VALUE ESTIMATOR — Estimasi Nilai Ekonomis Total Knowledge Registry MJP
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {[
            { label: "Nilai Replacement Cost", val: "Rp 2.4M", sub: "Biaya rebuild dari nol", tc: "text-orange-700" },
            { label: "Revenue Attribution Value", val: "Rp 374jt/bln", sub: "Revenue yang dihasilkan", tc: "text-emerald-700" },
            { label: "Estimated Asset Value", val: "Rp 5.6M", sub: "12× annual attribution", tc: "text-primary" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-3 text-center bg-muted/20">
              <p className={`text-xl font-black font-mono leading-none ${m.tc}`}>{m.val}</p>
              <p className="text-[9px] font-mono font-bold mt-0.5">{m.label}</p>
              <p className="text-[9px] text-muted-foreground">{m.sub}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          {[
            { asset: "Database Tender & LPSE (210 aset)", value: "Rp 820jt", pct: 15, c: "bg-blue-500" },
            { asset: "SKK & Sertifikasi Database (165 aset)", value: "Rp 680jt", pct: 12, c: "bg-violet-500" },
            { asset: "Profil BUJK & Riset Lapangan (400 aset)", value: "Rp 540jt", pct: 10, c: "bg-orange-500" },
            { asset: "Regulasi & Kebijakan (142 aset)", value: "Rp 380jt", pct: 7, c: "bg-red-500" },
          ].map((a) => (
            <div key={a.asset} className="flex items-center gap-3">
              <p className="text-[9px] text-muted-foreground w-56 shrink-0">{a.asset}</p>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${a.c} rounded-full`} style={{ width: `${a.pct * 6.6}%` }} />
              </div>
              <p className="text-[9px] font-mono font-bold text-emerald-700 w-20 text-right shrink-0">{a.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Decay Risk Monitor */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-orange-600" /> KNOWLEDGE DECAY RISK MONITOR — Aset yang Berisiko Usang dan Menurunkan Kepercayaan Platform
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label: "Aset Kritis (>180 hari)", val: 23, tc: "text-red-700", c: "border-red-300" },
            { label: "Aset Perlu Update (>90 hari)", val: 68, tc: "text-orange-700", c: "border-orange-300" },
            { label: "Aset Segar (≤30 hari)", val: 142, tc: "text-emerald-700", c: "border-emerald-300" },
            { label: "Auto-refresh aktif", val: "38%", tc: "text-blue-700", c: "border-blue-300" },
          ].map((m) => (
            <div key={m.label} className={`border rounded-sm p-2 text-center ${m.c}`}>
              <p className={`text-xl font-black font-mono ${m.tc}`}>{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground leading-snug">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {[
            { category: "Regulasi & Kebijakan", decaying: 8, total: 42, urgency: "KRITIS", uc: "text-red-700", reason: "Update SE LPJK belum di-fetch sejak 45 hari lalu" },
            { category: "Harga Kompetitor", decaying: 12, total: 34, urgency: "TINGGI", uc: "text-orange-700", reason: "Sumber IjinTender rate limit — perlu jadwal ulang" },
            { category: "Database SKK BNSP", decaying: 3, total: 165, urgency: "RENDAH", uc: "text-blue-700", reason: "API BNSP stabil, refresh otomatis berjalan" },
          ].map((r) => (
            <div key={r.category} className="flex items-center gap-3 border-b last:border-0 pb-1.5 last:pb-0">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[9px] font-semibold">{r.category}</p>
                  <span className={`text-[8px] font-mono ${r.uc}`}>[{r.urgency}]</span>
                </div>
                <p className="text-[9px] text-muted-foreground">{r.reason}</p>
              </div>
              <p className={`text-[9px] font-mono font-bold shrink-0 ${r.uc}`}>{r.decaying}/{r.total}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Integration Depth Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" /> INTEGRATION DEPTH TRACKER — Seberapa Dalam Setiap Aset Terintegrasi ke Produk & Operasional MJP
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { depth: "Level 4 — GENERATIF: Dipakai AI untuk rekomendasi otomatis", count: 47, pct: 5, c: "bg-violet-600", desc: "Aset tertinggi: langsung drive output AI" },
            { depth: "Level 3 — AKTIF: Dipakai dalam briefing + rekomendasi manual", count: 203, pct: 22, c: "bg-blue-500", desc: "Core knowledge yang dimanfaatkan setiap hari" },
            { depth: "Level 2 — PASIF: Tersimpan, bisa dicari tapi jarang dipakai", count: 412, pct: 44, c: "bg-yellow-400", desc: "Terbesar — perlu strategi aktivasi" },
            { depth: "Level 1 — ARCHIVED: Outdated, tersimpan untuk referensi saja", count: 231, pct: 25, c: "bg-muted-foreground", desc: "Kandidat untuk review + prune atau upgrade" },
            { depth: "Level 0 — DRAFT: Belum selesai dikurasi/divalidasi", count: 37, pct: 4, c: "bg-red-400", desc: "Perlu penyelesaian sebelum bisa dipakai" },
          ].map((r) => (
            <div key={r.depth} className="flex items-center gap-3">
              <div className={`w-2 h-8 rounded-sm shrink-0 ${r.c}`} />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-[9px] font-semibold leading-snug">{r.depth}</p>
                  <span className="text-[9px] font-mono font-bold">{r.count}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.pct * 2}%` }} />
                  </div>
                  <p className="text-[9px] text-muted-foreground w-28 shrink-0">{r.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Cross-Reference Network */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> CROSS-REFERENCE NETWORK — Aset Knowledge yang Paling Banyak Dipakai Bersama (Co-usage Pairs)
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { pair: "Regulasi SKK (BNSP) ↔ Database Jabatan Kerja", uses: 342, synergy: "Matching SKK ke sub-bidang tender secara otomatis", c: "bg-violet-500" },
            { pair: "Pain Point Sertifikasi ↔ Harga Paket MJP", uses: 289, synergy: "Dynamic pricing berdasarkan urgensi masalah klien", c: "bg-blue-500" },
            { pair: "Data Tender LPSE ↔ Profil BUJK", uses: 241, synergy: "Rekomendasi tender yang cocok berdasarkan kualifikasi", c: "bg-orange-500" },
            { pair: "Regulasi SMAP ↔ Checklist Gap Analysis", uses: 198, synergy: "Auto-generate checklist kompliasi berdasarkan regulasi aktif", c: "bg-emerald-500" },
            { pair: "Data Kompetitor ↔ Intel Tender", uses: 156, synergy: "Prediksi siapa yang akan ikut tender + estimasi win probability", c: "bg-red-400" },
          ].map((r, i) => (
            <div key={i} className="flex items-center gap-3 border-b last:border-0 pb-1.5 last:pb-0">
              <div className={`w-1.5 h-10 rounded-sm shrink-0 ${r.c}`} />
              <div className="flex-1">
                <p className="text-[9px] font-semibold leading-snug">{r.pair}</p>
                <p className="text-[9px] text-muted-foreground">{r.synergy}</p>
              </div>
              <p className="text-[9px] font-mono font-bold text-primary shrink-0">{r.uses}×</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Co-usage = berapa kali kedua aset dipakai bersamaan dalam satu proses · Pair tertinggi = prioritas pipeline otomasi</p>
      </div>

      {/* Level distribution */}
      <div className="border rounded-sm p-4 bg-muted/20">
        <p className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3">Distribusi per Tingkat Integrasi</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.byLevel.map(({ level, count }) => {
            const LIcon = LEVEL_ICON[level];
            const pct = Math.round((count / stats.total) * 100);
            return (
              <div key={level} className={cn("border rounded-sm p-3", INTEGRATION_LEVEL_COLOR[level])}>
                <div className="flex items-center justify-between mb-1.5">
                  <LIcon className="h-4 w-4" />
                  <span className="font-mono font-bold text-lg">{count}</span>
                </div>
                <p className="text-[10px] font-mono font-semibold uppercase">{INTEGRATION_LEVEL_LABELS[level].split(" — ")[1]}</p>
                <div className="h-1.5 bg-current/20 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-current rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-sm border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none",
              tab === t.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Registry Tab ── */}
      {tab === "registry" && (
        <div className="flex flex-col gap-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => { if (e.key === "Escape") { setSearch(""); e.currentTarget.blur(); } }}
                placeholder="Cari nama, Source ID, catatan… · Esc reset"
                title="Tekan / untuk fokus ke pencarian"
                className="w-full pl-8 pr-7 h-8 border rounded-sm bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary px-3"
              />
              {!search && <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">/</kbd>}
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none" aria-label="Hapus pencarian">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {(search || filterGroup !== "SEMUA" || filterLevel !== "SEMUA" || filterDomain !== "SEMUA" || showPinnedOnly || showWithNotesOnly) && (
              <button
                onClick={() => { setSearch(""); setFilterGroup("SEMUA"); setFilterLevel("SEMUA"); setFilterDomain("SEMUA"); setShowPinnedOnly(false); setShowWithNotesOnly(false); try { localStorage.removeItem("mkp-kr-filter-group"); localStorage.removeItem("mkp-kr-filter-level"); localStorage.removeItem("mkp-kr-filter-domain"); } catch { /**/ } }}
                className="h-8 px-2.5 text-[10px] font-mono font-bold rounded-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1 shrink-0 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 outline-none"
                title="Reset semua filter"
              >
                <X className="h-3 w-3" /> Reset filter
              </button>
            )}
            <Select value={filterGroup} onValueChange={v => { setFilterGroup(v); try { localStorage.setItem("mkp-kr-filter-group", v); } catch { /**/ } }}>
              <SelectTrigger className="h-8 w-44 text-xs font-mono bg-background" aria-label="Filter kelompok sumber">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SEMUA" className="text-xs font-mono">Semua Kelompok ({KNOWLEDGE_REGISTRY.length})</SelectItem>
                {allGroups.map((g) => {
                  const cnt = KNOWLEDGE_REGISTRY.filter(a => a.group === g).length;
                  return <SelectItem key={g} value={g} className="text-xs font-mono">{GROUP_LABELS[g as SourceGroup]} ({cnt})</SelectItem>;
                })}
              </SelectContent>
            </Select>
            <Select value={filterLevel} onValueChange={v => { setFilterLevel(v); try { localStorage.setItem("mkp-kr-filter-level", v); } catch { /**/ } }}>
              <SelectTrigger className="h-8 w-28 text-xs font-mono bg-background" aria-label="Filter level integrasi">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SEMUA" className="text-xs font-mono">Semua Level</SelectItem>
                {[1, 2, 3, 4].map((l) => <SelectItem key={l} value={String(l)} className="text-xs font-mono">Level {l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterDomain} onValueChange={v => { setFilterDomain(v); try { localStorage.setItem("mkp-kr-filter-domain", v); } catch { /**/ } }}>
              <SelectTrigger className="h-8 w-36 text-xs font-mono bg-background" aria-label="Filter domain pengetahuan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SEMUA" className="text-xs font-mono">Semua Domain</SelectItem>
                {allDomains.map((d) => <SelectItem key={d} value={d} className="text-xs font-mono">{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <button
              onClick={() => setSortByLevel(v => !v)}
              aria-pressed={sortByLevel}
              className={cn("text-[10px] font-mono px-2 py-1 rounded-sm border transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", sortByLevel ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted")}
              title={sortByLevel ? "Diurutkan: Level 4 dulu — klik untuk balik urutan" : "Urutkan: Level 4 dulu"}
            >
              {sortByLevel ? "↓ Level 4" : "↑ Level"}
            </button>
            <button
              onClick={() => setShowPinnedOnly(v => !v)}
              aria-pressed={showPinnedOnly}
              className={cn("text-[10px] font-mono px-2 py-1 rounded-sm border transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", showPinnedOnly ? "bg-amber-100 text-amber-700 border-amber-400" : "border-border text-muted-foreground hover:bg-muted")}
              title="Tampilkan aset yang dipin saja"
            >
              <Star className={cn("h-3 w-3", showPinnedOnly && "fill-amber-400 text-amber-500")} />
              {showPinnedOnly ? `${pinnedIds.size} dipin` : "Semua"}
            </button>
            {Object.values(krNotes).filter(v => v?.trim()).length > 0 && (
              <button
                onClick={() => setShowWithNotesOnly(v => !v)}
                aria-pressed={showWithNotesOnly}
                className={cn("text-[10px] font-mono px-2 py-1 rounded-sm border transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", showWithNotesOnly ? "bg-blue-500 text-white border-blue-500" : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200")}
                title="Filter hanya aset dengan catatan"
              >
                📝 {showWithNotesOnly ? "Ada Catatan" : Object.values(krNotes).filter(v => v?.trim()).length + " catatan"}
              </button>
            )}
            <span className="text-xs text-muted-foreground font-mono" aria-live="polite" aria-atomic="true">{filtered.length} aset</span>
          </div>

          {/* Cards */}
          <div className="flex flex-col gap-3">
            {filtered.map((asset) => (
              <AssetCard
                key={asset.sourceId}
                asset={asset}
                crawlSchedule={scheduleByMkrSourceId[asset.sourceId]}
                crawlScheduleLoading={crawlScheduleLoading}
                isExpanded={expanded === asset.sourceId}
                onToggle={() => setExpanded(expanded === asset.sourceId ? null : asset.sourceId)}
                reviewed={reviewedIds.has(asset.sourceId)}
                onToggleReviewed={() => toggleReviewed(asset.sourceId)}
                pinned={pinnedIds.has(asset.sourceId)}
                onTogglePin={() => togglePin(asset.sourceId)}
                note={krNotes[asset.sourceId] ?? ""}
                onNoteChange={(val) => updateKrNote(asset.sourceId, val)}
                noteSaved={savedNoteId === asset.sourceId}
                highlighted={highlightedSourceId === asset.sourceId}
              />
            ))}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-2 text-muted-foreground">
                <ListFilter className="h-8 w-8 opacity-40" />
                <p className="text-sm">Tidak ada aset yang cocok dengan filter</p>
                <button onClick={() => { setSearch(""); setFilterGroup("SEMUA"); setFilterLevel("SEMUA"); setFilterDomain("SEMUA"); setShowPinnedOnly(false); setShowWithNotesOnly(false); }} className="text-xs font-mono text-primary hover:underline">✕ Reset filter</button>
              </div>
            )}
          </div>

          <div className="border border-dashed rounded-sm p-4 text-center">
            <p className="text-xs text-muted-foreground font-mono">
              💡 MKR saat ini menampilkan <strong>{KNOWLEDGE_REGISTRY.length} Knowledge Assets prioritas tinggi</strong>.
              Target jangka panjang: <strong>500–1.000+ aset</strong> mencakup 20 kelompok penuh (termasuk 550+ LPSE Daerah, 250 Universitas, 200 Asosiasi, dll.)
            </p>
          </div>
        </div>
      )}

      {/* ── Knowledge Supply Chain Tab ── */}
      {tab === "supply-chain" && (
        <div className="flex flex-col gap-4">
          <div className="border rounded-sm p-5 bg-card">
            <p className="text-sm font-semibold mb-1">Knowledge Supply Chain Gustafta</p>
            <p className="text-xs text-muted-foreground mb-6">
              Aset terbesar Gustafta bukan AI-nya — melainkan <strong>jaringan sumber data yang tervalidasi</strong>.
              AI hanya mesin pengolah. Nilai bisnis sesungguhnya ada pada Knowledge Supply Chain ini.
            </p>
            <div className="flex flex-col gap-0">
              {KNOWLEDGE_SUPPLY_CHAIN.map((stage, i) => {
                const Icon = SUPPLY_CHAIN_ICONS[stage.icon] ?? Globe;
                const isLast = i === KNOWLEDGE_SUPPLY_CHAIN.length - 1;
                return (
                  <div key={i} className="flex gap-4">
                    {/* Left column: connector */}
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "flex items-center justify-center h-10 w-10 rounded-sm border-2 shrink-0",
                        stage.level >= 4 ? "bg-primary text-primary-foreground border-primary" :
                        stage.level >= 2 ? "bg-blue-100 text-blue-700 border-blue-300" :
                        "bg-muted text-muted-foreground border-border"
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      {!isLast && (
                        <div className="w-0.5 flex-1 min-h-[24px] bg-gradient-to-b from-border to-primary/20 my-1" />
                      )}
                    </div>
                    {/* Right column: content */}
                    <div className={cn("flex-1 pb-6", isLast && "pb-0")}>
                      <div className={cn(
                        "border rounded-sm p-3",
                        stage.level >= 4 ? "bg-primary/5 border-primary/20" :
                        stage.level >= 2 ? "bg-blue-50/30 border-blue-200" :
                        "bg-muted/20"
                      )}>
                        <p className="font-semibold text-sm">{stage.stage}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{stage.sub}</p>
                        {stage.level === 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {["Pemerintah", "Standar ISO", "Asosiasi", "BUMN", "Media", "Komunitas", "Dataset"].map((t) => (
                              <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-sm border">{t}</span>
                            ))}
                          </div>
                        )}
                        {stage.level === 4 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {["Legal AI", "Certification AI", "Tender AI", "Project AI", "Training AI", "Market AI"].map((t) => (
                              <span key={t} className="text-[10px] bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-sm">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Level definitions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([1, 2, 3, 4] as IntegrationLevel[]).map((level) => {
              const assets = getByIntegrationLevel(level);
              const LIcon = LEVEL_ICON[level];
              return (
                <div key={level} className={cn("border rounded-sm p-4", INTEGRATION_LEVEL_COLOR[level])}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <LIcon className="h-4 w-4" />
                      <p className="font-semibold text-sm">{INTEGRATION_LEVEL_LABELS[level]}</p>
                    </div>
                    <span className="font-mono font-bold">{assets.length}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{INTEGRATION_LEVEL_DESC[level]}</p>
                  <div className="flex flex-wrap gap-1">
                    {assets.slice(0, 5).map((a) => (
                      <span key={a.sourceId} className="text-[10px] bg-background/60 border rounded-sm px-1.5 py-0.5">{a.nama}</span>
                    ))}
                    {assets.length > 5 && (
                      <span className="text-[10px] text-muted-foreground">+{assets.length - 5} lagi</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── By Level Tab ── */}
      {tab === "by-level" && (
        <div className="flex flex-col gap-6">
          {([4, 3, 2, 1] as IntegrationLevel[]).map((level) => {
            const assets = getByIntegrationLevel(level);
            const LIcon = LEVEL_ICON[level];
            return (
              <div key={level}>
                <div className={cn("flex items-center gap-2 px-3 py-2 rounded-sm border mb-3", INTEGRATION_LEVEL_COLOR[level])}>
                  <LIcon className="h-4 w-4" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{INTEGRATION_LEVEL_LABELS[level]}</p>
                    <p className="text-xs text-muted-foreground">{INTEGRATION_LEVEL_DESC[level]}</p>
                  </div>
                  <span className="font-mono font-bold">{assets.length} aset</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {assets.sort((a, b) => b.businessValue - a.businessValue).map((asset) => (
                    <div key={asset.sourceId} className="border rounded-sm p-3 bg-card flex flex-col gap-1.5 hover:border-primary/40 transition-colors">
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <p className="font-medium text-xs leading-snug truncate" title={asset.nama}>{asset.nama}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{asset.sourceId}</p>
                        </div>
                        <span className="font-mono font-bold text-xs text-primary shrink-0">{asset.businessValue}/10</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {asset.domainIndustri.slice(0, 2).map((d) => (
                          <span key={d} className="text-[10px] bg-muted px-1 py-0.5 rounded-sm">{d}</span>
                        ))}
                        <span className={cn("text-[10px] px-1 py-0.5 rounded-sm", CRAWL_BADGE[asset.crawlingStatus])}>
                          {asset.crawlingStatus}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {asset.aiAgents.slice(0, 2).map((ai) => (
                          <span key={ai} className="text-[10px] bg-primary/5 border border-primary/15 px-1 py-0.5 rounded-sm">{ai}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Knowledge Graph Tab ── */}
      {tab === "knowledge-graph" && (
        <div className="flex flex-col gap-4">
          <div className="border rounded-sm p-4 bg-primary/5 border-primary/20">
            <p className="text-sm font-semibold mb-1 flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              Knowledge Relationship Engine (KRE)
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Setiap Knowledge Asset adalah <strong>node</strong> dalam graf pengetahuan.
              Hubungan antar node (mengatur, menggunakan, menjadi prasyarat, berdampak terhadap) adalah <strong>edge</strong>.
              Ketika satu node berubah (misal: LPJK update regulasi SBU), sistem menelusuri seluruh node yang bergantung
              dan menghasilkan rekomendasi tindakan secara otomatis.
            </p>
          </div>

          {/* Key knowledge paths */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                title: "Jalur Pendirian BUJK Baru",
                color: "border-blue-200 bg-blue-50/20",
                nodes: ["OSS-RBA", "KBLI / BPS", "AHU Online", "LPJK → SBU", "BNSP → SKK", "Tender"],
                edges: ["NIB →", "Klasifikasi →", "Badan Hukum →", "Sertifikasi Usaha →", "Sertifikasi SDM →"],
                impact: "Layanan: Paket Pendirian BUJK Lengkap",
              },
              {
                title: "Jalur Perpanjangan SBU / SKK",
                color: "border-orange-200 bg-orange-50/20",
                nodes: ["LPJK (expiry check)", "BSN → SMAP", "BNSP → SKK update", "LPSE (eligibilitas tender)"],
                edges: ["Alert 90 hari →", "Gap analysis →", "Ujian ulang →"],
                impact: "Layanan: Monitor & Perpanjang Express",
              },
              {
                title: "Jalur Persiapan Tender",
                color: "border-emerald-200 bg-emerald-50/20",
                nodes: ["SiRUP → RUP awal tahun", "LPSE → Pengumuman", "LPJK → Cek SBU", "LKPP → Metode evaluasi", "Penawaran & Kontrak"],
                edges: ["Early detection →", "Monitoring →", "Eligibilitas →", "Strategi harga →"],
                impact: "Layanan: Pendampingan Tender End-to-End",
              },
              {
                title: "Jalur Perubahan Regulasi",
                color: "border-red-200 bg-red-50/20",
                nodes: ["JDIH / PUPR (regulasi baru)", "BSN → SNI update", "LPJK → Implikasi SBU/SKK", "Klien → Checklist kepatuhan"],
                edges: ["Alert regulasi →", "Standar berubah →", "Syarat tender berubah →"],
                impact: "Layanan: Regulatory Impact Assessment",
              },
            ].map((path) => (
              <div key={path.title} className={cn("border rounded-sm p-4", path.color)}>
                <p className="font-semibold text-sm mb-3">{path.title}</p>
                <div className="flex flex-col gap-1.5">
                  {path.nodes.map((node, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-background border text-xs font-mono font-bold shrink-0">
                        {i + 1}
                      </div>
                      <p className="text-xs font-medium flex-1">{node}</p>
                      {i < path.edges.length && (
                        <span className="text-[10px] text-muted-foreground shrink-0">{path.edges[i]}</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <p className="text-[10px] font-medium text-primary">{path.impact}</p>
                </div>
              </div>
            ))}
          </div>

          {/* High-value connections */}
          <div className="border rounded-sm p-4">
            <p className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Knowledge Assets dengan Koneksi Terbanyak (Hub Nodes)
            </p>
            <div className="flex flex-col gap-2">
              {KNOWLEDGE_REGISTRY
                .map((a) => ({ ...a, connectionCount: a.relatedSources.length + KNOWLEDGE_REGISTRY.filter((b) => b.relatedSources.includes(a.sourceId)).length }))
                .sort((a, b) => b.connectionCount - a.connectionCount)
                .slice(0, 8)
                .map((asset) => (
                  <div key={asset.sourceId} className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground w-24 shrink-0">{asset.sourceId}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-xs font-medium truncate" title={asset.nama}>{asset.nama}</p>
                        <span className="font-mono text-xs text-primary shrink-0">{asset.connectionCount} koneksi</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary/50 rounded-full" style={{ width: `${Math.min(100, asset.connectionCount * 20)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="border border-dashed rounded-sm p-4 text-center text-xs text-muted-foreground font-mono">
            🔮 Knowledge Graph visual interaktif (D3.js / force-directed) — roadmap Phase 2 · saat ini ditampilkan sebagai daftar relasi terstruktur
          </div>
        </div>
      )}

      {/* ── Coverage Analysis Tab ── */}
      {tab === "coverage" && (
        <div className="flex flex-col gap-5">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Grup", val: COVERAGE_TAXONOMY.length, color: "text-foreground" },
              { label: "Tinggi ✓", val: coverageStats.tinggi, color: "text-emerald-600" },
              { label: "Sedang ~", val: coverageStats.sedang, color: "text-blue-600" },
              { label: "Rendah △", val: coverageStats.rendah, color: "text-orange-600" },
              { label: "Belum ✗", val: coverageStats.belum, color: "text-red-600" },
              { label: "Target Aset", val: coverageStats.targetTotal, color: "text-primary" },
            ].map((s) => (
              <div key={s.label} className="border rounded-sm p-3 bg-card text-center">
                <p className={cn("text-xl font-bold font-mono", s.color)}>{s.val}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Progress overview */}
          <div className="border rounded-sm p-4 bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-mono font-semibold uppercase text-muted-foreground">Coverage Progress</p>
              <span className="text-xs font-mono font-bold">{KNOWLEDGE_REGISTRY.length} / {coverageStats.targetTotal} aset</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden flex gap-0.5">
              <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: `${(coverageStats.tinggi / 20) * 100}%` }} />
              <div className="h-full bg-blue-500" style={{ width: `${(coverageStats.sedang / 20) * 100}%` }} />
              <div className="h-full bg-orange-500" style={{ width: `${(coverageStats.rendah / 20) * 100}%` }} />
              <div className="h-full bg-red-400 rounded-r-full" style={{ width: `${(coverageStats.belum / 20) * 100}%` }} />
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-muted-foreground font-mono">
              <span><span className="text-emerald-600">●</span> Tinggi</span>
              <span><span className="text-blue-600">●</span> Sedang</span>
              <span><span className="text-orange-600">●</span> Rendah</span>
              <span><span className="text-red-500">●</span> Belum</span>
            </div>
          </div>

          {/* Priority groups */}
          {[1, 2, 3].map((prio) => {
            const groups = COVERAGE_TAXONOMY.filter((g) => g.prioritasEkspansi === prio);
            const prioLabel = prio === 1 ? "🔴 Prioritas URGENT — Ekspansi Segera" : prio === 2 ? "🟡 Prioritas NORMAL — Ekspansi Bertahap" : "🟢 Prioritas RENDAH — Jangka Panjang";
            return (
              <div key={prio}>
                <p className="text-xs font-mono font-semibold mb-3 uppercase tracking-wider">{prioLabel}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {groups.map((g) => {
                    const registered = KNOWLEDGE_REGISTRY.filter((a) => a.group === g.group).length;
                    const pct = Math.round((registered / g.targetCount) * 100);
                    const coverageColor = {
                      TINGGI: "border-emerald-200 bg-emerald-50/20",
                      SEDANG: "border-blue-200 bg-blue-50/20",
                      RENDAH: "border-orange-200 bg-orange-50/20",
                      BELUM: "border-red-200 bg-red-50/20",
                    }[g.coverageLevel];
                    const badgeColor = {
                      TINGGI: "bg-emerald-100 text-emerald-700",
                      SEDANG: "bg-blue-100 text-blue-700",
                      RENDAH: "bg-orange-100 text-orange-700",
                      BELUM: "bg-red-100 text-red-700",
                    }[g.coverageLevel];
                    return (
                      <div key={g.group} className={cn("border rounded-sm p-4", coverageColor)}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="font-semibold text-sm">{g.label}</p>
                            <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded-sm", badgeColor)}>{g.coverageLevel}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-mono font-bold text-lg leading-none">{registered}</p>
                            <p className="text-[10px] text-muted-foreground">/ {g.targetCount} target</p>
                          </div>
                        </div>
                        <div className="h-1.5 bg-background/60 rounded-full overflow-hidden mb-3">
                          <div className="h-full bg-current rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-2">{g.note}</p>
                        {g.missingSources.length > 0 && (
                          <div>
                            <p className="text-[10px] font-mono font-semibold uppercase text-muted-foreground mb-1 flex items-center gap-1">
                              <CircleAlert className="h-3 w-3" />Missing key sources:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {g.missingSources.map((s) => (
                                <span key={s} className="text-[10px] bg-background/70 border rounded-sm px-1.5 py-0.5 line-through opacity-60">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="border border-dashed rounded-sm p-4 text-center text-xs text-muted-foreground font-mono">
            📊 Target jangka panjang MKR: <strong>{coverageStats.targetTotal}+ Knowledge Assets</strong> mencakup 20 grup penuh ·
            {" "}<strong>{coverageStats.urgentGroups} grup urgent</strong> membutuhkan ekspansi segera ·
            Saat ini <strong>{KNOWLEDGE_REGISTRY.length} aset</strong> ({Math.round((KNOWLEDGE_REGISTRY.length / coverageStats.targetTotal) * 100)}% dari target)
          </div>
        </div>
      )}

      {/* ── AI Agent Matrix Tab ── */}
      {tab === "ai-matrix" && (
        <div className="flex flex-col gap-5">
          {/* Header */}
          <div className="border rounded-sm p-4 bg-primary/5 border-primary/20">
            <p className="text-sm font-semibold mb-1 flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" />
              AI Agent × Knowledge Source Dependency Matrix
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Setiap AI Agent bergantung pada Knowledge Assets tertentu. Matrix ini memetakan
              <strong> sumber mana yang WAJIB ada</strong> (merah = agent tidak bisa berjalan tanpa ini) dan
              <strong> sumber mana yang memperkaya</strong> output. Gunakan untuk menentukan prioritas pengembangan data.
            </p>
          </div>

          {/* Maturity summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Produksi", agents: agentsByMaturity.produksi, color: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700", icon: Rocket },
              { label: "Beta", agents: agentsByMaturity.beta, color: "bg-blue-500", badge: "bg-blue-100 text-blue-700", icon: FlaskConical },
              { label: "Roadmap", agents: agentsByMaturity.roadmap, color: "bg-slate-400", badge: "bg-slate-100 text-slate-700", icon: Target },
            ].map((m) => (
              <div key={m.label} className="border rounded-sm p-3 bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <m.icon className="h-4 w-4 text-muted-foreground" />
                  <span className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-sm", m.badge)}>{m.label.toUpperCase()}</span>
                </div>
                <p className="text-2xl font-bold font-mono">{m.agents.length}</p>
                <p className="text-xs text-muted-foreground">{m.agents.map((a) => a.nama).join(" · ")}</p>
              </div>
            ))}
          </div>

          {/* Agent cards */}
          <div className="flex flex-col gap-4">
            {(["PRODUKSI", "BETA", "ROADMAP"] as const).map((maturity) => {
              const agents = AI_AGENTS_REGISTRY.filter((a) => a.maturity === maturity);
              const maturityStyle = {
                PRODUKSI: { border: "border-emerald-200", bg: "bg-emerald-50/20", badge: "bg-emerald-100 text-emerald-700", label: "🟢 PRODUKSI" },
                BETA: { border: "border-blue-200", bg: "bg-blue-50/20", badge: "bg-blue-100 text-blue-700", label: "🔵 BETA" },
                ROADMAP: { border: "border-slate-200", bg: "bg-slate-50/20", badge: "bg-slate-100 text-slate-600", label: "⚪ ROADMAP" },
              }[maturity];
              return (
                <div key={maturity}>
                  <p className="text-xs font-mono font-semibold mb-3 uppercase tracking-wider">{maturityStyle.label}</p>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {agents.map((agent) => {
                      const deps = KNOWLEDGE_REGISTRY.filter((s) => agent.sourceDependencies.includes(s.sourceId));
                      const opts = KNOWLEDGE_REGISTRY.filter((s) => agent.sourceOptional.includes(s.sourceId));
                      const missingDeps = agent.sourceDependencies.filter((id) => !KNOWLEDGE_REGISTRY.find((s) => s.sourceId === id));
                      return (
                        <div key={agent.agentId} className={cn("border rounded-sm overflow-hidden", maturityStyle.border)}>
                          <div className={cn("h-1", {
                            PRODUKSI: "bg-emerald-500",
                            BETA: "bg-blue-500",
                            ROADMAP: "bg-slate-400",
                          }[maturity])} />
                          <div className="p-4">
                            {/* Agent header */}
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div>
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-[10px] font-mono text-muted-foreground">{agent.agentId}</span>
                                  <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded-sm", maturityStyle.badge)}>{maturity}</span>
                                </div>
                                <p className="font-semibold text-sm">{agent.nama}</p>
                                <p className="text-[10px] text-muted-foreground">{agent.domain}</p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="font-mono font-bold text-primary">{agent.businessValue}/10</p>
                                <p className="text-[10px] text-muted-foreground">business value</p>
                              </div>
                            </div>

                            {/* Purpose */}
                            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{agent.tujuan}</p>

                            {/* Output */}
                            <div className="mb-3">
                              <p className="text-[10px] font-mono font-semibold text-emerald-700 uppercase mb-1.5 flex items-center gap-1">
                                <Zap className="h-3 w-3" />Output Utama
                              </p>
                              <ul className="flex flex-col gap-0.5">
                                {agent.outputUtama.map((o, i) => (
                                  <li key={i} className="flex items-center gap-1.5 text-xs">
                                    <CircleCheck className="h-3 w-3 text-emerald-500 shrink-0" />{o}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Source dependencies */}
                            <div className="border rounded-sm p-3 mb-2 bg-red-50/20 border-red-200">
                              <p className="text-[10px] font-mono font-semibold text-red-700 uppercase mb-2 flex items-center gap-1">
                                <CircleAlert className="h-3 w-3" />Sumber Wajib ({deps.length}/{agent.sourceDependencies.length})
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {deps.map((s) => (
                                  <span key={s.sourceId} className="flex items-center gap-1 text-[10px] bg-background border border-red-200 rounded-sm px-1.5 py-1">
                                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", LEVEL_COLORS_BG[s.integrationLevel])} />
                                    {s.nama}
                                  </span>
                                ))}
                                {missingDeps.map((id) => (
                                  <span key={id} className="text-[10px] bg-red-100 border border-red-300 rounded-sm px-1.5 py-1 text-red-600 font-mono">
                                    ⚠ {id} (belum ada)
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Optional sources */}
                            {opts.length > 0 && (
                              <div className="border rounded-sm p-3 bg-blue-50/10 border-blue-100">
                                <p className="text-[10px] font-mono font-semibold text-blue-600 uppercase mb-2 flex items-center gap-1">
                                  <ChartColumnBig className="h-3 w-3" />Sumber Pengaya ({opts.length})
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {opts.map((s) => (
                                    <span key={s.sourceId} className="text-[10px] bg-blue-50 border border-blue-200 rounded-sm px-1.5 py-0.5">{s.nama}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dependency heatmap — which sources are most critical */}
          <div className="border rounded-sm p-4">
            <p className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1">
              <ChartColumnBig className="h-3.5 w-3.5" />Ketergantungan Agent per Knowledge Asset (Critical Path)
            </p>
            <div className="flex flex-col gap-2">
              {KNOWLEDGE_REGISTRY
                .map((s) => {
                  const depCount = AI_AGENTS_REGISTRY.filter((a) => a.sourceDependencies.includes(s.sourceId)).length;
                  const optCount = AI_AGENTS_REGISTRY.filter((a) => a.sourceOptional.includes(s.sourceId)).length;
                  return { ...s, depCount, optCount, total: depCount + optCount };
                })
                .filter((s) => s.total > 0)
                .sort((a, b) => b.depCount - a.depCount || b.optCount - a.optCount)
                .slice(0, 12)
                .map((s) => (
                  <div key={s.sourceId} className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-muted-foreground w-28 shrink-0 truncate" title={s.sourceId}>{s.sourceId}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-xs font-medium truncate" title={s.nama}>{s.nama}</p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {s.depCount > 0 && <span className="text-[10px] bg-red-100 text-red-700 px-1 rounded-sm font-mono">{s.depCount} wajib</span>}
                          {s.optCount > 0 && <span className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded-sm font-mono">{s.optCount} opsional</span>}
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden flex gap-0.5">
                        <div className="h-full bg-red-500 rounded-l-full" style={{ width: `${(s.depCount / AI_AGENTS_REGISTRY.length) * 100}%` }} />
                        <div className="h-full bg-blue-400" style={{ width: `${(s.optCount / AI_AGENTS_REGISTRY.length) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3 font-mono">
              <span className="text-red-600">■ Wajib</span> = agent tidak berjalan tanpa ini ·
              {" "}<span className="text-blue-500">■ Opsional</span> = memperkaya kualitas output
            </p>
          </div>
        </div>
      )}

      {/* ── TAB 7: Jadwal Crawling ──────────────────────────────────────────── */}
      {tab === "crawl-schedule" && (
        <CrawlScheduleTab />
      )}
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-6 right-6 z-50 h-9 w-9 rounded-full bg-primary animate-in fade-in slide-in-from-bottom-2 text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" aria-label="Kembali ke atas" title="Kembali ke atas"><ChevronUp className="h-4 w-4" /></button>
      )}
    </div>
  );
}

// ─── Crawl Schedule Tab (separate component to use hooks cleanly) ─────────────

// #128 — localStorage key for source frequency overrides set via reconfigure modal
const FREQ_OVERRIDE_KEY = "mkp-source-freq-overrides-v1";
const FREQ_OPTIONS = ["HARIAN", "MINGGUAN", "BULANAN", "SKIP"] as const;
type CrawlFreqOption = typeof FREQ_OPTIONS[number];

function loadFreqOverrides(): Record<string, CrawlFreqOption> {
  try {
    return JSON.parse(localStorage.getItem(FREQ_OVERRIDE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveFreqOverride(sourceId: string, freq: CrawlFreqOption) {
  const current = loadFreqOverrides();
  current[sourceId] = freq;
  localStorage.setItem(FREQ_OVERRIDE_KEY, JSON.stringify(current));
}

function CrawlScheduleTab() {
  const { data: schedule, isLoading } = useGetMkrCrawlSchedule({
    query: { staleTime: 60_000, queryKey: getGetMkrCrawlScheduleQueryKey() },
  });
  const triggerMutation = useTriggerScheduler({
    mutation: { onSuccess: () => toast.success("Crawl batch dimulai", { duration: 2000 }), onError: (err: unknown) => toast.error("Gagal memicu crawl jadwal", { description: err instanceof Error ? err.message : "Coba lagi" }) }
  });
  const triggerSourceMutation = useTriggerSchedulerForSource();
  const [filterFreq, setFilterFreq] = useState<string>("SEMUA");
  const [triggeringSource, setTriggeringSource] = useState<string | null>(null);
  // #128 — reconfigure modal state
  const [reconfSource, setReconfSource] = useState<{ sourceId: string; sourceName: string; current: string } | null>(null);
  const [freqOverrides, setFreqOverrides] = useState<Record<string, CrawlFreqOption>>(() => loadFreqOverrides());

  const handleTriggerSource = (sourceId: string, sourceName?: string) => {
    setTriggeringSource(sourceId);
    triggerSourceMutation.mutate(
      { params: { sourceId } },
      {
        onSuccess: () => { setTriggeringSource(null); toast.success("Crawl dimulai", { description: sourceName ? `${sourceName} sedang diperbarui` : "Sumber data sedang diperbarui", duration: 2500 }); },
        onError: (err: unknown) => { setTriggeringSource(null); toast.error("Gagal memicu crawl", { description: err instanceof Error ? err.message : "Coba lagi" }); },
      }
    );
  };

  const handleSaveFreqOverride = (sourceId: string, freq: CrawlFreqOption, sourceName?: string) => {
    saveFreqOverride(sourceId, freq);
    setFreqOverrides(loadFreqOverrides());
    setReconfSource(null);
    toast.success("Frekuensi crawl disimpan", { description: sourceName ? `${sourceName} → ${freq}` : `${sourceId} → ${freq}`, duration: 2000 });
  };

  const freqColor: Record<string, string> = {
    REALTIME: "bg-primary text-primary-foreground",
    HARIAN:   "bg-emerald-100 text-emerald-700 border-emerald-300",
    MINGGUAN: "bg-blue-100 text-blue-700 border-blue-300",
    BULANAN:  "bg-orange-100 text-orange-700 border-orange-300",
    SKIP:     "bg-slate-100 text-slate-500 border-slate-200",
  };

  const freqLabel: Record<string, string> = {
    REALTIME: "⚡ Real-time",
    HARIAN:   "📅 Harian",
    MINGGUAN: "🗓 Mingguan",
    BULANAN:  "📆 Bulanan",
    SKIP:     "⏸ Dilewati",
  };

  const matrix = schedule?.matrix ?? [];
  const filtered = filterFreq === "SEMUA"
    ? matrix
    : filterFreq === "BELUM_DICRAWL"
      ? matrix.filter((e) => e.lastCrawledAt === null)
      : matrix.filter((e) => e.frequency === filterFreq);

  const todayBatch = matrix.filter((e) => e.dueToday);

  const byFreq = {
    HARIAN:   matrix.filter((e) => e.frequency === "HARIAN" || e.frequency === "REALTIME").length,
    MINGGUAN: matrix.filter((e) => e.frequency === "MINGGUAN").length,
    BULANAN:  matrix.filter((e) => e.frequency === "BULANAN").length,
    SKIP:     matrix.filter((e) => e.frequency === "SKIP").length,
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Batch Hari Ini",   val: schedule?.todayBatchCount ?? "—", color: "text-primary",      sub: "sumber akan di-crawl" },
          { label: "Crawl Harian",      val: byFreq.HARIAN,                    color: "text-emerald-600",   sub: "setiap hari" },
          { label: "Crawl Mingguan",    val: byFreq.MINGGUAN,                  color: "text-blue-600",      sub: "tiap Senin" },
          { label: "Crawl Bulanan",     val: byFreq.BULANAN,                   color: "text-orange-600",    sub: "tiap tanggal 1" },
        ].map((s) => (
          <div key={s.label} className="border rounded-sm p-3 bg-card">
            <p className={cn("text-xl font-bold font-mono", s.color)}>{s.val}</p>
            <p className="text-xs font-semibold mt-0.5">{s.label}</p>
            <p className="text-[10px] text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Today's batch highlight */}
      <div className="border rounded-sm p-4 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <p className="text-xs font-mono font-semibold text-primary">
              BATCH HARI INI — {schedule?.date ?? "…"} · {todayBatch.length} sumber dijadwalkan
            </p>
          </div>
          <button
            onClick={() => triggerMutation.mutate()}
            disabled={triggerMutation.isPending}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono font-semibold bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {triggerMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            {triggerMutation.isPending ? "Crawling…" : "Trigger Sekarang"}
          </button>
        </div>
        {isLoading ? (
          <p className="text-xs text-muted-foreground font-mono flex items-center gap-1.5"><LoaderCircle className="h-3 w-3 animate-spin" />Memuat jadwal…</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {todayBatch
              .sort((a, b) => a.priority - b.priority)
              .map((e) => (
                <span
                  key={e.sourceId}
                  className={cn("text-[10px] font-mono px-2 py-0.5 rounded-sm border", freqColor[e.frequency])}
                  title={`MKR: ${e.mkrSourceId} · BV: ${e.businessValue}/10`}
                >
                  {e.sourceName}
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Full matrix table */}
      <div className="border rounded-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-muted/30">
          <p className="text-xs font-mono font-semibold uppercase text-muted-foreground">
            Matrix Jadwal Lengkap ({filtered.length} sumber)
          </p>
          <div className="flex items-center gap-1 flex-wrap">
            {["SEMUA", "HARIAN", "MINGGUAN", "BULANAN", "SKIP"].map((f) => (
              <button
                key={f}
                onClick={() => setFilterFreq(f)}
                className={cn(
                  "text-[10px] font-mono px-2 py-1 rounded-sm border transition-colors",
                  filterFreq === f ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {f === "SEMUA" ? "Semua" : freqLabel[f]?.split(" ")[1]}
              </button>
            ))}
            {/* #83 — filter to show only never-crawled sources */}
            <button
              onClick={() => setFilterFreq(filterFreq === "BELUM_DICRAWL" ? "SEMUA" : "BELUM_DICRAWL")}
              className={cn(
                "text-[10px] font-mono px-2 py-1 rounded-sm border transition-colors",
                filterFreq === "BELUM_DICRAWL" ? "bg-amber-500 text-white border-amber-500" : "border-amber-300 text-amber-700 hover:bg-amber-50"
              )}
            >
              ⚠ Belum Dicrawl ({matrix.filter(e => e.lastCrawledAt === null).length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/20 sticky top-0 z-10">
                <th className="text-left px-3 py-2 font-mono font-semibold text-muted-foreground w-48">Sumber</th>
                <th className="text-left px-3 py-2 font-mono font-semibold text-muted-foreground w-24">Frekuensi</th>
                <th className="text-center px-3 py-2 font-mono font-semibold text-muted-foreground w-16">Prioritas</th>
                <th className="text-left px-3 py-2 font-mono font-semibold text-muted-foreground">MKR Source</th>
                <th className="text-center px-3 py-2 font-mono font-semibold text-muted-foreground w-14">BV</th>
                <th className="text-center px-3 py-2 font-mono font-semibold text-muted-foreground w-20">Hari Ini</th>
                <th className="text-center px-3 py-2 font-mono font-semibold text-muted-foreground w-20">Minggu Ini</th>
                <th className="text-center px-3 py-2 font-mono font-semibold text-muted-foreground w-20">Bulan Ini</th>
                <th className="text-center px-3 py-2 font-mono font-semibold text-muted-foreground w-24">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b animate-pulse">
                    <td className="px-3 py-2"><div className="h-3 bg-muted rounded w-32" /></td>
                    <td className="px-3 py-2"><div className="h-3 bg-muted rounded w-16" /></td>
                    <td className="px-3 py-2 text-center"><div className="h-3 bg-muted rounded w-8 mx-auto" /></td>
                    <td className="px-3 py-2"><div className="h-3 bg-muted rounded w-24" /></td>
                    <td className="px-3 py-2 text-center"><div className="h-3 bg-muted rounded w-6 mx-auto" /></td>
                    <td className="px-3 py-2 text-center"><div className="h-3 bg-muted rounded w-12 mx-auto" /></td>
                    <td className="px-3 py-2 text-center"><div className="h-3 bg-muted rounded w-12 mx-auto" /></td>
                    <td className="px-3 py-2 text-center"><div className="h-3 bg-muted rounded w-12 mx-auto" /></td>
                    <td className="px-3 py-2 text-center"><div className="h-4 bg-muted rounded w-16 mx-auto" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-muted-foreground font-mono">
                    <div className="flex flex-col items-center gap-2">
                      <span>Tidak ada sumber yang cocok dengan filter ini</span>
                      <button onClick={() => setFilterFreq("SEMUA")} className="text-xs font-mono text-primary hover:underline">✕ Reset filter</button>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((entry) => (
                <tr key={entry.sourceId} className={cn("border-b hover:bg-muted/40 transition-colors", entry.dueToday && "bg-primary/5", !entry.lastCrawledAt && "bg-amber-50/20")}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium truncate max-w-[160px]" title={entry.sourceName}>{entry.sourceName}</p>
                      {/* #83 — flag sources that have never been crawled */}
                      {entry.lastCrawledAt === null && (
                        <span className="text-[9px] font-mono font-semibold bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-sm whitespace-nowrap">
                          ⚠ Belum Dicrawl
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono" title={`Source ID: ${entry.sourceId} — ID konfigurasi crawler untuk sumber ini`}>{entry.sourceId}</p>
                    {entry.lastCrawledAt && (
                      <p className="text-[10px] text-muted-foreground font-mono whitespace-nowrap" title={`Terakhir crawl: ${new Date(entry.lastCrawledAt).toLocaleString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`}>
                        Terakhir: {new Date(entry.lastCrawledAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded-sm border", freqColor[entry.frequency])}>
                      {freqLabel[entry.frequency]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      {[1,2,3,4,5].map((n) => (
                        <span key={n} className={cn("h-1.5 w-1.5 rounded-full", n <= entry.priority ? "bg-primary" : "bg-muted")} />
                      ))}
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5" title={`Priority Level ${entry.priority} — ${entry.priority === 1 ? "Kritikal, harus segera diintegrasikan" : entry.priority <= 2 ? "Prioritas tinggi" : entry.priority <= 3 ? "Prioritas sedang" : "Prioritas rendah"}`}>P{entry.priority}</p>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-[10px] text-primary">{entry.mkrSourceId}</span>
                  </td>
                  <td className="px-3 py-2 text-center font-mono font-bold text-xs">{entry.businessValue}/10</td>
                  <td className="px-3 py-2 text-center">
                    {entry.dueToday
                      ? <CircleCheck className="h-4 w-4 text-emerald-500 mx-auto" />
                      : <span className="text-muted-foreground">—</span>
                    }
                  </td>
                  <td className="px-3 py-2 text-center">
                    {entry.dueThisWeek
                      ? <CircleCheck className="h-4 w-4 text-blue-500 mx-auto" />
                      : <span className="text-muted-foreground">—</span>
                    }
                  </td>
                  <td className="px-3 py-2 text-center">
                    {entry.dueThisMonth
                      ? <CircleCheck className="h-4 w-4 text-orange-500 mx-auto" />
                      : <span className="text-muted-foreground">—</span>
                    }
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleTriggerSource(entry.sourceId, entry.sourceName)}
                        disabled={triggeringSource === entry.sourceId || triggerMutation.isPending}
                        className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-sm border border-primary/30 text-primary hover:bg-primary/5 transition-colors disabled:opacity-40"
                        title={`Crawl ${entry.sourceName} sekarang`}
                      >
                        {triggeringSource === entry.sourceId
                          ? <LoaderCircle className="h-3 w-3 animate-spin" />
                          : <Play className="h-3 w-3" />}
                        Run
                      </button>
                      {/* #128 — reconfigure source frequency directly from panel */}
                      <button
                        onClick={() => setReconfSource({
                          sourceId: entry.sourceId,
                          sourceName: entry.sourceName,
                          current: freqOverrides[entry.sourceId] ?? entry.frequency,
                        })}
                        className={cn(
                          "flex items-center gap-1 text-[10px] font-mono px-1.5 py-1 rounded-sm border transition-colors",
                          freqOverrides[entry.sourceId]
                            ? "border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100"
                            : "border-border text-muted-foreground hover:bg-muted"
                        )}
                        title={freqOverrides[entry.sourceId]
                          ? `Override aktif: ${freqOverrides[entry.sourceId]} — klik untuk ubah`
                          : `Konfigurasi frekuensi ${entry.sourceName}`}
                      >
                        <Settings className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* #128 — Source reconfigure modal */}
      {reconfSource && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Konfigurasi sumber"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setReconfSource(null)}
          onKeyDown={(e) => { if (e.key === "Escape") setReconfSource(null); }}
        >
          <div className="bg-card border rounded-sm shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-mono font-bold text-sm">KONFIGURASI SUMBER</h3>
                <p className="text-xs text-muted-foreground font-mono truncate max-w-[220px]" title={reconfSource.sourceName}>{reconfSource.sourceName}</p>
              </div>
              <button onClick={() => setReconfSource(null)} className="text-muted-foreground hover:text-foreground" aria-label="Tutup panel konfigurasi" title="Tutup panel konfigurasi">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground mb-3">
              Override frekuensi crawl (disimpan lokal di browser). Restart scheduler setelah mengubah agar efektif.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {FREQ_OPTIONS.map((f) => (
                <button
                  key={f}
                  onClick={() => handleSaveFreqOverride(reconfSource.sourceId, f, reconfSource.sourceName)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-mono rounded-sm border transition-colors",
                    reconfSource.current === f
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            {freqOverrides[reconfSource.sourceId] && (
              <button
                onClick={() => {
                  const next = loadFreqOverrides();
                  delete next[reconfSource.sourceId];
                  localStorage.setItem(FREQ_OVERRIDE_KEY, JSON.stringify(next));
                  setFreqOverrides(loadFreqOverrides());
                  setReconfSource(null);
                }}
                className="text-xs font-mono text-destructive hover:underline"
              >
                Reset ke default server
              </button>
            )}
          </div>
        </div>
      )}

      {/* Knowledge Asset ROI Scorecard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 text-emerald-600 font-bold text-xs">💎</span> KNOWLEDGE ASSET ROI SCORECARD — Nilai Bisnis per Sumber vs Biaya Operasional
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Knowledge Asset", "Tipe", "Update Freq.", "Riset Dihasilkan/Bln", "Konversi ke Deal", "Est. Revenue/Bln", "Prioritas"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { asset: "LPSE / SPSE Nasional", tipe: "GOV", freq: "Harian", riset: "15–30", konversi: "8–12%", rev: "Rp 30–120jt", pri: "P1", priColor: "bg-red-100 text-red-700" },
                { asset: "Database LPJK SBU", tipe: "GOV", freq: "Mingguan", riset: "10–20", konversi: "12–18%", rev: "Rp 25–90jt", pri: "P1", priColor: "bg-red-100 text-red-700" },
                { asset: "SIBIMA + BNSP SKK", tipe: "GOV", freq: "Bulanan", riset: "5–12", konversi: "15–22%", rev: "Rp 20–60jt", pri: "P2", priColor: "bg-orange-100 text-orange-700" },
                { asset: "JDIH PUPR + Nasional", tipe: "GOV", freq: "Harian", riset: "3–8", konversi: "6–10%", rev: "Rp 10–40jt", pri: "P2", priColor: "bg-orange-100 text-orange-700" },
                { asset: "IjinTender (Kompetitor)", tipe: "INTEL", freq: "Harian", riset: "2–5", konversi: "20–30%", rev: "Rp 15–50jt", pri: "P2", priColor: "bg-orange-100 text-orange-700" },
                { asset: "Media Konstruksi", tipe: "MEDIA", freq: "Harian", riset: "2–6", konversi: "4–8%", rev: "Rp 5–20jt", pri: "P3", priColor: "bg-yellow-100 text-yellow-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="px-3 py-2 font-medium">{r.asset}</td>
                  <td className="px-3 py-2"><span className="text-[9px] font-mono bg-muted px-1.5 py-0.5 rounded-sm">{r.tipe}</span></td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.freq}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.riset}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-blue-700">{r.konversi}</td>
                  <td className="px-3 py-2 font-mono font-bold text-emerald-700 text-[10px] whitespace-nowrap">{r.rev}</td>
                  <td className="px-3 py-2"><span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${r.priColor}`}>{r.pri}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Revenue estimasi = deal yang dimungkinkan oleh intel dari sumber tersebut · Konversi = % leads yang closing setelah intelijen relevan ditemukan</p>
      </div>

      {/* Knowledge ROI Waterfall */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> KNOWLEDGE ROI WATERFALL — Bagaimana Knowledge Assets MJP Menghasilkan Revenue Secara Berantai
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { step: "1. Data Crawl & Kurasi", value: "930 aset aktif", contribution: "Foundasi semua layanan", c: "bg-slate-400" },
            { step: "2. Pattern Detection (AI)", value: "47 pattern/bulan", contribution: "Rekomendasi otomatis", c: "bg-blue-400" },
            { step: "3. Briefing Generation", value: "21 briefing/bulan", contribution: "Klien tetap up-to-date", c: "bg-violet-500" },
            { step: "4. Lead Nurturing", value: "312 leads warm", contribution: "BUJK yang mau dikontak", c: "bg-orange-400" },
            { step: "5. Service Conversion", value: "89 deals/bulan", contribution: "Revenue dari knowledge", c: "bg-emerald-600" },
            { step: "6. Estimated Revenue", value: "Rp 460jt/bulan", contribution: "↑48% vs tanpa knowledge system", c: "bg-primary" },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-2 h-6 rounded-sm shrink-0 ${s.c}`} />
              <p className="text-[9px] font-mono font-semibold w-36 shrink-0">{s.step}</p>
              <p className="text-[9px] font-bold flex-1">{s.value}</p>
              <p className="text-[9px] font-mono text-muted-foreground text-right shrink-0">{s.contribution}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Asset Lifecycle Manager */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-primary" /> ASSET LIFECYCLE MANAGER — Action Queue: Aset yang Perlu Di-Review, Di-Upgrade, atau Di-Retire Sekarang
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            {
              action: "🔴 Retire Sekarang", count: 37, desc: "Aset Level 0 yang sudah >180 hari tidak diperbarui",
              items: ["Permen PUPR 2018 (sudah dicabut)", "Data BUJK 2020 Kalimantan (outdated)", "Template SKK lama (format berubah)"],
              c: "bg-red-50 border-red-200", tc: "text-red-700",
            },
            {
              action: "🟠 Upgrade Prioritas", count: 84, desc: "Aset Level 1–2 dengan demand tinggi tapi belum diintegrasikan",
              items: ["Regulasi BIM PUPR 2023 (demand↑34%)", "Data BUJK Sulawesi 2025", "Template SMAP terbaru ISO 37001:2016"],
              c: "bg-orange-50 border-orange-200", tc: "text-orange-700",
            },
            {
              action: "🟢 Duplikasi ke Produk", count: 52, desc: "Aset Level 3–4 yang bisa langsung jadi fitur/konten berbayar",
              items: ["Win Rate Analysis per Sub-Bidang", "SKK Express Checklist by Region", "Competitor Price Intelligence Q3 2026"],
              c: "bg-emerald-50 border-emerald-200", tc: "text-emerald-700",
            },
          ].map((a) => (
            <div key={a.action} className={`border rounded-sm p-3 ${a.c}`}>
              <div className="flex items-center justify-between mb-1.5">
                <p className={`text-[9px] font-bold ${a.tc}`}>{a.action}</p>
                <span className={`text-lg font-black font-mono ${a.tc} leading-none`}>{a.count}</span>
              </div>
              <p className="text-[9px] text-muted-foreground mb-1.5">{a.desc}</p>
              <ul className="flex flex-col gap-0.5">
                {a.items.map((item, i) => <li key={i} className={`text-[9px] flex items-start gap-1`}><span className={`shrink-0 ${a.tc}`}>·</span>{item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Supply Gap Dashboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleAlert className="h-3.5 w-3.5 text-orange-600" /> KNOWLEDGE SUPPLY GAP DASHBOARD — Area Pengetahuan yang Paling Dibutuhkan vs Paling Sedikit Tersedia
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              area: "Harga & Estimasi Konstruksi", demand: 94, supply: 22,
              gap: 72, sources: ["HSPK Kemen PUPR", "SNI Biaya Material", "Survei Lapangan"],
              c: "bg-red-500", tc: "text-red-700",
            },
            {
              area: "Teknologi BIM & Digitalisasi", demand: 78, supply: 14,
              gap: 64, sources: ["Permen PUPR BIM 2021", "Publikasi AGC Digital", "Case Study Proyek"],
              c: "bg-red-400", tc: "text-red-700",
            },
            {
              area: "Data BUJK Luar Jawa", demand: 67, supply: 18,
              gap: 49, sources: ["LPJK Regional", "IUJK Daerah", "Tim Lapangan"],
              c: "bg-orange-500", tc: "text-orange-700",
            },
            {
              area: "Intel Kompetitor Nasional", demand: 82, supply: 38,
              gap: 44, sources: ["LPSE Scraper", "Survei Klien", "Media Konstruksi"],
              c: "bg-orange-400", tc: "text-orange-700",
            },
          ].map((r) => (
            <div key={r.area} className="border rounded-sm p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-bold">{r.area}</p>
                <span className={`text-[9px] font-mono font-black ${r.tc}`}>GAP {r.gap}</span>
              </div>
              <div className="flex gap-1 mb-1">
                <div className="flex-1">
                  <p className="text-[8px] font-mono text-muted-foreground mb-0.5">Demand</p>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${r.demand}%` }} />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-[8px] font-mono text-muted-foreground mb-0.5">Supply</p>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.supply}%` }} />
                  </div>
                </div>
              </div>
              <p className="text-[8px] font-mono text-muted-foreground">Sumber: {r.sources.join(" · ")}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Agent Utilization Dashboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-primary" /> AI AGENT UTILIZATION — Seberapa Aktif Setiap AI Agent Menggunakan Knowledge Registry sebagai Referensi
        </p>
        <div className="flex flex-col gap-2">
          {[
            { agent: "SKK Eligibility Checker Agent", queries: 2847, hitRate: 94, topSource: "Database SKK LPJK", util: "bg-emerald-500", tc: "text-emerald-700" },
            { agent: "Tender Intelligence Agent", queries: 1923, hitRate: 88, topSource: "LPSE + HSPK", util: "bg-blue-500", tc: "text-blue-700" },
            { agent: "Regulation Compliance Agent", queries: 1456, hitRate: 91, topSource: "Permen PUPR + SE LPJK", util: "bg-blue-400", tc: "text-blue-700" },
            { agent: "Competitor Intel Agent", queries: 834, hitRate: 67, topSource: "IjinTender + LPSE", util: "bg-orange-400", tc: "text-orange-700" },
            { agent: "Briefing Synthesis Agent", queries: 421, hitRate: 98, topSource: "Semua sumber Level 3+", util: "bg-emerald-600", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.agent} className="flex items-center gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-[9px] font-semibold">{r.agent}</p>
                  <span className={`text-[9px] font-mono font-bold shrink-0 ml-2 ${r.tc}`}>{r.hitRate}% hit</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${r.util} rounded-full`} style={{ width: `${r.hitRate}%` }} />
                  </div>
                  <p className="text-[8px] font-mono text-muted-foreground shrink-0">{r.queries.toLocaleString()} queries/bln</p>
                </div>
                <p className="text-[8px] text-muted-foreground mt-0.5">Top source: {r.topSource}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Monetization Scorecard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE MONETIZATION SCORECARD — Berapa % Aset Knowledge Registry yang Sudah Menghasilkan Revenue
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label: "Total Aset", val: KNOWLEDGE_REGISTRY.length || 48, tc: "text-primary" },
            { label: "Monetized (L3–L4)", val: Math.round((KNOWLEDGE_REGISTRY.length || 48) * 0.31), tc: "text-emerald-700" },
            { label: "In Progress (L2)", val: Math.round((KNOWLEDGE_REGISTRY.length || 48) * 0.29), tc: "text-blue-700" },
            { label: "Raw/Idle (L0–L1)", val: Math.round((KNOWLEDGE_REGISTRY.length || 48) * 0.40), tc: "text-orange-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center">
              <p className={`text-2xl font-black font-mono ${m.tc} leading-none`}>{m.val}</p>
              <p className="text-[8px] font-mono mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden flex mb-2">
          <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: "31%" }} title="Monetized" />
          <div className="h-full bg-blue-400" style={{ width: "29%" }} title="In Progress" />
          <div className="h-full bg-orange-400 rounded-r-full" style={{ width: "40%" }} title="Idle" />
        </div>
        <div className="flex gap-4 text-[8px] font-mono text-muted-foreground">
          <span><span className="text-emerald-600 font-bold">■</span> Monetized 31%</span>
          <span><span className="text-blue-500 font-bold">■</span> In Progress 29%</span>
          <span><span className="text-orange-500 font-bold">■</span> Raw/Idle 40%</span>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Target: Monetized ≥50% dalam 12 bulan · Upgrade L0→L1→L2 menggunakan AI synthesis agent batch processing</p>
      </div>

      {/* Knowledge Registry Cross-Reference Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> CROSS-REFERENCE INTELLIGENCE — Aset Knowledge Registry yang Paling Banyak Dikutip & Digunakan Bersama
        </p>
        <div className="flex flex-col gap-2">
          {[
            { asset: "Permen PUPR No. 8/2023 — Syarat SKK Konstruksi", cites: 142, usedWith: ["Analisis SKK", "Surat Penawaran", "Briefing Harian"], impact: "Rp 128jt revenue terattribusi" },
            { asset: "Data Tender LPSE Nasional (live feed)", cites: 98, usedWith: ["Intel Tender", "Radar Kompetitor", "Dashboard"], impact: "Rp 89jt revenue terattribusi" },
            { asset: "Profil BUJK Terregistrasi LPJK 2024–2026", cites: 84, usedWith: ["Direktori Kontraktor", "Workroom", "SKK"], impact: "Rp 67jt revenue terattribusi" },
            { asset: "Pedoman BIM Proyek Pemerintah (AHB 2025)", cites: 61, usedWith: ["Regulasi", "Output Produk", "AI Rekomendasi"], impact: "Rp 34jt revenue terattribusi" },
          ].map((r) => (
            <div key={r.asset} className="border rounded-sm p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[9px] font-bold flex-1 leading-snug">{r.asset}</p>
                <div className="text-right shrink-0">
                  <p className="text-[12px] font-black font-mono text-primary leading-none">{r.cites}</p>
                  <p className="text-[7px] font-mono text-muted-foreground">kutipan</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mb-1">
                {r.usedWith.map((u) => (
                  <span key={u} className="text-[8px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm">{u}</span>
                ))}
              </div>
              <p className="text-[9px] font-mono text-emerald-700">{r.impact}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Registry Impact on Decision Quality */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE IMPACT ON DECISION QUALITY — Seberapa Besar MKR Meningkatkan Akurasi Rekomendasi vs Tanpa MKR
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          {[
            { metric: "Akurasi Rekomendasi SKK", withMKR: "94%", withoutMKR: "61%", delta: "+33pp", tc: "text-emerald-700" },
            { metric: "Hit-Rate Intel Tender", withMKR: "87%", withoutMKR: "52%", delta: "+35pp", tc: "text-emerald-700" },
            { metric: "Proposal Win-Rate Klien", withMKR: "71%", withoutMKR: "44%", delta: "+27pp", tc: "text-emerald-700" },
          ].map((m) => (
            <div key={m.metric} className="border rounded-sm p-3 text-center">
              <p className="text-[8px] font-mono text-muted-foreground mb-2">{m.metric}</p>
              <div className="flex justify-center gap-4">
                <div>
                  <p className={`text-xl font-black font-mono ${m.tc} leading-none`}>{m.withMKR}</p>
                  <p className="text-[7px] font-mono mt-0.5">dengan MKR</p>
                </div>
                <div>
                  <p className="text-xl font-black font-mono text-muted-foreground/60 leading-none">{m.withoutMKR}</p>
                  <p className="text-[7px] font-mono mt-0.5 text-muted-foreground">tanpa MKR</p>
                </div>
              </div>
              <p className={`text-xs font-black font-mono ${m.tc} mt-1`}>{m.delta}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">MKR adalah moat terbesar MJP — setiap penambahan aset baru meningkatkan compound accuracy effect platform secara keseluruhan</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] font-mono text-muted-foreground">
        <span><span className="text-emerald-600 font-bold">HARIAN</span> = crawl setiap hari</span>
        <span><span className="text-blue-600 font-bold">MINGGUAN</span> = tiap Senin</span>
        <span><span className="text-orange-600 font-bold">BULANAN</span> = tiap tanggal 1</span>
        <span><span className="text-slate-500 font-bold">SKIP</span> = manual / belum aktif</span>
        <span>· BV = Business Value (1–10)</span>
        <span>· P1 = prioritas tertinggi</span>
      </div>

      {/* MKR Future Asset Pipeline */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> FUTURE ASSET PIPELINE — Aset Knowledge Registry yang Perlu Dibangun dalam 90 Hari ke Depan
        </p>
        <div className="flex flex-col gap-2">
          {[
            { asset: "Database SKK Green Building (sub-bidang baru 2027)", priority: "P1", effort: "3 minggu", owner: "Tim Riset + AI Crawl", status: "BELUM DIMULAI", value: "Rp 7.9M TAM", sc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { asset: "Profil 50 BUJK Kalimantan & Sulawesi yang Belum Tersertifikasi", priority: "P1", effort: "4 minggu", owner: "Tim Lapangan Budi", status: "IN PROGRESS 20%", value: "Rp 2.8M pipeline", sc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { asset: "Kompilasi Regulasi PUPR 2024–2026 (update lengkap)", priority: "P2", effort: "2 minggu", owner: "AI Crawl Agent", status: "BELUM DIMULAI", value: "Foundational asset", sc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { asset: "Analisis 200 Tender LPSE (breakdown kemenangan kompetitor)", priority: "P2", effort: "3 minggu", owner: "AI Synthesis", status: "SCHEDULED Q3", value: "Rp 89jt intel value", sc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { asset: "Database Harga Material Konstruksi per Wilayah (real-time)", priority: "P3", effort: "6 minggu", owner: "Partnership HAKI", status: "ROADMAP 2027", value: "Differentiator besar", sc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
          ].map((r) => (
            <div key={r.asset} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[9px] font-bold flex-1 leading-snug">{r.asset}</p>
                <div className="flex gap-1.5 shrink-0">
                  <span className={`text-[8px] font-mono font-bold ${r.sc}`}>{r.priority}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground">
                <span>Effort: {r.effort}</span>
                <span>Owner: {r.owner}</span>
                <span className={`font-bold ${r.sc}`}>{r.status}</span>
                <span className="text-emerald-700 font-bold">{r.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Half-Life Monitor */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-orange-600" /> KNOWLEDGE HALF-LIFE MONITOR — Aset Knowledge Mana yang Paling Cepat Kedaluwarsa dan Perlu Refresh Rutin
        </p>
        <div className="flex flex-col gap-2">
          {[
            { asset: "Profil Harga Kompetitor (IjinTender)", halfLife: "7 hari", lastUpdate: "3 hari lalu", status: "SEGAR", action: "Auto-refresh via crawler", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { asset: "Status SKK Kontraktor (LPJK)", halfLife: "14 hari", lastUpdate: "8 hari lalu", status: "SEGAR", action: "Auto-refresh via API LPJK", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { asset: "Database Tender LPSE Aktif", halfLife: "24 jam", lastUpdate: "6 jam lalu", status: "SEGAR", action: "Auto-refresh 4× sehari", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { asset: "Regulasi PUPR/JDIH Terbaru", halfLife: "30 hari", lastUpdate: "18 hari lalu", status: "PERLU PERHATIAN", action: "Jadwalkan crawl regulasi minggu ini", sc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { asset: "Profil BUJK Sulawesi & Kalimantan", halfLife: "60 hari", lastUpdate: "47 hari lalu", status: "PERLU REFRESH", action: "Tugaskan tim lapangan survey ulang", sc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { asset: "Analisis Riset Market 2024", halfLife: "180 hari", lastUpdate: "190 hari lalu", status: "KEDALUWARSA!", action: "Prioritaskan update sebelum briefing klien berikutnya", sc: "text-red-700", bc: "bg-red-50 border-red-200" },
          ].map((r) => (
            <div key={r.asset} className={`border rounded-sm p-3 ${r.bc} flex items-start gap-3`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[9px] font-bold">{r.asset}</p>
                  <span className={`text-[8px] font-mono font-bold shrink-0 ${r.sc}`}>{r.status}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground mb-0.5">
                  <span>Half-life: {r.halfLife}</span>
                  <span>Last update: {r.lastUpdate}</span>
                </div>
                <p className={`text-[9px] font-mono ${r.sc}`}>→ {r.action}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge ROI by Category */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> KNOWLEDGE ROI BY CATEGORY — Berapa Return per Rupiah yang Diinvestasikan untuk Membangun Setiap Kategori Knowledge Asset
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { cat: "SKK & Sertifikasi", invested: "Rp 48jt/thn", return: "Rp 284jt", roi: "492%", desc: "Tim riset SKK, LPJK integration, database updating", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { cat: "Intel Pasar & Tender", invested: "Rp 31jt/thn", return: "Rp 89jt", roi: "187%", desc: "LPSE crawler, AI synthesis, briefing production", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { cat: "Regulasi & Compliance", invested: "Rp 22jt/thn", return: "Rp 67jt", roi: "205%", desc: "Crawl JDIH, review manual, lawyer advisory", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { cat: "Profil Kontraktor Database", invested: "Rp 18jt/thn", return: "Rp 41jt", roi: "128%", desc: "Survey lapangan, LPJK API, enrichment AI", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { cat: "Harga & Kompetitor Intel", invested: "Rp 14jt/thn", return: "Rp 38jt", roi: "171%", desc: "IjinTender integration, market research", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { cat: "BIM & Teknologi Konstruksi", invested: "Rp 8jt/thn", return: "Rp 12jt", roi: "50%", desc: "Belum optimal — perlu investasi lebih besar di 2027", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.cat} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-bold">{r.cat}</p>
                <span className={`text-[12px] font-black font-mono ${r.tc} shrink-0 ml-2`}>{r.roi}</span>
              </div>
              <div className="flex gap-3 text-[8px] font-mono text-muted-foreground mb-0.5">
                <span>Invest: {r.invested}</span>
                <span className={`font-bold ${r.tc}`}>Return: {r.return}</span>
              </div>
              <p className="text-[8px] text-muted-foreground">{r.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Total KA investment: Rp 141jt/thn → Total return attributed: Rp 531jt → blended ROI 276% · BIM perlu diakselerasi</p>
      </div>

      {/* Knowledge Collaboration Network */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE COLLABORATION NETWORK — Mitra Eksternal yang Membantu Membangun atau Memvalidasi Knowledge Assets MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { partner: "LPJK (Lembaga Pengembangan Jasa Konstruksi)", type: "Data Provider", contribution: "Real-time SKK status + profil BUJK via API resmi", tier: "TIER 1", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { partner: "Kementerian PUPR / JDIH", type: "Regulatory Source", contribution: "Database regulasi & Permen PUPR — crawled real-time", tier: "TIER 1", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { partner: "IjinTender.co.id", type: "Market Intelligence", contribution: "Harga kompetitor + status tender aktif dari database mereka", tier: "TIER 1", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { partner: "Asosiasi BUJK Regional (3 asosiasi)", type: "Field Validation", contribution: "Validasi lapangan + akses ke member database untuk riset primer", tier: "TIER 2", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { partner: "BIM Expert Network (informal, 7 konsultan)", type: "Expert Advisory", contribution: "Review konten BIM + validasi teknis untuk knowledge BIM assets", tier: "TIER 2", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { partner: "Kantor Hukum Konstruksi (2 firma)", type: "Legal Validation", contribution: "Review akurasi konten regulasi sebelum dipublikasikan ke klien", tier: "TIER 3", tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
          ].map((r) => (
            <div key={r.partner} className={`border rounded-sm p-3 ${r.bc} flex items-start gap-3`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[9px] font-bold">{r.partner}</p>
                  <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.tier}</span>
                </div>
                <p className="text-[8px] font-mono text-muted-foreground mb-0.5">{r.type}</p>
                <p className="text-[9px] text-muted-foreground">{r.contribution}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Tier 1 = mission critical (dependency tinggi) · Tier 2 = important · Tier 3 = nice-to-have · Backup Tier 1 partners perlu diidentifikasi</p>
      </div>

      {/* Knowledge Versioning & Change History */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE VERSION HISTORY — 5 Perubahan Terbesar pada Knowledge Registry MJP dalam 30 Hari
        </p>
        <div className="flex flex-col gap-2">
          {[
            { date: "28 Jul 2026", change: "Update massif: 487 profil SKK kontraktor Jawa di-refresh via LPJK batch API", impact: "Akurasi status SKK naik dari 84% → 97% — klien dapat info real-time yang jauh lebih akurat", type: "UPDATE", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { date: "21 Jul 2026", change: "Tambah 89 knowledge asset baru: analisis tender BIM dari 20 LPSE regional", impact: "Intel Briefing Premium sekarang bisa covert 47% lebih banyak klien dengan BIM inquiry", type: "TAMBAH", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { date: "14 Jul 2026", change: "Hapus 34 entri regulasi kedaluwarsa (Permen yang sudah dicabut atau digantikan)", impact: "Briefing tidak lagi merujuk regulasi lama — mengurangi risiko misinformasi ke klien", type: "HAPUS", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { date: "7 Jul 2026", change: "Validasi ulang database 248 BUJK Sulawesi dengan survey lapangan tim Budi", impact: "Coverage Sulawesi naik dari 31% → 67% — klien di sana kini mendapat briefing yang relevan", type: "VALIDASI", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
            { date: "1 Jul 2026", change: "IjinTender integration upgrade: price data refresh dari 24hr → 6hr cycle", impact: "Radar Kompetitor MJP sekarang 4× lebih real-time dari sebelumnya", type: "UPGRADE", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.date} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[7px] font-mono text-muted-foreground">{r.date}</span>
                <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted ${r.tc}`}>{r.type}</span>
              </div>
              <p className="text-[9px] font-bold mb-0.5">{r.change}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>→ Impact: {r.impact}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Democratization Status */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE DEMOCRATIZATION — Siapa yang Mengakses Knowledge MJP dan Seberapa Merata Distribusi Intelligence ke Tim
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { member: "Budi (Field Researcher, Jawa Tengah)", kaDailyAccess: 12, docContrib: 41, lastActive: "10 mnt lalu", depth: 87, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { member: "Sari (Analyst, Remote)", kaDailyAccess: 18, docContrib: 67, lastActive: "32 mnt lalu", depth: 94, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { member: "Reza (AM, Surabaya)", kaDailyAccess: 6, docContrib: 8, lastActive: "2 jam lalu", depth: 61, tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { member: "Andi (Sales, Medan)", kaDailyAccess: 3, docContrib: 2, lastActive: "2 hari lalu", depth: 38, tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { member: "Lisa (Director)", kaDailyAccess: 4, docContrib: 0, lastActive: "4 jam lalu", depth: 72, tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.member} className={`border rounded-sm p-2.5 ${r.bc} flex items-center gap-3`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[9px] font-bold">{r.member}</p>
                  <span className="text-[7px] font-mono text-muted-foreground">· {r.lastActive}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground">
                  <span>Akses: <span className={`font-bold ${r.tc}`}>{r.kaDailyAccess}/hari</span></span>
                  <span>Kontribusi: <span className={`font-bold ${r.tc}`}>{r.docContrib} docs</span></span>
                  <span>Knowledge depth: <span className={`font-bold ${r.tc}`}>{r.depth}/100</span></span>
                </div>
              </div>
              <div className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full border-2" style={{ borderColor: r.depth >= 80 ? "#10b981" : r.depth >= 60 ? "#3b82f6" : "#f97316" }}>
                <p className={`text-[9px] font-black font-mono ${r.tc}`}>{r.depth}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Andi depth score 38 = knowledge gap terbesar di tim · Action: mandatory weekly briefing digest + 1-on-1 knowledge onboarding dengan Sari</p>
      </div>

      {/* Knowledge Impact on Revenue Attribution */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> KNOWLEDGE → REVENUE PATH — Bagaimana Setiap Kategori Knowledge Asset Menghasilkan Revenue bagi MJP
        </p>
        <div className="flex flex-col gap-2">
          {[
            { ka: "SKK & Sertifikasi Knowledge", path: "KA → Briefing → Klien tahu SKK expire → Beli SKK Express MJP", revenue: "Rp 214jt", pct: 41, mechanism: "Push notification dari KA SKK status yang expired = trigger pembelian", tc: "text-primary", bc: "bg-primary/5 border-primary/20" },
            { ka: "Tender Intelligence Knowledge", path: "KA → Alert → Klien menang tender → Referral ke BUJK lain → New client", revenue: "Rp 128jt", pct: 25, mechanism: "BUJK yang menang tender karena intel MJP merekomendasikan MJP ke rekan — viral loop", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { ka: "Regulatory Intelligence Knowledge", path: "KA → Briefing Premium → Klien compliance advisory → Upsell SMAP", revenue: "Rp 84jt", pct: 16, mechanism: "Klien yang baca regulatory update MJP convert ke SMAP service 3× lebih sering", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
            { ka: "Competitor Intelligence Knowledge", path: "KA → Win/Loss Analysis → Improve pitch → Higher close rate", revenue: "Rp 62jt", pct: 12, mechanism: "Sales win rate naik dari 54% → 71% setelah AM menggunakan competitor intel dalam pitch", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { ka: "Pain Point Research Knowledge", path: "KA → Product Development → New product → New revenue stream", revenue: "Rp 32jt", pct: 6, mechanism: "SKK Guarantee tier lahir dari pain point research — produk baru dari 0 ke Rp 32jt dalam 2 bulan", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.ka} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-[9px] font-bold ${r.tc}`}>{r.ka}</p>
                <div className="text-right shrink-0 ml-2">
                  <p className={`text-[12px] font-black font-mono ${r.tc} leading-none`}>{r.revenue}</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>{r.pct}% total rev</p>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                <div className={`h-full ${r.tc === "text-primary" ? "bg-primary" : r.tc === "text-blue-700" ? "bg-blue-400" : r.tc === "text-violet-700" ? "bg-violet-400" : r.tc === "text-orange-700" ? "bg-orange-400" : "bg-emerald-400"} rounded-full`} style={{ width: `${r.pct * 2.4}%` }} />
              </div>
              <p className="text-[8px] font-mono text-muted-foreground mb-0.5">Path: {r.path}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>💡 {r.mechanism}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Asset Quality Audit */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE AUDIT LOG — Hasil Audit Kualitas Terbaru: Knowledge Asset yang Perlu Diperbarui atau Dihapus
        </p>
        <div className="flex flex-col gap-2">
          {[
            { finding: "84 entri SKK dengan status 'aktif' tapi LPJK menunjukkan sudah expire", severity: "CRITICAL", action: "Segera sync ulang dari LPJK API — jangan sampai klien dapat info salah tentang status SKK mereka", status: "IN PROGRESS (Sari, deadline 5 Agt)", sc: "text-red-700", sb: "bg-red-50 border-red-200" },
            { finding: "34 knowledge asset regulasi berusia >180 hari tanpa review", severity: "HIGH", action: "Sari audit semua 34 — tandai yang masih valid vs yang perlu update atau hapus", status: "SCHEDULED (10 Agt)", sc: "text-orange-700", sb: "bg-orange-50 border-orange-200" },
            { finding: "12 profil BUJK Sulawesi memiliki nomor SIUJK yang tidak valid", severity: "MEDIUM", action: "Validasi silang dengan LPJK database — kemungkinan BUJK ini sudah tidak aktif", status: "ASSIGNED (Budi)", sc: "text-blue-700", sb: "bg-blue-50 border-blue-200" },
            { finding: "247 knowledge asset tidak memiliki 'last verified' date", severity: "LOW", action: "Batch update: tambahkan verified date berdasarkan last modified. Buat mandatory field ke depannya.", status: "BACKLOG", sc: "text-slate-600", sb: "bg-slate-50 border-slate-200" },
          ].map((r) => (
            <div key={r.finding} className={`border rounded-sm p-3 ${r.sb}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[8px] font-mono font-bold shrink-0 ${r.sc}`}>{r.severity}</span>
                <p className="text-[9px] font-bold">{r.finding}</p>
              </div>
              <p className="text-[9px] text-muted-foreground mb-0.5">→ {r.action}</p>
              <p className={`text-[8px] font-mono ${r.sc}`}>Status: {r.status}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Monetization Engine */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> KNOWLEDGE MONETIZATION ENGINE — Setiap Tipe Knowledge Asset, Berapa Revenue yang Dihasilkannya untuk MJP?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { type: "Regulasi & Perijinan (LPJK, K3, SBU)", directRev: "Rp 127jt/thn", indirectRev: "Rp 284jt/thn", totalRev: "Rp 411jt/thn", products: "SKK Advisory, SMAP Guidance, Compliance Audit", roi: "847%", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { type: "Tender Intelligence (LPSE, IjinTender)", directRev: "Rp 218jt/thn", indirectRev: "Rp 312jt/thn", totalRev: "Rp 530jt/thn", products: "Intel Briefing, Radar Kompetitor, Bid Assist", roi: "1.240%", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { type: "Profil Kompetitor & BUJK", directRev: "Rp 84jt/thn", indirectRev: "Rp 147jt/thn", totalRev: "Rp 231jt/thn", products: "Radar Kompetitor, Due Diligence, M&A Advisory", roi: "623%", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { type: "Riset Pasar & Pain Point", directRev: "Rp 67jt/thn", indirectRev: "Rp 201jt/thn", totalRev: "Rp 268jt/thn", products: "Custom Research, Surat Penawaran, Workroom", roi: "534%", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { type: "Forum & Komunitas (OSM, media)", directRev: "Rp 14jt/thn", indirectRev: "Rp 38jt/thn", totalRev: "Rp 52jt/thn", products: "Signal digest, VOC layer", roi: "186%", tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
          ].map((r) => (
            <div key={r.type} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-[9px] font-bold ${r.tc} flex-1`}>{r.type}</p>
                <div className="text-right shrink-0 ml-2">
                  <p className={`text-[12px] font-black font-mono ${r.tc} leading-none`}>{r.totalRev}</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>ROI: {r.roi}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground">
                <span>Direct: {r.directRev}</span>
                <span>Indirect: {r.indirectRev}</span>
              </div>
              <p className="text-[8px] font-mono text-muted-foreground mt-0.5">Produk: {r.products}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Gap vs Competitor Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleAlert className="h-3.5 w-3.5 text-orange-500" /> KNOWLEDGE GAP vs COMPETITOR — Domain Pengetahuan yang Kompetitor MJP Sudah Cover tapi MJP Belum (Blind Spot)
        </p>
        <div className="flex flex-col gap-2">
          {[
            { domain: "Kontrak Konstruksi Internasional (FIDIC, NEC)", competitorCoverage: "Konsultan A: coverage penuh — mereka punya ex-PUPR specialist", mjpCoverage: 12, gap: "CRITICAL", action: "Rekrut atau partnership dengan konsultan FIDIC — 28 klien MJP sudah tanya ini tapi tidak bisa dilayani", ga: "text-red-700", gb: "bg-red-50 border-red-200" },
            { domain: "PPP (Public-Private Partnership) Konstruksi", competitorCoverage: "Startup B sudah punya modul khusus + template dokumen PPP", mjpCoverage: 8, gap: "HIGH", action: "PPP = masa depan infrastruktur Indonesia. Mulai dengan membeli atau partner dari konsultan PPP existing.", ga: "text-orange-700", gb: "bg-orange-50 border-orange-200" },
            { domain: "Green Building & ESG Compliance", competitorCoverage: "Platform C menyediakan GREENSHIP scoring calculator gratis", mjpCoverage: 4, gap: "HIGH", action: "ESG reporting wajib untuk BUMN 2027. Ini akan menjadi compliance requirement yang massive.", ga: "text-orange-700", gb: "bg-orange-50 border-orange-200" },
            { domain: "Konstruksi Digital (IoT, AI site monitoring)", competitorCoverage: "Kompetitor asing (Singapore) mulai masuk ke market Indonesia di domain ini", mjpCoverage: 21, gap: "MEDIUM", action: "Tidak harus lead sendiri — cukup menjadi referral partner untuk solusi construction tech terpilih.", ga: "text-blue-700", gb: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.domain} className={`border rounded-sm p-3 ${r.gb}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-[9px] font-bold ${r.ga} flex-1`}>{r.domain}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ml-2 ${r.ga}`}>{r.gap}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Kompetitor: {r.competitorCoverage}</p>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[8px] font-mono text-muted-foreground">MJP coverage:</span>
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${r.mjpCoverage < 15 ? "bg-red-400" : "bg-blue-400"}`} style={{ width: `${r.mjpCoverage}%` }} />
                </div>
                <span className={`text-[8px] font-mono font-bold ${r.ga}`}>{r.mjpCoverage}%</span>
              </div>
              <p className={`text-[8px] font-mono ${r.ga}`}>→ {r.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Synthesis Automation */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE SYNTHESIS AUTOMATION — Bagaimana AI MJP Secara Otomatis Menghubungkan Data dari Sumber yang Berbeda?
        </p>
        <div className="flex flex-col gap-2">
          <p className="text-[9px] text-muted-foreground">Contoh synthesis yang berjalan otomatis setiap malam pukul 02:00:</p>
          {[
            {
              title: "Tender LPSE + SKK Database → SKK Gap Alert",
              inputs: ["Tender LPSE: butuh J9 Struktur, 3 tenaga ahli", "SKK Registry: klien CV Maju hanya punya 1 J9"],
              output: "Alert: CV Maju tidak bisa bid tender #LPSE-JT-2847 — butuh 2 J9 tambahan. Estimasi waktu pengurusan: 14–21 hari.",
              impact: "312 alert dikirim bulan ini → 47 klien berhasil upgrade tepat waktu",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              title: "IjinTender Harga + Pain Point Riset → HPS Benchmark",
              inputs: ["IjinTender: 284 tender kategori 'Gedung Perkantoran' 2026", "Pain Point: klien sering underestimate atau overestimate HPS"],
              output: "HPS Benchmark Report: gedung perkantoran Jawa range Rp 4.2–6.8jt/m². Quartile breakdown per kota.",
              impact: "89 klien pakai report ini untuk bid — win rate segmen ini naik +18pp",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              title: "Regulasi LPJK Update + SKK Expiry → Compliance Risk Report",
              inputs: ["LPJK: SKK perpanjangan sekarang butuh SMAP tambahan per Nov 2026", "SKK Registry: 247 klien renew SKK sebelum Nov"],
              output: "Alert batch ke 247 klien: 'Syarat baru perpanjangan SKK — tambahkan SMAP dalam paket renewal Anda.'",
              impact: "Jika tidak diantisipasi: 247 klien potentially renewal gagal → MJP bisa lose trust + revenue",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
          ].map((r) => (
            <div key={r.title} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-1`}>{r.title}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-1">
                <div>
                  <p className="text-[8px] font-bold text-muted-foreground mb-0.5">Inputs:</p>
                  {r.inputs.map((inp, i) => <p key={i} className="text-[8px] text-muted-foreground">• {inp}</p>)}
                </div>
                <div>
                  <p className="text-[8px] font-bold text-muted-foreground mb-0.5">Output:</p>
                  <p className="text-[8px] text-muted-foreground">{r.output}</p>
                </div>
              </div>
              <p className={`text-[8px] font-mono ${r.tc}`}>📊 Impact: {r.impact}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Access Control & Tiering */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE ACCESS TIERS — Siapa yang Boleh Mengakses Knowledge Asset Apa di Platform MJP (Role-Based Access)
        </p>
        <div className="flex flex-col gap-2">
          <div className="overflow-x-auto">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left py-1.5 pr-3 w-36">Knowledge Type</th>
                  <th className="text-center py-1.5 px-2">Internal<br/>Tim</th>
                  <th className="text-center py-1.5 px-2">Klien<br/>Basic</th>
                  <th className="text-center py-1.5 px-2">Klien<br/>Premium</th>
                  <th className="text-center py-1.5 px-2">Klien<br/>Enterprise</th>
                  <th className="text-center py-1.5 px-2">Investor/<br/>Partner</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { type: "Regulasi Publik (LPJK, PUPR)", internal: "✓", basic: "✓", premium: "✓", enterprise: "✓", investor: "✓" },
                  { type: "Tender Alert (LPSE)", internal: "✓", basic: "partial", premium: "✓", enterprise: "✓", investor: "✗" },
                  { type: "HPS Benchmark per kategori", internal: "✓", basic: "✗", premium: "✓", enterprise: "✓", investor: "✗" },
                  { type: "Profil Kompetitor Detail", internal: "✓", basic: "✗", premium: "partial", enterprise: "✓", investor: "✗" },
                  { type: "Pain Point Database", internal: "✓", basic: "✗", premium: "✗", enterprise: "✓", investor: "summary" },
                  { type: "AI Model Performance Data", internal: "✓", basic: "✗", premium: "✗", enterprise: "✗", investor: "summary" },
                  { type: "Client Churn Analytics", internal: "✓", basic: "✗", premium: "✗", enterprise: "✗", investor: "✗" },
                  { type: "Revenue & P&L Data", internal: "✓", basic: "✗", premium: "✗", enterprise: "✗", investor: "✓" },
                ].map((r, i) => (
                  <tr key={r.type} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                    <td className="py-1 pr-3 text-[8px]">{r.type}</td>
                    {[r.internal, r.basic, r.premium, r.enterprise, r.investor].map((v, j) => (
                      <td key={j} className={`text-center py-1 px-2 ${v === "✓" ? "text-emerald-700 font-bold" : v === "partial" || v === "summary" ? "text-orange-600" : "text-slate-400"}`}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[9px] font-mono text-muted-foreground">Access control = upsell lever. Klien Basic yang butuh HPS Benchmark harus upgrade ke Premium. Friction by design, bukan bug.</p>
        </div>
      </div>

      {/* Knowledge Freshness SLA */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" /> FRESHNESS SLA DASHBOARD — Seberapa Cepat Setiap Jenis Knowledge Harus Diupdate dan Apakah Kita Memenuhi SLA Tersebut?
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { type: "Tender LPSE", sla: "<2 jam dari publish", actual: "47 menit avg", slaBreaches: 3, totalChecked: 2847, compliance: 99.9, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { type: "Regulasi LPJK", sla: "<24 jam dari penetapan", actual: "6.2 jam avg", slaBreaches: 1, totalChecked: 184, compliance: 99.5, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { type: "Profil Kompetitor", sla: "<48 jam dari aktivitas terdeteksi", actual: "18 jam avg", slaBreaches: 14, totalChecked: 312, compliance: 95.5, tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { type: "HPS Benchmark", sla: "Update setiap 2 minggu", actual: "11 hari avg", slaBreaches: 2, totalChecked: 24, compliance: 91.7, tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { type: "SKK Database (LPJK)", sla: "<4 jam setelah LPJK sync", actual: "2.1 jam avg", slaBreaches: 7, totalChecked: 487, compliance: 98.6, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { type: "Sinyal Sosial/Forum", sla: "<6 jam dari post", actual: "8.4 jam avg", slaBreaches: 184, totalChecked: 847, compliance: 78.3, tc: "text-red-700", bc: "bg-red-50 border-red-200" },
          ].map((r) => (
            <div key={r.type} className={`border rounded-sm p-2.5 ${r.bc} flex items-center gap-3`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={`text-[9px] font-bold ${r.tc}`}>{r.type}</p>
                  <span className={`text-[7px] font-mono ${r.tc}`}>SLA: {r.sla}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground">
                  <span>Actual: {r.actual}</span>
                  <span>Breaches: {r.slaBreaches}/{r.totalChecked}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-[13px] font-black font-mono ${r.tc} leading-none`}>{r.compliance}%</p>
                <p className={`text-[7px] font-mono ${r.tc}`}>SLA met</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">Sinyal Sosial SLA compliance 78.3% = below target (95%). Root cause: Instagram block weekends. Fix: fallback ke Reddit/Kaskus untuk weekend coverage.</p>
      </div>

      {/* Knowledge Contribution Leaderboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-amber-500" /> KNOWLEDGE CONTRIBUTION — Siapa di Tim MJP yang Paling Banyak Berkontribusi ke Knowledge Registry dan Apa yang Mereka Hasilkan?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { name: "Sari Wijaya (Riset Senior)", contributions: 247, quality: 94, specialties: "Regulasi LPJK + SKK + Tender BUMN", topAsset: "Panduan SKK Express Step-by-Step (dibaca 312 klien)", badge: "TOP CONTRIBUTOR", tc: "text-amber-700", bc: "bg-amber-50 border-amber-200" },
            { name: "Budi Santoso (Field Researcher)", contributions: 184, quality: 88, specialties: "Wawancara lapangan + Pain Point Sulawesi/Kalimantan", topAsset: "Laporan 'BUJK Sulawesi: 47 Pain Points Tidak Terdokumentasi'", badge: "FIELD EXPERT", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { name: "Reza Firmansyah (AM + Data)", contributions: 97, quality: 81, specialties: "Win/Loss analysis + Competitive intel", topAsset: "Battlecard Kompetitor A + B (dipakai di semua sales pitch)", badge: "SALES INTELLIGENCE", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { name: "Dewi Kusuma (Junior Researcher)", contributions: 64, quality: 79, specialties: "Tender LPSE data enrichment + HPS benchmark", topAsset: "HPS Database Jateng Q3 2026 (284 tender)", badge: "DATA SPECIALIST", tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
          ].map((r) => (
            <div key={r.name} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-[9px] font-bold ${r.tc}`}>{r.name}</p>
                    <span className={`text-[7px] font-mono font-bold ${r.tc}`}>{r.badge}</span>
                  </div>
                  <p className="text-[8px] text-muted-foreground mb-0.5">Spesialisasi: {r.specialties}</p>
                  <p className={`text-[8px] font-mono ${r.tc}`}>Top asset: "{r.topAsset}"</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[13px] font-black font-mono ${r.tc} leading-none`}>{r.contributions}</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>kontribusi</p>
                  <p className={`text-[8px] font-mono ${r.tc}`}>{r.quality}% quality</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Knowledge production 592 assets/thn = 1.6/hari · Target 2027: 1.000 assets/thn dengan Dewi naik ke 150+ contributions</p>
      </div>

      {/* Knowledge Deprecation Policy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-orange-500" /> KNOWLEDGE DEPRECATION — Bagaimana MJP Memutuskan Kapan Sebuah Knowledge Asset Harus Diperbarui atau Dihapus?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="border rounded-sm p-3 bg-slate-50 border-slate-200">
            <p className="text-[9px] font-bold mb-1">Trigger Otomatis (sistem deteksi):</p>
            {[
              { trigger: "Tanggal expire regulasi terlewati", action: "Auto-flag 'OUTDATED' + email Sari untuk review dalam 48 jam", tc: "text-red-700" },
              { trigger: "Sinyal kompetitor tidak diupdate > 30 hari", action: "Auto-flag 'STALE' + warning di dashboard AM", tc: "text-orange-700" },
              { trigger: "Knowledge asset tidak dibaca > 90 hari (0 views)", action: "Auto-flag 'LOW VALUE' + queue for deprecation review", tc: "text-slate-600" },
            ].map((r) => (
              <div key={r.trigger} className="flex items-start gap-2 mb-0.5">
                <span className={`text-[8px] font-bold ${r.tc} shrink-0`}>→</span>
                <div>
                  <span className={`text-[8px] font-bold ${r.tc}`}>{r.trigger}: </span>
                  <span className="text-[8px] text-muted-foreground">{r.action}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="border rounded-sm p-3 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700 mb-1">Trigger Manual (oleh tim riset):</p>
            {[
              "Regulasi baru terbit yang supersede regulasi lama → deprecated + linked ke versi baru",
              "Klien melaporkan inaccuracy → immediate review + correction atau deprecation",
              "Project kompetitor bubar atau merger → update status, archive company profile",
            ].map((i) => <p key={i} className="text-[8px] text-muted-foreground">• {i}</p>)}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200">
              <p className="text-[9px] font-bold text-emerald-700">Current Knowledge Health</p>
              <p className="text-[8px] font-mono text-emerald-700">Fresh ({'<'}30 days): 78.4%</p>
              <p className="text-[8px] font-mono text-orange-700">Stale (30–90 days): 14.2%</p>
              <p className="text-[8px] font-mono text-red-700">Outdated ({'>'} 90 days): 7.4%</p>
            </div>
            <div className="border rounded-sm p-2.5 bg-slate-50 border-slate-200">
              <p className="text-[9px] font-bold text-slate-700">Deprecation Stats</p>
              <p className="text-[8px] font-mono text-muted-foreground">Deprecated Q2 2026: 47 assets</p>
              <p className="text-[8px] font-mono text-muted-foreground">Replaced by new: 39 assets</p>
              <p className="text-[8px] font-mono text-muted-foreground">Hard-deleted: 8 (no replacement)</p>
            </div>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Target: fresh rate {'>'} 85% by Q4 2026. Utama blocker: 34 regulasi assets perlu review manual tapi Sari full bandwidth di Sprint 23.</p>
      </div>

      {/* Knowledge Monetization Strategy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> KNOWLEDGE MONETIZATION — Bagaimana MJP Mengubah Knowledge Registry Menjadi Revenue Langsung dan Tidak Langsung?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { stream: "Bundled dalam subscription (indirect)", model: "Knowledge Access adalah value proposition utama semua tier — klien bayar MJP karena knowledge-nya", revenue: "~80% dari total MJP ARR (Rp 676jt/thn) bisa diattributkan ke knowledge delivery", type: "INDIRECT", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { stream: "Knowledge Report PDF (direct, pay-per-report)", model: "Klien non-subscriber bisa beli specific report: 'Laporan SKK 2026 Complete Guide' = Rp 350rb/report", revenue: "Current: Rp 12.4jt/thn (87 reports × avg Rp 142rb) — underdeveloped opportunity", type: "DIRECT", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { stream: "White-label Knowledge untuk Asosiasi", model: "Berikan GAPENSI, PERSATUAN branded version dari MJP Knowledge sebagai member benefit → asosiasi bayar MJP flat fee", revenue: "Pilot dengan GAPENSI Sulawesi: Rp 24jt/thn. Jika di-expand ke 10 asosiasi = Rp 240jt/thn potential", type: "LICENSING", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
            { stream: "Knowledge API untuk Fintech/Perbankan Konstruksi", model: "Bank yang berikan kredit ke kontraktor butuh risk intel — MJP bisa jual access ke HPS + track record kontraktor", revenue: "Belum dieksekusi. Market sizing: 5 bank dengan portofolio konstruksi × Rp 180jt/thn = Rp 900jt potential", type: "FUTURE", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.stream} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.stream}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.type}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.model}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>{r.revenue}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">Today: knowledge adalah product bundled. Tomorrow: knowledge menjadi platform dengan multiple monetization vectors.</p>
      </div>

      {/* Knowledge Search Analytics */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5 text-primary" /> SEARCH ANALYTICS — Top 15 Kata Kunci yang Paling Sering Dicari Klien di Knowledge Registry (Jul 2026)
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { rank: 1, keyword: "syarat SKK J8 sipil", searches: 847, trend: "+12%", hasContent: true, tc: "text-emerald-700" },
            { rank: 2, keyword: "HPS benchmark gedung perkantoran", searches: 634, trend: "+8%", hasContent: true, tc: "text-emerald-700" },
            { rank: 3, keyword: "cara daftar LPSE baru", searches: 521, trend: "+34%", hasContent: true, tc: "text-emerald-700" },
            { rank: 4, keyword: "kompetitor tender jalan raya Jateng", searches: 412, trend: "+61%", hasContent: false, tc: "text-red-700" },
            { rank: 5, keyword: "PKPT klasifikasi 2026", searches: 398, trend: "+89%", hasContent: true, tc: "text-emerald-700" },
            { rank: 6, keyword: "BIM requirement proyek BUMN", searches: 387, trend: "+127%", hasContent: false, tc: "text-red-700" },
            { rank: 7, keyword: "perubahan Permen PUPR 2026", searches: 356, trend: "+44%", hasContent: true, tc: "text-emerald-700" },
            { rank: 8, keyword: "subkontraktor MEP terpercaya Surabaya", searches: 289, trend: "+23%", hasContent: false, tc: "text-red-700" },
            { rank: 9, keyword: "cara hitung WHT konstruksi", searches: 247, trend: "+18%", hasContent: true, tc: "text-emerald-700" },
            { rank: 10, keyword: "tender retaining wall Sulawesi 2026", searches: 234, trend: "+156%", hasContent: false, tc: "text-red-700" },
          ].map((r) => (
            <div key={r.rank} className={`flex items-center gap-2 border rounded-sm p-2 ${r.hasContent ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <span className={`text-[9px] font-black font-mono w-4 shrink-0 ${r.tc}`}>{r.rank}</span>
              <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.keyword}</p>
              <div className="flex gap-2 shrink-0 text-[8px] font-mono">
                <span className="text-muted-foreground">{r.searches}×</span>
                <span className={r.tc}>{r.trend}</span>
                <span className={`font-bold ${r.tc}`}>{r.hasContent ? "✓ ADA" : "✗ MISSING"}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">4 dari top 10 keyword = NO CONTENT. Ini adalah direct demand signal — buat 4 knowledge asset ini minggu ini. Estimasi impact: 1.322 frustrated searches per bulan jadi resolved.</p>
      </div>

      {/* Knowledge Quality Audit Log */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> QUALITY AUDIT LOG — Hasil Audit Terbaru Knowledge Registry: Apa yang Ditemukan dan Apa yang Sudah Diperbaiki?
        </p>
        <div className="flex flex-col gap-2">
          <div className="border rounded-sm p-3 bg-slate-50 border-slate-200">
            <p className="text-[9px] font-bold text-slate-700 mb-1">Audit Q2 2026 (Jun 2026) — 592 assets reviewed</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[8px] font-mono mb-2">
              <div><p className="text-[11px] font-black text-emerald-700">463</p><p className="text-muted-foreground">PASS — No issues</p></div>
              <div><p className="text-[11px] font-black text-orange-700">87</p><p className="text-muted-foreground">WARN — Minor updates needed</p></div>
              <div><p className="text-[11px] font-black text-red-700">34</p><p className="text-muted-foreground">FAIL — Outdated/inaccurate</p></div>
              <div><p className="text-[11px] font-black text-blue-700">8</p><p className="text-muted-foreground">DEPRECATED — Removed</p></div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {[
              { finding: "34 regulasi assets dengan tanggal expire sebelum Jun 2026", severity: "CRITICAL", action: "27 sudah diperbaiki oleh Sari. 7 masih pending (Sprint 23 backlog item).", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
              { finding: "19 HPS benchmark assets menggunakan data > 18 bulan", severity: "HIGH", action: "19 sudah diupdate dengan data Q1 2026. Perlu quarterly refresh cycle formal.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
              { finding: "12 kompetitor profile tidak diupdate setelah merger/tutup", severity: "MEDIUM", action: "8 diupdate. 4 BUJK dikonfirmasi masih aktif tapi profil outdated.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
              { finding: "56 assets dengan broken external link (sumber sudah offline)", severity: "LOW", action: "46 link dicache secara lokal atau diganti sumber alternatif. 10 masih broken.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
              { finding: "8 duplicate assets (topik identik, versi berbeda)", severity: "LOW", action: "8 di-merge ke versi terbaru. Duplicate prevention process diupdate.", tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
            ].map((r) => (
              <div key={r.finding} className={`border rounded-sm p-2.5 ${r.bc}`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.finding}</p>
                  <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.severity}</span>
                </div>
                <p className={`text-[8px] font-mono ${r.tc}`}>Action taken: {r.action}</p>
              </div>
            ))}
          </div>
          <p className="text-[9px] font-mono text-muted-foreground">Audit Q3 2026 scheduled: Sep 15. Target: FAIL count {'<'} 10 (dari 34 di Q2). Will need Dewi + Budi cross-cover saat Sari leading workshop.</p>
        </div>
      </div>

      {/* Knowledge Asset ROI Calculator */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> KNOWLEDGE ASSET ROI — Berapa Return dari Setiap Jam yang Diinvestasikan untuk Membuat Knowledge Asset?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              assetType: "Panduan Regulasi (long-form, 2.000+ kata)",
              productionTime: "4 jam Sari",
              productionCost: "~Rp 600rb (time value)",
              monthlyViews: "847 views/bln avg setelah publish",
              clientValue: "Setiap 100 klien yang baca = ~8 yang avoid costly mistake = ~Rp 4.8jt value delivered",
              lifespan: "6–18 bulan sebelum outdated",
              roi: "8× dalam 3 bulan pertama",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              assetType: "HPS Benchmark Table (per kategori + wilayah)",
              productionTime: "2 jam data analyst",
              productionCost: "~Rp 200rb",
              monthlyViews: "1.240 views/bln avg (highest traffic)",
              clientValue: "Win rate improvement untuk klien yang pakai = +12pp × avg kontrak Rp 2.8M = Rp 336rb per bid",
              lifespan: "3–6 bulan (harus refresh quarterly)",
              roi: "24× dalam 3 bulan pertama",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              assetType: "Competitor Profile (per BUJK besar)",
              productionTime: "3 jam research",
              productionCost: "~Rp 450rb",
              monthlyViews: "312 views/bln avg",
              clientValue: "Klien pakai competitor intel untuk adjust strategi bid: estimated +8pp win rate dalam category itu",
              lifespan: "2–4 bulan sebelum perlu update major",
              roi: "6× dalam 3 bulan (lower ROI, tapi high differentiation value)",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
          ].map((r) => (
            <div key={r.assetType} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-1`}>{r.assetType}</p>
              <div className="grid grid-cols-2 gap-1 text-[8px] mb-0.5">
                <span className="text-muted-foreground">Production: {r.productionTime} | {r.productionCost}</span>
                <span className="text-muted-foreground">Avg views: {r.monthlyViews}</span>
                <span className="text-muted-foreground col-span-2">Value: {r.clientValue}</span>
              </div>
              <div className="flex gap-2 text-[8px] font-mono">
                <span className="text-muted-foreground">Lifespan: {r.lifespan}</span>
                <span className={`font-bold ${r.tc}`}>ROI: {r.roi}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">HPS Benchmark = highest ROI asset (24×). Every hour Sari invests in HPS data = Rp 2.4jt client value delivered. Priority asset type = HPS, then Regulasi, then Competitor.</p>
      </div>

      {/* Knowledge Access Tiering */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE ACCESS TIERS — Konten Mana yang Tersedia untuk Tier Mana? Arsitektur Akses yang Membuat Upsell Lebih Natural
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              tier: "STARTER (Rp 800rb/bln)",
              access: ["Regulasi summary — headlines only, no detail", "HPS range per kategori — national level, bukan regional", "Tender database — basic filter, no AI match", "Knowledge Registry — top 50 most-accessed assets only"],
              gatekept: ["Regional HPS breakdown", "Competitor profiles", "Full regulatory compliance checklist", "Custom research requests"],
              tc: "text-slate-700", bc: "bg-slate-50 border-slate-200"
            },
            {
              tier: "GROWTH (Rp 1.5jt/bln)",
              access: ["Semua STARTER +", "HPS regional breakdown per provinsi", "Competitor profiles (basic — nama, kategori, win rate)", "Full regulatory checklist per kategori", "Knowledge Registry full access", "Intel Briefing daily dengan personalization"],
              gatekept: ["Custom research requests", "Competitor bid history detail", "Strategic advisory sessions"],
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              tier: "PRO (Rp 2.8jt/bln)",
              access: ["Semua GROWTH +", "Competitor full profiles + bid history 24 bulan", "Pre-Bid Intel Brief per tender (full 6 sections)", "Custom research — 2 requests/bln included", "Priority support — <4 jam response"],
              gatekept: ["Unlimited custom research", "Dedicated AM", "API access"],
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              tier: "ENTERPRISE (Custom pricing, avg Rp 7.2jt/bln)",
              access: ["Semua PRO +", "Unlimited custom research requests", "Dedicated AM (personal)", "API access untuk integrasi sistem internal", "Monthly strategic advisory call dengan Sari", "SLA uptime guarantee 99.9%"],
              gatekept: ["Tidak ada — full access semua"],
              tc: "text-violet-700", bc: "bg-violet-50 border-violet-200"
            },
          ].map((r) => (
            <div key={r.tier} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-1`}>{r.tier}</p>
              <div className="grid grid-cols-2 gap-1">
                <div><p className="text-[8px] font-bold text-emerald-700">✓ Included:</p>{r.access.map((a, i) => <p key={i} className="text-[8px] text-muted-foreground">• {a}</p>)}</div>
                <div><p className="text-[8px] font-bold text-orange-700">✗ Upsell:</p>{r.gatekept.map((g, i) => <p key={i} className="text-[8px] text-muted-foreground">• {g}</p>)}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Tiering architecture: setiap upsell harus terasa natural — klien yang sudah butuh lebih akan merasakan friction dari tier batas sebelum mereka diminta upgrade. Friction harus informatif, not blocking.</p>
      </div>

      {/* Knowledge Curation Workflow */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-primary" /> CURATION WORKFLOW — Perjalanan Sebuah "Raw Info" dari Sumber Eksternal Hingga Menjadi Knowledge Asset yang Klien Bisa Percaya
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { stage: "Stage 1: Detection", who: "Crawler / Budi lapangan / AM Reza", what: "Raw info terdeteksi: regulasi baru di LPJK website, pain point dari lapangan, atau news di media konstruksi", output: "Raw record masuk ke queue di database — belum visible ke klien", color: "bg-slate-200" },
            { stage: "Stage 2: Triage", who: "Sari (harian review, 08:00)", what: "Sari review queue. Tag: URGENT (L1/L2 regulatory) vs NORMAL vs DEFER. URGENT → skip ke Stage 4. NORMAL → ke Stage 3.", output: "Prioritized queue dengan urgency tag", color: "bg-blue-200" },
            { stage: "Stage 3: Research & Enrich", who: "Sari + Dewi + AI assist", what: "Verify di primary source. Add context: 'Apa artinya untuk BUJK J7 di Sulawesi?' Write practical interpretation. AI drafts, researcher reviews.", output: "Draft knowledge asset dengan confidence level", color: "bg-violet-200" },
            { stage: "Stage 4: Fact Check", who: "Cross-check oleh researcher kedua", what: "Satu orang verify pekerjaan orang lain. Untuk L1 regulatory: Hendra juga spot-check untuk legal implications.", output: "Approved draft dengan reviewer sign-off", color: "bg-orange-200" },
            { stage: "Stage 5: Publish & Tag", who: "Sari atau Dewi", what: "Publish ke Knowledge Registry dengan proper tags: kategori, jenjang, region, confidence level, expiry date.", output: "Live knowledge asset — visible ke semua klien yang relevant tier", color: "bg-emerald-200" },
            { stage: "Stage 6: Briefing Integration", who: "AI + scheduler", what: "AI automatically includes relevant new knowledge asset ke Intel Briefing yang dikirim hari tersebut ke klien yang profilnya match.", output: "Klien ter-inform dalam <24 jam dari Stage 1", color: "bg-emerald-300" },
          ].map((r, i) => (
            <div key={r.stage} className="flex gap-2 items-start">
              <div className={`w-5 h-5 rounded-full ${r.color} flex items-center justify-center shrink-0 mt-0.5`}>
                <span className="text-[8px] font-bold">{i + 1}</span>
              </div>
              <div className="flex-1 border-b pb-1.5">
                <div className="flex items-center gap-2">
                  <p className="text-[9px] font-bold">{r.stage}</p>
                  <span className="text-[7px] font-mono text-muted-foreground">{r.who}</span>
                </div>
                <p className="text-[8px] text-muted-foreground">{r.what}</p>
                <p className="text-[8px] font-mono text-blue-700">→ {r.output}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Avg: raw info → published asset dalam 4–6 jam untuk NORMAL, {'<'}2 jam untuk URGENT. Speed + accuracy = competitive advantage yang klien tidak bisa get anywhere else.</p>
      </div>

      {/* Knowledge Contributor Recognition */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-amber-500" /> CONTRIBUTOR RECOGNITION — Bagaimana MJP Menghargai Kontributor Internal yang Menghasilkan Knowledge Asset Paling Bernilai?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] font-mono text-muted-foreground mb-1">Leaderboard Q2 2026 (Jan–Jun):</p>
          <div className="flex flex-col gap-1">
            {[
              { rank: "🥇 1", name: "Sari Dewi Kusuma", role: "Head Researcher", assets: 847, views: "14.200", impact: "HPS Benchmark Series (Jateng) = #1 most-accessed asset 12 bulan berturut-turut", bonus: "Rp 3.5jt Q2 bonus", tc: "text-amber-700" },
              { rank: "🥈 2", name: "Dewi Rahayu", role: "Junior Researcher", assets: 312, views: "5.800", impact: "Regulatory Alert Series (PKPT transition) = saved 47 klien dari late-compliance penalty", bonus: "Rp 1.8jt Q2 bonus", tc: "text-slate-600" },
              { rank: "🥉 3", name: "Budi Santoso", role: "Field Researcher", assets: 234, views: "3.200", impact: "Pain point collection record (78 validated pain points Q2) — highest ever for field researcher", bonus: "Rp 1.2jt Q2 bonus", tc: "text-orange-700" },
              { rank: "4", name: "Reza Purnama (AM)", role: "Account Manager", assets: 67, views: "2.100", impact: "Enterprise client use case documentation series — 5 detailed ROI stories published", bonus: "Rp 600rb Q2 bonus", tc: "text-blue-700" },
            ].map((r) => (
              <div key={r.name} className="flex gap-2 border rounded-sm p-2 bg-muted/10 items-start">
                <span className="text-[9px] w-6 shrink-0">{r.rank}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-[9px] font-bold ${r.tc}`}>{r.name}</p>
                    <span className="text-[7px] text-muted-foreground">{r.role}</span>
                    <span className={`text-[7px] font-mono ml-auto ${r.tc}`}>{r.assets} assets · {r.views} views</span>
                  </div>
                  <p className="text-[8px] text-muted-foreground">{r.impact}</p>
                  <p className={`text-[8px] font-mono font-bold ${r.tc}`}>{r.bonus}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Recognition program: quarterly bonus pool Rp 7.1jt (Q2 2026). Distributed berdasarkan views × quality score × strategic impact. Bonus ini membuat Sari tetap termotivasi meski bisa dapat 2× salary di konsultan besar.</p>
      </div>

      {/* Knowledge Asset Lifecycle */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE LIFECYCLE — Dari Lahir hingga Pensiun: Bagaimana Setiap Knowledge Asset Dikelola Sepanjang Hidupnya di MJP Platform?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { phase: "BIRTH", trigger: "Raw signal terdeteksi (crawler / field / AM)", action: "Auto-create draft record di database. Status: DRAFT. Tidak visible ke klien.", duration: "0–6 jam", tc: "text-slate-600" },
            { phase: "REVIEW", trigger: "Sari atau Dewi pick up dari review queue", action: "Verify source, write interpretation, set confidence level, set expiry date, set tier access.", duration: "30 min – 4 jam", tc: "text-blue-700" },
            { phase: "PUBLISHED", trigger: "Reviewer approve", action: "Asset live di Knowledge Registry. Visible ke klien sesuai tier. May trigger Intel Briefing inclusion.", duration: "Ongoing (default)", tc: "text-emerald-700" },
            { phase: "FLAGGED", trigger: "Expiry date reached ATAU manual flag oleh reviewer", action: "Status berubah ke NEEDS REFRESH. Badge 'Perlu diperbarui' muncul. Still visible but clearly labeled.", duration: "Queue for next refresh sprint", tc: "text-orange-700" },
            { phase: "REFRESHED", trigger: "Sari process from refresh queue", action: "Content updated, new expiry date set, reviewer re-signs. Asset kembali ke PUBLISHED status.", duration: "15 min – 2 jam", tc: "text-emerald-700" },
            { phase: "ARCHIVED", trigger: "Asset no longer relevant (regulasi dicabut, tender era berakhir)", action: "Move to archive. Not visible to regular users. Only accessible via Historical Research filter for Pro/Enterprise.", duration: "Permanent (unless unarchived)", tc: "text-slate-500" },
          ].map((r, i) => (
            <div key={r.phase} className="flex gap-2 items-start border-b pb-1.5">
              <div className="w-20 shrink-0 flex items-center gap-1.5">
                <span className="text-[8px] font-black font-mono">{i + 1}.</span>
                <span className={`text-[8px] font-bold ${r.tc}`}>{r.phase}</span>
              </div>
              <div className="flex-1">
                <p className="text-[7px] text-muted-foreground mb-0.5">Trigger: {r.trigger}</p>
                <p className="text-[8px]">{r.action}</p>
              </div>
              <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.duration}</span>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Lifecycle management = quality assurance at scale. Tanpa lifecycle: knowledge base accumulates outdated content until clients stop trusting it. With lifecycle: every asset has a guardian and an expiry — quality is structural, not heroic.</p>
      </div>

      {/* Knowledge Registry as Competitive Moat */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE MOAT — Mengapa Knowledge Registry MJP Adalah Asset yang Paling Sulit Ditiru Kompetitor, Bahkan dengan Modal Besar?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              moat: "Volume: 5.200+ curated assets setelah 5 tahun produksi",
              why_hard: "Competitor butuh 5 tahun + 2 FTE researcher untuk reproduce ini, bahkan jika punya uang. Knowledge production is fundamentally time-bound.",
              copyable_in: "5+ tahun minimum", tc: "text-red-700"
            },
            {
              moat: "Local Context: Regional nuance yang hanya ada karena tim MJP di lapangan",
              why_hard: "Tidak ada dataset nasional yang punya nuance 'di Sulawesi, evaluator lebih strict pada dokumen fisik vs digital'. Ini hanya muncul dari 5 tahun field experience.",
              copyable_in: "8–10 tahun dengan regional presence", tc: "text-red-700"
            },
            {
              moat: "Linkage: Setiap asset ter-link ke tender aktif yang relevan",
              why_hard: "Raw knowledge ditambah automated tender matching = intelligence product. Bukan sekedar artikel. Linkage engine butuh crawler + matching model + 38K tender data.",
              copyable_in: "3+ tahun dengan significant tech investment", tc: "text-orange-700"
            },
            {
              moat: "Trust: Klien sudah verified accuracy berulang kali (4+ tahun)",
              why_hard: "Trust tidak bisa dibeli atau di-claim. Competitor yang baru launch akan mengalami trust deficit selama 12–24 bulan pertama sampai klien verify accuracy mereka sendiri.",
              copyable_in: "2–3 tahun of proven track record", tc: "text-orange-700"
            },
            {
              moat: "Network: Knowledge dari klien mengalir balik ke platform (pain points, use cases)",
              why_hard: "487 klien yang terus contribute context dan use cases membuat knowledge base terus tumbuh beyond internal team capacity. Flywheel effect.",
              copyable_in: "Requires 300+ active clients first = at least 2 years", tc: "text-blue-700"
            },
          ].map((r) => (
            <div key={r.moat} className="border rounded-sm p-2.5 bg-muted/10">
              <div className="flex items-start gap-2 mb-0.5">
                <p className="text-[9px] font-bold flex-1">{r.moat}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.copyable_in}</span>
              </div>
              <p className="text-[8px] text-muted-foreground">{r.why_hard}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Summary: Knowledge Registry adalah MJP's most defensible asset. Competitor bisa copy platform UI dalam 3 bulan. Copy crawler dalam 6 bulan. But they can't copy 5 years of curated, locally-verified, client-trusted knowledge.</p>
      </div>

      {/* Knowledge Coverage Gap Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-orange-500" /> COVERAGE GAPS — Area yang Masih Under-Served di Knowledge Registry MJP: Peluang untuk Expand Data Moat
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { gap: "Konstruksi Swasta (non-APBN/APBD)", coverage: "4%", whyMissed: "Tender swasta tidak public di LPSE. Butuh network dan manual intel. Effort tinggi.", opportunity: "67% klien MJP juga bid swasta. Jika MJP cover ini: avg spend per klien naik est. +Rp 300rb/bln.", priority: "HIGH", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { gap: "Kawasan Timur Indonesia (KTI) granular intel", coverage: "11%", whyMissed: "Budi dan field team mostly Jawa-based. KTI coverage sangat surface-level.", opportunity: "IKN + major infrastructure push 2025–2030 di KTI. First-mover = 5+ year advantage.", priority: "HIGH", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { gap: "Post-Construction Services (operation & maintenance)", coverage: "2%", whyMissed: "MJP focused on construction phase. O&M is separate market that klien start asking about.", opportunity: "Long-tail service. Klien that won construction contracts naturally need O&M intel next.", priority: "MEDIUM", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { gap: "International Standards (ISO, FIDIC, World Bank procurement)", coverage: "7%", whyMissed: "International standards for J9 klien that chase donor-funded projects.", opportunity: "25 klien J9 yang bid World Bank / ADB projects. Premium product opportunity. High WTP.", priority: "MEDIUM", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.gap} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.gap}</p>
                <div className="flex gap-2 shrink-0 text-[7px] font-mono">
                  <span className={r.tc}>Coverage: {r.coverage}</span>
                  <span className={`font-bold ${r.tc}`}>{r.priority}</span>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Why missed: {r.whyMissed}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>Opportunity: {r.opportunity}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Gap analysis dilakukan setiap 6 bulan. Priority ditetapkan berdasarkan: revenue opportunity × strategic importance × execution difficulty. KTI dan Private Construction adalah H1 2027 priorities.</p>
      </div>

      {/* Knowledge Asset ROI Calculator */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Calculator className="h-3.5 w-3.5 text-emerald-600" /> ASSET ROI CALCULATOR — Berapa Nilai Ekonomi dari Satu Knowledge Asset yang Dibuat Sari vs Biaya Membuatnya?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="border rounded-sm p-3 bg-red-50 border-red-200">
              <p className="text-[9px] font-bold text-red-700 mb-1">COST per asset (average)</p>
              {[
                { item: "Sari research time", cost: "2.5 jam × Rp 75rb/jam = Rp 187.5rb" },
                { item: "Dewi support time", cost: "45 min × Rp 35rb/jam = Rp 26rb" },
                { item: "Cloud storage + delivery", cost: "Rp 0.8rb amortized" },
                { item: "Total cost per asset", cost: "~Rp 215rb" },
              ].map((r) => (
                <div key={r.item} className="flex justify-between text-[8px] border-b py-0.5">
                  <span className="text-muted-foreground">{r.item}</span>
                  <span className="font-mono">{r.cost}</span>
                </div>
              ))}
            </div>
            <div className="border rounded-sm p-3 bg-emerald-50 border-emerald-200">
              <p className="text-[9px] font-bold text-emerald-700 mb-1">REVENUE per asset (average)</p>
              {[
                { item: "Avg monthly views", cost: "47 views/bln" },
                { item: "Avg view converts to action", cost: "18% → 8.5 actions/bln" },
                { item: "Avg action value (win rate lift)", cost: "Rp 82rb per action" },
                { item: "Monthly revenue contribution", cost: "Rp 697rb/bln per asset" },
                { item: "Lifetime (18 month useful life)", cost: "Rp 12.5jt per asset" },
              ].map((r) => (
                <div key={r.item} className="flex justify-between text-[8px] border-b py-0.5">
                  <span className="text-muted-foreground">{r.item}</span>
                  <span className="font-mono">{r.cost}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border rounded-sm p-3 bg-emerald-50 border-emerald-200">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-[9px] font-bold text-emerald-700">ROI per Knowledge Asset</p>
                <p className="text-[8px] text-muted-foreground">Cost Rp 215rb → generates Rp 12.5jt over 18 months = 58× ROI</p>
              </div>
              <p className="text-xl font-black font-mono text-emerald-700 shrink-0">58×</p>
            </div>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">ROI model validated on cohort of 200 assets with full attribution tracking. Top performers (regulasi L1 assets): 180× ROI. Lowest performers (niche technical): 12× ROI. Even worst case = strong positive return.</p>
      </div>

      {/* Top Performing Knowledge Assets of 2026 */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-amber-500" /> TOP ASSETS 2026 — 8 Knowledge Asset yang Paling Banyak Diakses, Paling Sering Di-action, dan Paling Banyak Di-cite oleh Klien dalam QBR
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { rank: 1, title: "Panduan Kualifikasi BUJK 2026 — Tabel Lengkap Persyaratan per Jenjang", type: "REGULASI", views: "1.847/bln", actions: "94%", note: "Klien print ini dan tempel di meja. Updated setiap ada perubahan LPJK.", tc: "text-emerald-700" },
            { rank: 2, title: "Kalkulasor HPS Benchmark — Gedung Pemerintah Jawa Tengah", type: "INTEL TOOL", views: "1.312/bln", actions: "87%", note: "Interactive tool — klien input volume, dapat range HPS. Jateng klien use it sebelum setiap bid.", tc: "text-emerald-700" },
            { rank: 3, title: "Top 50 Kompetitor J8 Nasional — Profil + Bid Pattern", type: "COMPETITOR", views: "1.201/bln", actions: "76%", note: "Enterprise klien update mereka sendiri setiap ada tender baru. Highest dwell time (11 min avg).", tc: "text-blue-700" },
            { rank: 4, title: "Checklist Dokumen Admin Tender — Updated Agustus 2026", type: "TOOLS", views: "1.089/bln", actions: "91%", note: "Download rate tertinggi. Klien download sebelum setiap bid submission. Saves 2-3 jam per tender.", tc: "text-emerald-700" },
            { rank: 5, title: "SKK SKKNI Terbaru — Tabel Konversi Keahlian ke Jenjang", type: "REGULASI", views: "987/bln", actions: "68%", note: "Critical reference setiap ada SKK Express case. Sari update tiap ada LPJK announcement.", tc: "text-blue-700" },
            { rank: 6, title: "Timeline Pengadaan Pemerintah — Kalender Tahunan", type: "MARKET INTEL", views: "834/bln", actions: "72%", note: "Planning tool. Klien screenshot ke WA group internal mereka.", tc: "text-blue-700" },
            { rank: 7, title: "Analisis Putusan Tender Kontroversial 2026 — Case Studies", type: "CASE STUDY", views: "729/bln", actions: "58%", note: "Klien refer ke ini saat filing sanggahan. Sari tulis dari perspektif hukum tender.", tc: "text-orange-700" },
            { rank: 8, title: "IKN Tender Pipeline — Database Lengkap Updated Real-time", type: "DATABASE", views: "687/bln", actions: "63%", note: "Fastest growing asset. Enterprise only. 3 klien masuk IKN market via asset ini.", tc: "text-violet-700" },
          ].map((r) => (
            <div key={r.rank} className="flex gap-2 items-start border-b pb-1.5 pt-0.5">
              <span className={`text-[9px] font-black w-4 shrink-0 ${r.tc}`}>{r.rank}.</span>
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className={`text-[8px] font-bold ${r.tc}`}>{r.title}</p>
                  <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.type}</span>
                </div>
                <div className="flex gap-2 text-[7px] font-mono text-muted-foreground">
                  <span>{r.views}</span><span>action rate: {r.actions}</span>
                </div>
                <p className="text-[7px] text-muted-foreground">{r.note}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Top assets diidentifikasi setiap kuartal via engagement analytics. Sari mengalokasikan 20% waktu untuk update 8 top assets ini first — impact per jam jauh lebih tinggi dari asset baru.</p>
      </div>

      {/* Knowledge Velocity Metrics */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE VELOCITY — Seberapa Cepat MJP Menghasilkan, Mempublish, dan Memvalidasi Knowledge Assets Baru setiap Bulan?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {[
              { stat: "38", label: "Avg assets/bulan diproduksi", tc: "text-blue-700" },
              { stat: "4.2 hari", label: "Rata-rata dari research → publish", tc: "text-emerald-700" },
              { stat: "91%", label: "First-time accuracy (no correction needed)", tc: "text-emerald-700" },
              { stat: "Rp 8.1jt", label: "Avg revenue impact/asset (lifetime)", tc: "text-emerald-700" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-base font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Category</th>
                  <th className="p-1 text-center">Avg/bln</th>
                  <th className="p-1 text-center">Lead time</th>
                  <th className="p-1 text-center">Owner</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["L1 Regulatory Alerts", "4–8", "< 4 jam (mandated)", "Sari"],
                  ["L2 Intelligence Updates", "12–15", "1–3 hari", "Sari"],
                  ["L3 Research Reports", "8–10", "5–7 hari", "Sari + Budi"],
                  ["Competitor Profiles", "2–4", "3–5 hari", "Dewi"],
                  ["Market Deep Dives", "1–2", "7–10 hari", "Sari"],
                  ["Tool Templates (checklists, calculators)", "1–3", "2–4 hari", "Sari + Hendra Jr."],
                ].map(([cat, vol, lt, owner], i) => (
                  <tr key={i} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="p-1 font-bold">{cat}</td>
                    <td className="p-1 text-center">{vol}</td>
                    <td className="p-1 text-center text-emerald-700">{lt}</td>
                    <td className="p-1 text-center text-muted-foreground">{owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Velocity target with AI drafting (Q4 2026): 60 assets/bulan, same headcount. AI handles first draft (2–3 jam each). Sari spends time on verification + enrichment (1–1.5 jam). Net effect: 38 → 60/bln = 58% velocity increase.</p>
      </div>

      {/* Knowledge Registry Expansion Verticals */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> EXPANSION VERTICALS — 4 Vertikal Konten Baru yang MJP Rencanakan untuk Knowledge Registry 2027 dan Mengapa Masing-Masing Akan Diciptakan?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              vertical: "BIM Vertical (Building Information Modeling)",
              timeline: "H2 2026 — PRIORITY (47 assets planned, 12 done)",
              rationale: "Perpres BIM mandate January 2027. 86% of J9 klien unprepared. MJP builds the knowledge base they need. First-mover advantage: no other platform has comprehensive BIM-for-procurement content in Bahasa Indonesia.",
              assets: "BIM software comparison, certified assessor directory, implementation cost estimator, compliance checklist by KBLI, case studies early adopters.",
              revenue: "Enterprise upsell: BIM Advisory add-on Rp 3.5jt/project. Target: 40 projects/bln by Q2 2027.",
              tc: "text-red-700", bc: "bg-red-50 border-red-200"
            },
            {
              vertical: "Green/ESG Construction Vertical",
              timeline: "Q1 2027",
              rationale: "Donor-funded projects (ADB, World Bank) mandating ESG. J9 klien who target international funding need this. No existing Indonesian construction platform covers this.",
              assets: "Green certification guide (GBCI, EDGE), ESG compliance checklist per donor, carbon calculation templates, case studies green tender wins.",
              revenue: "Enterprise add-on Rp 350rb/bln. Target: 47 Enterprise klien → 34 converted.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              vertical: "Specialist Work Vertical (MEP, Geotek, Struktur Khusus)",
              timeline: "Q2 2027",
              rationale: "MEP contractors underserved by generic BUJK content. Their SKKNI, their tender categories, their compliance are different. High-value niche.",
              assets: "MEP SKKNI guide, MEP tender category database, specialist subkon directory, MEP-specific compliance checklist.",
              revenue: "MEP klien = avg 1.6× higher LTV than general BUJK. 78 current MEP klien.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              vertical: "Post-PHO Operations Vertical",
              timeline: "Q3 2027 (pending discovery sprint validation)",
              rationale: "Warranty period, defect liability, final payment claim — all high-pain areas after PHO. Cluster avg score 7.8/10 = validated pain. Content first, then product.",
              assets: "Warranty claim process guide, defect liability period by project type, payment claim templates, dispute resolution flowchart.",
              revenue: "New product tier add-on. WTP validation in progress.",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
          ].map((r) => (
            <div key={r.vertical} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.vertical}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.timeline}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Why: {r.rationale}</p>
              <p className="text-[8px] mb-0.5">Assets: {r.assets}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Revenue: {r.revenue}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Each vertical = 40–80 assets. Total expansion: 200+ new assets across 4 verticals. Execution: 1 vertical per quarter at current pace. BIM is existential (mandate deadline). Others are growth opportunities. Sequence matters.</p>
      </div>

      {/* Knowledge Collaboration Protocol */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> COLLABORATION PROTOCOL — Cara Sari, Dewi, dan Budi Berkolaborasi dalam Produksi Knowledge Asset: Siapa Mengerjakan Apa dan Bagaimana Koordinasinya?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">3 knowledge producers dengan peran berbeda. Koordinasi via Notion workspace + weekly sync 45 menit (Senin pagi):</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            {[
              { person: "Sari — Research Lead", role: "All L1 alerts, deep analysis, strategic assets, methodology.", scope: "20 assets/bln avg. Final review of all other producers' work. Sign-off authority.", strength: "Domain depth, regulatory interpretation, strategic framing.", tc: "text-emerald-700" },
              { person: "Dewi — Ops + Research Support", role: "L2/L3 updates, template maintenance, BUJK profile updates, competitor tracking.", scope: "12 assets/bln avg. Speed + accuracy. Sari reviews her L2 work (spot check).", strength: "Process discipline, thoroughness, consistency.", tc: "text-blue-700" },
              { person: "Budi — Field Intel", role: "Pain point reports, field observations, community intelligence, regional market scans.", scope: "78 pain points/bln avg. Field reports → Sari converts to assets. Direct input into regional market intel.", strength: "Ground truth, relationship access, regional nuance.", tc: "text-orange-700" },
            ].map((r) => (
              <div key={r.person} className="border rounded-sm p-2.5 bg-muted/10">
                <p className={`text-[8px] font-bold mb-0.5 ${r.tc}`}>{r.person}</p>
                <p className="text-[7px] text-muted-foreground mb-0.5">Role: {r.role}</p>
                <p className="text-[7px] mb-0.5">{r.scope}</p>
                <p className={`text-[7px] font-mono ${r.tc}`}>Strength: {r.strength}</p>
              </div>
            ))}
          </div>
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700">Weekly Sync Agenda (fixed, 45 menit Senin 8:30 AM):</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { time: "8:30–8:40", item: "Budi field debrief: what did he hear last week? New pain signals, hot topics in field." },
                { time: "8:40–8:55", item: "Sari + Dewi content review: what's in production queue, any blockers, regulatory updates detected." },
                { time: "8:55–9:15", item: "Prioritization: next week's top 5 most urgent assets. Assign owners. Unblock dependencies." },
              ].map((r) => (
                <div key={r.time} className="border-l-2 border-blue-300 pl-2">
                  <p className="text-[7px] font-bold text-blue-700">{r.time}</p>
                  <p className="text-[7px] text-muted-foreground">{r.item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Sesi sync 45 menit ini adalah single most important process in MJP's research operation. 3× missed syncs in a row = degraded coordination. When Sari is on leave: Dewi runs sync with Hendra joining. Non-negotiable cadence.</p>
      </div>

      {/* Knowledge Distribution Analytics */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartColumnBig className="h-3.5 w-3.5 text-primary" /> DISTRIBUTION ANALYTICS — Data Lengkap Bagaimana Knowledge Assets Dikonsumsi: Asset Mana yang Dibaca Paling Banyak dan Pola Apa yang Muncul?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {[
              { stat: "87,240", label: "Total asset views YTD 2026", tc: "text-primary" },
              { stat: "4.2 min", label: "Avg time-on-asset (all tiers)", tc: "text-blue-700" },
              { stat: "31%", label: "Assets shared to colleague/partner", tc: "text-emerald-700" },
              { stat: "16%", label: "Assets bookmarked for later", tc: "text-orange-700" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-base font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          <div className="mb-2">
            <p className="text-[9px] font-bold mb-1">Top 10 Most Read Assets (YTD 2026):</p>
            {[
              ["1", "Panduan Kualifikasi BUJK J8 → J9 (Lengkap)", "3,847 views", "text-emerald-700"],
              ["2", "SKK Jenjang 8 Konstruksi Gedung: Syarat, Proses, Biaya", "3,241 views", "text-emerald-700"],
              ["3", "Buku Pedoman Tender LPSE 2026 (Update Terbaru)", "2,960 views", "text-emerald-700"],
              ["4", "Cara Hitung HPS Konstruksi — Panduan Praktis BUJK", "2,718 views", "text-blue-700"],
              ["5", "Daftar Hitam LKPP: Cara Cek, Dampak, dan Recovery", "2,394 views", "text-blue-700"],
              ["6", "Konsorsium BUJK: Legal Framework + Best Practices", "1,987 views", "text-blue-700"],
              ["7", "BIM 2027: Apa yang Harus Disiapkan BUJK Sekarang", "1,843 views", "text-orange-700"],
              ["8", "TKDN Konstruksi: Cara Hitung + Sumber Data Resmi", "1,729 views", "text-orange-700"],
              ["9", "Strategi Menang Tender Rehabilitasi Gedung Pemerintah", "1,614 views", "text-orange-700"],
              ["10", "Perpanjangan SKK vs SKK Baru: Mana yang Lebih Cepat?", "1,501 views", "text-orange-700"],
            ].map(([rank, title, views, tc]) => (
              <div key={rank} className="flex items-center gap-1.5 border-b py-0.5">
                <span className="text-[7px] font-black text-muted-foreground w-4 shrink-0">{rank}.</span>
                <p className="text-[7px] flex-1">{title}</p>
                <span className={`text-[7px] font-mono shrink-0 ${tc}`}>{views}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Top assets reveal user anxiety: qualification (J8→J9), SKK process, tender basics, HPS calculation. These are the 4 biggest pain clusters. Sari's rule: top 10 most-read assets get refreshed quarterly priority — they are the crown jewels of the registry.</p>
      </div>

      {/* Knowledge Graph — Cross-Asset Connections */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE GRAPH — Bagaimana 5.200 Knowledge Assets Saling Terhubung: Cluster Topik yang Sering Dibaca Bersama dan Rekomendasi Path Optimal?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Knowledge graph based on co-read patterns (asset A and asset B read in same session). Top connected clusters:</p>
          {[
            { cluster: "Qualification Cluster", anchor: "Panduan J8→J9", connected: ["Daftar Persyaratan SBU Baru", "SKK Tenaga Ahli Jenjang 9", "Konsorsium Legal Framework", "KBLI Mapping untuk Naik Kelas"], insight: "Klien naik kelas baca rata-rata 3.2 assets per session. This is the highest-engagement cluster. Avg session: 18 menit vs platform avg 4.2 menit.", tc: "text-emerald-700" },
            { cluster: "Tender Win Cluster", anchor: "HPS Estimation Guide", connected: ["Competitor Bid History 2025", "Pre-Bid Checklist Template", "Strategi Tender Rehabilitasi", "Cara Baca Dokumen Pengadaan"], insight: "Pre-bid research pattern: HPS guide → competitor data → strategy guide → checklist. This 4-asset path = 34% higher win rate (tracked via outcome feedback). Sari calls it 'the win path'.", tc: "text-emerald-700" },
            { cluster: "Compliance Emergency Cluster", anchor: "L1 Alert received", connected: ["Full text of cited regulation", "Compliance checklist", "Action deadline calculator", "Case study of similar BUJK"], insight: "L1 alert readers come to registry within 12 menit of alert. They read 4.8 assets avg. These are the most valuable sessions — high intent, immediate need.", tc: "text-orange-700" },
            { cluster: "SKK First-Timer Cluster", anchor: "SKK Overview Guide", connected: ["Required documents checklist", "Asesor directory by KBLI", "Express service page", "FAQ common mistakes"], insight: "First-time SKK applicants follow predictable linear path. Dewi designed the 4-asset onboarding path. 67% of readers who complete this path convert to Express case within 7 days.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.cluster} className="border rounded-sm p-2.5 bg-muted/5 mb-1">
              <p className="text-[9px] font-bold mb-0.5">{r.cluster} → Anchor: <em>{r.anchor}</em></p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Co-read: {r.connected.join(" → ")}</p>
              <p className={`text-[8px] font-mono`}>{r.insight}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Knowledge graph enables recommendation engine: 'Klien yang membaca ini juga membaca X.' Currently: manual curation by Sari. Roadmap: automated co-read recommendation (Sprint 23). Expected impact: 28% session length increase, 15% more assets consumed per session = deeper learning, higher confidence, higher retention.</p>
      </div>

      {/* Knowledge Asset Decay and Refresh Protocol */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-primary" /> DECAY PROTOCOL — Bagaimana Knowledge Assets Menjadi Usang dan Sistem MJP untuk Mendeteksi, Memprioritaskan, dan Merefresh Konten yang Sudah Kedaluwarsa
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {[
              { stat: "38%", label: "Assets needing refresh right now", tc: "text-orange-700" },
              { stat: "14 hari", label: "Avg time to refresh a decayed asset", tc: "text-blue-700" },
              { stat: "4.2×", label: "Read rate lift after refresh", tc: "text-emerald-700" },
              { stat: "23%", label: "Churn prevented via timely refresh", tc: "text-emerald-700" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-base font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[9px] font-bold mb-0.5">Decay triggers (automated detection):</p>
          {[
            { trigger: "Regulatory reference outdated", signal: "Linked regulation has been superseded in MJP Regulasi module", sla: "Refresh within 7 days", priority: "P0" },
            { trigger: "L1 alert contradicts asset", signal: "Alert content conflicts with existing knowledge asset", sla: "Refresh within 3 days (critical)", priority: "P0 CRITICAL" },
            { trigger: "Seasonal relevance expired", signal: "Asset references dates now in the past (e.g., 'Q1 2025 tender schedule')", sla: "Archive or update within 14 days", priority: "P1" },
            { trigger: "Low read rate (declining)", signal: "Asset reads drop > 60% MoM without a seasonal reason", sla: "Review: refresh, merge, or archive", priority: "P2" },
            { trigger: "Community question unanswered", signal: "3+ klien asked similar question not covered by existing assets", sla: "Create or expand asset within 21 days", priority: "P1 (gap content)" },
          ].map((r) => (
            <div key={r.trigger} className="flex gap-2 items-start border-b py-1">
              <div className="flex-1">
                <p className="text-[8px] font-bold">{r.trigger}</p>
                <p className="text-[7px] text-muted-foreground">{r.signal}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-[7px] font-mono font-bold ${r.priority.includes("CRITICAL") ? "text-red-700" : r.priority.startsWith("P0") ? "text-red-600" : r.priority.startsWith("P1") ? "text-orange-600" : "text-blue-600"}`}>{r.priority}</p>
                <p className="text-[7px] text-muted-foreground">{r.sla}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Decay detection is Sari's Monday morning ritual (30 menit). Her dashboard shows: assets flagged by automated triggers + read rate trend. Rule: never let a P0 decay go beyond 7 days — a wrong answer is worse than no answer. P0 CRITICAL gets Sari personal escalation, even outside working hours.</p>
      </div>

      {/* Knowledge Contribution Culture */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> CONTRIBUTION CULTURE — Bagaimana Seluruh Tim MJP Berkontribusi ke Knowledge Registry, Bukan Hanya Sari: Sistem Kontribusi yang Membuat Knowledge Truly Institutional
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Sari is editor-in-chief, but not the only contributor. Each team member has a defined knowledge contribution role:</p>
          {[
            { member: "Sari (Research Lead)", contribution: "Primary author: regulatory guides, market analysis, HPS methodology, AI briefing review. 65% of all assets authored or final-edited.", cadence: "Daily (briefing) + weekly (deep assets)", tc: "text-primary" },
            { member: "Dewi (Compliance)", contribution: "SKK/SBU process guides, LPJK procedural updates, asesor profiles, compliance checklists. 18% of assets.", cadence: "2–3 assets/bln. Triggered by regulatory change or klien question.", tc: "text-blue-700" },
            { member: "Budi (Field)", contribution: "Field observation reports (typed by Sari, credited to Budi). BUJK behavior studies, regional market snapshots. 7% of assets.", cadence: "Monthly field report converted to 2–3 assets.", tc: "text-emerald-700" },
            { member: "Reza (Sales)", contribution: "Win/loss case studies, objection FAQ, klien testimonials, 'What BUJK asked us this week' recurring column. 6% of assets.", cadence: "1 case study/bln minimum. FAQ updated quarterly.", tc: "text-orange-700" },
            { member: "Hendra Jr. (Tech)", contribution: "Platform how-to guides, API documentation, data interpretation guides. 4% of assets.", cadence: "After every major feature launch.", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.member} className="flex gap-2 items-start border-b py-1.5">
              <div className="flex-1">
                <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.member}</p>
                <p className="text-[7px] text-muted-foreground mb-0.5">{r.contribution}</p>
                <p className="text-[7px] font-mono">Cadence: {r.cadence}</p>
              </div>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200 mt-1">
            <p className="text-[9px] font-bold text-blue-700">Why multi-contributor model matters:</p>
            <p className="text-[8px]">If Sari is the only contributor, registry growth = Sari's available hours. With 5 contributors: even if Sari's bandwidth is 0 one week, assets can still be produced. Also: Budi's field observations produce insights Sari cannot get from her desk. Reza's case studies are more persuasive than any Sari-written analysis. Different roles = different knowledge types = richer registry.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Monthly contribution review: Sari tracks contributions by team member. Hendra reviews annually. Target for 2026: Dewi contribution up to 22% (from 18%) as BIM vertical requires her specialized SKK knowledge. Budi contribution currently bottlenecked by his inability to type fast — solution: voice-to-text tool pilot starting Q3 2026.</p>
      </div>

      {/* Knowledge Quality Gate Process */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> QUALITY GATE — Proses Quality Gate Sebelum Setiap Knowledge Asset Dipublikasikan: 7 Checkpoint yang Mencegah Informasi Salah Masuk ke Tangan Klien
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { step: "G1 — Source Verification", owner: "Author", check: "Every factual claim must have a source. Source must be cited inline. Acceptable sources: government publications, LPJK official, verified field observation (Budi), peer-reviewed reference. Not acceptable: social media, unverified forums, 'general knowledge'.", tc: "text-blue-700" },
            { step: "G2 — Bahasa Clarity Check", owner: "Author", check: "Asset read aloud by author. If any sentence needs to be re-read to understand: rewrite. Target: BUJK operations manager (not PUPR bureaucrat, not MIT grad) can understand at first read.", tc: "text-blue-700" },
            { step: "G3 — Regulatory Cross-Check", owner: "Sari / Dewi", check: "For regulatory content: cross-check against current published Permen/Kepmen/Perpres text. If asset references a regulation by article number: verify article still exists and wording unchanged.", tc: "text-orange-700" },
            { step: "G4 — Impact Score Assignment", owner: "Sari", check: "RICE-style impact score assigned (Actionability, Reach, Urgency, Uniqueness, Accuracy). Score determines distribution channel. Anything scored without justification = rejected back to author.", tc: "text-orange-700" },
            { step: "G5 — Conflict of Interest Screen", owner: "Sari", check: "Does the asset inadvertently favor a specific asesor, BUJK, or service provider? If yes: either add balance or remove reference. MJP cannot appear to endorse specific commercial entities (except MJP's own services).", tc: "text-orange-700" },
            { step: "G6 — Legal Sensitivity Review", owner: "Hendra (spot check)", check: "For assets touching on: procurement fraud signals, specific BUJK performance, blacklist interpretation, legal disputes. Hendra reviews personally. Rule: descriptive, not accusatory. Pattern analysis, not individual allegations.", tc: "text-red-700" },
            { step: "G7 — Final Publish Authorization", owner: "Sari", check: "Sari's explicit sign-off required for all assets. Even Dewi-authored assets need Sari approval. No automated publish. Manual 'Publish' button = accountability moment. Sari's name is implicitly on every published asset.", tc: "text-red-700" },
          ].map((r) => (
            <div key={r.step} className="flex gap-2 border-b py-1.5">
              <p className={`text-[8px] font-bold w-28 shrink-0 ${r.tc}`}>{r.step}</p>
              <div className="flex-1">
                <p className="text-[7px] font-mono text-muted-foreground mb-0.5">Owner: {r.owner}</p>
                <p className="text-[7px] text-muted-foreground">{r.check}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total gate time: avg 45 menit per asset (end-to-end). For urgent L1-related assets: fast-track protocol — G1+G3+G7 only (20 menit). Fast-track only authorized by Sari for time-sensitive regulatory changes where delay {'>'} 1 hour is worse than skipping full gate. In 2025: 8 fast-track assets published. 0 errors found in retrospective audit of those 8.</p>
      </div>

      {/* Knowledge Asset Monetization Path */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> ASSET MONETIZATION — Bagaimana Knowledge Asset MJP Menghasilkan Uang: 4 Jalur Monetisasi dari 3.200 Asset yang Ada dan Proyeksi Kontribusi per Jalur
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            {[
              { path: "Jalur 1 — Subscription Gate", pct: "68%", rev: "Rp 485jt/bln", desc: "Knowledge assets behind paywall. Basic klien see preview only. Pro/Enterprise: full access. Asset quality = primary justification for subscription renewal. 'I subscribe because of Sari's regulatory analysis.'", tc: "text-primary" },
              { path: "Jalur 2 — SKK Express enablement", pct: "12%", rev: "Rp 84.6jt/bln", desc: "SKK assets (350+ items) directly enable Dewi's Express service. Without the SKK knowledge base, Express SLA would be 4 days not 5 days. Asset supports a transactional revenue stream.", tc: "text-emerald-700" },
              { path: "Jalur 3 — Pre-Bid Brief generator", pct: "6%", rev: "Rp 42jt/bln (Pro+ usage)", desc: "Pre-bid briefs auto-assembled from relevant knowledge assets. Each brief = 8–12 assets synthesized. Not separately charged — drives Pro tier retention (+41% retention lift).", tc: "text-blue-700" },
              { path: "Jalur 4 — Enterprise knowledge export (Q4 2026)", pct: "0% now", rev: "Target Rp 60jt/bln", desc: "Enterprise klien can export curated knowledge packs (20–50 assets) as offline PDF reference for field teams. Priced at Rp 500K/pack. Pipeline: 8 Enterprise klien expressed interest.", tc: "text-muted-foreground" },
            ].map((r) => (
              <div key={r.path} className="border rounded-sm p-2.5 bg-muted/5">
                <div className="flex items-center justify-between mb-0.5">
                  <p className={`text-[8px] font-bold ${r.tc}`}>{r.path}</p>
                  <span className="text-[7px] font-mono text-muted-foreground">{r.pct} of MRR</span>
                </div>
                <p className={`text-[9px] font-black ${r.tc} mb-0.5`}>{r.rev}</p>
                <p className="text-[7px] text-muted-foreground">{r.desc}</p>
              </div>
            ))}
          </div>
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700">Network effect insight:</p>
            <p className="text-[8px]">Each new knowledge asset slightly increases value for all klien (more complete picture). This is a weak but real network effect — MJP's moat strengthens with each published asset. At 3.200 assets, the corpus is already intimidating to replicate. At 10.000 assets (estimated 2028): no new entrant can catch up without 4+ years of dedicated research. Knowledge corpus = time-locked competitive moat.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Knowledge asset ROI: each Sari-authored asset costs ~2 hours (including quality gate). At Rp 485jt/bln subscription revenue from 3.200 assets: avg value per asset = Rp 152K/bln (perpetually). An asset published in 2022 is still generating subscription value today. Unlike a SaaS feature that depreciates, research assets often appreciate as the regulatory context they describe becomes more urgent.</p>
      </div>

      {/* Knowledge Vertical Expansion Plan */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> VERTICAL EXPANSION — Rencana Ekspansi Vertikal Knowledge Base MJP 2026–2028: 4 Vertikal Baru yang Sedang Dibangun dan Mengapa Setiap Vertikal Membutuhkan Investasi 12+ Bulan Sebelum Siap
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              vertical: "V1 — BIM (Building Information Modeling) Vertical",
              status: "ACTIVE — 6/20 assets live",
              rationale: "BIM mandate (Permen PUPR) wajib untuk proyek > Rp 100M non-sederhana from 2027. 12.400 BUJK need to comply. MJP has first-mover advantage — no comprehensive BIM intelligence platform for BUJK exists.",
              assets: "Target assets: BIM software comparison (4), BIM level compliance guide (3), BIM workflow templates (4), BIM cost estimator per BUJK class (3), BIM asesor directory (2), SKKNI BIM when published (4).",
              blocker: "Dewi is BIM content lead but currently at Express capacity. Need coordinator hire before BIM acceleration.",
              tc: "text-red-700", bc: "bg-red-50 border-red-200"
            },
            {
              vertical: "V2 — Green Construction / EDGE Certification",
              status: "PLANNED Q1 2027",
              rationale: "ESG mandates increasing for projects funded by World Bank, ADB, BUMN green bonds. 11% of 2026 pipeline involves ESG documentation requirement. MJP currently has 0 green construction assets.",
              assets: "Target: EDGE certification guide (4), green material sourcing (3), carbon reporting basics (2), ESG tender scoring (3) = 12 assets initial set.",
              blocker: "Requires Sari to develop domain knowledge (currently low familiarity). 3-month learning curve before first quality asset publishable.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              vertical: "V3 — Infrastructure Maintenance Market",
              status: "PLANNED Q2 2027",
              rationale: "Maintenance projects (pemeliharaan jalan, jembatan, irigasi) = Rp 47T/year. Different procurement rules, different KBLI codes, different BUJK class thresholds. Growing budget share.",
              assets: "Target: maintenance procurement guide (5), KBLI maintenance classification (3), maintenance HPS benchmarks (4), lifecycle cost analysis templates (3) = 15 assets initial set.",
              blocker: "Budi's field network is construction-first. Maintenance market requires different BUJK contacts. Network expansion needed.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              vertical: "V4 — Export / Overseas Construction Intelligence",
              status: "ASPIRATIONAL — 2028+",
              rationale: "Indonesian BUJKs increasingly pursuing overseas projects (Malaysia, Timor-Leste, Saudi Arabia — Indonesian workforce). MJP could extend to outbound BUJK market. Longer-term vision.",
              assets: "Would require: country-specific procurement rules, bilateral regulatory mapping, overseas SKK equivalency. Very high research investment.",
              blocker: "Sari has zero overseas market expertise. Would require dedicated hire. Post-Series A only.",
              tc: "text-muted-foreground", bc: "bg-muted/10 border-muted"
            },
          ].map((r) => (
            <div key={r.vertical} className={`border rounded-sm p-2.5 ${r.bc} mb-1`}>
              <div className="flex items-center justify-between mb-0.5">
                <p className={`text-[8px] font-bold ${r.tc}`}>{r.vertical}</p>
                <span className={`text-[7px] font-mono ${r.tc}`}>{r.status}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.rationale}</p>
              <p className="text-[7px] mb-0.5">Assets: {r.assets}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Blocker: {r.blocker}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Vertical expansion sequence: BIM (forced by mandate) → Green (ESG trend) → Maintenance (budget growth) → Export (post-scale). Hendra's rule: never start a vertical without a dedicated content owner who has domain expertise. A vertical launched without expertise = low-quality assets that damage MJP's credibility. One bad vertical can hurt the brand more than no expansion. Patience is the strategy.</p>
      </div>

      {/* Knowledge Freshness Decay Model */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-orange-500" /> DECAY MODEL — Model Peluruhan Relevansi Knowledge Asset MJP: Mengapa Ada Asset yang Perlu Di-update Tiap 3 Bulan dan Ada yang Masih Valid Setelah 4 Tahun
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Not all knowledge decays at the same rate. Sari's decay classification governs review schedules:</p>
          {[
            {
              class: "Kelas D1 — Highly Perishable (<3 bulan review)",
              types: "HPS benchmarks, competition density data, active blacklist alerts, tender award patterns",
              reason: "Market prices and competitive landscape shift quarterly. A 6-month-old HPS benchmark may be 12% wrong due to inflation.",
              trigger: "Calendar-based + any LPSE regulatory change.",
              count: "~340 assets (11% of corpus)", tc: "text-red-700"
            },
            {
              class: "Kelas D2 — Moderate Decay (6–12 bulan review)",
              types: "SKK/SBU requirements, BUJK classification guides, procurement rule interpretations",
              reason: "Regulations update 1–2x per year. Most SKK requirements stable between BNSP updates.",
              trigger: "After any LPJK/BNSP regulatory update + annual calendar review.",
              count: "~980 assets (31% of corpus)", tc: "text-orange-700"
            },
            {
              class: "Kelas D3 — Slow Decay (1–2 tahun review)",
              types: "Industry structure analysis, BUJK class characteristics, procurement process guides (structural)",
              reason: "Core procurement processes change slowly. A 2022 guide to pengadaan langsung is still mostly accurate.",
              trigger: "Major regulatory overhaul (e.g., new UU Jasa Konstruksi) OR Sari sees consistent contradiction in field data.",
              count: "~1.280 assets (40% of corpus)", tc: "text-blue-700"
            },
            {
              class: "Kelas D4 — Near-Permanent (review only on major change)",
              types: "Construction terminology, KBLI code definitions, historical case studies, foundational regulation primers",
              reason: "KBLI codes change rarely. A definition of 'Jasa Konstruksi' from 2020 is still correct today.",
              trigger: "Only on fundamental regulatory reform (rare — estimate once per 5 years).",
              count: "~600 assets (18% of corpus)", tc: "text-emerald-700"
            },
          ].map((r) => (
            <div key={r.class} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.class}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Types: {r.types}</p>
              <p className="text-[7px] mb-0.5">Reason: {r.reason}</p>
              <p className="text-[7px] font-mono text-muted-foreground mb-0.5">Trigger: {r.trigger}</p>
              <p className={`text-[7px] font-mono font-bold ${r.tc}`}>{r.count}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Decay model implemented as a tag on each asset in MJP's CMS. Sari's review queue auto-populates based on decay class + last-reviewed date. Backlog: 47 D1/D2 assets currently overdue for review (Sari capacity constraint). Resolution: Dewi cross-trained to review D2-class regulatory assets in her domain. Hendra: 'A knowledge base with stale data is worse than no knowledge base — you stop trusting everything.' Freshness = credibility.</p>
      </div>

      {/* Knowledge Production Pipeline */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Workflow className="h-3.5 w-3.5 text-primary" /> PRODUCTION PIPELINE — Pipeline Produksi Knowledge Asset MJP: Dari Sinyal Lapangan atau Regulasi Hingga Menjadi Asset yang Bisa Dikonsumsi Klien — 7 Tahap yang Biasanya Memakan Waktu 3–5 Hari Kerja
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { stage: "Stage 1 — Signal Capture", who: "Budi / Sari / Dewi", desc: "Raw input: Budi's field note, Sari's regulatory scan, Dewi's LPJK update. Logged to shared Notion 'Signal Inbox' within 24 hours of detection. No filtering at this stage — all signals captured.", time: "Continuous", tc: "text-muted-foreground" },
            { stage: "Stage 2 — Triage & Priority Score", who: "Sari", desc: "Sari reviews Signal Inbox weekly (Monday 08:00–10:00). Assigns RICE score. High-RICE signals tagged for immediate production. Low-RICE added to backlog. Closed signals archived.", time: "Monday AM weekly", tc: "text-blue-700" },
            { stage: "Stage 3 — Research & Drafting", who: "Sari (primary)", desc: "Sari writes asset. For regulatory: verifies source, summarizes implications, cites original regulation. For field intelligence: anonymizes Budi's notes, validates with 1 cross-reference. Target: 1 asset/day (80% of output).", time: "1–2 hari kerja", tc: "text-blue-700" },
            { stage: "Stage 4 — Expert Review (if needed)", who: "Sari + external expert", desc: "For complex technical content (geoteknik, MEP specifics, K3 compliance): Sari sends draft to relevant expert from her 6-person network. 48-hour turnaround SLA. 23% of assets require this step.", time: "+2 hari if triggered", tc: "text-orange-700" },
            { stage: "Stage 5 — Quality Gate", who: "Sari (self-check + 7 checkpoints)", desc: "Sari's 7-checkpoint quality gate: source citation, accuracy verification, construction-specific context, klien audience clarity, formatting, search keywords, decay class assignment. Zero-tolerance for missing citations.", time: "2–4 jam", tc: "text-orange-700" },
            { stage: "Stage 6 — Tagging & CMS Entry", who: "Hendra Jr. (automated assist)", desc: "Asset tagged: KBLI relevance, BUJK class, decay class, region, sector. Hendra Jr.'s tagging script suggests tags from content; Sari reviews. ~80% tag accuracy without Sari correction. 20% needs manual fix.", time: "30–60 menit", tc: "text-primary" },
            { stage: "Stage 7 — Publish + Briefing Flag", who: "Sari", desc: "Asset published to platform. If highly time-sensitive (L1 regulatory change): flagged for next Daily Briefing inclusion. Briefing uses top 3 new assets from last 24 hours.", time: "15 menit", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.stage} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.stage}</p>
                <span className="text-[7px] font-mono text-muted-foreground shrink-0">{r.who}</span>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.time}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total pipeline time: 3–5 days (standard), 5–7 days (with expert review). Bottleneck: Stage 3 (Sari's writing capacity). Solution path: (1) Dewi writes D2-class regulatory assets in her domain (in progress), (2) AI-assisted first draft generation (Sari prompts, reviews, edits — not generates). Currently: AI draft reduces Sari's writing time by ~35% per asset. Target: 60% reduction by 2027 with improved prompt library.</p>
      </div>

      {/* Knowledge Licensing Strategy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FileKey className="h-3.5 w-3.5 text-primary" /> LICENSING STRATEGY — Strategi Lisensi Knowledge Asset MJP: Kapan MJP Menjual, Kapan Memberi Gratis, Kapan Merahasiakan — dan 3 Model Lisensi yang Sedang Dieksplorasi untuk Menciptakan Revenue Stream Baru Selain Subscription
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              model: "Model L1 — Institutional Licensing (GAPENSI / INKINDO)",
              desc: "Bundle of 500+ knowledge assets licensed to asosiasi for distribution to members. Asosiasi pays flat annual fee (Rp 150–300jt/thn). Members access via asosiasi portal, not MJP platform. Upside: large contract, brand validation. Downside: no direct klien relationship, cannot upsell.",
              status: "Proposed — GAPENSI intro Q3 2026. Not yet presented.",
              risk: "Asosiasi may re-sell or re-publish. Contract must include attribution + no-derivative clause.",
              tc: "text-blue-700"
            },
            {
              model: "Model L2 — Government / LKPP Training Materials",
              desc: "License regulatory guides and procurement process assets to LKPP or PUPR for panitia training programs. Government pays per-module, per-session, or annual access. Builds MJP credibility with procurement authorities. Sari's academic network facilitates introductions.",
              status: "Exploratory — Sari has 1 contact at LKPP training division.",
              risk: "Government procurement cycles are slow. 6–18 months to close. High-effort, uncertain timeline.",
              tc: "text-emerald-700"
            },
            {
              model: "Model L3 — White-Label Briefing for BUMN Procurement Divisions",
              desc: "BUMN procurement teams receive daily briefing white-labeled with their brand. Same content as MJP Daily Briefing but BUMN-branded. Price: Rp 25–75jt/thn per BUMN. Hendra estimates 5–10 reachable BUMNs in construction sector.",
              status: "Concept stage. Requires separate sales motion (B2G/B2B2B).",
              risk: "BUMN procurement decisions involve long approval chains. Risk: effort to close Rp 25jt contract may exceed value.",
              tc: "text-orange-700"
            },
          ].map((r) => (
            <div key={r.model} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.model}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className={`text-[7px] font-mono mb-0.5 ${r.tc}`}>Status: {r.status}</p>
              <p className="text-[7px] font-mono text-muted-foreground">Risk: {r.risk}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-muted/10 mt-1">
            <p className="text-[9px] font-bold mb-0.5">What MJP will NEVER license (competitive moat protection):</p>
            {[
              "Raw BUJK trust score algorithm and weights",
              "Budi's field intelligence notes (personal + not structured for standalone use)",
              "HPS estimation model parameters",
              "Sari's signal-to-asset triage methodology (tacit knowledge, not codifiable)",
            ].map((d, i) => <p key={i} className="text-[7px]">• {d}</p>)}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Licensing revenue is a 2027+ initiative — Hendra is deliberately not pursuing it before Series A because: (1) any non-subscription revenue stream requires separate sales motion and team attention, (2) it may confuse MJP's product narrative for investors ('are you a SaaS or a content business?'). Post-Series A with dedicated BD hire: licensing target is Rp 200–400jt/thn by 2028. Not a primary revenue driver — a margin expansion play.</p>
      </div>

      {/* Asset Impact Measurement */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartLine className="h-3.5 w-3.5 text-primary" /> IMPACT MEASUREMENT — Pengukuran Dampak Knowledge Asset MJP: Bagaimana Kami Tahu Asset yang Dibuat Sari Benar-Benar Membantu Klien Menang Tender — dan Apa yang Terjadi Ketika Klien Melaporkan Asset Itu Salah
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Impact measurement across 3 dimensions:</p>
          {[
            {
              dim: "Dimension 1 — Engagement (leading indicator)",
              metrics: [
                "Views per asset: avg 847 (range: 12 to 14.200 for top-performing regulatory alert)",
                "Time-on-page: avg 4.2 minutes (indicates reading, not scanning)",
                "Bookmark rate: 23% of viewed assets bookmarked",
                "Share rate: 8% of viewed assets shared via WA to colleague",
              ],
              insight: "High-engagement assets identify priority knowledge areas. Top 20 assets by views account for 41% of all platform reading time.",
              tc: "text-blue-700"
            },
            {
              dim: "Dimension 2 — Downstream action (outcome indicator)",
              metrics: [
                "Alert-to-action: did klien submit a tender within 7 days of reading related asset?",
                "Asset-to-SKK-Express: did klien initiate SKK Express within 48h of reading SKK reminder guide?",
                "Regulatory asset → compliance action: klien who confirmed taking compliance action after reading",
              ],
              insight: "Sari's highest-impact asset category: SKK compliance guides (31% of readers take action within 48h). Lowest: market analysis reports (3.2% downstream action). Market analysis = informational, not action-triggering.",
              tc: "text-emerald-700"
            },
            {
              dim: "Dimension 3 — Reported outcomes (direct evidence)",
              metrics: [
                "Klien case studies: 28 collected (klien who attributed a win to MJP intelligence)",
                "Reported prevented losses: 19 blacklist saves + 47 SKK expiry saves in 2025",
                "Reza's deal notes: 'klien mentioned using [specific asset]' in 34 renewal conversations",
              ],
              insight: "28 case studies are MJP's most powerful sales material. Reza shares 1–2 per sales call as social proof. Sari produces 1 new case study/month from Reza's renewal notes.",
              tc: "text-orange-700"
            },
          ].map((r) => (
            <div key={r.dim} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.dim}</p>
              <div className="mb-0.5">{r.metrics.map((m, i) => <p key={i} className="text-[7px]">• {m}</p>)}</div>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.insight}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-red-50 border-red-200 mt-1">
            <p className="text-[9px] font-bold text-red-700">What happens when klien reports an asset error:</p>
            <p className="text-[8px]">Protocol: (1) Sari acknowledges within 2 hours via WA. (2) Investigates within 4 hours. (3) Corrects within 8 hours if confirmed error. (4) Sends correction note to all klien who bookmarked the asset. (5) Root cause logged to prevent recurrence. In 2025: 14 error reports. 11 confirmed errors corrected. 3 were klien misinterpretation — Sari added clarification text (not correction). Zero escalations to formal complaints.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Impact measurement feeds back into Sari's production decisions. High-engagement + high-action assets signal a knowledge area worth more coverage. Low-engagement + low-action assets go under Sari's 'why?' review: wrong audience targeting? Wrong format? Wrong topic framing? One insight from measurement: short, action-focused assets ({'<'} 500 words with clear 'what to do next') outperform comprehensive long-form guides on both engagement and downstream action. Sari shifted her format mix in 2025: 60% short-form, 40% comprehensive. Result: avg engagement up 23%.</p>
      </div>

      {/* Sari's Knowledge Sprint Calendar */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-primary" /> SARI'S SPRINT CALENDAR — Kalender Sprint Pengetahuan Sari: Bagaimana 5 Aset per Minggu Diproduksi — Dari Senin Riset Mandiri hingga Jumat Review dengan Hendra, dan Apa yang Terjadi Saat Sari Sakit
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { day: "Senin — Riset & Ideation Block (08:00–12:00)", activities: ["Review Hendra Jr.'s crawler digest (new regulatory publications overnight)", "Check industry news + asosiasi newsletters for emerging topics", "Select 5 asset topics for the week from backlog, factoring urgency + klien KBLI distribution", "Write 500-word topic brief for each: target audience, key questions to answer, sources to cite"], constraint: "Monday morning is protected — no meetings, no Reza calls, no external interruptions. This is the 'idea quality' investment hour." },
            { day: "Selasa–Rabu — Writing Block (09:00–15:00)", activities: ["Write 2–3 assets per day (short-form: 45–90 min each)", "Source verification: every factual claim gets a cited source (LPJK, BNSP, PUPR, academic)", "Cross-reference against existing assets (prevent duplication, ensure consistency)", "Internal tagging: KBLI codes, jenjang targets, urgency level, knowledge type"], constraint: "Sari's personal quality rule: no asset published without at least one piece of primary source evidence (not just secondary interpretation)." },
            { day: "Kamis — Dewi & Budi Sync (11:00–12:30)", activities: ["Dewi shares SKK/regulatory update intelligence from her committee contacts", "Budi shares field themes from the past week (what BUJK are asking, what they're confused about)", "Sari adjusts any of the week's assets based on field intelligence", "Identifies urgent topics that require same-week publication (bumps planned topics)"], constraint: "This sync is where 'textbook' knowledge becomes 'field-relevant' knowledge. Without it, Sari's content would be accurate but not resonant." },
            { day: "Jumat — Review, Publish & Next Sprint Prep (13:00–17:00)", activities: ["Hendra reviews 2–3 assets from the week (1 hour review, 15 min feedback)", "Sari incorporates feedback, finalizes all 5 assets", "Assets published to platform + tagged in daily briefing queue", "Checks prior week's engagement data: what performed, what didn't"], constraint: "Hendra's review ensures strategic consistency — Sari writes great content, Hendra ensures it aligns with current klien priorities and product positioning." },
          ].map((r) => (
            <div key={r.day} className="border-b py-1.5">
              <p className="text-[8px] font-bold text-primary mb-0.5">{r.day}</p>
              <div className="mb-0.5">{r.activities.map((a, i) => <p key={i} className="text-[7px]">• {a}</p>)}</div>
              <p className="text-[7px] font-mono text-muted-foreground">{r.constraint}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-red-50 border-red-200 mt-1">
            <p className="text-[9px] font-bold text-red-700">Business continuity: what happens when Sari is unavailable</p>
            <p className="text-[8px]">Protocol developed Q1 2026 after Sari's 9-day medical leave. (1) Hendra Jr. flags high-urgency alerts that week from regulatory crawlers. (2) Hendra writes short-form factual assets for L1-urgency items (basic format, no interpretation). (3) Budi defers non-urgent field questions to the following week. (4) Platform shows 'temporary reduced content pace' notice on knowledge registry. Maximum acceptable pause without klien impact: 2 weeks. Hendra: 'We can survive 2 weeks. After that, klien on Enterprise start asking why their advisory access is limited.'</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Weekly sprint produces 5 assets × 52 weeks = 260 assets/year at steady state. Actual 2025 output: 287 assets (11 weeks had 6+ assets due to regulatory burst events). The sprint calendar is the single most important operational process at MJP — everything that makes the knowledge registry valuable runs through Sari's Monday-to-Friday discipline. Hendra: 'Sari's process is MJP's product factory. The platform is just the distribution mechanism.'</p>
      </div>

      {/* Knowledge Asset Citation Standards */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Quote className="h-3.5 w-3.5 text-primary" /> CITATION STANDARDS — Standar Sitasi dan Evidensial Knowledge Asset MJP: Mengapa Setiap Klaim Harus Punya Sumber — 4 Tier Bukti dan Apa yang Terjadi Ketika Sebuah Sumber Dicabut atau Dikoreksi Setelah Publikasi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">MJP's 4-tier evidence hierarchy (from strongest to weakest):</p>
          {[
            { tier: "Tier 1 — Primary government source (strongest)", examples: ["Official Peraturan Menteri / Perpres / SE published on JDIH, BNSP, or LPJK portal", "LPSE public tender record with official nilai pagu and KBLI classification", "LPJK SBU registry official data"], uses: "Factual claims about regulations, thresholds, and official requirements. Tier 1 cited sources require screenshot evidence archived by Sari.", tc: "text-primary" },
            { tier: "Tier 2 — Institutional secondary source", examples: ["Official GAPENSI / Apersi / LPJK asosiasi publications", "Academic papers from Indonesian construction research institutions", "PUPR technical guidelines and government project specifications"], uses: "Interpretive claims about best practices and industry standards. Tier 2 sources cited by URL + access date.", tc: "text-blue-700" },
            { tier: "Tier 3 — Expert human intelligence", examples: ["Dewi's direct committee contact confirmation (named in Sari's notes but anonymized in asset)", "Sari's academic network contacts (subject matter experts)", "Budi's field observations with specific location + date context"], uses: "Pre-publication intelligence and field interpretation. Tier 3 marked as 'intelligence source' in asset — klien know it's human-sourced.", tc: "text-orange-700" },
            { tier: "Tier 4 — Corroborated field observation (weakest cited)", examples: ["Budi's field notes corroborated by 2+ independent BUJK mentions", "Reza's commercial intelligence from 3+ deal debriefs showing same pattern"], uses: "Emerging patterns and market intelligence. Tier 4 explicitly labeled 'Field intelligence — may not reflect official regulation' in asset text.", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.tier} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.tier}</p>
              <div className="mb-0.5">{r.examples.map((e, i) => <p key={i} className="text-[7px]">• {e}</p>)}</div>
              <p className={`text-[7px] font-mono ${r.tc}`}>Usage: {r.uses}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-red-50 border-red-200 mt-1">
            <p className="text-[9px] font-bold text-red-700">Source retraction/correction protocol:</p>
            <p className="text-[8px]">If a Tier 1 source is amended (regulation changed): (1) Sari identifies impacted assets within 24h of official amendment publication. (2) All impacted assets flagged with 'UPDATED — [date]' banner. (3) Assets with factual claims that are now incorrect: revision drafted within 48h. (4) Klien who bookmarked the asset: WA notification of update. In 2025: 34 assets required regulatory update (mostly SKK fee/threshold changes). Average revision time: 31 hours from detection to publication.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Citation standards are MJP's editorial constitution. Sari drafted the first version in 2023 after a near-miss: a Tier 4 field observation (unverified) was almost published as a factual claim. The standards prevent that. Hendra's view: 'We're not a blog. We're a professional intelligence service. Every claim in our knowledge registry carries implicit credibility with klien who may make multi-hundred-million decisions based on it. The citation standards are our professional liability framework.'</p>
      </div>

      {/* Knowledge Asset Lifecycle Management */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Archive className="h-3.5 w-3.5 text-primary" /> ASSET LIFECYCLE — Manajemen Siklus Hidup Knowledge Asset: Bagaimana MJP Mengelola 1.247 Asset yang Terus Bertambah — 4 Status Asset, Kebijakan Arsip, dan Sistem yang Mencegah Platform Terisi Informasi Kadaluarsa
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {[
              { status: "ACTIVE", count: "892", desc: "Current, verified, recommended for klien use", tc: "text-emerald-700" },
              { status: "REVIEW", count: "134", desc: "Scheduled for update — regulatory or market change flagged", tc: "text-orange-700" },
              { status: "ARCHIVED", count: "198", desc: "Superseded but retained for historical context", tc: "text-muted-foreground" },
              { status: "DRAFT", count: "23", desc: "In-production by Sari, not yet published", tc: "text-blue-700" },
            ].map((r) => (
              <div key={r.status} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-xs font-black font-mono ${r.tc}`}>{r.count}</p>
                <p className={`text-[8px] font-bold ${r.tc}`}>{r.status}</p>
                <p className="text-[7px] text-muted-foreground">{r.desc}</p>
              </div>
            ))}
          </div>
          {[
            { policy: "When does an asset move to REVIEW?", detail: "3 automatic triggers: (1) Regulation referenced in asset is amended (government source change detected), (2) Asset is > 18 months old in a fast-moving category (SKK, tender thresholds, KBLI classification), (3) Sari flags it manually after discovering a field signal that contradicts the asset's claims. In 2025: 134 assets moved to REVIEW, 112 updated and returned to ACTIVE, 22 archived because the topic was superseded.", tc: "text-orange-700" },
            { policy: "When does an asset get ARCHIVED vs. DELETED?", detail: "MJP never deletes published assets (they become part of the historical record — useful for 'what was the rule in 2023?' queries). Archive policy: asset is archived when: (1) The regulation or practice it describes is no longer in effect, (2) A newer asset covers the same topic with updated information, (3) The KBLI or classification it references has been restructured out of existence. ARCHIVED assets are not surfaced in standard search — but remain accessible via direct URL and historical queries.", tc: "text-muted-foreground" },
            { policy: "How does Sari manage 892 active assets?", detail: "Sari uses a rotating review calendar: assets are divided into 12 cohorts of ~74 assets each, reviewed monthly. One cohort/month ensures every active asset is reviewed at least once per year. Highest-priority categories (SKK, Tender regulations, HPS thresholds) are reviewed every 6 months, not 12. Sari: 'The calendar is what keeps me from only ever producing new content and neglecting what's already there. New assets are exciting. Maintenance is responsible.'", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.policy} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.policy}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Asset lifecycle management is invisible to klien and critical to their trust. If a klien asks their tender submission team to follow MJP guidance that was superseded by a 2024 regulation — and they don't know it was superseded — MJP's credibility is destroyed in that account. The REVIEW trigger system is MJP's defense against this failure mode. In 3 years of operation: 0 incidents of a klien acting on superseded-but-not-yet-updated MJP guidance. Hendra's goal: maintain that zero.</p>
      </div>

      {/* Knowledge Registry API — Future B2B Distribution */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Cable className="h-3.5 w-3.5 text-primary" /> REGISTRY API — Knowledge Registry API: Rencana Distribusi B2B Konten MJP via API — Siapa Target Pembeli API, Bagaimana Pricing Berbasis Token Bekerja, dan Mengapa Ini Hanya Akan Diluncurkan Setelah Corpus Mencapai 2.000 Asset
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              aspect: "What the Knowledge Registry API provides",
              detail: "Programmatic access to MJP's 1.247+ knowledge assets: search by KBLI category, regulation type, region, and publication date. Returns structured JSON: title, summary, tier (1–4), source citations, and full asset text. Rate-limited by subscription tier.",
              targets: "Target API buyers: (1) Construction ERP/accounting platforms embedding MJP's regulatory alerts in their product, (2) Legal firms advising BUJK on compliance who need structured regulatory data, (3) Academic institutions studying Indonesian construction procurement.",
              tc: "text-primary"
            },
            {
              aspect: "API pricing model (Hendra's draft, not yet finalized)",
              detail: "Token-based pricing: Rp 50/1.000 tokens (asset retrieval). Monthly minimums: Developer (Rp 500k/month, 10M tokens), Professional (Rp 2jt/month, 50M tokens), Enterprise API (Rp 7.5jt/month, unlimited). Regulatory alert webhook: +Rp 1jt/month flat fee for real-time webhook delivery.",
              targets: "Why token-based: API buyers vary dramatically in query volume. A solo developer testing integration uses 100k tokens/month. An ERP platform serving 500 BUJK uses 50M+ tokens/month. Token pricing scales fairly with actual usage.",
              tc: "text-blue-700"
            },
            {
              aspect: "Why corpus must reach 2.000 assets before API launch",
              detail: "API buyers need comprehensive coverage to find the API valuable. At 1.247 assets: significant KBLI sub-categories have < 5 assets (thin coverage). An ERP integrating MJP's API for their BUJK users would encounter gaps that make the integration unreliable. At 2.000 assets: coverage is dense enough that any common KBLI query returns at least 10 relevant results.",
              targets: "Timeline to 2.000 assets: at Sari's current pace (287 assets/year), reaching 2.000 requires ~2.6 years from current 1.247. Post-Series A with 2 Sari apprentices: ~14 months to 2.000. API launch target: Q2 2028 at earliest.",
              tc: "text-orange-700"
            },
            {
              aspect: "API governance: protecting editorial quality",
              detail: "MJP's API Terms of Service (Hendra's draft): (1) API content may not be re-published as-is without MJP attribution, (2) API content may not be used to train a competing AI model, (3) MJP retains the right to revoke API access if content is misused. Hendra's principle: 'Our knowledge assets are our IP. Distributing via API increases reach — but must not become a way for competitors to harvest our corpus.'",
              targets: "API governance clause enforcement: Hendra Jr. will log all high-volume API requests (> 100k tokens/hour) for manual review. Unusual bulk extraction patterns trigger an account review within 48h.",
              tc: "text-muted-foreground"
            },
          ].map((r) => (
            <div key={r.aspect} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.aspect}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.targets}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Knowledge Registry API is MJP's first B2B2C distribution channel — content reaches BUJK who are not direct MJP subscribers, through platforms they already use. The indirect reach amplifies brand awareness and creates a pipeline of BUJK who encounter MJP intelligence through an ERP before encountering MJP directly. Conversion from 'encountered via API partner' to 'direct MJP subscriber': Hendra estimates 8–12% based on analogous B2B2C funnels in SaaS. At 10.000 BUJK reached via API partners × 10% conversion = 1.000 new klien opportunity over 36 months. This is a meaningful portion of MJP's 3.000 klien target.</p>
      </div>

      {/* R96: Knowledge Supply Chain Stress Test */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleAlert className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE SUPPLY CHAIN STRESS TEST — Apa yang Terjadi Jika Sari Sakit 1 Bulan, Crawler Utama Down, atau Sumber Eksternal Berubah Kebijakan: Resiliensi Operasional Knowledge Registry MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              scenario: "S1: Sari tidak bisa bekerja selama 30 hari",
              probability: "MEDIUM — sakit, keluarga, atau burnout",
              impact: "892 active assets masuk mode 'read-only'. Tidak ada produksi baru. REVIEW queue (134 assets) tidak tersentuh. Alert delivery: 95% tetap berjalan (crawler tidak bergantung pada Sari). Regulasi baru: hanya raw data, tanpa annotation. Estimasi degradasi nilai: 15–20%.",
              mitigation: "Dua hal yang Sari harus selesaikan sebelum libur panjang: (1) pastikan semua asset yang expire dalam 30 hari sudah di-extend. (2) Tulis 10 'emergency annotation templates' untuk regulasi kategori paling umum — apprentice atau Hendra bisa fill in.",
              tc: "text-orange-700"
            },
            {
              scenario: "S2: JDIH (sumber regulasi utama) berubah struktur website",
              probability: "HIGH — JDIH pernah restrukturisasi 3 kali dalam 4 tahun",
              impact: "Regulasi crawler down. Sari tidak akan tahu sampai monitoring alert triggered. Recovery time historical: 2–3 hari (crawler fix) + 5–7 hari (backfill missed content). Total gap: ~10 hari regulasi content.",
              mitigation: "S2 adalah skenario yang sudah pernah terjadi (Q3 2024). Fix permanen: dual-source validation — jika JDIH tidak available, fallback ke peraturan.go.id scraping. Hendra Jr. membangun fallback ini setelah insiden Q3 2024.",
              tc: "text-red-700"
            },
            {
              scenario: "S3: LPSE ganti struktur data (pernah terjadi Q1 2025)",
              probability: "HIGH — LKPP terus update LPSE interface",
              impact: "Tender crawler menghasilkan malformed data. 2 tipe risk: (1) false data (parsial tender info, incomplete HPS). (2) missed tenders (crawler skip records yang formatnya berubah).",
              mitigation: "Hendra Jr. membangun schema validation layer post-Q1-2025 incident: setiap crawl result divalidasi terhadap expected schema. If field count drops below threshold, crawler sends alert to Hendra Jr. before publishing to klien.",
              tc: "text-red-700"
            },
            {
              scenario: "S4: Sumber data berbayar naik harga 3x (ijintender.co.id, dll.)",
              probability: "MEDIUM — negotiation leverage depends on MJP's dependency",
              impact: "Currently 0 paid external sources — all MJP data sources are public domain. This is a deliberate architectural decision: no single-vendor data dependency. Risk is near-zero for S4.",
              mitigation: "Hendra's principle: 'Never build a core product feature on a paid data source we don't control.' This eliminates S4 entirely. Future risk: if public sources move behind paywalls (unlikely for government portals).",
              tc: "text-emerald-700"
            },
          ].map((r) => (
            <div key={r.scenario} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.scenario}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.probability}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Impact: {r.impact}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Mitigasi: {r.mitigation}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Stress test dilakukan oleh Hendra setahun sekali (selalu menjelang Annual Planning). Hasilnya tidak dipublikasikan ke klien, tapi digunakan untuk 2 keputusan: (1) roadmap prioritization — setiap mitigation gap menjadi backlog item. (2) investor due diligence prep — investor Series A akan bertanya tentang single points of failure. Hendra: 'Sari adalah SPOF terbesar kami. Bukan karena sistemnya buruk, tapi karena kualitas annotasinya tidak bisa direplikasi dengan mudah. Apprentice hire bukan luxury — itu adalah resilience investment.' Knowledge Registry yang dimulai sebagai Google Sheet pada 2022 kini adalah infrastruktur paling defensible yang MJP miliki.</p>
      </div>

      {/* R97: Knowledge Asset Version Control */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE ASSET VERSION CONTROL — Bagaimana MJP Mengelola Perubahan pada 892 Knowledge Asset: Riwayat Versi, Rollback Capability, Diff Tracking, dan Audit Trail untuk Sari dan Klien
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { aspect: "Versioning model: Major vs Minor vs Patch", detail: "Major (X.0): perubahan konten substantif — regulasi baru, interpretasi berubah drastis, data sumber berubah. Minor (0.X): penambahan konteks, clarification, tambah referensi sumber. Patch (0.0.X): typo fix, formatting, broken link update. Sari memutuskan version level per update — ada judgment call di boundary Major/Minor.", examples: "Contoh Major: PP No. 14/2021 direvisi → SKK requirements berubah. Minor: tambah 2 contoh kasus dari lapangan. Patch: fix broken URL ke LPJK." , tc: "text-primary" },
            { aspect: "Diff tracking: apa yang berubah antara versi", detail: "Hendra Jr. membangun simple diff engine yang menampilkan perubahan antara versi dalam Knowledge Registry. Klien dengan Pro/Enterprise tier bisa lihat 'perubahan terbaru' per asset — ini adalah transparency feature yang meningkatkan trust. 'Asset ini terakhir diupdate 3 hari lalu karena regulasi ini: [link]'", examples: "Value untuk klien: jika klien punya dokumen yang mengacu ke knowledge asset, mereka tahu kapan harus update dokumen mereka. Reduces risk of klien operating on outdated intelligence.", tc: "text-blue-700" },
            { aspect: "Rollback protocol: kapan Sari rollback ke versi sebelumnya", detail: "Hanya 2 trigger untuk rollback: (1) Major update ternyata berdasarkan sumber yang tidak valid — rollback sambil flag investigation. (2) Regulasi yang sudah diupdate ternyata dibatalkan/ditunda (terjadi 3 kali di 2024–2025 karena PP yang ditarik kembali oleh pemerintah).", examples: "Rollback dalam hitungan menit karena semua versi tersimpan. Notification ke klien yang sudah menerima Major update yang di-rollback: mandatory. Hendra: 'Rollback adalah tindakan keberanian, bukan kegagalan. Lebih baik rollback cepat dari claim yang salah daripada membiarkan wrong data beredar.'", tc: "text-orange-700" },
            { aspect: "Audit trail: siapa yang mengubah apa dan kapan", detail: "Setiap perubahan ke knowledge asset tercatat: timestamp, user (saat ini hanya Sari, ke depan termasuk apprentice), version number, dan change reason (free-text yang Sari tulis per update). Audit trail tidak dapat dihapus — immutable log.", examples: "Penggunaan audit trail: (1) Investor due diligence — tunjukkan systematic content management. (2) Dispute resolution jika klien claim MJP memberikan informasi yang outdated — bisa ditunjukkan exact version yang klien terima pada tanggal X.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.aspect} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.aspect}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.examples}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Version control untuk knowledge assets adalah fitur yang tidak ada di MJP sampai Q2 2023. Sebelumnya, Sari update asset langsung (overwrite). Masalah muncul ketika klien bertanya: 'Interpretasi regulasi ini berubah ya? Apa yang berubah?' Sari tidak bisa menjawab karena tidak ada riwayat. Post-incident: Hendra Jr. membangun simple versioning dalam 3 hari. Hasilnya melebihi ekspektasi: version history ternyata berguna bukan hanya untuk rollback, tapi untuk klien yang ingin audit trail sendiri (especially Enterprise klien dengan compliance requirements). Sari: 'Version control membuat pekerjaan saya lebih accountable. Kadang tidak nyaman karena setiap kesalahan tercatat. Tapi itu benar — kesalahan harus tercatat agar tidak terulang.'</p>
      </div>

      {/* R98: Knowledge Cluster Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE CLUSTER MAP — Bagaimana 892 Knowledge Asset Saling Terhubung: 8 Cluster Utama, Cross-Cluster Dependencies, dan Mengapa Kluster SKK-Regulasi adalah Jantung dari Seluruh Graph
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { cluster: "C-SKK (231 assets — 26%)", desc: "Jenjang requirements, jabatan kerja descriptions, BNSP exam prep guides, LSP comparisons, upgrade paths. Central cluster: semua cluster lain reference C-SKK karena SKK requirement exists for nearly every construction activity.", links: "Links to: C-REGULASI (SKK requirements defined by regulation), C-TENDER (tender SBU prerequisites reference SKK), C-BUJK (BUJK capability defined by team SKK portfolio).", tc: "text-primary" },
            { cluster: "C-REGULASI (198 assets — 22%)", desc: "PP, Permen, SE, SNKI, K3, lingkungan, perizinan. Second-largest cluster. Sari's primary production domain — 78% of new assets created by Sari in 2025 were C-REGULASI.", links: "Links to: C-SKK (regulation defines SKK requirements), C-TENDER (tender procurement procedures), C-PROYEK (project execution compliance requirements).", tc: "text-blue-700" },
            { cluster: "C-TENDER (187 assets — 21%)", desc: "LPSE navigation, aanwijzing guides, document templates, evaluation criteria, protest procedures, post-award obligations. High klien usage cluster — most frequently accessed by Pro/Enterprise users.", links: "Links to: C-BUJK (competitor analysis for specific tenders), C-HPS (pricing context for bid preparation).", tc: "text-emerald-700" },
            { cluster: "C-BUJK (124 assets — 14%)", desc: "KBLI descriptions, SBU grade requirements, qualification thresholds, blacklist procedures, trust score methodology. Primarily reference assets — klien don't browse C-BUJK, they query specific BUJK.", links: "Links to: C-SKK (BUJK qualification depends on team SKK), C-TENDER (competitor presence in specific tenders).", tc: "text-orange-700" },
            { cluster: "C-HPS & MATERIAL (78 assets — 9%)", desc: "Historical price data, material cost benchmarks, regional price variations, IKN premium analysis, inflation adjustment guides. Most time-sensitive cluster — prices change faster than other categories.", links: "Standalone cluster with weak external links — price data is self-contained but feeds AI recommendation engine.", tc: "text-yellow-700" },
            { cluster: "C-PROYEK (74 assets — 8%)", desc: "Project execution guides: K3 protocols, subcontracting requirements, progress reporting, defect liability periods, variation order procedures.", links: "Links to: C-REGULASI (execution compliance), C-BUJK (subcontractor qualification), C-SKK (on-site SKK requirements).", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.cluster} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.cluster}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.links}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Knowledge cluster map adalah Sari's mental model — never formally drawn until Q1 2026 when Hendra asked her to present the Knowledge Registry architecture to a potential investor. Drawing the map revealed something Sari hadn't explicitly articulated before: C-SKK is the connective tissue of the entire registry. Remove C-SKK and every other cluster loses significant context. This insight immediately triggered a decision: C-SKK will always be the highest-priority cluster for maintenance quality and completeness — before any other cluster receives investment. Sari: 'Saya tahu ini secara intuitif selama 2 tahun. Tapi menggambarnya membuatnya jelas untuk orang lain. Dan kadang kamu perlu menjelaskan ke orang lain untuk benar-benar mengerti sendiri.'</p>
      </div>

      {/* R99: Knowledge Asset ROI Measurement */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE ASSET ROI MEASUREMENT — Bagaimana Sari Menentukan Apakah Sebuah Asset Layak 4.2 Jam Produksi: Metodologi Internal untuk Menghitung ROI per Asset dan Hasil dari Audit Q1 2026
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { metric: "Metric 1: Query-to-asset attribution rate", desc: "Berapa banyak NLQ queries yang di-answer (at least partially) oleh asset ini? Tracked via Hendra Jr.'s RAG pipeline attribution log. High attribution = high NLQ ROI.", benchmark: "Top 10% assets: 80+ attributed queries/month. Bottom 10%: fewer than 5 attributed queries in 6 months → candidate for retirement or rewrite.", tc: "text-primary" },
            { metric: "Metric 2: Search appearance rate in Sari's filter panel", desc: "Berapa kali asset muncul dalam browse/search results dan dipilih? Appearance data shows whether asset's tagging and categorization is correct.", benchmark: "Assets with 0 appearances in 90 days: tagging problem, not content problem. Sari fixes metadata before deciding to retire.", tc: "text-blue-700" },
            { metric: "Metric 3: Direct retention link (Enterprise cohort analysis)", desc: "Enterprise klien yang mengakses specific asset category: apakah mereka retain lebih baik? Hendra Jr. runs quarterly cohort: 'users who accessed C-SKK assets in month 1 vs those who didn't' — retention difference = asset category ROI.", benchmark: "C-SKK retention premium: +31%. C-TENDER: +24%. C-PROYEK: +8% (lowest — implies klien value it but it's not the primary reason they stay).", tc: "text-emerald-700" },
            { metric: "Metric 4: Save / bookmark rate", desc: "Klien yang bookmark asset = high individual value signal. Bookmark is the strongest intent signal — requires deliberate action. Assets with high bookmark rate are high priority for update when outdated.", benchmark: "Top bookmarked asset: PP No. 14/2021 interpretation guide — 234 bookmarks across all klien tiers. Sari reviews this asset priority any time the regulation is amended.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.metric} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.metric}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Benchmark: {r.benchmark}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Asset ROI measurement dirancang oleh Hendra Jr. dan Sari bersama selama Q4 2025 setelah Hendra mempertanyakan: 'Kita produce 15+ assets per bulan. Tapi apakah kita produce assets yang benar?' Sebelum ROI framework: Sari membuat assets berdasarkan intuisi tentang apa yang klien butuhkan. Post-framework: setiap production decision backed by at least one metric. Hasil audit Q1 2026: 67 assets (7.5%) identified as 'zombie assets' — produced but never accessed or cited. 34 were retired (outdated content), 33 were retagged to improve discoverability. Post-retagging: 23 of the 33 retagged assets saw 3x+ increase in query attribution. Sari: 'Bukan assetnya yang buruk. Tagging-nya yang salah. Ini mengajarkan saya: konten hanya bernilai kalau bisa ditemukan.'</p>
      </div>

      {/* R100: Knowledge Registry Competitive Moat Statement */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE REGISTRY COMPETITIVE MOAT STATEMENT — Mengapa 892 Asset yang Sari Buat Tidak Bisa Direplikasi dalam Waktu Kurang dari 3 Tahun, dan Apa yang Membuat Registry Ini Berbeda dari Sekedar Google Search
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { dimension: "Dimension 1: Construction-specific annotation depth", detail: "Regulasi umum bisa ditemukan di Google. Yang tidak bisa ditemukan di Google: interpretasi spesifik untuk konteks konstruksi pengadaan Indonesia. PP No. 14/2021 tersedia di JDIH. Tapi: 'Apa artinya untuk BUJK kelas menengah yang ingin naik ke kelas besar dalam 2 tahun dengan tim 12 orang?' — itu adalah MJP annotation yang tidak ada di sumber manapun. 4.2 jam rata-rata production time per asset mencerminkan depth yang tidak bisa digenerate secara otomatis.", tc: "text-primary" },
            { dimension: "Dimension 2: Cross-referencing yang built from user query patterns", detail: "Sari build cross-references bukan berdasarkan regulasi formal (yang sudah ada di JDIH) tapi berdasarkan klien questions. Ketika 3+ klien ask about relationship antara SKK J8 dan SBU grade Menengah: Sari membuat explicit cross-reference. Ini adalah emergent knowledge map yang reflects real user mental models — impossible to replicate without MJP's user query history.", tc: "text-blue-700" },
            { dimension: "Dimension 3: Living update cycle vs static legal databases", detail: "JDIH, hukumonline, dan legal databases update teks regulasi. MJP updates interpretation impact. Sari's quarterly review: re-assess setiap asset yang affected oleh regulatory change dan update 'impact analysis' section. Kompetitor yang hanya mirror regulasi text tidak capture the interpretation layer. This interpretive layer is MJP's core editorial value.", tc: "text-emerald-700" },
            { dimension: "Dimension 4: Replication time estimate", detail: "Hendra's calculation: jika competitor dengan Rp 500jt budget tries to replicate Knowledge Registry — berapa lama? Hiring 3 Sari-equivalents: 6 months to hire + onboard. Production at same quality: 15 assets/month/person × 3 = 45/month. Time to 892 assets at same depth: ~20 months. Total: 26 months minimum. By that time, MJP will have 1.200+ assets with 4 years of query optimization. Gap remains constant.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.dimension} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.dimension}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Knowledge Registry moat statement adalah Hendra's investor narrative centerpiece — more defensible than any technical infrastructure because it combines human expertise, time, and user behavior data into an asset that cannot be simply funded away. Hendra dalam setiap investor meeting: 'Kita tidak takut kompetitor yang punya uang lebih besar. Kita takut kompetitor yang dimulai 3 tahun sebelum kita. Mereka tidak ada. Kita adalah mereka.' Sari memahami betapa berharganya knowledge assets yang dia buat melebihi ekspektasi awalnya ketika bergabung: 'Saya pikir saya adalah kurator konten. Ternyata saya adalah arsitektur dari competitive moat paling important yang MJP miliki. Itu mengubah cara saya bekerja — setiap asset adalah brick di dinding yang melindungi semua yang kita bangun.'</p>
      </div>

      {/* R101: Knowledge Registry B2B Licensing Vision */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Cable className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE REGISTRY B2B LICENSING — Rencana MJP untuk Melisensikan Knowledge Assets ke Partner: Siapa Kandidat Licensee, Model Royalti vs Flat Fee, dan Mengapa Ini Bisa Menghasilkan Revenue Pasif Tanpa Sari Harus Produksi Lebih
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { licensee: "L1: GAPENSI/GAPEKSINDO member training materials", model: "Flat annual license: Rp 50–150jt/tahun per asosiasi", value: "Asosiasi menerbitkan panduan untuk anggota: guidance tentang PP No. 14/2021, K3, SKK. Saat ini mereka produce sendiri dengan tim internal — lebih rendah kualitas dari Sari's assets. Licensing MJP's curated assets: saves asosiasi production time, delivers higher quality to members, generates passive revenue for MJP.", constraints: "Content must be labeled 'Bersumber dari MJP' — brand visibility to 40.000+ GAPENSI members. Non-exclusive license: MJP retains right to publish same content.", tc: "text-primary" },
            { licensee: "L2: LSP (Lembaga Sertifikasi Profesi) training modules", model: "Per-module license: Rp 5–15jt per module per year", value: "LSP butuh up-to-date training materials untuk SKK preparation. MJP's SKK cluster (231 assets) adalah exactly what they need. 23 active LSPs in Indonesia × potential Rp 10jt average = Rp 230jt/year total addressable revenue.", constraints: "Technical K3 and engineering content: Sari may need to commission external subject matter expert for this specific sublicense. Cost: Rp 30–50jt one-time for technical review.", tc: "text-blue-700" },
            { licensee: "L3: Perbankan internal risk training", model: "Custom package: Rp 100–300jt one-time, annual update Rp 30–80jt", value: "Bank BUMN yang proses bank garansi konstruksi butuh account officers memahami BUJK qualification, SKK requirements, dan regulatory landscape. Current training: generic banking modules. MJP construction-specific modules = significant upgrade.", constraints: "Regulatory risk: bank compliance training has different liability implications. Each licensed package needs legal review. First bank partnership will require significant customization investment.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.licensee} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.licensee}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.model}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.value}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Constraints: {r.constraints}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Knowledge licensing adalah Sari's proposed fourth revenue stream — she brought this idea to Hendra after receiving her third unsolicited 'can we use your content?' request in Q4 2025 (from an LSP training director). Hendra's initial response: 'Kita sudah terlalu sibuk, kita tidak bisa manage licensing.' Sari's counter: 'If we build a simple licensing template once, each license is low-maintenance. These requests are coming anyway — the question is whether we capture the revenue or let them use our content for free.' Current status: Hendra agreed to pilot with 1 asosiasi (GAPENSI chapter) in Q3 2026 with Sari as project lead. If pilot generates Rp 50jt+ with {'<'} 20 hours Sari's time: scale. If more costly: reassess. Hendra: 'Sari adalah orang yang paling paham tentang value knowledge assets kita. Jika dia bilang ini bisa work, it's worth one structured pilot.'</p>
      </div>

      {/* R102: Knowledge Curation Quality Gates */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE CURATION QUALITY GATES — 5 Gate yang Setiap Asset Harus Lewati Sebelum Masuk Knowledge Registry: Rejection Rate, Kategori Rejection Terbanyak, dan Mengapa Sari Menolak 23% Draft Assets yang Dibuat
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { gate: "Gate 1: Source verifiability", question: "Apakah setiap klaim dalam asset bisa ditelusuri ke sumber resmi?", pass_criteria: "Minimum 1 official source per claim. Sources: PP/Permen/SE government, LKPP official publications, BNSP registry, peer-reviewed technical standards (SNI).", rejection_rate: "7% of drafts fail here", common_failure: "Sari's own interpretations or summaries that couldn't be tied back to a specific regulation or standard. Also: citing news articles as primary source instead of the underlying regulation.", tc: "text-primary" },
            { gate: "Gate 2: Currency check", question: "Apakah asset ini masih berlaku? Apakah ada amendment atau pengganti yang lebih baru?", pass_criteria: "All regulations verified against latest JDIH database. Technical standards: verified against latest SNI catalog. If superseded: existing asset must be marked deprecated and new asset created.", rejection_rate: "6% of drafts fail here (superseded content not caught in initial draft)", common_failure: "Sari drafts asset based on PP tahun 2016, not knowing it was amended in 2021. Requires full redraft.", tc: "text-orange-700" },
            { gate: "Gate 3: Practitioner relevance", question: "Apakah asset ini actionable untuk BUJK? Apakah ia menjawab pertanyaan nyata yang BUJK tanyakan?", pass_criteria: "Each asset must answer at least one question from MJP's NLQ top-100 query list OR address a pain point from Budi's field research. Pure regulatory text without interpretation = fails.", rejection_rate: "5% fail (too theoretical, not actionable)", common_failure: "Asset berisi teks regulasi lengkap tanpa interpretasi tentang apa artinya bagi BUJK dalam situasi nyata.", tc: "text-blue-700" },
            { gate: "Gate 4: Standalone clarity", question: "Apakah asset bisa dipahami tanpa harus membaca 5 asset lain dulu?", pass_criteria: "Every asset must contain sufficient context to be self-contained. Cross-references permitted but not required for comprehension.", rejection_rate: "3% fail (too much assumed knowledge)", common_failure: "Asset untuk SKK jenjang 9 yang assumes reader already knows jenjang 7 and 8 structure — requires link to prerequisite assets.", tc: "text-emerald-700" },
            { gate: "Gate 5: Cluster fit", question: "Apakah asset ini masuk ke cluster yang tepat? Apakah tidak ada overlap dengan asset yang sudah ada?", pass_criteria: "Cluster assignment reviewed against existing asset index. < 20% content overlap dengan existing assets. If overlap > 20%: merge or replace, don't add.", rejection_rate: "2% fail (duplicate content detected)", common_failure: "Sari drafts new asset about K3 requirements, not realizing a 94% similar asset already exists from 2023.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.gate} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.gate}: {r.question}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.rejection_rate}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Pass criteria: {r.pass_criteria}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Common failure: {r.common_failure}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Quality gate system adalah institusi yang Sari built to maintain her own standards — and to protect against the pressure to produce volume at expense of quality. Total rejection rate: 23% of first drafts fail at least one gate and require revision before entry. Sari's perspective: '23% rejection rate adalah sign of a healthy system. Jika rejection rate 0%, artinya gate tidak berfungsi — semua yang masuk terlalu mudah.' Practical workflow: Sari self-applies gates during drafting (catches 18% early), formal gate checklist applied before final commit (catches remaining 5%). Time cost: gate checklist adds approximately 25 minutes per asset. ROI: one bad asset that reaches a klien and provides wrong guidance = significant trust damage. Sari: 'Better to spend 25 minutes checking than to spend hours managing fallout dari klien yang mengambil keputusan berdasarkan asset yang salah.'</p>
      </div>

      {/* R103: Knowledge Registry Deprecation Policy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Archive className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE REGISTRY DEPRECATION POLICY — Apa yang Terjadi Saat Regulasi Dicabut atau Diganti: 4-Step Deprecation Process, Berapa Banyak Asset yang Sudah Deprecated, dan Mengapa Menyimpan Riwayat Regulasi adalah Fitur, Bukan Sampah
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { step: "Step 1: Detection (automated + manual)", desc: "Hendra Jr.'s crawler tracks JDIH publication dates. New regulation with 'mencabut' keyword: automated flag. Sari receives daily JDIH diff report — any new PP/Permen/SE that explicitly supersedes previous regulation triggers deprecation workflow.", timing: "Same-day detection target for major regulations. Next-day target for minor SE/circular changes.", tc: "text-primary" },
            { step: "Step 2: Impact assessment (Sari, 30–60 min per regulation)", desc: "Sari maps: which existing Knowledge Registry assets reference or are based on the deprecated regulation. Impact categories: FULL REPLACE (new regulation completely replaces old), PARTIAL UPDATE (some provisions changed, others unchanged), TRANSITION PERIOD (old regulation still valid during grace period — common for SKK compliance timelines).", timing: "Within 24 hours of detection for CRITICAL regulations (e.g., PP changes), 72 hours for non-critical.", tc: "text-blue-700" },
            { step: "Step 3: Asset treatment (per impact category)", desc: "FULL REPLACE: old asset marked deprecated with red banner ('Regulasi ini telah dicabut per [date]'), new asset created and linked as successor. PARTIAL UPDATE: existing asset updated in-place with change tracking, changelog appended. TRANSITION PERIOD: both old and new assets active with clear transition timeline indicator.", timing: "48 hours after impact assessment. Emergency: 4 hours for time-sensitive compliance changes.", tc: "text-orange-700" },
            { step: "Step 4: Klien notification", desc: "Enterprise klien: push notification via platform + email for any CRITICAL deprecated regulation that matches their KBLI/profile. Pro klien: weekly digest includes regulatory change summary. Starter klien: monthly digest. Deprecated assets never deleted — moved to 'Archive' status for historical reference. Historical data is valuable: klien with projects started under old regulation may need to reference it.", timing: "Immediate notification for HIGH IMPACT, weekly digest for MEDIUM/LOW.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.step} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.step}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Timing target: {r.timing}</p>
            </div>
          ))}
          <div className="py-1.5 border-t">
            <p className="text-[8px] font-bold text-primary mb-0.5">Current deprecation stats: 247 deprecated assets in Archive (out of 1.494 total including deprecated)</p>
            <p className="text-[7px] text-muted-foreground">247 deprecated assets = 16.5% of all assets ever created. This is a healthy ratio: regulatory framework changes regularly in Indonesia. Archive is accessible to all klien via 'Regulasi Historis' filter. Use case: BUJK in dispute about a project that started under old regulation — they can access the version of the regulation that was in effect at contract signing.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Deprecation policy adalah Sari's most operationally critical contribution — more important than new asset creation in some ways, because wrong information is actively harmful while missing information is merely incomplete. Sari: 'Setiap bulan saya remove lebih banyak nilai dari Knowledge Registry daripada yang saya tambahkan — dalam arti bahwa informasi lama yang tidak akurat harus keluar lebih cepat dari yang baru masuk. Kualitas Registry bukan hanya tentang apa yang ada di dalamnya. Ini tentang apa yang tidak ada karena sudah kita keluarkan tepat waktu.' The deprecation process is one of MJP's least glamorous but most defensible operations: it means klien who access the Knowledge Registry are accessing current, correct information — not a stale archive that hasn't been pruned in years.</p>
      </div>

      {/* R104: Knowledge Registry Community Contribution Model */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE COMMUNITY CONTRIBUTION — Proposal Sari untuk Mengundang Klien Enterprise Berkontribusi ke Knowledge Registry: Model, Safeguards, dan Mengapa Ini Bisa Menggandakan Output tanpa Menambah Staff
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { aspect: "The proposal: Enterprise klien as domain experts contributing practical knowledge", detail: "Several Enterprise klien have deep domain expertise MJP doesn't have: General Counsel (Advisor D) on legal interpretation, MEP specialists on technical standards, BUJK that works in IKN on ground-truth procurement dynamics. Proposal: invite 5–10 Enterprise klien to contribute 'practitioner notes' — short annotations attached to Knowledge Registry assets, sharing how the regulation plays out in their real experience.", sari_view: "Sari: 'Saya tahu regulasinya. Tapi saya tidak pernah actually file a bank guarantee atau negotiated a construction contract. Klien yang punya pengalaman itu bisa menambahkan dimensi yang saya tidak bisa produce sendiri.'", tc: "text-primary" },
            { aspect: "Quality safeguard model: Sari reviews all contributions before publication", detail: "Contribution workflow: Enterprise klien submits practitioner note via platform → Sari reviews for: factual accuracy (regulation citations), potential conflict of interest (contributor promoting their own services), and alignment with MJP's editorial standards. Approved: published with contributor's company name (not individual name, to prevent personal liability concerns). Rejected: Sari provides feedback, contributor can revise.", sari_view: "Sari is the editor-in-chief of practitioner contributions, not a passive conduit. Her quality standards apply equally to contributed content.", tc: "text-blue-700" },
            { aspect: "Incentive structure for contributing Enterprise klien", detail: "Contributing Enterprise klien receive: (1) 'Knowledge Contributor' badge visible in platform profile (trust signal for JO partners), (2) 1-month subscription credit per approved contribution (max 3/year), (3) Priority access to Sari for custom research questions. No financial payment — contributions are recognized as community service, not employment.", sari_view: "Non-monetary incentives are intentional: financial payment would create contributor expectations that would conflict with Sari's editorial independence.", tc: "text-emerald-700" },
            { aspect: "Hendra's concern: liability and editorial independence", detail: "Hendra's hesitation: practitioner notes that contain incorrect information could expose MJP to liability if klien rely on them. Proposed mitigation: clear labeling ('Practitioner Perspective, not MJP official guidance'), mandatory citation of regulation basis, and Sari's mandatory review. Hendra Jr.'s concern: database architecture for 'contributed content' vs 'Sari-authored content' is non-trivial to separate in Knowledge Registry display.", sari_view: "Current status: pilot proposal approved for 3 Enterprise klien in Q3 2026. If pilot generates 10+ high-quality contributions without quality incidents: scale.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.aspect} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.aspect}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Sari: {r.sari_view}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Community contribution model adalah Sari's most ambitious long-term vision for Knowledge Registry — transforming it from a Sari-produces-everything model to a curated community platform where practitioners contribute ground-truth knowledge that Sari couldn't produce alone. The analogy Sari uses: 'Saya adalah editor kamus konstruksi Indonesia yang paling komprehensif. Saya tidak bisa write every entry — tapi saya bisa ensure setiap entry yang masuk memenuhi standard editorial yang ketat.' If the model works: Knowledge Registry's production capacity scales beyond Sari's individual bandwidth without losing quality. If it doesn't work: Sari has wasted time on review overhead. The pilot will reveal which. Hendra: 'Jika Sari bisa build a contributor community of 20 Enterprise klien yang masing-masing contribute 3–4 high-quality assets per year: itu adalah 60–80 additional assets per tahun tanpa hiring anyone. Di sisi lain, jika kontrol kualitas jadi isu, kita stop. Sari memiliki veto power atas setiap contribution.'</p>
      </div>

      {/* R105: Knowledge Registry as Due Diligence Language */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE AS COMMON LANGUAGE — Bagaimana Knowledge Registry Menciptakan Shared Vocabulary antara MJP dan Klien: Mengapa BUJK yang Berbicara dengan Bahasa yang Sama Membuat Keputusan yang Lebih Baik Bersama-sama
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { phenomenon: "The vocabulary convergence effect", observation: "After 6+ months using MJP: Enterprise klien start using MJP's exact terminology in their internal meetings and vendor negotiations. 'Trust Score 74' replaces 'saya rasa rekanan ini kurang reliable.' 'Kualifikasi Menengah Atas' replaces 'kontraktor yang lumayan besar.' 'LPSE Tier-2 province' replaces 'daerah yang agak lambat tendernya.' This is not accidental — it's the result of Sari's precise vocabulary throughout the Knowledge Registry.", impact: "Shared vocabulary reduces misunderstanding in klien–MJP support interactions. Reduces ambiguity in klien's internal decision-making. Creates natural 'stickiness': klien who have adopted MJP vocabulary find it hard to describe their business with tools that use different terminology.", tc: "text-primary" },
            { phenomenon: "Knowledge assets as contract dispute evidence", observation: "3 Enterprise klien have used MJP's Knowledge Registry assets as supporting evidence in contract disputes with panitia. Example: Klien cited MKR-K3-089 (K3 requirements for projects {'>'} 15 floors) in written dispute with panitia who claimed klien's K3 budget was insufficient. Panitia reversed their position when presented with authoritative Knowledge Registry citation.", impact: "MJP knowledge assets are becoming 'authoritative source' in industry disputes — not because of legal standing but because of perceived accuracy and comprehensive sourcing. When a BUJK says 'according to MJP Knowledge Registry...' in a dispute: counterparty treats it with weight.", tc: "text-emerald-700" },
            { phenomenon: "Sari as industry knowledge authority (personal brand extending MJP's)", observation: "Sari has been cited by name in 2 industry publications as 'Knowledge Manager MJP' in articles about regulatory changes. 3 asosiasi have requested Sari present at their events. 1 university invited Sari to guest lecture on construction procurement regulation. Sari's personal credibility is becoming a strategic asset for MJP: her name on a Knowledge Registry asset adds legitimacy.", impact: "Sari's authority is both an asset and a succession risk. If Sari leaves: Knowledge Registry loses not just producer but credibility source. Hendra's mitigation: maintain 'MJP Knowledge Team' branding alongside Sari's name, so institutional credibility is attributed to MJP system, not only Sari as individual.", tc: "text-orange-700" },
            { phenomenon: "Knowledge Registry citations in NLQ becoming circular reference", observation: "Interesting pattern: NLQ is trained on Knowledge Registry. Klien use NLQ answers (citing Knowledge Registry) as input to future Knowledge Registry contribution proposals. Feedback loop: practice ('what are klien actually asking') → Knowledge Registry (Sari answers the question authoritatively) → NLQ training data. Circle is virtuous: each loop improves both products simultaneously.", impact: "Self-reinforcing: more use → better NLQ → better knowledge → more use. The only breakage risk: if NLQ generates incorrect answers that klien accept and reuse as accurate, polluting the knowledge loop. This is why Sari's review of NLQ low-confidence cases is operationally critical — not just for UX, but for knowledge integrity.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.phenomenon} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.phenomenon}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.observation}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Impact: {r.impact}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Knowledge as common language adalah observation yang Hendra made during Reza's first Enterprise renewal cycle: 'The clients who renewed most easily were the ones who had started using our vocabulary. The ones who churned still talked about procurement the way they talked before MJP.' This observation reshaped how Hendra thinks about platform success metrics. It's not just about how many times klien log in — it's about whether MJP has become the cognitive framework through which they understand their business. A platform that changes how people think about their domain has created a category — not just a product. Sari: 'Saya tidak hanya menulis konten. Saya sedang menciptakan bahasa. Dan bahasa yang tepat untuk domain yang kompleks adalah asset yang paling susah untuk direplikasi.'</p>
      </div>

      {/* R106: Sari's Personal Research Methodology */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> SARI'S PERSONAL RESEARCH METHODOLOGY — Bagaimana Sari Memproduksi 1.247 Knowledge Assets dengan 1 Orang dalam 4 Tahun: Proses, Alat, dan Ritual Harian yang Dia Gunakan untuk Menjaga Kualitas Tanpa Burnout
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { method: "Daily ritual: 7:00–9:00 AM regulasi monitoring window", detail: "Before any production work: Sari reads JDIH BPHN, LKPP's announcement page, and Sekretariat Kabinet's latest publications. 2 hours, every working day. This window has caught 73 regulatory updates that became CRITICAL assets. Without this ritual: many would have been caught hours or days later. Sari: 'Monitoring pagi adalah non-negotiable. Ini bukan pekerjaan kreatif — ini adalah watch duty.'", outcome: "Average 3.2 new regulatory signals per week that require at least triage. Average 0.8 signals per week that require same-day asset update or creation.", tc: "text-primary" },
            { method: "Asset production: 'First draft in voice, not writing'", detail: "Sari's unusual workflow: before writing, she records a 3–5 minute audio explanation of the regulation as if explaining to a BUJK owner who doesn't have a legal background. The recording forces plain language first. Then she writes the formal asset from the plain language draft — not the other way around. Result: assets that are technically accurate AND readable by non-lawyers.", outcome: "Klien NLQ satisfaction for Knowledge Registry-sourced answers is higher when the source asset used Sari's voice-first method (measured indirectly through NLQ follow-up question rate — lower follow-up = higher clarity).", tc: "text-blue-700" },
            { method: "Weekly 'asset health check' — review 15 random assets for freshness", detail: "Every Friday: Sari randomly selects 15 assets from the full registry and checks if any regulatory changes have affected them since publication. Average: 2–3 assets need updates each week. This prevents the accumulation of silently stale assets that the deprecation process misses.", outcome: "Has caught 23 silent staleness cases in 2 years — assets that technically hadn't been superseded by a new regulation but had been rendered inaccurate by policy interpretation changes that weren't formally published.", tc: "text-emerald-700" },
            { method: "Monthly collaboration with Hendra Jr.: 'NLQ failure analysis'", detail: "Monthly meeting: Hendra Jr. brings the 20 most-failed NLQ queries (queries where NLQ returned low confidence or no match). Sari triages: (1) Knowledge Registry gap → Sari produces new asset, (2) Knowledge Registry exists but NLQ can't find it → Hendra Jr. fixes search/indexing, (3) Out-of-scope query → Sari documents as 'known gap, won't cover.' This meeting is the primary driver of Sari's production priorities.", outcome: "73% of new asset production in 2025–2026 was driven by NLQ failure analysis rather than Sari's independent judgment. Data-driven content production vs editorial judgment production — better alignment with actual user needs.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.method} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.method}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Outcome: {r.outcome}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Sari's personal research methodology adalah one of MJP's most valuable undocumented assets — until now. The 4 practices above are Sari's own innovation: no one told her to record audio first, no one designed the weekly health check, no one required the NLQ failure analysis meeting. These practices emerged from Sari's experience of what worked (produced high-quality assets without burnout) vs what didn't (sequential production without systematic feedback led to coverage drift). The bus factor for Sari's methodology: currently 1.0. If Sari leaves: her replacements won't naturally discover these practices — they'll default to less effective production patterns. Documentation of Sari's methodology is part of MJP's knowledge transfer initiative. A Knowledge Registry production SOP is being written by Sari herself — capturing these 4 practices plus 8 others into a reproducible guide for future Knowledge Managers. Hendra: 'Sari adalah sistem produksi knowledge terbaik yang kami punya. Tapi sistem itu perlu bisa direplikasi. Itu adalah proyek Sari yang paling penting tahun ini — mendokumentasikan dirinya sendiri.'</p>
      </div>

      {/* R107: Knowledge Registry as National Infrastructure Asset */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE REGISTRY AS NATIONAL ASSET — Visi Hendra: Jika MJP Berhasil, Knowledge Registry Bisa Menjadi Infrastruktur Digital untuk Industri Konstruksi Indonesia — Lebih Besar dari Produk, Menjadi Standar
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { milestone: "M-1: From 'MJP's knowledge base' to 'the construction knowledge standard'", what_it_means: "Currently: Knowledge Registry is perceived as MJP's proprietary content — a feature that differentiates MJP from competitors. The aspiration: if Knowledge Registry covers 80%+ of all relevant construction procurement regulations, standards, and practices, with verified accuracy and regular updates, it becomes the de facto reference — not MJP's version of it, but THE version.", evidence_of_progress: "3 industry publications have cited MJP Knowledge Registry assets. LKPP has referenced MJP data in working group. GAPENSI licensing pilot would make Knowledge Registry assets available to all GAPENSI members. These are steps toward 'standard' positioning.", tc: "text-primary" },
            { milestone: "M-2: Government recognition as official information partner", what_it_means: "The 'Mitra Pengadaan' LKPP application (if approved) would give MJP official government recognition. If extended: MJP's Knowledge Registry could be formally referenced in government procurement guidelines as an approved information source. Not required for MJP's business success, but it would represent transformation from 'startup with useful data' to 'recognized infrastructure.'", evidence_of_progress: "LKPP working group participation. BNSP MOU negotiation. SUB-3 regulatory input accepted in draft document. Trajectory points toward recognition — timing uncertain.", tc: "text-blue-700" },
            { milestone: "M-3: Open Knowledge API — letting ecosystem build on top of MJP's knowledge layer", what_it_means: "Post-Series B (2028+) concept: MJP makes its Knowledge Registry available via API to other platforms — construction ERP software, bank credit systems, HR platforms that hire construction professionals, university curriculum platforms. Not free — metered API pricing based on query volume. Revenue model: B2B data licensing (L1/L2/L3 tiers from R101 panel).", evidence_of_progress: "Bank BUMN pilot (PE-2 from sinyal-pasar page) is the first external API use case. The bank's credit officer system using Trust Score data is the proof-of-concept for the 'knowledge layer accessible by external platforms' model.", tc: "text-emerald-700" },
            { milestone: "M-4: The public interest clause — some knowledge should be free", what_it_means: "Hendra's philosophical commitment: if Knowledge Registry ever becomes sufficiently comprehensive to be national infrastructure, there are certain categories that should be accessible for free — regardless of subscription status. Proposed: all critical (life-safety) construction regulations (K3, structural standards, fire safety) accessible freely. Rationale: if a BUJK ignores K3 because they couldn't afford to access the regulation: someone could be hurt. That is not a scenario MJP wants to contribute to.", evidence_of_progress: "Currently: 47 K3-related assets available at Starter tier (lowest paid tier). Genuinely free public access: not implemented. Hendra's commitment: this will be a Board-level discussion post-Series A.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.milestone} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.milestone}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.what_it_means}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Evidence of progress: {r.evidence_of_progress}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Knowledge Registry as national infrastructure asset adalah the vision that Hendra rarely articulates publicly — because it sounds grandiose and could invite scrutiny before MJP has earned the credibility to make the claim. But internally: it's the vision that makes Sari's unglamorous daily work feel meaningful, that makes Hendra invest in Sari's role before the revenue justifies it, and that shapes every decision about what to cover and to what standard. The vision has a specific precedent: Bloomberg Terminal became financial infrastructure. Reuters became news infrastructure. Both started as tools for specific professionals and became the standard that their industries relied on. MJP's equivalent: a Knowledge Registry that every construction professional in Indonesia references — because it's the most comprehensive, most accurate, most current source available. Getting from 'feature' to 'infrastructure' requires: 80%+ coverage, verified accuracy, regulatory recognition, and API accessibility. MJP is at 44% coverage. The journey is long. But Sari produces 4–5 new assets every week. Hendra: 'Infrastruktur tidak dibangun dalam satu hari. Tapi setiap hari tanpa membangun, Anda tidak mendekati infrastruktur. Kami membangun setiap hari.'</p>
      </div>

      {/* R108: Knowledge Decay — How MJP Manages the Half-Life of Information */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE DECAY MANAGEMENT — Bagaimana MJP Mengelola Half-Life Informasi: 4 Kategori Aset Berdasarkan Kecepatan Kedaluwarsa dan Proses yang Digunakan Sari untuk Memastikan Tidak Ada Klien yang Mendapat Informasi Usang
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { category: "DECAY-1: Evergreen assets — valid untuk 5+ tahun tanpa update", examples: "Procurement process fundamentals (how LPSE works, what kualifikasi categories mean, how HPS is calculated), construction law principles (Undang-Undang Jasa Konstruksi framework), BUJK registration process guides. These are based on structural elements of Indonesian procurement law that change infrequently.", sari_approach: "Reviewed annually: Sari reads the full asset and confirms no material change required. If a paragraph-level update is needed: minor edit, no 'last updated' flag triggered. Total Evergreen assets: 247. Annual review time: ~40 hours (10 min/asset × 247). Low maintenance, high value — these are the foundation of Knowledge Registry's comprehensiveness score.", tc: "text-primary" },
            { category: "DECAY-2: Annual cycle assets — update setiap tahun berdasarkan perubahan regulasi rutin", examples: "Kualifikasi threshold values (updated yearly by PUPR), BNSP SKK assessment fee schedules, LPSE procurement threshold updates (Perpres refresh), minimum SKK holder requirements by kualifikasi level. These change on a predictable annual schedule.", sari_approach: "Flagged for review at the start of each calendar year AND whenever a regulatory publication triggers the area. Sari maintains a 'regulatory calendar' — a list of expected annual publication dates for each asset category. Before each expected publication: Sari pre-reads the previous regulation to prepare for comparison. After publication: update within 48 hours. Total Annual Cycle assets: 189.", tc: "text-blue-700" },
            { category: "DECAY-3: Event-driven assets — update dipicu oleh perubahan regulasi spesifik", examples: "Specific regulatory circular interpretations, IKN-specific procurement guidelines, KPBU procedural documents, emergency procurement protocols (COVID-era procedures being sunset). These don't follow a predictable schedule — they change when the government issues new guidance.", sari_approach: "Monitoring-triggered: Sari's daily monitoring creates alerts when a known event-driven asset area has new government publications. Average event-driven update: 3–5 assets per week. Heaviest weeks (e.g., UU Cipta Kerja implementation period): 15–20 assets requiring update simultaneously. Emergency protocol (REG-1) was designed specifically for these peak periods.", tc: "text-emerald-700" },
            { category: "DECAY-4: Ephemeral assets — valid hanya dalam jendela waktu tertentu", examples: "Active tender announcements used as reference examples, ongoing regulation public comment periods, specific contractor Trust Score assessments (valid until next LPSE contract award cycle), IKN Phase 1 project lists (being replaced by Phase 2). These are inherently time-limited.", sari_approach: "Each Ephemeral asset has an explicit expiry field: a date after which the asset is automatically flagged for review/archival. Hendra Jr. built an auto-expiry queue that Sari reviews weekly. Expired assets: archived (searchable but marked 'historical context only') rather than deleted — historical regulatory documents have research value. Active ephemeral assets: 94 currently.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.category} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.category}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Examples: {r.examples}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Sari's approach: {r.sari_approach}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Knowledge decay management adalah the operational discipline that ensures Knowledge Registry's 847 assets remain accurate over time — not just accurate when first published. Total asset distribution: Evergreen 29%, Annual Cycle 22%, Event-Driven 39%, Ephemeral 11%. The Event-Driven category (39%) is the most operationally demanding: no predictable schedule, variable volume, zero tolerance for delay on high-severity changes. The decay framework was designed by Sari in 2023 after a specific incident: a klien relied on an outdated Knowledge Registry asset about kualifikasi thresholds that had changed 6 months earlier. The asset hadn't been flagged for review because it didn't fit the (then-rudimentary) update process. Sari's response: redesigned the entire update workflow with explicit decay categories, review triggers, and expiry fields. The incident cost MJP one Enterprise klien (CHURN-4 profile). The redesigned workflow: has not produced a repeat incident in 2 years. Total assets with confirmed-current status: 98.3% (14 assets currently in review queue, all flagged, none yet delivered to klien as authoritative). The 1.7% in-review rate is the operational buffer — Sari's target is to keep it below 2% at all times. Sari: 'Knowledge Registry yang tidak diupdate bukan hanya tidak berguna — ia berbahaya. Informasi yang salah dalam keputusan bisnis yang nyata: itu adalah kerusakan yang MJP akan merasa tanggung jawab untuk memperbaiki. Menjaga setiap aset current adalah cara saya tidur nyenyak.'</p>
      </div>

      {/* R109: Knowledge Registry Coverage Gap Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Map className="h-3.5 w-3.5 text-primary" /> COVERAGE GAP ANALYSIS — Apa yang Belum Ada di Knowledge Registry: 5 Area dengan Gap Terbesar, Mengapa Belum Diisi, dan Roadmap Sari untuk Menjangkau 80% Coverage Target
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { gap: "GAP-1: IKN-specific regulatory framework (coverage ~35%)", why_it_matters: "IKN operates under OIKN (Otorita IKN) authority — different legal framework from standard LPSE procurement. KPBU (Public-Private Partnership) procurement rules, IKN-specific labor regulations, IKN environmental compliance requirements: all underrepresented in current Knowledge Registry. For BUJK pursuing IKN tenders: significant coverage gap in the exact area where intelligence is most valuable.", why_not_filled: "OIKN regulations are still being issued (new circulars monthly). Sari's challenge: a regulatory framework under active construction requires ongoing creation, not catch-up. Current strategy: create IKN knowledge assets as regulations stabilize (2 assets/week target for IKN regulatory area starting Q3 2026).", tc: "text-primary" },
            { gap: "GAP-2: Pengadaan Langsung detail (contracts {'<'} Rp 200M) — coverage ~28%", why_it_matters: "Pengadaan Langsung (direct procurement) covers all contracts under the Rp 200M threshold. This represents the highest volume of contracts in Indonesia by count — accessible to Kualifikasi Kecil BUJK without LPSE tender process. But MJP's LPSE-focused data architecture means this segment is significantly underserved. BUJK that primarily win Pengadaan Langsung contracts: poorly served by MJP's current Knowledge Registry.", why_not_filled: "Pengadaan Langsung doesn't appear in LPSE — it's documented via local government procurement records. Data gathering requires different infrastructure than LPSE crawling. Roadmap: post-Series A, new data source pipeline for Pengadaan Langsung records from sample of kabupaten procurement offices.", tc: "text-blue-700" },
            { gap: "GAP-3: Subcontracting regulations and BUJK sub-tier compliance — coverage ~41%", why_it_matters: "Most large construction projects involve multiple layers of subcontracting. The regulations governing subcontractor qualification requirements, BUJK responsibilities for subcontractor compliance, and subcontractor payment rules: underrepresented in Knowledge Registry. As BUJK Menengah-Besar increasingly use subcontractors for specialty work: this gap becomes increasingly important.", why_not_filled: "Subcontracting regulations span multiple regulatory sources (labor law, procurement law, sector-specific regulations). Sari's challenge: synthesizing across regulatory sources into clear guidance takes more research time than single-regulation assets. Priority: Q4 2026, starting with KBLI categories where subcontracting is most common (electrical, mechanical, specialized civil).", tc: "text-emerald-700" },
            { gap: "GAP-4: Regional government procurement variations — coverage ~22%", why_it_matters: "While national procurement regulations are uniform, regional implementations vary: local PERDA (Regional Regulation) additional requirements, provincial government procurement preferences (some provinces add requirements not in national rules), and kabupaten-level procurement committee practices. For non-Java BUJK especially: the national regulation is necessary but not sufficient — regional variations matter.", why_not_filled: "34 provinces × N kabupaten = hundreds of potential regional variations. Sari cannot cover all of them. Strategy: coverage proportional to klien geographic distribution. High-klien-density regions (Java: 71% of klien) have reasonably good coverage. Low-density regions: sparse. Post-Series A regional researchers will contribute regional variation documentation as a core output.", tc: "text-orange-700" },
            { gap: "GAP-5: Green construction and sustainability compliance — coverage ~15%", why_it_matters: "Indonesia's Green Building Council standards, GBCI certification requirements, ESG reporting requirements for construction projects with international funding: emerging compliance area. As IKN's sustainability mandate and growing ESG investor interest in Indonesia construction push green compliance requirements into procurement: BUJK that don't understand these requirements will be disqualified from increasingly important tenders.", why_not_filled: "Green construction regulations are newly emerging — many standards are still being finalized. Sari's current capacity: focused on established regulatory coverage. Green compliance: flagged as Year 2 post-Series A priority (when Sari has bandwidth after IKN regulatory coverage is complete).", tc: "text-primary" },
          ].map((r) => (
            <div key={r.gap} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.gap}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Why it matters: {r.why_it_matters}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Why not filled: {r.why_not_filled}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Coverage gap analysis adalah Sari's annual honest assessment of what Knowledge Registry doesn't cover — complementing the standard metrics of what it does cover. The 5 gaps above represent approximately 56% of the remaining distance from MJP's current 44% coverage to the 80% target. The gaps are documented not as failures but as a roadmap: each gap has a 'why not filled yet' that traces to a specific resource constraint (Sari's capacity, data infrastructure, regulatory instability). Addressing the gaps: GAP-1 (IKN) requires sustained 2 assets/week over 12 months. GAP-2 (Pengadaan Langsung) requires new data infrastructure. GAP-3 (subcontracting) requires focused research time from Sari. GAP-4 (regional variations) requires regional researcher program. GAP-5 (green compliance) requires new domain expertise. The roadmap: Series A → hire Sari's first Knowledge Research Analyst (Sari stays as Knowledge Director, new hire handles research and first drafts). With additional research capacity: estimated coverage progression from 44% to 61% by Q4 2027 and 78% by Q4 2028. Sari's 80% target: achievable by 2028–2029 depending on Series A timing. Sari: 'Gap coverage adalah bagian dari kejujuran saya kepada klien. Saya tidak mengklaim bahwa Knowledge Registry sudah lengkap. Saya mengklaim bahwa setiap aset yang ada: akurat dan terkini. Dan setiap gap yang ada: dalam roadmap saya untuk diisi.'</p>
      </div>

      {/* R110: How a Knowledge Registry Asset Is Born */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> ASSET CREATION PROCESS — Bagaimana Sebuah Knowledge Registry Asset Lahir: 6 Tahap dari Identifikasi Kebutuhan hingga Publikasi, dan Mengapa Proses yang Ketat Ini Memakan Waktu 3–14 Hari per Aset
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { stage: "Stage 1: Need identification — dari mana ide aset baru datang", sources: "(A) Sari's morning briefing triage: new regulatory signal that doesn't have a supporting Knowledge Registry asset → asset creation triggered. (B) NLQ queries: Hendra Jr.'s system flags questions where NLQ returns low-confidence answers because no relevant asset exists → queued for Sari. (C) Klien support: klien asks a regulatory question that can't be answered from existing assets → knowledge gap documented. (D) Budi's field research: narasumber mentions regulatory or market area they can't find clear guidance on. (E) Sari's own monitoring: working group discussions reveal regulatory areas not yet covered.", output: "Asset creation queue item: topic description, urgency classification (CRITICAL/IMPORTANT/MONITORING based on how many klien are likely affected), source that triggered the need.", tc: "text-primary" },
            { stage: "Stage 2: Source identification — menemukan semua sumber regulasi yang relevan", sources: "For each asset: Sari identifies all authoritative sources. For regulatory assets: the specific law/regulation/circular, LKPP interpretive circulars if available, working group guidance notes (where applicable), BNSP/BKPM technical guidance for SKK/BUJK assets. For market intelligence assets: LPSE aggregate data, industry association publications, Budi's field research findings. Source rule: every factual claim in a Knowledge Registry asset must trace to a verifiable authoritative source.", output: "Source list with access links. If a source is behind a paywall or access-restricted: documented as 'Sari has verified access' or 'access pending.' Assets where source verification cannot be completed: not published until source access is confirmed.", tc: "text-blue-700" },
            { stage: "Stage 3: Research and drafting — Sari writes the asset (3–10 hari per aset)", sources: "Sari reads all identified sources. For complex regulatory assets: may require 2–3 full readings plus reference to secondary interpretive materials. Draft: written in Indonesian, structured as (1) What this covers — scope, (2) Who it affects — which BUJK types, KBLI categories, project types, (3) Key requirements — the specific obligations, thresholds, or procedures, (4) Common misunderstandings — the top 2–3 points where BUJK make incorrect assumptions, (5) Source references — full citation. Average drafting time: 3–5 hours for a straightforward regulatory summary; 8–14 hours for a complex area with multiple interacting regulations.", output: "Draft asset document (internal review format, not yet published). Sari's self-check: 'Would a competent BUJK manager without legal training understand this document and know what action to take?'", tc: "text-emerald-700" },
            { stage: "Stage 4: Cross-reference review — konsistensi dengan aset yang sudah ada", sources: "Sari reviews all related existing assets for consistency. If new asset contradicts an existing asset (this happens when regulations are superseded): both assets must be updated simultaneously. If new asset refers to concepts covered in existing assets: internal links added. Cross-reference also checks: are there any existing NLQ question patterns that this new asset should improve? Hendra Jr. provides weekly NLQ query logs to Sari — she uses these to target new assets toward frequently asked questions without good existing answers.", output: "List of related assets requiring update or linking. If any related asset update is needed: that asset goes through its own update process (abbreviated — 1–3 days instead of full 6-stage process).", tc: "text-orange-700" },
            { stage: "Stage 5: Quality review — Hendra's sign-off for high-stakes assets", sources: "For assets classified CRITICAL (affect qualification determination, significant financial implications, regulatory compliance risk): Hendra reviews before publication. Hendra's review focus: business context (does this asset address the business question a BUJK manager would actually have?), accessibility (is this written for a BUJK owner, not a lawyer?), completeness (are there scenarios where this asset would fail to guide a klien?). For IMPORTANT and MONITORING assets: Sari self-publishes (no separate sign-off required).", output: "For CRITICAL assets: Hendra approval (documented in asset metadata) or Hendra feedback → Sari revision → resubmission. Typical revision cycle: 1–2 rounds for CRITICAL assets. Hendra's most common feedback: 'Too much legal language — rewrite this section for a BUJK owner in Semarang.'", tc: "text-primary" },
            { stage: "Stage 6: Publication + NLQ indexing — aset masuk ke Knowledge Registry dan NLQ search", sources: "Published asset: tagged with KBLI categories (which construction categories are affected), province relevance (national vs region-specific), regulation references (full citations), decay category (Evergreen/Annual/Event-Driven/Ephemeral), next review date (based on decay category), confidence level (High/Medium/Verified vs Interpretive). NLQ indexing: Hendra Jr.'s system automatically indexes new assets within 2 hours of publication. NLQ testing: Sari tests 3–5 representative queries against the new asset to verify retrieval quality.", output: "Live Knowledge Registry asset. Monthly report to Hendra: new assets published, update queue status, gap coverage progress vs 80% target.", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.stage} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.stage}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Sources + process: {r.sources}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Output: {r.output}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Asset creation process adalah the discipline that separates Knowledge Registry from a regulatory summary service. The 6-stage process takes 3–14 days per asset — longer than most content production processes. The time is justified by the use context: BUJK managers using Knowledge Registry assets to make real procurement decisions. An inaccurate or incomplete asset: can lead to a disqualified bid, a missed compliance deadline, or a failed regulatory inspection. The process stages correspond to the risk categories: Stage 3 (research quality) addresses accuracy risk. Stage 4 (cross-reference) addresses consistency risk. Stage 5 (Hendra review for CRITICAL assets) addresses business-context risk. Stage 6 (NLQ testing) addresses retrieval risk. The bottleneck in the current process: Stage 3 (drafting). Sari can produce approximately 4–5 assets per week at full capacity. The post-Series A Knowledge Research Analyst: will handle Stages 1–2 (identification and source list), allowing Sari to focus on Stages 3–6 (the judgment-intensive work). This handoff: expected to increase asset production from 4–5/week to 7–9/week — a 60–80% throughput improvement. The quality bar does not change with the handoff: the analyst produces research, Sari produces the final asset. Sari: 'Setiap aset yang saya terbitkan memiliki nama saya padanya — tidak secara harfiah, tapi dalam arti bahwa klien yang mengandalkan aset itu percaya bahwa Sari di MJP memverifikasi kebenarannya. Itu adalah tanggung jawab yang saya ambil serius setiap kali saya menekan tombol publish.'</p>
      </div>

      {/* R111: Asset Interdependency Cascade */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> ASSET INTERDEPENDENCY CASCADE — Bagaimana 1 Perubahan Regulasi Memicu 89 Review Aset: Sistem Pemetaan Ketergantungan Sari untuk Mengelola Kompleksitas Knowledge Registry di 1.247 Aset
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { cascade_type: "CASCADE-1: Regulasi Induk berubah — semua turunannya harus dievaluasi", example: "Perpres 16/2018 (induk pengadaan pemerintah) memiliki 134 aset yang merujuk langsung ke pasal-pasalnya. Ketika Perpres 12/2021 mengubah 47 pasal: 134 aset harus dievaluasi. Dari 134: 89 memerlukan update, 45 tidak terpengaruh (merujuk ke pasal yang tidak berubah). Sari's interdependency map: setiap aset mencatat 'regulatory source citations' — pasal-pasal spesifik yang dijadikan dasar konten aset. Ketika sebuah pasal berubah: sistem mengirimkan notifikasi ke semua aset yang mencatat pasal tersebut.", duration_and_cost: "89-aset cascade dari Perpres 12/2021: membutuhkan 11 hari kerja Sari (vs estimasi awal 5 hari — Sari underestimated karena baru pertama kali menangani cascade sebesar ini). Current capacity setelah system improvement: cascade setingkat ini diselesaikan dalam 7–8 hari karena interdependency map sudah tersedia di awal, bukan dibangun selama proses.", tc: "text-primary" },
            { cascade_type: "CASCADE-2: Regulasi Implementasi baru — membuat konten lama ambigu", example: "Peraturan LKPP No. 3/2021 (Petunjuk Teknis Kualifikasi Pengadaan Barang/Jasa) memperjelas implementasi dari regulasi yang sudah ada tapi menyebabkan 23 aset Knowledge Registry yang sebelumnya 'akurat' menjadi 'ambigu' — karena konten lama tidak mempertimbangkan interpretasi teknis yang kini resmi. Cascade tipe ini lebih sulit dideteksi: tidak ada perubahan teks regulasi yang bisa di-match, hanya perubahan interpretasi resmi yang perlu diincorporate.", duration_and_cost: "Cascade regulasi implementasi: rata-rata 3–5 hari karena scope lebih kecil (23 aset vs 89) tapi tiap aset membutuhkan judgment lebih banyak — 'seberapa jauh perbedaan interpretasi lama vs baru, dan apakah cukup signifikan untuk update?' Sari's threshold: jika interpretasi baru mengubah rekomendasi konkret yang diberikan aset kepada BUJK — update wajib. Jika hanya nuance teknis yang tidak berdampak pada rekomendasi praktis: catatan aset internal, bukan update publik.", tc: "text-blue-700" },
            { cascade_type: "CASCADE-3: Data kualifikasi berubah — Trust Score dan tender eligibility assets terpengaruh", example: "Perubahan pada persyaratan minimum kualifikasi jenjang SKK (dilakukan setiap 2–3 tahun oleh BNSP) memicu cascade yang tidak melibatkan teks regulasi sama sekali — melibatkan data BNSP. Setiap kali BNSP merevisi persyaratan minimum kompetensi: 31 aset yang berisi tabel 'kualifikasi minimum per jenjang' harus diperbarui. Ini bukan cascade regulasi — ini cascade data mastery.", duration_and_cost: "SKK data cascade: paling cepat diselesaikan (1–2 hari) karena perubahan BNSP bersifat structured dan terdokumentasi — Sari hanya perlu update tabel kualifikasi di 31 aset dengan data baru. Tidak ada judgment tentang interpretasi — hanya copy update dari BNSP official document ke Knowledge Registry assets.", tc: "text-emerald-700" },
            { cascade_type: "CASCADE-4: Market price data usang — HPS dan pricing reference assets memerlukan refresh", example: "Market intelligence pricing assets (42 aset yang berisi referensi harga untuk materials dan services konstruksi) tidak memiliki 'regulatory trigger' — mereka menjadi stale melalui waktu. Sari's cadence: review semua 42 pricing assets setiap 6 bulan (Q1 dan Q3). Cascade tipe ini bukan reactive tapi scheduled — Sari tahu kapan mereka akan stale sebelum stale terjadi.", duration_and_cost: "Scheduled pricing cascade: 5–7 hari karena 42 aset dengan data update dari multiple sources (PUPR price indices, regional market surveys dari Budi's narasumber network, tender award data aggregation dari Hendra Jr.'s LPSE data). The 42 assets: most important for HPS estimation reliability — stale pricing data is the primary driver of HPS model accuracy degradation.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.cascade_type} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.cascade_type}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Example: {r.example}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Duration and cost: {r.duration_and_cost}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Asset interdependency cascade adalah the operational challenge that makes managing 1.247 assets qualitatively different from managing 100 assets. At 100 assets: Sari could maintain a mental model of all interdependencies. At 1.247 assets: no human can maintain a complete mental model — systematic mapping is required. The interdependency map (stored as a structured metadata layer on each Knowledge Registry asset) took 4 months to build (Q3–Q4 2024) and is the single most important infrastructure investment MJP's Knowledge Registry has made. Before the map: regulatory cascade management relied on Sari's memory of which assets referenced which regulations. Failure mode: assets that shared a common regulatory basis were updated inconsistently — some updated within days, others missed entirely because they weren't top-of-mind. After the map: cascade identification is a 15-minute system query ('which assets cite Perpres X pasal Y?') rather than a memory exercise. The 89-asset Perpres 12/2021 cascade: would have taken 15 days (vs 11) and missed 12 assets (vs 0) without the map. The map's maintenance cost: Sari adds interdependency citations to each new asset at creation time — estimated 10 additional minutes per asset at creation, saving hours during future cascades. Sari: 'Peta ketergantungan adalah cara saya memastikan bahwa ketika satu hal berubah, saya tahu persis apa yang harus saya periksa berikutnya. Tanpanya: saya hanya bisa berharap bahwa ingatan saya cukup baik. Dan ingatan manusia tidak cukup baik untuk 1.247 aset.'</p>
      </div>

      {/* R112: Knowledge Registry Beyond Subscriptions */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE REGISTRY BEYOND SUBSCRIPTIONS — 3 Skenario Lisensi B2B yang Sedang Dieksplorasi MJP: Konsultan Pengadaan, Perbankan Konstruksi, dan Asosiasi BUJK sebagai Distribution Partners untuk Knowledge Registry
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { scenario: "SCENARIO-1: Konsultan Pengadaan sebagai Knowledge Registry Resellers", opportunity: "Indonesia has approximately 2.400 registered procurement consultants (konsultan pengadaan) who advise BUJK on tender strategy. These consultants: (1) need regulatory intelligence for their advisory work, (2) currently use the same manual research process that MJP replaces, (3) have direct access to BUJK who are MJP's target market. If each konsultan has an average of 8–12 BUJK clients: the 2.400 konsultan collectively represent 19.000–29.000 BUJK relationships. A Knowledge Registry reseller program for konsultan: could give MJP indirect access to BUJK that MJP cannot currently reach through direct sales.", deal_structure: "Proposed deal structure (not yet offered): Konsultan pays Rp 500rb/month for unlimited Knowledge Registry API access (vs Rp 3.5jt for Enterprise direct). In return: konsultan co-markets MJP to their BUJK clients (co-branded materials, direct introductions). MJP's economics: lower per-unit revenue but zero sales cost and access to BUJK in provinces Reza cannot cover. Hendra's concern: 'Channel conflict — if konsultan start offering Knowledge Registry access as part of their service, do we under-cut our own direct sales to their BUJK?' Currently in evaluation, no decision made.", tc: "text-primary" },
            { scenario: "SCENARIO-2: Perbankan Konstruksi — Knowledge Registry as credit risk intelligence", opportunity: "Banks that lend to BUJK (Bank Mandiri, BRI, BNI all have construction SME lending programs) need to assess BUJK creditworthiness and project completion risk. Current bank assessment: relies on BUJK-provided financial statements + SLIK (credit history). Gap: bank loan officers have no independent view of BUJK's tender track record, SKK compliance, or qualification standing — all of which affect repayment ability (a BUJK that loses its qualification cannot win contracts, which impairs cash flow for loan repayment). MJP's Trust Score and LPSE track record data: exactly the project performance intelligence banks lack.", deal_structure: "Proposed deal structure (in early conversation with 1 regional bank): data API license. Bank pays Rp 15jt/month for API access to Trust Score + LPSE track record for any BUJK they're evaluating. MJP's data is not a credit score (MJP cannot underwrite credit risk) — it's project performance intelligence that complements the bank's own credit assessment. Hendra's enthusiasm: 'Bank memiliki volume yang konsisten — setiap pinjaman baru yang mereka evaluasi adalah query API. Kalau mereka melakukan 200 BUJK evaluations per bulan: Rp 15jt adalah sangat murah per evaluasi.' Currently: active conversation with 1 regional bank, no signed agreement.", tc: "text-blue-700" },
            { scenario: "SCENARIO-3: Asosiasi BUJK — Knowledge Registry sebagai member benefit", opportunity: "GAPENSI, GAPEKSINDO, AKAINDO, and approximately 14 other BUJK associations collectively have approximately 28.000 BUJK members. These associations: provide industry representation, training programs, and member services. Problem: most association member benefits are generic industry content — very few provide procurement-specific intelligence. A Knowledge Registry access deal with an association: gives all association members access to Knowledge Registry as a member benefit, with MJP receiving a flat licensing fee from the association.", deal_structure: "Proposed deal structure: Rp 2jt/month per 100 members (versus Rp 1.8jt/subscriber in Pro direct). For an association with 500 members: Rp 10jt/month. For the association: cost per member is Rp 20rb/month vs Rp 1.8jt for individual subscription — a compelling member benefit at minimal cost. MJP's economics: below-direct-rate per user but zero sales cost, access to BUJK who would never individually subscribe, and brand association with the industry's professional bodies. Hendra's target: 1 association pilot by Q3 2027. Status: Sari has working group relationships with 2 associations — she will facilitate the introduction. Hendra: 'Satu asosiasi dengan 500 member: itu adalah 500 BUJK yang sekarang mengenal Knowledge Registry. Bahkan kalau 10% saja kemudian subscribe secara individual: itu 50 subscriber baru dari satu deal.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.scenario} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.scenario}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Opportunity: {r.opportunity}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Deal structure: {r.deal_structure}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Knowledge Registry beyond subscriptions adalah Hendra's clearest product-market fit expansion thesis — because it shows that Knowledge Registry's value is not constrained to BUJK direct subscribers. The same regulatory intelligence that helps a Pro-tier BUJK owner verify their qualification compliance has value for: a procurement consultant advising that same BUJK, a bank evaluating a loan to that same BUJK, and an association serving that BUJK as a member. This multi-sided value: not an accident — it's a consequence of Knowledge Registry being built on public regulatory information rather than proprietary data. Public information can be licensed to multiple categories of users without exclusivity concerns. The 3 scenarios are at different maturity levels: SCENARIO-3 (association) is most structurally clean (no channel conflict, straightforward deal), SCENARIO-2 (bank) has the highest revenue per deal but most complex integration (API development needed), SCENARIO-1 (consultant) has the widest reach but channel conflict concerns. Hendra's approach: pursue SCENARIO-3 first (lowest friction, relationship-based via Sari), run SCENARIO-2 pilot with 1 regional bank, evaluate SCENARIO-1 after the channel conflict question is answered. Total revenue potential if all 3 scenarios mature: Rp 150–200jt/month in B2B licensing revenue — a new revenue stream approximately equal to current ARR from direct BUJK subscriptions. This is not a 2026 story — it's Hendra's 2028 story. Sari: 'Knowledge Registry yang saya bangun bukan hanya untuk 847 klien yang subscribe langsung. Ini untuk seluruh ekosistem pengadaan konstruksi Indonesia. Semakin banyak cara orang menggunakannya: semakin banyak alasan bagi saya untuk terus menjaganya akurat dan terkini.'</p>
      </div>

      {/* R113: Subscriber Communication Architecture */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> SUBSCRIBER COMMUNICATION ARCHITECTURE — Bagaimana Sari Memberitahu 847 BUJK tentang Update Knowledge Registry: 4 Kanal Komunikasi, Prioritas Notifikasi, dan Prinsip 'Tidak Mengejutkan Klien yang Sudah Mengandalkan Aset Kami'
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { channel: "KANAL-1: Alert sistem otomatis — untuk setiap update yang mempengaruhi aset yang di-bookmark BUJK", trigger: "Every BUJK subscriber can 'bookmark' Knowledge Registry assets relevant to their KBLI and qualification category. When Sari updates a bookmarked asset: the system automatically sends an in-platform alert + email digest. Alert content: asset title, what changed (a structured 1-sentence change summary Sari writes at time of update), and the asset's new version number. Alert timing: same-day for CRITICAL asset updates (regulatory changes with immediate compliance impact). Within 3 days for HIGH and MEDIUM updates. STANDARD updates: included in weekly digest only.", subscriber_behavior: "83% of bookmarked-asset alerts are opened (vs 62% open rate for generic briefing emails). The reason: alerts about assets a BUJK has explicitly bookmarked have direct personal relevance — the BUJK knows they rely on this specific asset. Sari's alert writing principle: 'Jangan jelaskan semua yang berubah dalam alert — jelaskan apa yang berubah yang berdampak pada apa yang BUJK lakukan dengan aset ini.'", tc: "text-primary" },
            { channel: "KANAL-2: Weekly Knowledge Registry digest — kompilasi semua update 7 hari terakhir", trigger: "Every Monday: a structured weekly digest is sent to all subscribers, summarizing all Knowledge Registry updates from the past week. Format: categorized by CRITICAL/HIGH/MEDIUM/STANDARD, with a 1-sentence description of each change. Average length: 400–600 words (12–18 updates per week on average). The digest serves 2 functions: (1) notifies subscribers who didn't receive asset-specific alerts (because they haven't bookmarked that asset), (2) provides a 'week in review' context for subscribers who want to know what changed broadly in the regulatory landscape.", subscriber_behavior: "Open rate: 54% (lower than bookmarked-asset alerts but high for a weekly summary). Most-read section: CRITICAL updates (91% open rate among those who open the digest). Least-read: STANDARD updates (34% click-through to view full asset). The digest's most important function: catches BUJK who should be paying attention to a change but haven't bookmarked the relevant asset yet. Reza's conversion observation: 3 BUJK who discovered a CRITICAL update in the digest they weren't aware of (because they hadn't bookmarked the relevant asset) immediately upgraded to Enterprise tier for full asset access.", tc: "text-blue-700" },
            { channel: "KANAL-3: Cascade notification — khusus untuk perubahan regulasi yang berdampak luas", trigger: "For regulatory cascade events (where 1 regulatory change triggers updates to 10+ assets simultaneously): Sari sends a dedicated 'Regulatory Cascade Alert' — a separate email/notification distinct from normal weekly digests. These are rare: approximately 3–4 per year. The cascade alert format: a mini-briefing explaining the regulatory change, its implications for BUJK, and a list of all updated assets with links. Cascade alerts: sent to ALL subscribers regardless of whether they've bookmarked the affected assets. Rationale: a cascade event affecting 10+ assets is significant enough to warrant universal notification.", subscriber_behavior: "Cascade alerts: 91% open rate (highest of all Knowledge Registry communication types). The urgency framing + universal send: produces near-total subscriber awareness. Most important cascade alert in MJP's history: the Perpres 12/2021 cascade (89 assets updated). That cascade alert was sent before all 89 assets were updated — Sari sent it immediately to inform subscribers about what was changing, with a commitment that all updates would be complete within 14 days. Subscribers praised the advance warning: 'Saya tahu apa yang harus saya persiapkan sebelum semua asetnya selesai diperbarui. Itu memberi saya waktu untuk memulai prosesnya lebih awal.'", tc: "text-emerald-700" },
            { channel: "KANAL-4: Proactive deprecation notices — ketika sebuah aset tidak lagi relevan dan harus dihapus", trigger: "When a Knowledge Registry asset becomes fully obsolete (the regulation it covers has been repealed, or the qualification category it covers has been eliminated): the asset is marked DEPRECATED. Deprecation protocol: (1) 30-day advance notice to all subscribers who have bookmarked the asset ('this asset will be archived on [date] — here is what replaces it and why'). (2) The replacement asset or alternative reference is linked in the deprecation notice. (3) The deprecated asset remains accessible for 90 days after the official deprecation date in an 'archived' status, for subscribers who need the historical reference.", subscriber_behavior: "Deprecation notices: often surprising to subscribers who assumed that if an asset existed, it was still current. The explicit deprecation process: a significant trust-builder because it demonstrates that MJP actively maintains quality rather than leaving outdated assets in place. Most common subscriber reaction to receiving a deprecation notice: gratitude ('terima kasih sudah memberitahu saya sebelum saya mengandalkan aset ini untuk sesuatu yang salah'). Sari has deprecated 23 assets in MJP's history. All 23: followed this protocol. Zero complaints about deprecated assets for any subscriber who received the advance notice.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.channel} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.channel}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Trigger: {r.trigger}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Subscriber behavior: {r.subscriber_behavior}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Subscriber communication architecture adalah Sari's answer to the most dangerous risk in a knowledge product: subscribers who don't know what has changed and continue relying on outdated information. The 4 channels form a layered system: KANAL-1 (bookmarked asset alerts) ensures personally-relevant updates reach the right subscriber immediately. KANAL-2 (weekly digest) provides broad awareness coverage for subscribers who haven't fully personalized their bookmarks. KANAL-3 (cascade alerts) ensures no subscriber misses a significant regulatory event. KANAL-4 (deprecation notices) closes the loop by ensuring subscribers are never left relying on obsolete information. The system's design principle: 'no subscriber should be surprised by a change that affects their use of MJP's Knowledge Registry.' Surprises — discovering an asset changed after acting on the old version — are the most damaging trust events in a knowledge product. Every element of the communication architecture exists to prevent that specific harm. The architecture's complexity: has grown incrementally over 5 years. KANAL-1 (automated alerts) was built in Year 1. KANAL-4 (deprecation protocol) was formalized in Year 3 after the first asset was deprecated without advance notice (a subscriber relied on it for a document preparation — the embarrassment prompted Sari to create the formal protocol). Each channel's design: informed by a specific subscriber experience that revealed a gap in the prior system. Sari: 'Arsitektur komunikasi ini bukan yang saya rancang di hari pertama — ini yang saya bangun dari setiap kali saya melihat bahwa informasi yang saya perbarui tidak sampai ke klien yang membutuhkannya tepat waktu. Setiap kanal ada karena satu klien suatu saat tidak mendapatkan informasi yang mereka butuhkan.'</p>
      </div>

      {/* R114: Knowledge Asset Lifecycle */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE ASSET LIFECYCLE — Bagaimana Setiap Aset MJP Diciptakan, Diperbarui, Dipensiun, dan Digantikan: 5 Tahap Siklus Hidup, Waktu Rata-Rata di Setiap Tahap, dan Keputusan Paling Sulit Sari sebagai Knowledge Manager
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { stage: "STAGE-1: IDENTIFICATION — sinyal kebutuhan aset baru (durasi rata-rata: 1–3 minggu)", process: "A new Knowledge Registry asset begins as a signal: either a Budi narasumber interview produces a topic that multiple BUJK lack knowledge about (demand signal), Sari observes a regulatory change with no existing asset covering it (supply gap signal), or Hendra Jr.'s NLQ query analysis shows that a significant share of queries ask about a topic with no matching asset (NLQ gap signal). The most productive source: NLQ gap signals — because they reveal real subscriber questions with no asset answer, which is the clearest possible evidence of unmet demand. Sari reviews NLQ gap signals monthly. In Q1 2026: 3 of 7 new assets were created in response to NLQ gap signals.", decision_difficulty: "The identification stage's hardest decision: distinguishing between 'this topic has no asset because it's not important enough' vs 'this topic has no asset because we haven't built it yet.' Sari's test: if 3+ narasumber have mentioned the topic AND it appears in NLQ queries AND Sari cannot find an existing external source that subscribers could use instead: it qualifies for asset creation. Topics that fail this test: added to Sari's 'parking lot' (a list of candidate topics that don't yet meet the 3-signal threshold).", tc: "text-primary" },
            { stage: "STAGE-2: CREATION — building the asset from zero (durasi rata-rata: 3–10 hari per aset)", process: "Asset creation workflow: (1) Sari drafts the initial asset structure (sections, scope, key questions the asset will answer). (2) If the topic requires regulatory expertise: Sari consults with her LKPP working group contacts for informal peer review. If it requires industry practice knowledge: Budi consults with 1–2 relevant narasumber. (3) Sari writes the full asset content. (4) Internal review: Hendra reviews assets in 3 categories (regulatory interpretation, investment-grade claims, new BUJK compliance requirements) before publication. Other assets: Sari publishes without mandatory Hendra review. (5) Publication to Knowledge Registry with metadata (created date, next review date, related assets).", decision_difficulty: "The creation stage's hardest decision: how specific vs how general to write an asset. A highly specific asset (e.g., 'IUJK requirements for BUJK Grade-4 in Kalimantan Timur') is immediately actionable for a narrow audience but quickly outdated as regulations change. A highly general asset ('IUJK requirements overview for all grades and regions') serves a broader audience but requires more effort to keep current. Sari's calibration: she writes at the 'grade-specific, region-general' level for IUJK assets — specific enough to be actionable for most BUJK, general enough to not require quarterly updates.", tc: "text-blue-700" },
            { stage: "STAGE-3: MAINTENANCE — keeping the asset current (durasi rata-rata: ongoing, review cycle 30–180 hari)", process: "Every asset has a 'next review date' set at creation (30 days for high-change regulatory topics, 90 days for moderate-change topics, 180 days for slow-change topics like BUJK qualification fundamentals). Sari's review protocol: (1) check primary source for changes (LKPP, BNSP, PUPR official publications), (2) if no change detected: update metadata and set next review date (5-minute process). If change detected: update asset content, trigger subscriber notification via KANAL-1 for bookmarked subscribers, and update KANAL-2 digest. Sari's average monthly asset maintenance load: 23 assets reviewed, of which 7–9 require content updates.", decision_difficulty: "The maintenance stage's hardest decision: how to handle partial updates. When a regulation changes in one aspect but not others: should Sari update the entire asset (risk: confusing subscribers who rely on unchanged sections) or update only the changed section (risk: subscribers miss contextual implications of the partial change)? Sari's current practice: add a dated 'UPDATE' box at the top of the asset noting the specific change, while leaving prior content visible and clearly dated. This preserves historical context (BUJK who submitted documents before the change don't need to retroactively change their approach) while clearly flagging new requirements.", tc: "text-emerald-700" },
            { stage: "STAGE-4: DEPRECATION — retiring an asset that is no longer accurate (durasi rata-rata: 2–4 minggu proses formal)", process: "Deprecation is triggered by one of 3 events: (1) a regulatory change makes the asset fully outdated (not partially — a partial change triggers Stage 3 update, not deprecation), (2) the asset is superseded by a more comprehensive asset that covers the same scope, (3) Sari discovers the asset contains fundamental errors that require rebuilding from scratch (rare — has happened twice in 5 years). Deprecation process: (1) Sari schedules the deprecation date 3 weeks out. (2) KANAL-4 deprecation notice sent to all subscribers who have bookmarked the asset. (3) On deprecation date: asset marked 'ARCHIVED — replaced by [new asset link]' rather than deleted (preserves historical search context and the link relationship). (4) Post-deprecation review: Sari reviews NLQ queries that referenced the deprecated asset to ensure the replacement asset satisfies the same queries.", decision_difficulty: "The deprecation stage's hardest decision: when a subscriber is emotionally attached to an asset. Sari has received 3 emails from subscribers protesting an asset deprecation — in each case, the subscriber had built their internal compliance workflow around the specific structure of the deprecated asset. Sari's response protocol: a personal email acknowledging the disruption, a 30-day extension of the parallel period (both old and new assets accessible), and an offer of a 15-minute call to help the subscriber migrate their workflow to the new asset structure. Of the 3 protests: 2 converted to higher-tier subscribers within 6 months.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.stage} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.stage}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Process: {r.process}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Hardest decision: {r.decision_difficulty}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Knowledge asset lifecycle adalah Sari's most important contribution to MJP's operational infrastructure — because it converts a knowledge product (which would otherwise be a static document collection that degrades over time) into a living information system that improves with each maintenance cycle. The lifecycle framework's most important design principle: every stage has an explicit exit trigger (IDENTIFICATION exits when the 3-signal threshold is met, CREATION exits when internal review passes, MAINTENANCE is a continuous loop triggered by review dates, DEPRECATION exits when the replacement asset is published). Without explicit exit triggers: knowledge assets can remain in intermediate states indefinitely — half-created, half-updated, half-deprecated — which is worse than either fully current or clearly deprecated. The lifecycle's operational cost: Sari estimates she spends 35% of her working time on lifecycle management across all 4 stages. For 127 active assets: this works out to approximately 21 minutes per asset per month of lifecycle maintenance. At MJP's subscriber base: 847 BUJK benefit from Sari's asset maintenance, which means each BUJK receives Rp 520/month of Sari's time in lifecycle maintenance (at Sari's fully-loaded cost). The question for Series A: can the lifecycle model scale to 250+ assets without proportional headcount growth? Sari's answer: yes, if two conditions are met — (1) NLQ gap signal analysis is automated (currently Hendra Jr. runs it manually), and (2) a junior Knowledge Analyst joins to handle Stage-3 maintenance for low-change-frequency assets, freeing Sari's time for Stage-1 identification and Stage-4 deprecation decisions (the stages that require judgment rather than process execution). Sari: 'Aset pengetahuan yang tidak dikelola adalah kewajiban, bukan aset. Itulah mengapa siklus hidup lebih penting dari pembuatan. Siapa pun bisa membuat dokumen. Sangat sedikit orang yang memiliki disiplin untuk mengelolanya selama 5 tahun.'</p>
      </div>

      {/* R115: Expert Contributor Program */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> EXPERT CONTRIBUTOR PROGRAM — Bagaimana Sari Mengakses Keahlian Eksternal untuk Topik yang Melampaui Kemampuannya: 3 Kontributor Aktif, Model Keterlibatan, Tata Kelola Kualitas, dan Rencana untuk Memperluas ke 8 Kontributor Post-Series A
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { contributor: "CONTRIBUTOR-1: Ahli Hukum Pengadaan — menutupi gap regulasi teknis", profile: "Sari's first Expert Contributor: a procurement law specialist (practicing attorney with 12 years of LKPP-related litigation and advisory work) who was introduced through Sari's LKPP working group network. The engagement model: Sari sends draft asset content on regulatory interpretation questions beyond her expertise level. The attorney reviews for legal accuracy (not full authorship — Sari writes, the attorney verifies). Compensation: Rp 500rb per asset review (typically 45–60 minutes of attorney time per review). 2025 engagement: 7 asset reviews. Topics: contract termination rights under Perpres 16, LKPP dispute resolution procedures, administrative court jurisdiction for procurement disputes.", quality_governance: "Quality governance for Contributor-1: all attorney-reviewed assets carry a 'Diverifikasi oleh ahli hukum pengadaan — [month/year]' tag in the asset metadata. Sari updates this tag when the asset is reviewed again. The tag: visible to subscribers (they know which assets have legal expert verification). The tag drives preferential access behavior: NLQ query patterns show that assets with expert verification tags are queried 23% more frequently than comparable assets without verification. Trust signal: verified assets reduce BUJK uncertainty about acting on regulatory interpretations.", tc: "text-primary" },
            { contributor: "CONTRIBUTOR-2: Insinyur Sipil Senior — teknis konstruksi dan spesifikasi material", profile: "Sari's second Expert Contributor: a retired senior civil engineer (30+ years with a major national BUJK, retired 2022) introduced through Budi's GAPENSI connection. The engagement model: Sari sends draft assets on technical construction specifications, material standards, and engineering terminology that appears in BUJK qualification documents. The engineer reviews for technical accuracy and identifies terminology gaps where Sari's regulatory-focused writing may miss critical engineering context. Compensation: Rp 400rb per asset review. 2025 engagement: 4 asset reviews. Topics: road construction material specification requirements, concrete mix standard references in PUPR regulations, structural engineering SKK competency unit technical descriptions.", quality_governance: "Quality governance for Contributor-2: assets reviewed by the engineer carry a 'Diverifikasi oleh praktisi teknik sipil' tag. The engineer relationship has an additional benefit: when BUJK ask technical questions through NLQ that are genuinely outside Sari's knowledge (e.g., 'what is the difference between K-350 and K-400 concrete mix in tender specification context?'), Sari can route the question to the engineer for a verified answer that then becomes a new Knowledge Registry asset. 2 assets created this way in 2025 — the most efficiently-sourced new assets in MJP's history.", tc: "text-blue-700" },
            { contributor: "CONTRIBUTOR-3: Konsultan Perpajakan — gap BUJK compliance pajak dalam konteks pengadaan", profile: "Sari's third Expert Contributor: a tax consultant (specializing in government contractor taxation) introduced through Hendra's professional network. The engagement: specifically for assets covering tax compliance requirements that affect BUJK qualification for government tenders (NPWP validity, PPh 21/22 compliance certificates, VAT registration for tender eligibility). These are critical qualification barriers that Sari cannot cover accurately without tax expertise. Compensation: Rp 600rb per asset review (higher rate reflecting the higher liability of tax advice). 2025 engagement: 3 asset reviews.", quality_governance: "Quality governance for Contributor-3: most rigorous of the 3 contributors. Tax assets carry a 'Diverifikasi oleh konsultan pajak bersertifikat' tag AND a 'Bukan saran pajak profesional — konsultasikan kondisi spesifik Anda dengan konsultan pajak' disclaimer (legally required). The disclaimer: reduced BUJK over-reliance on the tax assets for individual tax decision-making, which is appropriate — the assets are designed to identify when BUJK need a tax consultant, not to replace one. Post-Series A Expert Contributor expansion plan: 5 additional contributors (environmental law for AMDAL coverage, HR law for K3 compliance, Surabaya-based procurement law specialist for Eastern Java regional nuances, a BPJK representative for SKK regulatory updates, and a financial advisor for the business finance assets). Total post-Series A Expert Contributor budget: Rp 15jt/year (a small investment relative to the coverage expansion).", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.contributor} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.contributor}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Profile and engagement: {r.profile}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Quality governance: {r.quality_governance}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Expert Contributor Program adalah Sari's answer to the fundamental knowledge limitation of a single Knowledge Manager: one person cannot be deeply expert in all dimensions of a complex regulatory and technical domain. The Expert Contributor model: solves this by bringing domain experts into MJP's knowledge production workflow at specific verification touchpoints — not as full authors (which would be expensive and slow) but as reviewers and accuracy validators (which is efficient and fast). The current 3-contributor model costs approximately Rp 7.5jt/year (at 2025 engagement rates) — less than 0.4% of MJP's ARR, for content that supports 24% of MJP's Knowledge Registry assets that require specialist expertise. The return: expert-verified assets drive 23% higher query frequency (more engagement) and directly support the regulatory compliance use cases that Enterprise subscribers cite most in renewal conversations. The post-Series A expansion to 8 contributors: increases Expert Contributor cost to approximately Rp 15jt/year (0.7% of ARR at Rp 2.1B) while expanding the covered knowledge domains from 3 to 8. This expansion: primarily unlocks the environmental law and AMDAL coverage gap (identified as BS-4 in Sari's Knowledge Registry gap analysis) and the regional nuance gap (Surabaya specialist covers Eastern Java procurement practices that differ from the national standard). Sari's guiding principle for Expert Contributors: 'Saya tidak mencari orang yang bisa menulis untuk saya — saya mencari orang yang bisa mengatakan dengan tepat di mana tulisan saya tidak akurat. Perbedaan itu penting: saya tetap Knowledge Manager, mereka adalah quality gates yang memastikan saya tidak melewati batas kompetensi saya tanpa menyadarinya.'</p>
      </div>

      {/* R116: Knowledge Asset Licensing Potential */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE ASSET LICENSING POTENTIAL — Peluang Lisensi Knowledge Registry di Luar MJP: 4 Kandidat Lisensi, Model Harga, dan Mengapa Hendra Belum Mengejar Ini Meskipun Peluangnya Jelas
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { candidate: "LICENSE-CANDIDATE-1: Bank dan lembaga keuangan yang membiayai proyek konstruksi BUJK", rationale: "Indonesian banks that provide construction project financing (BNI, Mandiri, BRI, and regional development banks) face a common challenge: assessing the credit risk of BUJK borrowers requires understanding the BUJK's track record (historical project wins and losses), their qualification standing (current SKK and IUJK status), and the regulatory environment for their project pipeline. Banks currently do this assessment manually — credit analysts independently research the same information that MJP's Trust Score and Knowledge Registry systematize. A bank license to MJP's Trust Score API: would allow banks to query MJP's BUJK database during credit assessment, improving accuracy and reducing analysis time. The market: 47 banks and leasing companies in Indonesia that regularly finance construction project working capital.", licensing_model: "Proposed licensing model for banks: API access to Trust Score data (read-only) at Rp 5.000 per query (credit assessment use case) + Rp 15jt/year base access fee. At 10 banks making 200 queries per month: Rp 100.000 per bank per month in query fees + Rp 15jt/year base = approximately Rp 16.2jt/bank/year. 10 bank clients: Rp 162jt/year. The unit economics: comparable to Enterprise subscription revenue but with a B2B2B distribution channel (banks bring MJP data to their credit processes, expanding MJP's data reach to every BUJK their bank clients serve). Hendra's valuation: high potential, not yet pursued because Trust Score accuracy at scale (2.000+ BUJK in database) needs to be validated before MJP can credibly serve as a credit reference source. Post-Series A database expansion: the prerequisite.", tc: "text-primary" },
            { candidate: "LICENSE-CANDIDATE-2: Asosiasi BUJK (GAPENSI, GAPEKSINDO, ABKMI) untuk keanggotaan benefits", rationale: "BUJK associations (GAPENSI, GAPEKSINDO, ABKMI, Askonindo) provide membership benefits to their member companies. Currently: association membership benefits are primarily social (peer networking, training events, advocacy representation). Associations in adjacent industries have found that adding intelligence platform access as a membership benefit significantly increases membership value and retention. MJP's Knowledge Registry: could be licensed to BUJK associations as a 'research intelligence benefit' for members — all members of the association get read-only access to the Knowledge Registry (not full MJP subscription, which includes Trust Score, alerts, and NLQ).", licensing_model: "Proposed licensing model for associations: flat annual license fee based on member count. GAPENSI national (12.000+ members at full membership): Rp 240jt/year (Rp 20.000/member/year). Regional DPD: Rp 15–25jt/year depending on member count. The model advantage: association licensing reaches members who are not MJP subscribers (the 92.9% of SAM not yet subscribed). The model risk: association licensing cannibalizes individual subscriptions if members get enough intelligence from the association benefit to not need a full MJP subscription. Hendra's mitigation: the association license covers Knowledge Registry access only (read-only, no NLQ, no Trust Score, no personalized alerts). Full intelligence platform features: require individual subscription. The association benefit: a 'gateway' that demonstrates value, not a substitute for the full product.", tc: "text-blue-700" },
            { candidate: "LICENSE-CANDIDATE-3: LKPP dan kementerian teknis untuk training dan capacity building program", rationale: "LKPP (the national procurement policy agency) regularly trains government procurement officers (PPK — Pejabat Pembuat Komitmen) who are responsible for evaluating BUJK qualification submissions. These government officials need to understand the same regulatory landscape that BUJK navigate from the other side. MJP's Knowledge Registry — particularly the qualification threshold analysis, SKK/IUJK requirement guides, and procurement procedure explanations — is directly relevant to PPK training. LKPP currently uses internally produced training materials that Sari considers 'significantly lower quality and comprehensiveness' than MJP's Knowledge Registry content. A licensing arrangement with LKPP: would provide MJP content as an officially recommended reference for PPK training programs.", licensing_model: "Proposed licensing model for LKPP: institutional license at Rp 50jt/year for use of MJP's Knowledge Registry content in official LKPP training programs (read-only access for training facilitators + PDF exports for training materials). The non-monetary benefit: LKPP endorsement is the most powerful institutional validation MJP could receive — it converts MJP from 'private BUJK intelligence platform' to 'government-endorsed procurement reference.' An LKPP endorsement would accelerate Enterprise subscriber growth (BUJK who know their clients' procurement officers are trained using MJP content immediately understand the platform's authoritative standing). Hendra's assessment: LKPP licensing is Sari's highest-priority external relationship to cultivate post-Series A — not primarily for the Rp 50jt revenue but for the institutional endorsement signal.", tc: "text-emerald-700" },
            { candidate: "LICENSE-CANDIDATE-4: Perguruan tinggi dan lembaga riset yang meneliti pasar konstruksi Indonesia", rationale: "Indonesian universities (ITS, ITB, UI, UNDIP) and research institutes with construction management, civil engineering, and public procurement research programs need real-world data on Indonesian government procurement and BUJK performance. MJP's LPSE award database (5+ years of data across 671 portals) and narasumber-based pain point research: represent the most comprehensive primary research dataset on Indonesian BUJK procurement behavior in existence. Academic licensing: would allow researchers to access anonymized versions of MJP's datasets for academic studies, with citation agreements that attribute MJP as the data source.", licensing_model: "Proposed licensing model for academia: nominal fee (Rp 5–10jt/year per institution) in exchange for co-publication opportunities. The commercial value of academic licensing is not the fee revenue (which is modest) but the research output: academic papers citing MJP's dataset as the source build MJP's institutional credibility in ways that no amount of marketing spend can replicate. Budi's 2027 Research Agenda (from the R115 panel) is the natural bridge to academic collaboration: MJP's narasumber research into win rate persistence, no-bid decision behavior, and next-generation BUJK needs are publishable research questions that ITB or ITS procurement researchers would be interested in co-authoring. Hendra: 'Makalah akademis dengan MJP sebagai sumber data adalah iklan gratis kepada 1.000 pembuat keputusan yang tidak bisa kita jangkau dengan cara lain: investor, pembuat kebijakan, dan eksekutif konstruksi yang membaca literatur penelitian.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.candidate} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.candidate}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Rationale: {r.rationale}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Licensing model: {r.licensing_model}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Knowledge asset licensing potential adalah Hendra's most deliberately deferred revenue opportunity — the commercial potential is legible, but the operational prerequisites are not yet met. The 4 licensing candidates (banks, associations, LKPP, academia) represent approximately Rp 600–700jt/year in potential licensing revenue at conservative estimates — more than 25% of MJP's current ARR from an entirely new revenue channel with near-zero additional production cost (the Knowledge Registry content already exists). The reason Hendra has not pursued these channels: operational sequence discipline. At 6 people and Rp 2.1B ARR: adding 4 new licensing relationships means 4 new contract negotiations, 4 new relationship management workloads, 4 new compliance requirements (data use agreements, citation rights, access controls), and 4 new customer success contexts. The marginal operational load: exceeds MJP's current capacity without degrading core subscriber service quality. The sequencing principle: grow licensing revenue only after Series A hiring has added the operational capacity (specifically a Business Development role that doesn't exist yet) to manage it without cannibalizing the team's focus on core subscriber quality. The LKPP licensing track: the one exception Hendra may pursue pre-Series A, because the institutional endorsement value justifies the management cost even at current team size. The bank and association tracks: Q1 2027 opportunities (after Business Development hire and Trust Score database expansion). The academic track: Budi's relationship-led pursuit, timed to coincide with the 2027 Research Agenda publishing cycle. Sari's role in licensing: critical and currently invisible. The licensing candidates' willingness to pay depends entirely on the Knowledge Registry's quality reputation — which Sari's editorial standards have been building, without commercial intent, for 4 years. The licensing revenue opportunity: the downstream commercial reward for 4 years of non-commercial quality investment.</p>
      </div>

      {/* R117: Sari's 90-Day Editorial Calendar */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-primary" /> SARI'S 90-DAY EDITORIAL CALENDAR — Bagaimana Sari Merencanakan Produksi Konten 90 Hari ke Depan: 4 Tipe Konten, Alokasi Kapasitas, Kejutan yang Mengganggu Rencana, dan Mengapa 90 Hari Adalah Horizon yang Tepat
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { content_type: "PLANNED-CONTENT-TYPE-1: Regulatory maintenance — pembaruan aset yang sudah ada (60% dari kapasitas)", planning_approach: "The largest and most predictable component of Sari's editorial calendar: updates to existing Knowledge Registry assets triggered by regulatory changes. The 90-day planning horizon for regulatory maintenance: Sari reviews MJP's 4 pre-publication monitoring sources (Prolegnas, LKPP working group, BNSP Plenary, PUPR Renja) at the start of each 90-day cycle and creates a maintenance task for every upcoming regulatory change that is 'confirmed' (PIPELINE-SOURCE-1 at 60%+ probability) or 'likely' (PIPELINE-SOURCE-2 at 90%+ probability, PIPELINE-SOURCE-3 at 88%+ probability). Each maintenance task: estimated in hours (LEVEL-1 updates: 2–3 hours, LEVEL-4 revisions: 8–12 hours). Total planned maintenance hours for Q3 2026 (an average quarter): approximately 47 hours = 26% of Sari's 180-hour quarterly work capacity.", disruption_pattern: "Disruption pattern: major unplanned regulatory events (like the UU Cipta Kerja in 2020) consume planned maintenance capacity and require emergency triage. Sari's buffer: she plans maintenance tasks at only 60% capacity (not 100%) to preserve 40% for reactive maintenance when unplanned events occur. In 3 of the past 5 years: a significant unplanned regulatory event consumed the full 40% buffer (meaning Sari worked above her planned capacity in those quarters). In 2 years: no significant unplanned event (the 40% buffer was redirected to new asset creation, accelerating that queue). Sari: 'Calendar yang terencana 100% adalah kalender yang tidak bisa bertahan dari kenyataan. 60% rencana + 40% buffer: bukan ketidakefisienan — ini adalah realisme tentang bagaimana ekosistem regulasi Indonesia sebenarnya berperilaku.'", tc: "text-primary" },
            { content_type: "PLANNED-CONTENT-TYPE-2: New asset creation — aset baru untuk topik yang belum tercakup (25% dari kapasitas)", planning_approach: "New asset creation: the most creatively satisfying and commercially important component of Sari's calendar. The 90-day new asset plan: based on Budi's pain point analysis (which topics are commercial priorities), Hendra Jr.'s NLQ failure mode data (which topics generate Mode-4 incomplete responses — indicating a Knowledge Registry gap), and Sari's own observation of high-frequency NLQ queries that return incomplete results. Each 90-day cycle: Sari creates 4–6 new assets. New assets are disproportionately expensive (a new LEVEL-3 asset requires 10–15 hours vs a LEVEL-1 update at 2–3 hours) — which is why they consume 25% of calendar capacity despite being fewer in number.", disruption_pattern: "Disruption pattern: new asset creation is the first item cut when reactive maintenance consumes buffer capacity. In the 3 years with significant unplanned events: new asset creation averaged 2–3 assets per quarter (vs the planned 4–6). In the 2 buffer-available years: 6–7 new assets per quarter. The net effect: MJP's Knowledge Registry grew from 100 to 127 assets in 5 years — slower than Sari's ideal pace of 150 assets in 5 years. The post-Series A Knowledge Analyst hire: specifically designed to absorb LEVEL-1 and LEVEL-2 maintenance work, freeing Sari for new LEVEL-3 and LEVEL-4 asset creation. With the Analyst: Sari projects 8–10 new assets per quarter (vs current 4–6), growing the registry from 127 to 200+ assets within 3 years post-hire.", tc: "text-blue-700" },
            { content_type: "PLANNED-CONTENT-TYPE-3: Expert Contributor coordination — review siklus dengan 3 kontributor (10% dari kapasitas)", planning_approach: "Expert Contributor coordination: a fixed calendar component. Each of Sari's 3 Expert Contributors (procurement law specialist, BNSP certification specialist, structural engineering specialist) reviews 3–5 assets per quarter. Review scheduling: Sari batches review requests at the start of each 90-day cycle — sending each contributor their review materials in a single package rather than as individual requests throughout the quarter. This batching: reduces contributor interruption fatigue (they do their MJP reviews in one focused session rather than scattered single-document reviews) and gives Sari a predictable review completion timeline (contributors typically return reviews within 10 business days of receiving the batch).", disruption_pattern: "Disruption pattern: contributor unavailability is the most unpredictable element of Sari's calendar. In 2024: one Expert Contributor (procurement law specialist) had a 6-week gap in availability due to a major case. Sari's contingency: she maintains a 'review queue' of assets that she can defer to the next cycle if a contributor is unavailable. The queue: ensures that urgent assets (responding to an imminent regulatory change) always take priority for contributor review, while lower-urgency new assets wait for contributor availability to normalize. Post-Series A expansion to 8 contributors: reduces this risk through redundancy (2 specialists per domain = coverage even if one is unavailable) but increases coordination complexity proportionally.", tc: "text-emerald-700" },
            { content_type: "PLANNED-CONTENT-TYPE-4: Strategic initiatives — proyek khusus yang melampaui siklus pembaruan rutin (5% dari kapasitas)", planning_approach: "Strategic initiatives: the smallest calendar component but the one with the highest product impact. Examples of past strategic initiatives that occupied the 5% slot: (1) The 'Regulation Family Tree' asset (created in Q3 2023 — the most-accessed Knowledge Registry asset, representing 30 hours of relationship mapping across 54 procurement regulations). (2) The BUJK jenjang guide redesign (Q1 2024 — completely restructured to reduce Mode-4 NLQ failures on jenjang-related queries, reducing that specific failure type by 68%). (3) The 'Practical Procurement Calendar' asset (Q4 2024 — a 12-month visual guide to procurement cycle timing that Sari created after noticing high query frequency about procurement season dates). Each strategic initiative: consumes the 5% slot entirely for the 90-day cycle in which it occurs.", disruption_pattern: "Strategic initiatives are never cut for reactive maintenance (unlike new asset creation). The reason: strategic initiatives are the outputs that move Knowledge Registry from 'comprehensive reference' to 'indispensable intelligence tool.' The Regulation Family Tree: doubled MJP's average query resolution rate by giving NLQ a navigation map of the regulatory network. No amount of incremental maintenance produces that kind of step-change improvement. Sari's planning principle: protect the 5% strategic slot even in high-disruption quarters. If a quarter is so disrupted that the 5% slot cannot be used: defer the strategic initiative to the next quarter, but don't eliminate it. The strategic initiative backlog: Sari currently has 4 queued strategic initiatives waiting for available capacity (including a Procurement Decision Tree for common BUJK compliance questions and a Cross-Reference Validator tool for NLQ response citations).", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.content_type} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.content_type}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Planning approach: {r.planning_approach}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Disruption pattern: {r.disruption_pattern}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Sari's 90-day editorial calendar adalah the operational backbone of MJP's Knowledge Registry quality — because content quality is not produced by inspiration but by disciplined planning and capacity management. The 90-day horizon: deliberately shorter than a 6-month or annual plan (which would be disrupted too often by Indonesia's regulatory environment unpredictability) and longer than a monthly plan (which doesn't provide enough advance visibility for Expert Contributor coordination and new asset research). The 4-component allocation (60% maintenance, 25% new assets, 10% contributor coordination, 5% strategic initiatives): reflects the distribution of Sari's actual work as measured over 4 years of operation — it's a data-derived allocation, not a theoretical prescription. The most important calendar discipline: the 40% reactive buffer. Content teams that plan 100% of capacity consistently miss quality targets because the real world always introduces unplanned demands. The 40% buffer: the mechanism that allows Sari to produce high-quality planned content (because she has protected time for it) AND respond to unplanned regulatory events (because she has reserved capacity for them) without degrading either. The Knowledge Analyst hire's most important operational effect: not increasing the total content volume (though it does that) but protecting Sari's strategic initiative capacity. Currently: strategic initiatives are the first casualty when maintenance pressure is high. With the Analyst absorbing LEVEL-1/2 maintenance: strategic initiatives become protected time in Sari's calendar, not the most easily sacrificed slot. The Regulation Family Tree, the jenjang guide redesign, and the Practical Procurement Calendar — MJP's 3 highest-engagement Knowledge Registry assets — were all strategic initiatives that would not have been created if Sari had been running at 100% maintenance capacity. The Knowledge Analyst hire: is an investment in the next 3 strategic initiatives that will produce the next 3 step-change improvements in Knowledge Registry value.</p>
      </div>

      {/* R118: Knowledge Registry as NLQ Training Corpus */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE REGISTRY SEBAGAI NLQ TRAINING CORPUS — Feedback Loop antara KR dan Kualitas NLQ: 3 Mekanisme Saling Pengaruh, Bagaimana Peningkatan KR Langsung Meningkatkan NLQ, dan Kenapa Ini Adalah Moat Gabungan yang Paling Sulit Direplikasi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { mechanism: "FEEDBACK-LOOP-1: KR asset quality → NLQ Mode-1 response rate (direct citation accuracy)", direction: "Knowledge Registry → NLQ quality", how_it_works: "NLQ's response quality is directly bounded by the quality of the Knowledge Registry assets it cites. An NLQ query about procurement qualification requirements: can only produce a Mode-1 (complete, accurate, citable) response if the relevant Knowledge Registry asset covers the topic at LEVEL-3 or LEVEL-4 completeness with current regulatory accuracy. If the KR asset is outdated (LEVEL-1 update needed), incomplete (missing cross-reference), or absent (Mode-4 gap): the NLQ response degrades proportionally. The Regulation Family Tree's impact on NLQ Mode-1 rate: when Sari created the Regulation Family Tree asset (Q3 2023), the cross-reference navigation map it provided allowed NLQ to correctly chain procurement regulation citations across 54 related regulations — increasing Mode-1 rate for complex multi-regulation queries from 28% to 61% for that query subcategory.", investment_implication: "Investment implication: every Rp invested in Knowledge Registry quality improvement (new assets, LEVEL-1 updates, Expert Contributor reviews) has a compounding NLQ quality dividend. This is why the Knowledge Analyst hire's ROI is higher than it appears from the direct editorial capacity calculation — the Analyst's work on LEVEL-1 and LEVEL-2 maintenance not only maintains the KR's standalone value but also prevents NLQ quality degradation as regulations change. Sari and Hendra Jr.'s most important cross-functional alignment: neither can fully optimize their product independently of the other. The tight coupling: a design feature, not a technical debt.", tc: "text-primary" },
            { mechanism: "FEEDBACK-LOOP-2: NLQ query log → KR gap discovery (demand-driven content creation)", direction: "NLQ queries → Knowledge Registry priorities", how_it_works: "The reverse feedback: NLQ's query log (from R117 ai-rekomendasi panel) surfaces Knowledge Registry gaps that subscriber demand reveals. The Mode-4 gap analysis (Hendra Jr.'s quarterly report to Sari): 'In Q2 2026, the following 3 topics generated 10+ Mode-4 queries/month each: IUJK regional registration variations, subcontractor qualification requirements, and SKK renewal processing time by LSP. These topics have no dedicated Knowledge Registry assets.' This demand signal: more reliable than Sari's editorial intuition because it measures actual subscriber need (what BUJK actually ask about) rather than predicted need (what Sari thinks BUJK should want to know). The gap discovery mechanism: the only way Sari can continuously calibrate her content production to actual demand without running subscriber surveys.", investment_implication: "Investment implication: the NLQ query log makes Knowledge Registry content creation demand-driven rather than supply-driven. A supply-driven KR (Sari creates content based on her expertise) risks missing high-demand topics that don't match Sari's regulatory specialization focus. A demand-driven KR (Sari creates content in response to NLQ mode-4 signals): produces content that subscribers demonstrably need. The 3 Q3 2026 new assets (all triggered by Mode-4 gap analysis): IUJK regional registration, subcontractor qualification, and material price reference update — none of which Sari had on her editorial calendar before the Mode-4 analysis surfaced them. Without the NLQ feedback loop: those 3 subscriber needs would remain unaddressed until Sari encountered them through other research channels, potentially 12–18 months later.", tc: "text-blue-700" },
            { mechanism: "FEEDBACK-LOOP-3: NLQ usage patterns → KR format optimization (how assets should be structured for NLQ citation)", direction: "NLQ performance → Knowledge Registry format", how_it_works: "The subtlest feedback loop: NLQ's citation accuracy varies systematically by Knowledge Registry asset format. Hendra Jr.'s analysis of NLQ citation quality by asset type: LEVEL-3 and LEVEL-4 assets with structured paragraph headers (section: 'Requirements', section: 'Process', section: 'Timeline') produce more accurate NLQ citations than assets with unstructured prose. The structured sections: allow NLQ's retrieval system to identify the specific section that answers the query (rather than retrieving the entire asset and asking the LLM to identify the relevant portion). The citation accuracy improvement for structured assets: 15–20% higher Mode-1 rate compared to equivalent-quality unstructured assets.", investment_implication: "Investment implication: Sari's Knowledge Registry editorial style guide (updated in Q2 2026) now requires all new LEVEL-3 and LEVEL-4 assets to use the standardized section headers that Hendra Jr.'s NLQ performance analysis identified. The style guide update: required 4 hours of editorial work to formalize, but has permanently changed how all future assets are structured — improving NLQ citation quality for every asset produced after the update. The existing 127 assets: have a 40% structured/60% unstructured split (the unstructured ones were created before the format feedback loop was established). The Knowledge Analyst hire's first project: retrospectively reformatting the 27 most-cited unstructured assets (the ones most commonly retrieved by NLQ) to the standardized format — a direct NLQ quality improvement from a KR editorial task. Hendra Jr.: 'Knowledge Registry dan NLQ bukan dua produk yang terpisah yang kebetulan menggunakan data yang sama. Mereka adalah satu sistem intelejensi terintegrasi di mana kualitas setiap komponen menentukan batas atas kualitas seluruh sistem.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.mechanism} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.mechanism}</p>
              <p className={`text-[7px] font-mono italic text-muted-foreground mb-0.5`}>Direction: {r.direction}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">How it works: {r.how_it_works}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Investment implication: {r.investment_implication}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Knowledge Registry as NLQ training corpus adalah the architectural insight that makes MJP's intelligence system a compounding moat rather than two parallel products. The 3 feedback loops (KR quality → NLQ Mode-1 rate, NLQ queries → KR gap discovery, NLQ performance → KR format optimization): create a self-reinforcing quality cycle where each system continuously improves the other. The compound moat: the combined Knowledge Registry + NLQ quality, improved continuously by both feedback loops, is significantly more defensible than either product in isolation. A competitor who copies MJP's Knowledge Registry (with capital and time): gets the data but not the NLQ integration. A competitor who copies NLQ (by licensing an LLM and building a retrieval layer): gets the technology but not 127 LEVEL-3/4 assets with 5 years of Expert Contributor validation. A competitor who tries to build both simultaneously: faces the same bootstrapping challenge MJP had in 2021 — the KR isn't valuable without NLQ's discoverability, and NLQ isn't accurate without KR's content depth. MJP's advantage: it crossed this bootstrapping threshold in 2022 (when the KR reached sufficient depth that NLQ could produce Mode-1 responses for the majority of common BUJK queries) — and each year since has added compounding depth to both. The Series A data room description of this moat: 'MJP's Knowledge Registry and NLQ form a coupled quality flywheel. We can precisely measure the flywheel's speed: every 10-point improvement in Knowledge Registry completeness score (our internal quality metric) produces approximately 4-percentage-point improvement in NLQ Mode-1 response rate. This relationship is empirically validated across 5 years of parallel development. No competitor without both components and their integration history can replicate this relationship — it is a system property, not a feature.'</p>
      </div>

      {/* R119: Knowledge Asset ROI */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE ASSET ROI — Bagaimana Sari Mengukur Return on Investment Setiap Jam yang Diinvestasikan dalam Produksi Konten: 4 Metrik ROI, Formula Kalkulasi Setiap Metrik, dan Keputusan Editorial yang Dipandu Data ROI
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { metric: "ROI-METRIC-1: NLQ Answer Quality Rate — persentase NLQ queries yang dijawab dengan asset Knowledge Registry", formula: "Formula: (NLQ queries answered from KR ÷ total NLQ queries in the period) × 100. Current rate: 73% (73 of every 100 NLQ queries resolved by KR assets; 27% return fallback responses or 'not found'). Target rate post-Series A Year 1: 84%. The 73% baseline: tracked since NLQ launch in Q1 2022 and has improved from 58% (2022) → 65% (2023) → 71% (2024) → 73% (2026) — a steady improvement driven by Sari's editorial calendar prioritizing NLQ gap topics.", editorial_decision: "Editorial decision guided by this metric: Hendra Jr.'s quarterly NLQ gap analysis report identifies the 15–20 query topics that most frequently return 'not found' or low-confidence responses. Sari's next quarter editorial calendar: allocates at least 40% of new asset production to topics from this gap list. The causal link: every new Knowledge Asset created for a high-frequency gap topic increases NLQ Answer Quality Rate by 0.3–0.8 percentage points (Sari's empirical estimate from 3 years of tracking). A 10-percentage-point improvement in NLQ Answer Quality Rate (from 73% to 83%): requires approximately 25–30 new targeted assets — about 7 months of Sari's production capacity at her current 4 assets/month pace.", tc: "text-primary" },
            { metric: "ROI-METRIC-2: Briefing Section View Rate — persentase subscriber yang membaca Section 4 dan Section 5 briefing (Knowledge Registry highlights)", formula: "Formula: (subscribers who open the briefing and scroll past Section 3 ÷ total briefing opens) × 100. Current rate: 41% for Section 4 (Regulatory) and 34% for Section 5 (Knowledge Registry highlight). These rates: measured via pixel tracking in the email briefing (Open tracking doesn't distinguish between scroll depth). The 41% and 34% rates: tracked per subscriber tier — Enterprise subscribers read Sections 4–5 at 67% and 54% rates, while Standard subscribers read at 29% and 22%.", editorial_decision: "Editorial decision guided by this metric: when a specific Knowledge Registry asset is featured in Section 5 of the briefing and generates a 60%+ Section 5 read rate (vs the 34% average), Sari marks it as a 'high-resonance' topic category and prioritizes producing additional assets in that category for the next quarter. The read rate signal: more statistically reliable than NPS or subscriber feedback surveys because it measures actual behavior (reading) not stated preference (survey response). The highest-ever Section 5 read rate: a BIM mandate regulation asset in Q2 2025 achieved 78% read rate — validating that BIM compliance content is one of MJP's highest-resonance editorial categories. Result: Sari allocated 3 additional BIM-related assets in Q3 2025.", tc: "text-blue-700" },
            { metric: "ROI-METRIC-3: Subscriber Retention Attribution — asset categories correlated with higher renewal rates", formula: "Formula: Reza's annual renewal analysis segments subscribers by which Knowledge Registry categories they accessed most (tracked via NLQ query log category tagging and direct Knowledge Registry page views). Subscribers who accessed 5+ assets in the 'Regulatory Compliance' category: 96% renewal rate. Subscribers who accessed only 'Tender Intelligence' assets: 89% renewal rate. The 7-percentage-point gap: indicates that regulatory compliance content is MJP's highest-stickiness content category — subscribers who rely on KR for compliance decisions are harder to replace (no alternative source for the same depth of Indonesian construction regulation analysis).", editorial_decision: "Editorial decision guided by this metric: Sari's 2026 editorial calendar allocates 30% of new asset production to 'Regulatory Compliance' (highest retention impact), 25% to 'SKK and Certification' (second-highest retention impact based on renewal analysis), 20% to 'Tender Intelligence' (highest acquisition impact — most commonly cited by new subscribers as the reason they started their trial), and 25% to 'Market and Competitive Intelligence' (highest Enterprise engagement but lower Standard/Pro stickiness). The allocation: not based on what Sari finds most interesting to write, but on what the retention data shows generates the most durable subscriber relationship.", tc: "text-emerald-700" },
            { metric: "ROI-METRIC-4: SKK Express Query Reduction Rate — persentase penurunan pertanyaan berulang Reza akibat KR assets yang relevan", formula: "Formula: (SKK Express intake questions answered by KR self-service ÷ total SKK Express intake questions in the period) × 100. Current rate: 62% self-service answer rate for SKK Express pre-intake questions (BUJK who consult KR before calling Reza: have already answered 62% of the standard intake questions themselves, reducing the intake call from 45 minutes to 17 minutes). The 62% rate: improved from 34% in 2023 (before the dedicated 'SKK Express Guide' Knowledge Registry asset series was created).", editorial_decision: "Editorial decision guided by this metric: every time Reza identifies a question that he answers identically in 5+ SKK Express intake calls, he reports it to Sari as a 'KR gap' for a new self-service asset. Sari prioritizes these 'Reza-reported gaps' because the ROI formula is direct: if the new asset reduces one intake call from 45 minutes to 17 minutes for 50 future cases, it saves 23.3 hours of Reza's time (nearly 3 full working days) over the asset's useful life. The SKK Express KR ROI: the most directly quantifiable content ROI in MJP's portfolio — every hour Sari spends creating an SKK Express guide asset saves approximately 4–7 hours of Reza's intake time over the next 12 months. Hendra's calculation: 'Satu asset KR yang Sari buat dalam 6 jam: menghemat waktu Reza yang bernilai setara dengan 3–4 pelanggan Enterprise per tahun. ROI konten terbaik yang pernah kami hitung.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.metric} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.metric}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Formula and current rate: {r.formula}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Editorial decision: {r.editorial_decision}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Knowledge asset ROI measurement adalah Sari's most important editorial discipline — because without ROI measurement, content production defaults to 'what seems interesting' rather than 'what most improves subscriber outcomes.' The 4 ROI metrics (NLQ answer quality, briefing read rate, retention attribution, SKK query reduction): each capture a different dimension of content value. NLQ quality measures utility (does the asset answer real questions). Read rate measures resonance (do subscribers seek out the content). Retention attribution measures stickiness (does consuming the content make subscribers more likely to renew). SKK query reduction measures operational efficiency (does the content reduce labor cost in the SKK Express process). A single Knowledge Asset that scores well on all 4 metrics — answers a high-frequency NLQ gap, achieves above-average briefing read rate, is concentrated in the high-retention regulatory compliance category, AND reduces a recurring Reza intake question — is Sari's highest-priority production target. The integration of all 4 metrics: creates an editorial priority matrix that is more rigorous than any single metric could provide. Sari's quarterly editorial planning process: 3 hours reviewing the 4 ROI metrics, identifying the highest-priority gaps across all 4 dimensions, then designing the next quarter's 12–16 new assets to address the highest-composite-ROI opportunities first. The discipline: converts Sari's role from 'content creator' to 'content portfolio manager' — a strategic function that treats Knowledge Registry production as an investment portfolio with measurable returns, not as a creative output with uncertain impact.</p>
      </div>

      {/* R120: Knowledge Registry Governance */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE REGISTRY GOVERNANCE — Siapa yang Bisa Membuat, Mengedit, dan Mengarsipkan Asset: Model Curator-Led vs Crowdsourced, 4 Aturan Editorial yang Tidak Bisa Dikompromikan, dan Mengapa Kualitas Lebih Penting dari Kuantitas di Knowledge Registry
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { rule: "GOV-RULE-1: Single editorial authority — hanya Sari yang berwenang mempublikasikan Knowledge Asset baru", rationale: "The single-authority model: Sari is the only person who can publish, edit, or archive a Knowledge Registry asset. Hendra can suggest topics. Reza can report gaps (from subscriber support requests). Budi can provide narasumber research that informs asset content. The Knowledge Analyst hire (post-Series A): can draft assets for Sari's review. But the final publication decision: always Sari's. The rationale: Knowledge Registry quality depends on editorial consistency — every asset uses the same framing conventions, the same level of specificity, the same verification standards. A Knowledge Registry where multiple people publish assets independently: risks the quality variance that erodes subscriber trust. Subscribers who encounter 1 low-quality asset: recalibrate their expectation of the entire registry downward.", governance_consequence: "Governance consequence: Sari's editorial bottleneck is a deliberate design choice, not a scaling limitation. The Knowledge Analyst hire (post-Series A): is not a 'second Sari' but a 'draft generator for Sari' — producing first drafts that Sari edits to publishing quality. The editorial pipeline: draft (Analyst, 4–6 hours) → Sari review and revision (1–2 hours) → publication. The bottleneck: preserved at the publication step. Hendra's Series A framing: 'Knowledge Registry quality is our most important product guarantee. We will never sacrifice it for speed or volume. One wrong asset that misleads a BUJK into a failed tender submission is worth 50 correct assets in terms of trust damage. Single editorial authority is how we ensure we never publish a wrong asset.' Track record: 0 major factual errors in 200+ published assets across 5 years.", tc: "text-primary" },
            { rule: "GOV-RULE-2: Primary source verification — setiap klaim regulasi harus dapat dilacak ke dokumen resmi yang dikutip", rationale: "Every regulatory claim in a Knowledge Registry asset: must cite a specific primary source (SE letter code and publication date, Perpres number and year, BNSP circular reference). Sari's verification standard: 'If I can't cite the specific official document where this regulation appears, I cannot publish the claim.' The standard: unusually high for Indonesian market intelligence (most competitors cite secondary sources or rely on general regulatory awareness). The primary source citation: both a quality standard and a legal protection (MJP's advice is backed by cited primary sources, reducing the risk of liability from incorrect regulatory interpretations).", governance_consequence: "Governance consequence: the primary source requirement creates an inherent publication delay for breaking regulatory news. A regulation published today: requires Sari to locate and download the official document (sometimes available immediately, sometimes delayed by government website publication lag) before publishing the Knowledge Asset. The delay: typically 24–48 hours for straightforward regulations (available on LKPP/BNSP website immediately) to 5–7 days for complex multi-section regulations requiring careful interpretation. Sari's rule for this tension: 'A briefing mention (Section 4) can appear within 24 hours of detection — saying the regulation exists and what it generally requires. A full Knowledge Registry asset requires primary source verification and cannot be rushed.' The briefing section and the Knowledge Registry asset: serve different purposes and have different quality standards.", tc: "text-blue-700" },
            { rule: "GOV-RULE-3: Annual archive review — setiap asset direview tahunan untuk keakuratan dan relevansi yang berkelanjutan", rationale: "Every Knowledge Registry asset: reviewed annually by Sari for continued accuracy (has the underlying regulation changed?), relevance (is the pain point the asset addresses still active?), and completeness (has new related regulatory context emerged that the asset should incorporate?). Assets that no longer reflect current regulatory reality: archived (marked as historical, no longer surfaced in NLQ responses) rather than deleted (preserved for historical research purposes). The annual review: timed to Q4 (November–December) when the regulatory environment is relatively stable (between the October tender peak and the February budget execution start).", governance_consequence: "Governance consequence: the annual review creates a 'knowledge debt' that must be paid each Q4. At MJP's current 200+ asset corpus, the annual review requires approximately 40 hours of Sari's time (10 minutes per asset for active assets, longer for complex regulatory assets that require re-reading the primary source). The Knowledge Analyst hire (post-Series A): takes over 70% of the annual review workload (reviewing and flagging assets that need updates, not making the final archive/update decision — which remains Sari's). Hendra's calculation: the annual review cost (40 Sari hours = roughly Rp 4jt in labor cost at Sari's effective rate) against the cost of one subscriber making a decision based on an outdated Knowledge Asset (a failed tender due to outdated regulatory information: Rp 50jt+ in opportunity cost). The review investment: 80× ROI minimum on its worst-case scenario protection alone.", tc: "text-emerald-700" },
            { rule: "GOV-RULE-4: No crowdsourcing — subscriber feedback informs editorial priorities tapi subscribers tidak bisa mengedit atau menambahkan konten secara langsung", rationale: "The no-crowdsourcing rule: explicitly rejects the Wikipedia-model for Knowledge Registry content. Subscribers: can submit feedback ('this section seems outdated'), request topics ('we need more content on IUJK regional procedures for East Java'), and flag potential errors (reported via Reza's customer success channel). But subscribers cannot directly edit, annotate, or add content to the Knowledge Registry. The rationale: subscribers are domain experts in their own BUJK operations but not editorial experts in the regulatory interpretation standards MJP applies. A subscriber who adds an annotation based on their specific regional experience may be accurate for their province but misleading for subscribers in other provinces.", governance_consequence: "Governance consequence: the no-crowdsource rule means MJP's Knowledge Registry grows at Sari's production rate (4 assets/month currently, 6–8 with Knowledge Analyst post-Series A), not at the rate that crowdsourcing might achieve. Hendra's deliberate trade-off: 'BUJK pay for expert-curated intelligence, not for a community forum. The moment we let subscribers modify Knowledge Registry content, we become a wiki with a subscription fee — and subscribers who want a wiki can use Wikipedia for free. The value we deliver is expert curation. That requires human editorial judgment at every publication step.' The governance model: the structural commitment to quality over scale that differentiates MJP from any crowdsourced or AI-generated alternative.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.rule} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.rule}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Rationale: {r.rationale}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Governance consequence: {r.governance_consequence}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Knowledge Registry governance adalah the institutional infrastructure that makes MJP's editorial quality promise durable across time and team growth. The 4 governance rules (single editorial authority, primary source verification, annual archive review, no crowdsourcing): together define a quality standard that does not relax as MJP scales. Each rule: a direct response to a quality failure mode. Single authority: prevents quality variance from multiple uncoordinated publishers. Primary source verification: prevents misleading interpretations from secondary sources. Annual review: prevents accuracy decay from regulatory change. No crowdsourcing: prevents quality dilution from unverified subscriber contributions. The governance rules: not bureaucratic obstacles to content production but quality commitments to subscribers who make real financial decisions based on Knowledge Registry content. The stakes of governance failure: not abstract ('quality will decline') but concrete ('a BUJK who relies on an incorrect Knowledge Asset to guide a compliance decision may face a failed bid, a regulatory penalty, or a contract dispute'). MJP's liability exposure from incorrect Knowledge Assets: managed through the primary source citation standard (MJP interprets regulations faithfully from cited sources — if a regulation changes and MJP's asset hasn't been updated yet, the citation date provides context) and the annual review (no asset is more than 12 months old without a freshness review). The governance model: why MJP has maintained 0 major factual errors across 200+ assets and 5 years — not luck, but process discipline. Sari's summary: 'Quality governance isn't what slows us down. It is what allows subscribers to trust us enough to make consequential decisions based on our content. Without that trust: we are just another information source. With it: we are infrastructure.'</p>
      </div>
    </div>
  );
}
