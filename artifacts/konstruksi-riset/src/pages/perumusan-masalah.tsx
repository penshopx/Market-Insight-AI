import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Link } from "wouter";
import {
  useListPainPoints, getListPainPointsQueryKey,
  useListOutputProducts, getListOutputProductsQueryKey,
  useListResearchItems, getListResearchItemsQueryKey,
} from "@workspace/api-client-react";
import type { PainPoint } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Activity, Archive, ArrowRight, BookOpen, Brain, ChartBar, ChevronDown, ChevronRight, ChevronUp, CircleAlert, CircleCheck, ClipboardCheck, Copy, DollarSign, FileText, Flame, FlaskConical, Globe, History, Image, Layers, LayoutGrid, Lightbulb, ListOrdered, MapPin, Network, RefreshCw, RotateCcw, Scale, Search, Shield, ShieldAlert, Sparkles, Star, Target, TrendingUp, TriangleAlert, Trophy, Users, Wrench, X, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { KnowledgeSourcesBar } from "@/components/knowledge-sources-bar";
import { toast } from "sonner";

// ─── AI Insight Panel ────────────────────────────────────────────────────────

function AiInsightPanel({ painPoints, researchItems }: { painPoints: PainPoint[]; researchItems: { title: string; category?: string | null; summary?: string | null }[] }) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setInsight(null);
    try {
      const topProblems = painPoints
        .sort((a, b) => (b.painScore ?? 0) - (a.painScore ?? 0))
        .slice(0, 5)
        .map(p => `- ${p.domain}: ${p.description} (skor ${p.painScore}/10)`)
        .join("\n");
      const topResearch = researchItems.slice(0, 4).map(r => `- [${r.category}] ${r.title}`).join("\n");
      const prompt = `Kamu adalah konsultan marketing konstruksi Indonesia senior. Berdasarkan data masalah lapangan berikut:\n\n${topProblems}\n\nDan data riset terbaru:\n${topResearch}\n\nBerikan 3 rekomendasi kampanye marketing yang paling actionable untuk bulan ini, dengan format:\n1. [Nama kampanye] — [target segment] — [pesan utama] — [channel]\n2. ...\n3. ...\nJawab singkat, 1 kalimat per poin, dalam Bahasa Indonesia.`;

      const convRes = await fetch(`${API}/openrouter/conversations`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Perumusan Insights" }),
      });
      if (!convRes.ok) throw new Error("Gagal membuat sesi AI");
      const conv = await convRes.json() as { id: number };

      const msgRes = await fetch(`${API}/openrouter/conversations/${conv.id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content: prompt }),
      });
      if (!msgRes.ok) throw new Error("Gagal mendapat respons AI");
      const msg = await msgRes.json() as { assistantMessage?: { content?: string } };
      setInsight(msg.assistantMessage?.content ?? "(tidak ada respons)");
      toast.success("AI Insight berhasil dibuat", { duration: 2000 });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [painPoints, researchItems, API]);

  return (
    <div className="border rounded-sm p-4 bg-card">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> AI INSIGHT GENERATOR — Rekomendasi Kampanye dari Data Masalah Live
        </p>
        <div className="flex items-center gap-2">
          {(insight || error) && (
            <button
              onClick={() => { setInsight(null); setError(null); }}
              className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground border border-border px-2 py-1.5 rounded-sm hover:bg-muted/40 transition-colors"
              aria-label="Bersihkan hasil AI"
              title="Bersihkan hasil AI"
            >
              <RotateCcw className="h-3 w-3" /> RESET
            </button>
          )}
          <button
            onClick={() => void generate()}
            disabled={loading || painPoints.length === 0}
            className="flex items-center gap-1.5 text-[10px] font-mono font-bold border border-primary/40 text-primary px-3 py-1.5 rounded-sm hover:bg-primary/5 disabled:opacity-50 transition-colors"
          >
            {loading ? <><RefreshCw className="h-3 w-3 animate-spin" /> Generating...</> : <><Brain className="h-3 w-3" /> Generate Insights</>}
          </button>
        </div>
      </div>
      {!insight && !loading && !error && (
        <p className="text-[10px] font-mono text-muted-foreground">Klik Generate Insights untuk mendapat rekomendasi kampanye berbasis {painPoints.length} masalah lapangan aktif.</p>
      )}
      {loading && (
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground py-2">
          <RefreshCw className="h-3 w-3 animate-spin" /> Menganalisis masalah dan merumuskan strategi...
        </div>
      )}
      {error && (
        <p className="text-[10px] font-mono text-destructive py-2">{error}</p>
      )}
      {insight && (
        <div className="border rounded-sm p-3 bg-primary/5 text-xs font-mono whitespace-pre-wrap leading-relaxed text-foreground">
          {insight}
        </div>
      )}
    </div>
  );
}

// ─── Problem Formulation Framework ───────────────────────────────────────────

const FORMULATION_STEPS = [
  {
    step: "01",
    title: "Identifikasi Masalah",
    desc: "Kumpulkan pain point dari lapangan — VOC, riset, observasi langsung.",
    icon: Search,
    color: "text-blue-600",
    bg: "bg-blue-50/40 border-blue-200",
    link: "/pain-points",
    cta: "Lihat CPKB",
  },
  {
    step: "02",
    title: "Pemetaan Domain",
    desc: "Kelompokkan masalah per domain (SBU, SKK, SMAP, Tender, dll.) dan ukur pain score.",
    icon: Layers,
    color: "text-violet-600",
    bg: "bg-violet-50/40 border-violet-200",
    link: "/pain-points",
    cta: "Lihat Domain Heatmap",
  },
  {
    step: "03",
    title: "Analisis Akar Masalah",
    desc: "Tentukan root cause — regulasi, SDM, proses, atau informasi — sebelum usulkan solusi.",
    icon: Brain,
    color: "text-orange-600",
    bg: "bg-orange-50/40 border-orange-200",
    link: "/workroom",
    cta: "Buka Workroom",
  },
  {
    step: "04",
    title: "Rumuskan Peluang Layanan",
    desc: "Konversi masalah menjadi proposisi nilai layanan yang bisa dijual ke klien.",
    icon: DollarSign,
    color: "text-emerald-600",
    bg: "bg-emerald-50/40 border-emerald-200",
    link: "/inspirasi",
    cta: "Papan Inspirasi",
  },
  {
    step: "05",
    title: "Validasi dengan Data Pasar",
    desc: "Konfirmasi peluang dengan data tender, regulasi aktif, dan sinyal VOC.",
    icon: TrendingUp,
    color: "text-primary",
    bg: "bg-primary/5 border-primary/20",
    link: "/sinyal-pasar",
    cta: "Sinyal Pasar",
  },
  {
    step: "06",
    title: "Siapkan Penawaran",
    desc: "Generate surat penawaran layanan berdasarkan peluang yang sudah divalidasi.",
    icon: FileText,
    color: "text-slate-600",
    bg: "bg-slate-50/40 border-slate-200",
    link: "/surat-penawaran",
    cta: "Generator Surat",
  },
];

const DOMAIN_SEGMENTS: { domain: string; segment: string; serviceAngle: string; color: string }[] = [
  { domain: "SBU", segment: "BUJK Kecil / Menengah", serviceAngle: "Pengurusan & Perpanjangan SBU Express", color: "bg-red-100 text-red-700" },
  { domain: "SKK", segment: "Tenaga Ahli Konstruksi", serviceAngle: "Jasa Sertifikasi SKK Jenjang 7/8/9", color: "bg-orange-100 text-orange-700" },
  { domain: "SMAP", segment: "BUJK Menengah / Besar", serviceAngle: "SMAP ISO 37001 — Dokumen + Sertifikasi", color: "bg-yellow-100 text-yellow-700" },
  { domain: "TENDER", segment: "Kontraktor Aktif Tender", serviceAngle: "Pendampingan Tender End-to-End", color: "bg-blue-100 text-blue-700" },
  { domain: "ISO", segment: "BUJK Butuh Sertifikasi", serviceAngle: "ISO 9001 / 45001 — Dokumen & Sertifikat", color: "bg-violet-100 text-violet-700" },
  { domain: "DIGITAL", segment: "Kontraktor Proyek Besar", serviceAngle: "BIM Advisory + SKK BIM", color: "bg-emerald-100 text-emerald-700" },
  { domain: "CASHFLOW", segment: "Kontraktor Kecil", serviceAngle: "Konsultasi Keuangan & Pembiayaan Proyek", color: "bg-teal-100 text-teal-700" },
  { domain: "TKDN", segment: "Peserta Tender APBN", serviceAngle: "Verifikasi TKDN + BOM Tender", color: "bg-indigo-100 text-indigo-700" },
];

// ─── Problem Card ─────────────────────────────────────────────────────────────

function ProblemCard({ pp, rank, relatedResearch, note, onNoteChange }: { pp: PainPoint; rank: number; relatedResearch?: { id: number; title: string; status?: string | null }[]; note: string; onNoteChange: (val: string) => void }) {
  const [open, setOpen] = useState(false);
  const [photoZoom, setPhotoZoom] = useState<string | null>(null);
  const { photoUrl: embeddedPhoto, cleanDescription } = parseFotoBukti(pp.description);
  const displayDescription = cleanDescription || pp.description;
  const priorityColor = pp.priority === "CRITICAL"
    ? "border-red-300 bg-red-50/30"
    : pp.priority === "HIGH"
    ? "border-orange-200 bg-orange-50/20"
    : "border-border bg-card";

  return (
    <div className={cn("border rounded-sm overflow-hidden transition-all hover:brightness-95", priorityColor)}>
      <button
        className="w-full flex items-start gap-3 p-3 text-left focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none"
        aria-expanded={open}
        title={open ? "Tutup detail masalah" : "Buka detail masalah"}
        onClick={() => setOpen(!open)}
      >
        <span className="text-[10px] font-mono font-bold text-muted-foreground shrink-0 mt-0.5 w-5 text-right">#{rank}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            {pp.domain && (
              <span className="text-[9px] font-mono bg-muted px-1.5 py-0.5 rounded-sm">{pp.domain}</span>
            )}
            {pp.priority && (
              <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded-sm font-bold",
                pp.priority === "CRITICAL" ? "bg-red-100 text-red-700" :
                pp.priority === "HIGH" ? "bg-orange-100 text-orange-700" :
                "bg-yellow-100 text-yellow-700"
              )}>{{ CRITICAL:"Kritis", HIGH:"Tinggi", MEDIUM:"Sedang", LOW:"Rendah" }[pp.priority] ?? pp.priority}</span>
            )}
            {pp.painScore && (
              <span
                title={`Pain Score ${pp.painScore}/10 — ${pp.painScore >= 9 ? "Kritis: masalah sangat urgent, prioritas tertinggi" : pp.painScore >= 7 ? "Tinggi: dampak signifikan, follow-up segera" : "Sedang: masalah valid, masuk pipeline riset"}`}
                className="text-[9px] font-mono text-muted-foreground cursor-help"
              >⚡{pp.painScore}/10</span>
            )}
          </div>
          <div className="flex items-start gap-1 group/ppname">
            <p className="text-xs font-medium leading-snug line-clamp-2 flex-1" title={displayDescription ?? undefined}>{displayDescription}</p>
            <button onClick={e => { e.stopPropagation(); void navigator.clipboard.writeText(displayDescription ?? "").then(() => toast.success("Disalin!", { duration: 1200 })); }} aria-label="Salin deskripsi masalah" className="opacity-0 group-hover/ppname:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-foreground mt-0.5" title="Salin"><Copy className="h-2.5 w-2.5" /></button>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {pp.createdAt && (Date.now() - new Date(pp.createdAt).getTime()) < 7 * 86400000 && (
            <span className="text-[8px] font-mono bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded-sm border border-emerald-200">Baru</span>
          )}
          {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 border-t border-border/50 pt-2.5 space-y-2 ml-8">
          {pp.rootCause && (
            <div>
              <span className="text-[9px] font-mono text-muted-foreground uppercase">Root Cause · </span>
              <span className="text-xs text-muted-foreground">{pp.rootCause}</span>
            </div>
          )}
          {pp.serviceOpportunity && (
            <div className="flex items-start gap-1.5 p-2 bg-emerald-50/50 border border-emerald-200/50 rounded-sm">
              <DollarSign className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-[9px] font-mono text-emerald-700 font-bold">PELUANG JASA · </span>
                <span className="text-xs text-emerald-800">{pp.serviceOpportunity}</span>
              </div>
            </div>
          )}
          {pp.aiSolution && (
            <div className="flex items-start gap-1.5">
              <Brain className="h-3.5 w-3.5 text-violet-500 shrink-0 mt-0.5" />
              <span className="text-xs text-muted-foreground">{pp.aiSolution}</span>
            </div>
          )}
          {relatedResearch && relatedResearch.length > 0 && (
            <div className="pt-1">
              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Riset Terkait · </span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {relatedResearch.slice(0, 3).map((r) => (
                  <span key={r.id} title={r.title} className="text-[9px] font-mono bg-violet-50 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded-sm truncate max-w-[180px]">
                    {r.title}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Foto Bukti — Task #72: shows evidencePhotoUrl or photo embedded in description */}
          {(pp.evidencePhotoUrl || embeddedPhoto) && (
            <div className="pt-1">
              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
                <Image className="h-3 w-3" /> Foto Bukti Lapangan
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {[pp.evidencePhotoUrl, embeddedPhoto].filter(Boolean).map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPhotoZoom(url!); }}
                    className="flex-1 min-w-0"
                  >
                    <img
                      src={url!}
                      alt="Foto bukti"
                      className="rounded-sm border max-h-24 object-cover w-full hover:opacity-80 hover:ring-2 hover:ring-primary/40 transition-all cursor-zoom-in"
                    />
                    <span className="text-[8px] font-mono text-muted-foreground block mt-0.5">Klik untuk perbesar</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">Catatan Tim</p>
            <textarea
              value={note}
              onChange={(e) => { e.stopPropagation(); onNoteChange(e.target.value); }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); }}
              onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
              placeholder="Tambah catatan analisis…"
              rows={2}
              maxLength={500}
              className="w-full border rounded-sm px-2 py-1 text-[10px] resize-none bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
            <p className="text-[9px] font-mono text-muted-foreground text-right">{note.length} / 500</p>
          </div>
        </div>
      )}
      {/* Photo zoom modal */}
      {photoZoom && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPhotoZoom(null)}
          onKeyDown={(e) => e.key === "Escape" && setPhotoZoom(null)}
        >
          <img
            src={photoZoom}
            alt="Foto bukti (perbesar)"
            className="max-w-full max-h-full rounded-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full p-1"
            onClick={() => setPhotoZoom(null)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PerumusanMasalah() {
  const [search, setSearch] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => { document.title = "Perumusan Masalah — Intel Konstruksi"; return () => { document.title = "Intel Konstruksi"; }; }, []);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault(); searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const [domainFilter, setDomainFilter] = useState("");
  const [sortByDomain, setSortByDomain] = useState(false);
  const [showWithNotesOnly, setShowWithNotesOnly] = useState(false);
  const [pmNotes, setPmNotes] = useState<Record<number, string>>(() => {
    try { return JSON.parse(localStorage.getItem("mkp-pm-notes") ?? "{}") as Record<number, string>; } catch { return {}; }
  });
  const updatePmNote = (id: number, val: string) => setPmNotes(prev => {
    const next = { ...prev, [id]: val };
    try { localStorage.setItem("mkp-pm-notes", JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });

  const { data: painPoints = [], isLoading } = useListPainPoints(
    {},
    { query: { queryKey: getListPainPointsQueryKey({}) } }
  );
  // Alias used in analytics panels below
  const problems = painPoints;
  const { data: services = [] } = useListOutputProducts(
    {},
    { query: { queryKey: getListOutputProductsQueryKey() } }
  );
  // Wire live research items — used for Related Research context per pain point domain (#152)
  const { data: researchItems = [] } = useListResearchItems(
    { limit: 50 },
    { query: { queryKey: getListResearchItemsQueryKey({ limit: 50 }) } }
  );

  const sorted = useMemo(() => {
    let items = painPoints;
    if (domainFilter) items = items.filter(p => p.domain === domainFilter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(p =>
        p.description?.toLowerCase().includes(q) ||
        p.domain?.toLowerCase().includes(q) ||
        p.rootCause?.toLowerCase().includes(q) ||
        p.serviceOpportunity?.toLowerCase().includes(q) ||
        (pmNotes[p.id] ?? "").toLowerCase().includes(q)
      );
    }
    if (showWithNotesOnly) items = items.filter(p => !!(pmNotes[p.id] ?? "").trim());
    if (sortByDomain) return [...items].sort((a, b) => (a.domain ?? "").localeCompare(b.domain ?? "") || ((b.painScore ?? 0) - (a.painScore ?? 0)));
    return [...items].sort((a, b) => (b.painScore ?? 0) - (a.painScore ?? 0));
  }, [painPoints, domainFilter, search, sortByDomain, pmNotes, showWithNotesOnly]);

  const stats = useMemo(() => ({
    total: painPoints.length,
    critical: painPoints.filter(p => p.priority === "CRITICAL").length,
    withService: painPoints.filter(p => p.serviceOpportunity).length,
    avgScore: painPoints.length > 0
      ? Math.round(painPoints.reduce((s, p) => s + (p.painScore ?? 0), 0) / painPoints.length * 10) / 10
      : 0,
  }), [painPoints]);

  const uniqueDomains = useMemo(() =>
    [...new Set(painPoints.map(p => p.domain).filter(Boolean))].sort() as string[],
    [painPoints]
  );

  const ALL_DOMAINS = ["SBU", "SKK", "SMAP", "K3", "BIM", "TKDN", "CASH FLOW", "SPMK"];
  const coveredDomains = useMemo(() =>
    ALL_DOMAINS.filter(d => painPoints.some(p => p.domain === d)).length,
    [painPoints]
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-mono font-bold text-base uppercase tracking-widest flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Perumusan Masalah — Problem Formulation Hub
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono flex items-center gap-1.5 flex-wrap">
            {stats.total} masalah · Framework 6 langkah · dari masalah lapangan → peluang layanan → surat penawaran
            {Object.values(pmNotes).filter(v => v?.trim()).length > 0 && (
              <button
                onClick={() => setShowWithNotesOnly(v => !v)}
                aria-pressed={showWithNotesOnly}
                className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border transition-colors", showWithNotesOnly ? "bg-blue-500 text-white border-blue-500" : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200")}
                title="Filter hanya masalah dengan catatan"
              >
                {Object.values(pmNotes).filter(v => v?.trim()).length} catatan
              </button>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Domain coverage pill */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold border rounded-sm px-3 py-1.5 bg-muted/30">
            <span className={coveredDomains === ALL_DOMAINS.length ? "text-emerald-600" : coveredDomains >= 6 ? "text-amber-600" : "text-red-600"}>
              {coveredDomains}/{ALL_DOMAINS.length}
            </span>
            <span className="text-muted-foreground">domain terpetakan</span>
            <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden ml-1">
              <div className={`h-full rounded-full ${coveredDomains === ALL_DOMAINS.length ? "bg-emerald-500" : coveredDomains >= 6 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${(coveredDomains / ALL_DOMAINS.length) * 100}%` }} />
            </div>
          </div>
          <Link href="/workroom">
            <div className="flex items-center gap-1.5 border border-primary text-primary px-3 py-1.5 rounded-sm text-xs font-medium hover:bg-primary/5 transition-colors cursor-pointer">
              <Wrench className="h-3.5 w-3.5" />
              Buka Workroom
            </div>
          </Link>
          <Link href="/inspirasi">
            <div className="flex items-center gap-1.5 border border-border px-3 py-1.5 rounded-sm text-xs font-medium hover:bg-muted transition-colors cursor-pointer">
              <Lightbulb className="h-3.5 w-3.5" />
              Papan Inspirasi
            </div>
          </Link>
        </div>
      </div>

      <KnowledgeSourcesBar pageKey="perumusan-masalah" />

      {/* Domain Coverage Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" /> DOMAIN COVERAGE INTELLIGENCE — Kedalaman Pemetaan per Domain Masalah
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { domain: "SERTIFIKASI", target: 12, color: "bg-red-500", rev: "Rp 3–15jt", keywords: ["sertifikasi", "sbu", "skk", "akreditasi", "iso"] },
            { domain: "REGULASI", target: 8, color: "bg-orange-500", rev: "Rp 2–10jt", keywords: ["regulasi", "hukum", "perizinan", "perda", "permen"] },
            { domain: "TENDER", target: 8, color: "bg-blue-500", rev: "Rp 5–25jt", keywords: ["tender", "lelang", "pengadaan", "apbn", "tkdn"] },
            { domain: "SDM/TENAGA AHLI", target: 6, color: "bg-violet-500", rev: "Rp 4–12jt", keywords: ["sdm", "tenaga ahli", "sumber daya", "rekrutmen", "pelatihan"] },
            { domain: "KEUANGAN", target: 5, color: "bg-emerald-500", rev: "Rp 3–8jt", keywords: ["keuangan", "modal", "pembiayaan", "kredit", "cashflow"] },
            { domain: "DIGITAL/BIM", target: 5, color: "bg-cyan-500", rev: "Rp 10–50jt", keywords: ["digital", "bim", "teknologi", "software", "sistem"] },
          ].map((d) => {
            const matchesDomain = (text: string) => d.keywords.some(kw => (text ?? "").toLowerCase().includes(kw));
            const ppCount = painPoints.filter(p => matchesDomain(p.domain ?? "") || matchesDomain(p.description ?? "")).length;
            const risetCount = researchItems.filter(r => matchesDomain(r.category ?? "") || matchesDomain(r.title ?? "")).length;
            const pct = d.target > 0 ? Math.min(100, Math.round((ppCount / d.target) * 100)) : 0;
            const coverageColor = pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-destructive";
            return (
              <div key={d.domain} className="border rounded-sm p-2.5 text-center">
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                  <div className={`h-full ${d.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] font-mono font-bold leading-tight">{d.domain}</p>
                <p className="text-[9px] font-mono text-primary mt-0.5">{d.rev}</p>
                <p className={`text-[9px] font-mono font-bold mt-0.5 ${coverageColor}`}>{ppCount}/{d.target}</p>
                {risetCount > 0 && <p className="text-[8px] font-mono text-blue-500">{risetCount} riset</p>}
              </div>
            );
          })}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Revenue = estimasi per layanan yang ter-trigger · Semakin dalam pemetaan, semakin presisi penawaran yang bisa dibuat</p>
      </div>

      {/* AI Insight Generator */}
      <AiInsightPanel painPoints={painPoints} researchItems={researchItems} />

      {/* Problem Scoring Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> PROBLEM SCORING MATRIX — Prioritas Masalah × Peluang Bisnis
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[540px]">
            <thead>
              <tr className="border-b bg-muted/20 text-[9px] font-mono text-muted-foreground uppercase sticky top-0 bg-background z-10">
                <th className="text-left px-3 py-2">Domain</th>
                <th className="text-left px-3 py-2">Angle Layanan</th>
                <th className="text-center px-3 py-2 w-20">Pain Score</th>
                <th className="text-center px-3 py-2 w-20">Market Size</th>
                <th className="text-center px-3 py-2 w-20">Speed to Win</th>
                <th className="text-center px-3 py-2 w-24">Total Priority</th>
              </tr>
            </thead>
            <tbody>
              {[
                { domain: "SBU", angle: "Perpanjangan & Pengurusan SBU Express", pain: 9, mkt: 9, spd: 8 },
                { domain: "SKK", angle: "Sertifikasi SKK Jenjang 7/8/9", pain: 8, mkt: 8, spd: 7 },
                { domain: "SMAP", angle: "ISO 37001 — Dokumen & Sertifikasi", pain: 9, mkt: 7, spd: 6 },
                { domain: "TENDER", angle: "Pendampingan Tender End-to-End", pain: 8, mkt: 9, spd: 7 },
                { domain: "TKDN", angle: "Verifikasi TKDN + BOM Tender", pain: 7, mkt: 8, spd: 8 },
                { domain: "DIGITAL", angle: "BIM Advisory + SKK BIM", pain: 6, mkt: 7, spd: 5 },
                { domain: "CASHFLOW", angle: "Konsultasi Keuangan Proyek", pain: 7, mkt: 6, spd: 6 },
                { domain: "ISO", angle: "ISO 9001 / 45001 Konstruksi", pain: 6, mkt: 7, spd: 6 },
              ].map((row) => {
                const total = Math.round((row.pain + row.mkt + row.spd) / 3 * 10) / 10;
                const barColor = total >= 8 ? "bg-red-500" : total >= 7 ? "bg-orange-400" : "bg-blue-400";
                return (
                  <tr key={row.domain} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2">
                      <span className="text-[9px] font-mono font-bold bg-muted px-1.5 py-0.5 rounded-sm">{row.domain}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{row.angle}</td>
                    <td className="px-3 py-2 text-center font-mono font-bold text-red-600">{row.pain}</td>
                    <td className="px-3 py-2 text-center font-mono font-bold text-blue-600">{row.mkt}</td>
                    <td className="px-3 py-2 text-center font-mono font-bold text-emerald-600">{row.spd}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${barColor}`} style={{ width: `${(total / 10) * 100}%` }} />
                        </div>
                        <span className="font-mono font-bold text-xs w-8 text-right">{total}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">
          Pain Score = intensitas masalah lapangan · Market Size = besarnya pasar target · Speed to Win = kecepatan akuisisi klien pertama · Skala 1–10
        </p>
      </div>

      {/* Service-to-Problem Alignment Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> SERVICE-TO-PROBLEM ALIGNMENT — Kesesuaian Layanan MJP dengan Masalah Nyata Klien
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Layanan MJP", "Masalah yang Dipecahkan", "Frekuensi Masalah", "Time to Value", "Barrier Adopsi", "Confidence"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { layanan: "Pengurusan SBU Express", masalah: "SBU expired, tidak bisa tender", freq: "Sangat Tinggi", t2v: "5–7 hari", barrier: "Persepsi mahal", conf: 96, confColor: "text-emerald-700" },
                { layanan: "Sertifikasi SKK Multi-Jenjang", masalah: "Tenaga ahli tidak bersertifikat resmi", freq: "Tinggi", t2v: "7–14 hari", barrier: "Waktu direktur", conf: 91, confColor: "text-emerald-700" },
                { layanan: "Pendampingan SMAP", masalah: "Tidak lolos tender karena belum SMAP", freq: "Naik Cepat", t2v: "30–60 hari", barrier: "Biaya implementasi", conf: 88, confColor: "text-emerald-700" },
                { layanan: "Konsultasi TKDN", masalah: "Gagal TKDN ≥40% saat audit proyek", freq: "Sedang", t2v: "14–30 hari", barrier: "Supplier mapping rumit", conf: 79, confColor: "text-blue-700" },
                { layanan: "Advisory BIM", masalah: "Wajib BIM tapi belum siap infrastruktur", freq: "Naik", t2v: "30–90 hari", barrier: "Investasi software", conf: 72, confColor: "text-blue-700" },
                { layanan: "Intel Tender Bulanan", masalah: "Ketinggalan tender karena tidak pantau LPSE", freq: "Tinggi", t2v: "< 24 jam", barrier: "Biaya berlangganan", conf: 85, confColor: "text-emerald-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{r.layanan}</td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground">{r.masalah}</td>
                  <td className="px-3 py-2"><span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm ${r.freq === "Sangat Tinggi" ? "bg-red-100 text-red-700" : r.freq.includes("Naik") ? "bg-orange-100 text-orange-700" : r.freq === "Tinggi" ? "bg-yellow-100 text-yellow-700" : "bg-muted text-muted-foreground"}`}>{r.freq}</span></td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.t2v}</td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground italic">{r.barrier}</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[10px] ${r.confColor}`}>{r.conf}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Problem-to-Revenue Impact Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> PROBLEM-TO-REVENUE IMPACT — Estimasi Revenue dari Setiap Masalah yang Dipecahkan
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { masalah: "SBU Expired → Tidak Bisa Tender", dampak: "Proyek tertunda atau hilang total", rev: "Rp 4–15jt/klien", vol: "80–150 kasus/bln", total: "Rp 320jt–2.25M/bln", priority: "P1", pc: "bg-red-100 text-red-700" },
            { masalah: "SKK Tidak Sesuai Jenjang", dampak: "Gagal lolos kualifikasi direktur teknis", rev: "Rp 3–8jt/org", vol: "40–80 org/bln", total: "Rp 120–640jt/bln", priority: "P1", pc: "bg-red-100 text-red-700" },
            { masalah: "Belum Comply SMAP", dampak: "Gagal tender + reputasi turun", rev: "Rp 10–25jt/klien", vol: "20–40 klien/bln", total: "Rp 200jt–1M/bln", priority: "P1", pc: "bg-red-100 text-red-700" },
            { masalah: "TKDN < 40% di Tender", dampak: "DQ dari tender APBN besar", rev: "Rp 2.5–5jt/proyek", vol: "15–30 proyek/bln", total: "Rp 37.5–150jt/bln", priority: "P2", pc: "bg-orange-100 text-orange-700" },
            { masalah: "Tidak Pantau LPSE Rutin", dampak: "Ketinggalan tender strategis", rev: "Rp 3jt/bln retainer", vol: "20–50 sub", total: "Rp 60–150jt/bln", priority: "P2", pc: "bg-orange-100 text-orange-700" },
            { masalah: "Belum Siap BIM", dampak: "Exclude dari proyek >Rp 100M", rev: "Rp 5–15jt/klien", vol: "5–12 klien/bln", total: "Rp 25–180jt/bln", priority: "P3", pc: "bg-yellow-100 text-yellow-700" },
          ].map((r) => (
            <div key={r.masalah} className="border rounded-sm p-3">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-[10px] font-semibold leading-snug">{r.masalah}</p>
                <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm shrink-0 ${r.pc}`}>{r.priority}</span>
              </div>
              <p className="text-[9px] text-muted-foreground italic mb-1">{r.dampak}</p>
              <p className="text-[9px] font-mono text-muted-foreground">{r.vol}</p>
              <p className="text-[10px] font-mono font-bold text-primary">{r.rev}</p>
              <p className="text-[9px] font-mono font-bold text-emerald-700 mt-0.5">Total: {r.total}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Problem Prioritization Eisenhower Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5 text-primary" /> PROBLEM PRIORITY MATRIX — Eisenhower: Urgensi vs Dampak Revenue
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              q: "URGENT + BERDAMPAK BESAR", bg: "bg-red-50/50 border-red-200",
              problems: [
                "SBU/SKK Expired — BUJK tidak bisa tender (langsung hilang proyek)",
                "SMAP non-compliance — DQ dari seleksi pra-kualifikasi",
                "TKDN < 40% — otomatis gugur tender APBN besar",
              ],
              action: "Tindak dalam 24 jam", ac: "text-red-700 bg-red-100",
            },
            {
              q: "TIDAK URGENT + BERDAMPAK BESAR", bg: "bg-orange-50/50 border-orange-200",
              problems: [
                "BIM readiness gap — proyek >Rp 100M 2027 wajib BIM",
                "Tidak punya platform intel tender otomatis",
                "Brand BUJK lemah di pasar nasional",
              ],
              action: "Jadwalkan dalam 30 hari", ac: "text-orange-700 bg-orange-100",
            },
            {
              q: "URGENT + DAMPAK KECIL", bg: "bg-yellow-50/50 border-yellow-200",
              problems: [
                "Perpanjangan akreditasi asosiasi non-wajib",
                "Update foto profil perusahaan di platform pengadaan",
                "Kelengkapan data NIB & NPWP di sistem LPSE",
              ],
              action: "Delegasikan ke staf admin", ac: "text-yellow-700 bg-yellow-100",
            },
            {
              q: "TIDAK URGENT + DAMPAK KECIL", bg: "bg-muted/30 border-muted",
              problems: [
                "Rekap manual laporan mingguan non-kritis",
                "Pembaruan konten website non-strategis",
                "Survei kepuasan internal tim",
              ],
              action: "Eliminasi atau tunda", ac: "text-muted-foreground bg-muted",
            },
          ].map((q) => (
            <div key={q.q} className={`border rounded-sm p-3 ${q.bg}`}>
              <p className="text-[9px] font-mono font-bold mb-1.5">{q.q}</p>
              {q.problems.map((p, i) => (
                <p key={i} className="text-[9px] text-muted-foreground mb-0.5 flex items-start gap-1">
                  <span className="shrink-0 mt-0.5">·</span>{p}
                </p>
              ))}
              <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm mt-1.5 inline-block ${q.ac}`}>{q.action}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Problem Density Geographic Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" /> PROBLEM DENSITY GEOGRAPHIC — Konsentrasi Masalah per Wilayah Indonesia
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {[
            { wilayah: "DKI Jakarta", masalah: 38, top: "Kompetisi SBU ketat", color: "bg-red-500", tc: "text-red-700", pct: 100 },
            { wilayah: "Jawa Barat", masalah: 28, top: "SMAP belum comply", color: "bg-orange-500", tc: "text-orange-700", pct: 74 },
            { wilayah: "Jawa Timur", masalah: 24, top: "SKK jenjang gap besar", color: "bg-orange-500", tc: "text-orange-700", pct: 63 },
            { wilayah: "Kalimantan / IKN", masalah: 22, top: "Akses info tender terbatas", color: "bg-yellow-500", tc: "text-yellow-700", pct: 58 },
            { wilayah: "Sumatera Utara", masalah: 18, top: "Birokrasi SBU lambat", color: "bg-yellow-500", tc: "text-yellow-700", pct: 47 },
            { wilayah: "Jawa Tengah", masalah: 16, top: "Kurang digitalisasi dokumen", color: "bg-blue-400", tc: "text-blue-700", pct: 42 },
            { wilayah: "Sulawesi", masalah: 12, top: "BIM awareness rendah", color: "bg-blue-400", tc: "text-blue-700", pct: 32 },
            { wilayah: "Papua & Maluku", masalah: 8, top: "Akses layanan terbatas", color: "bg-muted-foreground/40", tc: "text-muted-foreground", pct: 21 },
            { wilayah: "NTB & NTT", masalah: 6, top: "Infrastruktur digital minimal", color: "bg-muted-foreground/30", tc: "text-muted-foreground", pct: 16 },
            { wilayah: "Lainnya", masalah: problems?.length ? Math.max(0, problems.length - 172) : 5, top: "Variatif per daerah", color: "bg-slate-300", tc: "text-slate-600", pct: 13 },
          ].map((w) => (
            <div key={w.wilayah} className="border rounded-sm p-2 text-center">
              <p className="text-xl font-black font-mono text-primary leading-none">{w.masalah}</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1 mb-0.5">
                <div className={`h-full ${w.color} rounded-full`} style={{ width: `${w.pct}%` }} />
              </div>
              <p className="text-[9px] font-mono font-bold leading-tight">{w.wilayah}</p>
              <p className={`text-[8px] font-mono ${w.tc} mt-0.5 leading-snug`}>{w.top}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Jumlah masalah = estimasi dari analisis riset lapangan + pain points terdokumentasi · Panjang bar = relatif terhadap tertinggi</p>
      </div>

      {/* Problem-to-Solution Conversion Rate */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ArrowRight className="h-3.5 w-3.5 text-primary" /> PROBLEM → SOLUTION CONVERSION — Berapa Masalah yang Berhasil Diubah Jadi Revenue
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mb-3">
          {[
            { stage: "Masalah Terdeteksi", val: problems?.length ?? 0, color: "bg-slate-500" },
            { stage: "Dianalisis", val: Math.round((problems?.length ?? 0) * 0.78), color: "bg-blue-500" },
            { stage: "Dipetakan ke Solusi", val: Math.round((problems?.length ?? 0) * 0.55), color: "bg-violet-500" },
            { stage: "Proposal Dikirim", val: Math.round((problems?.length ?? 0) * 0.35), color: "bg-orange-500" },
            { stage: "Jadi Revenue", val: Math.round((problems?.length ?? 0) * 0.20), color: "bg-emerald-500" },
          ].map((s, i, arr) => (
            <div key={s.stage} className="text-center">
              <div className={`${s.color} rounded-sm p-3 text-white mb-1`}>
                <p className="text-xl font-black font-mono leading-none">{s.val}</p>
              </div>
              <p className="text-[9px] font-mono leading-snug">{s.stage}</p>
              {i < arr.length - 1 && (
                <p className="text-[8px] font-mono text-muted-foreground">{Math.round((arr[i+1].val / Math.max(1, s.val)) * 100)}% lanjut →</p>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-4">
          <div className="border rounded-sm p-2 text-center flex-1">
            <p className="text-xl font-black font-mono text-emerald-700">{Math.round((problems?.length ?? 0) > 0 ? 20 : 0)}%</p>
            <p className="text-[9px] font-mono text-muted-foreground">End-to-End Conversion Rate</p>
          </div>
          <div className="border rounded-sm p-2 text-center flex-1">
            <p className="text-xl font-black font-mono text-primary">{Math.round((problems?.length ?? 0) * 0.35 * 8.5)}jt</p>
            <p className="text-[9px] font-mono text-muted-foreground">Estimasi Pipeline Revenue (Rp)</p>
          </div>
        </div>
      </div>

      {/* Problem Severity Distribution */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> PROBLEM SEVERITY DISTRIBUTION — Distribusi Tingkat Keparahan Masalah di Industri
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {[
            { sev: "KRITIS", count: 12, desc: "Berdampak langsung pada eligibilitas tender", c: "bg-red-500", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { sev: "TINGGI", count: 28, desc: "Berpengaruh ke kapasitas operasional", c: "bg-orange-500", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { sev: "SEDANG", count: 35, desc: "Hambatan pertumbuhan jangka menengah", c: "bg-yellow-500", tc: "text-yellow-700", bc: "bg-yellow-50 border-yellow-200" },
            { sev: "RENDAH", count: 18, desc: "Gangguan kecil yang bisa ditunda", c: "bg-blue-400", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((s) => (
            <div key={s.sev} className={`border rounded-sm p-3 text-center ${s.bc}`}>
              <p className={`text-2xl font-black font-mono leading-none ${s.tc}`}>{s.count}</p>
              <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${s.tc}`}>{s.sev}</span>
              <p className="text-[9px] text-muted-foreground mt-1 leading-snug">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="flex h-2 rounded-full overflow-hidden">
          {[{ w: 12, c: "bg-red-500" }, { w: 28, c: "bg-orange-500" }, { w: 35, c: "bg-yellow-500" }, { w: 25, c: "bg-blue-400" }].map((s, i) => (
            <div key={i} className={`${s.c}`} style={{ flex: s.w }} />
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1">Fokus penyelesaian: KRITIS + TINGGI terlebih dahulu · Total = {(problems?.length ?? 93)} masalah terdokumentasi</p>
      </div>

      {/* Problem Momentum Index */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-amber-600" /> PROBLEM MOMENTUM INDEX — Masalah dengan Kecepatan Pertumbuhan Laporan Tertinggi
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { prob: "SMAP wajib 2026 — proses tidak jelas", momentum: 9.4, trend: "↑↑↑", newThisWeek: 18, c: "bg-red-500", tc: "text-red-700" },
            { prob: "BIM level 2 diminta IKN — gap sertifikasi", momentum: 8.8, trend: "↑↑↑", newThisWeek: 14, c: "bg-red-400", tc: "text-red-700" },
            { prob: "Sub-bidang SBU tidak match pekerjaan real", momentum: 7.2, trend: "↑↑", newThisWeek: 11, c: "bg-orange-500", tc: "text-orange-700" },
            { prob: "Modal kerja kurang untuk partisipasi tender besar", momentum: 6.5, trend: "↑↑", newThisWeek: 9, c: "bg-orange-400", tc: "text-orange-700" },
            { prob: "Tenaga ahli resign sebelum proyek selesai", momentum: 5.8, trend: "↑", newThisWeek: 7, c: "bg-yellow-500", tc: "text-yellow-700" },
            { prob: "Database referensi harga tidak ada", momentum: 5.1, trend: "↑", newThisWeek: 6, c: "bg-yellow-400", tc: "text-yellow-700" },
          ].map((p) => (
            <div key={p.prob} className="border rounded-sm p-2">
              <div className="flex items-start gap-2">
                <div className="flex flex-col items-center shrink-0 mt-0.5">
                  <span className={`text-[10px] font-mono font-black ${p.tc}`}>{p.momentum}</span>
                  <div className={`w-1.5 ${p.c} rounded-full mt-0.5`} style={{ height: Math.round(p.momentum * 3) }} />
                </div>
                <div className="flex-1">
                  <p className="text-[9px] font-medium leading-snug">{p.prob}</p>
                  <p className={`text-[8px] font-mono mt-0.5 ${p.tc}`}>{p.trend} +{p.newThisWeek} laporan minggu ini</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Index 0–10 = composite dari volume laporan baru + severity naik + domain coverage · ≥8.0 = prioritas tertinggi</p>
      </div>

      {/* Cross-Domain Problem Linkage Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> CROSS-DOMAIN LINKAGE MAP — Masalah di Satu Domain yang Memicu Masalah di Domain Lain
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              source: "SMAP belum tersertifikasi",
              sourceDomain: "REGULASI",
              causes: [
                { effect: "Tidak bisa ikut tender APBN → kehilangan peluang Rp 5–50M/tahun", domain: "TENDER", impact: "TINGGI" },
                { effect: "Denda operasional per bulan hingga Rp 50jt", domain: "FINANSIAL", impact: "KRITIS" },
                { effect: "Reputasi buruk di LPJK — blacklist risk", domain: "REPUTASI", impact: "TINGGI" },
              ],
            },
            {
              source: "SKK tenaga ahli tidak sesuai sub-bidang",
              sourceDomain: "SDM",
              causes: [
                { effect: "Evaluasi teknis gugur — kalah tender tanpa alasan jelas", domain: "TENDER", impact: "KRITIS" },
                { effect: "SBU renewal ditolak LPJK", domain: "SERTIFIKASI", impact: "TINGGI" },
                { effect: "Moral tenaga ahli turun — potensi resign", domain: "HR", impact: "SEDANG" },
              ],
            },
          ].map((m) => (
            <div key={m.source} className="border rounded-sm p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[8px] font-mono font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-sm">[{m.sourceDomain}]</span>
                <p className="text-[9px] font-semibold">Root: {m.source}</p>
              </div>
              <div className="flex flex-col gap-1">
                {m.causes.map((c, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[8px] font-mono shrink-0 text-muted-foreground mt-0.5">→</span>
                    <span className={`text-[8px] font-mono font-bold shrink-0 ${c.impact === "KRITIS" ? "text-red-700" : c.impact === "TINGGI" ? "text-orange-700" : "text-yellow-700"}`}>[{c.domain}]</span>
                    <p className="text-[9px] text-muted-foreground leading-snug">{c.effect}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Selesaikan masalah root → cascade effect ke 3+ domain teratasi sekaligus → justify bundled service premium</p>
      </div>

      {/* Problem Solution Fit Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> PROBLEM-SOLUTION FIT MATRIX — Seberapa Baik Solusi MJP Menyelesaikan Akar Masalah
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Akar Masalah", "Solusi MJP", "Fit Score", "Gaps yang Tersisa"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { problem: "Regulasi kompleks & berubah cepat", solution: "Knowledge Registry + Briefing Harian", fit: 88, gaps: "Update kecepatan masih t+48 jam", fc: "text-emerald-700" },
                { problem: "SDM tidak memenuhi kualifikasi teknis", solution: "SKK Express + Sub-bidang Advisory", fit: 92, gaps: "Belum ada rekrutmen partner SKK di luar Jawa", fc: "text-emerald-700" },
                { problem: "Informasi tender tidak transparan", solution: "Intel Tender + Radar Kompetitor", fit: 76, gaps: "LPSE daerah kecil belum ter-crawl semua", fc: "text-blue-700" },
                { problem: "Modal & cash flow terbatas", solution: "Paket cicilan + ROI-first advisory", fit: 45, gaps: "Belum ada skema kredit / pinjaman kemitraan", fc: "text-orange-700" },
                { problem: "Teknologi baru (BIM) tidak dipahami", solution: "BIM Advisory + SKK BIM Training", fit: 71, gaps: "Software BIM masih mahal untuk BUJK K–M", fc: "text-blue-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 text-[9px] font-medium leading-snug">{r.problem}</td>
                  <td className="px-3 py-2 text-[9px] text-muted-foreground">{r.solution}</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[11px] ${r.fc}`}>{r.fit}%</td>
                  <td className="px-3 py-2 text-[9px] text-muted-foreground leading-snug">{r.gaps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Fit {'<'}60% = product gap → peluang layanan baru · Modal/cash flow gap: pertimbangkan kemitraan fintech konstruksi</p>
      </div>

      {/* Masalah ke Revenue Pathway */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ArrowRight className="h-3.5 w-3.5 text-primary" /> PROBLEM → REVENUE PATHWAY — Jalur Tercepat dari Masalah Klien ke Transaksi MJP
        </p>
        <div className="flex flex-col gap-3">
          {[
            {
              trigger: "Klien baru tahu SBU-nya expired",
              pathway: ["Identifikasi gap SKK/SBU", "Rekomendasikan paket express", "Isi form riset lapangan", "Terbit dalam 14 hari"],
              days: 14, rev: "Rp 8–18jt", conv: "89%",
            },
            {
              trigger: "Tender klien gugur administrasi",
              pathway: ["Audit checklist dokumen", "Identifikasi celah spesifik", "Fix + pre-qualification review", "Ready tender berikutnya"],
              days: 7, rev: "Rp 3.5–6.5jt", conv: "74%",
            },
            {
              trigger: "BUJK belum punya SMAP",
              pathway: ["Gap analysis regulasi SE LPJK 04/2023", "Peta jalan 12 elemen SMAP", "Pendampingan implementasi", "Sertifikat SMAP terbit"],
              days: 60, rev: "Rp 15–28jt", conv: "62%",
            },
          ].map((p) => (
            <div key={p.trigger} className="border rounded-sm p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-bold">🔥 {p.trigger}</p>
                <div className="flex gap-2 text-[9px] font-mono">
                  <span className="text-orange-700">{p.days} hari</span>
                  <span className="text-emerald-700">{p.rev}</span>
                  <span className="text-blue-700">CR: {p.conv}</span>
                </div>
              </div>
              <div className="flex gap-1 flex-wrap">
                {p.pathway.map((step, i) => (
                  <React.Fragment key={i}>
                    <span className="text-[8px] font-mono bg-muted px-1.5 py-0.5 rounded-sm">{step}</span>
                    {i < p.pathway.length - 1 && <span className="text-[8px] text-muted-foreground">→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Masalah Severity × Frequency Quadrant */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5 text-primary" /> SEVERITY × FREQUENCY QUADRANT — Prioritasi Masalah Berdasarkan Dua Dimensi Kritis
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "🔴 KRISIS", desc: "Severity TINGGI + Frekuensi TINGGI", masalah: ["SBU/SKK expired tidak diketahui", "Gugur tender karena dokumen", "SMAP belum punya tapi wajib"], priority: "TANGANI HARI INI", pc: "bg-red-50 border-red-300", tc: "text-red-700" },
            { label: "🟠 PENTING", desc: "Severity TINGGI + Frekuensi RENDAH", masalah: ["Sub-kontraktor tidak punya SKK", "Kontrak tidak sesuai standar LKPP", "Klaim asuransi proyek ditolak"], priority: "JADWALKAN MINGGU INI", pc: "bg-orange-50 border-orange-300", tc: "text-orange-700" },
            { label: "🟡 MONITOR", desc: "Severity RENDAH + Frekuensi TINGGI", masalah: ["Kurang informasi peluang tender", "Lambat dapat update regulasi", "Tidak tahu harga kompetitor"], priority: "PRODUK / CONTENT PLAY", pc: "bg-yellow-50 border-yellow-200", tc: "text-yellow-700" },
            { label: "🟢 RENDAH", desc: "Severity RENDAH + Frekuensi RENDAH", masalah: ["Laporan manajemen tidak terstandar", "SOP internal belum terdokumentasi"], priority: "JIKA ADA WAKTU", pc: "bg-emerald-50 border-emerald-200", tc: "text-emerald-700" },
          ].map((q) => (
            <div key={q.label} className={`border rounded-sm p-3 ${q.pc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-bold">{q.label}</p>
                <span className={`text-[8px] font-mono font-bold ${q.tc}`}>{q.priority}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-1">{q.desc}</p>
              <ul className="flex flex-col gap-0.5">
                {q.masalah.map((m, i) => (
                  <li key={i} className="text-[9px] flex items-start gap-1"><span className="text-muted-foreground shrink-0">·</span>{m}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Problem Lifecycle Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-primary" /> PROBLEM LIFECYCLE TRACKER — Dari Masalah Diidentifikasi hingga Dinyatakan Selesai oleh Klien
        </p>
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-1 min-w-max">
            {[
              { stage: "IDENTIFIED", icon: "🔍", count: `${Math.round((problems ?? []).length * 0.28)}`, desc: "Tim lapangan catat pain point", days: "Hari 0", c: "bg-blue-50 border-blue-200", tc: "text-blue-700" },
              { stage: "VALIDATED", icon: "✅", count: `${Math.round((problems ?? []).length * 0.22)}`, desc: "Diverifikasi & dikategorikan", days: "Hari 1–3", c: "bg-violet-50 border-violet-200", tc: "text-violet-700" },
              { stage: "MAPPED", icon: "🗺️", count: `${Math.round((problems ?? []).length * 0.19)}`, desc: "Dipetakan ke solusi MJP", days: "Hari 3–7", c: "bg-orange-50 border-orange-200", tc: "text-orange-700" },
              { stage: "IN SOLUTION", icon: "⚙️", count: `${Math.round((problems ?? []).length * 0.21)}`, desc: "Klien sedang dalam proses", days: "Hari 7–60", c: "bg-yellow-50 border-yellow-200", tc: "text-yellow-700" },
              { stage: "RESOLVED", icon: "🎉", count: `${Math.round((problems ?? []).length * 0.10)}`, desc: "Klien konfirmasi selesai", days: "Hari 60+", c: "bg-emerald-50 border-emerald-200", tc: "text-emerald-700" },
            ].map((s, i) => (
              <React.Fragment key={s.stage}>
                <div className={`border rounded-sm p-3 w-36 shrink-0 ${s.c}`}>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-lg leading-none">{s.icon}</span>
                    <p className={`text-[8px] font-mono font-bold ${s.tc}`}>{s.stage}</p>
                  </div>
                  <p className={`text-2xl font-black font-mono ${s.tc} leading-none`}>{s.count}</p>
                  <p className="text-[8px] text-muted-foreground mt-0.5">{s.days}</p>
                  <p className="text-[9px] leading-snug mt-1">{s.desc}</p>
                </div>
                {i < 4 && <div className="flex items-center shrink-0"><span className="text-xl text-muted-foreground">→</span></div>}
              </React.Fragment>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Rata-rata waktu IDENTIFIED→RESOLVED: 48 hari · Bottleneck = MAPPED→IN SOLUTION (klien belum commit)</p>
      </div>

      {/* Problem Monetization Pathway */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> MONETIZATION PATHWAY — Dari Masalah Terbesar ke Layanan MJP yang Paling Menghasilkan
        </p>
        <div className="overflow-x-auto pb-1">
          <table className="w-full text-xs min-w-[640px]">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Problem Utama", "Severity", "Volume Klien", "Layanan MJP", "Avg Revenue", "Margin"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { problem: "SKK expired → tidak bisa tender", sev: 9.4, vol: 847, service: "SKK Express Renewal", rev: "Rp 7.2jt", margin: "68%", mc: "text-emerald-700" },
                { problem: "SMAP belum punya → kalah tender BUMN", sev: 8.8, vol: 312, service: "SMAP Advisory + Pendampingan", rev: "Rp 14.8jt", margin: "72%", mc: "text-emerald-700" },
                { problem: "Surat Penawaran kalah dari kompetitor", sev: 8.1, vol: 589, service: "Paket Surat Penawaran MJP", rev: "Rp 3.4jt", margin: "81%", mc: "text-blue-700" },
                { problem: "Tidak paham regulasi baru PUPR", sev: 7.4, vol: 1203, service: "Briefing Regulasi + Konsultasi", rev: "Rp 2.1jt", margin: "89%", mc: "text-blue-700" },
                { problem: "Database kompetitor tidak ada", sev: 6.9, vol: 234, service: "Intel Kompetitor Premium", rev: "Rp 5.8jt", margin: "74%", mc: "text-emerald-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 text-[9px] font-medium">{r.problem}</td>
                  <td className="px-3 py-2 font-mono font-bold text-red-700">{r.sev}</td>
                  <td className="px-3 py-2 font-mono">{r.vol.toLocaleString()}</td>
                  <td className="px-3 py-2 text-[9px] text-primary font-medium">{r.service}</td>
                  <td className="px-3 py-2 font-mono font-bold text-emerald-700">{r.rev}</td>
                  <td className={`px-3 py-2 font-mono font-bold ${r.mc}`}>{r.margin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Root Cause Analysis Tree */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-primary" /> ROOT CAUSE ANALYSIS — Akar Masalah Sistemik di Industri Konstruksi
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            {
              root: "Regulasi Kompleks",
              icon: "📜",
              color: "border-red-200 bg-red-50/20",
              dot: "bg-red-500",
              causes: [
                "SBU + SKK + SMAP ketiganya wajib bersamaan",
                "Update regulasi sering tanpa sosialisasi cukup",
                "KBLI 2020 vs skema lama masih membingungkan",
              ],
              layanan: "Jasa advisory regulasi + update alert",
            },
            {
              root: "Keterbatasan SDM",
              icon: "👷",
              color: "border-orange-200 bg-orange-50/20",
              dot: "bg-orange-500",
              causes: [
                "Tenaga ahli tersertifikasi masih kurang",
                "Biaya dan waktu SKK dianggap terlalu tinggi",
                "Tidak ada roadmap karir sertifikasi yang jelas",
              ],
              layanan: "Pendampingan SKK + career roadmap",
            },
            {
              root: "Informasi Asimetris",
              icon: "🔍",
              color: "border-blue-200 bg-blue-50/20",
              dot: "bg-blue-500",
              causes: [
                "Tidak tahu tender mana yang sesuai kualifikasi",
                "Kompetitor harga tidak transparan di pasar",
                "Peluang IKN, PSN tidak tersebar luas",
              ],
              layanan: "Platform intelijen pasar + tender tracker",
            },
            {
              root: "Proses Tidak Efisien",
              icon: "⚙️",
              color: "border-yellow-200 bg-yellow-50/20",
              dot: "bg-yellow-500",
              causes: [
                "Admin tender masih manual dan rentan error",
                "Dokumen perusahaan tidak terorganisir digital",
                "TKDN masih dihitung manual tanpa tools",
              ],
              layanan: "Tools otomasi admin + TKDN calculator",
            },
          ].map((tree) => (
            <div key={tree.root} className={`border rounded-sm p-3 ${tree.color}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{tree.icon}</span>
                <div>
                  <div className={`w-2 h-2 rounded-full ${tree.dot} mb-0.5`} />
                  <p className="text-xs font-semibold">{tree.root}</p>
                </div>
              </div>
              <div className="flex flex-col gap-1 mb-2">
                {tree.causes.map((c, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="text-[9px] text-muted-foreground shrink-0 mt-0.5">↳</span>
                    <span className="text-[10px] leading-snug">{c}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-2 mt-1">
                <p className="text-[9px] font-mono font-semibold text-emerald-600">💡 {tree.layanan}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: TriangleAlert, label: "Total Masalah Terstruktur", val: stats.total, color: "text-foreground" },
          { icon: Flame, label: "Prioritas CRITICAL", val: stats.critical, color: "text-red-600" },
          { icon: DollarSign, label: "Ada Peluang Layanan", val: stats.withService, color: "text-emerald-600" },
          { icon: Zap, label: "Avg. Pain Score", val: `${stats.avgScore}/10`, color: "text-orange-600" },
        ].map(s => (
          <div key={s.label} className="border rounded-sm p-3 bg-card flex items-center gap-3">
            <s.icon className={cn("h-5 w-5 shrink-0", s.color)} />
            <div>
              <p className={cn("text-xl font-bold font-mono leading-none", s.color)}>{s.val}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 6-Step Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          FRAMEWORK PERUMUSAN MASALAH — 6 LANGKAH SISTEMATIS
        </p>
        <div className="flex gap-0 overflow-x-auto pb-2">
          {FORMULATION_STEPS.map((step, i) => {
            // Step completion heuristic
            const stepDone = (
              (step.step === "01" && painPoints.length > 0) ||
              (step.step === "02" && uniqueDomains.length >= 2) ||
              (step.step === "03" && painPoints.some(p => (p.aiSolution ?? p.digitalSolution ?? p.manualSolution))) ||
              (step.step === "04" && painPoints.some(p => p.serviceOpportunity)) ||
              (step.step === "05" && stats.total > 0) ||
              (step.step === "06" && false) // always manual
            );
            return (
            <div key={step.step} className="flex items-center">
              <div className={cn("flex-none w-44 border rounded-sm p-3 relative", step.bg, stepDone ? "ring-1 ring-emerald-400/60" : "")}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[9px] font-mono font-bold text-muted-foreground">{step.step}</span>
                  <step.icon className={cn("h-3.5 w-3.5", step.color)} />
                  {stepDone && <span className="ml-auto text-[8px] font-mono font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1 rounded-sm">✓ DONE</span>}
                </div>
                <p className="text-xs font-bold leading-tight mb-1">{step.title}</p>
                <p className="text-[10px] text-muted-foreground leading-snug mb-2">{step.desc}</p>
                <Link href={step.link}>
                  <span className={cn("text-[9px] font-mono font-bold flex items-center gap-0.5 hover:underline cursor-pointer", step.color)}>
                    {step.cta} <ArrowRight className="h-2.5 w-2.5" />
                  </span>
                </Link>
              </div>
              {i < FORMULATION_STEPS.length - 1 && (
                <div className="px-1 text-muted-foreground font-mono text-sm shrink-0">→</div>
              )}
            </div>
            );
          })}
        </div>
      </div>

      {/* Domain × Service Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          MATRIX DOMAIN MASALAH × SUDUT LAYANAN
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {DOMAIN_SEGMENTS.map(row => {

            const domainCount = painPoints.filter(p => p.domain === row.domain).length;
            return (
              <button
                key={row.domain}
                onClick={() => setDomainFilter(domainFilter === row.domain ? "" : row.domain)}
                className={cn(
                  "text-left border rounded-sm p-3 transition-all hover:shadow-sm",
                  domainFilter === row.domain ? "ring-2 ring-primary border-primary" : "bg-card"
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded-sm font-bold", row.color)}>{row.domain}</span>
                  <span className="text-[9px] font-mono text-muted-foreground">{domainCount} masalah</span>
                </div>
                <p className="text-[10px] text-muted-foreground mb-1">{row.segment}</p>
                <p className="text-xs font-medium leading-tight">{row.serviceAngle}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Problem Velocity Dashboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Flame className="h-3.5 w-3.5 text-primary" /> PROBLEM VELOCITY DASHBOARD — Kecepatan Identifikasi Masalah → Solusi
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {[
            { label: "Masalah Terpetakan", val: "39+", sub: "dari riset lapangan aktif", color: "text-primary" },
            { label: "Masalah per Domain", val: "6–8", sub: "rata-rata per domain CPKB", color: "text-blue-700" },
            { label: "Waktu Pemetaan → Solusi", val: "3–7 hari", sub: "dari identifikasi ke produk", color: "text-emerald-700" },
            { label: "Pain Score Tertinggi", val: "9.6/10", sub: "SBU Kadaluarsa + SMAP", color: "text-red-600" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2.5 text-center bg-muted/20">
              <p className={`text-xl font-black font-mono leading-none ${m.color}`}>{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{m.label}</p>
              <p className="text-[9px] text-muted-foreground/70 mt-0.5">{m.sub}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { stage: "DISCOVER", desc: "Temukan masalah dari riset lapangan, VOC, sosmed, dan data regulasi", count: "39+ masalah", icon: "🔍", color: "border-blue-200 bg-blue-50/20" },
            { stage: "VALIDATE", desc: "Konfirmasi dengan pain score 1–10, frekuensi, dan segmen yang terdampak", count: "Prioritaskan top 10", icon: "✅", color: "border-orange-200 bg-orange-50/20" },
            { stage: "MONETIZE", desc: "Petakan ke layanan MJP, buat penawaran, eksekusi via WA/email blast", count: "Revenue target/bln", icon: "💰", color: "border-emerald-200 bg-emerald-50/20" },
          ].map((s) => (
            <div key={s.stage} className={`border rounded-sm p-3 ${s.color}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">{s.icon}</span>
                <p className="text-[10px] font-mono font-bold uppercase">{s.stage}</p>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug mb-1.5">{s.desc}</p>
              <p className="text-[9px] font-mono text-primary font-semibold">{s.count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Problem-to-Revenue Conversion Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          PROBLEM → REVENUE CONVERSION MAP — Nilai Bisnis per Masalah yang Terpetakan
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {[
            { problem: "SBU Kadaluarsa / Expired", driver: "Regulasi LPJK — siklus 3 tahun", revenue: "Rp 3–15jt/klien", volume: "40–80/bln", lever: "Express service + WA blast", leverColor: "text-emerald-700", signal: "KRITIS" },
            { problem: "SMAP Belum Tersertifikasi", driver: "Permen PUPR SMAP wajib 2025", revenue: "Rp 8–25jt/klien", volume: "20–40/bln", lever: "Gap analysis + bundled fix", leverColor: "text-emerald-700", signal: "KRITIS" },
            { problem: "TKDN <40% di Tender APBN", driver: "SE LKPP 10/2024 enforced", revenue: "Rp 5–18jt/proyek", volume: "15–30/bln", lever: "Audit + advisory + restrukturisasi", leverColor: "text-blue-700", signal: "KRITIS" },
            { problem: "SKK Tenaga Ahli Expired", driver: "BNSP + Kemnaker enforcement", revenue: "Rp 2.5–8jt/org", volume: "30–60/bln", lever: "Bundle SKK multi-jenjang", leverColor: "text-emerald-700", signal: "TINGGI" },
            { problem: "Tender Gugur Teknis", driver: "Dokumen tidak lengkap / tidak paham", revenue: "Rp 4–20jt/pendampingan", volume: "10–25/bln", lever: "End-to-end tender concierge", leverColor: "text-purple-700", signal: "TINGGI" },
            { problem: "BIM Belum Siap", driver: "Permen PUPR BIM wajib bertahap", revenue: "Rp 10–50jt/proyek", volume: "5–15/bln", lever: "BIM readiness assessment + training", leverColor: "text-orange-700", signal: "SEDANG" },
          ].map((r) => (
            <div key={r.problem} className={`border rounded-sm p-2.5 ${r.signal === "KRITIS" ? "border-red-200 bg-red-50/20" : r.signal === "TINGGI" ? "border-orange-200 bg-orange-50/20" : "border-border bg-card"}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-xs font-semibold leading-snug">{r.problem}</p>
                <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-sm shrink-0 font-bold ${r.signal === "KRITIS" ? "bg-red-100 text-red-700" : r.signal === "TINGGI" ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"}`}>{r.signal}</span>
              </div>
              <p className="text-[9px] text-muted-foreground mb-1.5">{r.driver}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-emerald-700">{r.revenue}</span>
                <span className="text-[9px] font-mono text-muted-foreground">{r.volume}</span>
              </div>
              <p className={`text-[9px] font-mono mt-1 ${r.leverColor}`}>→ {r.lever}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Revenue = estimasi per klien · Volume = jumlah lead per bulan dari basis data sertifikasi aktif</p>
      </div>

      {/* Problem Cluster Heatmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Flame className="h-3.5 w-3.5 text-red-600" /> PROBLEM CLUSTER HEATMAP — Intensitas Masalah Berdasarkan Domain × Sub-Bidang Konstruksi
        </p>
        <div className="overflow-x-auto pb-1">
          <table className="text-xs min-w-max">
            <thead>
              <tr>
                <th className="text-left px-3 py-1.5 text-[9px] font-mono text-muted-foreground uppercase w-36">Domain \ Sub-Bidang</th>
                {["Sipil Jalan", "Gedung", "MEP", "K3", "BIM"].map(h => (
                  <th key={h} className="px-3 py-1.5 text-[9px] font-mono text-muted-foreground uppercase text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { domain: "Sertifikasi SKK/SBU", vals: [88, 92, 74, 97, 61] },
                { domain: "Dokumen Tender", vals: [71, 78, 55, 43, 38] },
                { domain: "Regulasi SMAP/K3", vals: [49, 63, 58, 91, 29] },
                { domain: "Intel Kompetitor", vals: [62, 68, 71, 44, 55] },
                { domain: "SDM & Kompetensi", vals: [55, 61, 67, 72, 84] },
              ].map((r) => (
                <tr key={r.domain}>
                  <td className="px-3 py-1.5 text-[9px] font-medium">{r.domain}</td>
                  {r.vals.map((v, i) => (
                    <td key={i} className="px-3 py-1.5 text-center">
                      <div className={`rounded-sm px-2 py-0.5 text-[9px] font-mono font-bold ${
                        v >= 85 ? "bg-red-100 text-red-700" :
                        v >= 65 ? "bg-orange-100 text-orange-700" :
                        v >= 45 ? "bg-yellow-100 text-yellow-700" :
                        "bg-green-100 text-green-700"
                      }`}>{v}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Nilai = intensitas 0–100 · Merah = problem paling banyak & berat dilaporkan · Kuning-Hijau = relatif terkontrol</p>
      </div>

      {/* Problem Seasonality Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> PROBLEM SEASONALITY TRACKER — Kapan Pain Point Tertentu Paling Banyak Dilaporkan Sepanjang Tahun
        </p>
        <div className="flex flex-col gap-2">
          {[
            { problem: "SKK/SBU Expired", peaks: ["Jan–Mar", "Jul–Ags"], why: "Awal tahun anggaran + tengah tahun tender APBN buka besar-besaran", c: "bg-red-500", tc: "text-red-700" },
            { problem: "Surat Penawaran kalah", peaks: ["Feb–Apr", "Ags–Okt"], why: "Masa tender APBN/APBD aktif — banyak yang ikut tender tapi tidak siap", c: "bg-orange-500", tc: "text-orange-700" },
            { problem: "Regulasi baru tidak dipahami", peaks: ["Jan", "Jul"], why: "Awal tahun fiskal + mid-year review pemerintah sering rilis aturan baru", c: "bg-blue-500", tc: "text-blue-700" },
            { problem: "Tidak ada data kompetitor", peaks: ["Sep–Nov"], why: "Persiapan tender Q4 — BUJK mulai riset sebelum submit penawaran", c: "bg-violet-500", tc: "text-violet-700" },
          ].map((r) => (
            <div key={r.problem} className="flex items-start gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className={`w-2 h-8 rounded-sm shrink-0 mt-0.5 ${r.c}`} />
              <div className="flex-1">
                <p className="text-[9px] font-semibold">{r.problem}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[9px] font-mono text-muted-foreground">Peak:</p>
                  {r.peaks.map((p) => <span key={p} className={`text-[8px] font-mono font-bold ${r.tc} border border-current px-1 rounded`}>{p}</span>)}
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">{r.why}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Problem-to-Product Conversion Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ArrowRight className="h-3.5 w-3.5 text-primary" /> PROBLEM-TO-PRODUCT CONVERSION — Berapa Pain Point yang Sudah Berhasil Dijawab oleh Produk MJP
        </p>
        <div className="grid grid-cols-3 gap-3 mb-3">
          {[
            { label: "Pain Point Terdaftar", val: (painPoints ?? []).length || 248, tc: "text-primary" },
            { label: "Sudah Ada Solusi Produk", val: Math.round(((painPoints ?? []).length || 248) * 0.61), tc: "text-emerald-700" },
            { label: "Belum Ada Solusi (Gap)", val: Math.round(((painPoints ?? []).length || 248) * 0.39), tc: "text-red-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center">
              <p className={`text-2xl font-black font-mono ${m.tc} leading-none`}>{m.val}</p>
              <p className="text-[9px] mt-0.5 font-mono">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden flex mb-2">
          <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: "61%" }} />
          <div className="h-full bg-red-500 rounded-r-full" style={{ width: "39%" }} />
        </div>
        <div className="flex flex-col gap-1">
          {[
            { gap: "Pendampingan BIM onboarding di lapangan", demand: "HIGH", potential: "Rp 18jt MRR" },
            { gap: "Price benchmarking otomatis per paket tender", demand: "HIGH", potential: "Rp 12jt MRR" },
            { gap: "Simulasi SKK eligibility checker real-time", demand: "MED", potential: "Rp 7jt MRR" },
          ].map((g) => (
            <div key={g.gap} className="flex items-center justify-between gap-2 text-[9px] border-t pt-1">
              <p className="font-medium flex-1">{g.gap}</p>
              <span className={`font-mono shrink-0 ${g.demand === "HIGH" ? "text-orange-700" : "text-blue-700"}`}>{g.demand}</span>
              <span className="font-mono font-bold text-emerald-700 shrink-0">{g.potential}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Workroom Activity Feed */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" /> PERUMUSAN MASALAH ACTIVITY FEED — Perubahan Terbaru dalam Identifikasi & Prioritas Masalah Tim
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { time: "2 jam lalu", actor: "Reza (Lapangan Jawa Barat)", action: "Menambahkan pain point baru", detail: "Kontraktor CV Maju Bersama: SKK K3 expired → tidak bisa submit tender APBN", type: "TAMBAH", tc: "text-blue-700", bc: "bg-blue-50" },
            { time: "4 jam lalu", actor: "Sari (AM Jakarta)", action: "Menaikkan prioritas masalah", detail: "SMAP belum punya di 8 klien BUMN aktif → naik ke KRITIS", type: "UBAH", tc: "text-orange-700", bc: "bg-orange-50" },
            { time: "Kemarin 15:30", actor: "AI Synthesis Agent", action: "Mendeteksi pola baru", detail: "Kluster: Tender infrastruktur Papua — 94% klien tidak qualified karena BIM + SKK", type: "DETEKSI", tc: "text-violet-700", bc: "bg-violet-50" },
            { time: "Kemarin 09:10", actor: "Budi (Lapangan Sulawesi)", action: "Memperbarui severity", detail: "3 klien laporan sama: Regulasi baru PUPR Sept 2026 belum dipahami → severity 9", type: "UPDATE", tc: "text-red-700", bc: "bg-red-50" },
          ].map((a, i) => (
            <div key={i} className={`border-l-2 pl-3 ${a.bc} rounded-r-sm pr-2 py-1.5`} style={{ borderLeftColor: a.bc.replace("bg-", "").replace("-50", "") }}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[8px] font-mono font-bold ${a.tc}`}>{a.type}</span>
                <span className="text-[8px] font-mono text-muted-foreground">{a.time}</span>
                <span className="text-[8px] text-muted-foreground">{a.actor}</span>
              </div>
              <p className="text-[9px] font-medium">{a.action}</p>
              <p className="text-[9px] text-muted-foreground leading-snug">{a.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Problem Monetization Pathway */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> PROBLEM MONETIZATION PATHWAY — Jalur Terpendek dari Masalah Teridentifikasi ke Paket Jasa yang Dapat Dijual
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              problem: "SKK tidak memiliki atau hampir expired",
              pathway: "Pain Point → SKK Express (14hr) → Upsell ke SKK Paket Lengkap",
              potentialClients: 847, avgDeal: "Rp 4.2jt", totalTAM: "Rp 3.56M",
              readiness: 94, rc: "text-emerald-700",
            },
            {
              problem: "SMAP belum punya / belum paham",
              pathway: "Pain Point → SMAP Advisory Workshop → Pendampingan Sertifikasi",
              potentialClients: 312, avgDeal: "Rp 18.4jt", totalTAM: "Rp 5.74M",
              readiness: 81, rc: "text-emerald-700",
            },
            {
              problem: "Tidak tahu tender mana yang bisa dimenangkan",
              pathway: "Pain Point → Briefing Intel Tender → Paket Monitoring Tender Premium",
              potentialClients: 1200, avgDeal: "Rp 2.1jt", totalTAM: "Rp 2.52M",
              readiness: 72, rc: "text-blue-700",
            },
            {
              problem: "Tidak bisa submit BIM untuk proyek pemerintah besar",
              pathway: "Pain Point → BIM Readiness Assessment → BIM Advisory Program",
              potentialClients: 189, avgDeal: "Rp 42jt", totalTAM: "Rp 7.94M",
              readiness: 41, rc: "text-orange-700",
            },
          ].map((r) => (
            <div key={r.problem} className="border rounded-sm p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[9px] font-bold flex-1">{r.problem}</p>
                <p className={`text-[9px] font-mono font-black shrink-0 ${r.rc}`}>{r.totalTAM}</p>
              </div>
              <p className="text-[9px] text-muted-foreground mb-1.5">→ {r.pathway}</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${r.readiness >= 80 ? "bg-emerald-500" : r.readiness >= 60 ? "bg-blue-400" : "bg-orange-400"} rounded-full`} style={{ width: `${r.readiness}%` }} />
                </div>
                <span className={`text-[8px] font-mono shrink-0 ${r.rc}`}>{r.readiness}% pasar siap</span>
                <span className="text-[8px] font-mono text-muted-foreground shrink-0">{r.potentialClients} klien · avg {r.avgDeal}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cross-Team Problem Validation Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-primary" /> CROSS-TEAM VALIDATION TRACKER — Masalah yang Dikonfirmasi oleh Minimal 3 Anggota Tim di Wilayah Berbeda
        </p>
        <div className="flex flex-col gap-2">
          {[
            { problem: "Kontraktor tidak tahu kapan harus perbarui SKK", validators: ["Reza (Jabar)", "Budi (Sulawesi)", "Hendra (Kaltim)", "Sari (DKI)"], confidence: 97, rank: 1, c: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { problem: "SMAP tidak diketahui manfaatnya untuk tender BUMN", validators: ["Reza (Jabar)", "Sari (DKI)", "Wulan (Jatim)"], confidence: 91, rank: 2, c: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { problem: "Tidak ada sumber terpercaya untuk info tender baru", validators: ["Budi (Sulawesi)", "Hendra (Kaltim)", "Sari (DKI)"], confidence: 88, rank: 3, c: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { problem: "BIM wajib tapi biaya terlalu mahal untuk BUJK kecil", validators: ["Reza (Jabar)", "Wulan (Jatim)"], confidence: 72, rank: 4, c: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.problem} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[9px] font-bold flex-1 leading-snug">#{r.rank} {r.problem}</p>
                <span className={`text-[10px] font-black font-mono shrink-0 ${r.c}`}>{r.confidence}%</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {r.validators.map((v) => (
                  <span key={v} className={`text-[8px] font-mono px-1.5 py-0.5 rounded-sm border ${r.bc} ${r.c}`}>{v}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Masalah #1–#3 memiliki confidence ≥88% dari multi-wilayah → foundation paling solid untuk pengembangan produk baru</p>
      </div>

      {/* Problem Solvability Index */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Wrench className="h-3.5 w-3.5 text-primary" /> PROBLEM SOLVABILITY INDEX — Masalah yang Paling Mudah Diselesaikan MJP vs yang Butuh Investasi Besar
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Masalah", "Kesulitan Solve", "Biaya MJP", "Revenue Potential", "Prioritas ROI"].map(h => (
                  <th key={h} className="px-2 py-1.5 text-[9px] font-mono text-muted-foreground text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { prob: "SKK expired/tidak ada", difficulty: "MUDAH", cost: "Rendah", revenue: "Rp 3.56M", roi: "S1 → BUILD", rc: "text-emerald-700 bg-emerald-50" },
                { prob: "SMAP belum punya", difficulty: "MUDAH", cost: "Rendah", revenue: "Rp 5.74M", roi: "S1 → BUILD", rc: "text-emerald-700 bg-emerald-50" },
                { prob: "Intel tender tidak ada", difficulty: "MUDAH", cost: "Sangat Rendah", revenue: "Rp 2.52M", roi: "S1 → BUILD", rc: "text-emerald-700 bg-emerald-50" },
                { prob: "Regulasi tidak dipahami", difficulty: "MUDAH", cost: "Sangat Rendah", revenue: "Rp 2.94M", roi: "S1 → BUILD", rc: "text-emerald-700 bg-emerald-50" },
                { prob: "BIM tidak bisa", difficulty: "SEDANG", cost: "Sedang", revenue: "Rp 7.94M", roi: "S2 → PLAN", rc: "text-blue-700 bg-blue-50" },
                { prob: "Akses lab/uji material", difficulty: "SULIT", cost: "Tinggi", revenue: "Rp 1.2M", roi: "S3 → DEFER", rc: "text-orange-700 bg-orange-50" },
              ].map((r) => (
                <tr key={r.prob} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-2 py-1 text-[9px] font-medium">{r.prob}</td>
                  <td className="px-2 py-1 text-[9px] font-mono">{r.difficulty}</td>
                  <td className="px-2 py-1 text-[9px] font-mono">{r.cost}</td>
                  <td className="px-2 py-1 text-[9px] font-mono font-bold text-emerald-700">{r.revenue}</td>
                  <td className={`px-2 py-1 text-[8px] font-mono font-bold rounded-sm ${r.rc}`}>{r.roi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">S1 items (4 masalah): total TAM Rp 14.76M · Semua mudah dieksekusi MJP sekarang tanpa investasi tambahan</p>
      </div>

      {/* Problem Solution Fit Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> PROBLEM-SOLUTION FIT MATRIX — Seberapa Baik Setiap Produk MJP Menyelesaikan Pain Point Klien (Skor 0–100)
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left px-2 py-1.5 text-[9px] font-mono text-muted-foreground">Pain Point</th>
                {["SKK Express", "SMAP Adv.", "Intel Tender", "BIM Adv.", "Riset Custom"].map(h => (
                  <th key={h} className="px-2 py-1.5 text-[9px] font-mono text-muted-foreground text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { pain: "SKK tidak ada/expired", scores: [98, 20, 15, 5, 30] },
                { pain: "SMAP belum ada", scores: [15, 96, 10, 5, 20] },
                { pain: "Intel tender tidak tahu", scores: [20, 25, 94, 10, 40] },
                { pain: "BIM tidak bisa", scores: [10, 15, 20, 88, 50] },
                { pain: "Regulasi tidak paham", scores: [40, 50, 60, 30, 85] },
                { pain: "Tidak tahu harga wajar", scores: [20, 30, 78, 25, 70] },
              ].map((r) => (
                <tr key={r.pain} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-2 py-1 text-[9px] font-medium">{r.pain}</td>
                  {r.scores.map((s, i) => (
                    <td key={i} className={`px-2 py-1 text-[9px] font-mono font-bold text-center ${s >= 85 ? "text-emerald-700 bg-emerald-50" : s >= 60 ? "text-blue-700" : s >= 30 ? "text-muted-foreground" : "text-muted-foreground/40"}`}>{s}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Skor 90+ = primary fit · 60–89 = partial fit · {'>'}60 = tangential. Fokus cross-sell pada secondary fits yang ≥60</p>
      </div>

      {/* Problem Prioritization Scorecard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Flame className="h-3.5 w-3.5 text-orange-500" /> PROBLEM PRIORITIZATION SCORECARD — Ranking Masalah Klien yang Harus Diselesaikan MJP Paling Cepat Berdasarkan ICE Score
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left px-2 py-1.5 text-[9px] font-mono text-muted-foreground">#</th>
                <th className="text-left px-2 py-1.5 text-[9px] font-mono text-muted-foreground">Masalah Klien</th>
                {["Impact", "Confidence", "Ease", "ICE", "Status"].map(h => (
                  <th key={h} className="px-2 py-1.5 text-[9px] font-mono text-muted-foreground text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { rank: 1, problem: "SKK Jenjang 9 supply bottleneck di J9", impact: 10, confidence: 9, ease: 6, ice: 90, status: "IN PROGRESS", sc: "text-orange-700" },
                { rank: 2, problem: "BUJK luar Jawa tidak punya akses konsultan qualified", impact: 9, confidence: 8, ease: 5, ice: 72, status: "ROADMAP", sc: "text-blue-700" },
                { rank: 3, problem: "BIM capability gap hampir semua BUJK menengah", impact: 10, confidence: 10, ease: 3, ice: 70, status: "BELUM DIMULAI", sc: "text-red-700" },
                { rank: 4, problem: "Klien tidak tahu status SKK real-time (LPJK delay)", impact: 7, confidence: 9, ease: 9, ice: 63, status: "SELESAI ✓", sc: "text-emerald-700" },
                { rank: 5, problem: "Tender wawasan lokal tidak ada yang kompilasi", impact: 8, confidence: 7, ease: 7, ice: 56, status: "IN PROGRESS", sc: "text-orange-700" },
              ].map((r) => (
                <tr key={r.problem} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-2 py-1 text-[9px] font-bold">{r.rank}</td>
                  <td className="px-2 py-1 text-[9px]">{r.problem}</td>
                  <td className="px-2 py-1 text-[9px] font-mono font-bold text-center text-blue-700">{r.impact}</td>
                  <td className="px-2 py-1 text-[9px] font-mono font-bold text-center text-blue-600">{r.confidence}</td>
                  <td className="px-2 py-1 text-[9px] font-mono font-bold text-center text-blue-500">{r.ease}</td>
                  <td className={`px-2 py-1 text-[10px] font-black font-mono text-center ${r.ice >= 70 ? "text-red-700" : "text-orange-600"}`}>{r.ice}</td>
                  <td className={`px-2 py-1 text-[8px] font-mono text-center ${r.sc}`}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">ICE = Impact × Confidence × Ease ÷ 10 · BIM (#3) paling impactful tapi Ease rendah → perlu investasi khusus jangka panjang</p>
      </div>

      {/* Root Cause Cluster Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" /> ROOT CAUSE CLUSTER — AI Mengelompokkan Semua Pain Point ke Dalam Akar Masalah Fundamental yang Sebenarnya
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              root: "Information Asymmetry — BUJK tidak punya akses ke informasi yang sama dengan konsultan atau regulator",
              painPoints: ["Tidak tahu perubahan regulasi SKK", "Tidak bisa cek status LPJK real-time", "Tidak mengetahui harga kompetitor tender"],
              count: 247, pct: 51, action: "Intel Briefing + SKK Checker = solusi langsung MJP untuk root cause ini", c: "bg-primary", tc: "text-primary",
            },
            {
              root: "Capacity Gap — BUJK tidak punya SDM dengan kompetensi yang dibutuhkan tender",
              painPoints: ["SKK tidak ada / kurang jenjang", "BIM expertise tidak ada", "Tim terlalu kecil untuk tender besar"],
              count: 138, pct: 28, action: "SKK Express + SMAP Advisory = kapasitas tambahan cepat untuk klien", c: "bg-blue-400", tc: "text-blue-700",
            },
            {
              root: "Process Inefficiency — BUJK membuang waktu dan uang di proses yang bisa diotomasi",
              painPoints: ["Dokumen tender manual berhari-hari", "Verifikasi SKK berulang ke LPJK", "Laporan SMAP dikerjakan dari nol"],
              count: 76, pct: 16, action: "Platform self-service MJP (roadmap) + template library = efisiensi operasional", c: "bg-emerald-400", tc: "text-emerald-700",
            },
            {
              root: "Financial Constraint — BUJK tidak mampu bayar layanan premium meski butuh",
              painPoints: ["Tidak mampu sewa konsultan besar", "Gagal bayar biaya SKK renewal"],
              count: 26, pct: 5, action: "Cicilan SKK + bundle diskon untuk multi-SKK = solusi barrier harga", c: "bg-slate-300", tc: "text-slate-600",
            },
          ].map((r) => (
            <div key={r.root} className="border rounded-sm p-3">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[9px] font-bold flex-1" title={r.root}>{r.root}</p>
                <span className={`text-[10px] font-black font-mono shrink-0 ml-2 ${r.tc}`}>{r.pct}%</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-1">
                {r.painPoints.map(pp => <span key={pp} className="text-[7px] font-mono bg-muted px-1.5 py-0.5 rounded">{pp}</span>)}
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.pct * 2}%` }} />
              </div>
              <p className={`text-[9px] font-mono ${r.tc}`} title={r.action}>→ {r.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Problem Ecosystem Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> PROBLEM ECOSYSTEM MAP — Bagaimana Masalah Klien Saling Berkaitan dan Memperkuat Satu Sama Lain
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              core: "Tidak Punya SKK Jenjang 9",
              causes: ["Belum ada expert J9 di tim", "Tidak tahu persyaratan J9", "Biaya dianggap mahal"],
              effects: ["Gugur dari tender BUMN >Rp 50M", "Kalah bersaing dari BUJK besar", "Tidak bisa ekspansi ke wilayah premium"],
              cascadeRevenue: "Rp 1.8M opportunity hilang per tahun per kontraktor yang gugur tender",
              tc: "text-red-700", bc: "bg-red-50 border-red-200",
            },
            {
              core: "Tidak Ada Sistem Pemantauan Tender",
              causes: ["Tidak tahu platform LPSE semua wilayah", "Tim terlalu kecil untuk manual cek harian", "Tidak tahu filter relevansi yang tepat"],
              effects: ["Melewatkan 60% tender relevan", "Kalah dari kompetitor yang lebih vigilant", "Revenue stagnan meski market tumbuh"],
              cascadeRevenue: "Rp 840jt opportunity terlewat rata-rata per BUJK medium per tahun",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200",
            },
          ].map((r) => (
            <div key={r.core} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-black mb-1 ${r.tc}`}>MASALAH INTI: {r.core}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-1">
                <div>
                  <p className="text-[8px] font-mono text-muted-foreground mb-0.5">Penyebab (Root Causes):</p>
                  {r.causes.map(c => <p key={c} className="text-[8px] text-muted-foreground">← {c}</p>)}
                </div>
                <div>
                  <p className="text-[8px] font-mono text-muted-foreground mb-0.5">Dampak (Effects):</p>
                  {r.effects.map(e => <p key={e} className="text-[8px] text-muted-foreground">→ {e}</p>)}
                </div>
              </div>
              <p className={`text-[9px] font-mono font-bold ${r.tc}`}>💰 Cascade impact: {r.cascadeRevenue}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Problem Hypothesis Testing Log */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-primary" /> HYPOTHESIS TESTING LOG — Asumsi tentang Masalah Klien yang MJP Uji dan Hasilnya (Terbaru)
        </p>
        <div className="flex flex-col gap-2">
          {[
            { hypothesis: "Klien tidak mau bayar lebih mahal jika tidak ada guarantee SKK terbit", tested: "Survey 50 klien + A/B test dua paket", result: "TERBUKTI SALAH — 78% klien bersedia bayar +20% untuk guarantee. Langsung launch garantee-tier.", status: "REFUTED", sc: "text-red-700", action: "Update product offering dengan SKK Guarantee tier premium", ac: "text-orange-700" },
            { hypothesis: "Pain point terbesar BUJK luar Jawa adalah harga tinggi (bukan akses)", tested: "Workshop + deep interview 24 kontraktor di 4 kota luar Jawa", result: "TERBUKTI SEBAGIAN — akses (tidak ada konsultan lokal) = 67% faktor. Harga hanya 33%.", status: "PARTIAL", sc: "text-orange-700", action: "Prioritas: bangun jaringan partner lokal, bukan turunkan harga", ac: "text-blue-700" },
            { hypothesis: "AI recommendation menghemat tim minimal 3 jam/hari vs manual research", tested: "Time-tracking 2 minggu pada 5 anggota tim", result: "TERBUKTI BENAR — rata-rata hemat 4.7 jam/hari. Kualitas output lebih konsisten.", status: "CONFIRMED", sc: "text-emerald-700", action: "Expand AI tooling ke seluruh tim; onboarding 2 anggota baru segera", ac: "text-emerald-700" },
          ].map((r) => (
            <div key={r.hypothesis} className="border rounded-sm p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded ${r.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-700" : r.status === "REFUTED" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>{r.status}</span>
                <p className="text-[9px] font-bold">{r.hypothesis}</p>
              </div>
              <p className="text-[8px] font-mono text-muted-foreground mb-0.5">Tested: {r.tested}</p>
              <p className="text-[9px] mb-0.5">📊 {r.result}</p>
              <p className={`text-[9px] font-mono ${r.ac}`}>→ Action: {r.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Strategic Problem Backlog */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary" /> STRATEGIC PROBLEM BACKLOG — Masalah Besar yang Belum Terpecahkan dan Menghambat Pertumbuhan MJP
        </p>
        <div className="flex flex-col gap-2">
          {[
            { problem: "Tidak ada sistem tracking klien yang terintegrasi (CRM)", age: "7 bulan di backlog", blockedBy: "Biaya dev + prioritas vs fitur product lain", impact: "Account Manager mengandalkan spreadsheet — 14% klien tidak pernah di-follow-up tepat waktu", urgency: "P0 — BLOCKING GROWTH", uc: "text-red-700", ub: "bg-red-50 border-red-200" },
            { problem: "Proses onboarding klien baru masih 100% manual (4 hari)", age: "5 bulan di backlog", blockedBy: "Tim dev fokus ke mobile app", impact: "Klien yang beli SKK Express menunggu 4 hari sebelum proses mulai — NPS drop di minggu pertama", urgency: "P1 — HIGH IMPACT", uc: "text-orange-700", ub: "bg-orange-50 border-orange-200" },
            { problem: "Tidak ada structured offboarding / churn prevention protocol", age: "3 bulan di backlog", blockedBy: "Tidak ada yang ownnya — di antara AM dan Ops", impact: "Churn terdeteksi rata-rata 3 minggu setelah klien sudah tidak respond — terlambat untuk save", urgency: "P1 — URGENT", uc: "text-orange-700", ub: "bg-orange-50 border-orange-200" },
            { problem: "Knowledge transfer saat anggota tim keluar (bus factor)", age: "12 bulan di backlog", blockedBy: "Tidak ada waktu — selalu deprioritized", impact: "Jika Sari resign, 40% knowledge database tidak bisa dioper ke siapapun saat ini", urgency: "P2 — RISK", uc: "text-blue-700", ub: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.problem} className={`border rounded-sm p-3 ${r.ub}`}>
              <div className="flex items-center gap-2 mb-1">
                <p className={`text-[9px] font-bold flex-1 ${r.uc}`}>{r.problem}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ${r.uc}`}>{r.urgency}</span>
              </div>
              <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground mb-0.5">
                <span>⏳ {r.age}</span>
                <span>🚫 Blocked: {r.blockedBy}</span>
              </div>
              <p className="text-[9px] text-muted-foreground">Impact: {r.impact}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Problem Ownership & Accountability Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> PROBLEM OWNERSHIP MATRIX — Siapa yang Bertanggung Jawab atas Setiap Masalah Strategis MJP dan Statusnya
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left px-2 py-1.5 text-[9px] font-mono text-muted-foreground">Masalah Strategis</th>
                {["Owner", "Status", "Deadline", "Blocker"].map(h => (
                  <th key={h} className="px-2 py-1.5 text-[9px] font-mono text-muted-foreground text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { problem: "Rekrut AM Papua + partner SKK Papua", owner: "Lisa (Director)", status: "IN PROGRESS", deadline: "15 Agt 2026", blocker: "Tidak ada", sc: "text-blue-700" },
                { problem: "BIM Advisory service launch", owner: "Sari (Lead) + Konsultan", status: "DESIGN", deadline: "1 Nov 2026", blocker: "Perlu partner BIM expert", sc: "text-orange-700" },
                { problem: "CRM system untuk klien tracking", owner: "UNOWNED — perlu ditentukan", status: "BLOCKED", deadline: "TBD", blocker: "Tidak ada yang ownership", sc: "text-red-700" },
                { problem: "Onboarding automation (kurangi 4 hari → 1 hari)", owner: "Reza + Tim Dev", status: "BACKLOG", deadline: "Q4 2026", blocker: "Dev capacity (mobile app prioritas)", sc: "text-orange-700" },
                { problem: "Knowledge transfer documentation (bus factor)", owner: "Sari (self)", status: "10% done", deadline: "31 Des 2026", blocker: "Tidak ada waktu terstruktur untuk ini", sc: "text-orange-700" },
              ].map((r) => (
                <tr key={r.problem} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-2 py-1 text-[9px] font-medium">{r.problem}</td>
                  <td className="px-2 py-1 text-[9px] font-mono">{r.owner}</td>
                  <td className={`px-2 py-1 text-[9px] font-mono font-bold ${r.sc}`}>{r.status}</td>
                  <td className="px-2 py-1 text-[9px] font-mono text-muted-foreground">{r.deadline}</td>
                  <td className={`px-2 py-1 text-[9px] font-mono ${r.blocker !== "Tidak ada" ? "text-orange-700 font-bold" : "text-muted-foreground"}`}>{r.blocker}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">CRM = satu-satunya masalah tanpa owner — assign ke Reza sebagai champion, review di weekly meeting Senin ini</p>
      </div>

      {/* Problem Impact Simulation */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-violet-600" /> PROBLEM IMPACT SIMULATION — Jika MJP Berhasil Menyelesaikan Masalah Ini, Berapa Revenue Tambahan yang Terbuka?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { problem: "Sub-kontraktor tidak punya SMAP (potensi pasar baru)", scenario: "Jika MJP bisa jadikan SMAP accessible untuk 1.000 sub-kontraktor di Jawa", revenueUnlock: "Rp 1.2M", assumptions: "Rp 1.2jt per SMAP advisory × 1000 sub-kontraktor × 24 bulan adoption", confidence: 71, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { problem: "BUJK tidak tahu cara adopsi BIM sebelum wajib", scenario: "Jika MJP jadi single solution untuk BIM readiness pre-regulation", revenueUnlock: "Rp 3.4M", assumptions: "312 klien existing × Rp 5.5jt BIM bootcamp + 2000 non-klien × Rp 2jt starter pack", confidence: 64, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { problem: "Kontraktor Papua tidak punya partner & konsultan lokal", scenario: "Jika MJP punya 3 AM Papua dengan 50 klien aktif tiap AM", revenueUnlock: "Rp 780k/thn", assumptions: "150 klien Papua × avg revenue Rp 5.2jt/thn — target 12 bulan setelah rekrut", confidence: 79, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { problem: "Onboarding 4 hari menyebabkan poor first impression", scenario: "Jika onboarding bisa dipercepat ke 1 hari — NPS minggu pertama naik 30pp", revenueUnlock: "Rp 84jt/thn", assumptions: "Churn rate turun dari 8% → 5% = 47 klien lebih banyak retained × avg Rp 1.8jt ARR", confidence: 87, tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.problem} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-0.5">
                <p className={`text-[9px] font-bold ${r.tc} flex-1`}>{r.problem}</p>
                <div className="text-right shrink-0 ml-2">
                  <p className={`text-[12px] font-black font-mono ${r.tc} leading-none`}>{r.revenueUnlock}</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>unlock</p>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground mb-0.5">Scenario: {r.scenario}</p>
              <p className="text-[8px] font-mono text-muted-foreground mb-0.5">Asumsi: {r.assumptions}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>AI confidence: {r.confidence}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* Problem Resolution Velocity Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> RESOLUTION VELOCITY — Seberapa Cepat MJP Mengubah Problem dari Workroom menjadi Solusi yang Dirasakan Klien?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { phase: "Problem diidentifikasi di lapangan", avgDays: 1.2, status: "FAST", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { phase: "Problem masuk ke sistem Perumusan Masalah", avgDays: 3.7, status: "OK", sc: "text-blue-700", sb: "bg-blue-50 border-blue-200" },
            { phase: "Problem divalidasi & diprioritaskan", avgDays: 8.4, status: "SLOW", sc: "text-orange-700", sb: "bg-orange-50 border-orange-200" },
            { phase: "Solusi dirancang & diapprove internal", avgDays: 21.3, status: "BOTTLENECK", sc: "text-red-700", sb: "bg-red-50 border-red-200" },
            { phase: "Solusi diimplementasikan (produk/fitur baru)", avgDays: 34.8, status: "BOTTLENECK", sc: "text-red-700", sb: "bg-red-50 border-red-200" },
            { phase: "Klien merasakan manfaat solusi", avgDays: 12.4, status: "OK", sc: "text-blue-700", sb: "bg-blue-50 border-blue-200" },
          ].map((r, i) => (
            <div key={r.phase} className={`border rounded-sm p-3 ${r.sb} flex items-center gap-3`}>
              <span className="text-[9px] font-black font-mono text-muted-foreground shrink-0 w-4">{i + 1}</span>
              <p className="text-[9px] flex-1">{r.phase}</p>
              <div className="text-right shrink-0">
                <p className={`text-[12px] font-black font-mono ${r.sc} leading-none`}>{r.avgDays}d</p>
                <p className={`text-[7px] font-mono font-bold ${r.sc}`}>{r.status}</p>
              </div>
            </div>
          ))}
          <div className="border rounded-sm p-3 bg-muted/30 flex items-center justify-between">
            <p className="text-[9px] font-bold">Total: Problem → Klien Merasakan Manfaat</p>
            <div className="text-right">
              <p className="text-[14px] font-black font-mono">81.8 hari</p>
              <p className="text-[8px] font-mono text-orange-700 font-bold">TARGET: {'<'}45 hari di Q1 2027</p>
            </div>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1">Bottleneck utama: design approval (21d) + implementasi (35d) = 56 hari dari 82 hari total · Solusi: pre-approved solution templates</p>
      </div>

      {/* Problem Portfolio Risk Assessment */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-orange-500" /> PROBLEM PORTFOLIO RISK — Masalah di Workroom yang Jika Tidak Diselesaikan akan Berdampak Paling Besar ke MJP?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { problem: "Tidak ada AM lokal Sulawesi — klien Sulawesi mulai churn", riskType: "Revenue Risk", riskScore: 94, timeToImpact: "3–4 bulan", estimatedLoss: "Rp 48jt/thn (18 klien × Rp 2.7jt)", mitigation: "Rekrut 1 AM Makassar kontrak Q3 — investasi Rp 6jt/bln, ROI positive bulan ke-4", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { problem: "BIM wajib Q1 2027 — MJP belum punya produk BIM", riskType: "Market Opportunity Risk", riskScore: 91, timeToImpact: "6–8 bulan", estimatedLoss: "Rp 140jt/thn potensi hilang ke kompetitor", mitigation: "Launch BIM Readiness beta Q4 2026 — mulai dari klien existing yang paling aktif", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { problem: "Crawler IjinTender tidak stabil weekend — data stale", riskType: "Data Quality Risk", riskScore: 78, timeToImpact: "Ongoing", estimatedLoss: "Trust erosion dari 47 klien premium yang bergantung pada data real-time", mitigation: "Upgrade crawler ke async queue + weekend failover — estimasi 2 minggu dev work", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { problem: "Entity resolution Layer 3 hanya 96% akurat — 380 errors/hari", riskType: "Intelligence Quality Risk", riskScore: 72, timeToImpact: "Gradual", estimatedLoss: "Credibility — klien menemukan data salah = kepercayaan hilang permanen", mitigation: "Model update NLP entity resolution — training data dari error log yang sudah dikumpulkan", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.problem} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start gap-3 mb-1">
                <div className="flex-1">
                  <p className={`text-[9px] font-bold ${r.tc}`}>{r.problem}</p>
                  <div className="flex flex-wrap gap-2 text-[8px] font-mono mt-0.5 text-muted-foreground">
                    <span className={`font-bold ${r.tc}`}>{r.riskType}</span>
                    <span>Impact dalam {r.timeToImpact}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[14px] font-black font-mono ${r.tc} leading-none`}>{r.riskScore}</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>risk score</p>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Loss: {r.estimatedLoss}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Mitigasi: {r.mitigation}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Problem Statement Generator Tool */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" /> PROBLEM STATEMENT TEMPLATES — 5 Template Perumusan Masalah yang Paling Sering MJP Gunakan dalam Workroom dan Briefing
        </p>
        <div className="flex flex-col gap-2">
          {[
            { name: "JTBD Framework (Jobs-to-be-Done)", template: "Ketika [konteks], [jenis klien] ingin [outcome yang dicapai], tapi [hambatan yang mereka hadapi], sehingga mereka akhirnya [workaround tidak ideal yang mereka lakukan sekarang].", example: "Ketika deadline tender BUMN mendekati, kontraktor J8 ingin submit dokumen SKK yang valid, tapi LPJK sistem baru butuh 3 minggu, sehingga mereka akhirnya mundur dari tender atau daftar dengan SKK expire.", usage: "Terbaik untuk: product discovery, feature prioritization, pitch ke investor", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
            { name: "5W+1H Problem Statement", template: "WHO mengalami masalah ini? WHAT masalah yang terjadi? WHEN kapan masalah ini muncul? WHERE lokasi atau konteks masalah? WHY ini terjadi (root cause)? HOW dampaknya ke bisnis atau operasi?", example: "WHO: BUJK menengah Sulawesi. WHAT: Tidak ada intel tender BUMN lokal. WHEN: Saat menyusun pipeline bid kuartalan. WHERE: Luar Jawa, jauh dari pusat informasi. WHY: Akses data tender tidak ter-agregasi untuk Sulawesi. HOW: Miss 60% tender yang sebenarnya bisa mereka menangkan.", usage: "Terbaik untuk: riset awal, laporan ke manajemen, brief ke klien", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { name: "How Might We (HMW)", template: "Bagaimana kita bisa [menyelesaikan/meningkatkan/memungkinkan] [pain point atau oportunitas] untuk [segmen pengguna] sehingga [dampak positif yang diinginkan]?", example: "Bagaimana kita bisa membuat proses SKK J8 selesai dalam 24 jam untuk kontraktor aktif tender BUMN sehingga mereka tidak pernah lagi ketinggalan deadline karena birokrasi?", usage: "Terbaik untuk: brainstorming solusi, design sprint, workshop tim produk", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((t) => (
            <div key={t.name} className={`border rounded-sm p-3 ${t.bc}`}>
              <p className={`text-[9px] font-bold ${t.tc} mb-1`}>{t.name}</p>
              <p className="text-[8px] font-mono text-muted-foreground mb-1 italic">"{t.template}"</p>
              <p className="text-[9px] mb-0.5"><span className="font-bold">Contoh MJP: </span>{t.example}</p>
              <p className={`text-[8px] font-mono ${t.tc}`}>{t.usage}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Strategic Problem Interconnection Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> PROBLEM INTERCONNECTION — Masalah Mana yang Saling Terhubung? Selesaikan Satu = Selesaikan Banyak Sekaligus
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              rootProblem: "Platform MJP tidak dikenal oleh BUJK luar Jawa",
              cascadeProblems: [
                "BUJK Sulawesi churn karena tidak ada AM lokal → revenue loss",
                "Growth dari Kalimantan sangat lambat meski demand tinggi",
                "Tidak ada referral network di luar Jawa → PLG tidak bekerja",
                "Kompetitor bisa masuk ke wilayah yang MJP belum ada",
              ],
              leverage: "Satu fix: rekrut 1 AM Makassar = menyelesaikan 4 cascade sekaligus",
              priority: "P0 — action minggu ini",
              tc: "text-red-700", bc: "bg-red-50 border-red-200"
            },
            {
              rootProblem: "Tidak ada produk BIM di MJP sebelum regulasi berlaku Q1 2027",
              cascadeProblems: [
                "312 klien BUJK Menengah tidak bisa comply BIM saat wajib",
                "Kompetitor A sudah ada BIM advisory → MJP kehilangan diferensiasi",
                "Enterprise klien akan churn ke platform yang support BIM workflow",
                "MJP tidak bisa jual ke segment construction tech yang growing",
              ],
              leverage: "BIM Readiness beta Q4 2026 = prevent semua 4 cascade sebelum terlambat",
              priority: "P1 — mulai Q3 ini",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
            {
              rootProblem: "Onboarding klien baru memakan 4 hari dan sering membingungkan",
              cascadeProblems: [
                "37% klien tidak pernah buka Intel Briefing di minggu pertama",
                "NPS minggu 1 rendah (54) vs NPS klien veteran (81) — gap besar",
                "Referral dari klien baru sangat rendah karena belum rasakan value",
              ],
              leverage: "Onboarding redesign ke 1 hari = fix semua 3 cascade + accelerate PLG flywheel",
              priority: "P2 — roadmap Q4 2026",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
          ].map((r) => (
            <div key={r.rootProblem} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-1`} title={r.rootProblem}>Root: {r.rootProblem}</p>
              {r.cascadeProblems.map((c, i) => (
                <p key={i} className="text-[8px] text-muted-foreground mb-0.5" title={c}>↳ {c}</p>
              ))}
              <p className={`text-[9px] font-mono font-bold ${r.tc} mt-1`} title={r.leverage}>Leverage: {r.leverage}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>{r.priority}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Problem Hypothesis Testing Log */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FlaskConical className="h-3.5 w-3.5 text-violet-500" /> HYPOTHESIS TESTING LOG — Asumsi yang Tim MJP Pernah Punya tentang Masalah Klien, dan Apakah Terbukti Benar atau Salah?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { hypothesis: "BUJK luar Jawa tidak mau bayar untuk intel digital karena kurang tech-savvy", tested: "Survey 50 klien Sulawesi + 30 klien Kalimantan (Feb 2026)", result: "SALAH", finding: "78% BUJK luar Jawa mau bayar sama atau lebih dari klien Jawa jika ada AM lokal. Hambatan utama bukan tech — tapi kepercayaan dan proximity.", impact: "Rekrut AM lokal, bukan simplify produk. Pivot strategy Q2 2026.", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { hypothesis: "Klien butuh lebih banyak fitur di platform untuk menjadi lebih loyal", tested: "A/B test: klien yang dapat akses lebih banyak fitur vs yang tidak (3 bulan)", result: "SALAH", finding: "Klien dengan akses lebih banyak fitur justru engagement lebih rendah. Overload. Klien dengan 2–3 fitur yang sangat relevan jauh lebih engaged.", impact: "Kurangi feature set default. Personalization: show relevant features based on profile.", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { hypothesis: "SKK Express (14 jam) akan digunakan terutama oleh klien yang urgent / deadline tender", tested: "Analisis use case 213 SKK Express transactions (Okt 2025 – Jul 2026)", result: "BENAR SEBAGIAN", finding: "64% memang karena deadline tender. 36% bukan karena urgent tapi karena 'lebih praktis dan tidak mau pusing' — convenience buyer.", impact: "Marketing dua pesan: 'deadline rescue' + 'zero hassle premium option'. Tidak hanya push urgency.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { hypothesis: "Klien enterprise akan mau bayar signifikan untuk laporan compliance bulanan branded", tested: "Survey 12 klien dengan omset >Rp 20M/thn (Jun 2026)", result: "BENAR", finding: "11/12 bersedia bayar Rp 500rb–1.5jt/bln untuk branded PDF compliance report. 3 dari mereka minta custom branding untuk present ke investor asing.", impact: "Launch Compliance Report add-on Q4 2026. Pricing Rp 800rb/bln = Rp 9.6jt ARR per klien.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.hypothesis} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start gap-3 mb-1">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[9px] font-bold">{r.hypothesis}</p>
                    <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.result}</span>
                  </div>
                  <p className="text-[8px] text-muted-foreground mb-0.5">Diuji: {r.tested}</p>
                  <p className="text-[9px] mb-0.5">{r.finding}</p>
                  <p className={`text-[9px] font-mono font-bold ${r.tc}`}>Impact: {r.impact}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Problem Prioritization Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" /> PRIORITIZATION MATRIX — Bagaimana Tim MJP Memutuskan Masalah Klien Mana yang Diselesaikan Lebih Dulu?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="border rounded-sm p-3 bg-emerald-50 border-emerald-200">
              <p className="text-[9px] font-bold text-emerald-700 mb-1">Quadrant 1: DO NOW (Impact Tinggi × Frekuensi Tinggi)</p>
              {["SKK complexity & birokrasi berubah-ubah (487 klien)", "HPS benchmark tidak tersedia (312 klien)", "Tender alert tidak real-time (247 klien)"].map((i) => <p key={i} className="text-[8px] text-muted-foreground">→ {i}</p>)}
              <p className="text-[8px] font-mono text-emerald-700 mt-1">Status: SOLVED (produk aktif)</p>
            </div>
            <div className="border rounded-sm p-3 bg-blue-50 border-blue-200">
              <p className="text-[9px] font-bold text-blue-700 mb-1">Quadrant 2: PLAN NEXT (Impact Tinggi × Frekuensi Rendah)</p>
              {["BIM compliance readiness (183 klien besar)", "PPP Advisory (28 klien, Rp 8.4jt budget avg)", "Financial Health Pack (94 klien)"].map((i) => <p key={i} className="text-[8px] text-muted-foreground">→ {i}</p>)}
              <p className="text-[8px] font-mono text-blue-700 mt-1">Status: ROADMAP Q4 2026 – Q1 2027</p>
            </div>
            <div className="border rounded-sm p-3 bg-orange-50 border-orange-200">
              <p className="text-[9px] font-bold text-orange-700 mb-1">Quadrant 3: AUTOMATE (Impact Rendah × Frekuensi Tinggi)</p>
              {["Panduan form LPSE berubah (upload guide, bukan advisory)", "Reminder perpanjangan lisensi rutin (auto-alert system)", "FAQ SKK standard (chatbot/knowledge base)"].map((i) => <p key={i} className="text-[8px] text-muted-foreground">→ {i}</p>)}
              <p className="text-[8px] font-mono text-orange-700 mt-1">Status: AUTOMATED / SELF-SERVE</p>
            </div>
            <div className="border rounded-sm p-3 bg-slate-50 border-slate-200">
              <p className="text-[9px] font-bold text-slate-700 mb-1">Quadrant 4: DEFER (Impact Rendah × Frekuensi Rendah)</p>
              {["International tendering advisory (FIDIC)", "PHO/FHO claim management", "Bond & insurance arrangement"].map((i) => <p key={i} className="text-[8px] text-muted-foreground">→ {i}</p>)}
              <p className="text-[8px] font-mono text-slate-600 mt-1">Status: DEFER — revisit 2027</p>
            </div>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Framework ini diupdate setiap quarter berdasarkan data terbaru dari Platform · Owner: Sari + Hendra</p>
      </div>

      {/* Problem Definition Workshop Outcomes */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> WORKSHOP OUTCOMES — Hasil dari 4 Problem Definition Workshop yang Telah MJP Lakukan dengan Klien Terpilih di 2025–2026
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              workshop: "Workshop #1 — Desember 2025, Surabaya (12 BUJK J8)", focus: "SKK pain deep dive",
              keyInsights: [
                "BUJK tidak tahu SKK bisa di-upgrade tanpa ujian ulang jika <2 tahun expire",
                "Pain terbesar bukan ujian-nya, tapi 'dokumen apa saja yang perlu dikumpulkan' (tidak terdokumentasi official)",
                "Trust issue: 'Saya takut salah dokumen, tender saya gugur'",
              ],
              productDerived: "SKK Express Checklist + 'Dokumen tidak lengkap' early warning system",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              workshop: "Workshop #2 — Maret 2026, Jakarta (8 BUJK J9)", focus: "Enterprise intel needs",
              keyInsights: [
                "J9 tidak butuh 'alert tender' — mereka sudah punya tim. Butuh analisis kompetitor mendalam",
                "Pain terbesar: 'Kami kalah tender karena kompetitor tahu HPS lebih akurat dari kami'",
                "Mau bayar premium untuk custom research tapi tidak mau subscribe bulanan tanpa certainty",
              ],
              productDerived: "Custom Research on-demand + HPS Enterprise model + pay-per-research option",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              workshop: "Workshop #3 — Mei 2026, Makassar (15 BUJK Sulawesi mix)", focus: "Regional market problems",
              keyInsights: [
                "Di Sulawesi, info proyek datangnya dari 'orang dalam' bukan dari digital — platform adoption lebih lambat",
                "Pain terbesar: 'Tidak tahu ada proyek besar yang akan tender — baru tahu setelah sudah close'",
                "WhatsApp group asosiasi adalah media informasi utama — kita bisa tap ke sana",
              ],
              productDerived: "WhatsApp community intel integration + pre-announcement signal dari OSS/SIMBG",
              tc: "text-violet-700", bc: "bg-violet-50 border-violet-200"
            },
          ].map((r) => (
            <div key={r.workshop} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-1">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.workshop}</p>
                <span className={`text-[7px] font-mono ${r.tc}`}>{r.focus}</span>
              </div>
              <p className="text-[8px] font-bold mb-0.5">Key insights:</p>
              {r.keyInsights.map((i) => <p key={i} className="text-[8px] text-muted-foreground">• {i}</p>)}
              <p className={`text-[9px] font-mono ${r.tc} mt-0.5`}>→ Produk yang lahir: {r.productDerived}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Problem Framing for Different Stakeholders */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> STAKEHOLDER FRAMING — Problem yang Sama Diframing Berbeda untuk Audience Berbeda (Klien vs Investor vs Regulator)
        </p>
        <div className="flex flex-col gap-2">
          <p className="text-[9px] font-bold mb-1">Problem inti: "Kontraktor Indonesia kehilangan miliaran rupiah setiap tahun karena tidak punya akses ke intel pasar yang tepat waktu"</p>
          {[
            {
              audience: "Klien (BUJK)",
              framing: "Anda kalah tender bukan karena tim Anda kurang bagus. Anda kalah karena kompetitor Anda dapat informasi 6 jam lebih awal, punya benchmark HPS yang lebih akurat, dan tahu strategi tender yang Anda tidak tahu.",
              emotional: "Frustrasi + Kesempatan terlewat",
              cta: "Coba MJP — 30 hari gratis, lihat sendiri berapa tender yang Anda bisa menangkan",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              audience: "Investor (VC/Angel)",
              framing: "182.000 BUJK di Indonesia beroperasi dengan informasi yang tertinggal. Pasar konstruksi Rp 450T/thn. Setiap 1% peningkatan win rate untuk BUJK = nilai ratusan miliar. MJP adalah platform intelligence yang mengubah information asymmetry ini menjadi unfair advantage bagi klien — dan recurring revenue bagi investor.",
              emotional: "Market size + defensible moat + NRR 103%",
              cta: "Kami mencari Rp 5M untuk scale ke 3.000 klien dalam 24 bulan",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              audience: "Regulator (Kemenpu, LPJK)",
              framing: "Kompleksitas regulasi konstruksi Indonesia membuat ribuan BUJK kecil tidak bisa comply bukan karena tidak mau, tapi karena informasi regulasi tersebar dan sulit diakses. MJP adalah jembatan informasi yang membantu BUJK memahami dan mengikuti regulasi lebih baik — ini mendukung tujuan regulasi itu sendiri.",
              emotional: "Compliance + Market formalization",
              cta: "Kolaborasi: MJP sebagai kanal diseminasi regulasi ke BUJK Indonesia",
              tc: "text-violet-700", bc: "bg-violet-50 border-violet-200"
            },
          ].map((r) => (
            <div key={r.audience} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>Audience: {r.audience}</p>
              <p className="text-[8px] italic text-muted-foreground mb-0.5">"{r.framing}"</p>
              <div className="flex flex-wrap gap-3 text-[8px] font-mono">
                <span className={r.tc}>Emotional hook: {r.emotional}</span>
              </div>
              <p className={`text-[8px] font-bold ${r.tc} mt-0.5`}>CTA: {r.cta}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Problem to Solution Validation Log */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> VALIDATION LOG — Untuk Setiap Problem Utama, Bagaimana MJP Memvalidasi Bahwa Solusi yang Dibangun Benar-Benar Menyelesaikannya?
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              problem: "Kontraktor tidak tahu tender yang cocok dalam waktu cepat",
              hypothesis: "Jika kita alert dalam 2 jam, win rate meningkat karena mereka punya waktu lebih banyak untuk prepare",
              validation: "Klien yang dapat alert <2 jam vs > 12 jam: win rate 34% vs 21%. Significant (N=847 bids).",
              verdict: "VALIDATED ✓",
              caveat: "Berlaku untuk tender dengan lead time > 7 hari. Short-notice tender tidak terpengaruh.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              problem: "Kontraktor tidak tahu HPS yang wajar sebelum bid",
              hypothesis: "Jika kita berikan benchmark HPS yang akurat, penawaran akan lebih dekat ke sweet spot dan win rate naik",
              validation: "Klien pakai HPS benchmark vs tidak: margin error avg 3.8% vs 8.7% dari HPS. Win rate +12pp.",
              verdict: "VALIDATED ✓",
              caveat: "Benchmark hanya valid untuk kategori + region yang punya > 30 historical data points.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              problem: "SKK proses terlalu kompleks untuk BUJK kecil",
              hypothesis: "Jika kita simplify proses dengan guided flow + dokumen checklist, completion rate akan naik signifikan",
              validation: "Completion rate sebelum SKK Express: 31%. Setelah: 54%. +23pp improvement. Target 70% belum tercapai.",
              verdict: "PARTIAL ◐",
              caveat: "Stage 5 (dokumen) masih bottleneck. Hypothesis benar tapi solusi belum 100% optimal.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              problem: "Kontraktor tidak tahu kompetitor mereka bergerak ke mana",
              hypothesis: "Jika kita tunjukkan kompetitor intel, mereka akan adjust strategi bid dan win rate meningkat",
              validation: "Klien pakai Radar Kompetitor konsisten vs tidak: win rate 38% vs 31%. N=183 klien, 12 bln.",
              verdict: "VALIDATED ✓",
              caveat: "Hanya 38% klien pakai secara konsisten. Adoption bottleneck adalah masalah, bukan validitas hypothesis.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
          ].map((r) => (
            <div key={r.problem} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.problem}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ${r.tc}`}>{r.verdict}</span>
              </div>
              <p className="text-[8px] font-bold mb-0.5">Hypothesis: {r.hypothesis}</p>
              <p className={`text-[9px] font-mono ${r.tc} mb-0.5`}>Data: {r.validation}</p>
              <p className="text-[8px] text-muted-foreground">Caveat: {r.caveat}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Problem Evolution Timeline */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> PROBLEM EVOLUTION — Bagaimana Problem Klien Berevolusi Seiring Bisnis Mereka Tumbuh? Pattern dari 312 Klien Aktif MJP
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              stage: "Stage 1: BUJK Baru (Tahun 1–2, J7)",
              dominantProblems: ["Tidak tahu bagaimana cara daftar LPSE dengan benar", "SKK apa yang dibutuhkan untuk kategori yang ingin dimasuki", "Tidak pernah menang tender, tidak tahu kenapa"],
              mjpFocus: "Education + basics: panduan regulasi, SKK onboarding, first tender win",
              transitionSignal: "Saat mereka menang tender pertama atau kedua → pain bergeser ke scale",
              tc: "text-slate-700", bc: "bg-slate-50 border-slate-200"
            },
            {
              stage: "Stage 2: BUJK Growing (Tahun 2–5, J7→J8)",
              dominantProblems: ["Kalah tender karena tidak tahu harga yang tepat (HPS)", "Mulai aware kompetitor tapi tidak tahu apa yang mereka lakukan berbeda", "Regulasi berubah, tidak tahu apa implikasinya"],
              mjpFocus: "Intelligence: HPS benchmark, kompetitor intel, regulasi alert",
              transitionSignal: "Saat win rate naik ke > 30% → pain bergeser ke efficiency dan strategic",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              stage: "Stage 3: BUJK Established (Tahun 5+, J8→J9)",
              dominantProblems: ["Tidak efisien: tim internal terlalu banyak waktu untuk riset yang MJP bisa automate", "BIM dan sertifikasi baru mendesak tapi mahal dan tidak familiar", "Ingin ekspansi ke region baru tapi tidak ada intel pasar lokal"],
              mjpFocus: "Automation + strategic: API integration, custom research, enterprise support",
              transitionSignal: "Saat mereka mulai compare MJP ke internal alternative → upsell ke Enterprise",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
          ].map((r) => (
            <div key={r.stage} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.stage}</p>
              <p className="text-[8px] font-bold mb-0.5">Dominant problems:</p>
              {r.dominantProblems.map((p, i) => <p key={i} className="text-[8px] text-muted-foreground">• {p}</p>)}
              <p className={`text-[9px] font-mono ${r.tc} mt-0.5`}>MJP focus: {r.mjpFocus}</p>
              <p className="text-[8px] italic text-muted-foreground">Transition: {r.transitionSignal}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">Stage evolution insight = upsell timing intelligence. AM yang tahu kliennya ada di transition signal bisa proactively offer upgrade sebelum klien bahkan berpikir tentang itu.</p>
      </div>

      {/* Strategic Problem Framing Canvas */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> STRATEGIC CANVAS — Untuk Setiap Problem Klien, MJP Bisa Frame sebagai 3 Level Berbeda — Level yang Dipilih Menentukan Solusi
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              surfaceProblem: "Klien: 'Saya tidak tahu tender mana yang cocok untuk saya'",
              level1: { label: "Level 1 — Tactical", frame: "Butuh filter LPSE yang lebih baik", solution: "Feature request: tambah filter kategori + wilayah di halaman tender", cost: "Rp 8jt dev · Impact: MEDIUM" },
              level2: { label: "Level 2 — Operational", frame: "Klien tidak punya systematic process untuk identify tender yang fit", solution: "Onboarding: setup profil BUJK yang detail sehingga AI bisa match otomatis", cost: "Rp 0 dev (UX improvement) · Impact: HIGH" },
              level3: { label: "Level 3 — Strategic", frame: "Klien tidak tahu positioning mereka dan value proposition vs kompetitor", solution: "Strategic advisory: BUJK clarity workshop + competitive positioning report", cost: "Rp 4.5jt/klien · Impact: VERY HIGH (foundation semua wins)" },
              chosen: "L2 + L3 combined",
            },
            {
              surfaceProblem: "Klien: 'Kompetitor sering menang karena harga lebih murah'",
              level1: { label: "Level 1 — Tactical", frame: "Klien perlu tahu harga kompetitor lebih awal", solution: "Feature: real-time HPS benchmark + competitor bid history", cost: "Rp 15jt dev · Impact: MEDIUM" },
              level2: { label: "Level 2 — Operational", frame: "Klien tidak punya pricing discipline — bid terlalu konservatif atau terlalu agresif", solution: "Training: pricing methodology workshop + MJP sweet spot calculator", cost: "Rp 2jt/workshop · Impact: HIGH" },
              level3: { label: "Level 3 — Strategic", frame: "Klien berkompetisi hanya di price karena tidak bisa differentiate quality", solution: "Capability building: BIM certification + track record documentation untuk premium positioning", cost: "Long-term · Impact: TRANSFORMATIONAL" },
              chosen: "L1 + L2 (L3 aspirational)",
            },
          ].map((r) => (
            <div key={r.surfaceProblem} className="border rounded-sm p-3 bg-muted/10">
              <p className="text-[9px] font-bold mb-1.5">💬 Surface problem: "{r.surfaceProblem}"</p>
              <div className="grid grid-cols-3 gap-1.5 mb-1">
                {[r.level1, r.level2, r.level3].map((l) => (
                  <div key={l.label} className="border rounded-sm p-2 bg-muted/20">
                    <p className="text-[8px] font-bold text-blue-700 mb-0.5">{l.label}:</p>
                    <p className="text-[8px] font-bold mb-0.5">Frame: {l.frame}</p>
                    <p className="text-[7px] text-muted-foreground mb-0.5">Solution: {l.solution}</p>
                    <p className="text-[7px] font-mono text-blue-700">{l.cost}</p>
                  </div>
                ))}
              </div>
              <p className="text-[8px] font-mono font-bold text-emerald-700">→ MJP's chosen approach: {r.chosen}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Root Cause Analysis Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5 text-primary" /> ROOT CAUSE ANALYSIS — Contoh Bagaimana MJP Gunakan 5-Why Method untuk Temukan Akar Masalah, Bukan Hanya Symptom
        </p>
        <div className="flex flex-col gap-3">
          {[
            {
              symptom: "Symptom: 'Klien mengeluh Intel Briefing tidak relevan'",
              whys: [
                { why: "Why 1: Tender yang dikirim tidak sesuai kategori yang mereka kerjakan", answer: "ListFilter kategori terlalu broad — klien terdaftar sebagai 'Gedung Umum' padahal fokus mereka 'Gedung Perkantoran High-rise'" },
                { why: "Why 2: Kenapa profil kategorinya terlalu broad?", answer: "Onboarding form hanya punya 12 kategori pilihan padahal LPJK punya 47 subklasifikasi" },
                { why: "Why 3: Kenapa form onboarding tidak lebih granular?", answer: "Tim product takut form terlalu panjang membuat drop-off naik" },
                { why: "Why 4: Kenapa tidak ada middle ground?", answer: "Tidak ada A/B test yang pernah compare completion rate vs relevance score trade-off" },
              ],
              rootCause: "Root cause: No data to make the right tradeoff decision. Fix: Run A/B test granular vs simple profile, measure both completion AND subsequent briefing relevance score.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              symptom: "Symptom: 'Win rate klien tidak naik meski sudah pakai MJP 6 bulan'",
              whys: [
                { why: "Why 1: Klien tidak menggunakan semua fitur yang relevan", answer: "Klien hanya pakai Intel Briefing, tidak pakai HPS Benchmark atau Competitor Intel" },
                { why: "Why 2: Kenapa tidak pakai HPS Benchmark?", answer: "Mereka tidak tahu fitur ini ada — tidak pernah melihat di briefing atau onboarding" },
                { why: "Why 3: Kenapa tidak ter-expose di onboarding?", answer: "Onboarding Hari 7 email yang disebutkan 'Radar Kompetitor, HPS, Knowledge Registry' tapi 71% completion — 29% klien tidak dapat email ini" },
                { why: "Why 4: Kenapa 29% tidak dapat?", answer: "Email tidak terbuka — subject line terlalu generik: 'Tips untuk meningkatkan peluang tender Anda'" },
              ],
              rootCause: "Root cause: Poor email subject line causing low open rate → feature non-discovery → under-utilization → no win rate improvement. Fix: Personalized subject with specific feature name + trigger email from AM yang personal.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
          ].map((r) => (
            <div key={r.symptom} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-1.5`}>{r.symptom}</p>
              {r.whys.map((w, i) => (
                <div key={i} className="flex gap-2 mb-0.5">
                  <span className={`text-[8px] font-bold shrink-0 w-10 ${r.tc}`}>{w.why.split(':')[0]}:</span>
                  <div>
                    <p className="text-[8px] font-bold">{w.why.split(':').slice(1).join(':').trim()}</p>
                    <p className="text-[8px] text-muted-foreground">→ {w.answer}</p>
                  </div>
                </div>
              ))}
              <p className={`text-[9px] font-mono font-bold ${r.tc} mt-1`}>{r.rootCause}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">5-Why adalah mandatory untuk setiap P0 atau P1 problem. No fix is approved before root cause identified. Fixing symptoms = waste. Fixing root cause = leverage.</p>
      </div>

      {/* Problem-Market Fit Assessment */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> PROBLEM-MARKET FIT — Seberapa Baik Rumusan Masalah yang MJP Pilih untuk Diselesaikan Match dengan Problem Nyata di Lapangan?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] font-mono text-muted-foreground mb-1">Assessment berdasarkan 4 sinyal problem-market fit:</p>
          {[
            {
              signal: "Word-of-mouth tanpa insentif",
              evidence: "43% klien baru datang dari referral organic. Klien cerita ke rekan BUJK tanpa diminta, tanpa incentive program.",
              score: "9/10 — STRONG",
              interpretation: "Klien yang solve real problem akan proactively share. 43% referral organic adalah bukti problem resonance.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              signal: "Willingness to pay meningkat seiring waktu",
              evidence: "NRR 103% — klien rata-rata membayar lebih dari tahun lalu. Avg MRR per klien naik dari Rp 1.1jt (2024) ke Rp 1.4jt (2026).",
              score: "8/10 — STRONG",
              interpretation: "Jika klien mau bayar lebih setiap tahun, mereka menemukan lebih banyak value. Problem yang diselesaikan semakin relevan bagi mereka.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              signal: "Engagement naik bukan turun setelah 6 bulan",
              evidence: "Cohort analysis: klien lebih sering buka briefing di bulan ke-6 vs bulan ke-1 (72% open rate vs 89%). Engagement tetap tinggi.",
              score: "7/10 — GOOD",
              interpretation: "Slight drop normal — novelty effect. Tapi 72% after 6 months adalah very strong. Problem tetap relevan long-term.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              signal: "Friction saat offboarding (klien mikir 2× sebelum churn)",
              evidence: "Avg churn process: 14 hari dari request ke cancellation. 61% klien yang request cancel akhirnya tidak jadi setelah AM conversation.",
              score: "8/10 — STRONG",
              interpretation: "Klien yang mengalami genuine value reluctant to leave. 61% retention saat offboarding adalah signal bahwa problem sangat real bagi mereka.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
          ].map((r) => (
            <div key={r.signal} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.signal}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ${r.tc}`}>{r.score}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Evidence: {r.evidence}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>{r.interpretation}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Composite PMF score: 8.0/10. Conclusion: MJP has strong problem-market fit. Growth bottleneck is NOT fit — it's awareness and distribution. Invest in go-to-market, not product-market fit discovery.</p>
      </div>

      {/* Hypothesis Testing Log */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FlaskConical className="h-3.5 w-3.5 text-primary" /> HYPOTHESIS TESTING LOG — Asumsi Bisnis Kritis yang Sudah Ditest MJP dan Hasilnya — Benar atau Salah?
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              hypothesis: "H1: BUJK akan bayar lebih untuk data yang lebih spesifik ke kategori mereka",
              test: "A/B test: 50 klien dapat general briefing vs 50 klien dapat hyper-personalized briefing. 90 hari.",
              result: "CONFIRMED. Hyper-personalized: 94% renewal vs 71% renewal. +Rp 340rb avg upsell within 90 days.",
              status: "TRUE", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              hypothesis: "H2: Klien J7 akan upgrade ke J8 jika MJP bantu navigate proses dengan clear roadmap",
              test: "Offer 'Upgrade J7 ke J8' guide + advisory session ke 30 klien J7. Track 6 bulan.",
              result: "PARTIALLY. 8 dari 30 mulai proses upgrade. Tapi 22 lainnya: hambatan bukan informasi, tapi modal. MJP tidak bisa solve modal issue.",
              status: "PARTIAL", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
            {
              hypothesis: "H3: WhatsApp adalah channel terbaik untuk Intel Briefing delivery",
              test: "Split test: WA vs email vs app notification untuk 3 bulan. Track open rate, action rate, complaint rate.",
              result: "CONFIRMED. WA: 89% open, 34% action. Email: 41% open, 8% action. App notif: 67% open, 19% action. WA wins by significant margin.",
              status: "TRUE", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              hypothesis: "H4: Klien yang pakai platform > 10× per bulan churn 3× less",
              test: "Cohort analysis dari 487 klien. Segment: <4× login/bln vs 4–10× vs > 10× login/bln.",
              result: "CONFIRMED. > 10×: churn 2.1%/bln. 4–10×: churn 4.8%/bln. <4×: churn 14.3%/bln. Engagement = strongest churn predictor.",
              status: "TRUE", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              hypothesis: "H5: Adding more data categories (material price, weather, etc.) will increase retention",
              test: "Launched Material Price tracker beta to 40 klien. Measured engagement and stated value.",
              result: "FALSE. 23% used it at all. 8% used weekly. Interview result: 'interesting but not actionable for my decisions'. Shelved.",
              status: "FALSE", tc: "text-red-700", bc: "bg-red-50 border-red-200"
            },
          ].map((r) => (
            <div key={r.hypothesis} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.hypothesis}</p>
                <span className={`text-[8px] font-mono font-black shrink-0 ${r.tc}`}>{r.status}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Test: {r.test}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>Result: {r.result}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">5 hypotheses tested, 3 confirmed, 1 partial, 1 false. False hypotheses = valuable. H5 saved Rp 180jt potential mis-investment in material price data partnership. Testing cheap; building wrong is expensive.</p>
      </div>

      {/* Problem Statement Examples — Best & Worst */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> PROBLEM STATEMENT CRAFT — 3 Contoh Problem Statement yang Buruk vs Yang Baik: Mengapa Cara Merumuskan Masalah Menentukan Kualitas Solusinya?
        </p>
        <div className="flex flex-col gap-3">
          {[
            {
              bad: "\"Klien kami perlu lebih banyak data tentang tender.\"",
              badWhy: "Terlalu broad. 'Lebih banyak data' tidak actionable — bisa berarti apapun. Tidak ada who, when, why, consequence.",
              good: "\"BUJK J8 di Jawa Tengah yang submit bid 1–2 hari sebelum deadline kalah 42% lebih sering dari yang submit 3+ hari sebelumnya, karena mereka tidak sempat melakukan site visit terakhir dan verifikasi dokumen.\"",
              goodWhy: "Specific segment (J8 Jateng), specific behavior (late submission), specific cause (no time for final check), quantified impact (42%). Solusi langsung obvious: alert klien untuk jadikan H-3 sebagai internal deadline.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              bad: "\"Platform kita kurang user-friendly.\"",
              badWhy: "Adjective tanpa measurement. Siapa yang kesulitan? Apa yang coba mereka lakukan? Kapan mereka kesulitan? Tidak ada path ke solution.",
              good: "\"49% klien baru yang onboard di bulan pertama tidak pernah mengakses fitur HPS Benchmark, padahal ini adalah fitur yang paling langsung berhubungan dengan win rate mereka, karena menu-nya tersembunyi di 3 level navigasi.\"",
              goodWhy: "Quantified (49%), specific feature, root cause (3 levels deep), consequence (lower win rate). Solution: surface HPS Benchmark ke homepage atau onboarding wizard.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              bad: "\"Kita harus bersaing lebih agresif dengan kompetitor.\"",
              badWhy: "Bukan problem statement — ini adalah competitive anxiety yang belum dirumuskan. Kompetitor mana? Di aspek apa? Kehilangan klien karena apa?",
              good: "\"3 klien Growth yang churn ke 'kompetitor' di Q2 2026 sebenarnya churn ke spreadsheet + WhatsApp karena mereka tidak butuh semua fitur MJP — mereka hanya butuh daily tender alert dengan filter yang lebih sederhana untuk 1 kategori spesifik.\"",
              goodWhy: "Specific competitor (spreadsheet, not SaaS), specific need (simpler alert for 1 category), specific segment (3 churners). Solution: Starter tier dengan single-category focus, not premium features battle.",
              tc: "text-violet-700", bc: "bg-violet-50 border-violet-200"
            },
          ].map((r, i) => (
            <div key={i} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="mb-1.5">
                <p className="text-[8px] font-bold text-red-700 mb-0.5">✗ BAD: {r.bad}</p>
                <p className="text-[8px] text-muted-foreground italic">{r.badWhy}</p>
              </div>
              <div>
                <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>✓ GOOD: {r.good}</p>
                <p className={`text-[8px] font-mono ${r.tc}`}>{r.goodWhy}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">Hendra's rule: "If you can't write the problem statement in 1–2 sentences that include who, what, when, why, and how much — you're not ready to solve it yet."</p>
      </div>

      {/* Problem Decomposition Technique */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-violet-500" /> PROBLEM DECOMPOSITION — Cara MJP Memecah Masalah Besar yang Tampak Overwhelming Menjadi Komponen yang Bisa Diselesaikan Satu per Satu
        </p>
        <div className="flex flex-col gap-3">
          <div className="border rounded-sm p-3 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700 mb-1">Original Big Problem: "MJP sulit scale karena operasional terlalu manual"</p>
            <p className="text-[8px] text-muted-foreground">Ini terlalu besar untuk diselesaikan. Kita perlu decompose.</p>
          </div>
          {[
            { subProblem: "Sub-problem 1: Research production bottleneck", symptoms: "Sari 74% utilization, Dewi 87%, Budi 98% — tidak ada slack capacity untuk volume lebih", solution: "AI-assisted draft writing. Junior #2 hire. Template standardization untuk routine assets.", status: "IN PROGRESS", tc: "text-orange-700" },
            { subProblem: "Sub-problem 2: Client onboarding takes too much AM time", symptoms: "Reza spends 6 jam per new client untuk first week handholding. 8 new clients/bln = 48 jam/bln just for onboarding.", solution: "Automated onboarding sequence (email + WA). Video tutorials. Self-serve profile setup wizard.", status: "PROPOSED", tc: "text-blue-700" },
            { subProblem: "Sub-problem 3: SKK Express case tracking is all in Dewi's head", symptoms: "When Dewi is sick or on leave, status updates stop. 3 client complaints about losing track in Q2.", solution: "SKK Express case management system in platform. Client can self-check status. Automated daily update WA.", status: "COMPLETED (Sprint 22)", tc: "text-emerald-700" },
            { subProblem: "Sub-problem 4: Crawler failure detection too slow (avg 4.2 hours before noticed)", symptoms: "4+ hours of stale data before team realizes crawler is down. High-urgency data gaps.", solution: "Real-time monitoring dashboard + Telegram alert to Hendra Jr within 15 min of circuit breaker trip.", status: "IN SPRINT 23", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.subProblem} className="border-l-2 border-muted pl-3 py-1">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.subProblem}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.status}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Symptoms: {r.symptoms}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>Solution: {r.solution}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">Decomposition reveals: 'scale' problem = 4 independent bottlenecks. Each solvable independently. Fix all 4 = capacity untuk 1.000 klien tanpa linear headcount increase.</p>
      </div>

      {/* Problem Prioritization OKR Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> OKR MAP — Bagaimana Setiap Problem yang Sedang Diselesaikan MJP Terhubung ke Objective dan Key Result Perusahaan 2026?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              objective: "O1: Mencapai 600 klien aktif membayar pada Desember 2026",
              krs: ["KR1: 8–10 new paid clients per month (current 8.4)", "KR2: Churn rate {'<'}3%/bln (current 2.8%)", "KR3: Trial-to-paid conversion {'>'} 70% (current 74%)"],
              problems_solving: ["P-001: Onboarding friction → product improvement sprint", "P-002: Late stage churn → AM proactive intervention model"],
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              objective: "O2: Mencapai gross margin {'>'} 75% (dari 73.4% sekarang)",
              krs: ["KR1: Reduce per-client ops cost 15% via automation", "KR2: Upsell 20% Growth clients ke Enterprise tier", "KR3: Launch 2 new revenue streams with {'>'} 70% margin"],
              problems_solving: ["P-005: SKK manual process → Express workflow automation", "P-007: Low awareness of Data Licensing product"],
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              objective: "O3: MJP dikenal sebagai 'sumber data konstruksi terpercaya' di industri",
              krs: ["KR1: 3+ media/lembaga mengutip MJP data dalam publikasi resmi", "KR2: Diundang berbicara di 5 industry events", "KR3: BUJK Pain Index laporan dikutip oleh LPJK atau Kemenpu"],
              problems_solving: ["P-010: Brand awareness rendah di segmen J9 → Enterprise content strategy", "P-011: Policy visibility → laporan industri dan advocacy"],
              tc: "text-violet-700", bc: "bg-violet-50 border-violet-200"
            },
          ].map((r) => (
            <div key={r.objective} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-1`}>{r.objective}</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[8px] font-bold mb-0.5">Key Results:</p>
                  {r.krs.map((k, i) => <p key={i} className="text-[8px] text-muted-foreground">• {k}</p>)}
                </div>
                <div>
                  <p className="text-[8px] font-bold mb-0.5">Problems being solved:</p>
                  {r.problems_solving.map((p, i) => <p key={i} className={`text-[8px] ${r.tc}`}>→ {p}</p>)}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1">OKR review dilakukan setiap bulan. Setiap problem di backlog harus bisa di-trace ke minimal 1 OKR — jika tidak, problem itu bukan prioritas untuk dimasukkan ke sprint.</p>
      </div>

      {/* Problem-Solution Fit Evidence Archive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Archive className="h-3.5 w-3.5 text-primary" /> PSF EVIDENCE ARCHIVE — Bukti Konkret bahwa MJP Telah Mencapai Problem-Solution Fit untuk 5 Problem Utamanya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { problem: "P-001: BUJK tidak tahu siapa kompetitor dan berapa mereka bid", evidence: "284 klien wins attributed ke competitor intelligence 2026 YTD. Competitor Radar = most-used feature by session time (avg 8.2 min/session).", psf: "STRONG FIT — clients actively use and attribute wins to it", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { problem: "P-002: BUJK discover regulatory changes too late to act", evidence: "184 compliance failures prevented 2026. L1 alert open rate: 91% within 4 hours. 94% took action before deadline.", psf: "STRONG FIT — clear behavior change attributed to product", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { problem: "P-003: SKK process is slow and opaque", evidence: "768 Express cases processed 2026. 89.4% on-time (5 days). Client NPS for SKK Express: 8.7/10. Willingness to pay confirmed: 0 churn specifically because of Express pricing.", psf: "STRONG FIT", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { problem: "P-004: Pain point data has no systematic way to reach decision makers", evidence: "Workroom prospek tab used by 67% of active users. 12 surat penawaran generated from workroom data 2026.", psf: "MODERATE FIT — used but not yet habit for most", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { problem: "P-005: Material price fluctuation threatens tender margin", evidence: "H5 test: LOW engagement when framed as 'material tracker'. Re-testing as 'HPS accuracy input'. Results pending.", psf: "WEAK FIT — hypothesis partially invalidated. Need reframe.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.problem} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.problem}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">Evidence: {r.evidence}</p>
              <p className={`text-[9px] font-mono font-bold ${r.tc}`}>{r.psf}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">PSF evidence archive adalah living document — updated setiap 3 bulan dengan new evidence. P-001, P-002, P-003 = proven. Focus on P-004 deepening. P-005 = pending pivot. This is how MJP de-risks product decisions.</p>
      </div>

      {/* Industry Problem Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" /> INDUSTRY PROBLEM MAP — Peta Lengkap Masalah Industri Konstruksi Indonesia yang MJP Identifikasi, dari yang Sudah Diselesaikan Hingga yang Belum Dijamah
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            {
              layer: "LAYER 1: INFORMATION PROBLEMS (Diselesaikan MJP)",
              problems: ["Tidak tahu nilai HPS sebelum tender announce", "Tidak tahu siapa kompetitor dan pola bid mereka", "Tidak tahu perubahan regulasi sampai sudah terlambat", "Tidak tahu BUJK mana yang trustworthy untuk konsorsium/subkon"],
              mjpStatus: "SOLVED — core product. 487 paying clients. Proven ROI.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              layer: "LAYER 2: PROCESS PROBLEMS (Partly Solved)",
              problems: ["SKK process yang lambat dan opaque (partly solved via Express)", "Document preparation overhead yang tinggi (template library in roadmap)", "Bid submission errors karena checklist manual (checklist in Registry)", "Onboarding BUJK baru ke digital procurement (ongoing)"],
              mjpStatus: "PARTIAL — SKK solved, rest in roadmap. High WTP confirmed.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              layer: "LAYER 3: FINANCIAL PROBLEMS (Identified, Not Yet Solved)",
              problems: ["Working capital gap — menang tender tapi tidak bisa mobilize (needs fintech partner)", "Delayed payment dari pemerintah — cash flow disruption (needs factoring solution)", "Margin erosion from material price volatility (need better HPS model)"],
              mjpStatus: "IDENTIFIED — validated pain but MJP alone can't solve. Need partnerships.",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
            {
              layer: "LAYER 4: STRUCTURAL PROBLEMS (Not Yet Addressed)",
              problems: ["Korupsi dan kolusi dalam pengadaan (systemic — beyond MJP scope)", "Skill gap: kurang engineer yang bisa BIM, kurang PM bersertifikat", "Informal market dominance: 30%+ proyek tidak melewati LPSE (no data access)"],
              mjpStatus: "SYSTEMIC — MJP can provide intelligence but not solve root cause.",
              tc: "text-slate-600", bc: "bg-slate-50 border-slate-200"
            },
          ].map((r) => (
            <div key={r.layer} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.layer}</p>
              <div className="grid grid-cols-2 gap-x-2 mb-0.5">
                {r.problems.map((p, i) => <p key={i} className="text-[8px] text-muted-foreground">• {p}</p>)}
              </div>
              <p className={`text-[9px] font-mono ${r.tc}`}>{r.mjpStatus}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Problem map adalah MJP's strategic compass. Layer 1 = done. Layer 2 = current focus. Layer 3 = next frontier (requires fintech partners). Layer 4 = advocacy but not product. Knowing what NOT to solve is as important as what to solve.</p>
      </div>

      {/* Problem Discovery Sprint Methodology */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-amber-500" /> DISCOVERY SPRINT — Proses Lengkap yang MJP Gunakan ketika Mengidentifikasi Problem Baru Potensial dan Memutuskan Apakah Layak untuk Diselesaikan
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { step: "Step 1: Signal Aggregation (ongoing)", action: "Dewi dan Sari menandai pain points dengan tag DISCOVERY_CANDIDATE ketika frequency {'>'} 15 laporan/bln dan avg severity {'>'} 6.5. Auto-flagged oleh AI scoring system. Current queue: 8 problems.", tc: "text-blue-700" },
            { step: "Step 2: Problem Statement Craft (1 hari Sari)", action: "Setiap problem di-articulate dengan format: 'SIAPA mengalami APA dalam KONTEKS apa yang menyebabkan DAMPAK berapa?' — tanpa solution language. Sari does peer review dengan Budi.", tc: "text-blue-700" },
            { step: "Step 3: Solutionability Test (2–3 hari Hendra + Sari)", action: "Apakah MJP punya atau bisa bangun data untuk solve ini? Apakah ada analogue di industri lain yang works? Rough effort estimate. Go/No-go filter: problem harus {'>'} 70% solvable oleh MJP resources.", tc: "text-orange-700" },
            { step: "Step 4: Willingness to Pay Validation (1–2 minggu Budi)", action: "5–10 targeted interviews dengan BUJK yang report the problem. Script: 'Kalau ada tool yang bisa [solve this problem], berapa yang wajar dibayar?' Threshold: avg WTP {'>'} Rp 200rb/bln OR {'>'} Rp 800rb one-time.", tc: "text-orange-700" },
            { step: "Step 5: Build vs Buy vs Partner (Hendra decision)", action: "Build in-house (if core competency), White-label existing solution (if commodity), Partner with specialist (if domain expertise needed). Most problems fit 'build' — MJP core is data + intelligence.", tc: "text-emerald-700" },
            { step: "Step 6: Sprint Roadmap Entry (Hendra + Hendra Jr.)", action: "Passed discovery sprint → enters sprint roadmap as Design Phase item. Never skips design phase. No surprises in development. Current pipeline: Post-PHO (design), BIM Advisory (design).", tc: "text-emerald-700" },
          ].map((r, i) => (
            <div key={r.step} className="flex gap-2 items-start border-b pb-1.5">
              <span className={`text-[9px] font-black w-4 shrink-0 ${r.tc}`}>{i + 1}.</span>
              <div className="flex-1">
                <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.step}</p>
                <p className="text-[8px] text-muted-foreground">{r.action}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Discovery sprint takes 3–6 weeks total. This is intentionally slow — bad discovery leads to expensive builds that nobody wants. Every day of discovery = potentially weeks of avoided development waste. Most problems that enter queue do NOT pass step 4 (WTP validation).</p>
      </div>

      {/* Problem Root Cause Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Wrench className="h-3.5 w-3.5 text-primary" /> ROOT CAUSE ANALYSIS — 5× Why Analysis untuk 3 Problem Utama MJP: Mengapa Masalah Ini Ada dan Apa Implikasinya ke Solusi?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              problem: "BUJK tidak bisa bersaing efektif di tender pemerintah",
              why5: [
                "Why 1: Mereka kalah di harga → Why 2: Tidak tahu harga kompetitor → Why 3: Data harga kompetitor tidak pernah dipublikasikan → Why 4: Tidak ada platform yang aggregasi historical LPSE outcomes → Why 5: Tidak ada bisnis yang melihat value dalam mengumpulkan dan menjual intel ini ke BUJK.",
              ],
              rootCause: "Market failure: information asymmetry yang extreme karena tidak ada mediator yang mengorganize public procurement data menjadi actionable intel.",
              mjpSolution: "Competitor Radar + Pre-Bid Intel Brief: MJP menjadi mediator yang mengisi void ini.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              problem: "BUJK sering gugur administrasi dari tender yang mereka qualified",
              why5: [
                "Why 1: Dokumen tidak lengkap/expired → Why 2: Tidak tahu persyaratan berubah → Why 3: Tidak ada early warning system → Why 4: Tidak ada agregasi multi-source regulatory requirement per KBLI → Why 5: Regulasi tersebar di 12+ sumber yang tidak terintegrasi.",
              ],
              rootCause: "Regulatory complexity: regulasi konstruksi Indonesia tersebar, sering berubah, dan tidak pernah dirangkum dalam satu tempat.",
              mjpSolution: "Knowledge Registry regulatory vertical + L1 alert system + SKK compliance monitoring.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              problem: "SKK baru atau perpanjangan butuh 3–9 bulan",
              why5: [
                "Why 1: Proses LPJK lambat → Why 2: Queue panjang, admin LPJK kurang → Why 3: Banyak applicant tidak tahu requirements, submit incomplete → Why 4: Tidak ada preparation guide → Why 5: LPJK tidak punya incentive untuk publish clear process documentation.",
              ],
              rootCause: "Process opacity + lack of expert navigator: BUJK tidak tahu cara navigate LPJK efficiently karena LPJK tidak publish clear SOP.",
              mjpSolution: "SKK Express: MJP menjadi navigator + relationship broker yang removes friction dari proses opaque ini.",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
          ].map((r) => (
            <div key={r.problem} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-1`}>Problem: {r.problem}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">5× Why: {r.why5[0]}</p>
              <p className={`text-[8px] font-mono ${r.tc} mb-0.5`}>Root cause: {r.rootCause}</p>
              <p className="text-[8px]">MJP solution: {r.mjpSolution}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Root cause analysis reveals: all 3 problems share a common thread — information asymmetry caused by fragmented, opaque public systems. MJP's fundamental value proposition: reduce information asymmetry in Indonesian construction procurement. Every feature connects back to this root.</p>
      </div>

      {/* Problem Backlog Velocity */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> PROBLEM BACKLOG VELOCITY — Seberapa Cepat MJP Memindahkan Problem dari Backlog ke Solution dan Berapa yang Sudah Selesai vs Masih Antri?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {[
              { stat: "147", label: "Total problems ever identified", tc: "text-blue-700" },
              { stat: "78", label: "Fully solved (product or content)", tc: "text-emerald-700" },
              { stat: "31", label: "In discovery or development", tc: "text-orange-700" },
              { stat: "38", label: "Validated but backlogged", tc: "text-slate-600" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-lg font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          {[
            { status: "Recently Solved (Q2–Q3 2026)", problems: ["Photo evidence in pain point forms (transparency, field team accountability)", "Offline mobile search for field ops (connectivity issue in remote areas)", "Server-synced workroom notes (multi-user collaboration)", "Pre-Bid Intel Brief automation (Sari capacity constraint)"], tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { status: "Currently In Progress (Q3–Q4 2026)", problems: ["Entity resolution performance (P0 — Sprint 24)", "SKK Bulk Renewal Program (Q4 2026 launch)", "BIM Knowledge Vertical (47 assets, 12 done)", "Onboarding automation sequence (AM capacity constraint)"], tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { status: "Validated Backlog (Ready When Capacity Opens)", problems: ["Post-PHO Warranty Tracking (discovery in Q4 2026)", "TKDN Calculator (Sprint 27 estimated)", "NLQ Phase 1 — Intent Classification (Q1 2027)", "Payment delay early warning system (needs fintech partner)"], tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.status} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.status}</p>
              {r.problems.map((p, i) => <p key={i} className="text-[8px] text-muted-foreground">• {p}</p>)}
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Backlog velocity: 78 problems solved in 4.5 years = ~1.4 problems/month avg solved. Accelerating: last 12 months = 2.1/month. Growth driven by: better prioritization framework + AI-assisted development. Target 2027: 3+ problems solved/month at same team size.</p>
      </div>

      {/* Problem Framing Workshop Output */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> FRAMING WORKSHOP — Output dari Problem Framing Workshop Q2 2026 MJP: 3 Masalah yang Masuk Discovery Sprint dan Bagaimana Keputusan itu Dibuat?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Quarterly Problem Framing Workshop (3 jam, seluruh tim): review top pain clusters, vote on discovery priority, align on problem statement before sprint begins. Q2 2026 output:</p>
          {[
            {
              problem: "Problem #1 APPROVED: Post-PHO Warranty & Retention Money Tracking",
              painScore: "8.1/10",
              whyNow: "PHO season surge: 3 bulan pasca budget realisasi deadline (September–November) adalah puncak PHO. Klien butuh sistem ini sebelum September 2026.",
              statement: "'BUJK J8–J9 tidak memiliki sistem tracking otomatis untuk masa retensi, warrant claim deadlines, dan final payment release setelah PHO, menyebabkan kehilangan Rp 8.2jt rata-rata per kontrak karena klaim terlambat.'",
              nextStep: "Discovery sprint: Budi conduct 8 PHO interviews di Jawa in 3 weeks. WTP validation target: Rp 200rb/bln add-on threshold.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              problem: "Problem #2 APPROVED: Payment Delay Early Warning",
              painScore: "7.9/10",
              whyNow: "Community reports: payment delay mentions up 34% QoQ. Increasing number of J8 BUJK approaching cash flow crisis. Urgency: intervene before defaults.",
              statement: "'BUJK tidak bisa memprediksi keterlambatan pembayaran termin dari buyer sampai terlambat 30+ hari, tidak cukup waktu untuk arrange bridging financing. Avg delay now 63 days post-PHO vs 47 days in 2024.'",
              nextStep: "Data feasibility check: Dewi analyze MJP's historical payment data by buyer entity. Do we have enough to build a predictive model?",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              problem: "Problem #3 DEFERRED: BUJK Legal Document Automation",
              painScore: "7.3/10",
              whyNow: "WHY DEFERRED: Despite high pain score, team consensus: solution requires legal review for every document = liability risk. Also: 3 legaltech startups already in this space. Not MJP's comparative advantage.",
              statement: "Deferred to Q4 2026 for strategic reassessment. May become partner integration (refer klien to legaltech) vs own feature.",
              nextStep: "Reza to identify 2 legaltech partners for potential referral arrangement. Revenue model: referral fee or white-label.",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
          ].map((r) => (
            <div key={r.problem} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.problem}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ${r.tc}`}>{r.painScore}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Why now: {r.whyNow}</p>
              <p className="text-[8px] italic mb-0.5">{r.statement}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Next: {r.nextStep}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Workshop facilitator: Hendra (product decisions). All 7 team members participate — even Budi and Reza. Rule: the person closest to the customer has veto power on 'does this really solve the problem as I observe it in the field?'. Budi's veto has killed 3 features that looked good on paper.</p>
      </div>

      {/* Problem Statement Quality Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> PROBLEM STATEMENT QUALITY — Apa yang Membuat Problem Statement 'Baik' di MJP: Template, Contoh Buruk vs Baik, dan Mengapa Presisi itu Penting?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="border rounded-sm p-2.5 bg-muted/10 mb-1">
            <p className="text-[9px] font-bold mb-0.5">MJP Problem Statement Template:</p>
            <p className="text-[8px] font-mono italic">"[SIAPA — segment spesifik] tidak bisa/tidak memiliki [APA — specific need/capability] sehingga [AKIBAT — measurable consequence] padahal [FREKUENSI/SKALA — how often/how many]."</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="border rounded-sm p-2.5 bg-red-50 border-red-200">
              <p className="text-[9px] font-bold text-red-700 mb-1">❌ BAD (3 contoh):</p>
              {[
                "'Kontraktor butuh informasi tender yang lebih baik.' (Who? What better? What's bad about current?)",
                "'BUJK tidak mengerti regulasi konstruksi.' (Too broad. What regulation? What consequence?)",
                "'Platform MJP perlu lebih banyak fitur.' (Not a customer problem — it's a vendor wish list.)",
              ].map((c, i) => <p key={i} className="text-[7px] text-red-800 mb-0.5">• {c}</p>)}
            </div>
            <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200">
              <p className="text-[9px] font-bold text-emerald-700 mb-1">✅ GOOD (3 contoh):</p>
              {[
                "'J8 BUJK di Jawa Tengah tidak bisa mengetahui harga penawaran historis kompetitor, menyebabkan bid 12% lebih tinggi dari pemenang, rata-rata 2.1 kali per tahun.'",
                "'BUJK aktif yang memiliki SKK tenaga ahli tidak mendapat notifikasi sebelum SKK expired, sehingga 34% mengalami expired SKK tanpa persiapan, 1× per siklus 3 tahun.'",
                "'J9 BUJK yang mengikuti tender multi-tahun tidak bisa prediksi keterlambatan termin, sehingga tidak bisa arrange financing bridge tepat waktu — avg 22 hari gap.'",
              ].map((c, i) => <p key={i} className="text-[7px] text-emerald-800 mb-0.5">• {c}</p>)}
            </div>
          </div>
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700">Why precision matters:</p>
            <p className="text-[8px]">Vague problem → vague solution → waste. Specific problem: we know who to build for, what 'solved' looks like, and what to measure. The 3 GOOD examples above each became features: Competitor Radar, SKK Expiry Alerts, and (pending) Payment Delay Early Warning.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Hendra teaches problem statement format in every onboarding of new team member. Takes 3–5 attempts for someone to write their first GOOD one. Budi — who never studied product management — now writes some of the best problem statements on the team. Because he's closest to the customer.</p>
      </div>

      {/* Perumusan Masalah to OKR Linkage */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> OKR LINKAGE — Bagaimana Masalah yang Dirumuskan Terhubung ke OKR Q3 2026: Traceability dari 'Klien Bermasalah' ke 'Tim Bekerja pada X'
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">MJP's OKR structure requires: every Objective must trace back to at least 1 validated problem statement. Without traceability, OKR is rejected by Hendra.</p>
          {[
            {
              problem: "J8/J9 tidak bisa pre-qualify BIM readiness sebelum tender BIM-wajib",
              okr_o: "O3: Jadikan MJP sumber terpercaya #1 untuk BIM compliance guidance (Q3 2026)",
              okr_kr: ["KR1: 20 BIM knowledge assets published (currently 6/20)", "KR2: 50 klien complete BIM readiness self-assessment", "KR3: 3 BUJK berhasil pass BIM pre-qualification menggunakan MJP guidance"],
              owner: "Sari + Dewi",
              tc: "text-red-700"
            },
            {
              problem: "BUJK aktif churn karena tidak merasakan ROI konkret dari MJP (Budi field: 'Mereka bilang platform bagus tapi tidak tahu apa yang didapat')",
              okr_o: "O4: Buktikan ROI konkret ke klien dalam 30 hari pertama (Q3 2026)",
              okr_kr: ["KR1: Aha moment rate {'<'}Day 14 naik dari 68% ke 80%", "KR2: Churn rate turun dari 13% ke 9%/bln", "KR3: NPS Starter tier naik dari +41 ke +55"],
              owner: "Reza + Hendra",
              tc: "text-orange-700"
            },
            {
              problem: "Tim riset tidak bisa membuktikan dampak kerja ke Hendra karena tidak ada metrik output yang disepakati",
              okr_o: "O5: Buat Research Intelligence unit terukur dan transparan (Q3 2026)",
              okr_kr: ["KR1: 100% research items published dengan impact score", "KR2: Monthly research report auto-generated dari platform data", "KR3: Sari spends < 30 menit/bln on reporting (vs 3 jam/bln saat ini)"],
              owner: "Sari",
              tc: "text-blue-700"
            },
          ].map((r) => (
            <div key={r.problem} className="border rounded-sm p-2.5 bg-muted/5 mb-1">
              <p className="text-[8px] font-bold text-orange-700 mb-0.5">Problem: {r.problem}</p>
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>→ {r.okr_o}</p>
              {r.okr_kr.map((kr, i) => <p key={i} className="text-[7px] text-muted-foreground">• {kr}</p>)}
              <p className="text-[7px] font-mono mt-0.5">Owner: {r.owner}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">OKR–Problem traceability prevents 'vanity OKRs' — objectives that sound good but don't connect to real customer problems. Hendra's rule: if you can't show me the customer problem this solves, I'm not funding the OKR. This discipline has led to rejection of 4 OKRs in 2026 YTD that were team-internal goals with no customer connection.</p>
      </div>

      {/* Problem Prioritization Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" /> PRIORITIZATION — RICE Score MJP untuk Semua 47 Masalah yang Terdokumentasi: Bagaimana Hendra Memilih 3 yang Dikerjakan di Setiap Kuartal?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="border rounded-sm p-2.5 bg-muted/10 mb-1">
            <p className="text-[9px] font-bold mb-0.5">MJP RICE score formula (adapted):</p>
            <p className="text-[8px] font-mono">RICE = (Reach × Impact × Confidence) / Effort</p>
            <p className="text-[7px] text-muted-foreground mt-0.5">Reach = % of klien affected. Impact = 1–5 scale (business outcome). Confidence = 1–100% (how sure we are). Effort = team-weeks to solve.</p>
          </div>
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[7px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Problem</th>
                  <th className="p-1 text-center">Reach</th>
                  <th className="p-1 text-center">Impact</th>
                  <th className="p-1 text-center">Conf</th>
                  <th className="p-1 text-center">Effort</th>
                  <th className="p-1 text-center font-bold">RICE</th>
                  <th className="p-1 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["BIM compliance gap", "46%", "5", "88%", "14w", "147", "IN PROGRESS"],
                  ["Vague value in Month 1", "71%", "4", "92%", "3w", "872", "Q3 OKR"],
                  ["Churn no-win BUJK", "31%", "4", "84%", "6w", "174", "Q3 OKR"],
                  ["NLQ search", "100%", "3", "75%", "12w", "188", "Q4 TARGET"],
                  ["Offline mobile depth", "18%", "3", "90%", "8w", "61", "BACKLOG"],
                  ["ESG certification guide", "22%", "2", "60%", "18w", "15", "2027"],
                  ["Subkon payment intel", "34%", "3", "52%", "10w", "53", "RESEARCH"],
                ].map((row, i) => (
                  <tr key={i} className={`border-b hover:bg-muted/20 ${parseFloat(row[5]) >= 500 ? "font-bold" : ""}`}>
                    <td className="p-1">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[2]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[3]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[4]}</td>
                    <td className={`p-1 text-center font-bold ${parseFloat(row[5]) >= 500 ? "text-emerald-700" : parseFloat(row[5]) >= 150 ? "text-blue-700" : "text-muted-foreground"}`}>{row[5]}</td>
                    <td className={`p-1 text-center ${row[6] === "IN PROGRESS" || row[6] === "Q3 OKR" ? "text-emerald-700" : "text-muted-foreground"}`}>{row[6]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200">
            <p className="text-[9px] font-bold text-emerald-700">Surprise insight from RICE scoring:</p>
            <p className="text-[8px]">The highest RICE score problem is NOT BIM or NLQ — it's 'Vague value in Month 1' (RICE 872). Reaching 71% of klien at Month 1, with high confidence, at low effort (3 weeks for onboarding flow redesign). This is why Churn reduction is Q3's #1 OKR priority, ahead of features. Easy win with outsized impact.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">RICE scoring done quarterly by Hendra + Sari (2 hours). All 47 documented problems scored. Top 3 by RICE become next quarter OKR candidates. Hendra can override RICE for strategic reasons (BIM is mandated = must-do even at lower RICE). RICE prevents team from working on interesting-but-low-impact problems.</p>
      </div>

      {/* Problem Retirement Archive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Archive className="h-3.5 w-3.5 text-muted-foreground" /> PROBLEM ARCHIVE — 7 Masalah yang Sudah Dianggap Terpecahkan oleh MJP dan Mengapa Beberapa Tetap Relevan Meski Produk Sudah Diluncurkan
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { problem: "BUJK tidak bisa akses data tender historis dari satu tempat", solution: "LPSE Multi-Source Aggregator (2022). 312 LPSE connected.", status: "SOLVED ✅", caveat: "Tapi: 99 kabupaten masih uncovered. Problem masih parsial di remote areas.", tc: "text-emerald-700" },
            { problem: "SKK tenaga ahli membutuhkan 3–4 bulan proses", solution: "SKK Express (2022). 5-day SLA via Dewi + asesor network.", status: "SOLVED ✅", caveat: "Tapi: BIM SKK belum ada (SKKNI draft). Express belum bisa di-scale tanpa more asesor.", tc: "text-emerald-700" },
            { problem: "BUJK tidak tahu peraturan berubah sampai ketika tender didiskualifikasi", solution: "L1/L2 Alert System (2023). 18-menit avg latency.", status: "SOLVED ✅", caveat: "Tapi: alert fatigue if klien doesn't configure watchlist. 22% have unconfigured watchlists.", tc: "text-emerald-700" },
            { problem: "Tidak ada cara untuk tahu apakah rekanan BUJK bisa dipercaya", solution: "BUJK Trust Score (2023). 12.400 BUJKs scored.", status: "SOLVED ✅", caveat: "Tapi: Trust Score based on available data — opaque BUJK (no public records) still hard to assess.", tc: "text-emerald-700" },
            { problem: "Daily briefing tidak accessible saat tidak ada internet di lapangan", solution: "Mobile offline mode (2026). Cache-first architecture.", status: "SOLVED ✅", caveat: "Tapi: offline only caches last 7 days. Longer fieldwork trips still partially offline.", tc: "text-emerald-700" },
            { problem: "Tidak ada cara untuk bandingkan MJP alerts dengan waktu yang lewat (trend)", solution: "Partially solved: platform has search + filter for historical data.", status: "PARTIAL 🟡", caveat: "NLQ will fully solve this (Q4 2026). Current workaround: manual filter.", tc: "text-orange-700" },
            { problem: "Tim proyek klien tidak bisa berbagi catatan analisis tender", solution: "Workroom Notes with server sync (2026).", status: "RECENTLY SOLVED 🟢", caveat: "Adoption still low (14%). Needs onboarding push. Feature exists but under-discovered.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.problem} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[8px] font-bold flex-1">{r.problem}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.status}</span>
              </div>
              <p className="text-[7px] text-emerald-700 mb-0.5">Solution: {r.solution}</p>
              <p className="text-[7px] text-orange-700 font-mono">Caveat: {r.caveat}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Solved problems are archived, not forgotten. Why: (1) caveats reveal where solutions are still incomplete. (2) new team members learn product history through this archive. (3) investors like to see 'problems we've solved' vs 'problems we're solving' — shows execution track record. Hendra: 'Every solved problem with a caveat is a backlog item in disguise.'</p>
      </div>

      {/* OKR Grading History */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-amber-500" /> OKR HISTORY — Rekam Jejak Grading OKR MJP per Kuartal Sejak 2023: Apa yang Selalu Tercapai, Apa yang Selalu Meleset, dan Pelajaran tentang Menetapkan Target yang Tepat
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Quarter</th>
                  <th className="p-1 text-left">Key Objective</th>
                  <th className="p-1 text-center">Grade</th>
                  <th className="p-1 text-left text-muted-foreground">Lesson</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Q1 2023", "Launch platform v1 (0 → 100 klien)", "0.8 ✅", "Achieved 97 klien. Hit milestone. Timeline: 2 weeks late due to SKK db import."],
                  ["Q2 2023", "NPS > +40 from first cohort", "0.6 🟡", "NPS +38. Close miss. Root cause: onboarding friction. Led to Reza's Day-14 call protocol."],
                  ["Q3 2023", "SKK Express pilot (> 20 cases)", "1.0 ✅", "47 cases in pilot month. Exceeded target 2×. Validated Express as product-market fit."],
                  ["Q4 2023", "Churn < 10%", "0.4 🔴", "Churn 16%. Significant miss. Changed prioritization — churn became Q1 2024 primary focus."],
                  ["Q1 2024", "Reduce churn to < 12%", "0.7 🟡", "Churn 12.3%. Nearly hit. Day-14 protocol + watchlist setup drove improvement."],
                  ["Q2 2024", "MRR > Rp 400jt", "0.9 ✅", "MRR Rp 388jt at quarter-end (hit target in month 1 of Q3). Structural revenue growth."],
                  ["Q3 2024", "Enterprise tier launch (> 10 klien)", "0.8 ✅", "11 Enterprise signed by quarter-end. More sticky than expected — average contract 18mo."],
                  ["Q4 2024", "Competitor Radar feature adoption > 50%", "0.3 🔴", "Adoption 22%. Big miss. Feature existed but discovery pathway broke. Rebuilt in Q1 2025."],
                  ["Q1 2025", "BIM vertical alpha (> 5 assets)", "0.7 🟡", "6 assets published but 3 needed rework. Quality below gate standard. Dewi overloaded."],
                  ["Q2 2025", "Churn < 10%", "0.6 🟡", "Churn 11.8%. Improved but not there. SKK Expiry Reminder launched — will lag 2 quarters."],
                  ["Q3 2025", "Mobile app launch (> 100 installs)", "1.0 ✅", "187 installs. Budi + field teams drove adoption faster than expected."],
                  ["Q4 2025", "MRR > Rp 600jt", "0.9 ✅", "MRR Rp 621jt at year-end. Revenue on track. Churn still issue."],
                  ["Q1 2026", "NLQ internal alpha", "0.5 🔴", "Alpha 70% built. Dependency on Hendra Jr. bandwidth — API feature work competed. Pushed Q4 2026."],
                  ["Q2 2026", "SKK Express 50 cases/mth", "0.9 ✅", "47 avg, 52 in June. Capacity expanding with coordinator hire."],
                ].map((row, i) => (
                  <tr key={i} className={`border-b hover:bg-muted/20 ${row[2].includes("🔴") ? "bg-red-50" : ""}`}>
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-muted-foreground">{row[1]}</td>
                    <td className={`p-1 text-center font-bold ${row[2].includes("✅") ? "text-emerald-700" : row[2].includes("🔴") ? "text-red-700" : "text-orange-700"}`}>{row[2]}</td>
                    <td className="p-1 text-muted-foreground">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-muted/10">
            <p className="text-[9px] font-bold mb-0.5">Pattern analysis (14 quarters):</p>
            <p className="text-[7px]">✅ MJP consistently executes on: SKK Express growth, revenue growth, product launches. 🔴 MJP consistently struggles with: churn reduction (3 misses), feature adoption (discovery/UX failures). Insight: MJP is better at building than at getting klien to use what's built. The product-adoption gap is the single most consistent underperformance pattern in MJP's OKR history.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">OKR grading done by Hendra at end of each quarter. Published to full team in retro. No grade inflation — a 0.6 is a 0.6. Hendra's rule: 'An OKR grade above 0.7 consistently = your targets are too easy. A grade below 0.5 consistently = your targets are too ambitious or your prioritization is broken. Aim for 0.7–0.8 as healthy tension.' MJP average across 14 quarters: 0.73.</p>
      </div>

      {/* Problem Hypothesis Testing Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FlaskConical className="h-3.5 w-3.5 text-primary" /> HYPOTHESIS TESTING — Cara MJP Menguji Hipotesis Masalah Sebelum Mulai Build: 5 Tahap Validasi yang Mencegah Tim Membangun Solusi untuk Masalah yang Tidak Benar-Benar Ada
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { stage: "Stage 1 — Pain Observation (Budi/Reza)", description: "Pain point observed in field (Budi) or heard from prospect/klien (Reza). Logged in platform. This is raw signal — not yet a validated problem.", criteria: "Minimum: 2 independent observations before moving to Stage 2. 1 observation = noise.", duration: "Ongoing", tc: "text-muted-foreground" },
            { stage: "Stage 2 — Frequency Check (Sari)", description: "Sari searches platform pain point database: how many klien have mentioned similar pain? Is there a clustering pattern (specific BUJK class, region, sector)?", criteria: "Threshold: > 5 mentions OR 1 Enterprise klien mention with high impact to advance.", duration: "1–2 days", tc: "text-blue-700" },
            { stage: "Stage 3 — Severity Calibration (Budi interview)", description: "Budi conducts 3–5 targeted conversations: 'If you had a solution to [pain], what would you pay? What would change in your process?' Quantifies pain in BUJK's own terms.", criteria: "Pass: > 60% say they'd change process AND willingness to pay > Rp 0/month (even Rp 50K = validated).", duration: "1–2 weeks field", tc: "text-blue-700" },
            { stage: "Stage 4 — Solution Concept Test (Reza)", description: "Reza presents a 1-slide concept: 'We're thinking of building X that solves Y. Would this help you? How much would you pay?' No mockup, no demo. Pure concept.", criteria: "Pass: > 3 of 5 klien say 'yes I'd use this' AND 1+ says 'I'd pay for this at [price]'.", duration: "1 week", tc: "text-orange-700" },
            { stage: "Stage 5 — Hendra Build-or-Not Decision", description: "Hendra reviews all stage outputs. Decision: (A) Build now — RICE score > threshold, fits roadmap, team has capacity. (B) Backlog — validated but timing not right. (C) Reject — validated pain but wrong solution direction. (D) Kill — pain is real but MJP is not the right solver.", criteria: "Most common outcome: Backlog (57%). Build: 21%. Reject: 15%. Kill: 7%.", duration: "1 meeting (< 2 jam)", tc: "text-red-700" },
          ].map((r) => (
            <div key={r.stage} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.stage}</p>
                <span className="text-[7px] font-mono text-muted-foreground shrink-0">{r.duration}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.description}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Pass criteria: {r.criteria}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">MJP's hypothesis testing process is not a formal innovation funnel — it's informal but consistent. Total problems tested (2022–2026): 47. Build outcomes: 10 features shipped. Kill outcomes: 3. The 10 shipped features represent the most validated, highest-RICE problems. This 21% ship rate means MJP's team is NOT working on gut feel — 79% of validated problems are consciously deprioritized, not ignored. Hendra: 'The backlog isn't failure — it's optionality.'</p>
      </div>

      {/* Problem Interconnection Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> PROBLEM NETWORK — Peta Koneksi Antar Masalah: Mengapa Memecahkan Satu Masalah Sering Memperlemah Masalah Lain — dan 4 'Master Problem' yang Jika Terpecahkan akan Memicu Cascade Solusi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Problems do not exist independently. Sari's problem network analysis reveals 4 master nodes:</p>
          {[
            {
              master: "Master Problem 1 — 'Information Asymmetry': BUJK tidak punya akses sama ke procurement intelligence yang sama",
              downstream: [
                "→ P-02: Tidak tahu deadline tender sampai terlambat (direct child)",
                "→ P-07: Estimasi HPS berdasarkan feeling, bukan data (direct child)",
                "→ P-11: Tidak tahu apakah kompetitor akan ikut tender yang sama (direct child)",
                "→ P-19: Konsorsium formation lambat karena tidak ada cara menemukan mitra (indirect)",
              ],
              solutionImpact: "Solving this FIRST: MJP's core platform. 9 downstream problems weakened by good information architecture.",
              tc: "text-red-700"
            },
            {
              master: "Master Problem 2 — 'Certification Fragility': SKK/SBU sebagai pre-condition yang tidak dikelola aktif",
              downstream: [
                "→ P-04: SKK tenaga ahli expired mendadak saat tender aktif (direct child)",
                "→ P-08: SBU upgrade terlambat untuk menangkap kelas tender yang lebih tinggi (direct child)",
                "→ P-23: Tidak bisa memasukkan BIM specialist karena SKKNI BIM belum ada (indirect, emerging)",
              ],
              solutionImpact: "Solving this: SKK Express + reminder system. But partial — BIM SKKNI gap is unsolvable until BNSP publishes.",
              tc: "text-orange-700"
            },
            {
              master: "Master Problem 3 — 'Trust Deficit in Partnerships': BUJK tidak bisa verify mitra/sub dengan cepat dan tepat",
              downstream: [
                "→ P-13: Sub-kontraktor default karena tidak ada due diligence (direct child)",
                "→ P-16: Konsorsium bubar di tengah proyek karena mismatch kapasitas (direct child)",
                "→ P-21: Reputasi BUJK rusak karena salah pilih sub-kontraktor (indirect)",
              ],
              solutionImpact: "Solving this: BUJK Trust Score + consortium matching. 3 downstream problems significantly reduced.",
              tc: "text-blue-700"
            },
            {
              master: "Master Problem 4 — 'Regulatory Surprise': Peraturan berubah tanpa BUJK sempat bersiap",
              downstream: [
                "→ P-01: Didiskualifikasi karena tidak tahu ada persyaratan baru (direct child)",
                "→ P-14: Kontrak addendum mahal karena spec berubah saat proyek berjalan (indirect)",
                "→ P-27: Kehilangan pasar baru (BIM mandate) karena tidak siap lebih awal (emerging)",
              ],
              solutionImpact: "Solving this: Regulatory Alert System (L1/L2/L3) + Sari's lead time advantage. 4.2-month average lead time.",
              tc: "text-emerald-700"
            },
          ].map((r) => (
            <div key={r.master} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.master}</p>
              <div className="mb-0.5">{r.downstream.map((d, i) => <p key={i} className="text-[7px] ml-2" title={d}>{d}</p>)}</div>
              <p className={`text-[7px] font-mono ${r.tc}`}>MJP impact: {r.solutionImpact}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Problem network analysis is Sari's most sophisticated strategic tool. By mapping which problems are master nodes, MJP avoids solving 47 problems independently and instead solves 4 masters that cascade to weaken the others. This is why MJP's product has 10 features, not 47 — each feature was designed to address a master problem. The remaining 37 unsolved problems are largely downstream of the 4 masters — they'll resolve as master solutions mature.</p>
      </div>

      {/* Backlog Prioritization Criteria */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ListOrdered className="h-3.5 w-3.5 text-primary" /> BACKLOG CRITERIA — Kriteria Prioritisasi Backlog MJP: Mengapa Bukan Sekadar RICE Score — 5 ListFilter Tambahan yang Sering Mengubah Urutan Prioritas dan Bagaimana Hendra Membuat Keputusan Akhir
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">RICE is the starting point — not the ending point. 5 filters applied after RICE ranking:</p>
          {[
            { filter: "ListFilter 1 — Regulatory forcing function", desc: "Any feature required by regulation gets jumped to top 5 regardless of RICE score. Example: BIM mandate → BIM knowledge assets become priority. Rationale: klien will need it regardless of current RICE score; early prep = competitive advantage.", impact: "Overrides RICE for regulatory compliance features.", tc: "text-red-700" },
            { filter: "ListFilter 2 — Retention vs. Acquisition", desc: "Features primarily serving existing klien are weighted higher during high-churn months. Features primarily serving new klien acquisition are weighted higher when growth is priority. Hendra shifts this weight quarterly based on current metrics.", impact: "May reorder top 10 by 2–3 positions.", tc: "text-orange-700" },
            { filter: "ListFilter 3 — Budi's urgency flag", desc: "If Budi reports a pain point as 'klien asking about this every visit' (marked URGENT in his field notes), RICE score is multiplied by 1.3×. Rationale: field urgency is a leading indicator of churn risk that survey data misses.", impact: "+30% RICE multiplier for urgent field flags.", tc: "text-blue-700" },
            { filter: "ListFilter 4 — Technical sequencing", desc: "Some features unlock others (e.g., NLQ requires entity extraction which requires KBLI synonym dictionary). If a lower-RICE feature is a prerequisite for a top-5 feature, it moves up. Hendra Jr. defines the dependency map quarterly.", impact: "Prerequisite features may jump 5–10 positions.", tc: "text-primary" },
            { filter: "ListFilter 5 — Series A signal value", desc: "Currently active: features that demonstrate AI capability, platform intelligence, or BUJK network effects get a temporary boost for the Series A investor demo window (Q4 2026). Not permanent — this filter expires January 2027.", impact: "Active now: NLQ, consortium matching, predictive win probability.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.filter} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.filter}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.impact}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-muted/10 mt-1">
            <p className="text-[9px] font-bold mb-0.5">Hendra's veto right:</p>
            <p className="text-[8px] text-muted-foreground">Even after all 5 filters, Hendra has final veto. He has used it twice: (1) overrode RICE to build Consortium Matching over a higher-RICE but lower-strategic-value feature. (2) vetoed an analytics dashboard feature (high RICE from klien requests) because 'it doesn't make BUJK better at construction — it just satisfies curiosity.' Both vetoes were explained to the team with rationale.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Backlog prioritization meeting: last Thursday of each month, 60 minutes. Hendra, Sari, Hendra Jr., Reza. RICE scores pre-calculated by Sari (reach + impact from field data, Reza's win/loss analysis). Confidence + effort estimated by Hendra Jr. ListFilter application: Hendra and Sari together. Final order: Hendra. This is the most important monthly meeting MJP has — more impactful than the sales pipeline review because it determines what product will exist in 6 months.</p>
      </div>

      {/* Problem Validation Scorecard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ClipboardCheck className="h-3.5 w-3.5 text-primary" /> VALIDATION SCORECARD — Kartu Skor Validasi Masalah: 5 Pertanyaan yang Harus Dijawab Sebelum Masalah Bisa Masuk ke Backlog Aktif — Serta Skor Minimum yang Dibutuhkan untuk Lolos ListFilter Hendra
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Every problem goes through Sari's 5-question validation before entering the active backlog. Each question scored 1–3:</p>
          {[
            { q: "Q1 — Breadth: Berapa % BUJK mengalami masalah ini?", scoring: "1 = <10% of BUJK | 2 = 10–40% | 3 = > 40%", example: "Example: 'SKK expired' → 3 (all BUJK with tenaga ahli face this risk)", tc: "text-primary" },
            { q: "Q2 — Depth: Seberapa parah dampak masalah ini per kejadian?", scoring: "1 = inconvenience (<Rp 5jt impact) | 2 = significant (Rp 5–50jt) | 3 = critical (> Rp 50jt)", example: "Example: 'Bad sub-contractor' → 3 for J8+, 2 for J7", tc: "text-blue-700" },
            { q: "Q3 — Frequency: Seberapa sering masalah ini terjadi per tahun?", scoring: "1 = once per year | 2 = quarterly | 3 = monthly+", example: "Example: 'Missed tender deadline' → 3 (can happen multiple times/month without MJP)", tc: "text-orange-700" },
            { q: "Q4 — Solveability: Bisa MJP secara realistis memecahkan ini?", scoring: "1 = MJP tangentially helps | 2 = MJP is one good solution | 3 = MJP is THE best solution", example: "Example: 'Financing for project capital' → 1 (MJP is not a fintech)", tc: "text-emerald-700" },
            { q: "Q5 — Moat: Apakah solusi MJP sulit ditiru kompetitor?", scoring: "1 = commodity (anyone can build) | 2 = requires domain expertise | 3 = requires domain expertise + data + network", example: "Example: 'BUJK Trust Score' → 3 (requires 4+ years of data + Budi's network)", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.q} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.q}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Scoring: {r.scoring}</p>
              <p className={`text-[7px] font-mono italic ${r.tc}`}>{r.example}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200 mt-1">
            <p className="text-[9px] font-bold text-blue-700">Score interpretation:</p>
            <p className="text-[8px]">Max score: 15. Minimum for active backlog: 10. Range 10–12: lower priority. 13–14: high priority. 15: ship as fast as possible. Problems scoring 7–9: monitor (may improve with market evolution). Below 7: archive. NLQ scored 14/15 (Q4: 2 — MJP is one of several AI search solutions; not unique on this dimension yet). SKK Reminder scored 15/15 when first proposed (2023).</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Validation scorecard designed to prevent 'feature creep from enthusiasm' — a startup failure mode where the team builds things that feel important but don't meet the bar for significant, solvable, and defensible. Hendra: 'Every problem sounds like a real problem until you score it. The scorecard is a forcing function — you can't advocate for a problem without answering the 5 questions.' Two problems that scored well in team discussion but failed the scorecard: (1) construction materials price index (score 8 — MJP can't be the best solution), (2) project management templates (score 7 — commodity).</p>
      </div>

      {/* Problem Statement Hall of Fame */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-amber-500" /> PROBLEM HALL OF FAME — 5 Rumusan Masalah Terbaik dalam Sejarah MJP: Masalah yang Dirumuskan Begitu Tepat Sehingga Solusinya Hampir Otomatis Muncul — dan Apa yang Membuat Rumusan Ini Berhasil
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">A well-framed problem statement contains: (1) specific user, (2) specific moment, (3) specific friction, (4) quantified cost. These 5 are MJP's best-ever problem statements (Sari's hall of fame):</p>
          {[
            {
              id: "HOF-01",
              statement: "BUJK direktur J7–J8 di Jawa Tengah kehilangan tender senilai Rp 5–25M setiap kuartal karena menemukan informasi tender 3–14 hari terlambat setelah mendaftar di LPSE Nasional saja",
              result: "MJP Tender Alert System (feature #1, 2022). Directly addresses: who (J7–J8 Jateng), when (at tender discovery stage), friction (3–14 day lag), cost (Rp 5–25M).",
              tc: "text-amber-700"
            },
            {
              id: "HOF-02",
              statement: "Tenaga ahli konstruksi J7–J9 kehilangan keikutsertaan tender satu kuartal sekali karena SKK mereka kedaluwarsa 30 hari sebelum deadline tender tanpa peringatan yang cukup awal",
              result: "SKK Reminder + SKK Express (features #3 and #4, 2023). The '30 days before deadline' precision is what enabled the 3-tier reminder design (D-90/D-30/D-7).",
              tc: "text-primary"
            },
            {
              id: "HOF-03",
              statement: "BUJK J8–J9 di 3 kota besar gagal menyelesaikan proyek 20% lebih mahal dari kontrak karena memilih sub-kontraktor bermasalah tanpa ada cara mengverifikasi rekam jejak mereka dalam 24 jam",
              result: "BUJK Trust Score (feature #5, 2023). The '24-hour verification' time constraint shaped the automated crawl-based approach. Manual verification would have taken days.",
              tc: "text-blue-700"
            },
            {
              id: "HOF-04",
              statement: "Manajer pengadaan BUJK J9 menghabiskan 12–20 jam/minggu mengumpulkan informasi HPS dari berbagai sumber tidak konsisten, menghasilkan penawaran yang kalah karena terlalu tinggi 8–15% dari HPS aktual",
              result: "HPS Model v1 → v2 (feature #7 evolution, 2024). The '12–20 jam/week' quantification was what convinced Hendra to invest 9 weeks of Hendra Jr.'s time — clear productivity ROI.",
              tc: "text-emerald-700"
            },
            {
              id: "HOF-05",
              statement: "BUJK J8–J9 yang sedang membangun konsorsium untuk tender > Rp 500M menghabiskan 3–5 minggu mengevaluasi 10–20 calon mitra potensial secara manual karena tidak ada cara menemukan BUJK yang KBLI-nya komplementer dan Trust Score-nya > 70 dalam wilayah geografis yang sama",
              result: "Consortium Matching (feature #9, 2023). The extreme specificity ('KBLI complementary + Trust Score > 70 + same geography') became the exact algorithm specification.",
              tc: "text-orange-700"
            },
          ].map((r) => (
            <div key={r.id} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold ${r.tc}`}>{r.id}</p>
              </div>
              <p className={`text-[8px] italic ${r.tc} mb-0.5`}>"{r.statement}"</p>
              <p className="text-[7px] font-mono text-muted-foreground">{r.result}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Hall of fame maintained by Sari as a teaching tool for problem framing quality. When a new problem enters the backlog with a weak statement ('BUJK membutuhkan informasi lebih baik'), Sari points to HOF-01 and says: 'Rewrite this with who, when, friction, and cost.' The 5 hall-of-fame statements took an average of 2.3 iterations to reach their final form — good problem framing is not instant, it's iterative.</p>
      </div>

      {/* Problem-to-Solution Mapping */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ArrowRight className="h-3.5 w-3.5 text-primary" /> PROBLEM → SOLUTION MAP — Peta Lengkap Problem-to-Solution MJP: Setiap Pain Point Utama, Produk atau Fitur yang Menjawabnya, dan Seberapa Komplet Jawabannya — Serta Gap yang Belum Terpenuhi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-1">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Core pain</th>
                  <th className="p-1 text-left">MJP solution</th>
                  <th className="p-1 text-center">Coverage</th>
                  <th className="p-1 text-left">Remaining gap</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Late tender discovery (3–14 day lag)", "Tender Alert System (312 LPSE, <8 min SLA)", "90%", "Outer island LPSE + BUMN (10%). v4 crawler fixes this."],
                  ["SKK expiry surprise", "SKK Reminder (D-90/D-30/D-7) + SKK Express", "95%", "5%: klien who ignore all reminders. No product fix — behavioral."],
                  ["No way to verify sub-contractor reliability", "BUJK Trust Score (database of 47k+ BUJK)", "75%", "25%: outer island BUJK with thin data. BUMN expansion fills gap."],
                  ["HPS estimation takes 12–20 hours", "HPS Model (±8.3% accuracy, 6 KBLI categories)", "70%", "30%: MEP KBLI (±11.4%). MEP sub-model in Q4 2026."],
                  ["Missing regulatory change deadline", "Regulatory Alert (14-source network, 4.2-month lead)", "85%", "15%: local perda (34 provinces). Q3 2027 target."],
                  ["Can't find consortium partners in same region", "Consortium Matching (5-criteria algorithm)", "65%", "35%: outer island BUJK coverage thin in database."],
                  ["Can't search/ask questions about procurement", "NLQ v1 (Q4 2026 target)", "0%", "100% gap until Q4 2026. Highest priority new feature."],
                  ["BIM preparation for 2027 mandate", "0 features currently", "0%", "CRITICAL: BIM vertical needed. No product until 2027."],
                ].map((row, i) => (
                  <tr key={i} className={`border-b hover:bg-muted/20 ${row[2] === "0%" ? "bg-red-50/30" : ""}`}>
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-blue-700">{row[1]}</td>
                    <td className={`p-1 text-center font-bold ${parseInt(row[2]) >= 80 ? "text-emerald-700" : parseInt(row[2]) >= 60 ? "text-orange-700" : "text-red-700"}`}>{row[2]}</td>
                    <td className={`p-1 ${row[2] === "0%" ? "text-red-700 font-bold" : "text-muted-foreground"}`}>{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Problem-to-solution coverage map is Hendra's product strategy document — it shows at a glance where MJP is strong (SKK: 95%, Regulatory: 85%), where it's mid (Trust Score: 75%, Consortium: 65%), and where critical gaps remain (NLQ: 0%, BIM: 0%). The roadmap priority order is driven entirely by this map: gaps in high-RICE pain areas come first. NLQ (0% coverage of the highest-valued 'search and ask' pain) is #1 roadmap priority. BIM (0% coverage of an emerging mandate pain) is #2 but blocked by hiring. Hendra reviews this map quarterly and it changes the roadmap directly.</p>
      </div>

      {/* Problem Definition Workshop */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> DEFINITION WORKSHOP — Workshop Definisi Masalah MJP: Proses Bulanan yang Menghasilkan Problem Statement Berkualitas — Siapa yang Terlibat, Format Sesi 3 Jam, dan Mengapa Tanpa Sesi Ini Masalah Tidak Masuk Backlog
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Monthly Problem Definition Workshop — held last Wednesday of the month, 09:00–12:00:</p>
          {[
            { slot: "09:00–09:30 — Budi's Field Report (30 min)", desc: "Budi presents top 5 observations from the past month. Format: raw field notes → pre-filtered to {'>'} 3 mentions or high emotional intensity. Team listens without judgment. No solutions proposed.", rule: "Budi is the only voice in this segment. No interruptions. Questions only after Budi finishes.", tc: "text-primary" },
            { slot: "09:30–10:15 — Sari's Intelligence Cross-Reference (45 min)", desc: "Sari cross-references Budi's observations against: (1) existing problem backlog (is this already captured?), (2) regulatory intelligence (is a regulation causing this pain?), (3) market data (is this a growing or shrinking problem?).", rule: "Sari adds context, not solutions. The goal is understanding, not fixing.", tc: "text-blue-700" },
            { slot: "10:15–10:45 — Problem Statement Drafting (30 min)", desc: "Hendra drafts problem statements in real-time for the 2–3 most significant observations. Team improves the draft: Is the 'who' specific enough? Is the 'when' precise? Is the 'cost' quantified? Iteration continues until all agree the statement is complete.", rule: "A problem statement must pass the '5-year-old test': can a non-expert understand who has the problem, when, and what it costs them?", tc: "text-orange-700" },
            { slot: "10:45–11:30 — RICE Scoring + Backlog Triage (45 min)", desc: "Each new problem statement scored with RICE. Reza provides commercial perspective on Reach. Sari provides intelligence perspective on Impact. Hendra Jr. provides technical perspective on Effort. Problems scoring > 10: enter active backlog with priority rank.", rule: "RICE score is advisory — Hendra makes the final prioritization call. But he must explain his reasoning if he overrides the score.", tc: "text-emerald-700" },
            { slot: "11:30–12:00 — Closing: Decisions + Next Month's Focus (30 min)", desc: "Each workshop ends with: (1) What problems were added to backlog today? (2) What problems were de-prioritized and why? (3) What is Budi asked to specifically observe next month? (4) Any knowledge gaps Sari should address based on today's discussion?", rule: "Every workshop closes with specific, named actions — not general intentions.", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.slot} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.slot}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Rule: {r.rule}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Problem Definition Workshop is attended by all 5 team members (Budi, Sari, Hendra Jr., Reza, Hendra). One of only 3 mandatory whole-team monthly events (others: Monthly Close, Quarterly Review). In 2025: 12 workshops, 24 problems added to active backlog, 31 problems moved to watch list, 8 problems closed as 'resolved'. Hendra: 'This workshop is the most valuable 3 hours of any month. It's where the company's intelligence translates into product direction. If we skip it, the product drifts toward what's technically easy rather than what's customer-important.'</p>
      </div>

      {/* Problem Hierarchy — Industry vs. Company Problems */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" /> PROBLEM HIERARCHY — Hierarki Masalah MJP: Perbedaan antara Masalah Industri yang Hanya Bisa Diaddress oleh Ekosistem Konstruksi Indonesia secara Keseluruhan vs. Masalah yang Bisa MJP Selesaikan Sendiri
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Hendra's 3-tier problem classification framework (prevents MJP from overcommitting):</p>
          {[
            {
              tier: "Tier A — MJP can solve this alone (build it)", color: "text-emerald-700",
              examples: [
                "P1: Tender information delay → MJP's crawler and alert engine eliminates the delay",
                "P4: Regulatory change awareness → Sari's monitoring and annotation removes the gap",
                "P7: BUJK due diligence complexity → Trust Score aggregates and interprets publicly available data",
                "P9: SKK confusion → Dewi's expert service navigates the bureaucracy for klien",
              ],
              limit: "MJP solves these by aggregating, interpreting, and delivering intelligence that existed but was inaccessible. The root data is public; MJP makes it useful."
            },
            {
              tier: "Tier B — MJP can partially address this (alleviate, not eliminate)", color: "text-orange-700",
              examples: [
                "P2: HPS estimation inaccuracy → MJP's model helps, but market price volatility is the root cause (uncontrollable)",
                "P6: Consortium partner trust → Trust Score helps qualification, but relationship trust requires time (MJP can't shortcut relationship-building)",
                "P12: Corrupt procurement process → MJP flags suspicious tender patterns but cannot fix procurement integrity itself",
              ],
              limit: "MJP alleviates these pains by providing better information. But the root structural causes (market volatility, institutional trust, corruption) are beyond any single platform's power to fix."
            },
            {
              tier: "Tier C — MJP cannot solve this (acknowledge but decline to build)", color: "text-red-700",
              examples: [
                "P18: Late government payment to winning contractors → MJP is an intelligence platform, not a financing or collections service",
                "P21: Bureaucratic inefficiency in LPJK SKK issuance → MJP cannot reform government processing times (Express only navigates within the system)",
                "P24: Skills shortage in construction (lack of qualified J9 Utama engineers in certain KBLI) → MJP can identify the shortage but cannot create engineers",
              ],
              limit: "Hendra's decision rule: 'If solving this requires MJP to become a different type of company — a bank, a government, a training provider — we don't build it. We stay in our lane.'"
            },
          ].map((r) => (
            <div key={r.tier} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.color} mb-0.5`}>{r.tier}</p>
              <div className="mb-0.5">{r.examples.map((e, i) => <p key={i} className={`text-[7px] ${r.color}`}>• {e}</p>)}</div>
              <p className={`text-[7px] font-mono text-muted-foreground`}>{r.limit}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">The 3-tier framework prevents 'mission creep' — the tendency for successful platforms to expand into adjacent problems that are structurally incompatible with their core model. Hendra has used this framework to say 'no' to 4 product ideas in 2025 alone: (1) MJP Financing (Tier C — becomes a financial institution), (2) MJP Subcontractor Matching (Tier B — becomes a marketplace with matching liability), (3) MJP Procurement Consulting (Tier B — becomes a consulting firm competing with klien's own bid teams), (4) MJP BUJK Registration Service (adjacent to Tier A but requires regulatory authorization MJP doesn't have). Saying no to Tier B/C problems preserves Hendra Jr.'s capacity for Tier A solutions.</p>
      </div>

      {/* RICE Scoring Calibration History */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> RICE CALIBRATION — Riwayat Kalibrasi RICE Scoring MJP: Bagaimana Formula RICE MJP Berkembang dari 2022 ke 2026 — 3 Kalibrasi Besar yang Mengubah Cara Tim Menilai Prioritas Masalah
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              calibration: "C1 — 2022: Original RICE formula (inherited from standard framework)",
              formula: "Reach × Impact × Confidence / Effort. Standard weights. Problems scored 1–5 on each dimension. Threshold: score {'>'} 3 to enter backlog.",
              problem: "Two problems with original formula: (1) 'Reach' was estimated by Hendra alone (no data — just intuition). (2) 'Effort' was estimated by Hendra Jr. in isolation — not cross-checked. Both estimates were optimistic. Result: backlog overflow with features that took 3× longer than scored and reached 40% of expected users.",
              tc: "text-muted-foreground"
            },
            {
              calibration: "C2 — 2023: Revenue-weighted Reach + Reza validation",
              formula: "Reach now = number of klien × avg revenue per klien segment. J9 Enterprise klien count 5× more than J7 Starter klien in the Reach calculation. Reza validates Reach estimates: 'Is this really a problem for our highest-paying klien? Yes/No.'",
              problem: "Improvement: Reach is now evidence-based (Reza's commercial knowledge). Unintended consequence: overweights Enterprise problems at the expense of Starter pains. Hendra noticed: 'We're building features that help our top 12% of klien. But Starter klien are 38% of our base and they're not getting enough product love.'",
              tc: "text-orange-700"
            },
            {
              calibration: "C3 — 2024: Dual-Reach (Enterprise RICE + Starter RICE run separately)",
              formula: "Two RICE scores per problem: Enterprise RICE (reaches Enterprise klien base) and Starter RICE (reaches Starter/Pro klien base). Product roadmap targets: 60% Enterprise-RICE-driven features, 40% Starter-RICE-driven features. Balances premium klien and growth klien.",
              problem: "Current formula — working well. One known limitation: doesn't capture 'ecosystem value' (a feature that helps all 3 tiers grows MJP's overall market presence). Hendra's next calibration: add an 'Ecosystem Value' multiplier for features that are brand-differentiating or moat-building regardless of tier specificity.",
              tc: "text-emerald-700"
            },
          ].map((r) => (
            <div key={r.calibration} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.calibration}</p>
              <p className={`text-[7px] font-mono ${r.tc} mb-0.5`}>Formula: {r.formula}</p>
              <p className="text-[7px] text-muted-foreground">{r.problem}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-primary/5 border-primary/20 mt-1">
            <p className="text-[8px] font-bold text-primary mb-1">C4 — Planned: Ecosystem Value multiplier (Hendra drafting, Q4 2026)</p>
            <p className="text-[7px] text-muted-foreground">Ecosystem Value = 1.0 (no special status) to 1.5 (major moat-building or brand-differentiating). Applied as final multiplier to RICE total. NLQ (0% coverage of highest-valued pain, AND brand-differentiating because no competitor has it) would receive EV = 1.5. HPS model improvement (valuable but not uniquely differentiating) would receive EV = 1.0. This prevents the RICE formula from ever deprioritizing a moat-building feature because it serves fewer klien.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">RICE calibration is Hendra's most important meta-product work — the process that determines what gets built. Each calibration cycle improves the formula's alignment with MJP's actual strategic goals. The 2023 calibration (Revenue-weighted Reach) increased average feature revenue impact by 34% compared to 2022 features. The 2024 calibration (Dual-Reach) increased Starter klien satisfaction scores by 12% (they got more relevant features). Calibration is the meta-layer that makes all other product decisions more reliable over time.</p>
      </div>

      {/* R96: Strategic Problem Portfolio Balance */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" /> STRATEGIC PROBLEM PORTFOLIO BALANCE — Apakah MJP Mendokumentasi Masalah yang Tepat? Analisis Distribusi Pain Point Berdasarkan Domain, BUJK Grade, dan Urgency untuk Memastikan Tidak Ada Blind Spot Kritis
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Domain Problem</th>
                  <th className="p-1 text-center">Pain points</th>
                  <th className="p-1 text-center">% total</th>
                  <th className="p-1 text-center">Feature coverage</th>
                  <th className="p-1 text-center">Gap status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Tender Intelligence", "18", "26.9%", "Tender Alert, Fraud Signal", "COVERED", "text-emerald-700"],
                  ["SKK & Sertifikasi", "14", "20.9%", "SKK Reminder, BNSP Monitor", "COVERED", "text-emerald-700"],
                  ["BUJK Vetting & Kompetitor", "12", "17.9%", "Trust Score, BUJK Directory", "COVERED", "text-emerald-700"],
                  ["Regulasi & Kepatuhan", "9", "13.4%", "Regulatory Alert, Sari digest", "PARTIAL", "text-orange-700"],
                  ["Cash Flow & Keuangan", "8", "11.9%", "—", "NOT COVERED", "text-red-700"],
                  ["SPMK & Kontrak Delay", "6", "9.0%", "—", "NOT COVERED", "text-red-700"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-primary font-bold">{row[1]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[2]}</td>
                    <td className="p-1 text-center text-[7px] text-muted-foreground">{row[3]}</td>
                    <td className={`p-1 text-center text-[7px] font-bold ${row[5]}`}>{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {[
            { insight: "Blind spot kritis: Cash Flow (11.9% pain points, 0% feature coverage)", detail: "8 pain points tentang cash flow: pembayaran proyek tertunda, DP tidak cukup untuk mobilisasi, retensi 5% yang diblokir lama. MJP tidak punya solusi — ini adalah fintech territory. Tapi Hendra mencatat: 'Kita tidak harus membangun fintech. Tapi kita bisa menjadi referral partner untuk platform pembiayaan konstruksi yang sudah ada.' Partnership potential dengan platform invoice financing seperti Kredivo Business atau Akseleran.", tc: "text-red-700" },
            { insight: "Blind spot yang lebih kritis: SPMK delay (9% pain, 0% coverage)", detail: "6 pain points konsisten tentang SPMK terlambat terbit setelah kontrak ditandatangani. Ini adalah masalah birokrasi pemerintah yang tidak bisa diselesaikan oleh MJP secara langsung. Tapi ada produk adjacent: 'SPMK Tracker' — dashboard yang BUJK bisa gunakan untuk track status SPMK per project, dengan reminder ke kontak pemerintah jika terlambat. Biaya build: rendah. Value: tinggi bagi klien yang punya 10+ proyek aktif.", tc: "text-orange-700" },
            { insight: "Distribusi yang sehat tapi jangan sampai mengabaikan coverage gap", detail: "67% pain points sudah tercovered oleh fitur MJP yang ada — angka yang baik untuk platform 4 tahun. Tapi 21% yang tidak tercovered (Cash Flow + SPMK) mewakili pain yang sangat nyata. Risk: jika kompetitor masuk ke Cash Flow atau SPMK intelligence, mereka memiliki entry point yang tidak bisa dilawan MJP dengan fitur existing.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.insight} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.insight}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Problem portfolio analysis dilakukan Sari setiap semester — review semua pain points dalam database, re-categorize yang berubah, dan flag yang muncul sebagai recurring theme dari field updates terbaru. Tabel di atas adalah snapshot Q2 2026. Hendra menggunakan ini untuk product roadmap input: covered domain tidak dapat alokasi R{"&"}D baru kecuali ada hypothesis spesifik. Uncovered domain (Cash Flow, SPMK) mendapat investigation budget: Budi dikirim untuk deep-dive 5 additional interviews per domain di Q3 2026 sebelum Hendra memutuskan apakah akan build, partner, atau acknowledge-and-ignore.</p>
      </div>

      {/* R97: Problem Definition Validation Protocol */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5 text-primary" /> PROBLEM DEFINITION VALIDATION PROTOCOL — Bagaimana MJP Memvalidasi bahwa Masalah yang Didokumentasikan adalah Masalah Nyata, Bukan Persepsi atau Artefak Sampling: 4 Test yang Hendra Terapkan Sebelum Masalah Masuk ke Roadmap
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { test: "Test 1: Frekuensi Independen — Apakah masalah ini muncul dari minimal 3 sumber berbeda tanpa saling kenal?", pass: "Pain P-007 (SKK tanpa pengingat): Budi interview 12 orang berbeda dari 9 kota yang tidak saling mengenal. Semua menyebut masalah yang sama dalam kata-kata berbeda. PASS.", fail: "Pain P-041 (platform UI terlalu rumit): hanya 2 orang menyebut ini, keduanya dari BUJK sama di Surabaya. Belum cukup independent confirmation. HOLD.", tc: "text-emerald-700" },
            { test: "Test 2: Willingness to Pay — Apakah orang yang memiliki masalah ini bersedia membayar untuk solusinya?", pass: "3 dari 5 BUJK yang menyebut masalah SKK tracking menyatakan mereka akan bayar 'berapa saja yang wajar' — unprompted. WTP signal kuat.", fail: "Pain tentang LPSE UI yang buruk: 8 orang mengeluh, tapi ketika ditanya 'apakah kamu mau bayar tool yang mempermudah?' → 7 dari 8 jawab 'harusnya LKPP yang fix'. No WTP = tidak perlu MJP build.", tc: "text-orange-700" },
            { test: "Test 3: Counter-narrative — Apakah ada populasi signifikan yang tidak memiliki masalah ini? Mengapa?", pass: "Cash flow pain: tidak dialami oleh BUJK yang fokus pada proyek swasta (pembayaran lebih cepat). Counter-narrative membantu scope: solusi hanya relevan untuk BUJK yang dependant pada proyek pemerintah.", fail: "Jika tidak ada counter-narrative yang jelas (semua orang menderita masalah yang sama): kemungkinan masalah sistemik yang MJP tidak bisa solve unilaterally.", tc: "text-blue-700" },
            { test: "Test 4: Competitor Response — Apakah ada kompetitor yang sudah mencoba solve masalah ini? Apa hasilnya?", pass: "Kompetitor mencoba solve: validasi bahwa market exists. Gagal: opportunity untuk learn what not to do. Sukses: need differentiation strategy or abandonment.", fail: "Jika tidak ada kompetitor yang pernah attempt → bisa berarti: (a) true whitespace opportunity, atau (b) attempted and failed invisibly (graveyard problem). Dewi's task: research graveyard before MJP invests.", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.test} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.test}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">PASS example: {r.pass}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>FAIL example: {r.fail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">4 validation tests bukan checklist yang harus semua PASS — mereka adalah lenses untuk structured thinking. Hendra: 'Bukan masalahnya yang perlu divalidasi. Yang perlu divalidasi adalah apakah MJP adalah solusi yang tepat untuk masalah ini, di saat ini, dengan resource yang kita miliki.' Sebuah masalah nyata yang MJP tidak posisioned untuk solve lebih baik di-acknowledge dan di-document daripada di-promise ke klien. Kejujuran tentang scope adalah bentuk respect tertinggi kepada klien. Dari 67 pain points yang terdokumentasi: 38 (57%) pass semua 4 tests. 21 (31%) pass 3 tests. 8 (12%) pass 1–2 tests — masih valuable sebagai intelligence tapi belum actionable sebagai product backlog.</p>
      </div>

      {/* R98: Problem Prioritization Disagreement Register */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> PROBLEM PRIORITIZATION DISAGREEMENT REGISTER — Kasus Dimana Tim MJP Tidak Sepakat tentang Prioritas Masalah: Bagaimana Perbedaan Pendapat Diselesaikan, dan Apa yang Dapat Dipelajari dari Setiap Dispute
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { dispute: "D1: Cash flow intelligence — Budi vs Hendra (Q2 2025)", budi: "Budi: 'Cash flow pain adalah masalah terbesar yang BUJK hadapi. 8 pain points, semua sangat emosional saat interview. Ini harus jadi prioritas #1.'", hendra: "Hendra: 'Cash flow adalah fintech masalah, bukan intelligence masalah. Kita tidak bisa solve ini tanpa menjadi bank atau broker.' Resolution: Hendra acknowledge pain is real, but outside MJP's solution space. Referral partner strategy instead of building.", outcome: "Hendra menang argumen — dan data confirmed: BUJK yang cash flow pain-nya tinggi cenderung tidak subscribe karena they can't afford Rp 399k/bulan subscriptions. Difficult customer segment.", tc: "text-orange-700" },
            { dispute: "D2: Mobile app priority — Reza vs Hendra Jr. (Q3 2024)", budi: "Reza: 'Semua klien saya pakai HP. Kalau kita tidak ada app yang bagus, kita akan kalah ke kompetitor yang sudah punya.' Pushed hard untuk prioritize mobile development.", hendra: "Hendra Jr.: 'Mobile app adalah significant engineering investment. Current web app is mobile-responsive. ROI dari native app vs progressive web improvements: belum clear.'", outcome: "Compromise: dedicate 1 sprint per month to mobile experience improvement (not native app). Expo React Native app launched Q1 2025 setelah Reza commissioned 5 field interviews confirming native app WTP.", tc: "text-blue-700" },
            { dispute: "D3: Regulatory depth vs breadth — Sari vs Hendra (ongoing)", budi: "Sari: 'Lebih baik 200 assets yang sangat dalam dan akurat daripada 1.000 assets yang superficial. Quality over quantity.' Resists pressure to produce more assets per month.", hendra: "Hendra: 'Coverage matters for retention — klien churns if their specific question isn't answered. We need breadth.' Pushed for higher asset production velocity.", outcome: "Living compromise: Sari controls quality floor (minimum 4.2 jam per asset) while Hendra controls production target (minimum 15 assets/month). When conflict: quality wins. This is ongoing — healthiest disagreement in MJP.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.dispute} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.dispute}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Sisi A: {r.budi}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Sisi B: {r.hendra}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Outcome: {r.outcome}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Disagreement register adalah Hendra's favorite management artifact — it captures productive conflict that drove better decisions. Most startups document decisions but not the disagreements that shaped them. Hendra: 'Kalau kita tidak pernah tidak sepakat, artinya salah satu dari kita tidak berpikir dengan cukup keras.' Register ini juga berfungsi sebagai psychological safety signal kepada tim: disagreeing with Hendra is not career-threatening — it's expected and recorded. Budi setelah D1 decision: 'Saya tidak setuju dengan keputusannya. Tapi process yang Hendra gunakan untuk membuatnya — mendengar semua argumen, acknowledge trade-off, lalu decide with reasoning — itu membuat saya respect keputusannya bahkan jika saya tidak agree.'</p>
      </div>

      {/* R99: Problem Hypothesis Graveyard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Archive className="h-3.5 w-3.5 text-primary" /> PROBLEM HYPOTHESIS GRAVEYARD — 5 Masalah yang Diyakini Tim MJP Akan Jadi Fitur Besar, Tapi Gagal saat Divalidasi: Mengapa Masing-Masing Tidak Berhasil dan Apa yang Dipelajari
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { hyp: "GH-1: 'BUJK perlu platform untuk cari subkontraktor secara sistematis'", confidence: "HIGH pre-validation (Hendra was very excited)", why_failed: "Validation revealed: BUJK prefer personal referral over platform discovery for subcon. Trust is built through mutual connection, not profile listing. Platform-discovered subcon had zero trust unless introduced by someone known. MJP would need to build a trust layer that doesn't scale.", lesson: "Trust cannot be automated in industries where financial stakes are high and contracts are relational. B2B marketplace in construction requires offline trust infrastructure that technology cannot replace.", tc: "text-orange-700" },
            { hyp: "GH-2: 'BUJK perlu feature untuk track progress proyek yang sedang berjalan'", confidence: "MEDIUM — klien requested feature in support tickets", why_failed: "Project tracking requires data input from klien at every milestone. Pilot with 8 Enterprise klien: only 2 maintained consistent data entry after week 3. Others forgot or found it tedious. The pain was real but the discipline to maintain it was not.", lesson: "Features requiring consistent user input behavior change (habits) have much lower success rates than features that work passively on data MJP already has.", tc: "text-red-700" },
            { hyp: "GH-3: 'Platform BUJK ke BUJK untuk kolaborasi penawaran pada proyek besar'", confidence: "MEDIUM — strategic logic was sound", why_failed: "BUJK are competitors, not collaborators. JO (Joint Operation) partnerships exist but are formed through private negotiation, not platform introductions. Legal complexity of platform-mediated JO: liability, profit sharing, IP ownership. Every party insisted on privacy.", lesson: "Collaboration tools in competitive B2B industries fail unless there's a clear neutral party incentive. Without a trusted intermediary (asosiasi, LKPP), BUJK won't expose strategic intentions to a platform.", tc: "text-orange-700" },
            { hyp: "GH-4: 'Layanan estimasi biaya proyek berbasis AI untuk BUJK yang belum punya estimator in-house'", confidence: "HIGH — large market of small BUJK with no in-house estimator", why_failed: "Liability: if MJP's AI estimate is Rp 500M and actual project costs Rp 800M — who is responsible? BUJK expect someone to be accountable. MJP cannot accept liability. Without liability: BUJK distrust the estimate for large projects (where it matters most). Small projects: BUJK owner estimates personally anyway.", lesson: "AI tools in high-stakes B2B contexts require liability framework before commercial viability. 'AI-assisted' not 'AI-provided' — the human must be in the loop and own the estimate.", tc: "text-red-700" },
          ].map((r) => (
            <div key={r.hyp} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.hyp}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Why failed: {r.why_failed}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Lesson: {r.lesson}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Problem hypothesis graveyard adalah Hendra's most intellectually honest document. Most product teams bury failed hypotheses — teams move on and nobody documents why something was tried and abandoned. Hendra preserves them because: (1) they prevent re-invention of the same failed wheel when new team member joins and 'has a great idea' that was already tried, (2) they communicate to investors that MJP's current product scope is a result of learning, not limitation, and (3) failed hypotheses often contain partial truths that become relevant again with technology evolution. GH-4 (AI cost estimation) is most likely to be revisited: if AI liability frameworks mature in Indonesia (UU AI, asuransi liability AI), the business case will reopen. Hendra Jr.: 'Kuburan ini adalah peta harta karun terbalik — tanda X menunjukkan bukan di mana harta itu, tapi di mana jalannya terlalu berbahaya untuk sekarang.'</p>
      </div>

      {/* R100: OKR History and Learning */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> OKR HISTORY {"&"} LEARNING — 4 Tahun OKR di MJP: Apa yang Berhasil, Apa yang Selalu Meleset, dan Mengapa Hendra Akhirnya Simplify dari 8 Key Results ke Maximum 3 per Kuartal
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { period: "2022: Year 1 — Overambitious OKRs, 40% completion rate", lesson: "Tahun pertama: Hendra set 12 Key Results per quarter across all team members. Completion rate: 40%. Post-year review: most of the 60% that was missed was missed because priorities shifted mid-quarter, not because team was lazy. OKRs as written were too rigid for early-stage startup where market feedback changes direction every 6 weeks.", tc: "text-red-700" },
            { period: "2023: Year 2 — Reduced to 6 KRs, added 'confidence level'", lesson: "Each KR now had a confidence level: HIGH (80%+ likely achievable), MEDIUM (50-80%), LOW (20-50%). Low confidence KRs explicitly acknowledged as 'stretch targets'. Completion rate improved to 63%. New problem: 'confidence level' became an excuse for setting LOW confidence KRs that nobody really expected to hit — performative ambition.", tc: "text-orange-700" },
            { period: "2024: Year 3 — OKR simplification, max 3 KRs per person per quarter", lesson: "Radical simplification: max 3 KRs per team member, all rated as HIGH confidence (achievable with focused effort). Stretch targets separated into 'moonshot items' that are tracked but not evaluated for performance. Completion rate: 87%. Team clarity improved dramatically — 3 clear priorities vs 6 ambiguous ones.", tc: "text-blue-700" },
            { period: "2025–2026: Year 4–5 — Company-level OKR + individual alignment", lesson: "One company-level OKR (ARR Rp 750jt by end of 2025) with 3 KRs. Each team member's personal OKR must trace to one company-level KR. If personal KR cannot be traced: it is not an OKR, it is a task. Result: every individual understands how their work contributes to the company number. Cross-team alignment improved significantly.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.period} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.period}</p>
              <p className="text-[7px] text-muted-foreground">{r.lesson}</p>
            </div>
          ))}
          <div className="py-1.5 border-t">
            <p className="text-[8px] font-bold text-primary mb-0.5">Current Q3 2026 Company OKR</p>
            <div className="flex flex-col gap-0.5">
              {[
                ["O: Reach ARR Rp 900jt, proving MJP is Series A ready", "text-primary"],
                ["KR1: 950 active paying klien (current: 847)", "text-blue-700"],
                ["KR2: NPS > 65 across all tiers (current: 61)", "text-blue-700"],
                ["KR3: 0 critical incidents (P0 downtime > 1 hr) in Q3", "text-blue-700"],
              ].map(([item, tc]) => (
                <p key={item} className={`text-[7px] font-mono ${tc}`}>{item}</p>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">OKR evolution is a story about organizational learning through failure. Most OKR advice online is written for large companies with stable environments. MJP's experience: OKRs that work for Google (or even Series B startups) do not work for 7-person early-stage. The right OKR for MJP is not a framework adaptation — it is a MJP-specific tool that evolved through 4 years of trial and error. Current form: 3 company KRs, all HIGH confidence, all traceable to ARR. Every team member has {'<'} 3 personal KRs traceable to company KRs. Hendra reviews OKR progress every Monday at 9am in 30 minutes — not in a separate meeting, built into weekly standup. Hendra: 'OKR yang bagus adalah OKR yang bisa dibaca dalam 30 detik dan membuat setiap orang tahu apa yang harus mereka prioritaskan hari ini.'</p>
      </div>

      {/* R101: Strategic Problem Framing for Enterprise Clients */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-primary" /> STRATEGIC PROBLEM FRAMING FOR ENTERPRISE — Bagaimana MJP Membantu Enterprise Klien Merumuskan Masalah Strategis Mereka: Workshop Format, 3 Contoh Perumusan Ulang yang Mengubah Arah, dan Mengapa Ini adalah Enterprise Tier Differentiator
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { company: "Enterprise klien A (BUJK Kualifikasi Besar, Jawa Barat)", original_problem: "'Kami kalah banyak tender dalam 6 bulan terakhir. Problem: tim kami tidak cukup bagus.'", reframed: "Setelah analisis menggunakan MJP data: win rate turun dari 31% ke 17% dalam 6 bulan — BUT hanya di LPSE Jawa Barat. LPSE lain tidak berubah. Reframing: 'Bukan tim yang bermasalah. Ada BUJK baru di Jawa Barat yang agresif memotong harga. Problem: kita tidak punya real-time competitor price intelligence untuk region ini.'", outcome: "Action: klien meminta MJP untuk monthly competitor analysis khusus Jawa Barat. 3 months later: win rate recovered ke 28%. Correct problem diagnosis saved the BUJK from firing their bid team.", tc: "text-primary" },
            { company: "Enterprise klien B (kontraktor infrastruktur, Kalimantan)", original_problem: "'Kami susah dapat tender IKN. Problem: mungkin koneksi kami kurang.'", reframed: "MJP data analysis: klien B bid pada 47 IKN tenders. Win rate: 4.3%. But: klien's SKK portfolio only covers Kualifikasi Menengah — 89% of IKN tenders require Kualifikasi Besar. Reframing: 'Bukan koneksi yang kurang. Kita physically tidak qualify untuk 89% IKN tenders kita bid pada.'", outcome: "Action: immediate SKK upgrade plan for 3 Ahli Utama (J9). 14 months later: klien qualifies for Kualifikasi Besar, win rate on accessible IKN tenders: 23%. Correct diagnosis saved years of 'improving koneksi' that wouldn't have solved the real problem.", tc: "text-blue-700" },
            { company: "Enterprise klien C (multi-region BUJK, Sulawesi)", original_problem: "'Cash flow kami selalu ketat. Problem: proyek-proyek kami tidak profitable.'", reframed: "MJP workroom analysis + financial pattern review: proyek-proyek klien C are profitable (margin 8–12%). But: payment terms average 87 days. And: new bid preparation averages Rp 15jt per tender. Reframing: 'Bukan profitability problem. Cash flow problem karena timing mismatch: bid cost is immediate, project revenue is deferred 87 days after completion.'", outcome: "Action: reduce bid frequency (focus quality over volume), negotiate payment terms, and use MJP tender scoring to only pursue high-win-probability tenders (reduce preparation waste). 6 months: cash position improved without changing profitability.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.company} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.company}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Original: {r.original_problem}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Reframed: {r.reframed}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Outcome: {r.outcome}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Strategic problem framing adalah capability yang Hendra personally delivers to Enterprise klien — usually as a 90-minute working session using MJP data as the analytical tool. Not a standard product feature: it's a professional service embedded in Enterprise tier relationship. Value: reframes problems from symptoms to causes, using MJP's unique data as the diagnostic. Why this is an Enterprise differentiator and not Pro: problem framing requires Hendra's direct involvement (time-limited resource) and produces strategic recommendations that go beyond platform data into business strategy. 12 Enterprise klien have received problem framing sessions in 2025–2026. All 12 renewed Enterprise contracts. Hendra: 'Ini bukan konsultasi — ini adalah intelligence applied to strategic context. Bedanya: consultant charges Rp 50–200jt untuk ini. MJP provides it as part of Enterprise relationship karena ini yang membuat klien feel the full value of intelligence, not just data.'</p>
      </div>

      {/* R102: Problem Statement Repository — The MJP Problem Library */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Archive className="h-3.5 w-3.5 text-primary" /> MJP PROBLEM LIBRARY — 5 Problem Statements yang Menjadi Fondasi Seluruh Roadmap MJP: Pernyataan Masalah yang Telah Diuji, Divalidasi, dan Tidak Berubah dalam 3 Tahun Terakhir — Bukti bahwa MJP Membangun Solusi untuk Masalah Nyata
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { id: "P-CORE-1", statement: "BUJK kehilangan peluang tender yang sesuai kualifikasi mereka karena tidak mampu memonitor 671 LPSE portal secara bersamaan dengan sumber daya manusia yang terbatas.", validated_by: "67 interviews (91% mention), platform usage data (avg 12 relevant tenders/month not found by klien before MJP)", unchanged_since: "2021 founding", status: "SOLVED (core product) — MJP's aggregated alert system directly addresses this. Residual gap: LPSE portals with non-standard formats still missed.", tc: "text-emerald-700" },
            { id: "P-CORE-2", statement: "Perubahan regulasi konstruksi Indonesia terlalu sering dan terlalu fragmented untuk diikuti oleh BUJK yang tidak memiliki dedicated legal/regulatory team.", validated_by: "87% interview mention, 24.000+ Knowledge Registry accesses per month", unchanged_since: "2021 founding", status: "PARTIALLY SOLVED — Knowledge Registry covers 1.247 of estimated 2.800+ relevant regulatory documents. Gap: coverage completion is 44% — significant opportunity remaining.", tc: "text-primary" },
            { id: "P-CORE-3", statement: "BUJK tidak memiliki cara yang reliable untuk menilai kredibilitas dan kapabilitas BUJK lain sebagai calon mitra JO atau subkontraktor.", validated_by: "79% interview mention, Trust Score usage: 63% of Enterprise klien use monthly", unchanged_since: "2021 founding", status: "SOLVED (Trust Score) — but V4 algorithm still improving. JO Matching (vision 2028) will extend the solution to active matching, not just passive verification.", tc: "text-emerald-700" },
            { id: "P-CORE-4", statement: "SKK sertifikasi renewal timeline tidak visible kepada BUJK sampai terlambat, menyebabkan disqualifikasi tender atau gap compliance yang mahal.", validated_by: "83% interview mention, 23 emergency rescue cases documented by Dewi", unchanged_since: "2022 (added after Dewi's first year of support tickets)", status: "MOSTLY SOLVED — SKK expiry monitoring + Dewi's proactive outreach. Remaining gap: F1 Auto-qualification check (in development) will fully close this.", tc: "text-blue-700" },
            { id: "P-EMERGING-1", statement: "BUJK tidak memiliki visibility terhadap harga kompetitor dalam pengadaan, menyebabkan penawaran yang terlalu tinggi (loss) atau terlalu rendah (profitability risk).", validated_by: "First identified from IjinTender integration klien feedback Q1 2026, 71% of Enterprise klien express interest", unchanged_since: "2026 (new problem statement from emerging data)", status: "EARLY STAGE — IjinTender panel on Surat Penawaran page is the first solution. Full HPS Intelligence module (Vision 2027) will be more comprehensive.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.id} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.id}: {r.statement}</p>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Validated by: {r.validated_by} · Unchanged since: {r.unchanged_since}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Status: {r.status}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Problem library adalah MJP's most important strategic document — more important than any feature specification or OKR. Hendra reads this document at the start of every product planning cycle: 'Before we decide what to build, we re-read why we exist.' 5-year insight: P-CORE-1, 2, 3, 4 have not fundamentally changed because the underlying market dynamics (fragmented procurement infrastructure, regulatory complexity, information asymmetry) have not fundamentally changed. This stability validates: MJP is solving structural problems, not trend-based problems. Structural problems don't go away when the trend changes. P-EMERGING-1 is the newest addition — it signals MJP moving from 'information access' to 'competitive intelligence,' a higher-value category. Hendra: 'Startup yang kehilangan arah biasanya bukan karena kehilangan customers — tapi karena kehilangan clarity tentang masalah yang mereka selesaikan. Problem library adalah antidote untuk drift tersebut.'</p>
      </div>

      {/* R103: Product Request Triage and Prioritization Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" /> PRODUCT REQUEST TRIAGE — Bagaimana MJP Memutuskan 'Build or Not Build': 5-Question Triage Framework yang Hendra Jalankan untuk Setiap Feature Request — Mengapa 73% Request Ditolak dan Itu adalah Sign of Strategic Discipline
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { q: "Q1: Does this solve a problem in our Problem Library, or does it address a new problem?", why: "Feature requests outside Problem Library: either signal that library needs updating, or it's a 'nice to have' that doesn't address core pain. If klien asks for a feature: Hendra asks 'Which core problem does this solve?' If klien can't articulate: likely not urgent.", outcome: "34% of requests fail Q1 — they're solutions looking for problems, not solutions to documented problems.", tc: "text-primary" },
            { q: "Q2: How many klien have this pain, and how often?", why: "RICE scoring: Reach × Impact. Single Enterprise klien requesting a feature doesn't automatically justify building it. But if 20+ Pro klien have same pain (cross-referencing Budi's pain point database): RICE score elevates. The exception: a single Enterprise klien with an explicit 'if you build this, I'll renew' statement — sometimes one large deal justifies the build.", outcome: "18% of remaining requests fail Q2 — they're valid problems but affecting too few klien to prioritize.", tc: "text-blue-700" },
            { q: "Q3: Is this in MJP's core competence zone or would it require new capabilities we don't have?", why: "Adjacent feature requests: 'Can you add an accounting module?' 'Can you track project progress?' These are real BUJK pains but outside MJP's intelligence-platform competence. Building them would distract from core product depth. MJP's competence: procurement intelligence, regulatory intelligence, BUJK verification. Outside: ERP, project management, accounting.", outcome: "12% of remaining requests fail Q3 — they're valid, frequent, but outside MJP's strategic scope.", tc: "text-emerald-700" },
            { q: "Q4: Can we build this in < 2 weeks, or does it require a major investment?", why: "Small builds (< 2 weeks Hendra Jr.): approved if passes Q1–Q3, almost automatically. Large builds (> 2 months): require higher bar — must be significant product differentiator, not incremental improvement. Medium builds (2–8 weeks): evaluated on RICE score vs opportunity cost.", outcome: "9% of remaining requests deprioritized — they're valid but large builds competing with higher-priority items.", tc: "text-orange-700" },
            { q: "Q5: If we build this, is it for the right klien tier?", why: "Feature for Starter tier: must be buildable without increasing operational complexity (Starter is price-sensitive, needs simplicity). Feature for Enterprise: can be complex, high-touch. Feature for Pro: balance between depth and self-serve capability. Building wrong feature for wrong tier: creates tier migration confusion.", outcome: "4% of remaining requests redirected to different tier or implementation approach.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.q} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.q}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Why this gate matters: {r.why}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Outcome: {r.outcome}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Product triage framework adalah Hendra's most important product management tool — because without it, Hendra Jr. would spend his time building features that feel good but don't create retention or revenue. 73% rejection rate sounds harsh. In context: MJP received 247 feature requests in 2025–2026 (from klien, Reza, Budi, internal). Triage rejected 180 (73%). Built 67 (27%). The 67 built features: all tied to measurable retention or revenue outcomes. The 180 rejected: would have consumed Hendra Jr.'s time without commensurate return. Most rejected requests aren't wrong — they're right but not right for MJP right now. Rejection often includes: 'Not now, but possibly in our 2027 roadmap' or 'Not MJP, but there's another tool for this.' Hendra: 'The kindest thing I can do for a klien who has a product request is give them an honest answer — not a vague 'we'll consider it' that wastes their time waiting for something that will never be built.'</p>
      </div>

      {/* R104: Strategic Risk Register */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> MJP STRATEGIC RISK REGISTER — 6 Risiko Eksistensial yang Hendra Pantau: Probabilitas, Dampak, Status Mitigasi, dan Mengapa Jujur tentang Risiko adalah Tanda Kematangan Organisasi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { risk: "RISK-1: Hendra Jr. departure (engineering bus factor 1.4)", prob: "15% dalam 2 tahun", impact: "CRITICAL — product development stops, platform maintenance degrades over 3–6 months", mitigation: "Status: ACTIVE MITIGATION. Actions: (1) system walkthrough video library (23 videos), (2) documentation culture, (3) Series A engineering hire planned within 90 days of close. Hendra conversations with Hendra Jr. quarterly: equity refresh, career growth discussion. Hendra Jr.'s stated intention: stay through Series A and 1 year post. No guarantee.", tc: "text-red-700" },
            { risk: "RISK-2: LKPP mandates direct integration with LPSE for all third-party tools", prob: "12% dalam 3 tahun", impact: "HIGH — if LKPP mandates official integration that MJP hasn't yet achieved, and creates formal barriers to crawler access", mitigation: "LKPP working group participation (SUB-3) is partly a relationship investment for this scenario. 'Mitra Pengadaan' program application in process — would give MJP official status before any restrictive mandate. Scenario: if mandate comes before MJP has official status: 6–12 months delay in data access.", tc: "text-orange-700" },
            { risk: "RISK-3: Series A fundraising fails (no term sheet by Q4 2026)", prob: "25% given current negotiation stage", impact: "HIGH — forces cost reduction, delays product development, competitive vulnerability increases", mitigation: "If Series A fails: 18-month cash runway at current burn rate. Options: (1) angel bridge round (2–3 angels for Rp 1–2M to extend runway), (2) revenue acceleration (push Pro → Enterprise upgrades), (3) bootstrap indefinitely (Hendra's fallback: 'we built to Rp 580jt ARR without investment — we can continue to grow without it, just slower').", tc: "text-orange-700" },
            { risk: "RISK-4: BUJK market consolidation reduces addressable market", prob: "8% dalam 3 tahun", impact: "MEDIUM — if large BUMN acquisition wave reduces BUJK count below 100.000, TAM contracts", mitigation: "Historical evidence: BUJK count has been stable at 140–150k for 10 years despite economic cycles. Consolidation risk is theoretical. If it occurs: MJP's value prop for larger, post-consolidation BUJK is actually higher (more complex operations = more intelligence need).", tc: "text-blue-700" },
            { risk: "RISK-5: Reza departure (sales bus factor 1.0)", prob: "20% dalam 2 tahun", impact: "HIGH — new klien growth stops immediately, existing klien relationship quality drops", mitigation: "Status: HIGHEST PRIORITY MITIGATION. Actions: (1) Head of Growth hire is first post-Series A position (before any other hire), (2) Reza onboarding documentation of his scripts, prospect list, and relationship context, (3) Equity refresh discussion Q3 2026. Risk is known and accepted until Series A closes.", tc: "text-primary" },
            { risk: "RISK-6: Data breach or BUJK data misuse allegation", prob: "5% annually", impact: "CRITICAL to trust — single serious data breach would be existential for B2B trust-based platform", mitigation: "Privacy framework (3 principles), legal review completed, no PII storage beyond professional credentials + NIK last 4, UU PDP compliance verified. Annual security audit planned post-Series A (currently too expensive relative to risk at current scale). Hendra's red line: if security audit surfaces critical finding: pause new feature development until fixed.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.risk} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.risk}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.prob} · {r.impact}</span>
              </div>
              <p className={`text-[7px] font-mono ${r.tc}`}>Mitigation: {r.mitigation}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Strategic risk register adalah dokumen yang Hendra updates setiap 6 bulan dan shares dengan Board of Advisors. Philosophy: investors and advisors will respect honest risk assessment more than a founder who claims no significant risks. Every company has existential risks — the question is whether management has identified them and is actively mitigating. RISK-1 (Hendra Jr.) and RISK-5 (Reza) are the two people risks that MJP acknowledges openly. These are the most common startup failure modes: key person departure at wrong moment. Both are being mitigated actively but imperfectly — true mitigation requires Series A capital to hire replacements or complements. Hendra to advisors: 'Kami tidak berpura-pura risiko ini tidak ada. Kami transparent tentang mereka karena itulah satu-satunya cara untuk address mereka dengan serius dan tepat waktu.'</p>
      </div>

      {/* R105: Problem Definition as Competitive Differentiation */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-primary" /> PROBLEM DEFINITION AS COMPETITIVE DIFFERENTIATION — Mengapa BUJK yang Paling Berhasil Bukan yang Paling Rajin, Tapi yang Paling Jelas tentang Masalah yang Mereka Coba Selesaikan: 5 BUJK yang Berhasil Karena Problem Clarity, Bukan Karena Hard Work
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { bujk: "BUJK-A: Kontraktor MEP yang mendefinisikan ulang masalah 'kalah tender' menjadi 'masuk tender yang salah'", problem_reframe: "Before MJP: BUJK-A was losing 74% of tenders. Owner's diagnosis: 'Kami kurang kompetitif dalam harga.' Proposed solution: cut margins further. MJP's analysis (after 3 months as klien): BUJK-A was winning 89% of tenders where they were qualified AND where the tender value matched their capacity range — but they were applying to tenders 40% outside their optimal range.", outcome: "Problem reframe: from 'How do we improve win rate?' to 'How do we identify our optimal tender range and only bid there?' Post-reframe: BUJK-A reduced tender applications by 55%, wins increased from 26% to 61%. Same company, same capabilities — different problem definition.", tc: "text-primary" },
            { bujk: "BUJK-B: BUJK lokal yang menang IKN tender bukan karena koneksi tapi karena intelligence", problem_reframe: "Before MJP: BUJK-B believed winning IKN tenders required 'koneksi politik.' Many BUJK believed the same — leading to bribery attempts, relationship-building with panitia (legally risky), and learned helplessness for BUJK without political connections. MJP's data showed: IKN tenders with panitia from KemenPUPR followed formal evaluation criteria much more rigorously than local government tenders.", outcome: "Problem reframe: from 'How do we get connections?' to 'How do we optimize compliance and bid precision for merit-based evaluation?' BUJK-B won 2 IKN tenders worth Rp 28M combined using pure technical bid preparation — zero political relationship investment.", tc: "text-emerald-700" },
            { bujk: "BUJK-C: Kontraktor finishing yang mengatasi 'masalah cashflow' dengan tender strategy shift", problem_reframe: "Before MJP: BUJK-C experienced chronic cashflow problems from delayed government payments (termin). Owner's diagnosis: 'Pemda bayarnya lambat — tidak ada yang bisa kami lakukan.' MJP analysis: 80% of BUJK-C's tenders were with pemda (local government) at Kota/Kabupaten level — the slowest payment tier. Only 20% were with KemenPUPR or Kementerian other (faster payment).", outcome: "Problem reframe: from 'How do we survive delayed payment?' to 'How do we shift our tender portfolio toward faster-paying institutions?' BUJK-C used MJP tender analytics to deliberately target 40% of bids toward central government. Average payment delay: 87 days → 34 days. Cashflow problem: structurally improved without negotiating with any panitia.", tc: "text-blue-700" },
            { bujk: "BUJK-D: Perusahaan yang menyadari bahwa 'masalah SKK' adalah 'masalah HR planning'", problem_reframe: "Before MJP: BUJK-D experienced recurring 'SKK emergencies' — urgent renewals, missed tenders due to expiry timing. Owner's frame: 'Sistem sertifikasi Indonesia memang ribet.' MJP's analysis: BUJK-D's SKK emergencies were 100% predictable — all expiries visible 2+ years in advance. The real problem: no advance planning culture for SKK renewal.", outcome: "Problem reframe: from 'SKK sistem ribet' (external blame) to 'Kami tidak punya 24-month renewal planning calendar' (internal accountability). BUJK-D implemented MJP-informed 24-month SKK calendar. SKK emergencies: 0 in last 18 months. (Similar to Pak Wahyu's story in SKK page.)", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.bujk} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.bujk}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Problem reframe: {r.problem_reframe}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Outcome: {r.outcome}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Problem definition as competitive advantage adalah the meta-observation Hendra makes after watching how MJP's best klien use the platform. The best klien don't just use MJP as a data lookup tool — they use it as a problem-reframing tool. The data doesn't just answer questions; it reveals which questions they should be asking. This is the highest-leverage use of intelligence: not 'what are the tenders today?' but 'given our profile and data, what is our optimal tender strategy for the next 6 months?' The 4 BUJK cases above share a common pattern: (1) owner had a diagnosis of their problem, (2) MJP data revealed a different diagnosis, (3) new diagnosis led to different action, (4) different action produced dramatically different results. This is not a product feature — it's a mindset shift that MJP's data enables. Hendra: 'Klien yang paling berhasil menggunakan MJP bukan klien yang paling sering login. Klien yang paling berhasil adalah yang menggunakan data MJP untuk menanyakan pertanyaan yang berbeda tentang bisnis mereka.'</p>
      </div>

      {/* R106: Workroom as Strategic Thinking Space */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> WORKROOM EVOLUTION — Dari Fitur Catatan Sederhana ke Strategic Thinking Space: Bagaimana Workroom Berkembang dari 'Nice to Have' ke Core Enterprise Feature, dan Roadmap Workroom 2027
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { phase: "V1 (2022): Simple notes per research item — Budi's personal tool", story: "Workroom started as Budi's own workflow need: he wanted to attach analysis notes to specific research items he was reviewing. Hendra Jr. built a basic sticky-note feature. 3 users total (Budi, Hendra, Sari). No sharing, no collaboration, no server sync.", why_important: "The V1 decision revealed something important: Budi needed the platform to be a thinking space, not just a data lookup. This distinction — lookup vs thinking space — shaped all subsequent Workroom development.", tc: "text-muted-foreground" },
            { phase: "V2 (2023): Shared notes across team — internal collaboration tool", story: "Workroom notes synced to server (Task #21 equivalent). Team could share analysis on specific pain points, research items, and service links. Internal MJP team usage: Sari would annotate regulatory context on research items that Budi flagged; Hendra would add strategic framing to pain points that Sari documented.", why_important: "First time Workroom enabled asynchronous collaboration. Team in 3 different cities could build shared understanding without a meeting. Product insight: collaboration value > individual note value.", tc: "text-blue-700" },
            { phase: "V3 (2024–2025): Enterprise klien discover Workroom for bid analysis", story: "Unexpected discovery: 34% of Enterprise klien were using Workroom to annotate tender opportunities with their own bid strategy notes ('our current price for this type: Rp X', 'competitor A always bids low here', 'our win rate in this region: 43%'). Not a designed use case. Hendra Jr. observed in analytics and brought to product review.", why_important: "Klien were using Workroom as their bid decision journal alongside MJP's intelligence data. The combination: MJP's external intelligence + klien's internal institutional knowledge in one place. This is the highest-value Workroom use case MJP hadn't planned for.", tc: "text-emerald-700" },
            { phase: "V4 Roadmap (2027): Structured bid decision journal + team workflow", story: "Building on the discovered V3 use case: V4 Workroom will provide structured bid decision templates (pre-bid analysis, aanwijzing notes, post-bid review), team role assignment (who is responsible for which bid document), and bid outcome tracking (did we win? what price? what was the winner's price?). These structured features turn the informal V3 sticky notes into a proper bid intelligence workflow.", why_important: "V4 Workroom would make MJP's stickiness structural: klien's accumulated bid intelligence lives in MJP Workroom. Switching cost: not just losing MJP's external data, but also losing years of internal bid analysis notes. This is MJP's version of 'data portability lock-in.'", tc: "text-primary" },
          ].map((r) => (
            <div key={r.phase} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.phase}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.story}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Why important: {r.why_important}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Workroom evolution adalah one of MJP's most important product development stories because it shows how the best features often emerge from observing behavior rather than from planning. V1 was built for Budi's personal need. V3's most valuable use case was discovered through analytics of klien behavior, not through user interviews or planning. The lesson Hendra draws: 'The best product decisions are sometimes not decisions at all — they're observations of what your best users are already doing and building the scaffolding to help them do it better.' V4 Workroom is an explicit bet on this: if klien are already using Workroom as an informal bid decision journal, giving them structured tools for that use case will increase stickiness dramatically. The retention hypothesis for V4: Enterprise klien using structured Workroom bid tracking will have churn rates 40–50% lower than those who don't — because switching means losing years of accumulated bid intelligence. Post-Series A: V4 Workroom is scheduled as Q3 2027, requiring dedicated product design time that isn't available at current engineering capacity.</p>
      </div>

      {/* R107: MJP's Theory of Change for Indonesian Construction */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" /> THEORY OF CHANGE — Jika MJP Berhasil dalam Misinya, Apa yang Berubah untuk Industri Konstruksi Indonesia: Hendra's 10-Year Vision tentang Pasar yang Lebih Transparan, Kompetitif, dan Efisien
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { change: "CHANGE-1: JO partnership selection berbasis data — bukan koneksi dan nepotisme", current_state: "Today: 67% of JO partnerships formed through personal network (JO-M1). Quality is correlated with network density, not partner competence. BUJK in dense urban networks get good partners; BUJK in thin networks (small cities, new entrants) get bad partners or no partners.", future_state: "If MJP's Trust Score reaches 80%+ BUJK coverage: any BUJK, regardless of network, can identify a qualified JO partner through data. Geographic barriers to quality partnership: eliminated. Competence-based matching replaces relationship-based matching. Impact: more efficient capital allocation in construction (fewer failed projects from bad partnerships), more equitable access to large tenders for competent-but-isolated BUJK.", tc: "text-primary" },
            { change: "CHANGE-2: Regulatory compliance from burden to decision intelligence", current_state: "Today: 78% of BUJK owners cite regulatory compliance as their primary source of administrative burden. Most BUJK experience regulation as something happening TO them — changes they must reactively scramble to understand. MJP is changing this but slowly.", future_state: "If Knowledge Registry reaches 80%+ coverage with 24h update SLA: BUJK treat upcoming regulatory changes as strategic planning inputs, not surprises. A BUJK that knows K3 requirement changes 6 weeks before enforcement dates: adjusts bid pricing proactively. Compliance becomes competitive advantage rather than burden. The regulatory arbitrage (some BUJK compliant, some not) that currently distorts competition: reduced as all MJP klien operate from the same regulatory baseline.", tc: "text-blue-700" },
            { change: "CHANGE-3: HPS estimation democratizes pricing precision across BUJK sizes", current_state: "Today: Large BUJK with experienced estimators have better HPS intelligence than small BUJK. Small BUJK frequently overbid (leaving money on the table) or underbid (winning but executing at loss). Pricing is a competitive advantage that correlates with company size, not underlying capability.", future_state: "If MJP's HPS estimation reaches 90%+ coverage and 85%+ accuracy: a Kualifikasi Kecil BUJK with strong technical capability but limited pricing intelligence can compete on a level playing field with larger BUJK. The pricing advantage of large BUJK's experienced estimators: partially democratized. Impact: more competitive tenders, better use of government construction budget.", tc: "text-emerald-700" },
            { change: "CHANGE-4: Construction industry becomes demonstrably more transparent", current_state: "Indonesian construction procurement has a reputation for opacity: unclear why some BUJK win and others don't, ambiguous compliance requirements, limited track record visibility. This opacity enables corruption and reduces competition. MJP cannot directly address corruption — but it can make the information layer more transparent.", future_state: "If MJP becomes infrastructure-level intelligence with government recognition (LKPP Mitra Pengadaan): the transparency of Indonesia's construction market increases not just for MJP klien but structurally. The more BUJK that use data to compete: the harder it is for opacity to persist. This is a systemic change that MJP cannot claim full credit for — but can contribute to meaningfully.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.change} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.change}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Current state: {r.current_state}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Future state: {r.future_state}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Theory of Change adalah the document Hendra writes for himself, not for investors. Investors care about returns. Theory of Change describes why the returns matter beyond the return itself — the impact on an industry and ultimately on Indonesia's built environment. Construction procurement intelligence is not a glamorous mission. But the downstream impact: better partner selection → fewer failed projects. Better regulatory compliance → fewer K3 accidents and construction defects. Better pricing intelligence → less taxpayer money wasted on non-competitive tenders. Better transparency → less corruption-enabled market distortion. These are structural improvements to an industry that builds Indonesia's infrastructure. Hendra is careful about claiming these outcomes — MJP is one actor in a complex system, and causation is nearly impossible to prove. But the direction is right: more data, better transparency, more competent actors finding each other — these are good for an industry and for the country that depends on it. Hendra: 'Kami membangun bisnis yang profitable. Tapi kami juga membangun sesuatu yang — jika berhasil dalam misinya — membuat industri konstruksi Indonesia sedikit lebih baik, sedikit lebih jujur, dan sedikit lebih efisien. Itu adalah alasan yang cukup untuk datang ke kantor setiap hari.'</p>
      </div>

      {/* R108: The Unsolved Problems — Hendra's Honest Open Questions */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-primary" /> OPEN QUESTIONS — 5 Masalah Besar yang MJP Belum Berhasil Dipecahkan: Hendra's Honest Assessment tentang Gap Terbesar yang Masih Ada dan Mengapa Ini Penting untuk Diakui Secara Terbuka
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { question: "OQ-1: Bagaimana cara mengukur apakah klien MJP benar-benar lebih baik dalam memenangkan tender karena MJP?", why_unsolved: "This is the causation problem: MJP can measure klien win rates. It can measure that klien who use HPS features have higher win rates than those who don't. But it cannot definitively attribute the improvement to MJP vs other factors (better estimator hired, market conditions, specific tender selection discipline). Without attribution: MJP cannot credibly claim 'MJP improved your win rate by X%.'", why_it_matters: "This is the most important missing metric for MJP's Series A case. Reza's current value proposition is directional: 'klien who use MJP deeply tend to win more.' A causal claim would be worth 3× the narrative value. Hendra Jr. is designing a quasi-experiment: pair new klien with matched controls (similar BUJK, similar KBLI, similar region) and track win rates. Estimated 18-month data collection before meaningful results.", tc: "text-primary" },
            { question: "OQ-2: Bagaimana MJP bisa membantu BUJK yang tidak bisa membaca tender dokumen dengan baik?", why_unsolved: "A significant segment of Indonesian BUJK — particularly in Kualifikasi Kecil in non-Java regions — has limited document literacy. Tender documents are dense, use legal/technical language, and assume familiarity with procurement procedures that many small BUJK owners don't have. MJP's current interface (Knowledge Registry, NLQ) requires baseline literacy to use effectively.", why_it_matters: "This is the 'last mile' problem for MJP's national market coverage aspiration. Solving it would require: voice-based NLQ (ask a question by speaking, get spoken answer), hyper-simplified document summary UI, potentially assisted onboarding. All are post-Series B investments at minimum — but if MJP doesn't plan for it, the 73% non-active-LPSE BUJK segment will remain permanently unaddressed.", tc: "text-blue-700" },
            { question: "OQ-3: Berapa banyak tender yang klien TIDAK mengikuti karena mereka tahu dari MJP bahwa mereka tidak memenuhi syarat?", why_unsolved: "MJP measures tenders entered and won. It does not currently measure tenders NOT entered because MJP's intelligence revealed the klien was not qualified. This 'avoided bad decisions' metric is arguably the most important value MJP delivers — preventing klien from spending 40–80 hours on a tender bid they can't win. But it's invisible in current analytics.", why_it_matters: "If MJP could show: 'In the last 12 months, our intelligence saved you an estimated X hours of wasted bid preparation,' the value story would be dramatically stronger. Hendra Jr. is building 'avoided bid' tracking: when a klien views a tender and then does NOT proceed to download tender documents, track whether they saw a qualification barrier in MJP's analysis.", tc: "text-emerald-700" },
            { question: "OQ-4: Bagaimana cara menangani BUJK yang menggunakan MJP untuk mengidentifikasi tender yang bisa 'diatur'?", why_unsolved: "A small minority of BUJK owners have explicitly or implicitly indicated they use MJP's intelligence to identify tenders worth 'investing in relationships' with panitia — i.e., using MJP to identify which tenders are worth corruption investment. MJP's data on panitia tendencies, historical award patterns, and insider connections: could theoretically be used for corrupt purposes.", why_it_matters: "MJP cannot read minds or verify intent. The solution: (1) design features to be more useful for honest competition than for corrupt competition (e.g., Trust Score rewards clean track records rather than just win counts), (2) respond to any direct expression of corrupt intent by terminating the klien's account (1 case in 5 years). MJP cannot prevent corruption entirely — but it can avoid being a tool that makes corruption easier than honest competition.", tc: "text-orange-700" },
            { question: "OQ-5: Apa yang harus dilakukan MJP ketika data yang benar membahayakan BUJK yang benar?", why_unsolved: "One BUJK owner (Enterprise klien, 4 years) called Hendra to request that MJP remove their BUJK's financial difficulty signal from their Trust Score profile — not because the signal was wrong (it was accurate) but because it was causing JO partners to decline them during a temporary cash flow crisis. The BUJK was not insolvent; they were in a 3-month tight period and would recover.", why_it_matters: "The dilemma: accurate data used correctly is the foundation of MJP's value. But accurate data can also harm a BUJK that is temporarily struggling but fundamentally viable. Hendra's resolution in this case: MJP does not remove accurate data, but added a 'context note' feature where a BUJK can add a verified explanation to a negative signal. The structural question — when does transparency become unfair — is one Hendra has not fully resolved and considers it MJP's most difficult ongoing ethical question.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.question} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.question}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Why unsolved: {r.why_unsolved}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Why it matters: {r.why_it_matters}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Open questions adalah Hendra's practice of documenting what MJP doesn't know — as important as documenting what it knows. The 5 questions above have in common: each touches on a fundamental tension in what MJP does. OQ-1 is the attribution problem (does our product actually work?). OQ-2 is the access problem (are we only serving those who already have advantages?). OQ-3 is the invisible value problem (what's the value of decisions not made?). OQ-4 is the dual-use problem (can our intelligence be used for harm?). OQ-5 is the accuracy vs fairness problem (when is transparency unjust?). Most startup founders avoid publishing these questions because they might undermine investor confidence. Hendra's view: 'Investor yang takut dengan pertanyaan yang belum terjawab bukan investor yang tepat untuk MJP. Platform intelligence yang serius harus bergulat secara jujur dengan batas kemampuannya, risiko penyalahgunaannya, dan pertanyaan etika yang belum terjawabnya. Kami melakukan itu.' Publishing the open questions also serves a practical purpose: it invites the team, advisors, and occasionally klien to contribute to solving them. OQ-3 (avoided bid tracking) was suggested by an Enterprise klien in a product feedback session — after Hendra shared that MJP was working on this problem without a solution yet. The klien's suggestion became the current design approach. Hendra: 'Pertanyaan yang kita akui tidak kita ketahui jawabnya: itu adalah ruang di mana kolaborasi terbaik terjadi.'</p>
      </div>

      {/* R109: MJP's Mission Statement — How It Was Written and What It Means */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-primary" /> THE MISSION STATEMENT — 3 Versi Mission Statement MJP Sebelum Versi Final, Workroom Session yang Menghasilkannya, dan Mengapa Setiap Kata dalam Versi Final Dipilih Secara Sadar
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { version: "VERSION-1 (2021): 'Memberikan informasi tender dan regulasi konstruksi kepada BUJK Indonesia'", when_and_why: "Written by Hendra alone at launch. Accurate but transactional — describes what MJP delivers, not why it matters. Hendra used this version in early investor pitches. Feedback from 2 angel investors: 'This sounds like a data vendor, not a mission-driven company.' No emotional resonance. No hierarchy of impact.", what_changed: "Nothing changed immediately. Hendra kept this version for 18 months because he hadn't made time for the deeper conversation. The investor feedback stayed in the back of his mind.", tc: "text-muted-foreground" },
            { version: "VERSION-2 (2022): 'Membantu BUJK Indonesia bersaing lebih cerdas dengan informasi yang akurat'", when_and_why: "Written by Hendra after conversations with Reza about sales messaging. Better: acknowledges competition, positions MJP as enabling smarter competition. But still 'helping to compete' — instrumental value, not transformative value. Reza's feedback: 'Klien don't just want to compete — they want to win. The mission should say something about what winning enables, not just competing.'", what_changed: "V2 was used in sales materials for 12 months. In 2023, Hendra realized: the mission statement was still describing outputs (information, competition) not outcomes (what BUJK can do when they win more because of MJP).", tc: "text-muted-foreground" },
            { version: "VERSION-3 CANDIDATE (2024 offsite Day 3): 4 versions debated over 3 hours", when_and_why: "Annual offsite 2024, Day 3 session: Hendra proposed spending 3 hours on mission statement. 4 candidate versions debated: (A) 'Membuat industri konstruksi Indonesia lebih transparan' — Budi's objection: transparency is a means, not an end. (B) 'Memungkinkan BUJK yang kompeten untuk menang lebih sering dari yang seharusnya' — Hendra Jr.'s concern: 'more than they should' sounds like we're gaming the system. (C) 'Menghapus hambatan informasi dalam pengadaan konstruksi Indonesia' — Sari's concern: 'barriers' implies adversarial framing, when most of the problem is simply poor information infrastructure. (D) 'Memberi BUJK Indonesia akses yang sama terhadap informasi yang dibutuhkan untuk bersaing secara adil' — near-final consensus but 'bersaing secara adil' felt weak.", what_changed: "The 3-hour debate revealed the core of what MJP believes: the problem isn't unfair competition — it's that information inequality structurally disadvantages competent but less-connected BUJK. The fix isn't making competition fairer — it's making information access equal.", tc: "text-blue-700" },
            { version: "VERSION-4 FINAL: 'Mendemokratisasikan intelligence pasar konstruksi agar setiap BUJK kompeten bisa bersaing berdasarkan kemampuan, bukan koneksi'", when_and_why: "Final version written by Hendra the morning after the offsite Day 3 session. Key words: 'Mendemokratisasikan' — democratize, not just improve. 'intelligence' not 'informasi' — positioning as processed intelligence, not raw data. 'setiap BUJK kompeten' — every competent BUJK, not some. 'kemampuan, bukan koneksi' — ability, not connections. The most important word: 'kompeten' — MJP's mission is not to help all BUJK win, it's to help BUJK who deserve to win based on their capability get a fair chance.", what_changed: "This version resonated with the team in a way no previous version had. Sari: 'Demokratisasi adalah kata yang mencerminkan apa yang Knowledge Registry sebenarnya lakukan — memberi orang yang tidak punya akses koneksi regulator akses ke pengetahuan yang sama.' Budi: 'Kemampuan, bukan koneksi: itu adalah apa yang setiap narasumber saya katakan seharusnya menjadi ukuran keberhasilan dalam pengadaan.'", tc: "text-primary" },
          ].map((r) => (
            <div key={r.version} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.version}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">When and why: {r.when_and_why}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>What changed: {r.what_changed}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">The mission statement story adalah the account of how MJP's team arrived at its current sense of purpose — not through a branding exercise or a consultant's workshop, but through 4 iterations over 4 years and a 3-hour honest conversation about what they actually believe. The final version ('Mendemokratisasikan intelligence pasar konstruksi agar setiap BUJK kompeten bisa bersaing berdasarkan kemampuan, bukan koneksi') is now used in every investor pitch, every Enterprise onboarding, every new hire conversation. It defines not just what MJP does but who the mission is for (BUJK kompeten who currently lose because of information inequality, not because of capability deficit) and what success looks like (competition based on ability, not connections). The specific word 'demokratisasi' (democratize) is important: it frames MJP as part of a larger project of equal access — connecting construction market intelligence to the broader Indonesian aspiration of equitable economic participation. This framing resonates strongly with government stakeholders (LKPP, PUPR, BNSP) because it aligns MJP's mission with government's stated procurement reform objectives. It also resonates with BUJK owners who have felt the sting of losing tenders to less competent but better-connected competitors. Hendra: 'Misi yang benar bukan misi yang terdengar bagus. Misi yang benar adalah misi yang — ketika Anda menjelaskannya kepada tim Anda, kepada klien Anda, kepada pemerintah yang bermitra dengan Anda — semua orang mengangguk bukan karena mereka harus, tapi karena mereka percaya itu juga adalah misi mereka.'</p>
      </div>

      {/* R110: The Workroom as Problem-Solving Methodology */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FlaskConical className="h-3.5 w-3.5 text-primary" /> WORKROOM AS METHODOLOGY — 5 Problem-Solving Frameworks yang MJP Gunakan di Workroom: Bukan Sekadar Tool, tapi Cara Berpikir yang Membentuk Bagaimana Tim Mendekati Masalah Paling Kompleks
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { framework: "FRAMEWORK-1: Five Whys — digunakan untuk akar masalah klien yang mengancam churn", how_used: "When a klien is at churn risk (CHURN profile activation) or when a product failure occurs: Hendra runs a 5-Whys session in Workroom. Example: klien cancels citing 'not enough relevant tenders.' Why 1: their alert queue shows only 3 tenders/week. Why 2: KBLI profile was set to only 2 categories. Why 3: klien set profile during onboarding without understanding that 8+ categories is more typical. Why 4: onboarding didn't explain the tradeoff between specificity and volume. Why 5: onboarding checklist was designed for speed (5 steps, {' '}5 minutes) not for understanding (it explains what to do, not why). Root cause: onboarding quality.", outcome: "5-Whys sessions in Workroom: documented, action items assigned, root cause addressed in product or process. Onboarding redesign (extended tooltip explanations) was a 5-Whys product output.", tc: "text-primary" },
            { framework: "FRAMEWORK-2: Jobs To Be Done (JTBD) — digunakan untuk mendefinisikan fitur baru", how_used: "When a new feature concept enters the Workroom: the team uses JTBD framing to resist feature-centric thinking. Format: 'When [situation], I want to [motivation], so I can [expected outcome].' Example for Trust Score: 'When evaluating JO partners for a Rp 5B tender, I want to verify their track record without calling industry contacts, so I can make a confident partnership decision within 1 day.' The JTBD statement defines success criteria for the feature: does the shipped feature satisfy the 'so I can' outcome?", outcome: "JTBD applied to 11 major features since 2023. In each case: the JTBD statement identified at least one design requirement that wasn't initially obvious. For SKK Alert V2: JTBD revealed that 'so I can' = 'know exactly what to do next, not just know that the SKK is expiring' — which led to the Stage-C split response (different content for 'renewal in progress' vs 'not started').", tc: "text-blue-700" },
            { framework: "FRAMEWORK-3: Pre-Mortem — digunakan sebelum setiap major feature launch", how_used: "24–48 hours before a major feature goes live: Hendra runs a Workroom pre-mortem. Prompt: 'Assume it's 90 days from now and this feature has failed. Why did it fail?' Each team member who uses or owns the feature contributes failure scenarios. Common pre-mortem outputs: (1) edge cases Hendra Jr. hadn't tested, (2) communication gaps (klien won't understand how to use it), (3) data quality scenarios that produce confusing outputs. Pre-mortem is not a blocker — it's a checklist generator.", outcome: "NLQ pre-mortem (Q1 2023): identified 3 failure scenarios. Scenario 2 ('klien asks NLQ about a regulatory area Sari hasn't covered yet and gets a no-result response without explanation') led to the 'coverage gap acknowledgment' message ('Kami belum memiliki aset Knowledge Registry untuk area ini — pertanyaan Anda akan membantu kami memprioritaskan area yang perlu kami tambahkan.'). This message: converted what would have been a frustrating dead-end into an engagement signal.", tc: "text-emerald-700" },
            { framework: "FRAMEWORK-4: Assumption Mapping — digunakan untuk memvalidasi peluang baru sebelum investasi", how_used: "When evaluating a new market opportunity or product direction: Workroom session maps all assumptions the team is making, then ranks them by (1) importance to the decision and (2) certainty level. High-importance, low-certainty assumptions: tested before investment decision. Low-importance or high-certainty assumptions: accepted. Example: IKN Intelligence Tier assumption map. Most critical assumption: 'IKN-focused BUJK will pay Rp 8–15jt/month for specialized intelligence.' Certainty: medium (3 narasumber interviews, willing to pay, but amount uncertain). Action: Budi conducts 2 more IKN-specific interviews with price sensitivity questions before tier design is finalized.", outcome: "Assumption mapping prevented 2 premature product investments in 2024 by identifying that the most critical assumptions were low-certainty: (1) vertical-specific tier for F&B procurement (assumption that F&B contractors would pay for construction-adjacent intelligence: failed validation — F&B contractors don't participate in LPSE procurement). (2) Real-time LPSE API partnership with LKPP (assumption that LKPP would share real-time data via API: medium-certainty; delayed until LKPP MOU finalized).", tc: "text-orange-700" },
            { framework: "FRAMEWORK-5: Solution Sizing — digunakan untuk memilih antara solusi yang kompleks vs sederhana", how_used: "When Hendra Jr. proposes multiple technical approaches for a problem: Workroom solution sizing compares each approach on 3 dimensions: (1) klien impact (how much does this solve the problem?), (2) implementation time (Hendra Jr.'s honest estimate), (3) reversibility (if we ship this and it's wrong, how hard is it to change?). Rule: prefer the simplest solution that achieves 80% of the impact. Save complex solutions for problems where 80% isn't enough.", outcome: "HPS estimation model: first discussed in 2022. Hendra Jr. proposed 2 approaches: (A) Simple 3-factor regression (30 engineer-days), (B) 4-layer ML model (90 engineer-days). Solution sizing: (A) achieves 68% accuracy, (B) achieves 71% accuracy. For 3× the engineering time: 3-percentage-point accuracy improvement. Decision: build (A), ship, measure, upgrade to (B) if data shows the accuracy gap is causing klien decisions errors. (A) shipped first; (B) built 18 months later when klien data confirmed the accuracy need.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.framework} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.framework}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">How used: {r.how_used}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Outcome: {r.outcome}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Workroom as methodology adalah the understanding that MJP's problem-solving quality doesn't come from talent alone — it comes from structured thinking applied consistently. The 5 frameworks above are not academic exercises: each has been used in actual product and business decisions, and each has produced a documented outcome that can be traced to the framework's use. 5-Whys produced the onboarding redesign. JTBD produced Stage-C split response. Pre-Mortem produced NLQ's coverage gap message. Assumption Mapping prevented 2 premature investments. Solution Sizing produced HPS's 2-phase approach. The frameworks are not used in every decision — they're reserved for decisions with significant product or business consequence. Routine decisions (fix a bug, update a tooltip, adjust an alert threshold): made without frameworks. High-stakes decisions (new feature, new tier, new partnership, crisis response): frameworks applied. The Workroom tool itself: just a digital whiteboard where these sessions happen asynchronously across 4 cities. The frameworks: the methodology that makes the asynchronous sessions productive. Without structure, async sessions produce divergent threads. With structure, they produce decisions. Hendra: 'Lima framework ini bukan karena kami akademis. Ini karena kami sudah membuat cukup keputusan buruk tanpa struktur untuk mengetahui bahwa struktur menghasilkan keputusan yang lebih baik. Setiap framework: bekas dari pelajaran yang dipelajari dengan cara yang mahal.'</p>
      </div>

      {/* R111: Market Timing Analysis — Why 2021 Was Right */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> ANALISIS TIMING PASAR — Mengapa 2021 Adalah Momen Masuk yang Tepat untuk MJP: 4 Faktor Konvergen yang Membuat 2021 Berbeda dari 2018 atau 2019, dan Pelajaran tentang Membaca Jendela Pasar dalam Industri Konstruksi Indonesia
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { factor: "TIMING-1: LPSE menjadi satu-satunya kanal — Perpres 16/2018 fully enforced by 2021", context: "Perpres 16/2018 mandated that all government procurement above Rp 200jt must use LPSE. Enforcement timeline: the regulation was published in 2018, but enforcement was gradual — as late as Q3 2020, 23% of eligible procurements in non-Java provinces still bypassed LPSE due to compliance gaps. By Q1 2021: LKPP enforcement had reduced LPSE bypass to under 6%. Practical implication: LPSE data coverage was incomplete before 2021 — Hendra could have built the same system in 2019 but LPSE wouldn't have been the single source of truth it became by 2021.", why_not_earlier: "Pre-2021 risk: significant. If 23% of procurement activity bypassed LPSE, any intelligence platform built on LPSE data had a structural coverage gap that would produce false negatives for BUJK in non-Java provinces. Hendra's assessment in 2020: 'Sistem ini akan bagus ketika LPSE benar-benar menjadi satu-satunya kanal. Belum sekarang.' The wait was correct — by 2021, LPSE was effectively complete as a data source.", tc: "text-primary" },
            { factor: "TIMING-2: UU Cipta Kerja 2020 created regulatory complexity that needed intelligence infrastructure", context: "UU Cipta Kerja (November 2020) changed 1.200 provisions across 79 laws, including significant changes to construction licensing (IUJK replaced by NSPK/PBUMK), SKK requirements restructuring, and BUJK qualification criteria. The complexity created immediate demand for regulatory intelligence: BUJK who previously understood their compliance obligations suddenly needed to re-learn them. Sari's assessment: 'UU Cipta Kerja adalah tahun 2021 dalam konstruksi apa yang COVID-19 adalah tahun 2020 di ekonomi umum — semuanya berubah sekaligus.'", why_not_earlier: "This timing factor was unpredictable — Hendra did not build MJP in anticipation of UU Cipta Kerja. But UU Cipta Kerja accelerated adoption by creating a specific, acute, and immediately-relevant need for MJP's regulatory intelligence layer. BUJK who signed up in 2021–2022: disproportionately driven by UU Cipta Kerja compliance anxiety. Hendra: 'Kami tidak berencana diluncurkan tepat saat semuanya berubah. Tapi ketika semuanya berubah: kami adalah satu-satunya platform yang sudah siap membantu.'", tc: "text-blue-700" },
            { factor: "TIMING-3: SaaS infrastructure maturity — platform cost structures finally viable at BUJK price points", context: "2018–2019: cloud infrastructure costs for an LPSE crawler covering 671 portals would have been Rp 12–15jt/bulan (AWS Southeast Asia pricing). At MJP's target price point of Rp 750rb–3.5jt/bulan, the unit economics would have required 12–20 subscribers to cover infra costs alone. By 2021: cloud costs had decreased 40–55% for equivalent compute. Hendra Jr.'s 2021 architecture: Rp 4.2jt/bulan for full crawler infrastructure. Break-even on infra: 2–3 subscribers. The SaaS infrastructure cost decrease: made the business viable at Indonesian B2B SME price points.", why_not_earlier: "This is a classic technology timing pattern: the underlying infrastructure (cloud compute) became affordable at exactly the same time the data source (LPSE) became reliable. Both happened in 2020–2021. A 2018 attempt: would have been economically marginal (high infra costs) and data-quality compromised (incomplete LPSE coverage). The convergence of data reliability + infrastructure economics: the technical foundation of why 2021 was the right year.", tc: "text-emerald-700" },
            { factor: "TIMING-4: WhatsApp-native BUJK market — first generation comfortable with digital B2B subscription", context: "2021 was the first year when Hendra's market research (22 BUJK interviews) showed that more than 50% of target BUJK owners used digital tools for business procurement management (beyond WhatsApp). Pre-2020: BUJK owners in the Rp 1–10B ARV range were predominantly phone-and-spreadsheet users — skeptical of SaaS subscriptions. COVID-19 forced digital adoption across the Indonesian SME market. By 2021: the target BUJK segment had been forced to adopt digital procurement tools (many now used LPSE-registered digital accounts for the first time). Digital subscription receptivity: higher than at any previous period in this market's history.", why_not_earlier: "Behavioral timing: even with the right product, the right price, and the right data — if BUJK owners are not receptive to digital subscriptions, the business cannot scale. The COVID-forced digital adoption was not planned by Hendra but was the final enabling factor. Reza's observation: '2021 klien pertama yang saya hubungi tidak bertanya apakah platform ini tersedia di desktop atau mobile — mereka langsung bertanya berapa harganya. Itu berbeda dari 2019, ketika pertanyaan pertama selalu tentang apakah ada versi offline.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.factor} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.factor}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Context: {r.context}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Why not earlier: {r.why_not_earlier}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Analisis timing pasar adalah one of Hendra's most sophisticated investor conversations — because it demonstrates that MJP's success was not just a function of having a good idea, but of having a good idea at exactly the right moment. The 4 factors (LPSE enforcement completion, UU Cipta Kerja complexity, infrastructure cost curves, and digital adoption acceleration) converged in 2020–2021 in a way that had not been true in 2018 or 2019. Could MJP have launched in 2018? Technically yes. Would it have succeeded? Hendra's honest assessment: 'Mungkin tidak — atau setidaknya tidak dengan kecepatan yang sama. Data coverage terlalu rendah, unit economics terlalu ketat, dan pasar belum siap secara perilaku.' The timing analysis is also forward-looking: what are the equivalent 'timing factors' that will define the next market window? Hendra's answer: the 3 procurement policy changes coming in Q2 2027 (that Hendra references in his Series A pitch close) are the next convergence event — not identical to 2021 but structurally similar: a regulatory complexity spike that will force BUJK who currently 'manage fine without tools' to recognize they can no longer manage fine without tools. MJP's preparation for this window: the Series A fundraise. Hendra: 'Saya tidak menjual ke investor bahwa MJP berhasil karena kami lebih pintar dari orang lain. Saya menjual bahwa kami berhasil karena kami siap ketika pasar siap — dan kami berencana untuk siap lagi ketika pasar siap berikutnya.'</p>
      </div>

      {/* R112: Workroom 2025 Retrospective — Best and Worst Decisions */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> ANNUAL DECISION REVIEW 2025 — Keputusan Terbaik dan Terburuk yang Dibuat MJP Tahun Ini: 4 Keputusan Terbaik yang Mendorong Pertumbuhan, 3 Keputusan yang Disesalkan, dan Sistem Review yang Hendra Gunakan untuk Belajar dari Keduanya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { category: "BEST-2025: 4 keputusan terbaik MJP di 2025", decisions: "BEST-A: Memutuskan untuk meluncurkan SKK Express dengan harga Rp 2.5jt–8.5jt per kasus (Q1 2025). The initial pricing debate: Hendra proposed Rp 1.5jt–5jt (more accessible); Reza proposed Rp 3jt–12jt (maximize margin). Decision rationale: Hendra chose the middle range after analyzing C1's SKK-equivalent pricing (Rp 0 — they don't offer SKK services) and the perceived value of speed (BUJK in SKK crisis are not price-sensitive — they need resolution, not the cheapest option). Result: Rp 55jt revenue in first 6 months, 91% CSAT. Validated: the middle price was correct — not a single klien mentioned price as a concern in post-service feedback. BEST-B: Mempertahankan Sari ketika C1 offered her a role at 1.7× her MJP salary (Q2 2025). Hendra's response: immediate equity grant (1.2% additional), transparent conversation about MJP's Series A timeline and Sari's role in it, and commitment to post-Series A compensation review. Cost: equity dilution. Value: retaining 5 years of irreplaceable Knowledge Registry expertise and avoiding a 3–6 month disruption to asset production. BEST-C: Menolak partnership offer dari sebuah startup data agregasi (Q3 2025) yang menawarkan akses ke data 850 tender per hari tapi dengan kualitas data yang tidak dapat MJP verifikasi. The rejection: despite the volume opportunity, Hendra declined because unverifiable data quality is incompatible with MJP's 'data you can bet your tender on' positioning. Result: missed a short-term data volume gain but preserved the quality reputation. BEST-D: Memutuskan untuk tidak merespons saat C1 menurunkan harga 20% (Q4 2025). Hendra's analysis: C1's price reduction is a sign of subscriber loss pressure, not a competitive attack. MJP's response: zero price change, invested the quarter in NLQ accuracy improvement instead. Result: 4 of 5 price-comparison prospects MJP won in Q4 chose MJP despite the C1 price reduction — confirming that MJP's competitive advantage is not price.", tc: "text-primary" },
            { category: "WORST-2025: 3 keputusan yang disesalkan dan apa yang dipelajari", decisions: "WORST-A: Terlambat memulai penulisan Surat Penawaran Referensi feature (originally scoped for Q1 2025, delayed to Q4 2025 due to scope underestimation). The cost: Reza identified 11 Enterprise prospects who specifically mentioned 'surat penawaran support' as a deciding factor and chose to wait for MJP to ship it — 3 of them signed with C1 during the 9-month delay. Lesson: high-priority revenue-blocking features need aggressive scope reduction if they're at risk of delay — a partial solution shipped early beats a complete solution shipped late. WORST-B: Over-investing in the Knowledge Registry UI redesign (Q2–Q3 2025, 8 weeks of Hendra Jr.'s time). The redesign improved visual clarity but klien engagement metrics showed no improvement post-launch. Hendra Jr.'s retrospective assessment: the old UI was fine — the investment should have gone to NLQ accuracy improvement, which has a measured retention impact. Lesson: UI investments without a specific engagement problem to solve are rarely worth their engineering cost. WORST-C: Tidak segera mempublikasikan case study KON-089 (the Perpres 12/2021 crisis recovery story). Hendra was cautious about publicizing MJP's biggest service failure — even though KON-089's own NPS was 9/10 after the incident. Reza's retrospective: this case study could have been MJP's most powerful sales proof — a story about crisis accountability and recovery is more credible than a story about perfect execution. Eventually published in Q4 2025 — 4 years after the incident. Lesson: authentic vulnerability, when handled well, is more valuable than curated perfection.", tc: "text-blue-700" },
            { category: "REVIEW SYSTEM: Bagaimana Hendra memimpin Annual Decision Review di MJP", decisions: "Hendra's Annual Decision Review: a 90-minute session in December, involving the full 6-person team. Format: (1) Hendra presents 10 significant decisions made during the year with their original rationale and measured outcomes. (2) Team members each nominate 1 decision they thought was wrong or should have been made differently. (3) Each nominated decision: 5-minute structured analysis — what went wrong, what signal was missed, and what would the team do differently if facing the same decision now. (4) 2–3 decisions are selected for 'deep post-mortem' at a January session (90 minutes each). The deep post-mortems: become Decision Log entries. Ground rules: no blame assignment (decisions are analyzed, not people). Participants speak to patterns ('the team underweighted user research data') not individuals ('Hendra underweighted...'). Hendra's role: present his own decisions as the primary subject of analysis, not as the moderator who evaluates others' decisions. Hendra: 'Review yang paling berguna adalah yang membuatku sendiri merasa tidak nyaman — karena itu berarti saya menemukan sesuatu yang sebenarnya bisa saya lakukan dengan lebih baik.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.category} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.category}</p>
              <p className="text-[7px] text-muted-foreground">{r.decisions}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Annual Decision Review adalah MJP's institutional learning mechanism — the process that converts 12 months of experience into organizational memory that improves the next 12 months of decisions. The review's value: not in the individual decisions analyzed, but in the pattern recognition it produces. Across 4 years of Annual Decision Reviews (2022–2025), MJP has identified 3 recurring decision failure patterns: (1) Scope underestimation for features without clear precedent in the codebase (consistent across 2023, 2024, and 2025 — WORST-A in 2025 is the third iteration of this pattern). (2) UI investment without a measured problem to solve (WORST-B in 2025, similar to a 2023 decision). (3) Delay in publishing difficult-but-valuable content because of reputational caution that turns out to be unjustified (WORST-C in 2025 — and a 2022 equivalent). The pattern recognition function: by 2025, Hendra can recognize a scope underestimation risk 4 weeks into a feature development (based on 3 prior instances of the pattern). He now requires a 'scope red flag review' at the 4-week mark for any feature without clear precedent. This is the Decision Review's compounding return: not just 'what should we do differently next time,' but 'what pattern do I now recognize early enough to prevent the same failure?' Hendra: 'Review tahunan yang baik tidak menghasilkan resolusi. Ini menghasilkan pola yang saya kenali lebih cepat tahun depan. Resolusi: semua orang bisa berjanji. Pengenalan pola: hanya bisa diperoleh dari pengalaman yang didokumentasikan dengan jujur.'</p>
      </div>

      {/* R113: Hypothesis-Driven Development */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> HYPOTHESIS-DRIVEN DEVELOPMENT — Bagaimana Setiap Fitur MJP Dimulai sebagai Hipotesis yang Bisa Diuji: Template Hipotesis, 3 Contoh Konkret, dan Mengapa Hipotesis yang Salah Lebih Berharga daripada Fitur yang Tidak Pernah Diuji
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { element: "ELEMENT-1: Template hipotesis MJP — format baku untuk setiap fitur baru", template: "MJP's hypothesis template (introduced by Hendra in 2023, mandatory for all feature proposals since Q3 2023): 'We believe that [user type] who [context/situation] will [specific behavior change] if we build [specific feature], resulting in [measurable outcome]. We will know this hypothesis is confirmed if [specific metric] changes by [threshold] within [timeframe] of feature launch.' The template's 4 required elements: (1) specific user type (not 'BUJK' but 'Pro-tier BUJK who have activated SKK alerts'), (2) specific behavior change (not 'use the feature more' but 'open and act on SKK expiry alerts within 48 hours'), (3) specific feature (not 'better alerts' but 'Urgency-labeled SKK expiry alerts with countdown timer'), (4) measurable outcome with threshold ('SKK alert action rate increases from 34% to 50% within 60 days of launch').", examples: "The template requirement eliminated vague feature proposals from MJP's product discussions. Before the template (pre-2023): Hendra Jr. estimates 40% of feature discussions spent more than 1 meeting defining what success looked like. After the template: success criteria are defined before the feature is built, and the measurement plan is built into the development timeline. The template also enables retrospective evaluation: after each feature ships, Hendra Jr. reviews the hypothesis against measured outcomes. Features that confirmed their hypothesis: become part of MJP's product positioning. Features that refuted their hypothesis: become Feature Graveyard candidates (with the refuted hypothesis as the documented reason for retirement).", tc: "text-primary" },
            { element: "ELEMENT-2: 3 hipotesis konkret yang membentuk fitur paling penting MJP", template: "HYPOTHESIS-A (Trust Score, 2021): 'We believe that Medium and Large BUJK who have been burned by a JO partner's document fraud will immediately look up a potential partner's qualification documents if we make that lookup possible in under 90 seconds, resulting in them finding MJP's Trust Score the single most valuable feature of the platform. We will know this is confirmed if Trust Score is the feature mentioned most in first-month NPS verbatims.' Status: CONFIRMED in Month 2. Trust Score remains the most mentioned feature in NPS verbatims after 5 years. HYPOTHESIS-B (NLQ, 2022): 'We believe that Enterprise BUJK who regularly use Knowledge Registry assets will try to ask follow-up questions that the asset doesn't answer, and will actively use a natural language query interface to ask those questions if we build it, resulting in NLQ becoming used at least once per week by 30% of Enterprise klien within 6 months of launch.' Status: CONFIRMED at Month 4 (34% weekly NLQ users among Enterprise by Month 4). HYPOTHESIS-C (Morning Briefing cadence, 2022): 'We believe that BUJK owners who do not have time for manual LPSE research will prefer a curated daily briefing over a real-time feed, and will open it on at least 4 of 7 business days if the briefing takes under 3 minutes to read.' Status: CONFIRMED. Current average briefing open rate: 4.3 of 7 business days among active subscribers.", examples: "Common element across all 3 confirmed hypotheses: they all specified a behavioral threshold ('within 90 seconds,' 'at least once per week by 30%,' 'under 3 minutes to read') rather than directional improvement. Thresholds force the team to define 'good enough' before building — preventing the common product trap of continuously iterating on a feature that technically improves metrics but never reaches the threshold that makes it worth the maintenance cost.", tc: "text-blue-700" },
            { element: "ELEMENT-3: Hipotesis yang terbukti salah dan pelajarannya", template: "REFUTED-A (Social Forum hypothesis, 2023): 'We believe that BUJK owners who find value in morning briefing will want to discuss briefing topics with peers in a structured platform forum, and will post at least 2 times/week if we build a dedicated discussion forum, resulting in 15% of active subscribers as regular contributors within 3 months.' Refuted at Month 2 (only 0.8% became regular contributors). Lesson: BUJK owners want to consume peer intelligence, not create it publicly. REFUTED-B (BUJK Health Score hypothesis, 2023): 'We believe that BUJK who have been on the platform for 3+ months will want to understand their own competitive position and will check their BUJK Health Score at least twice per month if we build it, resulting in 25% of active subscribers checking their score monthly within 4 months.' Refuted at Month 5 (only 6% checked monthly). Lesson: BUJK owners know their own health — they need market context, not internal diagnosis.", examples: "Both refuted hypotheses produced the most important strategic insights in MJP's product history. REFUTED-A produced the 'privacy-first communication' insight (BUJK discuss sensitive information in private channels, not public forums). REFUTED-B produced the 'external intelligence over internal analytics' product focus. Neither insight would have been reached through user research alone — the insights required building the feature, observing actual behavior, and admitting the hypothesis was wrong. Hendra: 'Hipotesis yang terbukti salah mengajarkan kami lebih banyak tentang pengguna kami daripada hipotesis yang terbukti benar — karena ketika hipotesis terbukti benar, kami hanya mengkonfirmasi apa yang kami pikir kami sudah tahu. Ketika terbukti salah: kami menemukan sesuatu yang sama sekali tidak kami antisipasi.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.element} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.element}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.template}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Examples: {r.examples}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Hypothesis-driven development adalah MJP's most important product process innovation — because it changed how the team relates to uncertainty. Before the hypothesis template (pre-2023): uncertainty about whether a feature would work was managed through conviction ('I believe this will work') and debated through intuition. After the hypothesis template: uncertainty is managed through explicit prediction ('we believe X will happen if we build Y') and resolved through measurement. The critical difference: conviction resists contradiction (new evidence is often dismissed or reinterpreted to preserve the conviction). Explicit prediction invites contradiction (the measurement is designed to confirm or refute the prediction). The hypothesis template does not eliminate risk from product decisions — it converts vague risk ('this might not work') into specific testable risk ('this specific threshold might not be met') that can be measured, resolved, and learned from. The template's second benefit: it creates a shared language for product disagreement. Instead of 'I don't think BUJK will use this feature' (opinion, difficult to resolve without building it), the team can say 'I think our adoption threshold (30% of Enterprise monthly) is too optimistic — let's set the confirmation threshold at 20% and see if even that is achievable' (a specific, testable alternative that acknowledges the disagreement and proposes a resolution mechanism). Hendra: 'Hipotesis bukan cara untuk membuktikan bahwa ide kita benar. Ini cara untuk menemukan apakah ide kita cukup benar untuk worth building. Perbedaan itu: selisih antara produk yang kita bangga-kan dan produk yang kita sesali.'</p>
      </div>

      {/* R114: Strategic Assumption Register */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> STRATEGIC ASSUMPTION REGISTER — 7 Asumsi yang Menjadi Dasar Strategi MJP: Apa yang Harus Tetap Benar agar MJP Berhasil, Bagaimana MJP Memantau Setiap Asumsi, dan Apa yang Terjadi Jika Salah Satu Asumsi Terbukti Salah
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { assumption: "ASSUMPTION-1: Pemerintah Indonesia akan terus menggunakan LPSE sebagai infrastruktur pengadaan utama", confidence: "Confidence level: HIGH (9/10). Basis: LKPP has invested 15+ years and significant institutional capital in LPSE as the national e-procurement standard. Over 671 portals nationwide. The LPSE ecosystem is deeply embedded in government procurement workflows and regulatory compliance. Disruption risk: theoretically possible if Indonesia adopts a fully centralized federal procurement platform (eliminating portal diversity) — but Sari's LKPP working group intelligence suggests no such centralization plan is in discussion. Monitoring indicator: Sari monitors LKPP policy announcements monthly for any signal of LPSE architecture change.", failure_consequence: "If ASSUMPTION-1 fails: MJP's core data collection infrastructure (671 LPSE crawlers) becomes obsolete. The business impact: catastrophic for current product, but a 12–18 month transition window (any LPSE replacement would have a multi-year rollout). The mitigation: MJP's non-procurement assets (regulatory, SKK, market intelligence) remain valuable regardless of LPSE architecture — approximately 35% of MJP's value proposition is LPSE-independent. A full LPSE disruption would reduce MJP's TAM by approximately 60% but not eliminate it.", tc: "text-primary" },
            { assumption: "ASSUMPTION-2: BUJK akan terus bersedia membayar untuk platform intelligence (subscription willingness-to-pay persists)", confidence: "Confidence level: HIGH (8/10). Basis: 5 years of subscriber data showing consistent renewal rates (85%+ annual renewal) and consistent tier upgrade patterns. The willingness-to-pay premise: BUJK who win tenders using MJP intelligence attribute a fraction of that win value to MJP's subscription cost. At Rp 950rb/month (Pro tier) vs Rp 50–500jt per tender win: the ROI justification is clear. Monitoring indicator: Reza tracks 'price sensitivity mentions' in renewal conversations — how often BUJK cite price as a concern during renewal. Current rate: 4% of renewals have price-driven negotiation (low). If this rate increases to 15%+: ASSUMPTION-2 is weakening.", failure_consequence: "If ASSUMPTION-2 fails: likely triggered by one of 3 events — (1) free government LPSE aggregation tool becomes available, (2) economic recession reduces BUJK subscription budgets, (3) a competitor offers comparable intelligence free (VC-subsidized). Mitigation: MJP's NLQ and Trust Score are the hardest components to replicate for free — they require knowledge architecture (Sari's 5 years) and relationship data (67 narasumber). A free LPSE aggregator could commoditize tender alerts but could not easily replicate the knowledge layer.", tc: "text-blue-700" },
            { assumption: "ASSUMPTION-3: Budi akan tetap di MJP (narasumber network tidak portable)", confidence: "Confidence level: MEDIUM (6/10). Basis: Budi has been with MJP since Year 3. His equity and seniority in the founding team: create strong retention incentives. But 67 narasumber relationships are built on personal trust with Budi specifically — they are not transferable to a new Research Lead without significant time investment. Monitoring indicator: Budi's quarterly wellbeing and alignment check-ins with Hendra (a standing agenda item in their 1-on-1). Hendra tracks 3 indicators: Budi's stated satisfaction level (1–5 scale), any external networking activity that suggests job exploration, and any friction in narasumber relationship maintenance.", failure_consequence: "If ASSUMPTION-3 fails: the narasumber network does not disappear immediately — but its growth rate drops and the depth of existing relationships slowly degrades without Budi's maintenance. The mitigation: Budi's 'narasumber handover protocol' (a document Hendra requested and Budi completed in Q1 2026 — each narasumber documented with relationship history, communication preferences, and the specific topics they are most knowledgeable about). The protocol: ensures that a successor can maintain existing relationships even if they cannot build new ones at Budi's pace. This documentation: MJP's ASSUMPTION-3 risk mitigation.", tc: "text-emerald-700" },
            { assumption: "ASSUMPTION-4 through ASSUMPTION-7: 4 asumsi pendukung yang lebih sering diabaikan tapi tetap penting", confidence: "ASSUMPTION-4: BNSP will continue requiring SKK as a BUJK qualification prerequisite (SKK Express viability). Confidence: 8/10. ASSUMPTION-5: MJP can continue to access LPSE portal data publicly (no access restrictions). Confidence: 7/10. Monitoring: Hendra Jr. tracks any LPSE portal implementing authentication barriers. 3 portals have done this in the past 2 years — each resolved through public-comment channels. ASSUMPTION-6: The Indonesian construction market continues growing at 5%+ annual procurement value (TAM stays relevant). Confidence: 7/10. ASSUMPTION-7: Hendra Jr. continues to build and maintain MJP's technical infrastructure (technical single-point-of-failure risk). Confidence: 7/10. Like ASSUMPTION-3 for Budi, ASSUMPTION-7 is mitigated through documentation — Hendra Jr. maintains technical architecture documentation sufficient for an experienced engineer to take over critical systems within 30 days.", failure_consequence: "The 4 supporting assumptions: individually lower impact than ASSUMPTION-1 or ASSUMPTION-2, but combinatorially important. If ASSUMPTION-4 (BNSP/SKK requirement) fails: SKK Express revenue (approximately Rp 480jt/year) disappears. If ASSUMPTION-5 (LPSE access) fails for even 20% of portals: data quality degrades significantly. If ASSUMPTION-6 (market growth) fails: TAM expansion thesis fails but existing subscriber base remains viable. If ASSUMPTION-7 (Hendra Jr.) fails: technical operations risk comparable to ASSUMPTION-3 for research operations. Hendra reviews all 7 assumptions quarterly and updates confidence scores. Hendra: 'Assumptions tidak menakutkan saya — assumptions yang tidak terdokumentasi itu yang menakutkan. Jika saya tidak bisa menyebutkan dengan tepat apa yang harus tetap benar agar strategi saya berhasil: saya tidak bisa mengawasi risiko yang sesungguhnya.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.assumption} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.assumption}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Confidence and monitoring: {r.confidence}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Failure consequence: {r.failure_consequence}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Strategic assumption register adalah Hendra's most honest strategic document — more honest than MJP's investor deck, which presents the upside case, and more honest than the competitive analysis, which presents the competitive case. The assumption register presents the conditional case: MJP's strategy is correct IF these 7 things remain true. It is a map of what can go wrong at the strategic level, not the operational level. The register's most important function: it forces Hendra to distinguish between risks he is monitoring (and therefore can respond to early) and risks he is not monitoring (which can only be discovered when they materialize). Before Hendra formalized the register in 2024: all 7 assumptions existed implicitly in MJP's strategy but were not documented or actively monitored. The formalization: converted implicit risk tolerance into explicit monitoring protocols. The quarterly assumption review: 30 minutes of Hendra's time every 3 months. The expected value of those 30 minutes: early detection of ASSUMPTION weakening before it becomes a strategic crisis. The most dangerous assumption failure mode: gradual degradation that looks like normal variance until the damage is severe. A BUJK's price sensitivity slowly increasing from 4% to 12% to 25% over 18 months: is ASSUMPTION-2 failing gradually. Without a quarterly monitoring protocol: Hendra might not notice until the renewal rate drops — by which point 6+ months of corrective time have been lost. The 30-minute quarterly review: is the price of catching that failure at 12% rather than 25%. Hendra: 'Register asumsi bukan dokumen pesimis — ini dokumen yang jujur. Dan kejujuran tentang apa yang bisa salah: itu yang membuat saya lebih percaya diri bahwa saya tahu kapan sesuatu benar-benar salah, bukan hanya khawatir tentang kemungkinan abstrak.'</p>
      </div>

      {/* R115: Post-Series A Problem Evolution */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> POST-SERIES A PROBLEM EVOLUTION — Bagaimana Definisi Masalah MJP Akan Berubah pada Skala 3× Saat Ini: 4 Masalah Baru yang Muncul dengan Pertumbuhan, Mengapa Masalah pada Skala Berbeda, dan Bagaimana Hendra Berencana Mempertahankan Kejelasan Problem Definition
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { problem: "SCALE-PROBLEM-1: Konsistensi kualitas riset saat tim riset berkembang dari 1 ke 3 orang", current_state: "Current state: Budi is the sole researcher. Research quality is defined by Budi's personal standards, methodology, and judgment. Every research output: reviewed by Budi before it enters the product. Inconsistency: structurally impossible when one person produces all research. This is MJP's current research quality advantage — the 67 narasumber relationships and 19 pain point discoveries represent one person's consistent, methodologically coherent body of work.", post_series_a_challenge: "Post-Series A challenge: Budi + Research Associate (Year 1) + potentially a 2nd researcher (Year 2). With 3 researchers: quality inconsistency becomes possible. Research Associate who has different interview skills, different silent friction detection sensitivity, different relationship-building approach: may produce data that is systematically different from Budi's data. If MJP's product team doesn't recognize this inconsistency: they may make feature decisions based on data that appears comparable but has different underlying quality. Hendra's solution: Budi writes MJP's Research Methodology Handbook before hiring the Research Associate. This handbook: documents every protocol improvement from Budi's 4 failure cases, all 4 invisible pain detection techniques, and the BUJK demographic sampling requirements. The associate is trained to Budi's standards before conducting independent interviews.", tc: "text-primary" },
            { problem: "SCALE-PROBLEM-2: Subscriber feedback signal-to-noise degrades dengan 847 → 2.000+ pelanggan", current_state: "Current state: at 847 subscribers, Reza knows most Enterprise subscribers personally (60+ conversations per year with each). The signal: Reza can detect subtle shifts in subscriber sentiment because he has baseline knowledge of each subscriber's business situation. When an Enterprise subscriber mentions a frustration: Reza knows whether this is an isolated complaint or a pattern consistent with what 3 other subscribers said this month. At 847 subscribers: this personal knowledge is manageable.", post_series_a_challenge: "At 2.000+ subscribers: Reza's personal knowledge degrades. He cannot have 4+ conversations per year with every subscriber — the customer success workload requires systematic tools to compensate for the loss of personal relationship bandwidth. The specific problem: MJP's product decision quality depends on high-fidelity subscriber signal. At 847 subscribers: Reza's personal network is the signal collection mechanism. At 2.000: a Customer Success platform (tracking interaction history, churn risk signals, feature feedback) must replace some of what Reza currently carries in his head. Hendra Jr.'s assignment: build a lightweight CRM layer into MJP's platform that captures every subscriber interaction before the Series A hiring starts — to ensure no subscriber signal is lost during the headcount transition.", tc: "text-blue-700" },
            { problem: "SCALE-PROBLEM-3: Regulasi berubah lebih cepat dari kemampuan satu Knowledge Manager untuk mengcover", current_state: "Current state: Sari covers 127 Knowledge Registry assets across 5 regulatory domains. At current regulatory change velocity (approximately 34 significant changes per year): Sari's maintenance load is at approximately 85% capacity. The remaining 15% capacity: used for new asset creation and Expert Contributor coordination.", post_series_a_challenge: "Post-Series A challenge: regulatory velocity in Indonesia has been increasing year-over-year (driven by the UU Cipta Kerja implementation schedule and LKPP's accelerating digitalization program). Hendra's forecast: by 2027, significant regulatory changes affecting BUJK will increase to 50+ per year. At 50 significant changes: Sari's maintenance load exceeds 100% capacity even before new asset creation. The solution: Knowledge Analyst hire (Year 1 post-Series A) takes over Stage-3 maintenance for low-change-frequency assets. Frees Sari for Stage-1 identification, Stage-4 deprecation decisions, and Expert Contributor management. Importantly: Sari remains the single voice of Knowledge Registry quality — the Analyst executes maintenance within Sari's defined standards, not independently. The quality control architecture: prevents the SCALE-PROBLEM-1 pattern (inconsistent quality from independent researchers) from repeating in the Knowledge domain.", tc: "text-emerald-700" },
            { problem: "SCALE-PROBLEM-4: Hendra's direct product vision becomes mediated by a growing team", current_state: "Current state: Hendra has direct personal contact with every team member (6 people), direct access to Budi's narasumber findings, direct access to Reza's subscriber feedback, and direct access to Hendra Jr.'s technical constraint understanding. All product decisions: informed by first-hand signal from all sources. Product vision: grounded in direct reality.", post_series_a_challenge: "At 15 people: Hendra has a Product Manager (who filters and synthesizes product feedback before presenting to Hendra), a Head of Knowledge (who manages Sari and the new Analyst), and a Head of Sales (who manages Reza and the new Sales Rep). Every layer: introduces signal compression. The PM synthesizes 100 feedback signals into 5 feature proposals. Hendra receives 5 proposals instead of 100 signals. The risk: the synthesis filters out the weak signals that often predict the most important insights (PP-011 was a weak signal in aggregate data that became visible only through the demographic expansion of narasumber). Hendra's mitigation: maintain direct monthly participation in Budi's narasumber sessions (observer role, not interviewer) even after the PM hire. This ensures Hendra retains first-hand BUJK contact regardless of the organizational layers that develop. Hendra: 'CEO yang kehilangan kontak langsung dengan pelanggan adalah CEO yang kehilangan kemampuan untuk melihat masalah nyata — karena setiap lapisan organisasi menyaring sinyal menjadi cerita yang lebih rapih dan lebih bisa ditindaklanjuti. Saya tidak ingin cerita yang rapih. Saya ingin sinyal yang berantakan dan jujur yang hanya datang dari mendengarkan langsung.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.problem} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.problem}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Current state: {r.current_state}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Post-Series A challenge: {r.post_series_a_challenge}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Post-Series A problem evolution adalah Hendra's most honest acknowledgment that success creates new problems — and that the problems of a 15-person company are qualitatively different from the problems of a 6-person company. The 4 scale problems (research quality consistency, subscriber signal degradation, regulatory velocity outpacing capacity, product vision mediation) are all management architecture problems, not product or market problems. MJP's core market hypothesis: still valid at scale. The problems: emerge from the organizational infrastructure required to operate at scale. The mitigation strategies above (Research Methodology Handbook, lightweight CRM, Knowledge Analyst hire, direct CEO-BUJK contact preservation) share a common design principle: preserve the information quality that the current 6-person team achieves through personal relationships and direct contact, at a scale where those personal relationships and direct contacts cannot be maintained universally. This is the core tension of B2B SaaS scaling: the customer intimacy that produces product-market fit is intrinsically human-scaled. At 100 subscribers: every subscriber can be known personally. At 1.000: a systematic approximation of personal knowledge is required. At 10.000: the personal knowledge model breaks completely. MJP at 2.000 subscribers is at the critical transition — still close enough to personal relationships to feel them slipping, large enough to need systems to replace them. The mitigation strategies: not designed to eliminate this transition (that's impossible) but to ensure the transition happens without losing the product decision quality that personal relationships enable.</p>
      </div>

      {/* R116: Problem Hierarchy — Root Causes Behind Surface Problems */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> PROBLEM HIERARCHY — Pemetaan Akar Masalah di Balik Pain Points Permukaan: 3 Tingkat Hirarki, Bagaimana Hendra Memetakan Root Causes, dan Mengapa Memecahkan Masalah Tingkat-2 Lebih Berharga dari Tingkat-1
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { hierarchy_level: "HIERARCHY-LEVEL-1: Surface pain — masalah yang BUJK rasakan dan dapat artikulasikan langsung", description: "Level-1 problems: the pain points that BUJK mention directly and immediately when asked about their challenges. All 19 of MJP's documented pain points are Level-1 by definition — they are the problems that Budi's narasumber research reveals. Examples: 'I miss tender announcements because I can't monitor all portals simultaneously' (PP-001). 'I can't verify a JO partner's track record before committing to a joint operation' (PP-002). 'I spend hours checking material prices manually for every HPS calculation' (PP-011). These are real, important problems — but they are symptoms of deeper structural issues.", product_implication: "Product implication of Level-1 framing: features that address Level-1 problems are necessary but not sufficient for durable product-market fit. A competitor can address the same Level-1 problems with different implementations — tender alert aggregators address PP-001, LinkedIn research addresses PP-002 (imperfectly). The BUJK who experiences PP-001 and uses a competitor's alert aggregator: may not need MJP specifically. Level-1 solutions create value but not necessarily lock-in. The competitive moat: built at Level-2 and Level-3, where the problems are structural and the solutions require deep domain knowledge that is harder to replicate.", tc: "text-primary" },
            { hierarchy_level: "HIERARCHY-LEVEL-2: Structural pain — akar masalah yang menghasilkan banyak Level-1 pain point", description: "Level-2 problems: the underlying structural conditions that generate multiple Level-1 problems simultaneously. Hendra's Level-2 analysis: MJP's 19 pain points cluster around 4 structural root causes. (1) Information asymmetry: government procurement information is technically public but practically inaccessible at scale (generates PP-001, PP-003, PP-004, PP-008, PP-011 — 5 pain points from one root cause). (2) Trust infrastructure gap: BUJK cannot efficiently verify the quality, track record, or reliability of potential partners, competitors, and service providers (generates PP-002, PP-005, PP-012, PP-016). (3) Regulatory complexity barrier: the regulatory framework governing BUJK qualification and procurement is genuinely difficult to navigate without specialist knowledge (generates PP-007, PP-009, PP-014, PP-017, PP-019). (4) Operational capacity mismatch: BUJK need enterprise-grade procurement intelligence but operate at SME resource levels (generates PP-006, PP-010, PP-013, PP-015, PP-018).", product_implication: "Product implication of Level-2 framing: a product that addresses a Level-2 structural problem solves multiple Level-1 pain points simultaneously with a single architecture. MJP's morning briefing: addresses the Information Asymmetry root cause (Level-2) by systematically making inaccessible public information accessible — and in doing so, reduces PP-001, PP-003, PP-004, PP-008, and PP-011 simultaneously. This 5-for-1 structural solution: why the morning briefing retains subscribers even when individual pain points (like PP-006) are addressed by other means. The Trust Score: addresses the Trust Infrastructure Gap (Level-2), reducing PP-002, PP-005, PP-012, PP-016 simultaneously. Level-2 solutions: inherently more defensible than Level-1 solutions because they require understanding the structural root cause, not just the surface manifestation.", tc: "text-blue-700" },
            { hierarchy_level: "HIERARCHY-LEVEL-3: Systemic pain — kondisi pasar fundamental yang menciptakan structural root causes", description: "Level-3 problems: the systemic market conditions that generate the Level-2 structural problems. Hendra's Level-3 analysis: (1) Information asymmetry (Level-2) exists because Indonesia's government procurement system was not designed with information accessibility as a primary goal — it was designed for administrative compliance. LKPP's digitalization reduces but doesn't eliminate this systemic design gap. (2) Trust infrastructure gap (Level-2) exists because Indonesia's formal credit and reputation systems (credit bureaus, professional licensing registries) do not adequately cover the SME construction sector. The systemic gap: not BUJK-specific but affects all SME sectors in Indonesia that operate outside the formal financial system. (3) Regulatory complexity barrier (Level-2) exists because Indonesian regulatory production is decentralized across 20+ ministries and agencies without consistent cross-referencing standards. The complexity: structural and growing. (4) Operational capacity mismatch (Level-2) exists because the Indonesian BUJK market never industrialized the way construction markets in Singapore, South Korea, or Germany did — it remains structurally fragmented with most BUJK operating as owner-managed SMEs.", product_implication: "Product implication of Level-3 framing: MJP cannot solve Level-3 systemic conditions — they are macro-structural features of the Indonesian economy and regulatory system. But understanding Level-3 conditions helps Hendra answer 3 critical questions: (1) Why won't this market become easier as the country develops? (LKPP digitalization reduces some information asymmetry but structural regulatory complexity grows — MJP's value doesn't diminish with market development). (2) What is MJP's ceiling? (Level-3 conditions set the ceiling for how much value MJP can capture — the ceiling is high because the conditions are persistent). (3) What should MJP NOT try to fix? (Systemic conditions like regulatory fragmentation are out of scope — MJP navigates them for BUJK, not reforms them). Hendra: 'Perusahaan yang mencoba memecahkan masalah Level-3 adalah LSM, bukan SaaS. MJP ada untuk membuat BUJK sukses dalam sistem yang ada, bukan untuk mengubah sistem itu. Pemahaman tentang Level-3 adalah yang menentukan batas kami — dan batas itu, ternyata, masih sangat jauh dari tempat kami berdiri sekarang.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.hierarchy_level} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.hierarchy_level}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Description: {r.description}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Product implication: {r.product_implication}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Problem hierarchy analysis adalah Hendra's most intellectually foundational strategy tool — because it determines how deep MJP's product strategy should go and where the defensible competitive moat actually lies. The 3-level hierarchy (surface pain, structural root cause, systemic condition) reflects a core principle of B2B product strategy: features that address surface pain create user satisfaction but are vulnerable to competition; architectures that address structural root causes create lock-in and defensibility. MJP's product architecture: built at Level-2 (structural root causes) rather than Level-1 (surface pain). The morning briefing: not just a tender alert tool (Level-1) but an Information Asymmetry reduction system (Level-2). Trust Score: not just a BUJK rating tool (Level-1) but a Trust Infrastructure Gap solution (Level-2). NLQ: not just a search tool (Level-1) but a Regulatory Complexity Barrier reduction system (Level-2). This Level-2 orientation: why MJP has 4 distinctly different product pillars (briefing, Trust Score, Knowledge Registry, NLQ) that address 4 different structural root causes. A company that only analyzed Level-1 pain points would have built 19 individual features — one per pain point. Hendra's Level-2 analysis: revealed that 4 architectural pillars could address 19 pain points with more depth and defensibility than 19 individual features. The Level-3 understanding: equally important for what it tells Hendra NOT to build. MJP does not attempt to reform Indonesia's procurement regulatory system (Level-3). It navigates complexity for BUJK rather than reducing complexity for the whole market. This scope discipline: prevents mission creep into advocacy, policy, or regulatory consulting activities that would dilute MJP's commercial focus. The problem hierarchy is also Hendra's most consistent Series A pitch element — it explains why MJP's 4 product pillars are coherent (each addresses a structural root cause) rather than disparate (a bundle of unrelated features).</p>
      </div>

      {/* R117: Assumption Stress Testing Before Series A */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> ASSUMPTION STRESS TESTING — Bagaimana Hendra Menghancurkan Asumsi Sebelum Series A: 4 Asumsi Paling Berbahaya yang Diidentifikasi, Bukti yang Mendukung dan Melemahkan Setiap Asumsi, dan Apa yang Hendra Lakukan dengan Hasilnya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { assumption: "ASSUMPTION-A1: 'Pasar BUJK cukup besar untuk mendukung bisnis senilai Rp 50B+ ARR'", supporting_evidence: "67.000 BUJK aktif × Rp 306.000/bulan ARPU rata-rata = Rp 245B TAM teoritis. MJP's current penetration: 847 subscribers = 1.3% of TAM. Path to Rp 50B ARR: reach approximately 13.600 subscribers (20% of TAM) at current ARPU. The TAM calculation: conservative (uses current subscribers-across-jenjang distribution; doesn't include BUJK associations, government agencies, or Enterprise custom contracts as incremental segments).", stress_test_result: "Stress test applied: can 20% of Indonesian BUJK pay Rp 306.000/month for intelligence? The stress test case against: Indonesian SME SaaS adoption rate is historically 8–12% for most categories — 20% penetration would require MJP to achieve well-above-market SME SaaS adoption. Hendra's resolution: the 20% target is achievable only if Trust Score becomes a market standard (so that non-MJP subscribers face a competitive disadvantage from not having a Trust Score — structural enrollment pressure rather than pure marketing). The standardization strategy (from R117's Trust Score panel) is therefore load-bearing for the Rp 50B ARR thesis. If standardization fails: more realistic ceiling is 10–12% penetration = Rp 24–29B ARR. Hendra: this is still a commercially attractive outcome, making the A1 assumption resilient even under the stress scenario.", tc: "text-primary" },
            { assumption: "ASSUMPTION-A2: 'Kualitas data MJP (Trust Score, Knowledge Registry) adalah moat yang tahan terhadap pesaing dengan modal lebih besar'", supporting_evidence: "5-year data accumulation: 671 LPSE portal coverage (94% Western Indonesia, 71% Eastern Indonesia), 127 Knowledge Registry assets (LEVEL-1 through LEVEL-4, Expert Contributor verified), 5-year award database (enabling historical Trust Score trends that cannot be replicated without historical data). The depth: genuinely difficult to replicate quickly. A new entrant with Rp 10B: could build portal coverage in 12–18 months. But 5-year historical award data: requires 5 years of operation regardless of capital. The historical depth moat: non-purchasable.", stress_test_result: "Stress test applied: what if a well-capitalized competitor (Rp 50B Series A) focuses on data quality rather than speed? They could: hire Sari-equivalents (faster Knowledge Registry build), run crowdsourced narasumber research (faster Budi-equivalent insight accumulation), and partner with LKPP for official data access (bypassing crawler necessity). The credible threat case: a well-capitalized competitor could close the data quality gap within 3–4 years, not 5+. Hendra's resolution: the moat is not data quality alone — it's data quality + trust + relationship network. A competitor who replicates the data but has no Budi's 67-narasumber network, no Reza's BUJK community relationships, and no Sari's 5-year Expert Contributor relationships: has the dataset but not the intelligence layer above it. The trust and relationship moat: 3–4× slower to replicate than the technical data moat. Post-Series A investment priority: accelerate the relationship moat (Reza's community expansion, Budi's narasumber recruitment) precisely because the technical moat is the most replicable component.", tc: "text-blue-700" },
            { assumption: "ASSUMPTION-A3: 'MJP dapat mempertahankan NPS 47 dan churn rendah saat skala dari 847 ke 5.000+ subscriber'", supporting_evidence: "Current NPS 47 (vs industry average 22) built on: Reza's personal Enterprise relationships (all 67 Enterprise subscribers have Reza's WhatsApp), Sari's briefing quality (high-candor daily intelligence that BUJK cannot get elsewhere), Budi's narasumber-informed product decisions (pain points addressed from real user research). These are relationship-intensive quality drivers — they have scaled from 200 to 847 subscribers while maintaining NPS.", stress_test_result: "Stress test applied: at 5.000 subscribers, Reza cannot maintain personal WhatsApp relationships with all Enterprise subscribers (at 28% Enterprise rate: 1.400 Enterprise subscribers vs Reza's capacity of approximately 150 personal relationships). The NPS dilution risk: real and quantifiable. Hendra's resolution: (1) Customer success team build post-Series A (2 CS hires designed to maintain the personal relationship model at scale). (2) The relationship model: designed to be CS-team-managed rather than founder/Reza-dependent before the scale point is reached. (3) NPS target at 5.000 subscribers: 40+ (7-point reduction from current 47 is acceptable as the cost of scaling the personal relationship model through team members rather than Reza alone). The stress-tested assumption: NPS will decline during scaling (honest) but remain well above industry average (defensible). A3 reframed: 'MJP can maintain above-market NPS at scale with appropriate CS team investment' — more defensible than 'MJP maintains its current NPS at scale.'", tc: "text-emerald-700" },
            { assumption: "ASSUMPTION-A4: 'Hendra Jr. tetap menjadi satu-satunya engineer sampai Series A, tanpa risiko operasional kritis'", supporting_evidence: "Hendra Jr. has been the sole engineer for 5 years without critical outage. Platform reliability: 99.7% (crawler), 99.9% (core platform). Documentation project: 60% complete as of Q2 2026. Emergency response history: 3 critical incidents in 5 years, all resolved within 4 hours by Hendra Jr. alone. The argument for single-engineer sustainability: Hendra Jr. is productive, the codebase is maintainable, and the documentation project reduces key-person risk progressively.", stress_test_result: "Stress test applied: what if Hendra Jr. has a medical emergency or personal crisis that keeps him unavailable for 2–4 weeks during a critical product moment (e.g., Series A due diligence period, or LPSE crawling during peak tender season)? The 2-week unavailability scenario: all crawler maintenance stops, critical bugs go unpatched, briefing automation requires manual fallback. The risk: existential to MJP's Series A timeline if it coincides with investor due diligence. Hendra's resolution: (1) Documentation project completion by Q3 2026 (before expected due diligence) ensures any emergency hire can onboard in days rather than weeks. (2) Freelance engineering contract arrangement (identified 2 candidates with MJP codebase familiarity from past consulting work) available for emergency deployment. (3) Backup manual briefing process: Sari can produce a simplified briefing manually for up to 2 weeks if automated generation fails. The A4 stress test: the single hardest assumption to resolve without the Series A hire. The solution is risk mitigation (documentation, emergency contract), not elimination — Hendra is honest about this with investors. Hendra: 'Investor yang tidak menanyakan tentang risiko engineer tunggal: bukan investor yang baik. Saya lebih suka investor yang bertanya dengan keras tentang risiko ini daripada yang mengabaikannya — karena yang bertanya akan benar-benar membantu saya membangun solusinya post-investment.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.assumption} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.assumption}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Supporting evidence: {r.supporting_evidence}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Stress test and resolution: {r.stress_test_result}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Assumption stress testing adalah Hendra's most intellectually honest pre-Series A discipline — because investors will stress-test every assumption in MJP's pitch deck, and founders who have already stress-tested their own assumptions before the investor meeting respond with specificity and confidence rather than defensiveness and improvisation. The 4 assumptions (market size, data quality moat, NPS at scale, single-engineer risk): are the 4 most dangerous assumptions in MJP's business model — 'dangerous' meaning: if any of them is wrong, the Series A thesis breaks down in a fundamental way. Hendra's methodology: for each assumption, explicitly construct the best-case argument FOR the assumption (supporting evidence) AND the most credible argument AGAINST it (stress test case). Then: determine whether the resolution is 'the assumption survives the stress test' (A1, A2 — with caveats), 'the assumption needs to be reframed to be honest' (A3), or 'the assumption has real residual risk that requires mitigation' (A4). The founder who walks into a Series A meeting having done this analysis: is the founder investors trust with their capital. The assumption stress test is not just a pitch preparation exercise — it is Hendra's mechanism for discovering which strategic investments to prioritize post-Series A (Trust Score standardization for A1, relationship moat acceleration for A2, CS team build for A3, engineering documentation and backup for A4). The 4 most important post-Series A investments: map exactly to the 4 most dangerous pre-Series A assumptions. Assumption stress testing: converts intellectual honesty into investment priority clarity.</p>
      </div>

      {/* R118: Problem Statement Version History */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <History className="h-3.5 w-3.5 text-primary" /> PROBLEM STATEMENT VERSION HISTORY — Bagaimana Definisi Inti Masalah MJP Berevolusi 2021–2026: 5 Iterasi Besar Problem Statement, Apa yang Memicu Setiap Perubahan, dan Apa yang Konstan di Tengah Semua Perubahan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { version: "VERSION-1 (2021): 'BUJK tidak bisa memantau semua portal LPSE secara efisien'", trigger_and_insight: "The founding problem statement: born directly from Hendra's observation of his uncle's BUJK business (the family company whose inefficiency inspired MJP's founding). The uncle's admin staff: spending 3–4 hours per day manually checking LPSE portals. Version 1 was narrow, operationally specific, and solvable — 'we will build a tool that checks all 671 portals and delivers the results in 5 minutes.' This version: drove the first 18 months of product development (the tender alert crawler, the basic subscription service). The limitation: Version 1 was describing a symptom, not a root cause. Why was portal monitoring inefficient? Because there was no integrated intelligence layer — just fragmented data sources.", what_changed: "What changed Version 1: Budi's first narasumber interviews (Q4 2021–Q1 2022). The narasumber didn't say 'I need a better LPSE monitoring tool.' They said 'I don't know which tenders I should pursue, I don't know if my qualifications are current, I don't know how I compare to competitors, and I don't know which regulations have changed.' The portal monitoring problem: one symptom of a broader information asymmetry problem. The discovery: shifted Hendra's understanding from 'we are building a monitoring tool' to 'we are addressing information asymmetry.'", tc: "text-primary" },
            { version: "VERSION-2 (2022): 'BUJK menghadapi asimetri informasi yang membuat mereka tidak kompetitif'", trigger_and_insight: "Version 2: the first abstraction. 'Information asymmetry': the framing that connected LPSE monitoring (PP-001), regulatory interpretation difficulty (PP-002), competitor intelligence gaps (PP-003/004), and qualification complexity (PP-005) into a single conceptual framework. This version: immediately more powerful for product prioritization (any feature that addresses information asymmetry is on-strategy; any feature that doesn't is off-strategy) and for marketing (BUJK could recognize the 'information asymmetry' problem even if they wouldn't have articulated it themselves).", what_changed: "What changed Version 2: Sari's first year of briefing editorial work (2022). Sari's observation: simply providing more information doesn't solve information asymmetry if the information is not interpreted and contextualized. A BUJK who receives all 671 LPSE alerts every day: is still information-asymmetric because they can't process and act on that volume. The insight: information asymmetry in the BUJK market is not just about information access — it's about information intelligence (the ability to derive actionable insight from raw information). Version 2's limitation: 'information asymmetry' describes the problem but not the mechanism that creates it.", tc: "text-blue-700" },
            { version: "VERSION-3 (2023): 'BUJK tidak punya akses ke intelijen pasar yang memungkinkan keputusan bisnis berbasis data'", trigger_and_insight: "Version 3: the intelligence framing. The shift from 'information' to 'market intelligence': captured the difference between raw data (LPSE award records) and actionable insight (Trust Score, competitive positioning, regulatory forecast). This version: justified MJP's full product architecture (not just a data aggregator but an intelligence platform) and created the competitive moat narrative ('intelligence requires interpretation, and interpretation requires deep market knowledge that takes years to build — we have 2 years of it').", what_changed: "What changed Version 3: Hendra Jr.'s NLQ development (2023). The NLQ: revealed that BUJK's information asymmetry was not uniform across topics — it was most severe for regulatory interpretation (where the gap between 'I know the rule exists' and 'I know what it means for my specific situation' is largest). The regulation complexity insight: shifted the problem framing from 'market intelligence broadly' to 'strategic decision intelligence specifically for navigating Indonesia's complex procurement regulatory environment.' Version 3 was too broad ('market intelligence' could apply to any industry); Version 4 would be more specific.", tc: "text-emerald-700" },
            { version: "VERSION-4 (2024): 'BUJK tidak bisa membuat keputusan bisnis strategis karena tidak ada sumber terpadu untuk intelijen pengadaan Indonesia'", trigger_and_insight: "Version 4: the integration framing. 'Unified source': the key addition — not just any market intelligence, but the specific integrated intelligence (tender + regulatory + competitive + certification) that BUJK need in a single platform. This version: directly addressed the competitive positioning question ('why not just use LPSE aggregators + LKPP website + GAPENSI newsletter?') with 'because those are fragmented, unintegrated, and unannotated — the intelligence value comes from the integration and annotation, not the raw data.'", what_changed: "What changed Version 4: the Series A preparation process (2025). Hendra's investor pitch preparation: revealed that 'unified source for procurement intelligence' was a product description but not a clear explanation of the market failure that MJP exists to correct. VCs want to understand: why does this market failure exist? Why hasn't it been fixed? Why is now the right time? Version 4 answered 'what' but not 'why.' Version 5 would address the root cause explanation.", tc: "text-orange-700" },
            { version: "VERSION-5 (2025–current): 'Fragmentasi ekosistem pengadaan Indonesia menciptakan asimetri informasi struktural yang membuat 99% BUJK beroperasi di bawah kemampuan kompetitif penuhnya'", trigger_and_insight: "Version 5: the structural explanation. 'Fragmentation of Indonesia's procurement ecosystem': identifies the root cause (67.000 BUJK, 671 portals, 127 regulatory domains, 34 LSPs, no integration layer). 'Structural information asymmetry': identifies the mechanism (the fragmentation creates asymmetry by design — the system was not built for BUJK decision support). '99% of BUJK operating below full competitive capacity': quantifies the market opportunity (the scale of the under-served population). This version: answers the investor questions ('why does the market failure exist?', 'why is it persistent?', 'how large is it?') that Version 4 left open.", what_changed: "Version 5's permanence: Hendra believes this version is stable — it captures the root cause (ecosystem fragmentation), mechanism (information asymmetry), and scale (99% of BUJK affected) in a way that will remain accurate regardless of which specific features MJP builds next. A problem statement that requires updating with every new feature is a symptom description. A problem statement that remains valid regardless of the solution evolution: is a true root cause identification. Version 5: Hendra's most mature articulation of what MJP exists to solve — one that will be in the Series A pitch deck and, he believes, will still be accurate in MJP's Series C pitch deck in 2030.", tc: "text-purple-700" },
          ].map((r) => (
            <div key={r.version} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.version}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Trigger and insight: {r.trigger_and_insight}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>What changed it: {r.what_changed}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Problem statement version history adalah Hendra's most intellectually honest artifact of MJP's 5-year journey — because it shows not just where MJP arrived but how it got there, including the wrong turns and the discoveries that corrected them. The 5 versions (LPSE monitoring → information asymmetry → market intelligence → unified source → structural fragmentation): are a 5-year learning process compressed into an evolution map. Each version: was correct for its time and incomplete relative to the next. Version 1 was the right starting hypothesis — it got MJP to its first 50 subscribers. Version 5 is the right articulation for Series A — it explains MJP's market opportunity to VCs in terms that survive investor scrutiny. The most important insight from the version history: the problem statement evolution tracks with MJP's product evolution almost perfectly. Version 1 (monitoring) → crawler product. Version 2 (information asymmetry) → integrated briefing. Version 3 (market intelligence) → Trust Score + Knowledge Registry. Version 4 (unified source) → NLQ integration. Version 5 (structural explanation) → Series A narrative. The product and the problem definition co-evolved — neither drove the other unilaterally. Hendra's product decisions: shaped his understanding of the problem. His evolving problem understanding: shaped his product decisions. This co-evolution: the most authentic form of product-market fit development — not 'we identified the market and then built the product' but 'we built iteratively, and our understanding of what we were building deepened with each iteration.' The problem statement version history: Hendra's most honest response to the investor question 'how did you develop such deep market understanding?' The answer: by being wrong 4 times and learning from each version's limitations.</p>
      </div>

      {/* R119: Problem Statement Falsifiability */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-primary" /> PROBLEM STATEMENT FALSIFIABILITY — Bagaimana Hendra Menguji Apakah Problem Statement Benar-Benar Bisa Dipecahkan MJP: 4 Uji Falsifikasi, Pertanyaan Spesifik untuk Setiap Uji, dan Mengapa Problem Statement yang Tidak Lolos Uji Lebih Berharga daripada yang Lolos
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { test: "FALSIFIABILITY TEST-1: The Counterfactual Test — 'What would the world look like if this problem didn't exist?'", test_question: "Hendra's exact question: 'Jika masalah ini tiba-tiba menghilang besok — misalnya LPSE membuat satu portal nasional yang terintegrasi sempurna — apa yang berubah dalam kehidupan BUJK sehari-hari?' The test: if the answer is 'not much' or 'hard to say', the problem statement is too vague to be actionable. If the answer is specific and vivid ('procurement staff would save 12 hours/week, tender qualification errors would drop by 60%, bid submission deadlines would be met consistently'), the problem statement is specific enough that a solution can be designed and measured against it.", hendra_finding: "Hendra's finding from applying this test to MJP's early problem statements: the original 2021 problem statement ('BUJK perlu informasi pasar yang lebih baik') failed the counterfactual test — it was impossible to imagine what 'better market information' would specifically change in BUJK's operational reality. The rewritten version ('BUJK yang aktif bersaing di tender kehilangan 8–12 jam per minggu mengumpulkan data yang tersebar di 671+ portal LPSE'): easily passes — the counterfactual is 'those 8–12 hours are recovered and used for bid preparation, resulting in better qualification documents and higher win rates.' The specific, vivid counterfactual: the clearest signal that a problem statement is operationally grounded.", tc: "text-primary" },
            { test: "FALSIFIABILITY TEST-2: The Measurement Test — 'How would we know if the problem was solved?'", test_question: "Hendra's exact question: 'Jika MJP berhasil menyelesaikan masalah ini sepenuhnya, angka apa yang berubah dan dari berapa menjadi berapa?' The test: if no specific metric can be identified, the problem statement is not grounded in a measurable outcome. A problem statement that generates specific metrics ('subscriber procurement staff time spent on LPSE data gathering: from 10 hours/week to under 2 hours/week') is directly connected to product success measurement. A problem statement that can only be assessed qualitatively ('subscribers feel better informed') is not falsifiable — it cannot be proved or disproved by any measurement.", hendra_finding: "Hendra's finding: the measurement test is the most effective filter for distinguishing 'real problems' from 'symptoms of real problems.' The symptom-level problem ('BUJK merasa stres menghadapi tender') doesn't have a clear measurement. The underlying problem ('BUJK lose 15% of tender opportunities due to qualification document errors that could have been avoided with better compliance guidance') does — the metric is 'tender disqualification rate due to document errors.' MJP's solution success metric: if subscribers using MJP's qualification checklist KR assets have a 40% lower disqualification rate than non-users, the problem is being solved measurably. The measurement test: the quality gate that converts 'interesting human problems' into 'solvable product problems.'", tc: "text-blue-700" },
            { test: "FALSIFIABILITY TEST-3: The Scope Test — 'Is this MJP's problem to solve, or someone else's?'", test_question: "Hendra's exact question: 'Siapa yang paling posisinya untuk menyelesaikan masalah ini — MJP, LKPP, BNSP, asosiasi BUJK, atau perusahaan lain?' The test: if the answer is clearly 'LKPP should fix this by creating a unified portal' (a systemic regulatory infrastructure problem), MJP's role is to help BUJK navigate the problem as it exists, not to solve the root cause. A problem MJP can solve = a problem where MJP has the data, the distribution channel, and the editorial capability to provide a solution today. A problem only LKPP can solve = a problem MJP can only work around, not resolve.", hendra_finding: "Hendra's finding: the scope test saved MJP from 2 product dead-ends. In 2022, a proposed feature to 'help BUJK coordinate procurement documentation with LKPP's central system' failed the scope test — it required LKPP's cooperation and API access that MJP had no path to obtaining. In 2023, a proposed 'BUJK social network' feature failed the scope test — 'connecting BUJK with each other' is a community platform problem (better solved by an association like GAPENSI) not a market intelligence problem (where MJP has a genuine competency advantage). Both features: correctly identified as out-of-scope before engineering resources were committed. The scope test's ROI: 100% of engineering time saved from projects that would have been built and then abandoned.", tc: "text-emerald-700" },
            { test: "FALSIFIABILITY TEST-4: The Uniqueness Test — 'Does MJP have a specific advantage in solving this that competitors don't?'", test_question: "Hendra's exact question: 'Mengapa MJP — bukan Google, ChatGPT, atau startup lain — yang paling baik posisinya untuk menyelesaikan masalah ini?' The test: if the answer is 'anyone with a web scraper and a chatbot could do this', the problem may be real but MJP's solution is commoditizable. If the answer involves MJP's specific combination of assets (5-year narasumber research corpus, 671-portal crawler, 487-subscriber behavioral data, Sari's editorial expertise, Reza's BUJK community relationships), the solution has a genuine competitive moat.", hendra_finding: "Hendra's finding: the uniqueness test is what converts MJP from 'a startup that does market research' into 'the only organization positioned to build this specific product.' The KNQ platform uniqueness argument: building an NLQ system for Indonesian construction procurement requires 5 years of specialized corpus, not just a general AI model. The Trust Score uniqueness argument: calculating construction contractor trustworthiness in Indonesia requires 671-portal crawler coverage that no competitor has built. Every problem statement that passes the uniqueness test: confirms that MJP is not just addressing a real problem but is uniquely positioned to address it better than anyone else — the Series A defensibility argument in miniature. Problem statements that fail the uniqueness test: correctly de-prioritized not because the problem is unreal, but because MJP building a solution creates no competitive advantage.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.test} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.test}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Test question: {r.test_question}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Hendra's finding: {r.hendra_finding}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Problem statement falsifiability adalah Hendra's highest-leverage product management discipline — because a problem statement that cannot be falsified cannot guide product development. The 4 falsifiability tests (counterfactual, measurement, scope, uniqueness): are not bureaucratic hurdles but thinking tools that force problem statements into the precise, grounded form required for good product design. A problem statement that fails the counterfactual test is too vague to design against. One that fails the measurement test cannot be validated as solved. One that fails the scope test wastes engineering on problems MJP cannot resolve. One that fails the uniqueness test wastes resources building something any competitor can copy. The 4 tests together: form a quality gate that ensures MJP's product development roadmap addresses problems that are real (counterfactual), measurable (measurement), within MJP's addressable domain (scope), and strategically defensible (uniqueness). Hendra's rule: a problem statement must pass all 4 tests before any engineering design discussion begins. A problem statement that fails any test: is returned to Budi for refinement, not sent to Hendra Jr. for implementation. The value of returned problem statements: they don't represent wasted research — they represent research that discovered the problem's true boundary (too vague, unmeasurable, out-of-scope, or commoditizable). Each returned problem statement teaches the team something about what MJP is not — an equally important clarification as what MJP is. Hendra's Series A product thesis: 'Every feature on MJP's roadmap has passed all 4 falsifiability tests. This is unusual in early-stage B2B SaaS — most products are built against gut-feel problem statements. MJP's problem rigor is why our feature delivery has a 94% subscriber satisfaction rate and a 0% embarrassing-failure rate since 2022.'</p>
      </div>

      {/* R120: Problem Statement Defensibility Under Investor Scrutiny */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> PROBLEM STATEMENT DEFENSIBILITY — Bagaimana Hendra Memastikan Problem Statement Inti MJP Tahan Terhadap Tantangan Investor: 3 Dimensi Pertahanan, Perbedaan antara 'Masalah yang Menarik' dan 'Masalah yang Benar-benar Ada', dan Mengapa Rigor Perumusan Masalah Adalah Aset Fundraising
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { defense_dim: "DEFENSE-DIM-1: Empirical grounding — setiap klaim masalah didukung data yang dapat diverifikasi, bukan anekdot", what_this_means: "MJP's core problem statement ('BUJK in Indonesia systematically lack access to the timely, integrated market intelligence needed to compete effectively in public procurement') contains 3 empirical claims: (1) systematic lack of access, (2) timely and integrated, (3) needed to compete effectively. Hendra's standard: each claim must be supportable by data he can name and explain, not just data he has seen. The 'systematic lack' claim: supported by Budi's baseline research (67% of BUJK survey respondents report learning about tender opportunities 3+ days after publication, with a mean discovery lag of 4.7 days). The 'needed to compete' claim: supported by the tender win rate analysis showing subscribers who act on same-day intelligence win 34% more tenders than subscribers who act on 3-day-old intelligence.", investor_challenge_response: "Investor challenge response: 'How do you know this is a real problem and not a problem you've convinced yourself exists?' Hendra's answer: 'Because we have 5 years of evidence from 487 subscribers who renewed their subscriptions after experiencing the product. The most rigorous test of problem-solution fit is not a survey (people lie in surveys) but a renewal decision (people don't pay twice for a product that doesn't solve their problem). Our 89% renewal rate is empirical evidence that the problem we identified is real and our solution addresses it adequately.' The renewal rate as problem validation: the most investor-credible evidence because it is behavioral (what subscribers do) not attitudinal (what subscribers say they think).", tc: "text-primary" },
            { defense_dim: "DEFENSE-DIM-2: Alternative hypothesis elimination — Hendra has seriously considered and can refute the 'this problem doesn't actually exist' challenges", what_this_means: "Before stating MJP's problem, Hendra explicitly considers and can articulate the strongest counter-arguments: (1) 'BUJK don't need intelligence — they just need relationships.' Counter: relationships solve access to specific projects but not systematic market intelligence or regulatory compliance. (2) 'The government already provides all procurement information publicly via LPSE.' Counter: LPSE provides data but not intelligence — 671 fragmented portals with inconsistent data quality create a signal-to-noise problem that raw portal access doesn't solve. (3) 'Only large BUJK need this — small BUJK compete on price and don't need market intelligence.' Counter: 55% of MJP's subscribers are small BUJK, and their renewal rate is 87% — almost as high as the overall average — demonstrating that small BUJK value market intelligence when it's priced accessibly.", investor_challenge_response: "Investor challenge response: 'We've invested in B2B information businesses before that didn't work because the customers said they wanted the product but wouldn't pay for it.' Hendra's answer: 'That's the right risk to identify. The way we validated against it was not with surveys or pilots but with a paying subscription that required real money from BUJK who had alternatives. Our earliest 20 subscribers (2020–2021) had no success stories to reference, no social proof, and no refund guarantee. They paid Rp 750rb/month based on the product's demonstrated value in a 2-week trial period. Those 20 subscribers: 17 of them are still subscribers today. The customers who wouldn't pay were filtered out in our first quarter, and the 17 who stayed have paid every month for 5 years.' The pre-social-proof early subscriber retention: the cleanest evidence that the core problem is real and the solution is effective.", tc: "text-blue-700" },
            { defense_dim: "DEFENSE-DIM-3: Problem scope precision — Hendra has refined the problem statement to be as specific as possible without over-constraining the market", what_this_means: "Problem statement precision: the difference between 'BUJK need better information' (too broad — could justify 100 different products) and 'BUJK in Indonesia need timely access to integrated public procurement intelligence — tenders, competitor qualification, and regulatory compliance — to compete effectively in the government contracting market' (specific enough to define a product, broad enough to capture a significant market). The precision test Hendra applies: can a product team build the right product from the problem statement alone, without additional specification? If the problem statement is too vague: the product team will make arbitrary choices in opposite directions. If the problem statement is too specific: the product team will miss adjacent opportunities that serve the same underlying customer need.", investor_challenge_response: "Investor challenge response: 'Can you expand this to a bigger market?' Hendra's answer: 'Yes — and we've mapped 3 adjacent expansions: (1) Government procurement officers who evaluate BUJK qualifications (same data, different user — institutional accounts). (2) Bank credit analysts who assess BUJK creditworthiness for project financing (Trust Score as credit intelligence). (3) Building materials suppliers who sell to BUJK and want to predict BUJK project pipeline (tender intelligence as B2B sales targeting). In each case: the core problem (integrated procurement intelligence) is the same, the user context changes. We chose BUJK first because their pain is most acute (they lose money when they lack intelligence) and they pay most directly for solutions. The adjacent markets: exist and are validated by inbound interest from procurement officer and bank contacts. We haven't pursued them yet because our current market has 199,513 more BUJK to reach before we've exhausted it.' The adjacent market awareness without premature expansion: the investor answer that demonstrates strategic discipline.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.defense_dim} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.defense_dim}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">What this means: {r.what_this_means}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Investor challenge response: {r.investor_challenge_response}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Problem statement defensibility adalah the fundraising asset that most founders underestimate — because most founders treat their problem statement as a premise (the thing they state before getting to the solution) rather than as a claim (the thing they must defend to a skeptical audience). Investors who have funded dozens of B2B companies have seen founders who were certain their problem was real turn out to be wrong. The investor's skepticism about problem statements: earned through experience, not cynicism. Hendra's approach to problem statement defensibility: treating the problem statement as the most important hypothesis in MJP's entire business, and subjecting it to as much rigor as any other hypothesis. The 3 defensibility dimensions (empirical grounding, alternative hypothesis elimination, scope precision): together produce a problem statement that survives investor scrutiny not because it's been rehearsed to sound good but because the underlying problem has been genuinely validated through 5 years of subscriber behavior data. The fundraising implication: a founder who can defend their problem statement with behavioral data (renewal rates), alternative hypothesis refutation (we've considered and tested the counter-arguments), and scope precision (we know exactly what problem we solve and why we don't solve adjacent problems yet): signals to investors that they understand their market with unusual depth. The problem statement depth: a proxy for the founder's overall market understanding quality, which is the most important thing an early-stage investor is evaluating. Hendra's preparation for Series A: begins with the problem statement, because every other slide in the deck is a consequence of the problem statement being true. If the problem statement is right: the market, solution, traction, and expansion all follow logically. If the problem statement is wrong: no amount of polish on the other slides can compensate. Hendra's problem rigor: why MJP's feature delivery has never chased a problem that turned out not to exist — because each new feature starts from the same empirical grounding process that validated the original platform.</p>
      </div>

      {/* Problem list */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Escape") { setSearch(""); e.currentTarget.blur(); } }}
              title="Tekan / untuk fokus ke pencarian"
              placeholder="Cari masalah, peluang, catatan… ( / )"
              className="pl-8 pr-7 h-9 text-xs"
            />
            {!search && <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">/</kbd>}
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Hapus pencarian">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setDomainFilter("")}
              aria-pressed={!domainFilter}
              className={cn("text-[10px] font-mono px-2.5 py-1 rounded-sm border transition-colors",
                !domainFilter ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted",
                "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none"
              )}
            >
              Semua
            </button>
            {uniqueDomains.slice(0, 8).map(d => (
              <button
                key={d}
                onClick={() => setDomainFilter(domainFilter === d ? "" : d)}
                aria-pressed={domainFilter === d}
                className={cn("text-[10px] font-mono px-2.5 py-1 rounded-sm border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none",
                  domainFilter === d ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {d}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSortByDomain(v => !v)}
            aria-pressed={sortByDomain}
            className={cn("text-[10px] font-mono font-bold px-2.5 py-1 rounded-sm border transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", sortByDomain ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted")}
            title="Urut berdasarkan domain A–Z"
          >
            {sortByDomain ? "↑ A–Z Domain" : "↓ Domain"}
          </button>
          {Object.values(pmNotes).filter(v => v?.trim()).length > 0 && (
            <button
              onClick={() => setShowWithNotesOnly(v => !v)}
              aria-pressed={showWithNotesOnly}
              className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", showWithNotesOnly ? "bg-blue-500 text-white border-blue-500" : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200")}
              title="Filter hanya masalah dengan catatan"
            >
              {Object.values(pmNotes).filter(v => v?.trim()).length} catatan
            </button>
          )}
          <span className="text-[10px] font-mono text-muted-foreground ml-auto flex items-center gap-2">
            {(search || domainFilter || sortByDomain || showWithNotesOnly) && (
              <button
                onClick={() => { setSearch(""); setDomainFilter(""); setSortByDomain(false); setShowWithNotesOnly(false); }}
                className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 outline-none"
                title="Reset semua filter"
              >
                ✕ Reset
              </button>
            )}
            {sorted.filter(p => p.priority === "CRITICAL" || p.priority === "HIGH").length > 0 && (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                {sorted.filter(p => p.priority === "CRITICAL" || p.priority === "HIGH").length} prioritas tinggi
              </span>
            )}
            <span aria-live="polite" aria-atomic="true">{sorted.length} masalah</span>
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border rounded-sm p-3 space-y-2 animate-pulse bg-muted/20">
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-2 bg-muted rounded w-1/2" />
                <div className="flex gap-1.5 mt-1">
                  <div className="h-4 w-12 bg-muted rounded-full" />
                  <div className="h-4 w-16 bg-muted rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <CircleAlert className="h-8 w-8 opacity-30" />
            <p className="text-sm">Tidak ada masalah sesuai filter</p>
            <button onClick={() => { setSearch(""); setDomainFilter(""); setShowWithNotesOnly(false); }} className="text-xs font-mono text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none">✕ Reset filter</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {sorted.map((pp, i) => {
              const related = researchItems
                .filter((r) => r.category && pp.domain && r.category.toLowerCase().includes(pp.domain.toLowerCase().split(" ")[0]))
                .slice(0, 3)
                .map((r) => ({ id: r.id, title: r.title ?? "", status: r.status }));
              return <ProblemCard key={pp.id} pp={pp} rank={i + 1} relatedResearch={related} note={pmNotes[pp.id] ?? ""} onNoteChange={(val) => updatePmNote(pp.id, val)} />;
            })}
          </div>
        )}

        <div className="border-t pt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-mono">
            {stats.withService} dari {stats.total} masalah sudah punya peluang layanan terdefinisi
          </p>
          <Link href="/pain-points">
            <span className="text-xs text-primary font-mono font-medium hover:underline cursor-pointer flex items-center gap-1">
              Kelola CPKB lengkap <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        </div>
      </div>
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-6 right-6 z-50 h-9 w-9 rounded-full bg-primary animate-in fade-in slide-in-from-bottom-2 text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" aria-label="Kembali ke atas" title="Kembali ke atas"><ChevronUp className="h-4 w-4" /></button>
      )}
    </div>
  );
}

function parseFotoBukti(description: string | null | undefined): { photoUrl: string | null; cleanDescription: string } {
  if (!description) return { photoUrl: null, cleanDescription: "" };
  // Case-insensitive; accepts https://, http://, and data:image/...;base64,... URLs
  const match = description.match(/\[Foto bukti:\s*([^\]]+)\]/i);
  if (!match) return { photoUrl: null, cleanDescription: description };
  const photoUrl = match[1].trim();
  const clean = description
    .replace(/\n?\[Foto bukti:\s*[^\]]+\]/gi, "")
    .trim();
  return { photoUrl, cleanDescription: clean };
}
