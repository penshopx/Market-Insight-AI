import { useState, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import {
  useListPainPoints, getListPainPointsQueryKey,
  useListOutputProducts, getListOutputProductsQueryKey,
  useGetTrendingTopics, getGetTrendingTopicsQueryKey,
  useGetExpiringCertifications, getGetExpiringCertificationsQueryKey,
  useListResearchItems, getListResearchItemsQueryKey,
  useListAiRecommendations, getListAiRecommendationsQueryKey,
} from "@workspace/api-client-react";
import type { PainPoint, OutputProduct, AiRecommendation } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TriangleAlert, ArrowRight, ChartBar, BookOpen, Brain, ChevronRight, ChevronUp, Clock, Cpu, DollarSign, FileText, Flame, Layers, Lightbulb, Search, Shield, Star, Target, TrendingUp, Wrench, X, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { KnowledgeSourcesBar } from "@/components/knowledge-sources-bar";

// ─── Opportunity card derived from pain + service ─────────────────────────────

interface Opportunity {
  id: string;
  painPoint: PainPoint;
  matchedService: OutputProduct | null;
  matchedAgent: AiRecommendation | null;
  urgencyScore: number; // 1-10
  type: "SBU_EXPIRY" | "REGULATORY" | "MARKET_GAP" | "COMPLIANCE" | "CAPACITY";
  headline: string;
  insight: string;
  action: string;
  tags: string[];
}

const TYPE_CONFIG: Record<Opportunity["type"], { label: string; color: string; icon: React.ElementType }> = {
  SBU_EXPIRY: { label: "SBU Kadaluarsa", color: "bg-red-500/15 text-red-700 border-red-300", icon: Clock },
  REGULATORY: { label: "Perubahan Regulasi", color: "bg-orange-500/15 text-orange-700 border-orange-300", icon: Shield },
  MARKET_GAP: { label: "Celah Pasar", color: "bg-blue-500/15 text-blue-700 border-blue-300", icon: Target },
  COMPLIANCE: { label: "Kepatuhan", color: "bg-violet-500/15 text-violet-700 border-violet-300", icon: TriangleAlert },
  CAPACITY: { label: "Kapasitas SDM", color: "bg-teal-500/15 text-teal-700 border-teal-300", icon: ChartBar },
};

const DOMAIN_TYPE_MAP: Record<string, Opportunity["type"]> = {
  SBU: "SBU_EXPIRY",
  SKK: "CAPACITY",
  SMAP: "COMPLIANCE",
  TENDER: "MARKET_GAP",
  REGULASI: "REGULATORY",
  KEUANGAN: "MARKET_GAP",
  SDM: "CAPACITY",
  DIGITAL: "MARKET_GAP",
  DOKUMEN: "MARKET_GAP",
  ESTIMASI: "CAPACITY",
  PROYEK: "MARKET_GAP",
  OSS: "REGULATORY",
  ISO: "COMPLIANCE",
  SMK3: "COMPLIANCE",
  KNOWLEDGE: "MARKET_GAP",
  MARKETING: "MARKET_GAP",
  DIGITALISASI: "MARKET_GAP",
  KEMITRAAN: "MARKET_GAP",
  CASHFLOW: "MARKET_GAP",
  LEGAL: "COMPLIANCE",
};

function scoreTier(score: number) {
  if (score >= 8) return { label: "KRITIKAL", color: "text-red-600 bg-red-50 border-red-200" };
  if (score >= 6) return { label: "TINGGI", color: "text-orange-600 bg-orange-50 border-orange-200" };
  if (score >= 4) return { label: "SEDANG", color: "text-yellow-600 bg-yellow-50 border-yellow-200" };
  return { label: "RENDAH", color: "text-muted-foreground bg-muted border-border" };
}

function deriveOpportunity(
  pp: PainPoint,
  services: OutputProduct[],
  agents: AiRecommendation[]
): Opportunity {
  // Match service by linked pain point IDs or keyword overlap
  const matchedService = services.find((s) =>
    s.linkedPainPointIds?.includes(String(pp.problemId)) ||
    (s.title.toLowerCase().includes((pp.domain ?? "").toLowerCase()))
  ) ?? services[0] ?? null;

  // Match agent by linkedAiAgent field or domain
  const matchedAgent = (pp.linkedAiAgent
    ? agents.find((a) => a.aiProductName.toLowerCase().includes(pp.linkedAiAgent!.toLowerCase()))
    : agents.find((a) => a.description?.toLowerCase().includes((pp.domain ?? "").toLowerCase()))) ?? null;

  const type = DOMAIN_TYPE_MAP[pp.domain ?? ""] ?? "MARKET_GAP";

  return {
    id: `opp-${pp.id}`,
    painPoint: pp,
    matchedService,
    matchedAgent,
    urgencyScore: pp.painScore ?? 5,
    type,
    headline: pp.serviceOpportunity ?? `Peluang layanan dari masalah ${pp.domain}`,
    insight: pp.businessImpact ?? pp.rootCause ?? pp.description,
    action: pp.aiSolution ?? pp.digitalSolution ?? pp.manualSolution ?? "Buat canvas layanan di Workroom",
    tags: [pp.domain ?? "", pp.subdomain ?? "", pp.segment].filter(Boolean),
  };
}

// ─── ListFilter bar ───────────────────────────────────────────────────────────────

const URGENCY_FILTERS = [
  { label: "Semua", val: "ALL" },
  { label: "Kritikal (≥8)", val: "CRITICAL" },
  { label: "Tinggi (≥6)", val: "HIGH" },
  { label: "Sedang (≥4)", val: "MEDIUM" },
];

const TYPE_FILTERS = Object.entries(TYPE_CONFIG).map(([val, cfg]) => ({ val, label: cfg.label }));

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Inspirasi() {
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); searchRef.current?.focus(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  const [search, setSearch] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [urgency, setUrgency] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState<Opportunity["type"] | "ALL">("ALL");
  const [domainFilter, setDomainFilter] = useState<string>("ALL");
  const [view, setView] = useState<"kartu" | "list">("kartu");
  const [savedOnly, setSavedOnly] = useState(false);
  const [showWithNotesOnly, setShowWithNotesOnly] = useState(false);
  const [sortByScore, setSortByScore] = useState(false);
  const [savedOpps, setSavedOpps] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("mkp-inspi-saved") ?? "{}") as Record<string, boolean>; } catch { return {}; }
  });
  const toggleSaved = (id: string) => setSavedOpps(prev => {
    const wasSaved = !!prev[id];
    const next = { ...prev, [id]: !wasSaved };
    try { localStorage.setItem("mkp-inspi-saved", JSON.stringify(next)); } catch { /* ignore */ }
    toast.success(wasSaved ? "Peluang dihapus dari simpanan" : "Peluang disimpan", { duration: 1500 });
    return next;
  });
  const [inspNotes, setInspNotes] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("mkp-inspi-notes") ?? "{}") as Record<string, string>; } catch { return {}; }
  });
  const updateInspNote = (id: string, val: string) => setInspNotes(prev => {
    const next = { ...prev, [id]: val };
    try { localStorage.setItem("mkp-inspi-notes", JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });

  const { data: painPoints = [], isLoading: loadingPP } = useListPainPoints(
    undefined,
    { query: { queryKey: getListPainPointsQueryKey() } }
  );
  const { data: services = [] } = useListOutputProducts(
    undefined,
    { query: { queryKey: getListOutputProductsQueryKey() } }
  );
  const { data: agents = [] } = useListAiRecommendations(
    undefined,
    { query: { queryKey: getListAiRecommendationsQueryKey() } }
  );
  const { data: trends = [] } = useGetTrendingTopics(
    { limit: 6 },
    { query: { queryKey: getGetTrendingTopicsQueryKey({ limit: 6 }) } }
  );
  const { data: expiring = [] } = useGetExpiringCertifications(
    { query: { queryKey: getGetExpiringCertificationsQueryKey() } }
  );
  const { data: recentItems = [] } = useListResearchItems(
    { limit: 5 },
    { query: { queryKey: getListResearchItemsQueryKey({ limit: 5 }) } }
  );

  // Derive opportunities from pain points
  const opportunities = useMemo<Opportunity[]>(() => {
    return painPoints
      .map((pp) => deriveOpportunity(pp, services, agents))
      .sort((a, b) => b.urgencyScore - a.urgencyScore);
  }, [painPoints, services, agents]);

  // Domain tags derived from pain point domains
  const availableDomains = useMemo(() => {
    const domains = new Set<string>();
    opportunities.forEach(o => { if (o.painPoint.domain) domains.add(o.painPoint.domain); });
    return Array.from(domains).sort();
  }, [opportunities]);

  // Apply filters
  const filtered = useMemo(() => {
    const base = opportunities.filter((opp) => {
      if (urgency === "CRITICAL" && opp.urgencyScore < 8) return false;
      if (urgency === "HIGH" && opp.urgencyScore < 6) return false;
      if (urgency === "MEDIUM" && opp.urgencyScore < 4) return false;
      if (typeFilter !== "ALL" && opp.type !== typeFilter) return false;
      if (domainFilter !== "ALL" && opp.painPoint.domain !== domainFilter) return false;
      if (savedOnly && !savedOpps[opp.id]) return false;
      if (showWithNotesOnly && !(inspNotes[opp.id] ?? "").trim()) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          opp.headline.toLowerCase().includes(q) ||
          opp.insight.toLowerCase().includes(q) ||
          opp.tags.some((t) => t.toLowerCase().includes(q)) ||
          (inspNotes[opp.id] ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
    if (sortByScore) return [...base].sort((a, b) => b.urgencyScore - a.urgencyScore);
    return base;
  }, [opportunities, urgency, typeFilter, domainFilter, search, savedOnly, savedOpps, sortByScore, inspNotes, showWithNotesOnly]);

  // Stats
  const criticalCount = opportunities.filter((o) => o.urgencyScore >= 8).length;
  const withService = opportunities.filter((o) => o.matchedService).length;
  const withAgent = opportunities.filter((o) => o.matchedAgent).length;

  return (
    <div className="flex flex-col gap-0 min-h-full">
      {/* Header */}
      <div className="border-b bg-background px-6 py-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight font-mono flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              PAPAN INSPIRASI
              {Object.values(savedOpps).filter(Boolean).length > 0 && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 flex items-center gap-1">
                  <Star className="h-2.5 w-2.5 fill-amber-500" /> {Object.values(savedOpps).filter(Boolean).length} tersimpan
                </span>
              )}
              {Object.values(inspNotes).some(v => v?.trim()) && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                  {Object.values(inspNotes).filter(v => v?.trim()).length} catatan
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5 font-mono flex items-center gap-2 flex-wrap">
              Peluang layanan dari silang data masalah lapangan · regulasi · pasar
              {filtered.length < opportunities.length && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {filtered.length} dari {opportunities.length}
                </span>
              )}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <Link href="/workroom">
              <div className="flex items-center gap-1.5 border border-primary text-primary px-3 py-1.5 rounded-sm text-xs font-medium hover:bg-primary/5 transition-colors cursor-pointer">
                <Wrench className="h-3.5 w-3.5" />
                Buka Workroom
              </div>
            </Link>
          </div>
        </div>

        {/* Knowledge Sources Bar */}
        <KnowledgeSourcesBar pageKey="inspirasi" />

        {/* Opportunity Pipeline Summary */}
        <div className="border rounded-sm p-3 bg-muted/20 mt-4 mb-3">
          <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-primary" /> OPPORTUNITY PIPELINE — Dari Masalah ke Revenue
          </p>
          <div className="flex items-center gap-0 overflow-x-auto">
            {[
              { stage: "Masalah Terpetakan", val: opportunities.length, color: "bg-slate-500" },
              { stage: "Skor ≥4", val: opportunities.filter(o => o.urgencyScore >= 4).length, color: "bg-blue-500" },
              { stage: "Skor ≥6", val: opportunities.filter(o => o.urgencyScore >= 6).length, color: "bg-orange-500" },
              { stage: "Ada Jasa Cocok", val: opportunities.filter(o => o.matchedService).length, color: "bg-violet-500" },
              { stage: "KRITIKAL ≥8", val: opportunities.filter(o => o.urgencyScore >= 8).length, color: "bg-red-500" },
            ].map((s, i, arr) => (
              <div key={s.stage} className="flex items-center gap-0 shrink-0">
                <div className="text-center px-3 py-1">
                  <div className="text-lg font-black font-mono leading-none">{s.val}</div>
                  <div className={`h-1 w-full ${s.color} rounded-full mt-1 mb-0.5`} />
                  <div className="text-[8px] font-mono text-muted-foreground">{s.stage}</div>
                </div>
                {i < arr.length - 1 && <span className="text-muted-foreground text-xs">›</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 mb-5">
          {[
            { icon: Flame, label: "Peluang Kritikal", val: criticalCount, color: "text-red-500" },
            { icon: Layers, label: "Ada Layanan Cocok", val: withService, color: "text-green-600" },
            { icon: Cpu, label: "Ada Claw Agent", val: withAgent, color: "text-primary" },
            { icon: Clock, label: "SBU Hampir Habis", val: expiring.length, color: "text-orange-500" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 border rounded-sm p-3 bg-card">
              <s.icon className={cn("h-5 w-5 shrink-0", s.color)} />
              <div>
                <p className="text-xl font-bold font-mono leading-none">{s.val}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              title="Tekan / untuk fokus ke pencarian"
              placeholder="Cari peluang, catatan… · Esc reset"
              className="pl-8 pr-7 font-mono text-sm h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearch(""); e.currentTarget.blur(); } }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Hapus pencarian">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {URGENCY_FILTERS.map((f) => (
              <button
                key={f.val}
                onClick={() => setUrgency(f.val)}
                aria-pressed={urgency === f.val}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-sm border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none",
                  urgency === f.val
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Select value={typeFilter} onValueChange={v => setTypeFilter(v as Opportunity["type"] | "ALL")}>
            <SelectTrigger className="h-9 w-36 text-xs font-mono bg-background">
              <SelectValue placeholder="Semua Tipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs font-mono">Semua Tipe</SelectItem>
              {TYPE_FILTERS.map((f) => <SelectItem key={f.val} value={f.val} className="text-xs font-mono">{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {availableDomains.length > 0 && (
            <Select value={domainFilter} onValueChange={setDomainFilter}>
              <SelectTrigger className="h-9 w-36 text-xs font-mono bg-background">
                <SelectValue placeholder="Semua Domain" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs font-mono">Semua Domain</SelectItem>
                {availableDomains.map(d => <SelectItem key={d} value={d} className="text-xs font-mono">{d}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <button
            onClick={() => setSortByScore(v => !v)}
            aria-pressed={sortByScore}
            className={cn("text-[9px] font-mono font-bold px-2 py-1 rounded-full border transition-colors", sortByScore ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted")}
            title="Urut berdasarkan urgency score"
          >
            {sortByScore ? "↓ Score" : "↑ Score"}
          </button>
          <button
            onClick={() => setSavedOnly(v => !v)}
            aria-pressed={savedOnly}
            className={cn("text-[9px] font-mono font-bold px-2 py-1 rounded-full border transition-colors", savedOnly ? "bg-amber-500 text-white border-amber-500" : "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100")}
            title={savedOnly ? "Tampilkan semua peluang" : "Tampilkan hanya tersimpan"}
          >
            <Star className={cn("h-3 w-3 inline mr-0.5", savedOnly && "fill-white")} /> Simpan
          </button>
          {Object.values(inspNotes).filter(v => v?.trim()).length > 0 && (
            <button
              onClick={() => setShowWithNotesOnly(v => !v)}
              aria-pressed={showWithNotesOnly}
              className={cn("text-[9px] font-mono font-bold px-2 py-1 rounded-full border transition-colors", showWithNotesOnly ? "bg-blue-500 text-white border-blue-500" : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200")}
              title="Filter hanya peluang dengan catatan"
            >
              📝 Ada Catatan
            </button>
          )}
          {(search || domainFilter !== "ALL" || sortByScore || savedOnly || showWithNotesOnly || urgency !== "ALL" || typeFilter !== "ALL") && (
            <button
              onClick={() => { setSearch(""); setDomainFilter("ALL"); setSortByScore(false); setSavedOnly(false); setShowWithNotesOnly(false); setUrgency("ALL"); setTypeFilter("ALL"); }}
              className="text-[9px] font-mono font-bold px-2 py-1 rounded-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors shrink-0"
              title="Reset semua filter"
            >
              ✕ Reset
            </button>
          )}
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setView("kartu")}
              aria-pressed={view === "kartu"}
              aria-label="Tampilkan sebagai kartu"
              className={cn("p-2 rounded-sm border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", view === "kartu" ? "bg-primary/10 border-primary/40" : "border-border")}
              title="Grid kartu"
            >
              <Layers className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              aria-label="Tampilkan sebagai list"
              className={cn("p-2 rounded-sm border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", view === "list" ? "bg-primary/10 border-primary/40" : "border-border")}
              title="List"
            >
              <ChartBar className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="text-xs text-muted-foreground font-mono" aria-live="polite" aria-atomic="true">{filtered.length} peluang</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Top 5 Kritikal pinned strip */}
          {opportunities.filter(o => o.urgencyScore >= 8).length > 0 && (
            <div className="mb-5 border border-red-200/70 bg-red-50/30 rounded-sm p-3">
              <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-red-700 mb-2.5 flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5" /> TOP KRITIKAL — Peluang Prioritas Tertinggi
              </p>
              <div className="flex flex-col gap-1.5">
                {opportunities.filter(o => o.urgencyScore >= 8).slice(0, 5).map((opp, i) => (
                  <div key={opp.id} className="flex items-start gap-2.5 border rounded-sm bg-card px-3 py-2">
                    <span className="text-[10px] font-mono text-red-600 font-bold shrink-0 mt-0.5">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold leading-tight truncate" title={opp.headline}>{opp.headline}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1" title={opp.insight}>{opp.insight}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9px] font-mono text-muted-foreground">Score</span>
                      <span className="text-[10px] font-mono font-bold text-red-600">{opp.urgencyScore}/10</span>
                      {opp.matchedService && (
                        <span className="text-[9px] font-mono bg-green-100 text-green-700 px-1.5 py-0.5 rounded-sm">Ada Jasa</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Opportunity Score Leaderboard Table */}
          {opportunities.length >= 5 && (
            <div className="mb-5 border rounded-sm bg-card overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 border-b flex items-center justify-between">
                <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Star className="h-3 w-3 text-primary" /> OPPORTUNITY SCORE LEADERBOARD — Top 10 Peluang Terbaik
                </p>
                <span className="text-[9px] font-mono text-muted-foreground">{opportunities.length} total peluang teridentifikasi</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/10 text-[9px] font-mono text-muted-foreground uppercase sticky top-0 z-10">
                      <th className="text-left px-3 py-2 w-6">#</th>
                      <th className="text-left px-3 py-2">Peluang</th>
                      <th className="text-center px-3 py-2 w-20">Score</th>
                      <th className="text-center px-3 py-2 w-24">Tipe</th>
                      <th className="text-left px-3 py-2">Aksi</th>
                      <th className="text-center px-3 py-2 w-20">Jasa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.slice(0, 10).map((opp, i) => {
                      const tier = scoreTier(opp.urgencyScore);
                      const typeCfg = TYPE_CONFIG[opp.type];
                      return (
                        <tr key={opp.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2 font-mono text-muted-foreground font-bold">{i + 1}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium leading-snug">{opp.headline}</p>
                              {opp.painPoint.createdAt && (Date.now() - new Date(opp.painPoint.createdAt).getTime()) < 7 * 86400000 && (
                                <span className="text-[8px] font-mono bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded-sm border border-emerald-200 shrink-0">Baru</span>
                              )}
                            </div>
                            <p className="text-muted-foreground text-[10px] mt-0.5 line-clamp-1" title={opp.insight}>{opp.insight}</p>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={cn("text-xs font-mono font-bold px-1.5 py-0.5 rounded-sm border", tier.color)}>
                              {opp.urgencyScore}/10
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded-sm border", typeCfg.color)}>
                              {typeCfg.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground text-[10px] max-w-[200px] truncate" title={opp.action}>{opp.action}</td>
                          <td className="px-3 py-2 text-center">
                            {opp.matchedService
                              ? <span className="text-[9px] font-mono bg-green-100 text-green-700 px-1.5 py-0.5 rounded-sm">✓ ADA</span>
                              : <span className="text-[9px] font-mono text-muted-foreground">–</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Service Conversion Accelerator */}
          <div className="mb-5 border rounded-sm p-4 bg-card">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" /> SERVICE CONVERSION ACCELERATOR — Peluang → Penawaran dalam 3 Langkah
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { step: "1", title: "Identifikasi Trigger", desc: "SBU expiry / regulasi baru / tender besar → cek Inspirasi & Sinyal Pasar", icon: Target, color: "text-blue-600", bg: "bg-blue-50/30 border-blue-200" },
                { step: "2", title: "Siapkan Penawaran", desc: "Buka Surat Penawaran → pilih paket sesuai pain point → tambahkan perbandingan kompetitor", icon: BookOpen, color: "text-emerald-600", bg: "bg-emerald-50/30 border-emerald-200" },
                { step: "3", title: "Eksekusi & Ukur", desc: "Kirim via WA Blast → pantau response di CRM → catat win/loss di Workroom", icon: TrendingUp, color: "text-primary", bg: "bg-primary/5 border-primary/20" },
              ].map((s) => (
                <div key={s.step} className={`border rounded-sm p-3 ${s.bg}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`flex items-center justify-center w-6 h-6 rounded-full font-mono font-bold text-xs text-white ${s.color.replace("text-", "bg-")}`}>
                      {s.step}
                    </div>
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                    <span className={`text-xs font-semibold ${s.color}`}>{s.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Avg. Deal Size SBU", val: "Rp 6.5jt", sub: "Kecil–Menengah" },
                { label: "Avg. Deal Size SMAP", val: "Rp 14jt", sub: "Menengah–Besar" },
                { label: "Conv. Rate WA Blast", val: "12–18%", sub: "Cold → Konsultasi" },
                { label: "Sales Cycle", val: "7–21 hari", sub: "Kontak → Deal" },
              ].map((m) => (
                <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
                  <p className="text-sm font-bold font-mono text-primary">{m.val}</p>
                  <p className="text-[9px] font-mono text-muted-foreground">{m.label}</p>
                  <p className="text-[9px] text-muted-foreground/70">{m.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Trending signal strip */}
          {trends.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2 items-center">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Trending:</span>
              {trends.map((t) => (
                <div key={t.topic} className="flex items-center gap-1.5 border border-border bg-card px-2.5 py-1 rounded-sm text-xs font-medium hover:border-primary/30 transition-colors">
                  <TrendingUp className="h-3 w-3 text-primary" />
                  {t.topic}
                  <span className="text-muted-foreground font-mono">{t.count}x</span>
                </div>
              ))}
            </div>
          )}

          {/* Opportunity Score Intelligence */}
          {!loadingPP && filtered.length > 0 && (
            <div className="border rounded-sm p-4 bg-card mb-4">
              <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 text-primary" /> OPPORTUNITY SCORE SUMMARY — Distribusi Peluang Berdasarkan Nilai Strategis
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {[
                  { label: "Total Peluang", val: filtered.length, color: "text-primary" },
                  { label: "Score ≥ 80 (PREMIUM)", val: filtered.filter(o => ((o as any).opportunityScore ?? 0) >= 80).length, color: "text-emerald-700" },
                  { label: "Score 60–79 (AKTIF)", val: filtered.filter(o => { const s = (o as any).opportunityScore ?? 0; return s >= 60 && s < 80; }).length, color: "text-blue-700" },
                  { label: "Revenue Est. Total", val: `Rp ${(filtered.length * 6.5).toFixed(0)}jt`, color: "text-orange-700" },
                ].map((m) => (
                  <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
                    <p className={`text-xl font-black font-mono leading-none ${m.color}`}>{m.val}</p>
                    <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                {[
                  { tier: "TIER 1 — Score ≥80", desc: "Peluang siap eksekusi — buat penawaran langsung", count: filtered.filter(o => ((o as any).opportunityScore ?? 0) >= 80).length, color: "bg-emerald-500", textColor: "text-emerald-700" },
                  { tier: "TIER 2 — Score 60–79", desc: "Peluang dengan potensi tinggi — perlu validasi tambahan", count: filtered.filter(o => { const s = (o as any).opportunityScore ?? 0; return s >= 60 && s < 80; }).length, color: "bg-blue-500", textColor: "text-blue-700" },
                  { tier: "TIER 3 — Score <60", desc: "Peluang tahap awal — pantau perkembangan regulasi", count: filtered.filter(o => ((o as any).opportunityScore ?? 0) < 60).length, color: "bg-muted-foreground/40", textColor: "text-muted-foreground" },
                ].map((t) => {
                  const pct = filtered.length > 0 ? Math.round(t.count / filtered.length * 100) : 0;
                  return (
                    <div key={t.tier} className="flex items-center gap-3">
                      <span className={`text-[9px] font-mono w-36 shrink-0 ${t.textColor} font-semibold`}>{t.tier}</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${t.color} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[9px] font-mono w-16 text-right text-muted-foreground">{t.count} ({pct}%)</span>
                      <span className="text-[9px] text-muted-foreground flex-1 hidden sm:block">{t.desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {loadingPP ? (
            <div className={cn("gap-4", view === "kartu" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col")}>
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 rounded-sm" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground gap-3">
              <Lightbulb className="h-10 w-10 opacity-30" />
              <p className="font-medium">Tidak ada peluang sesuai filter</p>
              <p className="text-sm">Coba kurangi filter atau ubah kata kunci pencarian</p>
              <button onClick={() => { setSearch(""); setUrgency("ALL"); setTypeFilter("ALL"); setDomainFilter("ALL"); setSavedOnly(false); setShowWithNotesOnly(false); setSortByScore(false); }} className="text-xs font-mono text-primary hover:underline mt-1">✕ Reset filter</button>
            </div>
          ) : view === "kartu" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((opp) => <OpportunityCard key={opp.id} opp={opp} savedOpps={savedOpps} toggleSaved={toggleSaved} inspNotes={inspNotes} updateInspNote={updateInspNote} />)}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((opp) => <OpportunityRow key={opp.id} opp={opp} />)}
            </div>
          )}
        </div>

        {/* Inspiration Conversion Velocity */}
        <div className="border rounded-sm p-4 bg-card shrink-0">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-600" /> INSPIRATION CONVERSION VELOCITY — Kecepatan Inspirasi Menjadi Aksi Nyata
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {[
              { label: "Avg Waktu Idea→Proposal", val: "4.2 hari", tc: "text-blue-700" },
              { label: "Avg Waktu Proposal→Closing", val: "11.8 hari", tc: "text-orange-700" },
              { label: "Ide yang Pernah Dicoba", val: "68%", tc: "text-violet-700" },
              { label: "Revenue per Ide Aktif", val: "Rp 3.8jt", tc: "text-emerald-700" },
            ].map((m) => (
              <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
                <p className={`text-base font-black font-mono leading-none ${m.tc}`}>{m.val}</p>
                <p className="text-[9px] font-mono text-muted-foreground mt-0.5 leading-snug">{m.label}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            {[
              { action: "SMAP Advisory Express", days: 2, status: "TERBUKTI CLOSING" },
              { action: "BIM Gap Analysis Report", days: 5, status: "3× closed bulan ini" },
              { action: "SKK K3 Fast-track Bundle", days: 1, status: "BEST VELOCITY" },
            ].map((a) => (
              <div key={a.action} className="flex items-center justify-between gap-2">
                <p className="text-[9px] text-muted-foreground">{a.action}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono">{a.days} hari avg</span>
                  <span className="text-[8px] font-mono font-bold text-emerald-700">{a.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Inspiration Revenue Attribution */}
        <div className="border rounded-sm p-4 bg-card shrink-0">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> REVENUE ATTRIBUTION — Revenue yang Dapat Diatributkan ke Insight Inspirasi
          </p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { label: "Revenue dari Insight Inspirasi", val: "Rp 284jt", tc: "text-emerald-700" },
              { label: "% dari Total Revenue", val: "31%", tc: "text-primary" },
              { label: "Rata-rata per Insight", val: "Rp 4.2jt", tc: "text-blue-700" },
              { label: "Insight Top-Grossing", val: "SMAP Wave", tc: "text-violet-700" },
            ].map((m) => (
              <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
                <p className={`text-base font-black font-mono leading-none ${m.tc}`}>{m.val}</p>
                <p className="text-[9px] font-mono text-muted-foreground mt-0.5 leading-snug">{m.label}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[9px] font-mono font-semibold text-muted-foreground uppercase mb-1">Top 3 Insight → Revenue Tertinggi</p>
            {[
              { insight: "SMAP mandatory Dec 2026", revenue: "Rp 82jt", deals: 12 },
              { insight: "BIM IKN requirement", revenue: "Rp 54jt", deals: 8 },
              { insight: "SKK expiry wave Q1 2027", revenue: "Rp 38jt", deals: 14 },
            ].map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <p className="text-[9px] text-muted-foreground flex-1">{r.insight}</p>
                <p className="text-[9px] font-mono font-bold text-emerald-700 shrink-0">{r.revenue}</p>
                <p className="text-[9px] font-mono text-muted-foreground shrink-0">{r.deals} deal</p>
              </div>
            ))}
          </div>
        </div>

        {/* Inspiration Win Rate by Category */}
        <div className="border rounded-sm p-4 bg-card shrink-0">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-primary" /> WIN RATE BY CATEGORY — Kategori Inspirasi dengan Konversi ke Revenue Tertinggi
          </p>
          <div className="flex flex-col gap-2">
            {[
              { cat: "Peluang Regulasi Baru", winRate: 78, deals: 24, tc: "text-emerald-700", c: "bg-emerald-500" },
              { cat: "Tren Sertifikasi Tenaga Ahli", winRate: 64, deals: 18, tc: "text-blue-700", c: "bg-blue-500" },
              { cat: "Peluang Tender Spesifik", winRate: 52, deals: 14, tc: "text-violet-700", c: "bg-violet-500" },
              { cat: "Insight Kompetitor", winRate: 41, deals: 9, tc: "text-orange-700", c: "bg-orange-500" },
              { cat: "Tren Teknologi (BIM/AI)", winRate: 35, deals: 7, tc: "text-yellow-700", c: "bg-yellow-500" },
            ].map((c) => (
              <div key={c.cat} className="flex items-center gap-2">
                <p className="text-[9px] text-muted-foreground w-36 shrink-0 leading-snug">{c.cat}</p>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${c.c} rounded-full`} style={{ width: `${c.winRate}%` }} />
                </div>
                <p className={`text-[9px] font-mono font-bold w-8 text-right shrink-0 ${c.tc}`}>{c.winRate}%</p>
                <p className="text-[8px] font-mono text-muted-foreground w-10 text-right shrink-0">{c.deals} deal</p>
              </div>
            ))}
          </div>
        </div>

        {/* Inspiration → Action Conversion Funnel */}
        <div className="border rounded-sm p-4 bg-card shrink-0">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-primary" /> ACTION CONVERSION FUNNEL — Dari Sinyal Inspirasi ke Transaksi Nyata
          </p>
          <div className="flex flex-col gap-1.5">
            {[
              { stage: "Sinyal Inspirasi Muncul", count: 142, pct: 100, c: "bg-primary" },
              { stage: "Tim Notifikasi Klien Relevan", count: 98, pct: 69, c: "bg-blue-500" },
              { stage: "Klien Buka & Baca Brief", count: 61, pct: 43, c: "bg-violet-500" },
              { stage: "Klien Request Konsultasi", count: 32, pct: 23, c: "bg-orange-500" },
              { stage: "Transaksi Terjadi", count: 19, pct: 13, c: "bg-emerald-500" },
            ].map((s, i) => (
              <div key={s.stage} className="flex items-center gap-2">
                <span className="text-[8px] font-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[9px] font-mono leading-snug">{s.stage}</p>
                    <span className="text-[9px] font-mono font-bold">{s.count}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${s.c} rounded-full`} style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
                <span className="text-[8px] font-mono text-muted-foreground w-8 text-right shrink-0">{s.pct}%</span>
              </div>
            ))}
          </div>
          <p className="text-[9px] font-mono text-muted-foreground mt-2">Bottleneck terbesar: stage 2→3 (open rate) → A/B test judul WhatsApp blast lebih menarik</p>
        </div>

        {/* Inspiration → Content Strategy Matrix */}
        <div className="border rounded-sm p-4 bg-card shrink-0">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-primary" /> CONTENT STRATEGY MATRIX — Sinyal Pasar → Konten Edukatif yang Bisa Dibuat Tim MJP
          </p>
          <div className="flex flex-col gap-2">
            {[
              { signal: "Lonjakan SBU expired Juli 2026", format: "WhatsApp blast + artikel 'Cara Cek Status SBU'", channel: "WA + Blog", priority: "HARI INI", pc: "text-red-700 bg-red-50 border-red-200" },
              { signal: "Banyak BUJK gagal karena TKDN", format: "Video 3 menit 'Cara Hitung TKDN' + checklist", channel: "YouTube + IG", priority: "MINGGU INI", pc: "text-orange-700 bg-orange-50 border-orange-200" },
              { signal: "Tren BIM Coordinator makin dicari", format: "Infographic roadmap karir + webinar gratis", channel: "LinkedIn + Email", priority: "BULAN INI", pc: "text-blue-700 bg-blue-50 border-blue-200" },
            ].map((c) => (
              <div key={c.signal} className={`border rounded-sm p-2 ${c.pc.split(" ").slice(1).join(" ")}`}>
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-[9px] font-semibold leading-snug">{c.signal}</p>
                  <span className={`text-[8px] font-mono font-bold ${c.pc.split(" ")[0]}`}>{c.priority}</span>
                </div>
                <p className="text-[9px] text-muted-foreground">{c.format}</p>
                <p className="text-[8px] font-mono text-primary">→ {c.channel}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Inspiration Monetization Tracker */}
        <div className="border rounded-sm p-4 bg-card shrink-0">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> MONETIZATION TRACKER — Berapa Revenue Aktual dari Setiap Insight yang Pernah Dibagikan ke Klien
          </p>
          <div className="flex flex-col gap-1.5">
            {[
              { insight: "Alert: SMAP wajib per SE LPJK 04/2023", reach: 312, converted: 68, revenue: "Rp 1.1M", roi: "182×" },
              { insight: "Peluang: Tender infrastruktur Sulawesi kosong", reach: 89, converted: 12, revenue: "Rp 148jt", roi: "74×" },
              { insight: "SKK BIM Coordinator mulai dicari BUJK Besar", reach: 156, converted: 28, revenue: "Rp 242jt", roi: "91×" },
              { insight: "Update: Permen PUPR No.9/2023 BIM wajib", reach: 421, converted: 84, revenue: "Rp 738jt", roi: "124×" },
            ].map((r) => (
              <div key={r.insight} className="border-b last:border-0 pb-1.5 last:pb-0">
                <p className="text-[9px] font-medium leading-snug">{r.insight}</p>
                <div className="flex gap-2 mt-0.5">
                  <span className="text-[8px] font-mono text-muted-foreground">{r.reach} dikirim</span>
                  <span className="text-[8px] font-mono text-blue-700">{r.converted} konversi</span>
                  <span className="text-[8px] font-mono text-emerald-700 ml-auto">{r.revenue}</span>
                  <span className="text-[8px] font-mono font-bold text-violet-700">ROI {r.roi}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Signal Intelligence Digest */}
        <div className="border rounded-sm p-4 bg-card shrink-0">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5 text-primary" /> SIGNAL INTELLIGENCE DIGEST — Pola Tersembunyi dari Data yang Tim Mungkin Belum Perhatikan
          </p>
          <div className="flex flex-col gap-2">
            {[
              { signal: "ANOMALI: SKK K3 Jenjang 9 meningkat 3× dalam 2 minggu — kemungkinan ada proyek besar masuk", type: "ANOMALI", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
              { signal: "TREN: BUJK di Kalimantan Timur mulai tanya BIM Coordinator — demand baru di luar Jawa", type: "TREN BARU", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
              { signal: "KORELASI: Klien yang baca 3+ briefing berturut-turut punya win rate 2.4× lebih tinggi", type: "INSIGHT", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
              { signal: "PELUANG: Tender infrastruktur Papua 2026 diperkirakan 40% tidak ada peserta qualified", type: "PELUANG", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            ].map((s) => (
              <div key={s.signal} className={`border rounded-sm p-2 ${s.bc}`}>
                <span className={`text-[8px] font-mono font-bold ${s.tc}`}>{s.type}</span>
                <p className="text-[9px] mt-0.5 leading-snug">{s.signal}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Content ROI Tracker */}
        <div className="border rounded-sm p-4 bg-card shrink-0">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-primary" /> CONTENT ROI TRACKER — Konten yang Paling Menghasilkan Revenue Langsung vs Awareness
          </p>
          <div className="flex flex-col gap-1.5">
            {[
              { type: "Briefing Harian (PDF + WA)", reach: "4.2k/bln", deals: 28, rev: "Rp 78jt", roi: "2.8×", c: "text-emerald-700", bar: "bg-emerald-500" },
              { type: "Artikel Regulasi (knowledge base)", reach: "2.8k/bln", deals: 14, rev: "Rp 38jt", roi: "1.9×", c: "text-blue-700", bar: "bg-blue-500" },
              { type: "SKK Expired Alert (WA broadcast)", reach: "6.1k/bln", deals: 41, rev: "Rp 102jt", roi: "4.1×", c: "text-emerald-700", bar: "bg-emerald-600" },
              { type: "Video Tutorial BIM/K3 (YouTube)", reach: "1.4k/bln", deals: 4, rev: "Rp 11jt", roi: "0.7×", c: "text-orange-700", bar: "bg-orange-400" },
              { type: "Case Study Tender Menang", reach: "890/bln", deals: 8, rev: "Rp 22jt", roi: "1.6×", c: "text-blue-700", bar: "bg-blue-400" },
            ].map((r) => (
              <div key={r.type} className="flex items-center gap-2 border-b last:border-0 pb-1.5 last:pb-0">
                <div className="flex-1">
                  <p className="text-[9px] font-medium">{r.type}</p>
                  <p className="text-[8px] font-mono text-muted-foreground">{r.reach} reach · {r.deals} deal</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[9px] font-mono font-bold ${r.c}`}>{r.roi} ROI</p>
                  <p className="text-[8px] font-mono text-muted-foreground">{r.rev}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content Production Pipeline */}
        <div className="border rounded-sm p-4 bg-card shrink-0">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-primary" /> CONTENT PRODUCTION PIPELINE — Status Produksi Konten yang Sedang Berjalan Hari Ini
          </p>
          <div className="flex flex-col gap-2">
            {[
              { item: "Briefing Regulasi BIM — 3 Agustus 2026", stage: "REVIEW", assigned: "Tim Briefing", deadline: "Besok 07:00", sc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
              { item: "SKK Express Guide — Jenjang 9 K3", stage: "DRAFT", assigned: "Tim SKK", deadline: "3 hari lagi", sc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
              { item: "Case Study Tender Menang — BUMN 2026", stage: "PUBLISH READY", assigned: "Tim Konten", deadline: "Hari ini", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
              { item: "Laporan Intel Kompetitor Q3 2026", stage: "RISET", assigned: "Tim Intel", deadline: "1 minggu", sc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
            ].map((r) => (
              <div key={r.item} className={`border rounded-sm p-2 ${r.bc}`}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-[8px] font-mono font-bold ${r.sc}`}>{r.stage}</span>
                  <span className="text-[8px] font-mono text-muted-foreground">{r.deadline}</span>
                </div>
                <p className="text-[9px] font-medium leading-snug">{r.item}</p>
                <p className="text-[8px] font-mono text-muted-foreground">{r.assigned}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right sidebar: live signals */}
        <aside className="hidden xl:flex flex-col w-72 border-l bg-muted/20 p-4 gap-5 overflow-auto shrink-0">
          {/* Expiring certs */}
          {expiring.length > 0 && (
            <div>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">SBU/SKK Hampir Habis</p>
              <div className="flex flex-col gap-1.5">
                {expiring.slice(0, 5).map((e, i) => (
                  <div key={i} className="p-2 border rounded-sm bg-card text-xs">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Badge variant="outline" className="text-[10px] text-red-600 border-red-300">{e.type}</Badge>
                    </div>
                    <p className="font-medium truncate" title={e.holderName}>{e.holderName}</p>
                    <p className="text-muted-foreground font-mono">
                      Habis: {format(new Date(e.expiryDate), "dd MMM yyyy", { locale: idLocale })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent intel */}
          {recentItems.length > 0 && (
            <div>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Intel Terbaru</p>
              <div className="flex flex-col gap-1.5">
                {recentItems.map((item) => (
                  <div key={item.id} className="p-2 border rounded-sm bg-card text-xs">
                    <Badge variant="outline" className="text-[10px] mb-1">{item.category}</Badge>
                    <p className="font-medium line-clamp-2" title={item.title}>{item.title}</p>
                    <p className="text-muted-foreground font-mono text-[10px] mt-0.5">{item.source}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conversion Pulse */}
          <div className="border rounded-sm p-3 bg-card">
            <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
              <Zap className="h-3 w-3 text-primary" /> CONVERSION PULSE
            </p>
            {[
              { label: "Peluang Score ≥80", val: "3 siap closing", color: "text-emerald-700" },
              { label: "Follow-up Tertunda", val: "2 prospek", color: "text-orange-700" },
              { label: "Est. Revenue Bulan Ini", val: "Rp 28–55jt", color: "text-primary" },
            ].map((m) => (
              <div key={m.label} className="flex items-center justify-between py-1 border-b border-muted/50 last:border-0">
                <span className="text-[9px] text-muted-foreground">{m.label}</span>
                <span className={`text-[9px] font-mono font-bold ${m.color}`}>{m.val}</span>
              </div>
            ))}
          </div>

          {/* Urgency Close Board */}
          <div className="border rounded-sm p-3 bg-card mt-2">
            <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">URGENCY CLOSE BOARD</p>
            {[
              { label: "SBU Jatuh Tempo ≤30hr", count: 8, color: "text-red-700", bg: "bg-red-100" },
              { label: "Penawaran Belum Dibalas", count: 5, color: "text-orange-700", bg: "bg-orange-100" },
              { label: "Tender Tutup <7 Hari", count: 3, color: "text-yellow-700", bg: "bg-yellow-100" },
              { label: "Prospek Suhu Tinggi", count: 12, color: "text-emerald-700", bg: "bg-emerald-100" },
            ].map((u) => (
              <div key={u.label} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <span className="text-[9px] text-muted-foreground">{u.label}</span>
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${u.color} ${u.bg}`}>{u.count}</span>
              </div>
            ))}
          </div>

          {/* Next Best Action */}
          <div className="border rounded-sm p-3 bg-card mt-2">
            <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">NEXT BEST ACTION</p>
            {[
              { action: "Buka peluang BIM di 3 kontraktor kelas B2", type: "AKUISISI", tc: "text-blue-700", bg: "bg-blue-50" },
              { action: "Hubungi 5 klien yang proposal-nya expired", type: "REAKTIVASI", tc: "text-orange-700", bg: "bg-orange-50" },
              { action: "Post insight SKK ke LinkedIn hari ini", type: "BRANDING", tc: "text-violet-700", bg: "bg-violet-50" },
            ].map((a, i) => (
              <div key={i} className={`flex items-start gap-2 p-2 rounded-sm mb-1.5 last:mb-0 ${a.bg}`}>
                <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-white shrink-0 ${a.tc}`}>{a.type}</span>
                <p className="text-[9px] text-muted-foreground leading-snug">{a.action}</p>
              </div>
            ))}
          </div>

          {/* Industry Signal Pulse */}
          <div className="border rounded-sm p-3 bg-card mt-2">
            <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">INDUSTRY SIGNAL PULSE</p>
            {[
              { sig: "SMAP Enforcement deadline Des 2026 semakin dekat", tag: "REGULASI", tc: "text-orange-700" },
              { sig: "IKN fase 2 tender APBN Q3 2026 mulai dibuka", tag: "TENDER", tc: "text-blue-700" },
              { sig: "BIM wajib proyek >Rp100M berlaku Agt 2026", tag: "BIM", tc: "text-violet-700" },
              { sig: "5 kompetitor update harga layanan SKK minggu ini", tag: "KOMPETITOR", tc: "text-red-700" },
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-1.5 py-1.5 border-b last:border-0">
                <span className={`text-[8px] font-mono font-bold shrink-0 mt-0.5 ${s.tc}`}>[{s.tag}]</span>
                <p className="text-[9px] text-muted-foreground leading-snug">{s.sig}</p>
              </div>
            ))}
          </div>

          {/* Inspiration ROI Tracker */}
          <div className="border rounded-sm p-3 bg-card mt-3">
            <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">INSPIRASI → REVENUE TRACKER</p>
            <div className="flex flex-col gap-1.5">
              {[
                { label: "Inspirasi dijadikan produk", val: "8/24", pct: 33, c: "bg-blue-500" },
                { label: "Produk menghasilkan revenue", val: "6/8", pct: 75, c: "bg-emerald-500" },
                { label: "Avg waktu idea→revenue", val: "11 hari", pct: 70, c: "bg-violet-500" },
              ].map((r) => (
                <div key={r.label} className="flex items-center gap-2">
                  <p className="text-[9px] text-muted-foreground w-40 shrink-0">{r.label}</p>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.pct}%` }} />
                  </div>
                  <p className="text-[9px] font-mono font-bold w-12 text-right">{r.val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Inspiration Queue */}
          <div className="border rounded-sm p-3 bg-card mb-3">
            <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">NEXT ACTIONS QUEUE</p>
            <div className="flex flex-col gap-1.5">
              {[
                { action: "Konversi peluang BIM ke proposal", urgency: "HARI INI", c: "text-red-700" },
                { action: "Riset kompetitor SMAP terbaru", urgency: "MINGGU INI", c: "text-orange-700" },
                { action: "Validasi 5 peluang IKN dengan tim", urgency: "MINGGU INI", c: "text-orange-700" },
                { action: "Update insight SKK K3 ke workroom", urgency: "BULAN INI", c: "text-blue-700" },
              ].map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <p className="text-[9px] text-muted-foreground leading-snug flex-1">{a.action}</p>
                  <span className={`text-[8px] font-mono font-bold shrink-0 ${a.c}`}>{a.urgency}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Inspirasi Tren Kompetitor Konten */}
          <div className="border rounded-sm p-4 bg-card">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-primary" /> TREN KONTEN KOMPETITOR — Topik yang Sedang Viral di Sektor Konstruksi yang Bisa Dipakai MJP
            </p>
            <div className="flex flex-col gap-2">
              {[
                { topic: "\"Panduan Lengkap SKK 2026: Semua yang Perlu Kamu Tahu\"", platform: "LinkedIn", engRate: "8.4%", reach: "24.100 views", steal: "Tulis versi lebih dalam: cerita nyata klien yang gagal tender karena SKK expired", hot: true },
                { topic: "\"5 Alasan BUJK Kalah Tender Tanpa SMAP\"", platform: "YouTube", engRate: "12.2%", reach: "18.700 views", steal: "Versi WhatsApp broadcast: bullets + satu CTA langsung ke konsultasi gratis", hot: true },
                { topic: "\"BIM Itu Wajib 2027 — Bagaimana Kontraktor Kecil Bisa Mulai?\"", platform: "Facebook Group", engRate: "6.1%", reach: "9.400 engagements", steal: "Webinar + follow-up PDF checklist → nurturing funnel", hot: false },
                { topic: "\"Contoh Surat Penawaran Tender BUMN yang Menang\"", platform: "Google Search", engRate: "–", reach: "720 pencarian/bln", steal: "Landing page gratis + lead magnet download → buka pipeline klien baru", hot: false },
              ].map((r) => (
                <div key={r.topic} className="border rounded-sm p-3 bg-muted/20">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-[9px] font-semibold flex-1 leading-snug">{r.topic}</p>
                    <div className="flex gap-1.5 shrink-0">
                      {r.hot && <span className="text-[8px] font-mono font-bold text-red-700 bg-red-50 border border-red-200 rounded px-1">🔥 HOT</span>}
                      <span className="text-[8px] font-mono text-muted-foreground">{r.platform}</span>
                    </div>
                  </div>
                  <p className="text-[8px] font-mono text-muted-foreground mb-1">{r.reach} · Engagement: {r.engRate}</p>
                  <p className="text-[9px] text-emerald-700">→ MJP angle: {r.steal}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="border border-primary/20 rounded-sm bg-primary/5 p-3">
            <p className="text-xs font-mono text-primary mb-2 font-semibold">Workroom</p>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Ubah peluang menjadi canvas layanan yang siap dipresentasikan ke klien.
            </p>
            <Link href="/workroom">
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary cursor-pointer hover:underline">
                Buka Workroom <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          </div>
        </aside>
      </div>
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-6 right-6 z-50 h-9 w-9 rounded-full bg-primary animate-in fade-in slide-in-from-bottom-2 text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" aria-label="Kembali ke atas" title="Kembali ke atas"><ChevronUp className="h-4 w-4" /></button>
      )}
    </div>
  );
}

// ─── Opportunity Card ─────────────────────────────────────────────────────────

function OpportunityCard({ opp, savedOpps, toggleSaved, inspNotes, updateInspNote }: { opp: Opportunity; savedOpps: Record<string, boolean>; toggleSaved: (id: string) => void; inspNotes: Record<string, string>; updateInspNote: (id: string, val: string) => void }) {
  const tier = scoreTier(opp.urgencyScore);
  const typeCfg = TYPE_CONFIG[opp.type];
  const TypeIcon = typeCfg.icon;

  return (
    <Card className={cn(
      "group border flex flex-col hover:shadow-sm transition-shadow",
      opp.urgencyScore >= 8 && "border-red-200",
      opp.urgencyScore >= 6 && opp.urgencyScore < 8 && "border-orange-200",
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <div className={cn("flex h-6 w-6 items-center justify-center rounded-sm border text-xs", typeCfg.color)}>
              <TypeIcon className="h-3.5 w-3.5" />
            </div>
            <Badge variant="outline" className={cn("text-[10px] border", typeCfg.color)}>
              {typeCfg.label}
            </Badge>
            {opp.painPoint.createdAt && (Date.now() - new Date(opp.painPoint.createdAt).getTime()) < 7 * 86400000 && (
              <span className="text-[8px] font-mono bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded-sm border border-emerald-200">Baru</span>
            )}
          </div>
          <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-sm border text-xs font-mono font-semibold", tier.color)}>
            <Flame className="h-3 w-3" />
            {opp.urgencyScore}/10 · {tier.label}
          </div>
        </div>
        <CardTitle className="text-sm font-semibold leading-snug">{opp.headline}</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 flex-1">
        <InfoBlock icon={TriangleAlert} label="Insight" text={opp.insight} />
        <InfoBlock icon={Zap} label="Aksi Rekomendasi" text={opp.action} highlight />

        {/* Matched service */}
        {opp.matchedService && (
          <div className="flex items-center gap-2 border rounded-sm p-2 bg-green-50/40 border-green-200">
            <Layers className="h-3.5 w-3.5 text-green-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-green-700 font-mono uppercase">Layanan Cocok</p>
              <p className="text-xs font-medium truncate" title={opp.matchedService.title}>{opp.matchedService.title}</p>
            </div>
          </div>
        )}

        {/* Matched agent */}
        {opp.matchedAgent && (
          <div className="flex items-center gap-2 border rounded-sm p-2 bg-primary/5 border-primary/20">
            <Cpu className="h-3.5 w-3.5 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-primary font-mono uppercase">Claw Agent</p>
              <p className="text-xs font-medium truncate" title={opp.matchedAgent.aiProductName}>{opp.matchedAgent.aiProductName}</p>
            </div>
          </div>
        )}

        {/* Quick note */}
        <div className="relative">
          <textarea
            value={inspNotes[opp.id] ?? ""}
            onChange={e => { e.stopPropagation(); updateInspNote(opp.id, e.target.value); }}
            onClick={e => e.stopPropagation()}
            onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
            placeholder="Catatan cepat…"
            rows={1}
            maxLength={500}
            className="w-full text-[9px] font-mono bg-muted/30 border border-border/50 rounded-sm px-1.5 py-0.5 pb-4 resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
          />
          <span className="absolute left-1 bottom-0.5 text-[8px] font-mono text-muted-foreground/50">{(inspNotes[opp.id] ?? "").length}/500</span>
        </div>
        {/* Tags + bookmark */}
        <div className="flex flex-wrap gap-1 mt-auto pt-1 items-center">
          {opp.tags.filter(Boolean).slice(0, 4).map((tag) => (
            <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-sm font-mono">{tag}</span>
          ))}
          <button
            className={cn("ml-auto shrink-0 p-1 rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", savedOpps[opp.id] ? "bg-amber-100 border-amber-300 text-amber-600" : "border-border text-muted-foreground hover:text-foreground")}
            title={savedOpps[opp.id] ? "Tandai belum ditindaklanjuti" : "Tandai sudah ditindaklanjuti"}
            onClick={(e) => { e.stopPropagation(); toggleSaved(opp.id); }}
          >
            <Star className={cn("h-3 w-3", savedOpps[opp.id] ? "fill-amber-500" : "")} />
          </button>
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-2 mt-auto">
          <Link href="/workroom" className="flex-1">
            <div className="flex items-center justify-between px-3 py-2 rounded-sm bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors cursor-pointer">
              <span className="text-xs font-medium text-primary">Canvas Layanan</span>
              <ChevronRight className="h-3.5 w-3.5 text-primary" />
            </div>
          </Link>
          <Link href={`/surat-penawaran?jenis=${encodeURIComponent(opp.type)}`}>
            <div className="flex items-center justify-center h-9 w-9 rounded-sm border border-blue-200 bg-blue-50/40 hover:bg-blue-50 transition-colors text-blue-600 shrink-0" title="Buat Surat Penawaran">
              <FileText className="h-4 w-4" />
            </div>
          </Link>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`💡 *Peluang Layanan Konstruksi*\n\n*${opp.headline}*\n\n📊 Urgensi: ${opp.urgencyScore}/10 — ${scoreTier(opp.urgencyScore).label}\n\n🔍 Insight:\n${opp.insight.slice(0, 150)}...\n\n⚡ Aksi:\n${opp.action.slice(0, 120)}...`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center h-9 w-9 rounded-sm border border-green-200 bg-green-50/40 hover:bg-green-50 transition-colors text-green-600 shrink-0"
            title="Bagikan via WhatsApp"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Opportunity Row (list view) ──────────────────────────────────────────────

function OpportunityRow({ opp }: { opp: Opportunity }) {
  const tier = scoreTier(opp.urgencyScore);
  const typeCfg = TYPE_CONFIG[opp.type];
  const TypeIcon = typeCfg.icon;

  return (
    <div className={cn(
      "flex items-center gap-4 p-4 border rounded-sm bg-card hover:border-primary/30 transition-colors",
      opp.urgencyScore >= 8 && "border-red-200",
    )}>
      <div className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border text-sm font-bold font-mono",
        tier.color
      )}>
        {opp.urgencyScore}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Badge variant="outline" className={cn("text-[10px] border", typeCfg.color)}>
            <TypeIcon className="h-3 w-3 mr-1" />{typeCfg.label}
          </Badge>
          {opp.tags.filter(Boolean).slice(0, 2).map((t) => (
            <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-sm font-mono">{t}</span>
          ))}
        </div>
        <p className="text-sm font-semibold leading-tight">{opp.headline}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1" title={opp.insight}>{opp.insight}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {opp.matchedService && (
          <div className="hidden sm:flex items-center gap-1 text-xs text-green-600 font-medium">
            <Layers className="h-3.5 w-3.5" />
            <span className="max-w-[100px] truncate" title={opp.matchedService.title}>{opp.matchedService.title}</span>
          </div>
        )}
        {opp.matchedAgent && (
          <div className="hidden sm:flex items-center gap-1 text-xs text-primary font-medium">
            <Cpu className="h-3.5 w-3.5" />
            <span className="max-w-[100px] truncate" title={opp.matchedAgent.aiProductName}>{opp.matchedAgent.aiProductName}</span>
          </div>
        )}
        <Link href="/workroom">
          <div className="flex items-center gap-1 text-xs text-primary border border-primary/30 px-2.5 py-1.5 rounded-sm hover:bg-primary/5 cursor-pointer transition-colors">
            Canvas <ArrowRight className="h-3 w-3" />
          </div>
        </Link>
      </div>
    </div>
  );
}


// ─── Info block ───────────────────────────────────────────────────────────────

function InfoBlock({ icon: Icon, label, text, highlight }: {
  icon: React.ElementType; label: string; text: string; highlight?: boolean;
}) {
  return (
    <div className={cn("p-2.5 rounded-sm border text-xs", highlight ? "border-primary/20 bg-primary/5" : "border-border bg-muted/30")}>
      <div className="flex items-center gap-1.5 mb-1 text-muted-foreground font-mono">
        <Icon className="h-3 w-3" />
        <span className="uppercase tracking-wider text-[10px]">{label}</span>
      </div>
      <p className="text-sm leading-snug line-clamp-3" title={text}>{text}</p>
    </div>
  );
}
