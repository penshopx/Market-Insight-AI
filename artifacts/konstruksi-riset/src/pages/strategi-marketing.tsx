import { useState, useMemo, useEffect, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  useListMarketingStrategies,
  useCreateMarketingStrategy,
  useUpdateMarketingStrategy,
  getListMarketingStrategiesQueryKey,
  useGetTrendingTopics,
  getGetTrendingTopicsQueryKey,
  useListPainPoints,
  getListPainPointsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, ArrowRight, Calendar, ChartColumnBig, ChevronUp, CircleAlert, CircleCheck, Clock, Copy, Filter, Loader2, MessageCircle, Plus, Search, Share2, Target, Trash2, TrendingUp, Users, Zap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { KnowledgeSourcesBar } from "@/components/knowledge-sources-bar";

const STRATEGY_TYPES = [
  "CONTENT_MARKETING", "SOCIAL_MEDIA", "WEBINAR", 
  "DIRECT_SALES", "PARTNERSHIP", "COMMUNITY", "EMAIL", "INFLUENCER"
];

const STRATEGY_TYPE_LABELS: Record<string, string> = {
  CONTENT_MARKETING: "Content Marketing",
  SOCIAL_MEDIA: "Media Sosial",
  WEBINAR: "Webinar",
  DIRECT_SALES: "Direct Sales",
  PARTNERSHIP: "Kemitraan",
  COMMUNITY: "Komunitas",
  EMAIL: "Email",
  INFLUENCER: "Influencer",
};

// Quick-win tactic suggestions — derived from VOC + buying triggers
const QUICK_WIN_TACTICS = [
  { icon: "⚡", label: "WA Blast SBU Expiry", desc: "Target BUJK dengan SBU expire ≤60 hari · timing: 60, 30, 7 hari sebelum", urgency: "Kritis" },
  { icon: "📢", label: "Webinar Regulasi Baru", desc: "Setiap ada Permen/Perpres baru → webinar gratis 1 jam + retargeting peserta", urgency: "Tinggi" },
  { icon: "🎯", label: "LinkedIn Thought Leadership", desc: "1 artikel/minggu: 'Cara BUJK Menengah Lolos Tender Tanpa Konsultan Mahal'", urgency: "Sedang" },
  { icon: "🔔", label: "LPSE Alert Otomatis", desc: "Bot WA kirim notif tender ≥Rp 5M sesuai subklasifikasi subscriber", urgency: "Tinggi" },
  { icon: "🤝", label: "Referral Program GAPENSI", desc: "Partner dengan asosiasi — setiap member anggota dapat free audit SBU", urgency: "Sedang" },
  { icon: "📹", label: "Konten TikTok Viral", desc: "'Kesalahan fatal ini bikin BUJK kalah tender' — hook + edukasi + CTA", urgency: "Sedang" },
  { icon: "🔍", label: "Audit Kesiapan Tender Gratis", desc: "Tawarkan 1 audit kesiapan tender gratis (online, 30 mnt) → konversi ke paket berbayar", urgency: "Tinggi" },
  { icon: "📊", label: "Laporan TKDN Express", desc: "Setelah SE LKPP 10/2024 — tawarkan verifikasi TKDN kilat 3 hari kerja sebagai lead magnet", urgency: "Kritis" },
  { icon: "🏆", label: "Case Study Pemenang Tender", desc: "Dokumentasi klien yang menang tender setelah pakai layanan → publish LinkedIn + WA blast", urgency: "Sedang" },
  { icon: "🏗️", label: "Workshop BIM Gratis 2 Jam", desc: "Undang 20 BUJK Menengah — demo BIM workflow + konsultasi migrasi → pipeline layanan BIM", urgency: "Tinggi" },
  { icon: "✅", label: "TKDN Verifikasi Express", desc: "SE LKPP 10/2024 wajibkan TKDN ≥40% — tawarkan verifikasi 3 hari + sertifikat PDN sebagai USP", urgency: "Kritis" },
  { icon: "📋", label: "Cold Email Direktur Konstruksi", desc: "Sequence 5 email: Pain → Story → Bukti → Offer → Urgency — kirim ke 500 BUJK per batch", urgency: "Sedang" },
  { icon: "🌐", label: "SEO Konten LPJK Organik", desc: "Target keyword 'cara perpanjang SBU', 'biaya SKK 2026', 'pengurusan IUJK' — traffic organik tinggi", urgency: "Tinggi" },
  { icon: "📱", label: "WhatsApp Group B2B Community", desc: "Buat 5 grup WA per kota (Medan, Surabaya, Makassar, Balikpapan, Jakarta) — share intel tender lokal", urgency: "Sedang" },
  { icon: "🤖", label: "Chatbot WA Riset Otomatis", desc: "Bot WA tanya 3 hal: kota, SBU apa, deadline tender → kirim brief singkat + CTA konsultasi", urgency: "Kritis" },
];

// ─── Competitive Response Matrix ──────────────────────────────────────────────

const COMPETITIVE_RESPONSES = [
  { threat: "IjinTender turunkan harga SBU", response: "Reframe ke value: 'Kami bukan hanya urus dokumen — kami monitor expiry, alert tender, dan analisis kompetitor'", tactic: "Konten LinkedIn: why cheap ≠ best", urgency: "Tinggi" },
  { threat: "Marketplace offer SKK Rp 1.5jt", response: "Target segmen di atas: BUJK yang sudah pernah kena masalah vs konsultan murahan", tactic: "Konten: 'Harga murah SKK berujung blacklist LPJK' + case study", urgency: "Kritis" },
  { threat: "Konsultan tradisional pakai relasi", response: "Counter: platform = transparansi + kecepatan + data. Relasi bisa gagal saat deadline mepet", tactic: "Demo live: proses pengurusan digital vs manual — waktu & biaya", urgency: "Sedang" },
  { threat: "Kompetitor baru masuk via VC funding", response: "Kuasai niche: fokus ke intelijen pasar + advisory, bukan hanya pengurusan dokumen biasa", tactic: "Publish laporan riset 'State of Konstruksi Indonesia 2026' — jadi thought leader", urgency: "Tinggi" },
];

const PIPELINE_STAGES = ["PLANNED", "ACTIVE", "PAUSED", "COMPLETED"];

export default function StrategiMarketing() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => { document.title = "Strategi Marketing — Intel Konstruksi"; return () => { document.title = "Intel Konstruksi"; }; }, []);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [createStrategyType, setCreateStrategyType] = useState(STRATEGY_TYPES[0] ?? "CONTENT_MARKETING");
  const [createTouched, setCreateTouched] = useState<Record<string, boolean>>({});
  const [createValues, setCreateValues] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!isCreateOpen) {
      setCreateStrategyType(STRATEGY_TYPES[0] ?? "CONTENT_MARKETING");
      setCreateTouched({});
      setCreateValues({});
    }
  }, [isCreateOpen]);
  const [pendingArchiveId, setPendingArchiveId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [showNotesOnly, setShowNotesOnly] = useState(false);
  const [stratNotes, setStratNotes] = useState<Record<number, string>>(() => {
    try { return JSON.parse(localStorage.getItem("mkp-strat-notes") ?? "{}") as Record<number, string>; } catch { return {}; }
  });
  const [savedStratNoteId, setSavedStratNoteId] = useState<number | null>(null);
  const updateStratNote = (id: number, val: string) => setStratNotes(prev => {
    const next = { ...prev, [id]: val };
    try { localStorage.setItem("mkp-strat-notes", JSON.stringify(next)); } catch { /* ignore */ }
    setSavedStratNoteId(id);
    setTimeout(() => setSavedStratNoteId(s => s === id ? null : s), 2000);
    return next;
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "n" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement) && !(e.target as HTMLElement).isContentEditable)
        setIsCreateOpen(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  
  const { data: strategies, isLoading, isError: isStrategiesError } = useListMarketingStrategies({}, {
    query: { queryKey: getListMarketingStrategiesQueryKey() }
  });

  // Live intel to enrich quick-win tactic suggestions
  const { data: trendingTopics } = useGetTrendingTopics(
    { limit: 6 },
    { query: { queryKey: getGetTrendingTopicsQueryKey({ limit: 6 }) } }
  );
  const { data: painPoints } = useListPainPoints(
    {},
    { query: { queryKey: getListPainPointsQueryKey({}) } }
  );

  // Top critical pain points → high-urgency messaging targets
  const topPainSignals = useMemo(() =>
    (painPoints ?? [])
      .filter(p => p.priority === "CRITICAL" && p.serviceOpportunity)
      .slice(0, 3)
      .map(p => ({ domain: p.domain ?? "—", opportunity: p.serviceOpportunity ?? "", score: p.painScore ?? 0 })),
    [painPoints]
  );
  const hasLiveSignals = (trendingTopics?.length ?? 0) > 0 || topPainSignals.length > 0;

  const createMutation = useCreateMarketingStrategy({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListMarketingStrategiesQueryKey() });
        setIsCreateOpen(false);
        toast.success("Kampanye baru ditambahkan", { description: data.strategyTitle ?? undefined, duration: 2500 });
      },
      onError: (err: unknown) => toast.error("Gagal menyimpan kampanye", { description: err instanceof Error ? err.message : "Coba lagi" }),
    }
  });

  const newItemRef = useRef<HTMLDivElement | null>(null);

  const updateMutation = useUpdateMarketingStrategy({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListMarketingStrategiesQueryKey() });
        { const lbl: Record<string,string> = { PLANNING:"Perencanaan", ACTIVE:"Aktif", PAUSED:"Ditunda", COMPLETED:"Selesai" }; toast.success(`Kampanye → ${lbl[data.status ?? ""] ?? data.status}`, { description: data.strategyTitle ?? undefined, duration: 2500 }); }
      },
      onError: (err: unknown) => toast.error("Gagal memperbarui kampanye", { description: err instanceof Error ? err.message : "Coba lagi" }),
    }
  });


  const NEXT_STAGE: Record<string, string> = {
    PLANNED: "ACTIVE",
    ACTIVE: "PAUSED",
    PAUSED: "COMPLETED",
    COMPLETED: "PLANNED",
  };

  const NEXT_STAGE_LABEL: Record<string, string> = {
    PLANNED: "→ Aktifkan",
    ACTIVE: "⏸ Pause",
    PAUSED: "✓ Selesai",
    COMPLETED: "↺ Ulang",
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const strategyTitle = (fd.get("strategyTitle") as string ?? "").trim();
    const targetAudience = (fd.get("targetAudience") as string ?? "").trim();
    const channels = (fd.get("channels") as string ?? "").trim();
    if (!strategyTitle || !targetAudience || !channels) {
      setCreateTouched({ strategyTitle: true, targetAudience: true, channels: true });
      setCreateValues((v) => ({ ...v, strategyTitle, targetAudience, channels }));
      return;
    }
    createMutation.mutate({
      data: {
        strategyTitle,
        strategyType: fd.get("strategyType") as string,
        targetAudience,
        channels,
        keyMessages: fd.get("keyMessages") as string,
        callToAction: fd.get("callToAction") as string,
        timeline: fd.get("timeline") as string,
        kpi: fd.get("kpi") as string,
        fastMovingTactic: fd.get("fastMovingTactic") as string,
        status: "PLANNED"
      }
    });
  };

  const getStageColor = (stage: string) => {
    switch(stage) {
      case 'PLANNED': return 'bg-slate-100 text-slate-800 border-slate-300';
      case 'ACTIVE': return 'bg-primary text-primary-foreground border-primary';
      case 'PAUSED': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-muted';
    }
  };

  const getTypeIcon = (type: string) => {
    if (type.includes('CONTENT')) return <Target className="h-4 w-4" />;
    if (type.includes('SOCIAL')) return <Share2 className="h-4 w-4" />;
    if (type.includes('SALES')) return <TrendingUp className="h-4 w-4" />;
    return <Zap className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">STRATEGI MARKETING</h1>
          <p className="text-muted-foreground font-mono mt-1 flex items-center gap-2">
            FAST-MOVING CAMPAIGN PIPELINE
            {(() => {
              const activeCount = (strategies ?? []).filter(s => s.status === "ACTIVE").length;
              return activeCount > 0 ? (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-300">{activeCount} aktif</span>
              ) : null;
            })()}
            {(() => {
              const planned = (strategies ?? []).filter(s => s.status === "PLANNED").length;
              return planned > 0 ? (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">{planned} direncanakan</span>
              ) : null;
            })()}
            {Object.values(stratNotes).filter(v => v?.trim()).length > 0 && (
              <button
                onClick={() => setShowNotesOnly(v => !v)}
                aria-pressed={showNotesOnly}
                className={cn("text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full border transition-colors", showNotesOnly ? "bg-blue-500 text-white border-blue-500" : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200")}
                title="Klik untuk filter hanya strategi dengan catatan"
              >
                {Object.values(stratNotes).filter(v => v?.trim()).length} catatan
              </button>
            )}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {(filterStatus !== "ALL" || filterType !== "ALL") && (() => {
            const matchedCount = (strategies ?? []).filter(s => (filterStatus === "ALL" || s.status === filterStatus) && (filterType === "ALL" || s.strategyType === filterType)).length;
            return <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{matchedCount} dari {(strategies ?? []).length}</span>;
          })()}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 w-36 text-xs font-mono bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs font-mono">Semua Status</SelectItem>
              {["PLANNED", "ACTIVE", "PAUSED", "COMPLETED"].map(s => (
                <SelectItem key={s} value={s} className="text-xs font-mono">{{ PLANNED:"Direncanakan", ACTIVE:"Aktif", PAUSED:"Ditunda", COMPLETED:"Selesai" }[s] ?? s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-9 w-40 text-xs font-mono bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs font-mono">Semua Tipe</SelectItem>
              {STRATEGY_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="text-xs font-mono">{STRATEGY_TYPE_LABELS[t] ?? t.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(filterStatus !== "ALL" || filterType !== "ALL" || showNotesOnly) && (
            <button
              onClick={() => { setFilterStatus("ALL"); setFilterType("ALL"); setShowNotesOnly(false); }}
              className="h-9 px-2.5 text-[10px] font-mono font-bold rounded-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 outline-none"
              title="Reset semua filter"
            >
              ✕ Reset
            </button>
          )}
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Tambah Strategi
                <kbd className="ml-2 text-[9px] font-mono opacity-60 border border-current/30 rounded px-1">N</kbd>
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Buat Strategi Kampanye</DialogTitle>
              <DialogDescription>Rencanakan taktik marketing untuk mendistribusikan output produk.</DialogDescription>
            </DialogHeader>
            <form key={String(isCreateOpen)} onSubmit={handleCreate} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="strategyTitle">Nama Kampanye <span className="text-destructive">*</span></Label>
                  <Input
                    id="strategyTitle" name="strategyTitle" placeholder="Cth: Campaign Q3 SBU Cepat" autoFocus maxLength={255}
                    value={createValues.strategyTitle ?? ""}
                    onChange={(e) => setCreateValues((v) => ({ ...v, strategyTitle: e.target.value }))}
                    onBlur={() => setCreateTouched((t) => ({ ...t, strategyTitle: true }))}
                    className={createTouched.strategyTitle && !createValues.strategyTitle?.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {createTouched.strategyTitle && !createValues.strategyTitle?.trim() && (
                    <p className="text-xs text-destructive">Nama kampanye wajib diisi</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Tipe Strategi</Label>
                  <input type="hidden" name="strategyType" value={createStrategyType} />
                  <Select value={createStrategyType} onValueChange={setCreateStrategyType}>
                    <SelectTrigger className="h-10 w-full" aria-label="Pilih tipe strategi"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STRATEGY_TYPES.map(t => <SelectItem key={t} value={t}>{STRATEGY_TYPE_LABELS[t] ?? t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetAudience">Target Audiens <span className="text-destructive">*</span></Label>
                  <Input
                    id="targetAudience" name="targetAudience" placeholder="Kontraktor Gred Kecil" maxLength={255}
                    value={createValues.targetAudience ?? ""}
                    onChange={(e) => setCreateValues((v) => ({ ...v, targetAudience: e.target.value }))}
                    onBlur={() => setCreateTouched((t) => ({ ...t, targetAudience: true }))}
                    className={createTouched.targetAudience && !createValues.targetAudience?.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {createTouched.targetAudience && !createValues.targetAudience?.trim() && (
                    <p className="text-xs text-destructive">Target audiens wajib diisi</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channels">Channel Distribusi <span className="text-destructive">*</span></Label>
                  <Input
                    id="channels" name="channels" placeholder="WA Blast, FB Ads, Email" maxLength={255}
                    value={createValues.channels ?? ""}
                    onChange={(e) => setCreateValues((v) => ({ ...v, channels: e.target.value }))}
                    onBlur={() => setCreateTouched((t) => ({ ...t, channels: true }))}
                    className={createTouched.channels && !createValues.channels?.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {createTouched.channels && !createValues.channels?.trim() && (
                    <p className="text-xs text-destructive">Channel distribusi wajib diisi</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeline">Timeline</Label>
                  <Input id="timeline" name="timeline" placeholder="Agustus - September 2026" maxLength={100} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="fastMovingTactic">Taktik Fast-Moving (Callout)</Label>
                  <div className="relative">
                    <Textarea id="fastMovingTactic" name="fastMovingTactic" placeholder="Diskon 20% bagi pendaftar dari link khusus ini…" className="border-primary/50 focus-visible:ring-primary h-20 pb-4 resize-none" maxLength={300} onChange={(e) => { const el = e.currentTarget.nextElementSibling as HTMLSpanElement | null; if (el) el.textContent = `${e.currentTarget.value.length}/300`; }} />
                    <span className="absolute right-1 bottom-0.5 text-[8px] font-mono text-muted-foreground/50 pointer-events-none">0/300</span>
                  </div>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="kpi">Metriks Sukses (KPI)</Label>
                  <Input id="kpi" name="kpi" placeholder="Cth: 100 Lead MQL, CAC Rp 50.000" maxLength={255} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Menyimpan…</> : "Tambah ke Pipeline"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <KnowledgeSourcesBar pageKey="strategi-marketing" />

      {/* Live Market Signals — enriched from DB pain points + trending topics */}
      {hasLiveSignals && (
        <div className="border rounded-sm p-3 bg-card shrink-0 border-primary/20">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
            <Zap className="h-3 w-3 animate-pulse" />
            SINYAL LIVE — Prioritas Kampanye Dari Data Riset Real-Time
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {topPainSignals.map((s, i) => (
              <div key={i} className="flex items-start gap-2 p-2 border border-red-200 rounded-sm bg-red-50/40">
                <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-red-500 text-white rounded-sm shrink-0">⚡{s.score}</span>
                <div className="min-w-0">
                  <span className="text-[9px] font-mono font-bold text-red-700">{s.domain}</span>
                  <p className="text-[9px] text-muted-foreground leading-snug truncate" title={s.opportunity}>{s.opportunity}</p>
                </div>
              </div>
            ))}
            {(trendingTopics ?? []).slice(0, 4 - Math.min(topPainSignals.length, 2)).map((t, i) => (
              <div key={`t-${i}`} className="flex items-start gap-2 p-2 border border-blue-200 rounded-sm bg-blue-50/40">
                <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-blue-500 text-white rounded-sm shrink-0">{t.trend === "up" ? "↑" : "→"}{t.count}</span>
                <div className="min-w-0">
                  <span className="text-[9px] font-mono font-bold text-blue-700">{t.category ?? "—"}</span>
                  <p className="text-[9px] text-muted-foreground leading-snug truncate" title={t.topic}>{t.topic}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Go-to-Market Intelligence Board */}
      <div className="border rounded-sm p-4 bg-card shrink-0">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> GO-TO-MARKET INTELLIGENCE — Strategi Masuk Pasar per Segmen Prioritas
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Segmen Target", "Entry Point", "Pesan Utama", "Channel Terbaik", "Offer Pembuka", "Time-to-Revenue"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { seg: "BUJK Kecil Baru", entry: "SBU expiry alert — 90 hari", pesan: "Jangan biarkan proyek terhenti karena SBU mati", ch: "WhatsApp Blast", offer: "Konsultasi gratis 30 mnt + draft timeline", t2r: "3–7 hari", t2rColor: "text-emerald-700" },
                { seg: "BUJK Menengah Growth", entry: "SMAP enforcement deadline", pesan: "SMAP bukan pilihan — ini wajib dan kami bantu", ch: "LinkedIn + Email", offer: "SMAP gap audit gratis", t2r: "7–14 hari", t2rColor: "text-emerald-700" },
                { seg: "Tenaga Ahli SKK", entry: "SKK akan expired / jenjang naik", pesan: "Upgrade SKK sekarang sebelum proyek hilang", ch: "WA personal + grup profesional", offer: "Simulasi biaya + timeline upgrade", t2r: "1–5 hari", t2rColor: "text-emerald-700" },
                { seg: "Tim Tender Kontraktor", entry: "Tender besar buka pendaftaran", pesan: "Jangan kalah teknis karena dokumen tidak lengkap", ch: "LinkedIn + LPSE Monitor", offer: "Eligibility check gratis dalam 24 jam", t2r: "5–10 hari", t2rColor: "text-blue-700" },
                { seg: "Konsultan & Partner", entry: "Networking acara industri", pesan: "Platform riset MJP bisa di-white-label untuk klien Anda", ch: "Email B2B + Demo meeting", offer: "Trial 14 hari + revenue share model", t2r: "14–30 hari", t2rColor: "text-orange-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{r.seg}</td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground">{r.entry}</td>
                  <td className="px-3 py-2 text-[10px] italic">{r.pesan}</td>
                  <td className="px-3 py-2"><span className="text-[9px] font-mono bg-muted px-1.5 py-0.5 rounded-sm">{r.ch}</span></td>
                  <td className="px-3 py-2 text-[10px] text-primary">{r.offer}</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[10px] whitespace-nowrap ${r.t2rColor}`}>{r.t2r}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Campaign Performance Scorecard */}
      <div className="border rounded-sm p-4 bg-card shrink-0">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> CAMPAIGN PERFORMANCE SCORECARD — KPI Target Q3–Q4 2026
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { kpi: "Lead MQL Bulanan", target: "200", current: strategies?.filter(s => s.status === "ACTIVE").length ?? 0, unit: "kampanye aktif", color: "text-blue-600" },
            { kpi: "CAC Target", target: "Rp 50.000", current: null, unit: "per lead", color: "text-violet-600" },
            { kpi: "Konversi Trial → Bayar", target: "25%", current: null, unit: "dari konsultasi gratis", color: "text-emerald-600" },
            { kpi: "Time-to-Close", target: "7 hari", current: null, unit: "rata-rata siklus penjualan", color: "text-orange-600" },
          ].map((s) => (
            <div key={s.kpi} className="border rounded-sm p-3 text-center">
              <p className="text-[9px] font-mono text-muted-foreground mb-1">{s.kpi}</p>
              <p className={`text-xl font-black font-mono leading-none ${s.color}`}>
                {s.current !== null ? s.current : s.target}
              </p>
              <p className="text-[9px] text-muted-foreground mt-1">{s.unit}</p>
              {s.current !== null && (
                <p className="text-[9px] font-mono text-primary mt-0.5">TARGET: {s.target}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Channel Effectiveness Matrix */}
      <div className="border rounded-sm p-4 bg-card shrink-0">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Share2 className="h-3.5 w-3.5 text-primary" /> CHANNEL EFFECTIVENESS MATRIX — Kanal Akuisisi vs Konversi vs Biaya
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[600px]">
            <thead>
              <tr className="border-b bg-muted/20 text-[9px] font-mono text-muted-foreground uppercase sticky top-0 z-10">
                <th className="text-left px-3 py-2">Channel</th>
                <th className="text-center px-3 py-2">Reach</th>
                <th className="text-center px-3 py-2">Conversion</th>
                <th className="text-center px-3 py-2">CAC Est.</th>
                <th className="text-center px-3 py-2">Best For</th>
                <th className="text-center px-3 py-2">Prioritas</th>
              </tr>
            </thead>
            <tbody>
              {[
                { channel: "WhatsApp Blast (Database)", reach: "Tinggi", conv: "8–15%", cac: "Rp 15–40rb", best: "Existing kontak SBU expiry", prio: "KRITIS", prioColor: "bg-red-100 text-red-700" },
                { channel: "LinkedIn Organic + Ads", reach: "Menengah", conv: "3–7%", cac: "Rp 50–120rb", best: "Direktur & manajer BUJK", prio: "TINGGI", prioColor: "bg-orange-100 text-orange-700" },
                { channel: "Google SEO — LPJK Keywords", reach: "Tinggi (long-term)", conv: "5–12%", cac: "Rp 20–60rb", best: "BUJK yang aktif cari info SBU", prio: "TINGGI", prioColor: "bg-orange-100 text-orange-700" },
                { channel: "Webinar & Demo Online", reach: "Niche — terundang", conv: "15–30%", cac: "Rp 30–80rb", best: "Warming prospect + edukasi", prio: "TINGGI", prioColor: "bg-orange-100 text-orange-700" },
                { channel: "Referral & Partnership GAPENSI", reach: "Terkelola", conv: "20–40%", cac: "Rp 10–30rb", best: "Trust via asosiasi", prio: "KRITIS", prioColor: "bg-red-100 text-red-700" },
                { channel: "Instagram / TikTok Konten", reach: "Luas", conv: "1–3%", cac: "Rp 80–200rb", best: "Awareness & brand building", prio: "SEDANG", prioColor: "bg-yellow-100 text-yellow-700" },
                { channel: "Cold Email Direktur", reach: "Terdata", conv: "2–5%", cac: "Rp 40–100rb", best: "BUJK yang belum kenal Maheswara", prio: "SEDANG", prioColor: "bg-yellow-100 text-yellow-700" },
              ].map((row) => (
                <tr key={row.channel} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2 font-medium">{row.channel}</td>
                  <td className="px-3 py-2 text-center text-muted-foreground">{row.reach}</td>
                  <td className="px-3 py-2 text-center font-mono font-bold text-emerald-600">{row.conv}</td>
                  <td className="px-3 py-2 text-center font-mono text-primary">{row.cac}</td>
                  <td className="px-3 py-2 text-muted-foreground text-[10px]">{row.best}</td>
                  <td className="px-3 py-2 text-center"><span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${row.prioColor}`}>{row.prio}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">CAC = Customer Acquisition Cost estimasi · konversi berbasis industri B2B jasa konstruksi Indonesia</p>
      </div>

      {/* Quick-win suggestions strip */}
      <div className="border rounded-sm bg-amber-50/30 border-amber-200 p-4 shrink-0">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-amber-700 mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5" /> QUICK-WIN TACTIC SUGGESTIONS — dari analisis VOC &amp; buying triggers
        </p>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {QUICK_WIN_TACTICS.map((t, i) => (
            <div key={i} className="shrink-0 w-56 border rounded-sm bg-card p-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-base">{t.icon}</span>
                <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded-sm font-bold",
                  t.urgency === "Kritis" ? "bg-red-100 text-red-700" :
                  t.urgency === "Tinggi" ? "bg-orange-100 text-orange-700" :
                  "bg-yellow-100 text-yellow-700"
                )}>{t.urgency}</span>
              </div>
              <p className="text-xs font-bold leading-snug">{t.label}</p>
              <p className="text-[10px] text-muted-foreground leading-snug">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Competitive Response Matrix */}
      <div className="border rounded-sm p-4 bg-red-50/20 border-red-200/50 shrink-0">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-red-700 mb-3 flex items-center gap-1.5">
          <CircleAlert className="h-3.5 w-3.5" /> COMPETITIVE RESPONSE MATRIX — bagaimana menjawab ancaman kompetitor
        </p>
        <div className="flex flex-col gap-2">
          {COMPETITIVE_RESPONSES.map((r, i) => (
            <div key={i} className="flex items-start gap-3 border rounded-sm p-3 bg-card">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono text-red-600 font-semibold">ANCAMAN: {r.threat}</p>
                <p className="text-xs mt-1 font-medium">{r.response}</p>
                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                  <span className="text-primary">→</span> Taktik: {r.tactic}
                </p>
              </div>
              <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded-sm font-bold shrink-0 mt-0.5",
                r.urgency === "Kritis" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
              )}>{r.urgency}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Marketing ROI Forecast */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> MARKETING ROI FORECAST — Estimasi Return per Channel Bulanan
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Channel", "Investasi/Bln", "Reach Est.", "Lead Conv.", "Deals/Bln", "Est. Revenue", "ROI"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { ch: "WA Blast SBU Expiry", inv: "Rp 500rb", reach: "1.000–3.000", conv: "12–18%", deals: "3–8 deal", rev: "Rp 18–48jt", roi: "36–96x", roiColor: "text-emerald-700" },
                { ch: "LinkedIn B2B Content", inv: "Rp 1.5jt", reach: "3.000–8.000", conv: "2–5%", deals: "2–6 deal", rev: "Rp 12–36jt", roi: "8–24x", roiColor: "text-emerald-700" },
                { ch: "Google Ads — Tender SKK", inv: "Rp 2jt", reach: "500–1.500 klik", conv: "8–15%", deals: "1–4 deal", rev: "Rp 6–24jt", roi: "3–12x", roiColor: "text-blue-700" },
                { ch: "Instagram Regulasi Infografis", inv: "Rp 1jt", reach: "5.000–15.000", conv: "0.5–2%", deals: "1–3 deal", rev: "Rp 6–18jt", roi: "6–18x", roiColor: "text-blue-700" },
                { ch: "Email Newsletter Mingguan", inv: "Rp 300rb", reach: "800–2.500 open", conv: "3–8%", deals: "1–4 deal", rev: "Rp 6–24jt", roi: "20–80x", roiColor: "text-emerald-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium">{r.ch}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.inv}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.reach}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-blue-700">{r.conv}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.deals}</td>
                  <td className="px-3 py-2 font-mono font-bold text-emerald-700 text-[10px] whitespace-nowrap">{r.rev}</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[10px] ${r.roiColor}`}>{r.roi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">ROI = Revenue estimasi ÷ Investasi · Asumsi avg deal size Rp 6jt · Update setiap closing 10 deal baru</p>
      </div>

      {/* Customer Journey Intelligence */}
      <div className="border rounded-sm p-4 bg-card shrink-0">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> CUSTOMER JOURNEY INTELLIGENCE — Touchpoint Kritis dari Awareness ke Loyal
        </p>
        <div className="flex gap-0 overflow-x-auto">
          {[
            { stage: "Aware", icon: "👁️", desc: "Tahu MJP ada", tactic: "SEO + LinkedIn + WA broadcast", conv: "5–10%", color: "bg-slate-500" },
            { stage: "Interest", icon: "🔍", desc: "Cari info layanan", tactic: "Blog + webinar gratis + demo platform", conv: "25–35%", color: "bg-blue-500" },
            { stage: "Evaluate", icon: "📋", desc: "Bandingkan dengan kompetitor", tactic: "Testimonial klien + komparasi harga + free audit", conv: "40–60%", color: "bg-violet-500" },
            { stage: "Decide", icon: "✅", desc: "Setuju maju dengan MJP", tactic: "Proposal cepat + garansi timeline + DP ringan", conv: "60–80%", color: "bg-orange-500" },
            { stage: "Loyal", icon: "🌟", desc: "Repeat & referral", tactic: "Loyalty program + upsell bundle + referral reward", conv: "65–75%", color: "bg-emerald-500" },
          ].map((s, i, arr) => (
            <div key={s.stage} className="flex items-center gap-0 flex-none" style={{ minWidth: 160 }}>
              <div className="border rounded-sm p-3 flex-1">
                <div className={`text-[9px] font-mono font-bold text-white px-1.5 py-0.5 rounded-sm ${s.color} inline-block mb-1`}>{s.stage}</div>
                <p className="text-base">{s.icon}</p>
                <p className="text-[9px] font-semibold leading-tight mt-0.5">{s.desc}</p>
                <p className="text-[9px] text-muted-foreground mt-1 leading-snug">{s.tactic}</p>
                <p className="text-[10px] font-mono font-bold text-primary mt-1">{s.conv} lanjut</p>
              </div>
              {i < arr.length - 1 && <span className="text-muted-foreground font-bold text-lg px-1">›</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Sales Playbook by Trigger */}
      <div className="border rounded-sm p-4 bg-card shrink-0">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> SALES PLAYBOOK — Skrip & Aksi per Trigger Penjualan
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { trigger: "SBU/SKK Hampir Expired", opener: '"Kami pantau bahwa SBU Anda berakhir [tanggal]. Kami bantu perpanjang dalam 5 hari kerja."', aksi: "WhatsApp personal + kirim checklist dokumen", est: "Rp 4–15jt", conv: "75%", tc: "text-red-700" },
            { trigger: "Tender APBN Buka", opener: '"Ada tender [nama] yang sesuai profil BUJK Anda — cek eligibilitas gratis sekarang."', aksi: "Email + WA + link landing eligibility checker", est: "Rp 5–25jt", conv: "55%", tc: "text-orange-700" },
            { trigger: "SMAP Enforcement Dekat", opener: '"SMAP wajib berlaku [tanggal]. Kami bisa selesaikan dalam 45 hari — slot terbatas."', aksi: "Broadcast + urgency campaign + booking slot", est: "Rp 10–22jt", conv: "65%", tc: "text-orange-700" },
            { trigger: "Setelah Gagal Tender", opener: '"Kami dengar [perusahaan] belum lolos kali ini. Mari kita identifikasi gap dan siapkan untuk tender berikutnya."', aksi: "Call + gap audit proposal", est: "Rp 6–18jt", conv: "70%", tc: "text-blue-700" },
            { trigger: "Regulasi Baru Terbit", opener: '"Permen [nomor] baru terbit kemarin — ini dampaknya untuk bisnis konstruksi Anda."', aksi: "Briefing email + webinar invitation", est: "Rp 3–12jt", conv: "45%", tc: "text-violet-700" },
            { trigger: "Referral dari Klien Lama", opener: '"[Nama klien] merekomendasikan kami. Kita bisa ngobrol 15 menit tentang kebutuhan BUJK Anda?"', aksi: "Call langsung dalam 24 jam + proposal cepat", est: "Rp 4–20jt", conv: "82%", tc: "text-emerald-700" },
          ].map((p) => (
            <div key={p.trigger} className="border rounded-sm p-3">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-[10px] font-semibold">{p.trigger}</p>
                <span className={`text-[9px] font-mono font-bold ${p.tc} shrink-0`}>{p.conv}</span>
              </div>
              <p className="text-[9px] italic text-muted-foreground leading-snug mb-1.5 border-l-2 border-primary/30 pl-2">"{p.opener}"</p>
              <p className="text-[9px] font-mono text-primary mb-1">→ {p.aksi}</p>
              <p className={`text-[9px] font-mono font-bold ${p.tc}`}>{p.est}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Channel ROI Benchmark */}
      <div className="border rounded-sm p-4 bg-card shrink-0">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartColumnBig className="h-3.5 w-3.5 text-primary" /> CHANNEL ROI BENCHMARK — Return on Investment per Saluran Pemasaran MJP
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {[
            { ch: "WhatsApp Blast", spend: "Rp 200rb/bln", revenue: "Rp 32jt", roi: "159×", color: "bg-emerald-500", tc: "text-emerald-700" },
            { ch: "LinkedIn Content", spend: "Rp 0 (organic)", revenue: "Rp 15jt", roi: "∞", color: "bg-blue-500", tc: "text-blue-700" },
            { ch: "Referral Program", spend: "Rp 500rb/referral", revenue: "Rp 25jt avg", roi: "50×", color: "bg-violet-500", tc: "text-violet-700" },
            { ch: "Google Ads", spend: "Rp 5jt/bln", revenue: "Rp 40jt", roi: "8×", color: "bg-orange-500", tc: "text-orange-700" },
            { ch: "Email Newsletter", spend: "Rp 300rb/bln", revenue: "Rp 8jt", roi: "26×", color: "bg-cyan-500", tc: "text-cyan-700" },
          ].map((c) => (
            <div key={c.ch} className="border rounded-sm p-2 text-center">
              <div className={`h-1 ${c.color} rounded-full mb-1.5`} />
              <p className={`text-xl font-black font-mono leading-none ${c.tc}`}>{c.roi}</p>
              <p className="text-[9px] font-mono font-bold leading-tight mt-0.5">{c.ch}</p>
              <p className="text-[8px] text-muted-foreground mt-0.5">{c.spend}</p>
              <p className="text-[8px] font-mono text-primary">{c.revenue}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">ROI = (Revenue – Spend) ÷ Spend · WhatsApp & LinkedIn organic adalah channel paling efisien per rupiah yang dikeluarkan</p>
      </div>

      {/* Content Calendar Intelligence */}
      <div className="border rounded-sm p-4 bg-card shrink-0">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-primary" /> CONTENT CALENDAR INTELLIGENCE — Jadwal Konten per Platform & Trigger
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              platform: "LinkedIn", freq: "3×/minggu", format: "Insight + data visual",
              topics: ["SKK/BIM demand forecast", "Regulatory flash brief", "Win case study klien"],
              cta: "Generate leads B2B", ic: "text-blue-700", bc: "bg-blue-100",
            },
            {
              platform: "WhatsApp Broadcast", freq: "Harian", format: "Alert 1 topik singkat",
              topics: ["SBU expiry alert personal", "Tender baru di provinsi", "Regulasi update 24 jam"],
              cta: "Direct conversion", ic: "text-emerald-700", bc: "bg-emerald-100",
            },
            {
              platform: "Email Newsletter", freq: "2×/bulan", format: "Digest mendalam",
              topics: ["Rekap sinyal pasar bulanan", "Top tender & peluang Q-ini", "Product/layanan baru MJP"],
              cta: "Nurture & retain klien", ic: "text-orange-700", bc: "bg-orange-100",
            },
          ].map((p) => (
            <div key={p.platform} className="border rounded-sm p-3">
              <div className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm inline-block mb-2 ${p.ic} ${p.bc}`}>{p.platform} · {p.freq}</div>
              <p className="text-[9px] text-muted-foreground italic mb-1.5">{p.format}</p>
              {p.topics.map((t, i) => (
                <p key={i} className="text-[9px] text-muted-foreground flex items-start gap-1 mb-0.5">
                  <span className="shrink-0 mt-0.5">·</span>{t}
                </p>
              ))}
              <p className={`text-[9px] font-mono font-bold mt-1.5 ${p.ic}`}>→ {p.cta}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sales Cycle Optimization Intelligence */}
      <div className="border rounded-sm p-4 bg-card shrink-0">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" /> SALES CYCLE OPTIMIZER — Waktu & Hambatan per Fase Pipeline
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Fase Pipeline", "Avg Durasi", "Drop Rate", "Hambatan Utama", "Tindakan Percepat"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { fase: "Lead → Qualified", dur: "1–2 hari", drop: "35%", hambatan: "No-show / tidak respons WA", action: "Auto-reminder H+1, H+3" },
                { fase: "Qualified → Proposal", dur: "3–5 hari", drop: "25%", hambatan: "Pengumpulan dokumen klien lambat", action: "Checklist dokumen + template WA" },
                { fase: "Proposal → Negosiasi", dur: "2–7 hari", drop: "30%", hambatan: "Keberatan harga + perbandingan kompetitor", action: "Pricing deck + competitor intel brief" },
                { fase: "Negosiasi → Closing", dur: "1–3 hari", drop: "15%", hambatan: "Menunggu keputusan internal klien", action: "Deadline soft + bonus early-bird" },
                { fase: "Closing → Pelunasan", dur: "1–5 hari", drop: "5%", hambatan: "Pencairan budget internal klien", action: "DP 50% + cicilan 2× untuk B2/M" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium text-[10px]">{r.fase}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-primary">{r.dur}</td>
                  <td className="px-3 py-2 font-mono font-bold text-[10px] text-red-600">{r.drop}</td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground">{r.hambatan}</td>
                  <td className="px-3 py-2 text-[10px] text-emerald-700">{r.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lead Source Scorecard */}
      <div className="border rounded-sm p-4 bg-card shrink-0">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> LEAD SOURCE SCORECARD — Efektivitas Setiap Saluran dalam Menghasilkan Leads Berkualitas
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { src: "WhatsApp Broadcast", leads: 42, qualified: 31, closeRate: "28%", cac: "Rp 0", score: 98, c: "bg-emerald-500", tc: "text-emerald-700" },
            { src: "LinkedIn Organic", leads: 28, qualified: 18, closeRate: "22%", cac: "Rp 0", score: 90, c: "bg-emerald-500", tc: "text-emerald-700" },
            { src: "Referral Klien", leads: 22, qualified: 20, closeRate: "45%", cac: "Rp 0", score: 95, c: "bg-emerald-500", tc: "text-emerald-700" },
            { src: "Email Newsletter", leads: 15, qualified: 8, closeRate: "18%", cac: "Rp 2rb", score: 72, c: "bg-blue-400", tc: "text-blue-700" },
            { src: "Google Search", leads: 12, qualified: 5, closeRate: "12%", cac: "Rp 45rb", score: 48, c: "bg-yellow-500", tc: "text-yellow-700" },
            { src: "Instagram Ads", leads: 8, qualified: 2, closeRate: "8%", cac: "Rp 180rb", score: 22, c: "bg-red-400", tc: "text-red-700" },
          ].map((s) => (
            <div key={s.src} className="border rounded-sm p-2 text-center">
              <p className="text-[9px] font-mono font-bold leading-tight mb-1">{s.src}</p>
              <p className={`text-xl font-black font-mono leading-none ${s.tc}`}>{s.score}</p>
              <div className="h-1 bg-muted rounded-full overflow-hidden mt-1 mb-0.5">
                <div className={`h-full ${s.c} rounded-full`} style={{ width: `${s.score}%` }} />
              </div>
              <p className="text-[8px] font-mono text-muted-foreground">{s.leads} leads → {s.closeRate}</p>
              <p className="text-[8px] font-mono text-muted-foreground">CAC: {s.cac}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Score = composite dari volume + qualification rate + close rate + CAC · Prioritaskan channel score ≥80</p>
      </div>

      {/* ICP (Ideal Customer Profile) Scorecard */}
      <div className="border rounded-sm p-4 bg-card shrink-0">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> IDEAL CUSTOMER PROFILE — Karakteristik Klien dengan LTV & Close Rate Tertinggi
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              profile: "BUJK Menengah (M1–M2) — Jawa", ltv: "Rp 45jt", closeRate: "38%", payback: "14 hari",
              traits: ["Omzet Rp 2–20M/tahun", "Tim 10–50 orang", "Aktif ikut tender APBN", "Belum punya compliance officer"],
              verdict: "Top ICP", vc: "text-emerald-700 bg-emerald-50 border-emerald-200",
            },
            {
              profile: "Konsultan Independen Senior", ltv: "Rp 32jt", closeRate: "51%", payback: "7 hari",
              traits: ["Pengalaman 10+ tahun", "Network proyek besar", "Butuh SKK upgrade rutin", "Referrer aktif"],
              verdict: "High Referral", vc: "text-violet-700 bg-violet-50 border-violet-200",
            },
            {
              profile: "BUJK Besar (B1–B2) — Multi-wilayah", ltv: "Rp 120jt", closeRate: "22%", payback: "30 hari",
              traits: ["Procurement formal", "Butuh SLA & kontrak", "High-touch relationship", "Slow decision cycle"],
              verdict: "High Value, Slow", vc: "text-blue-700 bg-blue-50 border-blue-200",
            },
            {
              profile: "BUJK Kecil (K) — Luar Jawa", ltv: "Rp 8jt", closeRate: "62%", payback: "3 hari",
              traits: ["Budget terbatas", "Quick decision", "Self-service preference", "Price sensitive"],
              verdict: "High Volume", vc: "text-orange-700 bg-orange-50 border-orange-200",
            },
          ].map((p) => (
            <div key={p.profile} className={`border rounded-sm p-3 ${p.vc}`}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-[9px] font-semibold leading-snug">{p.profile}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ${p.vc.split(" ")[0]}`}>{p.verdict}</span>
              </div>
              <div className="flex gap-3 mb-1.5">
                <div><p className="text-[8px] text-muted-foreground">LTV</p><p className="text-[9px] font-mono font-bold">{p.ltv}</p></div>
                <div><p className="text-[8px] text-muted-foreground">Close Rate</p><p className="text-[9px] font-mono font-bold">{p.closeRate}</p></div>
                <div><p className="text-[8px] text-muted-foreground">Payback</p><p className="text-[9px] font-mono font-bold">{p.payback}</p></div>
              </div>
              {p.traits.map((t, i) => <p key={i} className="text-[9px] text-muted-foreground">· {t}</p>)}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-[600px] flex gap-6 overflow-x-auto pb-4">
        {isStrategiesError ? (
          <div className="flex flex-col items-center justify-center w-full py-24 gap-3 text-destructive">
            <AlertCircle className="h-8 w-8 opacity-60" />
            <p className="font-mono text-sm">Gagal memuat data kampanye</p>
            <p className="text-xs text-muted-foreground font-mono">Coba refresh halaman</p>
          </div>
        ) : isLoading ? (
          <div className="flex gap-6 overflow-x-auto pb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-none w-[320px] space-y-2 animate-pulse">
                <div className="h-8 bg-muted rounded-lg" />
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="border rounded-lg p-3 bg-muted/20 space-y-1.5">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-2 bg-muted rounded w-1/2" />
                    <div className="flex gap-1 mt-1">
                      <div className="h-4 w-14 bg-muted rounded-full" />
                      <div className="h-4 w-10 bg-muted rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (strategies?.length === 0 && filterType === "ALL" && filterStatus === "ALL" && !showNotesOnly) ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Target className="h-10 w-10 opacity-20 mb-3" />
            <p className="text-sm font-medium mb-1">Belum ada kampanye strategi</p>
            <p className="text-xs mb-4">Buat kampanye pertama tim untuk mulai melacak pipeline pemasaran</p>
            <button onClick={() => setIsCreateOpen(true)} className="text-xs font-mono text-primary border border-primary/40 hover:bg-primary/10 px-4 py-2 rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Tambah Kampanye Pertama</button>
          </div>
        ) : (
          PIPELINE_STAGES.map(stage => {
            const stageItems = strategies?.filter(s => s.status === stage && (filterType === "ALL" || s.strategyType === filterType) && (filterStatus === "ALL" || s.status === filterStatus) && (!showNotesOnly || !!(stratNotes[s.id] ?? "").trim())) || [];
            const total = strategies?.length ?? 0;
            const pct = total > 0 ? Math.round((stageItems.length / total) * 100) : 0;
            return (
              <div key={stage} className="flex-none w-[320px] flex flex-col bg-muted/20 border rounded-lg overflow-hidden h-full">
                <div className={cn("px-4 py-3 border-b border-border flex items-center justify-between shadow-sm", getStageColor(stage))}>
                  <h3 className="font-bold text-sm uppercase tracking-wider" title={({ PLANNED:"Direncanakan — kampanye belum dimulai", ACTIVE:"Aktif — kampanye sedang berjalan", PAUSED:"Ditunda — kampanye dihentikan sementara", COMPLETED:"Selesai — kampanye telah berakhir" } as Record<string,string>)[stage] ?? stage}>{{ PLANNED:"Direncanakan", ACTIVE:"Aktif", PAUSED:"Ditunda", COMPLETED:"Selesai" }[stage] ?? stage}</h3>
                  <div className="flex items-center gap-2">
                    {total > 0 && <span className="text-[9px] font-mono text-muted-foreground">{pct}%</span>}
                    <Badge variant="secondary" className="bg-background/50 text-foreground shadow-none">{stageItems.length}</Badge>
                  </div>
                </div>
                {total > 0 && (
                  <div className="h-0.5 bg-muted/40">
                    <div className="h-full bg-primary/60 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}
                
                <div className="p-3 flex-1 overflow-y-auto space-y-3">
                  {stageItems.length === 0 ? (
                    (filterType !== "ALL" || filterStatus !== "ALL" || showNotesOnly) ? (
                      <div className="flex flex-col items-center gap-2 py-8">
                        <Search className="h-5 w-5 text-muted-foreground/40" />
                        <p className="text-[10px] font-mono text-muted-foreground text-center">Tidak ada kampanye yang cocok dengan filter</p>
                        <button
                          onClick={() => { setFilterType("ALL"); setFilterStatus("ALL"); setShowNotesOnly(false); }}
                          className="text-[10px] font-mono text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none"
                        >✕ Reset semua filter</button>
                      </div>
                    ) : (
                    <button
                      onClick={() => setIsCreateOpen(true)}
                      className="w-full h-24 flex items-center justify-center border-2 border-dashed border-border rounded-md text-xs text-muted-foreground font-mono hover:border-primary/50 hover:text-primary transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none"
                      title="Klik untuk tambah kampanye baru"
                    >
                      + TAMBAH
                    </button>
                    )
                  ) : (
                    stageItems.map(item => (
                      <Card key={item.id} className="group border-border/60 shadow-sm hover:shadow-md hover:border-primary/40 hover:bg-muted/30 transition-all">
                        <CardHeader className="p-3 pb-2 border-b border-border/40">
                          <div className="flex justify-between items-start mb-1">
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-muted/50 rounded-sm font-mono flex items-center gap-1">
                              {getTypeIcon(item.strategyType)}
                              {STRATEGY_TYPE_LABELS[item.strategyType] ?? item.strategyType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </Badge>
                            <span className="text-[9px] text-muted-foreground font-mono">#{item.id}</span>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <CardTitle className="text-base font-bold leading-tight flex-1" title={item.strategyTitle}>{item.strategyTitle}</CardTitle>
                            {item.createdAt && (Date.now() - new Date(item.createdAt).getTime()) < 7 * 86400000 && (
                              <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded-sm bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0 mt-0.5">Baru</span>
                            )}
                            {item.createdAt && <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[8px] font-mono text-muted-foreground shrink-0 mt-0.5 whitespace-nowrap">{new Date(item.createdAt).toLocaleDateString("id-ID", { day:"numeric", month:"short" })}</span>}
                          </div>
                        </CardHeader>
                        <CardContent className="p-3 space-y-3">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Users className="h-3 w-3 shrink-0" />
                            <span className="truncate" title={item.targetAudience}>{item.targetAudience}</span>
                          </div>
                          
                          {item.fastMovingTactic && (
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded p-2 text-xs">
                              <div className="flex items-center gap-1 font-bold text-amber-700 dark:text-amber-500 mb-1">
                                <Zap className="h-3 w-3" /> FAST TACTIC
                              </div>
                              <p className="text-muted-foreground line-clamp-2 leading-snug" title={item.fastMovingTactic ?? undefined}>{item.fastMovingTactic}</p>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.channels.split(',').map((c, i) => (
                              <span key={i} className="text-[9px] uppercase tracking-wider font-mono bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-sm" title={c.trim()}>
                                {c.trim()}
                              </span>
                            ))}
                          </div>
                        </CardContent>
                        <CardContent className="px-3 py-2 border-t bg-muted/10">
                          <div className="relative">
                            <textarea
                              value={stratNotes[item.id] ?? ""}
                              onChange={(e) => updateStratNote(item.id, e.target.value)}
                              onKeyDown={e => { if (e.key === "Escape") e.currentTarget.blur(); }}
                              onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                              placeholder="Catatan strategi…"
                              rows={1}
                              maxLength={500}
                              className="w-full border rounded-sm px-2 py-1 pb-4 text-[10px] resize-none bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                            />
                            <span className="absolute left-1 bottom-0.5 text-[8px] font-mono text-muted-foreground/50">{(stratNotes[item.id] ?? "").length}/500</span>
                            {savedStratNoteId === item.id && <span className="absolute right-1 bottom-0.5 text-[8px] font-mono text-emerald-600">✓ Tersimpan</span>}
                          </div>
                        </CardContent>
                        <CardFooter className="p-2 px-3 bg-muted/30 border-t text-[10px] text-muted-foreground font-mono flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            {item.timeline ? <><Calendar className="h-3 w-3 shrink-0" /> <span className="truncate" title={item.timeline}>{item.timeline}</span></> : <span className="italic text-muted-foreground/60">Belum ada timeline</span>}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(
                                `📣 *Kampanye: ${item.strategyTitle}*\n\n` +
                                `Tipe: ${item.strategyType.replace(/_/g, " ")}\n` +
                                `Target: ${item.targetAudience}\n` +
                                `Channel: ${item.channels}\n` +
                                (item.fastMovingTactic ? `\n⚡ Taktik: ${item.fastMovingTactic}\n` : "") +
                                (item.kpi ? `\n📊 KPI: ${item.kpi}\n` : "") +
                                `\nStatus: ${{ PLANNED:"Direncanakan", ACTIVE:"Aktif", PAUSED:"Ditunda", COMPLETED:"Selesai" }[item.status ?? ""] ?? item.status} ${item.timeline ? `· ${item.timeline}` : ""}\n\n` +
                                `— Tim Marketing PT Maheswara Jaya Persada`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-0.5 text-[9px] text-emerald-600 hover:text-emerald-700 font-mono"
                              aria-label="Bagikan via WhatsApp"
                              title="Bagikan via WhatsApp"
                            >
                              <MessageCircle className="h-3 w-3" />
                            </a>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[9px] font-mono px-1.5 py-0 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                              title="Duplikat kampanye ini"
                              disabled={createMutation.isPending}
                              onClick={() => createMutation.mutate({
                                data: {
                                  strategyTitle: `${item.strategyTitle} (Salinan)`,
                                  strategyType: item.strategyType,
                                  targetAudience: item.targetAudience ?? "",
                                  channels: item.channels ?? "",
                                  keyMessages: item.keyMessages ?? "",
                                  callToAction: item.callToAction ?? "",
                                  timeline: item.timeline ?? "",
                                  kpi: item.kpi ?? "",
                                  fastMovingTactic: item.fastMovingTactic ?? "",
                                  status: "PLANNED"
                                }
                              })}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-[9px] font-mono px-2 py-0"
                              disabled={updateMutation.isPending}
                              onClick={() => updateMutation.mutate({ id: item.id, data: { status: NEXT_STAGE[item.status] } })}
                            >
                              {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : (NEXT_STAGE_LABEL[item.status] ?? "→")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn("h-6 w-6 p-0 hover:bg-orange-50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1", pendingArchiveId === item.id ? "text-orange-600" : "text-muted-foreground hover:text-orange-600")}
                              title={pendingArchiveId === item.id ? "Klik lagi untuk konfirmasi arsip" : "Arsipkan kampanye ini"}
                              aria-label={pendingArchiveId === item.id ? "Konfirmasi arsipkan kampanye" : "Arsipkan kampanye ini"}
                              disabled={updateMutation.isPending || item.status === "COMPLETED"}
                              onBlur={() => { if (pendingArchiveId === item.id) setPendingArchiveId(null); }}
                              onClick={() => {
                                if (pendingArchiveId === item.id) { updateMutation.mutate({ id: item.id, data: { status: "COMPLETED" } }); setPendingArchiveId(null); }
                                else setPendingArchiveId(item.id);
                              }}
                            >
                              {updateMutation.isPending && pendingArchiveId === null
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Trash2 className="h-3 w-3" />}
                            </Button>
                          </div>
                        </CardFooter>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-6 right-6 z-50 h-9 w-9 rounded-full bg-primary animate-in fade-in slide-in-from-bottom-2 text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" aria-label="Kembali ke atas" title="Kembali ke atas"><ChevronUp className="h-4 w-4" /></button>
      )}
    </div>
  );
}
