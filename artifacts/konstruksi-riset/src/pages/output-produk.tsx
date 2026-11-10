import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { 
  useListOutputProducts,
  useCreateOutputProduct,
  useUpdateOutputProduct,
  useDeleteOutputProduct,
  getListOutputProductsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Activity, TriangleAlert, Archive, ArrowRight, Award, ChartBar, BookOpen, ChartPie, Check, CircleCheck, ChevronRight, ChevronUp, Code, Compass, Copy, Database, DollarSign, FileText, Gauge, GitBranch, Globe, Image as Image, LayoutGrid, ListFilter, Loader2, LoaderCircle, Megaphone, MessageCircle, MessageSquare, Mic, Package, Play, Plus, RefreshCw, Rocket, RotateCcw, ScanSearch, Shield, ShieldCheck, Smartphone, Star, Tags, Target, Trash2, TrendingUp, Users, Zap } from "lucide-react";
import { KnowledgeSourcesBar } from "@/components/knowledge-sources-bar";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const PRODUCT_TYPES = ["INFOGRAPHIC", "VIDEO", "MODUL", "PODCAST", "EBOOK", "LAPORAN", "TEMPLATE"];

const TYPE_LABELS: Record<string, string> = {
  INFOGRAPHIC: "Infografis",
  VIDEO: "Video",
  MODUL: "Modul",
  PODCAST: "Podcast",
  EBOOK: "E-Book",
  LAPORAN: "Laporan Riset",
  TEMPLATE: "Template",
};

export default function OutputProduk() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => { document.title = "Output Produk — Intel Konstruksi"; return () => { document.title = "Intel Konstruksi"; }; }, []);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [createType, setCreateType] = useState(PRODUCT_TYPES[0] ?? "ARTIKEL");
  const [createSegment, setCreateSegment] = useState("SEMUA");
  const [createTouched, setCreateTouched] = useState<Record<string, boolean>>({});
  const [createValues, setCreateValues] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!isCreateOpen) {
      setCreateType(PRODUCT_TYPES[0] ?? "ARTIKEL");
      setCreateSegment("SEMUA");
      setCreateTouched({});
      setCreateValues({});
    }
  }, [isCreateOpen]);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [productSearch, setProductSearch] = useState("");
  const [sortDraftFirst, setSortDraftFirst] = useState(false);
  const [sortNewest, setSortNewest] = useState(false);
  const [showWithNotesOnly, setShowWithNotesOnly] = useState(false);
  const STATUS_ORDER: Record<string, number> = { REVIEW: 0, READY: 1, IN_PROGRESS: 2, DRAFT: 3, PUBLISHED: 4 };
  const [productNotes, setProductNotes] = useState<Record<number, string>>(() => {
    try { return JSON.parse(localStorage.getItem("mkp-product-notes") ?? "{}") as Record<number, string>; } catch { return {}; }
  });
  const [savedNoteId, setSavedNoteId] = useState<number | null>(null);
  const savedNoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateProductNote = (id: number, val: string) => {
    setProductNotes(prev => {
      const next = { ...prev, [id]: val };
      try { localStorage.setItem("mkp-product-notes", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    setSavedNoteId(id);
    toast.success("Catatan disimpan", { duration: 1200 });
    if (savedNoteTimer.current) clearTimeout(savedNoteTimer.current);
    savedNoteTimer.current = setTimeout(() => setSavedNoteId(null), 2000);
  };

  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    try { return (localStorage.getItem("mkp-output-viewmode") as "grid" | "list") || "grid"; } catch { return "grid"; }
  });
  const setViewModeAndPersist = (v: "grid" | "list") => {
    setViewMode(v);
    try { localStorage.setItem("mkp-output-viewmode", v); } catch { /* ignore */ }
  };

  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); searchRef.current?.focus(); return; }
      if (e.key === "n" && !e.ctrlKey && !e.metaKey && !e.altKey) setIsCreateOpen(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  
  const { data: products, isLoading, isError: isProductsError } = useListOutputProducts(
    activeTab !== "ALL" ? { type: activeTab } : undefined,
    { query: { queryKey: getListOutputProductsQueryKey(activeTab !== "ALL" ? { type: activeTab } : undefined) } }
  );

  const createMutation = useCreateOutputProduct({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListOutputProductsQueryKey() });
        setIsCreateOpen(false);
        const isDuplicate = data.title?.includes("(Salinan)");
        toast.success(isDuplicate ? "Produk diduplikasi" : "Produk baru ditambahkan", { description: data.title ?? undefined, duration: 2500 });
      },
      onError: (err: unknown) => toast.error("Gagal menyimpan produk", { description: err instanceof Error ? err.message : "Coba lagi" }),
    }
  });

  const updateMutation = useUpdateOutputProduct({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListOutputProductsQueryKey() });
        toast.success("Produk diperbarui", { description: data.title ? data.title.slice(0, 60) : undefined, duration: 2000 });
      },
      onError: (err: unknown) => toast.error("Gagal memperbarui produk", { description: err instanceof Error ? err.message : "Coba lagi" }),
    }
  });

  const deleteMutation = useDeleteOutputProduct({
    mutation: {
      onSuccess: () => {
        const name = products?.find(p => p.id === pendingDeleteId)?.title;
        queryClient.invalidateQueries({ queryKey: getListOutputProductsQueryKey() });
        toast.success("Produk dihapus", { description: name ? name.slice(0, 60) : undefined, duration: 2000 });
      },
      onError: (err: unknown) => toast.error("Gagal menghapus produk", { description: err instanceof Error ? err.message : "Coba lagi" }),
    },
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = (fd.get("title") as string ?? "").trim();
    if (!title) {
      setCreateTouched({ title: true });
      setCreateValues((v) => ({ ...v, title }));
      return;
    }
    createMutation.mutate({
      data: {
        type: fd.get("type") as string,
        title,
        description: fd.get("description") as string,
        targetSegment: fd.get("targetSegment") as string,
        format: fd.get("format") as string,
        platform: fd.get("platform") as string,
        keyMessages: fd.get("keyMessages") as string,
        status: "DRAFT"
      }
    });
  };

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'INFOGRAPHIC': return <Image className="h-5 w-5" />;
      case 'VIDEO': return <Play className="h-5 w-5" />;
      case 'MODUL': return <BookOpen className="h-5 w-5" />;
      case 'PODCAST': return <Mic className="h-5 w-5" />;
      case 'EBOOK': return <FileText className="h-5 w-5" />;
      case 'LAPORAN': return <ChartBar className="h-5 w-5" />;
      case 'TEMPLATE': return <LayoutGrid className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  // Production cost estimation per type
  const PRODUCTION_COST: Record<string, { min: number; max: number; unit: string }> = {
    INFOGRAPHIC: { min: 300_000, max: 800_000, unit: "per lembar" },
    VIDEO: { min: 1_500_000, max: 5_000_000, unit: "per menit" },
    MODUL: { min: 2_000_000, max: 6_000_000, unit: "per modul" },
    PODCAST: { min: 500_000, max: 1_500_000, unit: "per episode" },
    EBOOK: { min: 3_000_000, max: 8_000_000, unit: "per buku" },
    LAPORAN: { min: 2_500_000, max: 7_500_000, unit: "per laporan" },
    TEMPLATE: { min: 500_000, max: 2_000_000, unit: "per template" },
  };

  const formatCostRange = (type: string) => {
    const c = PRODUCTION_COST[type];
    if (!c) return null;
    const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}jt` : `${(n / 1_000).toFixed(0)}rb`;
    return `Rp ${fmt(c.min)}–${fmt(c.max)} ${c.unit}`;
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'DRAFT': return 'bg-slate-200 text-slate-800';
      case 'IN_PROGRESS': return 'bg-amber-500 text-black';
      case 'REVIEW': return 'bg-orange-500 text-white';
      case 'READY': return 'bg-primary text-primary-foreground';
      case 'PUBLISHED': return 'bg-green-600 text-white';
      case 'ACTIVE': return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'ARCHIVED': return 'bg-slate-200 text-slate-600';
      default: return 'bg-muted text-muted-foreground';
    }
  };
  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'DRAFT': return 'Draft';
      case 'IN_PROGRESS': return 'Dalam Pengerjaan';
      case 'REVIEW': return 'Review';
      case 'READY': return 'Siap';
      case 'PUBLISHED': return 'Dipublikasi';
      default: return status.replace(/_/g, ' ');
    }
  };

  const allProducts = products || [];
  const filteredProducts = (() => {
    let base = statusFilter === "ALL" ? allProducts : allProducts.filter(p => p.status === statusFilter);
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      base = base.filter(p =>
        (p.title ?? "").toLowerCase().includes(q) ||
        (p.type ?? "").toLowerCase().includes(q) ||
        (p.targetSegment ?? "").toLowerCase().includes(q) ||
        (productNotes[p.id] ?? "").toLowerCase().includes(q)
      );
    }
    return base;
  })();
  const visibleProducts = (() => {
    let base = sortNewest
      ? [...filteredProducts].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      : sortDraftFirst
        ? [...filteredProducts].sort((a, b) => (STATUS_ORDER[a.status ?? ""] ?? 99) - (STATUS_ORDER[b.status ?? ""] ?? 99))
        : filteredProducts;
    if (showWithNotesOnly) base = base.filter(p => (productNotes[p.id] ?? "").trim().length > 0);
    return base;
  })();
  const publishedCount = allProducts.filter(p => p.status === 'PUBLISHED').length;
  const inProgressCount = allProducts.filter(p => p.status === 'IN_PROGRESS').length;
  const draftCount = allProducts.filter(p => p.status === 'DRAFT').length;
  const reviewCount = allProducts.filter(p => p.status === 'REVIEW' || p.status === 'READY').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">OUTPUT PRODUK</h1>
          <p className="text-muted-foreground font-mono mt-1 flex items-center gap-2">
            TIM PERUMUSAN &amp; PRODUKSI KONTEN
            {visibleProducts.length < allProducts.length && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {visibleProducts.length} dari {allProducts.length}
              </span>
            )}
            {reviewCount > 0 && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                {reviewCount} siap publish
              </span>
            )}
            {publishedCount > 0 && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {publishedCount} dipublish
              </span>
            )}
            {Object.values(productNotes).filter(v => v?.trim()).length > 0 && (
              <button
                onClick={() => setShowWithNotesOnly(v => !v)}
                aria-pressed={showWithNotesOnly}
                className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border transition-colors", showWithNotesOnly ? "bg-blue-500 text-white border-blue-500" : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200")}
                title="Filter hanya produk dengan catatan"
              >
                {Object.values(productNotes).filter(v => v?.trim()).length} catatan
              </button>
            )}
          </p>
        </div>
      </div>

      {/* Knowledge Sources Bar */}
      <KnowledgeSourcesBar pageKey="output-produk" />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border rounded-sm p-0.5 bg-muted/30">
            <button onClick={() => setViewModeAndPersist("grid")} aria-pressed={viewMode === "grid"} className={cn("px-3 py-1 rounded-sm text-[10px] font-mono font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              GRID
            </button>
            <button onClick={() => setViewModeAndPersist("list")} aria-pressed={viewMode === "list"} className={cn("px-3 py-1 rounded-sm text-[10px] font-mono font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              LIST
            </button>
          </div>
          <div className="relative">
            <ScanSearch className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Cari produk… ( / )"
              title="Tekan / untuk fokus ke pencarian"
              className="pl-8 h-8 text-xs font-mono bg-muted/50 w-48"
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Escape") { setProductSearch(""); e.currentTarget.blur(); } }}
            />
            {!productSearch && <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">/</kbd>}
          </div>
          {productSearch && (
            <button onClick={() => setProductSearch("")} className="text-[10px] font-mono text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-sm px-2 py-1 transition-colors focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 outline-none" title="Hapus pencarian" aria-label="Hapus pencarian">✕</button>
          )}
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Produk
              <kbd className="ml-2 text-[9px] font-mono opacity-60 border border-current/30 rounded px-1">N</kbd>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Buat Output Produk Baru</DialogTitle>
              <DialogDescription>Rencanakan materi edukasi atau marketing.</DialogDescription>
            </DialogHeader>
            <form key={String(isCreateOpen)} onSubmit={handleCreate} className="space-y-4 py-4" onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") e.currentTarget.requestSubmit(); }}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="title">Judul Produk <span className="text-destructive">*</span></Label>
                  <Input
                    id="title" name="title" placeholder="Cth: Panduan Mengurus SBU 2026" autoFocus maxLength={255}
                    value={createValues.title ?? ""}
                    onChange={(e) => setCreateValues((v) => ({ ...v, title: e.target.value }))}
                    onBlur={() => setCreateTouched((t) => ({ ...t, title: true }))}
                    className={createTouched.title && !createValues.title?.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  <div className="flex justify-between items-start">
                    {createTouched.title && !createValues.title?.trim() ? (
                      <p className="text-xs text-destructive">Judul produk wajib diisi</p>
                    ) : <span />}
                    <p className="text-[10px] font-mono text-muted-foreground">{(createValues.title ?? "").length}/255</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tipe Produk</Label>
                  <input type="hidden" name="type" value={createType} />
                  <Select value={createType} onValueChange={setCreateType} required>
                    <SelectTrigger className="h-10 w-full" aria-label="Pilih tipe produk"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRODUCT_TYPES.map(t => <SelectItem key={t} value={t}>{TYPE_LABELS[t] ?? t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Segmen</Label>
                  <input type="hidden" name="targetSegment" value={createSegment} />
                  <Select value={createSegment} onValueChange={setCreateSegment} required>
                    <SelectTrigger className="h-10 w-full" aria-label="Pilih target segmen"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SEMUA">Semua</SelectItem>
                      <SelectItem value="KONTRAKTOR">Kontraktor</SelectItem>
                      <SelectItem value="KONSULTAN">Konsultan</SelectItem>
                      <SelectItem value="TENAGA_KERJA">Tenaga Kerja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="format">Format (Resolusi/Durasi)</Label>
                  <Input id="format" name="format" placeholder="Cth: 1080x1080px, 3 Menit" maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="platform">Platform Distribusi</Label>
                  <Input id="platform" name="platform" placeholder="Cth: Instagram, Website, PDF" maxLength={100} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="description">Deskripsi / Outline Singkat</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="…"
                    className="h-20"
                    maxLength={500}
                    value={createValues["description"] ?? ""}
                    onChange={(e) => setCreateValues(prev => ({ ...prev, description: e.target.value }))}
                  />
                  <p className="text-[10px] font-mono text-muted-foreground text-right -mt-1">{(createValues["description"] ?? "").length} / 500</p>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="keyMessages">Key Messages (Pesan Utama)</Label>
                  <div className="relative">
                    <Textarea id="keyMessages" name="keyMessages" placeholder="Hal utama yang harus ditangkap audiens" className="resize-none pb-4" maxLength={300} onChange={(e) => { const el = e.currentTarget.nextElementSibling as HTMLSpanElement | null; if (el) el.textContent = `${e.currentTarget.value.length}/300`; }} />
                    <span className="absolute right-1 bottom-0.5 text-[8px] font-mono text-muted-foreground/50 pointer-events-none">0/300</span>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground hidden sm:block">Ctrl+Enter untuk simpan</p>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Menyimpan…</> : "Simpan Draft"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Content Production Dashboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> CONTENT PRODUCTION DASHBOARD — Status Pipeline Produksi
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div className="border rounded-sm p-3 text-center bg-muted/20">
            <p className="text-2xl font-black font-mono leading-none">{allProducts.length}</p>
            <p className="text-[9px] font-mono text-muted-foreground mt-0.5">Total Produk</p>
          </div>
          <div className="border rounded-sm p-3 text-center bg-green-50/30 border-green-200">
            <p className="text-2xl font-black font-mono leading-none text-green-600">{publishedCount}</p>
            <p className="text-[9px] font-mono text-muted-foreground mt-0.5">Diterbitkan</p>
          </div>
          <div className="border rounded-sm p-3 text-center bg-amber-50/30 border-amber-200">
            <p className="text-2xl font-black font-mono leading-none text-amber-600">{inProgressCount}</p>
            <p className="text-[9px] font-mono text-muted-foreground mt-0.5">Dalam Pengerjaan</p>
          </div>
          <div className="border rounded-sm p-3 text-center bg-blue-50/30 border-blue-200">
            <p className="text-2xl font-black font-mono leading-none text-blue-600">{reviewCount + draftCount}</p>
            <p className="text-[9px] font-mono text-muted-foreground mt-0.5">Draft / Review</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10px]">
          {[
            { kpi: "Target Konten/Bulan", val: "12 konten", desc: "3 per minggu · 4 minggu", color: "text-primary" },
            { kpi: "Estimasi Biaya Produksi", val: "Rp 8–20jt/bln", desc: "Tergantung mix tipe konten", color: "text-violet-600" },
            { kpi: "Target Reach Organik", val: "50K impresi", desc: "LinkedIn + IG + WA Blast", color: "text-emerald-600" },
          ].map((k) => (
            <div key={k.kpi} className="border rounded-sm p-2.5 bg-muted/20">
              <p className="font-mono text-muted-foreground uppercase mb-0.5">{k.kpi}</p>
              <p className={`font-black font-mono text-sm ${k.color}`}>{k.val}</p>
              <p className="text-muted-foreground mt-0.5">{k.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Content Calendar Strip */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5 text-primary" /> CONTENT CALENDAR — Rencana Distribusi Konten 4 Minggu ke Depan
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              week: "Minggu 1", theme: "SBU & SMAP AWARENESS", color: "border-red-200 bg-red-50/30",
              items: [
                { type: "INFOGRAPHIC", title: "Checklist SBU 2026 — 5 Hal yang Sering Salah", platform: "IG + WA" },
                { type: "VIDEO", title: "Reels: SMAP Bukan Pilihan, Ini Wajib!", platform: "IG Reels" },
              ]
            },
            {
              week: "Minggu 2", theme: "TENDER & TKDN", color: "border-blue-200 bg-blue-50/20",
              items: [
                { type: "EBOOK", title: "Panduan Hitung TKDN untuk Tender APBN 2026", platform: "LinkedIn + Website" },
                { type: "INFOGRAPHIC", title: "Flowchart Ikut Tender LPSE — Dari Nol", platform: "WA Broadcast" },
              ]
            },
            {
              week: "Minggu 3", theme: "SKK & SERTIFIKASI", color: "border-yellow-200 bg-yellow-50/20",
              items: [
                { type: "VIDEO", title: "Cara Cepat Urus SKK Jenjang 7 — Step by Step", platform: "YouTube + IG" },
                { type: "TEMPLATE", title: "Template RAB SKK untuk Proposal Training", platform: "Website Download" },
              ]
            },
            {
              week: "Minggu 4", theme: "THOUGHT LEADERSHIP", color: "border-emerald-200 bg-emerald-50/20",
              items: [
                { type: "LAPORAN", title: "Laporan Q3 2026: Industri Konstruksi Indonesia", platform: "B2B / Email" },
                { type: "PODCAST", title: "Ep.12: Masa Depan BIM dan Digitalisasi Konstruksi", platform: "Spotify + YouTube" },
              ]
            },
          ].map((wk) => (
            <div key={wk.week} className={`border rounded-sm p-3 ${wk.color}`}>
              <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-muted-foreground mb-1">{wk.week}</p>
              <p className="text-[10px] font-semibold mb-2 leading-tight">{wk.theme}</p>
              <div className="flex flex-col gap-1.5">
                {wk.items.map((item, i) => (
                  <div key={i} className="border rounded-sm bg-white/60 px-2 py-1.5">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-[8px] font-mono font-bold text-primary">{item.type}</span>
                    </div>
                    <p className="text-[10px] font-medium leading-snug">{item.title}</p>
                    <p className="text-[9px] text-muted-foreground font-mono mt-0.5" title={item.platform ?? undefined}>{item.platform}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ROI/Reach estimate panel */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3 w-3" /> EST. IMPACT PER TIPE PRODUK — REACH & ROI
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
          {[
            { type: "INFOGRAPHIC", reach: "2.000–8.000 impresi/posting", roi: "Tinggi", cta: "SBU Expiry awareness" },
            { type: "VIDEO", reach: "5.000–25.000 view", roi: "Sangat Tinggi", cta: "Demo platform + testimonial" },
            { type: "EBOOK", reach: "500–2.000 unduhan", roi: "Sedang", cta: "Lead gen email + WhatsApp" },
            { type: "LAPORAN", reach: "200–800 B2B decision maker", roi: "Tinggi", cta: "Pitching klien korporat" },
            { type: "MODUL", reach: "50–300 peserta/batch", roi: "Sangat Tinggi", cta: "Upsell ke sertifikasi SKK" },
            { type: "TEMPLATE", reach: "1.000–5.000 unduhan", roi: "Tinggi", cta: "Viral via BUJK community" },
          ].map(row => (
            <div key={row.type} className="flex items-center gap-2 py-1 border-b border-muted/50 last:border-0">
              <span className="text-[10px] font-mono font-bold w-20 text-primary">{row.type}</span>
              <span className="text-[10px] text-muted-foreground flex-1">{row.reach}</span>
              <span className={`text-[9px] font-mono px-1 rounded-sm ${row.roi === "Sangat Tinggi" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>ROI {row.roi}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Product Revenue Pipeline */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> PRODUCT REVENUE PIPELINE — Proyeksi MRR per Jenis Produk
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Tipe Produk", "Unit Aktif", "Avg Harga/Unit", "MRR Est.", "Growth Lever", "Priority"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { tipe: "LAYANAN (Sertifikasi)", unit: "80–150 klien/bln", avg: "Rp 4.5jt", mrr: "Rp 360–675jt", lever: "WA blast SBU expiry + upsell bundle", pri: "P1", priColor: "bg-red-100 text-red-700" },
                { tipe: "RISET (Intel Custom)", unit: "20–40 klien/bln", avg: "Rp 9jt", mrr: "Rp 180–360jt", lever: "Retainer bulanan + white-label API", pri: "P1", priColor: "bg-red-100 text-red-700" },
                { tipe: "TEMPLATE (Dokumen)", unit: "50–100 download/bln", avg: "Rp 500rb", mrr: "Rp 25–50jt", lever: "SEO + content marketing", pri: "P2", priColor: "bg-orange-100 text-orange-700" },
                { tipe: "TRAINING (Pelatihan)", unit: "5–15 batch/bln", avg: "Rp 5jt/batch", mrr: "Rp 25–75jt", lever: "LinkedIn B2B + kemitraan asosiasi", pri: "P2", priColor: "bg-orange-100 text-orange-700" },
                { tipe: "PLATFORM (SaaS AI)", unit: "10–30 subscribers/bln", avg: "Rp 3jt/bln", mrr: "Rp 30–90jt", lever: "Freemium funnel + demo guided", pri: "P3", priColor: "bg-yellow-100 text-yellow-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium">{r.tipe}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.unit}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.avg}</td>
                  <td className="px-3 py-2 font-mono font-bold text-emerald-700 text-[10px] whitespace-nowrap">{r.mrr}</td>
                  <td className="px-3 py-2 text-[10px] text-primary">{r.lever}</td>
                  <td className="px-3 py-2"><span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${r.priColor}`}>{r.pri}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">MRR Est. = Monthly Recurring Revenue estimasi saat target unit terpenuhi · Update setiap akhir bulan dari data aktual</p>
      </div>

      {/* Product-Market Fit Velocity */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> PRODUCT-MARKET FIT VELOCITY — Kecepatan Produk Mencapai PMF per Kategori
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { tipe: "LAYANAN", pmf: "CONFIRMED", validasi: "400+ klien aktif, NPS >70, churn <8%", lever: "Scale ops + upsell bundle", tColor: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700" },
            { tipe: "RISET", pmf: "APPROACHING", validasi: "40 klien, repeat rate 65%, tambah bulanan", lever: "Build retainer tier + API white-label", tColor: "text-blue-700", badge: "bg-blue-100 text-blue-700" },
            { tipe: "PLATFORM/SAAS", pmf: "IN PROGRESS", validasi: "Dashboard aktif + AI briefing dipakai tim", lever: "External beta launch + freemium tier", tColor: "text-orange-700", badge: "bg-orange-100 text-orange-700" },
            { tipe: "TRAINING", pmf: "EXPLORING", validasi: "2 batch pilot, feedback mixed, monetisasi belum stabil", lever: "Partner asosiasi konstruksi untuk scale", tColor: "text-yellow-700", badge: "bg-yellow-100 text-yellow-700" },
            { tipe: "TEMPLATE/DOKUMEN", pmf: "EXPLORING", validasi: "Download organik ada, tapi monetisasi rendah", lever: "SEO content + free-to-paid conversion path", tColor: "text-yellow-700", badge: "bg-yellow-100 text-yellow-700" },
            { tipe: "AI PRODUK", pmf: "CONCEPT", validasi: "Digunakan internal, belum ada eksternal berbayar", lever: "Build Tender Engine → beta klien Q3 2026", tColor: "text-muted-foreground", badge: "bg-muted text-muted-foreground" },
          ].map((p) => (
            <div key={p.tipe} className="border rounded-sm p-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold font-mono">{p.tipe}</p>
                <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${p.badge}`} title={`PMF Stage: ${p.pmf} — ${p.pmf === "CONFIRMED" ? "Product-Market Fit terkonfirmasi" : p.pmf === "APPROACHING" ? "Mendekati PMF" : p.pmf === "EARLY" ? "Tahap awal PMF" : "PMF belum tercapai"}`}>{p.pmf}</span>
              </div>
              <p className="text-[9px] text-muted-foreground leading-snug mb-1.5">{p.validasi}</p>
              <p className={`text-[9px] font-mono ${p.tColor}`}>→ {p.lever}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="text-3xl font-bold font-mono text-primary">{allProducts.length}</div>
            <div className="text-xs font-bold text-muted-foreground uppercase mt-1">Total Produk</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-500/10 border-slate-500/20">
          <CardContent className="p-4">
            <div className="text-3xl font-bold font-mono text-slate-600">{draftCount}</div>
            <div className="text-xs font-bold text-muted-foreground uppercase mt-1">Draft</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardContent className="p-4">
            <div className="text-3xl font-bold font-mono text-amber-600">{inProgressCount}</div>
            <div className="text-xs font-bold text-muted-foreground uppercase mt-1">In Progress</div>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/10 border-orange-500/20">
          <CardContent className="p-4">
            <div className="text-3xl font-bold font-mono text-orange-600">{reviewCount}</div>
            <div className="text-xs font-bold text-muted-foreground uppercase mt-1">Review / Ready</div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/20 col-span-2 md:col-span-4">
          <CardContent className="p-3 flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <CircleCheck className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold font-mono text-green-600">{publishedCount}</span>
              <span className="text-xs font-bold text-muted-foreground uppercase">Konten Published</span>
            </div>
            <div className="h-2 flex-1 min-w-[120px] bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-green-500 transition-all" style={{ width: allProducts.length ? `${(publishedCount / allProducts.length) * 100}%` : "0%" }} />
            </div>
            <span className="text-xs font-mono text-muted-foreground">{allProducts.length ? Math.round((publishedCount / allProducts.length) * 100) : 0}% selesai</span>
          </CardContent>
        </Card>
        <div className="col-span-2 md:col-span-4 flex flex-col justify-end">
          <div className="flex flex-wrap gap-2">
            <Badge 
              variant={activeTab === "ALL" ? "default" : "outline"}
              className="cursor-pointer font-mono"
              role="button"
              tabIndex={0}
              aria-pressed={activeTab === "ALL"}
              onClick={() => setActiveTab("ALL")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveTab("ALL"); } }}
            >Semua</Badge>
            {PRODUCT_TYPES.map(t => (
              <Badge 
                key={t}
                variant={activeTab === t ? "default" : "outline"}
                className="cursor-pointer font-mono text-[10px]"
                role="button"
                tabIndex={0}
                aria-pressed={activeTab === t}
                onClick={() => setActiveTab(t)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveTab(t); } }}
              >{TYPE_LABELS[t] ?? t}</Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
            {(["ALL", "DRAFT", "IN_PROGRESS", "REVIEW", "READY", "PUBLISHED"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                aria-pressed={statusFilter === s}
                className={cn(
                  "text-[9px] font-mono font-bold px-2 py-0.5 rounded-sm border transition-colors",
                  statusFilter === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                )}
              >
                {s === "ALL" ? "Semua Status" : getStatusLabel(s)}
              </button>
            ))}
            <button
              onClick={() => { setSortNewest(v => !v); if (!sortNewest) setSortDraftFirst(false); }}
              aria-pressed={sortNewest}
              className={cn("text-[9px] font-mono font-bold px-2 py-0.5 rounded-sm border transition-colors", sortNewest ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted")}
              title="Urutkan: diperbarui terbaru dulu"
            >
              {sortNewest ? "↓ Terbaru" : "↑ Terbaru"}
            </button>
            <button
              onClick={() => { setSortDraftFirst(v => !v); if (!sortDraftFirst) setSortNewest(false); }}
              aria-pressed={sortDraftFirst}
              className={cn("text-[9px] font-mono font-bold px-2 py-0.5 rounded-sm border transition-colors", sortDraftFirst ? "bg-amber-100 text-amber-700 border-amber-400" : "border-border text-muted-foreground hover:bg-muted")}
              title="Urutkan: siap publish dulu"
            >
              {sortDraftFirst ? "↑ Siap" : "↓ Urut Status"}
            </button>
            {Object.values(productNotes).filter(v => v?.trim()).length > 0 && (
              <button
                onClick={() => setShowWithNotesOnly(v => !v)}
                aria-pressed={showWithNotesOnly}
                className={cn("text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full border transition-colors", showWithNotesOnly ? "bg-blue-500 text-white border-blue-500" : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200")}
                title="Tampilkan hanya yang ada catatan"
              >
                {Object.values(productNotes).filter(v => v?.trim()).length} catatan
              </button>
            )}
            {(productSearch.trim() || statusFilter !== "ALL" || sortNewest || sortDraftFirst || showWithNotesOnly) && (
              <button
                onClick={() => { setProductSearch(""); setStatusFilter("ALL"); setSortNewest(false); setSortDraftFirst(false); setShowWithNotesOnly(false); }}
                className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors shrink-0"
                title="Reset semua filter"
              >
                ✕ Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Product Lifecycle Roadmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> PRODUCT LIFECYCLE ROADMAP — Status Seumur Hidup Tiap Jenis Produk MJP
        </p>
        <div className="flex gap-0 overflow-x-auto pb-1">
          {[
            { phase: "IDEATE", icon: "💡", desc: "Konsep awal dari pain points", products: ["AI Competitor Bot", "Price Predictor"], color: "bg-slate-500" },
            { phase: "VALIDATE", icon: "🔬", desc: "Uji dengan early adopter", products: ["AI Proposal Writer", "Training Online"], color: "bg-blue-500" },
            { phase: "BUILD", icon: "⚙️", desc: "Development aktif", products: ["Regulatory Compass", "BIM Advisory"], color: "bg-violet-500" },
            { phase: "LAUNCH", icon: "🚀", desc: "Tersedia untuk klien", products: ["SMAP Pendampingan", "Intel Tender"], color: "bg-orange-500" },
            { phase: "SCALE", icon: "📈", desc: "Tumbuh & profitabel", products: ["SKK Multi-Jenjang", "SBU Express"], color: "bg-emerald-500" },
            { phase: "OPTIMIZE", icon: "⭐", desc: "Mature & upsell", products: ["AI Briefing Generator", "Platform Intel"], color: "bg-primary" },
          ].map((p, i, arr) => (
            <div key={p.phase} className="flex items-center gap-0 flex-none" style={{ minWidth: 150 }}>
              <div className="border rounded-sm p-3 flex-1 h-full">
                <div className={`text-[8px] font-mono font-bold text-white px-1.5 py-0.5 rounded-sm ${p.color} inline-block mb-1.5`}>{p.phase}</div>
                <p className="text-base mb-1">{p.icon}</p>
                <p className="text-[9px] text-muted-foreground mb-1.5 leading-snug">{p.desc}</p>
                {p.products.map(prod => (
                  <p key={prod} className="text-[9px] font-mono flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${p.color} shrink-0`} />
                    {prod}
                  </p>
                ))}
              </div>
              {i < arr.length - 1 && <span className="text-muted-foreground font-bold px-1">›</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Product Pricing Strategy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> PRODUCT PRICING STRATEGY — Model Harga Optimal per Produk MJP
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { produk: "Laporan Riset Express", model: "FLAT FEE", harga: "Rp 4.5–8jt", upsell: "+ revisi unlimited Rp 1.5jt", margin: "82%", mc: "text-emerald-700", tag: "BESTSELLER" },
            { produk: "SMAP Pendampingan Full", model: "PAKET ALL-IN", harga: "Rp 12–22jt", upsell: "+ monitoring 1 thn Rp 3jt", margin: "70%", mc: "text-emerald-700", tag: "HIGH VALUE" },
            { produk: "SKK Multi-Jenjang Bundle", model: "BUNDEL DISKON", harga: "Rp 6–15jt", upsell: "+ referral klien baru Rp 500rb", margin: "68%", mc: "text-blue-700", tag: "VOLUME" },
            { produk: "Intel Tender Subscription", model: "RECURRING/BLN", harga: "Rp 3jt/bln", upsell: "+ flash alert WhatsApp Rp 1jt", margin: "75%", mc: "text-emerald-700", tag: "MRR" },
            { produk: "Advisory BIM Readiness", model: "RETAINER", harga: "Rp 5–10jt/bln", upsell: "+ implementasi Rp 15–30jt", margin: "60%", mc: "text-blue-700", tag: "PREMIUM" },
            { produk: "TKDN PDN Audit Report", model: "FLAT FEE", harga: "Rp 2.5–5jt", upsell: "+ pendampingan Rp 3.5jt", margin: "77%", mc: "text-emerald-700", tag: "COMPLIANCE" },
          ].map((p) => (
            <div key={p.produk} className="border rounded-sm p-3">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-[10px] font-semibold leading-snug">{p.produk}</p>
                <span className="text-[8px] font-mono font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm shrink-0">{p.tag}</span>
              </div>
              <p className="text-[9px] font-mono text-muted-foreground mb-1">{p.model}</p>
              <p className="text-base font-black font-mono text-primary">{p.harga}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{p.upsell}</p>
              <p className={`text-[9px] font-mono font-bold mt-1 ${p.mc}`}>Margin: {p.margin}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Product Demand Signal Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> PRODUCT DEMAND SIGNAL TRACKER — Sinyal Permintaan Aktif per Produk dari Data Lapangan
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { produk: "Pengurusan SBU Express", signals: ["Alert expiry 1.200+ BUJK bulan ini", "Pertanyaan WA: 45/minggu tentang SBU", "LPJK update persyaratan baru"], strength: 98, sc: "text-red-700", bc: "bg-red-500" },
            { produk: "Pendampingan SMAP", signals: ["SE LPJK enforcement deadline Des 2026", "Pertanyaan konsultasi: 30/minggu", "200K BUJK belum comply"], strength: 95, sc: "text-red-700", bc: "bg-orange-500" },
            { produk: "SKK Multi-Jenjang", signals: ["SKK rolling renewal tahunan", "BIM wajib 2027 butuh SKK baru", "Gap supply-demand 35K+ posisi"], strength: 90, sc: "text-orange-700", bc: "bg-yellow-500" },
            { produk: "Intel Tender Subscription", signals: ["100K tender/thn di LPSE", "Peak Q2–Q3 APBN hampir tiba", "Klien tanya: 'tender apa yang buka?'"], strength: 85, sc: "text-orange-700", bc: "bg-blue-500" },
            { produk: "Advisory BIM Readiness", signals: ["Permen PUPR berlaku bertahap", "Proyek >Rp100M mulai wajib BIM", "Gap: hanya 5K BIM specialist vs 40K dibutuhkan"], strength: 78, sc: "text-blue-700", bc: "bg-violet-500" },
          ].map((p) => (
            <div key={p.produk} className="border-b last:border-0 pb-2 last:pb-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-[10px] font-semibold">{p.produk}</p>
                    <span className={`text-[9px] font-mono font-bold ${p.sc}`}>{p.strength}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${p.bc} rounded-full`} style={{ width: `${p.strength}%` }} />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-3">
                {p.signals.map((s, i) => (
                  <p key={i} className="text-[8px] font-mono text-muted-foreground flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/50 shrink-0" />{s}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Signal Strength = composite score dari VOC lapangan + query data + regulatory trigger + volume permintaan langsung</p>
      </div>

      {/* Product Launch Readiness Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> PRODUCT LAUNCH READINESS — Status Kesiapan Produk Baru untuk Diluncurkan ke Pasar
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              produk: "Platform Intel Tender AI v2.0",
              target: "Q3 2026",
              readiness: 82,
              checks: [
                { item: "Backend API", done: true },
                { item: "Frontend Dashboard", done: true },
                { item: "LPSE Integration", done: true },
                { item: "Alert Engine", done: false },
                { item: "Beta Testing 20 klien", done: false },
              ],
              stage: "BETA PREP",
              sc: "text-blue-700",
            },
            {
              produk: "BIM Readiness Assessment Tool",
              target: "Q4 2026",
              readiness: 45,
              checks: [
                { item: "Requirement Analysis", done: true },
                { item: "Prototype UI", done: true },
                { item: "BIM Checklist Engine", done: false },
                { item: "Partner Konsultan BIM", done: false },
                { item: "Pilot 5 klien", done: false },
              ],
              stage: "DEVELOPMENT",
              sc: "text-orange-700",
            },
          ].map((p) => (
            <div key={p.produk} className="border rounded-sm p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-[10px] font-semibold">{p.produk}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ${p.sc}`}>{p.stage}</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${p.readiness}%` }} />
                </div>
                <span className="text-[9px] font-mono font-bold text-primary">{p.readiness}%</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {p.checks.map((c, i) => (
                  <p key={i} className={`text-[9px] flex items-center gap-1 ${c.done ? "text-emerald-700" : "text-muted-foreground"}`}>
                    <span>{c.done ? "✓" : "○"}</span>{c.item}
                  </p>
                ))}
              </div>
              <p className="text-[9px] font-mono text-muted-foreground mt-1.5">Target launch: {p.target}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Product Revenue Attribution */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> PRODUCT REVENUE ATTRIBUTION — Kontribusi Revenue per Produk Terhadap Total MJP
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { produk: "SBU Express Bundle", rev: 42, pct: 38, color: "bg-primary" },
            { produk: "Pendampingan SMAP", rev: 28, pct: 25, color: "bg-blue-500" },
            { produk: "SKK Multi-Jenjang", rev: 19, pct: 17, color: "bg-violet-500" },
            { produk: "Intel Tender Subscription", rev: 11, pct: 10, color: "bg-orange-500" },
            { produk: "Advisory BIM", rev: 7, pct: 6, color: "bg-yellow-500" },
            { produk: "Lainnya", rev: 4, pct: 4, color: "bg-muted-foreground/40" },
          ].map((p) => (
            <div key={p.produk} className="flex items-center gap-2">
              <p className="text-[9px] text-muted-foreground w-44 shrink-0">{p.produk}</p>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${p.color} rounded-full`} style={{ width: `${p.pct}%` }} />
              </div>
              <span className="text-[9px] font-mono font-bold text-primary w-12 shrink-0 text-right" title={`Rp ${(p.rev * 1_000_000).toLocaleString("id-ID")}`}>Rp {p.rev}jt</span>
              <span className="text-[9px] font-mono text-muted-foreground w-8 text-right">{p.pct}%</span>
            </div>
          ))}
        </div>
        <div className="border-t pt-2 flex gap-4">
          {[{ label: "Total Revenue Bulan Ini", val: "Rp 111jt", tc: "text-primary" }, { label: "Produk Terbaik", val: "SBU Express", tc: "text-emerald-700" }, { label: "Produk Tumbuh Tercepat", val: "Intel Tender +32%", tc: "text-blue-700" }].map(m => (
            <div key={m.label} className="text-center">
              <p className={`text-[10px] font-mono font-bold ${m.tc}`}>{m.val}</p>
              <p className="text-[8px] font-mono text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Product Competitive Differentiation Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> COMPETITIVE DIFFERENTIATION MATRIX — Keunggulan Setiap Produk vs Alternatif Pasar
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase">Produk MJP</th>
                {["Kecepatan", "Harga", "Kelengkapan", "Data Real-Time", "Support", "Kustomisasi"].map(h => (
                  <th key={h} className="text-center px-2 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { prod: "SBU Express Bundle", scores: [95, 80, 90, 70, 95, 75] },
                { prod: "Pendampingan SMAP", scores: [85, 75, 95, 65, 90, 80] },
                { prod: "Intel Tender AI", scores: [98, 85, 90, 99, 80, 70] },
                { prod: "SKK Multi-Jenjang", scores: [80, 90, 85, 60, 85, 65] },
                { prod: "BIM Advisory", scores: [70, 70, 80, 75, 90, 90] },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium text-[10px] whitespace-nowrap">{r.prod}</td>
                  {r.scores.map((s, j) => {
                    const bg = s >= 90 ? "bg-emerald-500" : s >= 75 ? "bg-blue-400" : s >= 60 ? "bg-yellow-400" : "bg-muted/50";
                    const tc = s >= 75 ? "text-white" : "text-muted-foreground";
                    return (
                      <td key={j} className="px-2 py-2 text-center">
                        <div className={`${bg} rounded-sm w-8 h-5 mx-auto flex items-center justify-center`}>
                          <span className={`text-[8px] font-mono font-bold ${tc}`}>{s}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Score vs rata-rata pasar · Hijau ≥90 = unggul signifikan · Biru ≥75 = kompetitif · Kuning ≥60 = at par · Abu = tertinggal</p>
      </div>

      {/* Product Bundle Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5 text-primary" /> PRODUCT BUNDLE INTELLIGENCE — Kombinasi Produk yang Paling Sering Dibeli Bersama
        </p>
        <div className="flex flex-col gap-2">
          {[
            { bundle: "SBU + SMAP Compliance Bundle", freq: 68, avgValue: "Rp 19.5jt", margin: "82%", topSegment: "Kualifikasi M1–M2", tag: "BEST SELLER", tc: "text-emerald-700" },
            { bundle: "SKK Jenjang 7 + SKK K3 Konstruksi", freq: 52, avgValue: "Rp 8.2jt", margin: "91%", topSegment: "Tenaga Ahli Muda", tag: "HIGH MARGIN", tc: "text-violet-700" },
            { bundle: "Intel Tender + Surat Penawaran AI", freq: 41, avgValue: "Rp 5.8jt/bln", margin: "94%", topSegment: "BUJK Aktif Tender", tag: "RECURRING", tc: "text-blue-700" },
            { bundle: "BIM Advisory + SKK BIM", freq: 28, avgValue: "Rp 24jt", margin: "76%", topSegment: "BUJK B1–B2", tag: "HIGH VALUE", tc: "text-orange-700" },
          ].map((b) => (
            <div key={b.bundle} className="flex items-center gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[9px] font-semibold">{b.bundle}</p>
                  <span className={`text-[8px] font-mono font-bold ${b.tc}`}>[{b.tag}]</span>
                </div>
                <p className="text-[9px] text-muted-foreground">Segmen: {b.topSegment} · Margin: {b.margin}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-mono font-black text-primary">{b.avgValue}</p>
                <p className="text-[9px] font-mono text-muted-foreground">{b.freq}× terjual</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Bundle = kombinasi yang dibeli dalam 30 hari · Tawarkan bundle ke klien single-product untuk upsell</p>
      </div>

      {/* Product Version Roadmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-primary" /> PRODUCT VERSION ROADMAP — Peta Pengembangan Produk Berikutnya Berdasarkan Demand Klien
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              horizon: "Q3 2026 (Now)", color: "border-emerald-300 bg-emerald-50/30", tc: "text-emerald-700",
              products: [
                { name: "SMAP Compliance Express", status: "LIVE", demand: "HIGH", progress: 100 },
                { name: "Intel Tender v2 — AI scoring", status: "LIVE", demand: "HIGH", progress: 100 },
                { name: "SKK Multi-Jenjang Bundle", status: "LIVE", demand: "HIGH", progress: 100 },
              ],
            },
            {
              horizon: "Q4 2026 (Next)", color: "border-blue-300 bg-blue-50/30", tc: "text-blue-700",
              products: [
                { name: "BIM Readiness Assessment", status: "IN DEV", demand: "VERY HIGH", progress: 65 },
                { name: "AI Compliance Engine v1", status: "PLANNED", demand: "HIGH", progress: 20 },
                { name: "Referral Partner Portal", status: "PLANNED", demand: "MEDIUM", progress: 10 },
              ],
            },
            {
              horizon: "Q1 2027 (Future)", color: "border-violet-300 bg-violet-50/30", tc: "text-violet-700",
              products: [
                { name: "Auto-tender bid optimizer", status: "RESEARCH", demand: "VERY HIGH", progress: 5 },
                { name: "BUJK credit scoring", status: "RESEARCH", demand: "HIGH", progress: 0 },
                { name: "SKK renewal auto-reminder", status: "PLANNED", demand: "HIGH", progress: 0 },
              ],
            },
          ].map((h) => (
            <div key={h.horizon} className={`border rounded-sm p-3 ${h.color}`}>
              <p className={`text-[9px] font-mono font-bold mb-2 ${h.tc}`}>{h.horizon}</p>
              {h.products.map((p, i) => (
                <div key={i} className="mb-1.5 last:mb-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[9px] font-medium leading-snug">{p.name}</p>
                    <span className={`text-[8px] font-mono font-bold ${h.tc}`}>{p.status}</span>
                  </div>
                  <div className="h-1 bg-white/60 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full`} style={{ width: `${p.progress}%`, backgroundColor: p.progress === 100 ? '#10b981' : p.progress > 0 ? '#6366f1' : '#e5e7eb' }} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Product Revenue Attribution */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> PRODUCT REVENUE ATTRIBUTION — Kontribusi Setiap Produk terhadap Total Revenue Bulan Ini
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { product: "SKK Certification Services", revenue: "Rp 142jt", pct: 38, trend: "+12%", c: "bg-blue-500", tc: "text-blue-700" },
            { product: "SBU & SMAP Compliance", revenue: "Rp 98jt", pct: 26, trend: "+34%", c: "bg-emerald-500", tc: "text-emerald-700" },
            { product: "Intel Tender + Surat Penawaran AI", revenue: "Rp 67jt", pct: 18, trend: "+8%", c: "bg-violet-500", tc: "text-violet-700" },
            { product: "BIM Advisory & Training", revenue: "Rp 41jt", pct: 11, trend: "+61%", c: "bg-orange-500", tc: "text-orange-700" },
            { product: "Lain-lain / Custom", revenue: "Rp 28jt", pct: 7, trend: "-3%", c: "bg-muted", tc: "text-muted-foreground" },
          ].map((p) => (
            <div key={p.product} className="flex items-center gap-3">
              <p className="text-[9px] text-muted-foreground w-48 shrink-0">{p.product}</p>
              <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${p.c} rounded-full`} style={{ width: `${p.pct * 2.5}%` }} />
              </div>
              <p className={`text-[9px] font-mono font-bold w-20 text-right shrink-0 ${p.tc}`}>{p.revenue}</p>
              <p className={`text-[9px] font-mono w-10 text-right shrink-0 ${p.trend.startsWith("+") ? "text-emerald-700" : "text-red-700"}`}>{p.trend}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">BIM Advisory tumbuh 61% MoM — alokasikan lebih banyak kapasitas tim untuk segmen ini</p>
      </div>

      {/* Product Expansion Opportunity Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Compass className="h-3.5 w-3.5 text-primary" /> EXPANSION OPPORTUNITY MATRIX — Produk Baru yang Bisa Diluncurkan dengan Aset yang Sudah Ada
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { product: "SKK Auto-Renewal Reminder SaaS", readiness: 92, tam: "Rp 18M", time: "1 bulan build", synergy: "Reuse database SKK + scheduler existing", priority: "LAUNCH NOW", pc: "text-emerald-700" },
            { product: "Tender Alert API untuk Developer", readiness: 78, tam: "Rp 8M", time: "2 bulan build", synergy: "Reuse crawler LPSE + OpenAPI spec", priority: "NEXT SPRINT", pc: "text-blue-700" },
            { product: "BUJK Health Score (Compliance Grade)", readiness: 65, tam: "Rp 24M", time: "3 bulan build", synergy: "Reuse data kontraktor + regulasi rules", priority: "Q4 2026", pc: "text-violet-700" },
            { product: "Marketplace Tenaga Ahli Bersertifikat", readiness: 44, tam: "Rp 45M", time: "6 bulan build", synergy: "Reuse SKK database + BUJK network", priority: "2027", pc: "text-orange-700" },
          ].map((p) => (
            <div key={p.product} className="border rounded-sm p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[9px] font-semibold leading-snug">{p.product}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ${p.pc}`}>{p.priority}</span>
              </div>
              <div className="flex gap-2 mb-1">
                <span className="text-[9px] font-mono">Ready: <span className={`font-bold ${p.pc}`}>{p.readiness}%</span></span>
                <span className="text-[9px] font-mono text-emerald-700">TAM: {p.tam}</span>
                <span className="text-[9px] font-mono text-muted-foreground">{p.time}</span>
              </div>
              <p className="text-[9px] text-muted-foreground leading-snug">Leverage: {p.synergy}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Product Pricing Power Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> PRICING POWER ANALYSIS — Seberapa Jauh Harga Produk Bisa Dinaikkan Tanpa Kehilangan Klien
        </p>
        <div className="flex flex-col gap-2">
          {[
            { product: "SKK Express 14 Hari", current: "Rp 3.5–8jt", power: 82, max: "Rp 12jt", elasticity: "Rendah — pelanggan prioritaskan kecepatan", c: "bg-emerald-500", tc: "text-emerald-700" },
            { product: "SMAP Gap Analysis & Pendampingan", current: "Rp 15–28jt", power: 74, max: "Rp 42jt", elasticity: "Sedang — tergantung ukuran BUJK", c: "bg-blue-500", tc: "text-blue-700" },
            { product: "Tender Intelligence Pack", current: "Rp 1.5jt/bln", power: 61, max: "Rp 3.5jt/bln", elasticity: "Sedang — kompetitor SaaS ada di Rp 1.5–8jt", c: "bg-violet-500", tc: "text-violet-700" },
            { product: "AI Briefing Harian", current: "Rp 2.5jt/bln", power: 43, max: "Rp 4jt/bln", elasticity: "Tinggi — klien masih bandingkan dengan free alternatives", c: "bg-orange-500", tc: "text-orange-700" },
          ].map((p) => (
            <div key={p.product} className="flex items-center gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-[9px] font-semibold">{p.product}</p>
                  <span className={`text-[10px] font-mono font-black ${p.tc}`}>{p.power}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                  <div className={`h-full ${p.c} rounded-full`} style={{ width: `${p.power}%` }} />
                </div>
                <div className="flex gap-3">
                  <span className="text-[9px] font-mono text-muted-foreground">Saat ini: {p.current}</span>
                  <span className="text-[9px] font-mono text-emerald-700">Ceiling: {p.max}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Pricing Power 0–100 · SKK Express = pricing power tertinggi → potensi harga naik tanpa churn signifikan</p>
      </div>

      {/* Product Cannibalization Risk */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-orange-600" /> CANNIBALIZATION RISK — Risiko Produk Baru Memotong Revenue Produk Lama yang Sudah Jalan
        </p>
        <div className="flex flex-col gap-2">
          {[
            { newProduct: "SKK Auto-Renewal SaaS (self-serve)", threatTo: "SKK Advisory Manual", overlap: 68, risk: "TINGGI", riskAction: "Bundle exclusive fitur advisory + SaaS agar tidak substitusi", rc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { newProduct: "AI Briefing Harian (self-service)", threatTo: "Konsultan Regulasi On-demand", overlap: 41, risk: "SEDANG", riskAction: "Posisikan AI sebagai input, konsultan sebagai decison layer", rc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { newProduct: "Tender Alert API (developer)", threatTo: "Intel Tender Manual (premium)", overlap: 52, risk: "SEDANG", riskAction: "API pricing jauh lebih rendah + tanpa advisory layer", rc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { newProduct: "BUJK Health Score (freemium)", threatTo: "SMAP Audit Berbayar", overlap: 28, risk: "RENDAH", riskAction: "Score gratis, remediation berbayar — funnel play", rc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.newProduct} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div>
                  <p className="text-[9px] font-bold">{r.newProduct}</p>
                  <p className="text-[9px] text-muted-foreground">Mengancam: {r.threatTo} · Overlap: {r.overlap}%</p>
                </div>
                <span className={`text-[8px] font-mono font-bold shrink-0 ${r.rc}`}>{r.risk}</span>
              </div>
              <p className={`text-[9px] font-mono ${r.rc}`}>→ {r.riskAction}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Product Go-to-Market Playbook */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> GO-TO-MARKET PLAYBOOK — Strategi Peluncuran Terbukti untuk Produk Prioritas MJP
        </p>
        <div className="flex flex-col gap-3">
          {[
            {
              product: "SKK Auto-Renewal Reminder SaaS", status: "LAUNCH READY",
              gtm: [
                { week: "Minggu 1", action: "WhatsApp blast ke 2.000 klien aktif dengan data SKK mereka yang mau expired" },
                { week: "Minggu 2", action: "Webinar 30 menit: 'Cara Tidak Pernah Miss Deadline SKK Lagi' — capture lead baru" },
                { week: "Minggu 3", action: "Aktivasi trial gratis 30 hari dengan reminder kustom per sub-bidang" },
                { week: "Minggu 4+", action: "Convert trial ke langganan tahunan Rp 1.8jt/thn dengan early bird discount" },
              ],
              bc: "bg-emerald-50 border-emerald-200", tc: "text-emerald-700",
            },
            {
              product: "Tender Intelligence Pack", status: "NEXT SPRINT",
              gtm: [
                { week: "Bulan 1", action: "Beta test dengan 20 klien BUJK aktif — free access untuk feedback" },
                { week: "Bulan 2", action: "Case study: klien yang win tender berkat Intel Tender MJP → content marketing" },
                { week: "Bulan 3", action: "Launch pricing Rp 500rb/bln dengan 3 bulan gratis jika bayar tahunan" },
              ],
              bc: "bg-blue-50 border-blue-200", tc: "text-blue-700",
            },
          ].map((p) => (
            <div key={p.product} className={`border rounded-sm p-3 ${p.bc}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-bold">{p.product}</p>
                <span className={`text-[8px] font-mono font-bold ${p.tc}`}>{p.status}</span>
              </div>
              <div className="flex flex-col gap-1">
                {p.gtm.map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`text-[8px] font-mono font-bold shrink-0 w-16 ${p.tc}`}>{step.week}</span>
                    <p className="text-[9px] leading-snug">{step.action}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product-Market Fit Scorecard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> PRODUCT-MARKET FIT SCORECARD — Kesiapan Produk vs Permintaan Pasar
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { produk: "Laporan Riset SBU/SKK Express", pmf: 92, demand: "SANGAT TINGGI", pasar: "BUJK + Tenaga Ahli nationwide", gap: "Delivery speed > 24 jam", gapColor: "text-orange-600", pmfColor: "bg-emerald-500" },
            { produk: "SMAP Gap Analysis & Fix", pmf: 87, demand: "TINGGI", pasar: "BUJK Menengah-Besar", gap: "Perlu case study sukses lebih banyak", gapColor: "text-orange-600", pmfColor: "bg-emerald-500" },
            { produk: "Tender Intelligence Pack", pmf: 79, demand: "TINGGI", pasar: "Kontraktor aktif tender APBN", gap: "Brand awareness masih terbatas", gapColor: "text-yellow-600", pmfColor: "bg-blue-500" },
            { produk: "SKK Upgrade Pathway", pmf: 84, demand: "TINGGI", pasar: "Tenaga ahli jenjang 7/8", gap: "Perlu mitra LSP lebih banyak", gapColor: "text-yellow-600", pmfColor: "bg-blue-500" },
            { produk: "BIM Readiness Assessment", pmf: 61, demand: "SEDANG", pasar: "Kontraktor proyek >Rp 100M", gap: "Pasar masih dalam fase edukasi", gapColor: "text-red-600", pmfColor: "bg-yellow-500" },
            { produk: "AI Briefing Harian Platform", pmf: 73, demand: "SEDANG", pasar: "Tim manajemen BUJK", gap: "Perlu onboarding lebih mudah", gapColor: "text-yellow-600", pmfColor: "bg-yellow-500" },
          ].map((p) => (
            <div key={p.produk} className="border rounded-sm p-3 bg-card">
              <p className="text-xs font-semibold mb-2 leading-snug">{p.produk}</p>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${p.pmfColor} rounded-full`} style={{ width: `${p.pmf}%` }} />
                </div>
                <span className="text-[10px] font-mono font-bold">{p.pmf}%</span>
              </div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-mono text-muted-foreground">DEMAND:</span>
                <span className="text-[9px] font-mono font-bold">{p.demand}</span>
              </div>
              <p className="text-[9px] text-muted-foreground">{p.pasar}</p>
              <p className={`text-[9px] font-mono mt-1 ${p.gapColor}`}>△ {p.gap}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">PMF Score = composite dari VOC survey + lead conversion + retention rate · Update tiap 50 closing baru</p>
      </div>

      {/* Content Production Velocity */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> CONTENT PRODUCTION VELOCITY — Target vs Aktual per Jenis Konten
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Jenis Konten", "Target/Bulan", "Waktu Produksi", "Platform", "Est. Reach", "ROI Konten"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { jenis: "Panduan Regulasi PDF", target: "2–4/bln", waktu: "3–5 hari", platform: "Email + WhatsApp", reach: "500–1.500", roi: "TINGGI", roiColor: "bg-orange-100 text-orange-700" },
                { jenis: "Infografis SBU/SKK", target: "4–8/bln", waktu: "1–2 hari", platform: "Instagram + LinkedIn", reach: "2.000–8.000", roi: "TINGGI", roiColor: "bg-orange-100 text-orange-700" },
                { jenis: "Video Tutorial Tender", target: "2/bln", waktu: "5–7 hari", platform: "YouTube + TikTok", reach: "3.000–15.000", roi: "SANGAT TINGGI", roiColor: "bg-emerald-100 text-emerald-700" },
                { jenis: "Newsletter Mingguan", target: "4/bln", waktu: "4–6 jam", platform: "Email subscribers", reach: "800–2.500", roi: "SEDANG", roiColor: "bg-yellow-100 text-yellow-700" },
                { jenis: "WA Blast Regulasi", target: "2–4/bln", waktu: "1–2 jam", platform: "WhatsApp Group", reach: "1.000–5.000", roi: "KRITIS", roiColor: "bg-red-100 text-red-700" },
                { jenis: "Case Study PDF", target: "1/bln", waktu: "7–10 hari", platform: "Sales + Landing Page", reach: "200–600", roi: "SANGAT TINGGI", roiColor: "bg-emerald-100 text-emerald-700" },
              ].map((r) => (
                <tr key={r.jenis} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium">{r.jenis}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.target}</td>
                  <td className="px-3 py-2 text-[10px]">{r.waktu}</td>
                  <td className="px-3 py-2 text-[10px] text-primary" title={r.platform}>{r.platform}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.reach}</td>
                  <td className="px-3 py-2"><span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${r.roiColor}`}>{r.roi}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">ROI Konten = estimasi dampak konversi per jenis konten berdasarkan analisis buyer journey · Reach = estimasi organik</p>
      </div>

      {/* Product Activation Funnel */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> PRODUCT ACTIVATION FUNNEL — Dari Klien Tahu Produk → Bayar → Repeat Order → Advocate
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { stage: "AWARE", count: 4800, pct: 100, desc: "Tahu produk MJP ada (dari WA blast, briefing, referral)", c: "bg-slate-400" },
            { stage: "INTERESTED", count: 2880, pct: 60, desc: "Klik/tanya tapi belum komit", c: "bg-blue-400" },
            { stage: "TRIAL/FREE", count: 1440, pct: 30, desc: "Coba akses briefing gratis atau konsultasi awal", c: "bg-violet-400" },
            { stage: "FIRST PURCHASE", count: 720, pct: 15, desc: "Beli produk/layanan pertama kali", c: "bg-orange-400" },
            { stage: "REPEAT (2+ kali)", count: 432, pct: 9, desc: "Klien yang sudah beli 2× atau lebih", c: "bg-emerald-500" },
            { stage: "ADVOCATE (referral)", count: 144, pct: 3, desc: "Klien yang aktif merekomendasikan ke kontraktor lain", c: "bg-primary" },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <p className={`text-[8px] font-mono font-bold shrink-0 w-20 ${
                s.stage === "AWARE" ? "text-slate-600" :
                s.stage === "INTERESTED" ? "text-blue-700" :
                s.stage === "TRIAL/FREE" ? "text-violet-700" :
                s.stage === "FIRST PURCHASE" ? "text-orange-700" :
                s.stage === "REPEAT (2+ kali)" ? "text-emerald-700" : "text-primary"
              }`}>{s.stage}</p>
              <div className={`rounded-sm h-5 ${s.c} shrink-0`} style={{ width: `${s.pct * 0.6}%`, minWidth: "1rem" }} />
              <p className="text-[9px] font-mono font-bold w-12 shrink-0">{s.count.toLocaleString()}</p>
              <p className="text-[9px] text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Product Adjacency Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-primary" /> PRODUCT ADJACENCY MAP — Produk yang Paling Sering Dibeli Bersama = Bundling Opportunity
        </p>
        <div className="flex flex-col gap-2">
          {[
            { pair: "SKK Express + Perpanjangan SBU", coSales: 189, revenue: "Rp 24jt avg bundle", discount: "12%", lift: "+89% vs terpisah", lc: "text-emerald-700" },
            { pair: "SMAP Advisory + Surat Penawaran Premium", coSales: 134, revenue: "Rp 31jt avg bundle", discount: "8%", lift: "+62% vs terpisah", lc: "text-emerald-700" },
            { pair: "Intel Tender + Konsultasi Dokumen", coSales: 98, revenue: "Rp 8.4jt avg bundle", discount: "15%", lift: "+44% vs terpisah", lc: "text-blue-700" },
            { pair: "Briefing Regulasi + SKK Express", coSales: 72, revenue: "Rp 11jt avg bundle", discount: "10%", lift: "+38% vs terpisah", lc: "text-blue-700" },
          ].map((r) => (
            <div key={r.pair} className="flex items-center gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="flex-1">
                <p className="text-[9px] font-semibold">{r.pair}</p>
                <div className="flex gap-2 mt-0.5">
                  <span className="text-[8px] font-mono text-muted-foreground">{r.coSales} co-sale</span>
                  <span className="text-[8px] font-mono text-primary">{r.revenue}</span>
                  <span className="text-[8px] font-mono text-muted-foreground">diskon {r.discount}</span>
                </div>
              </div>
              <p className={`text-[9px] font-mono font-bold shrink-0 ${r.lc}`}>{r.lift}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Lift = kenaikan conversion rate saat kedua produk ditawarkan bersama vs terpisah · Bundle = kandidat paket prioritas</p>
      </div>

      {/* Product Pricing Power Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> PRICING POWER ANALYSIS — Elastisitas Harga: Produk Mana yang Bisa Naik Harga Tanpa Kehilangan Klien
        </p>
        <div className="flex flex-col gap-2">
          {[
            { product: "SKK Express (14 hari)", current: "Rp 6.2jt", ceiling: "Rp 8.5jt", headroom: 37, churnRisk: "RENDAH", note: "Klien butuh urgency — tidak ada substitusi secepat ini", cc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { product: "SMAP Advisory End-to-End", current: "Rp 28jt", ceiling: "Rp 36jt", headroom: 29, churnRisk: "RENDAH", note: "Nilai deal tender jauh lebih besar dari biaya", cc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { product: "Briefing Intel (per bulan)", current: "Rp 2.8jt", ceiling: "Rp 3.5jt", headroom: 25, churnRisk: "SEDANG", note: "Perlu bundle agar perceived value lebih tinggi", cc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { product: "SBU Perpanjangan", current: "Rp 8.4jt", ceiling: "Rp 9.2jt", headroom: 10, churnRisk: "TINGGI", note: "Banyak alternatif lokal — pertahankan harga saat ini", cc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.product} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-bold">{r.product}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[8px] font-mono text-muted-foreground">{r.current} → {r.ceiling}</span>
                  <span className={`text-[9px] font-mono font-bold ${r.cc}`}>+{r.headroom}% ruang</span>
                </div>
              </div>
              <p className={`text-[9px] font-mono`}>{r.note}</p>
              <p className={`text-[8px] font-mono mt-0.5 ${r.cc}`}>Churn risk: {r.churnRisk}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Product-Market Fit Scorecard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> PRODUCT-MARKET FIT SCORECARD — Seberapa Kuat Setiap Produk MJP Menjawab Kebutuhan Pasar Nyata
        </p>
        <div className="flex flex-col gap-2">
          {[
            { product: "SKK Express 14 Hari", pmf: 9.2, nps: 78, repeat: "89%", icp: "BUJK dengan tender dalam 30 hari", fit: "SANGAT KUAT", fc: "text-emerald-700" },
            { product: "SMAP Advisory End-to-End", pmf: 8.7, nps: 71, repeat: "74%", icp: "BUJK target tender BUMN/BHMN", fit: "KUAT", fc: "text-emerald-700" },
            { product: "Intel Briefing Harian", pmf: 7.9, nps: 63, repeat: "82%", icp: "Manajer & direktur BUJK aktif", fit: "KUAT", fc: "text-blue-700" },
            { product: "BIM Advisory", pmf: 5.4, nps: 49, repeat: "41%", icp: "BUJK gedung menengah ke atas", fit: "BERKEMBANG", fc: "text-orange-700" },
            { product: "Surat Penawaran Premium", pmf: 4.1, nps: 38, repeat: "28%", icp: "BUJK dengan tender kompetitif", fit: "PERLU ITERASI", fc: "text-red-700" },
          ].map((r) => (
            <div key={r.product} className="flex items-center gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-[9px] font-semibold">{r.product}</p>
                  <span className={`text-[8px] font-mono font-bold shrink-0 ml-2 ${r.fc}`}>{r.fit}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-[8px] font-mono text-muted-foreground">NPS: {r.nps}</span>
                  <span className="text-[8px] font-mono text-muted-foreground">Repeat: {r.repeat}</span>
                  <span className="text-[8px] font-mono text-muted-foreground">ICP: {r.icp}</span>
                </div>
              </div>
              <div className="text-center shrink-0 w-10">
                <p className={`text-[14px] font-black font-mono ${r.fc} leading-none`}>{r.pmf}</p>
                <p className="text-[8px] font-mono text-muted-foreground">PMF</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content Distribution Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> CONTENT DISTRIBUTION INTELLIGENCE — Channel yang Paling Efektif Menjangkau Klien Konstruksi Indonesia
        </p>
        <div className="flex flex-col gap-2">
          {[
            { channel: "WhatsApp Broadcast", reach: "6.100/bln", convRate: "12%", cpa: "Rp 48k", leads: "732", bestFor: "SKK expire alert + info tender baru", c: "bg-emerald-500", tc: "text-emerald-700" },
            { channel: "Email Newsletter (PDF)", reach: "2.800/bln", convRate: "8%", cpa: "Rp 72k", leads: "224", bestFor: "Briefing regulasi + laporan intel pasar", c: "bg-blue-500", tc: "text-blue-700" },
            { channel: "LinkedIn Post (tim)", reach: "4.200/bln", convRate: "3%", cpa: "Rp 120k", leads: "126", bestFor: "BUJK nasional + kontraktor besar", c: "bg-blue-400", tc: "text-blue-700" },
            { channel: "Referral Klien", reach: "890/bln", convRate: "31%", cpa: "Rp 0", leads: "276", bestFor: "Akuisisi klien baru berkualitas tinggi", c: "bg-emerald-600", tc: "text-emerald-700" },
            { channel: "YouTube / Video", reach: "1.400/bln", convRate: "2%", cpa: "Rp 180k", leads: "28", bestFor: "Brand awareness jangka panjang", c: "bg-orange-400", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.channel} className="flex items-center gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-[9px] font-semibold">{r.channel}</p>
                  <span className={`text-[9px] font-mono font-bold shrink-0 ml-2 ${r.tc}`}>{r.convRate} CR · {r.leads} leads</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-0.5">
                  <div className={`h-full ${r.c} rounded-full`} style={{ width: `${parseFloat(r.convRate) * 8}%` }} />
                </div>
                <p className="text-[8px] font-mono text-muted-foreground">{r.reach} reach · CPA: {r.cpa} · Best for: {r.bestFor}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product Competitive Moat Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> COMPETITIVE MOAT ANALYSIS — Seberapa Sulit Pesaing Meniru Produk/Layanan MJP yang Ada Saat Ini
        </p>
        <div className="flex flex-col gap-2">
          {[
            { product: "SKK Express 14-hari", moat: "Operasional: jaringan LPJK insider + SOP 14-hari terasah", defensibility: 78, risk: "Rendah — pesaing butuh 12+ bulan untuk bangun jaringan setara", mc: "text-emerald-700" },
            { product: "Intel Briefing Harian (AI)", moat: "Data: 64 sumber eksklusif + model AI yang sudah fine-tuned 24 bulan", defensibility: 91, risk: "Sangat Rendah — akumulasi data historical sulit direplikasi", mc: "text-emerald-700" },
            { product: "SMAP Advisory", moat: "Keahlian: domain expert tersertifikasi + studi kasus klien nyata", defensibility: 64, risk: "Sedang — individu berkeahlian dapat di-poach", mc: "text-blue-700" },
            { product: "Direktori Kontraktor (platform)", moat: "Network: 1.200+ profil terverifikasi + data riset lapangan eksklusif", defensibility: 83, risk: "Rendah — database ini butuh >2 tahun riset untuk dibangun ulang", mc: "text-emerald-700" },
            { product: "BIM Advisory", moat: "Belum terbangun — masih berbasis sertifikasi umum", defensibility: 31, risk: "Tinggi — banyak pesaing sudah ada di segmen ini", mc: "text-red-700" },
          ].map((r) => (
            <div key={r.product} className="border-b last:border-0 pb-2 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-[9px] font-bold mb-0.5">{r.product}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${r.defensibility >= 80 ? "bg-emerald-500" : r.defensibility >= 60 ? "bg-blue-400" : "bg-red-400"} rounded-full`} style={{ width: `${r.defensibility}%` }} />
                    </div>
                    <span className={`text-[9px] font-mono font-bold shrink-0 ${r.mc}`}>{r.defensibility}%</span>
                  </div>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground mt-0.5">Moat: {r.moat}</p>
              <p className={`text-[8px] font-mono ${r.mc}`}>Risiko pesaing: {r.risk}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Product Revenue Attribution Waterfall */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> REVENUE ATTRIBUTION WATERFALL — Dari Total Revenue MJP, Berapa % yang Berasal dari Setiap Output Produk?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { product: "SKK Express & Reguler", revenue: "Rp 284jt", pct: 41, clients: 487, avgTicket: "Rp 583k", c: "bg-primary", tc: "text-primary" },
            { product: "SMAP Advisory & Pendampingan", revenue: "Rp 198jt", pct: 29, clients: 124, avgTicket: "Rp 1.6jt", c: "bg-blue-500", tc: "text-blue-700" },
            { product: "Intel Briefing Premium", revenue: "Rp 89jt", pct: 13, clients: 312, avgTicket: "Rp 285k/bln", c: "bg-blue-300", tc: "text-blue-600" },
            { product: "BIM Advisory", revenue: "Rp 47jt", pct: 7, clients: 18, avgTicket: "Rp 2.6jt", c: "bg-emerald-400", tc: "text-emerald-700" },
            { product: "Riset & Laporan Custom", revenue: "Rp 68jt", pct: 10, clients: 28, avgTicket: "Rp 2.4jt", c: "bg-emerald-500", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.product} className="flex items-center gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-[9px] font-bold">{r.product}</p>
                  <p className={`text-[10px] font-black font-mono shrink-0 ml-2 ${r.tc}`}>{r.revenue}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.pct * 2.4}%` }} />
                  </div>
                  <span className={`text-[9px] font-mono font-bold shrink-0 ${r.tc}`}>{r.pct}%</span>
                </div>
                <p className="text-[8px] font-mono text-muted-foreground mt-0.5">{r.clients} klien · avg ticket {r.avgTicket}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">SKK masih tulang punggung (41%) — BIM Advisory potensi terbesar untuk diversifikasi menuju revenue portfolio lebih seimbang</p>
      </div>

      {/* Product Launch Readiness Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-primary" /> PRODUCT LAUNCH READINESS — Status Kesiapan Produk Baru yang Sedang dalam Pipeline Pengembangan
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              product: "BIM Readiness Advisory", targetLaunch: "Q1 2027", readiness: 31,
              done: ["Market validation", "Pricing research"], pending: ["Expert partnership", "Curriculum design", "Pilot client", "Marketing materials"],
              rc: "text-red-700", bc: "bg-red-50 border-red-200",
            },
            {
              product: "SKK Green Building Express", targetLaunch: "Q2 2027", readiness: 18,
              done: ["Sub-bidang mapping"], pending: ["LPJK liaison", "Expert network build", "Content development", "Pricing model", "Pilot"],
              rc: "text-red-700", bc: "bg-red-50 border-red-200",
            },
            {
              product: "Platform Self-Service SKK Status Checker", targetLaunch: "Q4 2026", readiness: 74,
              done: ["API integration", "UI mockup", "Backend logic", "Testing v1"], pending: ["Public launch", "Marketing"],
              rc: "text-orange-700", bc: "bg-orange-50 border-orange-200",
            },
            {
              product: "Tender Win Probability Calculator (AI)", targetLaunch: "Q3 2026", readiness: 89,
              done: ["Model training", "API endpoint", "Frontend widget", "Internal testing", "Pilot 20 klien"], pending: ["Documentation"],
              rc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200",
            },
          ].map((r) => (
            <div key={r.product} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-bold flex-1">{r.product}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[8px] font-mono text-muted-foreground">{r.targetLaunch}</span>
                  <span className={`text-[10px] font-black font-mono ${r.rc}`}>{r.readiness}%</span>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                <div className={`h-full ${r.readiness >= 80 ? "bg-emerald-500" : r.readiness >= 50 ? "bg-orange-400" : "bg-red-400"} rounded-full`} style={{ width: `${r.readiness}%` }} />
              </div>
              <div className="flex gap-3 text-[8px] font-mono">
                <span className="text-emerald-700">✓ {r.done.join(", ")}</span>
                <span className="text-muted-foreground">⬜ {r.pending.join(", ")}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product Churn & Retention Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> PRODUCT CHURN & RETENTION — Berapa % Klien yang Kembali Beli Setelah Transaksi Pertama per Produk?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { product: "SKK Express 14hr", retention: 84, churn: 16, returning: "412 dari 487", avgRepeat: "2.8× per tahun", note: "Klien repeat karena tenaga ahli baru terus bertambah", gc: "text-emerald-700", cc: "text-red-600" },
            { product: "Intel Briefing Premium", retention: 91, churn: 9, returning: "284 dari 312", avgRepeat: "12× per tahun (subscription)", note: "Subscription model = churn paling rendah dari semua produk", gc: "text-emerald-700", cc: "text-red-600" },
            { product: "SMAP Advisory", retention: 61, churn: 39, returning: "75 dari 124", avgRepeat: "1.4× per tahun", note: "Churn tinggi karena sifatnya one-time compliance. Cross-sell ke SKK maintenance", gc: "text-orange-700", cc: "text-orange-600" },
            { product: "Riset & Laporan Custom", retention: 79, churn: 21, returning: "22 dari 28", avgRepeat: "2.1× per tahun", note: "High-value clients yang puas cenderung kembali untuk riset tema berbeda", gc: "text-emerald-700", cc: "text-red-600" },
          ].map((r) => (
            <div key={r.product} className="flex items-start gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] font-bold">{r.product}</p>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[10px] font-black font-mono ${r.gc}`}>{r.retention}%</span>
                    <span className="text-[8px] font-mono text-muted-foreground">retained</span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden mb-1">
                  <div className="flex h-full">
                    <div className="bg-emerald-400 rounded-l-full" style={{ width: `${r.retention}%` }} />
                    <div className="bg-red-300 rounded-r-full flex-1" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground">
                  <span>{r.returning}</span>
                  <span>Avg {r.avgRepeat}</span>
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">{r.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product Pricing Psychology Panel */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> PRICING PSYCHOLOGY ANALYSIS — Apakah Harga Produk MJP Sudah Optimal dari Sisi Psikologi Keputusan Klien?
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              product: "SKK Express 14hr — Rp 450k",
              anchoring: "Bandingkan dengan Rp 1.2jt konsultan besar → terasa murah 63%",
              framing: "\"SKK dalam 14 jam\" = urgency framing — powerful untuk klien yang deadline tender dekat",
              suggestion: "Tambahkan social proof: \"487 klien sudah terbantu bulan ini\" di marketing material",
              score: 88,
            },
            {
              product: "Intel Briefing — Rp 285k/bln",
              anchoring: "Setara 2 kopi sehari → terlalu cheap? Pertimbangkan Rp 500k untuk positioning lebih premium",
              framing: "Subscription model bagus, tapi framing \"per bulan\" kurang powerful vs \"per insight actionable\"",
              suggestion: "Test pricing Rp 500k/bln dengan free 1 bulan trial → estimasi conversion lebih tinggi",
              score: 71,
            },
            {
              product: "SMAP Advisory — Rp 1.6jt",
              anchoring: "vs denda compliance Rp 50jt+ → ROI sangat jelas. Sudah dikomunikasikan?",
              framing: "Framing saat ini: \"layanan pendampingan\". Ubah ke \"proteksi risiko denda compliance Rp 50jt\"",
              suggestion: "Gunakan loss-aversion framing: \"Tanpa SMAP, tender Anda bisa gugur secara legal\"",
              score: 79,
            },
          ].map((r) => (
            <div key={r.product} className="border rounded-sm p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-bold">{r.product}</p>
                <span className={`text-[12px] font-black font-mono shrink-0 ml-2 ${r.score >= 85 ? "text-emerald-700" : "text-orange-700"}`}>{r.score}/100</span>
              </div>
              <p className="text-[9px] text-muted-foreground mb-0.5">⚓ {r.anchoring}</p>
              <p className="text-[9px] mb-0.5">🖼 {r.framing}</p>
              <p className="text-[9px] font-mono text-blue-700">💡 {r.suggestion}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Pricing psychology bisa meningkatkan conversion 15–30% tanpa mengubah harga · A/B test framing di landing page bulan depan</p>
      </div>

      {/* Product Bundle Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5 text-primary" /> PRODUCT BUNDLE INTELLIGENCE — Kombinasi Produk yang Paling Sering Dibeli Bersamaan + Peluang Bundle Baru
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { bundle: "SKK Express + Intel Briefing 1 bulan", freq: 127, revenue: "Rp 67jt", margin: "82%", insight: "Klien SKK express yang trial Intel Briefing: 74% convert jadi subscriber tetap", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { bundle: "SMAP Advisory + SKK J9 Renewal", freq: 84, revenue: "Rp 56jt", margin: "79%", insight: "Klien yang butuh SMAP biasanya juga butuh upgrade jenjang SKK ke J9 bersamaan", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { bundle: "Riset Custom + Intel Briefing 3 bulan", freq: 22, revenue: "Rp 47jt", margin: "76%", insight: "Corporate client suka paket lengkap — prestige bundle premium Rp 4jt untuk segmen ini", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.bundle} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-bold flex-1">{r.bundle}</p>
                <div className="text-right shrink-0 ml-2">
                  <p className={`text-[10px] font-black font-mono ${r.tc}`}>{r.revenue}</p>
                  <p className="text-[7px] font-mono text-muted-foreground">margin {r.margin} · {r.freq}× dibeli</p>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground">{r.insight}</p>
            </div>
          ))}
        </div>
        <div className="border rounded-sm p-3 bg-muted/30">
          <p className="text-[9px] font-bold mb-1">💡 Bundle Baru yang Disarankan AI:</p>
          <div className="flex flex-col gap-1.5">
            {[
              { idea: "SKK Renewal + Competitor Alert (add-on)", price: "Rp 600k paket", why: "Klien SKK renewal sering tanya kompetitor — bundle naturalnya" },
              { idea: "SMAP + BIM Readiness Assessment (pre-launch)", price: "Rp 2.5jt paket", why: "Mandatory compliance + future-proofing = strong value prop untuk BUJK growth stage" },
            ].map((r) => (
              <div key={r.idea} className="flex items-start gap-2">
                <p className="text-[9px] flex-1"><span className="font-bold">{r.idea}</span> · {r.price}</p>
                <p className="text-[8px] font-mono text-muted-foreground shrink-0 max-w-[40%] text-right">{r.why}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Product Satisfaction Score by Segment */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-yellow-500" /> PRODUCT SATISFACTION BY SEGMENT — NPS dan CSAT per Produk dan Segmen Klien Berdasarkan Feedback Terbaru
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left px-2 py-1.5 text-[9px] font-mono text-muted-foreground">Produk</th>
                {["BUJK Startup", "BUJK Growth", "BUJK Mature", "NPS Overall", "CSAT"].map(h => (
                  <th key={h} className="px-2 py-1.5 text-[9px] font-mono text-muted-foreground text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { product: "SKK Express", startup: 89, growth: 84, mature: 71, nps: 72, csat: 4.6 },
                { product: "Intel Briefing", startup: 74, growth: 91, mature: 94, nps: 84, csat: 4.8 },
                { product: "SMAP Advisory", startup: 78, growth: 87, mature: 79, nps: 69, csat: 4.4 },
                { product: "Riset Custom", startup: 61, growth: 82, mature: 96, nps: 78, csat: 4.7 },
              ].map((r) => {
                const avgScore = Math.round((r.startup + r.growth + r.mature) / 3);
                const sc = avgScore >= 85 ? "text-emerald-700" : avgScore >= 75 ? "text-blue-700" : "text-orange-700";
                return (
                  <tr key={r.product} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-2 py-1 text-[9px] font-medium">{r.product}</td>
                    <td className={`px-2 py-1 text-[9px] font-mono font-bold text-center ${r.startup >= 80 ? "text-emerald-700" : "text-orange-700"}`}>{r.startup}</td>
                    <td className={`px-2 py-1 text-[9px] font-mono font-bold text-center ${r.growth >= 80 ? "text-emerald-700" : "text-orange-700"}`}>{r.growth}</td>
                    <td className={`px-2 py-1 text-[9px] font-mono font-bold text-center ${r.mature >= 80 ? "text-emerald-700" : "text-orange-700"}`}>{r.mature}</td>
                    <td className={`px-2 py-1 text-[9px] font-mono font-bold text-center ${r.nps >= 75 ? "text-emerald-700" : "text-blue-700"}`}>{r.nps}</td>
                    <td className="px-2 py-1 text-[9px] font-mono font-bold text-center text-yellow-600">{r.csat}/5</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Intel Briefing: CSAT tertinggi (4.8) + NPS 84 — produk terkuat dari sisi kepuasan klien · SKK Startup yang rendah (89→71) perlu personalisasi lebih</p>
      </div>

      {/* Product Roadmap Visibility */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> PRODUCT ROADMAP — 6 Produk/Fitur Baru yang Sedang dalam Pipeline MJP + Status dan ETA
        </p>
        <div className="flex flex-col gap-2">
          {[
            { product: "BIM Readiness Assessment & Bootcamp", status: "DISCOVERY", eta: "Q4 2026", lead: "Lisa + Konsultan BIM External", pct: 15, tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
            { product: "Papua Regional Partner Program (rev share)", status: "PLANNING", eta: "Q4 2026", lead: "Budi + Recruitment Tim Papua", pct: 25, tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { product: "SKK Guarantee Tier (pass atau uang kembali)", status: "DESIGN", eta: "Sep 2026", lead: "Reza + Ops Team", pct: 48, tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { product: "Competitor Price Alert (add-on Intel Briefing)", status: "IN BUILD", eta: "Agt 2026", lead: "Tim Platform (Dev)", pct: 72, tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { product: "K3 Certification Advisory (pre-launch pilot)", status: "PILOT", eta: "Sep 2026 (5 klien)", lead: "Sari + Partner K3", pct: 84, tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
            { product: "Mobile App: Tender Tracker (BUJK self-service)", status: "LAUNCHED", eta: "Go-live Agt 2026", lead: "Tim Mobile (Dev)", pct: 100, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.product} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-[9px] font-bold ${r.tc}`}>{r.product}</p>
                <div className="text-right shrink-0 ml-2">
                  <span className={`text-[8px] font-mono font-bold ${r.tc}`}>{r.status}</span>
                  <p className="text-[7px] font-mono text-muted-foreground">ETA: {r.eta}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${r.pct === 100 ? "bg-emerald-400" : r.pct >= 70 ? "bg-orange-400" : r.pct >= 40 ? "bg-blue-400" : "bg-slate-300"} rounded-full`} style={{ width: `${r.pct}%` }} />
                </div>
                <span className={`text-[9px] font-mono font-bold shrink-0 ${r.tc}`}>{r.pct}%</span>
              </div>
              <p className="text-[8px] font-mono text-muted-foreground mt-0.5">Lead: {r.lead}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Product-Market Fit Radar */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> PRODUCT-MARKET FIT RADAR — Seberapa Kuat PMF Setiap Produk MJP Berdasarkan 5 Dimensi Kritis
        </p>
        <div className="flex flex-col gap-2">
          {[
            { product: "SKK Express Service", dimensions: { "Demand Urgency": 96, "Competitive Moat": 71, "Scalability": 82, "Margin": 88, "Word of Mouth": 84 }, pmf: 84, note: "PMF terkuat — permintaan tinggi, margin tinggi. Bottleneck: capacity SKK processor.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { product: "Intel Briefing Premium", dimensions: { "Demand Urgency": 78, "Competitive Moat": 94, "Scalability": 96, "Margin": 92, "Word of Mouth": 89 }, pmf: 90, note: "Highest PMF score — moat kuat, scalable, NPS tinggi. Fokus: grow subscriber, tidak ganti produk.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { product: "SMAP Advisory", dimensions: { "Demand Urgency": 84, "Competitive Moat": 88, "Scalability": 61, "Margin": 76, "Word of Mouth": 72 }, pmf: 76, note: "Strong PMF tapi scalability rendah (project-based, time-intensive). Systemize proses.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { product: "Riset Custom", dimensions: { "Demand Urgency": 62, "Competitive Moat": 79, "Scalability": 48, "Margin": 71, "Word of Mouth": 78 }, pmf: 68, note: "PMF moderate — tidak bisa scale tanpa template. Build riset template library untuk efisiensi.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.product} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-[9px] font-bold ${r.tc}`}>{r.product}</p>
                <div className="text-right shrink-0 ml-2">
                  <p className={`text-[14px] font-black font-mono ${r.tc} leading-none`}>{r.pmf}</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>PMF score</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-1">
                {Object.entries(r.dimensions).map(([dim, score]) => (
                  <div key={dim} className="flex items-center gap-1">
                    <span className="text-[7px] font-mono text-muted-foreground">{dim}:</span>
                    <span className={`text-[8px] font-mono font-bold ${score >= 80 ? r.tc : "text-muted-foreground"}`}>{score}</span>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground leading-snug">{r.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Product Distribution Channel Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-primary" /> DISTRIBUTION CHANNEL ANALYSIS — Dari Mana Klien MJP Pertama Kali Mengenal dan Membeli Produk
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { channel: "Referral dari Klien Existing", count: 198, pct: 41, conv: 84, cac: "Rp 8k", ltv: "Rp 47jt", c: "bg-emerald-500", tc: "text-emerald-700" },
            { channel: "WhatsApp Cold Outreach", count: 112, pct: 23, conv: 38, cac: "Rp 22k", ltv: "Rp 31jt", c: "bg-blue-400", tc: "text-blue-700" },
            { channel: "Asosiasi & Event Konstruksi", count: 78, pct: 16, conv: 61, cac: "Rp 34k", ltv: "Rp 52jt", c: "bg-violet-400", tc: "text-violet-700" },
            { channel: "Google/SEO (pencarian organik)", count: 47, pct: 10, conv: 24, cac: "Rp 41k", ltv: "Rp 28jt", c: "bg-orange-400", tc: "text-orange-700" },
            { channel: "Media Sosial (LinkedIn, Instagram)", count: 34, pct: 7, conv: 18, cac: "Rp 67k", ltv: "Rp 22jt", c: "bg-slate-400", tc: "text-slate-600" },
            { channel: "Lainnya", count: 19, pct: 4, conv: 31, cac: "Rp 28k", ltv: "Rp 34jt", c: "bg-muted-foreground", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.channel} className="flex items-center gap-2">
              <p className="text-[9px] w-40 shrink-0">{r.channel}</p>
              <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.pct * 2.4}%` }} />
              </div>
              <div className="flex gap-3 text-[8px] font-mono shrink-0 text-right">
                <span className={`font-bold w-12 ${r.tc}`}>{r.count} ({r.pct}%)</span>
                <span className="text-muted-foreground">Conv: {r.conv}%</span>
                <span className={`font-bold ${r.tc}`}>LTV: {r.ltv}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Referral = best channel (41% volume, LTV tertinggi Rp 47jt, CAC terendah Rp 8k) · Investasi utama: programatic referral + loyalty reward</p>
      </div>

      {/* Product Adoption Curve & Maturity Model */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> PRODUCT MATURITY MODEL — Di Mana Setiap Produk MJP Berada dalam Kurva Adopsi Pasar?
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-2">
          {[
            { phase: "INNOVATORS", pct: "2.5%", desc: "Early adopter pertama — tester & power user. Sudah selesai untuk semua produk MJP.", count: "~12 klien", c: "text-violet-700", b: "bg-violet-50 border-violet-200" },
            { phase: "EARLY ADOPTERS", pct: "13.5%", desc: "Klien yang 'paham' dan mau bayar premium. Mayoritas di sini sekarang.", count: "~66 klien", c: "text-blue-700", b: "bg-blue-50 border-blue-200" },
            { phase: "EARLY MAJORITY", pct: "34%", desc: "Mainstream — perlu social proof & ROI proof sebelum beli. Target ekspansi.", count: "~165 klien (target)", c: "text-emerald-700", b: "bg-emerald-50 border-emerald-200" },
            { phase: "LATE MAJORITY", pct: "34%", desc: "Beli karena terpaksa (regulasi, kompetitor) atau ikut-ikutan. 2027+", count: "~165 klien (2027+)", c: "text-orange-700", b: "bg-orange-50 border-orange-200" },
          ].map((p) => (
            <div key={p.phase} className={`border rounded-sm p-2.5 ${p.b}`}>
              <p className={`text-[9px] font-black ${p.c}`}>{p.phase}</p>
              <p className={`text-[11px] font-black font-mono ${p.c} leading-none`}>{p.pct}</p>
              <p className="text-[8px] text-muted-foreground mt-0.5 leading-snug">{p.desc}</p>
              <p className={`text-[8px] font-mono font-bold ${p.c} mt-0.5`}>{p.count}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-bold mb-1">Produk per fase adopsi saat ini:</p>
        <div className="flex flex-col gap-1">
          {[
            { product: "SKK Advisory", phase: "EARLY MAJORITY", progress: 62, note: "487 klien aktif — memasuki mainstream. Tugas: referral program + asosiasi." },
            { product: "Intel Briefing", phase: "EARLY ADOPTERS", progress: 34, note: "218 klien aktif — butuh case study lebih banyak untuk crossing the chasm." },
            { product: "BIM Readiness", phase: "INNOVATORS", progress: 8, note: "62 klien awal — sangat early. Bangun social proof di asosiasi sebelum ekspansi." },
            { product: "Radar Kompetitor", phase: "EARLY ADOPTERS", progress: 28, note: "134 klien — diferensiasi kuat, tapi ROI story perlu diperjelas." },
          ].map((r) => (
            <div key={r.product} className="flex items-center gap-2">
              <p className="text-[9px] w-32 shrink-0 font-bold">{r.product}</p>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${r.progress}%` }} />
              </div>
              <p className="text-[8px] font-mono w-32 shrink-0 text-muted-foreground">{r.phase}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Product Revenue Mix Optimization */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartPie className="h-3.5 w-3.5 text-primary" /> REVENUE MIX OPTIMIZATION — Bagaimana Idealnya Komposisi Revenue MJP di Q4 2026 vs Kondisi Saat Ini?
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[9px] font-bold mb-2 text-muted-foreground">SAAT INI (Aug 2026)</p>
            <div className="flex flex-col gap-1.5">
              {[
                { product: "SKK Advisory", pct: 41, rev: "Rp 312jt", c: "bg-emerald-500" },
                { product: "Intel Briefing (MRR)", pct: 23, rev: "Rp 175jt", c: "bg-blue-400" },
                { product: "Custom Research", pct: 18, rev: "Rp 137jt", c: "bg-violet-400" },
                { product: "Radar Kompetitor", pct: 11, rev: "Rp 84jt", c: "bg-orange-400" },
                { product: "Surat Penawaran Assist", pct: 5, rev: "Rp 38jt", c: "bg-slate-400" },
                { product: "BIM Readiness (beta)", pct: 2, rev: "Rp 15jt", c: "bg-pink-400" },
              ].map((r) => (
                <div key={r.product} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${r.c} shrink-0`} />
                  <p className="text-[9px] flex-1">{r.product}</p>
                  <span className="text-[8px] font-mono font-bold">{r.pct}%</span>
                  <span className="text-[8px] font-mono text-muted-foreground w-14 text-right">{r.rev}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-bold mb-2 text-muted-foreground">TARGET Q4 2026 (optimized)</p>
            <div className="flex flex-col gap-1.5">
              {[
                { product: "Intel Briefing (MRR recurring)", pct: 35, rev: "Rp 350jt", change: "+12pp", tc: "text-emerald-700" },
                { product: "SKK Advisory", pct: 28, rev: "Rp 280jt", change: "-13pp", tc: "text-blue-700" },
                { product: "BIM Readiness (launch)", pct: 14, rev: "Rp 140jt", change: "+12pp", tc: "text-emerald-700" },
                { product: "Custom Research", pct: 12, rev: "Rp 120jt", change: "-6pp", tc: "text-slate-600" },
                { product: "Radar Kompetitor", pct: 8, rev: "Rp 80jt", change: "-3pp", tc: "text-slate-600" },
                { product: "Enterprise / White-label", pct: 3, rev: "Rp 30jt", change: "NEW", tc: "text-violet-700" },
              ].map((r) => (
                <div key={r.product} className="flex items-center gap-2">
                  <p className="text-[9px] flex-1">{r.product}</p>
                  <span className="text-[8px] font-mono font-bold">{r.pct}%</span>
                  <span className={`text-[7px] font-mono font-bold ${r.tc} w-8 text-right shrink-0`}>{r.change}</span>
                  <span className="text-[8px] font-mono text-muted-foreground w-14 text-right">{r.rev}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Shift strategis: dari SKK (one-time) ke Intel Briefing (recurring MRR) + BIM (high value) = model bisnis lebih predictable dan scalable</p>
      </div>

      {/* Product Feedback Synthesis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MessageCircle className="h-3.5 w-3.5 text-primary" /> PRODUCT FEEDBACK SYNTHESIS — Apa yang Klien Benar-Benar Katakan tentang Setiap Produk MJP (Verbatim + AI Summary)
        </p>
        <div className="flex flex-col gap-2">
          {[
            { product: "SKK Express", sentiment: 94, topPraise: "Kecepatan luar biasa — dapat SKK J8 dalam 14 jam, padahal biasanya 3 minggu", topComplaint: "Harga dianggap mahal oleh BUJK kecil, tapi yang sudah pakai tidak menyesal", suggestion: "Buat paket bundel SKK J7+J8 dengan harga lebih efisien", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { product: "Intel Briefing", sentiment: 78, topPraise: "Briefing pagi sudah seperti 'koran pribadi' saya — semua yang relevan ada di sana", topComplaint: "Kadang ada intel yang tidak relevan untuk bidang saya (misalnya gedung saya tapi dapat brief tentang jembatan)", suggestion: "Personalisasi kategori lebih ketat — biarkan klien pilih bidang spesialisasi", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { product: "Radar Kompetitor", sentiment: 71, topPraise: "Pertama kali saya tahu kompetitor sedang kerjakan proyek apa — informasi emas", topComplaint: "Data kompetitor kecil/lokal sering tidak ada — hanya yang besar di LPSE", suggestion: "Tambahkan sumber data informal (sosial media, grup WA kontraktor) untuk kompetitor lokal", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { product: "Surat Penawaran Assist", sentiment: 58, topPraise: "Template-nya profesional — klien saya bilang penawaran saya naik kelas", topComplaint: "Terlalu banyak form yang harus diisi sebelum bisa generate — capek sebelum mulai", suggestion: "One-click pre-fill dari data profil yang sudah ada di MJP", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.product} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-[9px] font-bold ${r.tc}`}>{r.product}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(i => <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= Math.round(r.sentiment / 20) ? (r.sentiment >= 80 ? "bg-emerald-500" : r.sentiment >= 65 ? "bg-blue-400" : "bg-orange-400") : "bg-muted"}`} />)}
                    </div>
                    <span className={`text-[8px] font-mono font-bold ${r.tc}`}>{r.sentiment}%</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-[8px]"><span className="font-bold text-emerald-700">👍 </span>{r.topPraise}</p>
                <p className="text-[8px]"><span className="font-bold text-red-600">👎 </span>{r.topComplaint}</p>
                <p className="text-[8px]"><span className="font-bold text-blue-600">💡 </span>{r.suggestion}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product-Led Growth Metrics */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> PRODUCT-LED GROWTH (PLG) METRICS — Seberapa Banyak Pertumbuhan MJP Datang dari Produk Itu Sendiri vs Sales?
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { metric: "PLG Contribution", val: "41%", desc: "Klien datang dari referral + organic product discovery", c: "text-emerald-700", b: "bg-emerald-50 border-emerald-200" },
            { metric: "Sales-Led Contribution", val: "59%", desc: "Klien datang dari outreach tim AM & event", c: "text-blue-700", b: "bg-blue-50 border-blue-200" },
            { metric: "Product Viral Coefficient", val: "0.34", desc: "Setiap 3 klien → 1 referral baru (target: 0.5+)", c: "text-orange-700", b: "bg-orange-50 border-orange-200" },
            { metric: "Time to Value (P50)", val: "3.2 hari", desc: "Median hari pertama klien rasakan manfaat nyata produk", c: "text-emerald-700", b: "bg-emerald-50 border-emerald-200" },
          ].map((m) => (
            <div key={m.metric} className={`border rounded-sm p-2.5 ${m.b} text-center`}>
              <p className={`text-[14px] font-black font-mono ${m.c} leading-none`}>{m.val}</p>
              <p className={`text-[7px] font-mono ${m.c} font-bold mt-0.5`}>{m.metric}</p>
              <p className="text-[7px] text-muted-foreground mt-0.5 leading-snug">{m.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-bold mb-1.5">PLG initiatives yang sedang dijalankan:</p>
        <div className="flex flex-col gap-1.5">
          {[
            { initiative: "Free Intel Briefing 7 hari (no credit card)", status: "LIVE", results: "128 trials bulan ini → 47 convert ke paid (37% conv rate — best performing acquisition)", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { initiative: "Referral reward: Rp 200rb kredit per klien baru yang berhasil", status: "TESTING", results: "24 referral dari 12 klien dalam 30 hari pertama — promising signal, scale Q4", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { initiative: "Freemium tier: 3 tender alert gratis per minggu (no paywall)", status: "PLANNED", results: "Target Q4 2026 launch — model untuk capture BUJK yang belum bisa bayar SKK Express", tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
          ].map((p) => (
            <div key={p.initiative} className={`border rounded-sm p-2.5 ${p.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${p.tc}`}>{p.initiative}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${p.tc}`}>{p.status}</span>
              </div>
              <p className="text-[9px] text-muted-foreground">{p.results}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Customer Journey Mapping */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ArrowRight className="h-3.5 w-3.5 text-primary" /> CUSTOMER JOURNEY MAP — Perjalanan Klien Khas dari Pertama Tahu MJP hingga Jadi Klien Loyal 12+ Bulan
        </p>
        <div className="flex flex-col gap-1">
          {[
            { stage: "AWARE", touchpoint: "Referral dari klien lain (41%) · LinkedIn post (28%) · Event asosiasi (18%) · Cold outreach (13%)", emotion: "Skeptis — 'apa bedanya dengan yang lain?'", mjpRole: "Proof: testimoni + demo SKK Express yang dramatis (14 jam = wow factor)", metric: "128 leads/bln masuk ke top funnel", tc: "text-slate-600", bc: "bg-slate-50 border-slate-200", line: "border-slate-200" },
            { stage: "TRIAL", touchpoint: "Free Intel Briefing 7 hari · Demo call dengan AM · SKK Express quote", emotion: "Penasaran tapi ragu-ragu — 'let me see the value first'", mjpRole: "Onboarding call dalam 24 jam · Briefing pertama yang sangat relevan · AM follow-up di hari 3", metric: "Conv rate trial → paid: 37%", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200", line: "border-blue-200" },
            { stage: "PURCHASE (First 30 hari)", touchpoint: "SKK Express pertama · Pertama buka Intel Briefing · Pertama pakai Radar", emotion: "Excited tapi butuh hasil cepat — 'saya butuh ROI bulan pertama'", mjpRole: "SKK selesai tepat waktu → wow moment · Tender win dari intel = powerful activation moment", metric: "Klien yang dapat 1 tender win di 30 hari pertama: 94% retained di bulan 6", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200", line: "border-emerald-200" },
            { stage: "EXPANSION (3–6 bln)", touchpoint: "AM rekomendasikan paket tambahan · Cross-sell Radar · Co-sell dengan asosiasi", emotion: "Percaya, tapi masih transaksional — 'kalau ada value, saya bayar'", mjpRole: "Personalized insight yang hanya MJP bisa kasih · Show their specific win rate vs market", metric: "38% expand ke produk ke-2 dalam 90 hari", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200", line: "border-emerald-200" },
            { stage: "LOYAL (12+ bln)", touchpoint: "Referral aktif · Jadi case study · Minta fitur baru · Bayar annual", emotion: "Partner — 'MJP adalah bagian dari operasi saya'", mjpRole: "Co-creation: klien ikut test fitur baru · VIP early access · Executive briefing khusus", metric: "Klien 12+ bulan NPS: 81 vs avg 67", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200", line: "border-violet-200" },
          ].map((r, i) => (
            <div key={r.stage} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start gap-3">
                <div className={`shrink-0 w-16 text-center pt-0.5`}>
                  <p className={`text-[8px] font-black font-mono ${r.tc}`}>{r.stage}</p>
                </div>
                <div className="flex-1">
                  <p className="text-[8px] text-muted-foreground mb-0.5">Touchpoint: {r.touchpoint}</p>
                  <p className="text-[8px] italic mb-0.5">Emosi: "{r.emotion}"</p>
                  <p className={`text-[8px] font-mono ${r.tc} mb-0.5`}>MJP role: {r.mjpRole}</p>
                  <p className={`text-[8px] font-bold ${r.tc}`}>📊 {r.metric}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product Pricing Architecture */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> PRICING ARCHITECTURE — Struktur Harga Lengkap Semua Produk MJP dan Logika di Balik Setiap Tier
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { tier: "STARTER", price: "Rp 499rb/bln", products: ["3 Intel Briefing/minggu (12/bln)", "Tender Alert (15 notif/bln)", "Akses Knowledge Base regulasi publik"], targetClient: "BUJK baru atau yang baru coba MJP. Low commitment, prove value dulu.", annualDiscount: "16% (Rp 5.0jt/thn vs Rp 6.0jt)", clients: 84, tc: "text-slate-700", bc: "bg-slate-50 border-slate-200" },
            { tier: "GROWTH", price: "Rp 1.2jt/bln", products: ["Intel Briefing harian (unlimited)", "Tender Alert unlimited + filter canggih", "Radar Kompetitor (top 5 per klien)", "HPS Benchmark akses penuh"], targetClient: "BUJK yang aktif bid 2–5 tender/bln dan butuh intel untuk menang lebih sering.", annualDiscount: "17% (Rp 12jt/thn vs Rp 14.4jt)", clients: 287, tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { tier: "PRO", price: "Rp 2.8jt/bln", products: ["Semua GROWTH +", "SKK Express (2 SKK/bln included)", "Surat Penawaran Assist", "Custom Research (2 riset/bln)", "Priority AM support"], targetClient: "BUJK menengah aktif yang butuh full-service intelligence + SKK management.", annualDiscount: "18% (Rp 27.5jt/thn vs Rp 33.6jt)", clients: 94, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { tier: "ENTERPRISE", price: "Custom (mulai Rp 8jt/bln)", products: ["Semua PRO +", "Dedicated AM + weekly strategy call", "Custom Knowledge Registry", "API access untuk integrasi internal", "Branded compliance PDF monthly"], targetClient: "BUJK besar / holding konstruksi yang butuh platform sebagai core business intelligence.", annualDiscount: "Negotiated per contract", clients: 22, tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
          ].map((r) => (
            <div key={r.tier} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start gap-3 mb-1">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-[10px] font-black font-mono ${r.tc}`}>{r.tier}</p>
                    <p className={`text-[9px] font-bold ${r.tc}`}>{r.price}</p>
                    <span className={`text-[7px] font-mono ${r.tc}`}>{r.clients} klien</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-0.5">
                    {r.products.map(p => <p key={p} className="text-[8px] text-muted-foreground">• {p}</p>)}
                  </div>
                  <p className="text-[8px] italic text-muted-foreground">Target: {r.targetClient}</p>
                </div>
              </div>
              <p className={`text-[8px] font-mono ${r.tc}`}>Annual: {r.annualDiscount}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Revenue mix: Starter 8% · Growth 55% · Pro 27% · Enterprise 10% · Target mix 2027: Growth 45%, Pro 35%, Enterprise 20%</p>
      </div>

      {/* Product Roadmap 2026–2027 */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-violet-500" /> PRODUCT ROADMAP — Produk dan Fitur yang Akan Diluncurkan MJP 12 Bulan ke Depan Berdasarkan Demand dan Strategic Fit
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              quarter: "Q3 2026 (Jul–Sep)", theme: "Foundation Strengthening",
              items: [
                { name: "Entity Resolution v2 (error rate <1%)", type: "IMPROVEMENT", impact: "Data quality — semua produk benefit", status: "IN DEV" },
                { name: "BIM Readiness Assessment Tool (beta 50 klien)", type: "NEW PRODUCT", impact: "Unlock J9 market yang butuh BIM compliance", status: "PLANNED" },
                { name: "Mobile Push Notification (Android first)", type: "IMPROVEMENT", impact: "In-app engagement +40% projected", status: "PLANNED" },
              ],
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              quarter: "Q4 2026 (Okt–Des)", theme: "Market Expansion",
              items: [
                { name: "Freemium Tier (1 Intel Briefing/minggu gratis)", type: "NEW TIER", impact: "Top of funnel acquisition — target 300 new free users", status: "PLANNED" },
                { name: "Sulawesi AM + Regional Coverage Expansion", type: "GO-TO-MARKET", impact: "Unlock 2.800+ BUJK Sulawesi yang belum tersentuh", status: "HIRING" },
                { name: "Surat Penawaran AI Assist v2 (real-time HPS)", type: "IMPROVEMENT", impact: "Upsell path: klien Growth ke Pro +15% projected", status: "PLANNED" },
              ],
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              quarter: "Q1 2027 (Jan–Mar)", theme: "Intelligence Deepening",
              items: [
                { name: "Multi-source Competitor Intel (web + social + LPSE)", type: "IMPROVEMENT", impact: "Radar Kompetitor signal coverage +300%", status: "ROADMAP" },
                { name: "Predictive Win Probability Model v3", type: "AI FEATURE", impact: "Win rate klien aktif target +8pp dari baseline", status: "ROADMAP" },
                { name: "API Platform (Enterprise self-serve integration)", type: "NEW PRODUCT", impact: "Enterprise tier stickiness + new revenue stream", status: "ROADMAP" },
              ],
              tc: "text-violet-700", bc: "bg-violet-50 border-violet-200"
            },
          ].map((r) => (
            <div key={r.quarter} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-1">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.quarter}: {r.theme}</p>
              </div>
              {r.items.map((item) => (
                <div key={item.name} className="flex items-start gap-2 mb-0.5">
                  <span className={`text-[7px] font-mono shrink-0 mt-0.5 ${r.tc}`}>[{item.status}]</span>
                  <div>
                    <span className="text-[8px] font-bold">{item.name}</span>
                    <span className={`text-[7px] font-mono ml-1 ${r.tc}`}>{item.type}</span>
                    <p className="text-[8px] text-muted-foreground">{item.impact}</p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Product Health Dashboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> PRODUCT HEALTH DASHBOARD — Status Kesehatan Setiap Produk MJP: Adoption, Performance, dan Issue yang Perlu Diselesaikan
        </p>
        <div className="flex flex-col gap-2">
          {[
            { product: "Intel Briefing (WhatsApp)", adoption: 487, adoptionPct: "100%", health: "HEALTHY", issues: ["Open rate 89% — di atas benchmark industri 20%", "No critical issues"], tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { product: "Radar Kompetitor", adoption: 183, adoptionPct: "38%", health: "GROWING", issues: ["38% adoption — ruang tumbuh ke 60%+ via campaign", "IjinTender weekend degraded: fix Q3 2026"], tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { product: "SKK Express", adoption: 154, adoptionPct: "32%", health: "NEEDS ATTENTION", issues: ["Completion rate 54% (target: 70%) — 16pp gap", "Drop-off stage 5 (dokumen) belum ada fix deployed"], tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { product: "Knowledge Registry", adoption: 312, adoptionPct: "64%", health: "HEALTHY", issues: ["Fresh rate 78.4% (target: 85%) — 6.6pp gap", "34 assets outdated perlu review manual — Sprint 23 backlog"], tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { product: "Surat Penawaran Assist", adoption: 97, adoptionPct: "20%", health: "UNDERPERFORMING", issues: ["20% adoption vs 40% target", "User feedback: 'terlalu manual, ingin lebih AI-driven'", "Roadmap: AI Assist v2 Q4 2026"], tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { product: "Custom Research", adoption: 47, adoptionPct: "10%", health: "NICHE OK", issues: ["10% adoption expected — ini premium product", "Revenue per research: avg Rp 3.8jt. Unit economics excellent."], tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.product} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-3 mb-0.5">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.product}</p>
                    <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.health}</span>
                  </div>
                  <p className="text-[8px] text-muted-foreground mb-0.5">Adoption: {r.adoption} klien ({r.adoptionPct})</p>
                  {r.issues.map(i => <p key={i} className={`text-[8px] font-mono ${r.tc}`}>• {i}</p>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product Launch Retrospectives */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-primary" /> LAUNCH RETROSPECTIVES — Lessons Learned dari 3 Product Launch Terbesar MJP yang Membentuk Cara Kami Launch Sekarang
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              launch: "Launch #1: Intel Briefing via WhatsApp (Feb 2024)", result: "SUCCESS",
              went_well: ["Open rate 89% dari hari pertama — jauh melebihi ekspektasi", "Klien langsung action dari briefing — 14 tender wins dalam bulan pertama", "WhatsApp = frictionless untuk klien yang tidak mau install app baru"],
              went_wrong: ["Tidak ada opt-out flow awal → 3 klien block MJP → WhatsApp account hampir kena ban", "Konten terlalu generik di bulan pertama — sebelum personalization siap"],
              lesson: "Delivery channel harus match habit klien. WhatsApp Indonesia = gold. Tapi opt-out/unsubscribe wajib dari hari pertama.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              launch: "Launch #2: SKK Express (Jun 2024)", result: "SLOW START → SUCCESS",
              went_well: ["Setelah onboarding yang diperbaiki, completion rate naik dari 31% ke 54%", "AM Sulawesi referral menjadi channel akuisisi terbesar untuk SKK Express"],
              went_wrong: ["Harga awal Rp 2.5jt terlalu tinggi — 60% prospect drop di pricing page", "Tidak ada clear 'what happens step by step' guide — klien takut dokumen salah"],
              lesson: "Price sensitivity lebih tinggi dari yang kami expect untuk BUJK kecil. Harus ada transparent step-by-step sebelum klien commit uang.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              launch: "Launch #3: Radar Kompetitor (Oct 2024)", result: "BELOW EXPECTATIONS",
              went_well: ["Klien yang pakai secara konsisten mencapai 3.8/5 satisfaction rating", "Feature paling sering di-screenshot dan di-share ke rekan bisnis"],
              went_wrong: ["Adoption hanya 38% — 62% klien tidak pernah buka fitur ini", "Launch announcement terlalu technical ('real-time competitor tracking') bukan benefit-first", "No onboarding flow — klien buka, tidak mengerti cara pakainya, tutup, tidak buka lagi"],
              lesson: "Adoption < announcement. Setiap launch butuh: dedicated onboarding email + in-app walkthrough + 1-on-1 AM demo untuk klien high-value.",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
          ].map((r) => (
            <div key={r.launch} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-1">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.launch}</p>
                <span className={`text-[7px] font-mono font-bold ${r.tc}`}>{r.result}</span>
              </div>
              <div className="grid grid-cols-2 gap-1 mb-1">
                <div><p className="text-[8px] font-bold text-emerald-700">✓ Went well:</p>{r.went_well.map((w, i) => <p key={i} className="text-[8px] text-muted-foreground">• {w}</p>)}</div>
                <div><p className="text-[8px] font-bold text-red-700">✗ Went wrong:</p>{r.went_wrong.map((w, i) => <p key={i} className="text-[8px] text-muted-foreground">• {w}</p>)}</div>
              </div>
              <p className={`text-[9px] font-mono font-bold ${r.tc}`}>Lesson: {r.lesson}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Product Onboarding Flow */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ArrowRight className="h-3.5 w-3.5 text-primary" /> ONBOARDING FLOW — Perjalanan Klien Baru dari Daftar sampai Menjadi Power User dalam 30 Hari Pertama
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { day: "Hari 1: Welcome + Setup", actions: ["Email selamat datang + login instructions", "AM proactive WA: 'Selamat bergabung, ini 3 hal yang perlu Anda setup hari ini'", "Profile completion: kategori pekerjaan, wilayah, grade BUJK"], completionRate: "94%", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { day: "Hari 2: First Intel Briefing", actions: ["Klien terima Intel Briefing pertama (personalized berdasarkan profile)", "In-app tooltip: 'Ini adalah briefing harian Anda — ini mengapa setiap item relevan untuk Anda'", "CTA: 'Lihat tender terbaik hari ini'"], completionRate: "87%", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { day: "Hari 7: Feature Discovery", actions: ["Email: 'Sudah tahu 3 fitur ini? Banyak klien belum gunakan dan rugi'", "Highlight: Radar Kompetitor, HPS Benchmark, Knowledge Registry", "AM check-in call (khusus Pro/Enterprise tier)"], completionRate: "71%", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { day: "Hari 14: First Win Moment", actions: ["Jika klien menang tender: automatic celebration WA + case study invite", "Jika belum menang: email 'Ini yang klien lain lakukan berbeda — tips from top performers'", "Re-engagement untuk klien yang belum buka briefing 5+ hari berturut"], completionRate: "58%", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { day: "Hari 30: Check-in + Upsell Signal", actions: ["Survey NPS (3 pertanyaan, <2 menit)", "AM review: apakah klien qualify untuk upgrade ke Pro?", "Jika NPS <7: immediate escalation ke Sari atau Hendra untuk investigation"], completionRate: "44%", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.day} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.day}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ${r.tc}`}>Completion: {r.completionRate}</span>
              </div>
              {r.actions.map((a, i) => <p key={i} className="text-[8px] text-muted-foreground">• {a}</p>)}
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Drop-off terbesar: Hari 7→14 (71%→58% = -13pp). Root cause: klien tidak act setelah feature discovery. Fix: add in-app guided activation checklist di hari ke-10.</p>
      </div>

      {/* Product Feedback Loop */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-primary" /> PRODUCT FEEDBACK LOOP — Bagaimana MJP Mengumpulkan, Memprioritaskan, dan Merespons Feedback Produk dari 487 Klien Aktif?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] font-mono font-bold mb-1">Saluran Feedback yang Aktif:</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {[
              { channel: "Monthly NPS Survey", volume: "287 responses/bln", quality: "HIGH — structured, segmented", action: "NPS <7: immediate AM follow-up. Detractors: personal call dari Hendra.", tc: "text-emerald-700" },
              { channel: "In-app 'Laporkan Masalah'", volume: "43 reports/bln avg", quality: "HIGH — specific, actionable", action: "Hendra review every Monday. Categorized by severity. P0 fix dalam 24 jam.", tc: "text-emerald-700" },
              { channel: "AM field notes di Workroom", volume: "~300 notes/bln", quality: "MEDIUM — informal, needs curation", action: "Sari curate monthly. Top themes → Product backlog.", tc: "text-blue-700" },
              { channel: "WhatsApp group klien (informal)", volume: "~150 messages/bln", quality: "LOW — mixed signal, noise heavy", action: "Reza monitors, elevate interesting feedback ke AM notes.", tc: "text-orange-700" },
            ].map((r) => (
              <div key={r.channel} className="border rounded-sm p-2 bg-muted/20">
                <p className={`text-[8px] font-bold ${r.tc}`}>{r.channel}</p>
                <p className="text-[7px] text-muted-foreground">{r.volume} · Quality: {r.quality}</p>
                <p className={`text-[7px] font-mono ${r.tc}`}>{r.action}</p>
              </div>
            ))}
          </div>
          <div className="border rounded-sm p-3 bg-emerald-50 border-emerald-200">
            <p className="text-[9px] font-bold text-emerald-700 mb-1">Top 5 Feature Requests Jul 2026 (dari NPS survey):</p>
            {[
              "Export data ke Excel (447 votes) — IN SPRINT 23",
              "ListFilter sebelum export (341 votes) — IN SPRINT 23",
              "Preview PDF briefing di browser sebelum kirim (289 votes) — PROPOSED",
              "Share detail kontraktor via WhatsApp langsung (267 votes) — PROPOSED",
              "Dark mode untuk mobile app (198 votes) — BACKLOG Q4",
            ].map((f, i) => <p key={i} className="text-[8px] text-muted-foreground">#{i+1} {f}</p>)}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Feedback loop adalah competitive advantage — produk yang di-build berdasarkan 487 active voices lebih relevant dari yang di-build dari assumptions.</p>
      </div>

      {/* Product Pricing Psychology */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> PRICING PSYCHOLOGY — Prinsip Psikologi yang Digunakan MJP dalam Merancang Pricing agar Terasa Wajar dan Mendorong Upsell
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              principle: "Anchoring: Enterprise tier terlihat di pricing page meski 80% klien beli Growth",
              application: "Enterprise Rp 7.2jt membuat Pro Rp 2.8jt terasa 'reasonable'. Tanpa Enterprise anchor, Pro adalah harga paling mahal dan psikologis terasa berat.",
              result: "Pro conversion 23% lebih tinggi setelah Enterprise tier ditampilkan di pricing page.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              principle: "Loss Framing: Bukan 'upgrade untuk dapat fitur' tapi 'Anda kehilangan Rp X setiap bulan tanpa ini'",
              application: "AM pitch ke Growth tier: 'Tanpa Pre-Bid Intel Brief, rata-rata klien kami meninggalkan Rp 840rb/bln di meja' (12pp win rate × avg kontrak × berapa bid/bln).",
              result: "Loss-framing pitch vs gain-framing: 31% vs 19% upgrade conversation rate.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              principle: "Decoy: Growth tier didesain sebagai 'sweet spot' yang paling value-dense",
              application: "Starter cukup untuk trial tapi clearly limited. Enterprise terlalu mahal untuk BUJK kecil. Growth = 'just right' secara psikologis dan financially.",
              result: "71% klien pilih Growth. Exactly as intended — this is the highest-margin tier.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              principle: "Social Proof: '347 BUJK di wilayah Anda sudah pakai MJP' lebih powerful dari feature list",
              application: "AM pitch dibuka dengan regional social proof bukan generic. '12 BUJK J8 di Semarang sudah menggunakan MJP, win rate mereka rata-rata 34%' vs generic 'kami punya 487 klien'.",
              result: "Regional social proof opening: 2.4× lebih sering menghasilkan next meeting.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
          ].map((r) => (
            <div key={r.principle} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.principle}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.application}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>Result: {r.result}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Pricing psychology bukan manipulation — ini adalah helping clients make decisions that are good for them. Jika produk genuinely delivers ROI, facilitating the decision is a service.</p>
      </div>

      {/* Feature Priority Scoring */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> FEATURE PRIORITY SCORING — Bagaimana Tim Product MJP Memutuskan Fitur Mana yang Dikerjakan Duluan dari 80+ Backlog Items?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] font-mono text-muted-foreground mb-1">Setiap feature request di-score berdasarkan 4 dimensi (1–5 each), total max 20:</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            {[
              { dim: "Impact", desc: "Berapa klien yang benefit, berapa besar?", tc: "text-emerald-700" },
              { dim: "Confidence", desc: "Seberapa yakin kita ini solusinya?", tc: "text-blue-700" },
              { dim: "Ease", desc: "Seberapa mudah dibangun? (inverted)", tc: "text-orange-700" },
              { dim: "Strategy Fit", desc: "Apakah align dengan arah product?", tc: "text-violet-700" },
            ].map((r) => (
              <div key={r.dim} className="border rounded-sm p-2 bg-muted/20">
                <p className={`text-[8px] font-bold ${r.tc}`}>{r.dim}</p>
                <p className="text-[7px] text-muted-foreground">{r.desc}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-[8px] font-bold mb-0.5">Current sprint candidate scores (Q3 2026):</p>
            {[
              { feature: "Export Excel + ListFilter", impact: 5, conf: 5, ease: 4, strat: 4, total: 18, status: "IN SPRINT 23", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
              { feature: "Mobile: WA share kontraktor", impact: 4, conf: 4, ease: 4, strat: 4, total: 16, status: "IN SPRINT 23", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
              { feature: "PDF briefing preview browser", impact: 3, conf: 4, ease: 4, strat: 3, total: 14, status: "PROPOSED", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
              { feature: "Entity resolution ML upgrade", impact: 5, conf: 3, ease: 2, strat: 5, total: 15, status: "BACKLOG Q4", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
              { feature: "Pre-Bid Capital Calculator", impact: 4, conf: 4, ease: 4, strat: 4, total: 16, status: "SCOPING", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
              { feature: "WhatsApp group BUJK community", impact: 3, conf: 2, ease: 2, strat: 3, total: 10, status: "REJECTED", tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
            ].map((r) => (
              <div key={r.feature} className={`flex items-center gap-2 border rounded-sm p-2 ${r.bc}`}>
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.feature}</p>
                <div className="flex gap-1 shrink-0 text-[7px] font-mono">
                  <span className="text-muted-foreground">I:{r.impact} C:{r.conf} E:{r.ease} S:{r.strat}</span>
                  <span className={`font-bold ${r.tc}`}>=&nbsp;{r.total}</span>
                  <span className={r.tc}>{r.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">RICE score framework ensures no single person's instinct drives the roadmap. Setiap quarter, Hendra + Sari + Reza independently score, then average. Outlier scores dibahas.</p>
      </div>

      {/* Product-Led Growth Engine */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-violet-500" /> PRODUCT-LED GROWTH — Bagaimana Produk MJP Dirancang agar Klien Mengundang Klien Baru secara Organik?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              mechanism: "Intel Briefing Forward",
              how: "Klien bisa forward Intel Briefing ke rekan BUJK dengan 1 klik. Briefing yang di-forward menyertakan pesan: 'Dikirim dari [Nama Klien] via MJP Platform' + CTA ke free trial.",
              data: "847 forwards 2026 YTD. 34% yang menerima forward klik CTA. 18% convert ke free trial. 11% convert ke paying (30-day). Acquisition cost: ~Rp 230rb (vs Rp 890rb via ads).",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              mechanism: "Contractor Directory Public Preview",
              how: "Bagian dari direktori kontraktor bisa diakses tanpa login (versi terbatas). Klien yang share link profil kontraktor ke rekan mereka = link masuk ke MJP branded page dengan CTA.",
              data: "3.400 unique public directory views/bln. 12% klik 'Lihat Lengkap' (require login/register). 8% register. 4% convert ke paid.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              mechanism: "Tender Alert Share",
              how: "Klien bisa share tender spesifik ke WhatsApp kontak mereka via tombol share. Shared link membuka MJP tender preview page dengan teaser data + CTA.",
              data: "1.247 shares/bln. Shared via WA 94%. 22% recipients klik link. 7% register. 3% become paying klien.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              mechanism: "Champion Referral Program",
              how: "Klien yang refer paying klien baru mendapat 1 bulan gratis per referral yang convert. Tracked via unique referral code. AM Reza identify champions dan onboard mereka ke program.",
              data: "47 active champions (klien yang pernah refer setidaknya 1). 134 referrals YTD. 89 convert ke paid. Cost per acquisition via champion: ~Rp 125rb (best channel).",
              tc: "text-violet-700", bc: "bg-violet-50 border-violet-200"
            },
          ].map((r) => (
            <div key={r.mechanism} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.mechanism}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.how}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>Data: {r.data}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">PLG total contribution: 43% of new client acquisition is product-led (zero or near-zero cost). Target: 55% PLG by Q4 2026. Each PLG mechanism reinforces the others — network effect building.</p>
      </div>

      {/* Product Demo Script */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MessageCircle className="h-3.5 w-3.5 text-primary" /> DEMO SCRIPT — Kata Per Kata yang Paling Effective untuk Demonstrasikan MJP ke Prospect J8 dalam 20 Menit
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              segment: "Opening Hook (0–2 menit)",
              script: "\"Sebelum saya tunjukkan apapun — boleh saya tanya: tender terakhir yang Bapak/Ibu ikut, tahu tidak siapa yang akhirnya menang dan berapa harga yang mereka tawarkan?\"",
              why: "95% prospect menjawab 'tidak'. Ini membuka pain point langsung. Mereka baru realize bahwa mereka telah bid blind selama ini.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              segment: "The Aha Moment (8–12 menit)",
              script: "\"Coba kita cek tender [kategori yang mereka bilang di awal]. Di sini... ada 4 BUJK yang kemungkinan akan ikut. Yang ini — CV Karya Sejati — dalam 6 bulan terakhir mereka average -6.2% dari HPS. Jadi kalau HPS-nya Rp 10M, mereka kemungkinan bid Rp 9.38M. Sekarang kita bisa kalkulasi: berapa yang Bapak harus bid agar menang tapi tetap profitable?\"",
              why: "Ini momen platform menunjukkan value yang tidak ada di tools lain. Prospect biasanya berhenti sejenak dan bilang 'wah, ini berguna'.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              segment: "Objection Handler: 'Harganya terlalu mahal'",
              script: "\"Boleh kita hitung sama-sama? Rata-rata klien kami menang 10–12 poin persen lebih sering. Untuk Bapak yang average 2 tender per bulan dengan nilai rata-rata Rp 5M — 10pp lebih banyak menang = berapa kontrak tambahan per tahun? Subscription Rp 1.5jt per bulan vs nilai itu... berapa lama break-even?\"",
              why: "Jadikan mereka yang hitung, bukan kita yang klaim. ROI yang mereka hitung sendiri jauh lebih convincing.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              segment: "Close (18–20 menit)",
              script: "\"Saya tidak minta keputusan sekarang. Yang saya sarankan: coba 30 hari gratis, tidak perlu kartu kredit. Kalau dalam 30 hari tidak ada tender yang lebih actionable dari biasanya — tidak usah lanjut. Tapi kalau ada... Bapak sudah tahu nilainya.\"",
              why: "Soft close with reversibility. Reduces purchase anxiety. Our data: 74% of 30-day trials convert.",
              tc: "text-violet-700", bc: "bg-violet-50 border-violet-200"
            },
          ].map((r) => (
            <div key={r.segment} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-1`}>{r.segment}</p>
              <p className="text-[8px] italic mb-0.5">{r.script}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Why it works: {r.why}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Content Marketing Machine */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" /> CONTENT MARKETING ENGINE — Konten yang MJP Produksi untuk Awareness dan Lead Generation tanpa Bergantung pada Iklan Berbayar
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { format: "Weekly LinkedIn Post — Sari's Market Insight Thread", freq: "Setiap Selasa 08:00", content: "3–5 tweet-thread about construction market intelligence: 'Ini yang berubah minggu ini dan artinya untuk BUJK J8'. Data-driven, specific, actionable.", metrics: "Avg 2.400 impressions per post. 12% klick-through. 4.2% DM follow-up yang convert ke demo.", effort: "Sari 45 menit/minggu", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { format: "Monthly Webinar — 'Tender Intelligence Briefing'", freq: "Hari Rabu pertama tiap bulan, 19:00", content: "45 menit: market recap, regulatory updates, 3 tactical tips for the month ahead. Free to attend. CTA: 30-day trial for attendees.", metrics: "Avg 112 attendees. 34 trial sign-ups per webinar. 18% convert ke paying. CAC: Rp 180rb.", effort: "Sari 2h prep, Hendra 1h promotion, webinar platform Rp 250rb/bln", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { format: "Case Study — Klien yang Menang Tender Besar", freq: "1 per bulan", content: "Story: siapa kliennya, tender apa, intel apa yang dipakai, hasilnya. Dengan data nyata (klien approve). 600–800 kata format blog + infographic.", metrics: "3 case studies = top 3 ranking untuk 'cara menang tender LPSE' di Google. 340 organic visits/bln.", effort: "Reza 1h interview, Dewi 2h writing, Hendra 30min approve", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { format: "WhatsApp Broadcast — 'Tender Alert Mingguan'", freq: "Setiap Jumat 16:00", content: "5 tender terpilih minggu depan yang menarik untuk BUJK umum. Non-subscriber broadcast untuk lead gen. Link ke demo untuk tender detail.", metrics: "3.200 subscriber. 67% open rate. 8.4% click CTA. Rp 0 cost (WhatsApp Business API).", effort: "Dewi 30 menit/minggu untuk curation", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
          ].map((r) => (
            <div key={r.format} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.format}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.freq}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.content}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>{r.metrics}</p>
              <p className="text-[7px] text-muted-foreground">Effort: {r.effort}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total content marketing cost: {'<'}Rp 1.5jt/bln (platform tools). Total attributed leads 2026 YTD: 847 from content. 94 convert ke paid. Avg CAC from content: Rp 160rb vs Rp 890rb paid ads.</p>
      </div>

      {/* Feature Backlog Priority Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-primary" /> PRODUCT BACKLOG — 10 Fitur Paling Banyak Diminta Klien MJP yang Belum Ada, Diurutkan berdasarkan Nilai vs Effort Matrix
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { feature: "Mobile app push notification untuk tender baru", requests: 147, effort: "LOW", value: "HIGH", quarter: "Q4 2026", rationale: "Klien di lapangan tidak selalu buka browser. Push notification = 3× faster response to opportunities.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { feature: "Bulk import tenaga ahli SKK dari Excel", requests: 89, effort: "LOW", value: "MEDIUM", quarter: "Q4 2026", rationale: "Enterprise klien punya 20–50 tenaga ahli. Manual entry adalah real friction point.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { feature: "Saved searches dengan auto-alert", requests: 134, effort: "MEDIUM", value: "HIGH", quarter: "Q1 2027", rationale: "Klien sudah punya saved filter preferences — just want alerts when new matches appear.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { feature: "Head-to-head competitor comparison modal", requests: 78, effort: "MEDIUM", value: "HIGH", quarter: "Q1 2027", rationale: "Side-by-side compare 2 BUJK across all metrics. Currently only available in custom research.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { feature: "Historical win/loss untuk kompetitor spesifik", requests: 112, effort: "LOW", value: "HIGH", quarter: "Q1 2027", rationale: "38K historical records already in DB. Just need UI to surface per-competitor trend.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { feature: "Document template library (admin, teknis, penawaran)", requests: 94, effort: "MEDIUM", value: "HIGH", quarter: "Q2 2027", rationale: "Klien want templates, not just information. Reduces document prep time 60%.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.feature} className={`flex items-center gap-2 border rounded-sm p-2 ${r.bc}`}>
              <div className="flex-1">
                <div className="flex gap-2 items-center mb-0.5">
                  <p className={`text-[9px] font-bold ${r.tc}`}>{r.feature}</p>
                  <span className={`text-[7px] font-mono ${r.tc}`}>{r.quarter}</span>
                </div>
                <p className="text-[8px] text-muted-foreground">{r.rationale}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-[7px] font-mono ${r.tc}`}>{r.requests} requests</p>
                <p className={`text-[7px] font-mono ${r.tc}`}>E:{r.effort} V:{r.value}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Prioritization: Value/Effort score. Everything Q4 2026 is LOW effort HIGH value — quick wins before year-end. Hendra reviews backlog setiap sprint planning (bi-weekly). Klien requests logged dari AM notes + in-app feedback.</p>
      </div>

      {/* Enterprise Product Differentiation */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Award className="h-3.5 w-3.5 text-amber-500" /> ENTERPRISE TIER DEEP DIVE — Mengapa Enterprise Klien Membayar 2.8× lebih Mahal dari Growth dan Apa Bedanya Secara Konkret?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Feature</th>
                  <th className="p-1 text-center">Starter (Rp 800rb)</th>
                  <th className="p-1 text-center">Growth (Rp 1.5jt)</th>
                  <th className="p-1 text-center text-amber-600">Enterprise (Rp 4.2jt)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Knowledge Registry access", "Top 50 assets only", "Full access (5.200+)", "Full + advance preview"],
                  ["Intel Briefing", "Weekly summary", "Daily personalized", "Daily + Quarterly strategic"],
                  ["Tender monitoring", "National", "National + Regional", "Custom watchlist + API"],
                  ["Competitor analysis", "Top 5 per category", "20 competitors tracked", "Unlimited + custom alerts"],
                  ["Custom research requests", "None", "2/quarter", "Unlimited (priority queue)"],
                  ["Account Manager access", "Self-serve only", "Reza (shared)", "Dedicated AM (Reza + Sari)"],
                  ["SKK Express", "Standard SLA", "Standard SLA", "Priority SLA (3-day guarantee)"],
                  ["Historical data depth", "12 months", "36 months", "Full 5 years"],
                  ["Multi-user seats", "1 user", "3 users", "10 users + admin dashboard"],
                  ["Quarterly Business Review", "None", "None", "Yes (Hendra attends)"],
                ].map(([feat, s, g, e], i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{feat}</td>
                    <td className="p-1 text-center text-muted-foreground">{s}</td>
                    <td className="p-1 text-center">{g}</td>
                    <td className="p-1 text-center font-bold text-amber-600">{e}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Enterprise = relationship product, not just data. Dedicated AM + QBR with Hendra = klien feel invested in. 51 Enterprise klien: avg tenure 22 months vs 14 months for Growth. Highest LTV segment by far.</p>
      </div>

      {/* Onboarding Experience Design */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> ONBOARDING DESIGN — Perjalanan Klien Baru MJP dari Hari 1 Hingga Hari 30: Setiap Touchpoint yang Menentukan Apakah Mereka Akan Convert ke Paying
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { day: "Hari 1", event: "Welcome email + WA dari Reza", content: "Subject: 'Selamat bergabung — saya Reza, AM Anda.' Isi: 3 hal yang perlu dicoba hari ini, link ke profile setup, jadwal onboarding call opsional.", objective: "First impression. Make them feel known personally, not just another signup.", tc: "text-blue-700" },
            { day: "Hari 2–3", event: "Automated Onboarding Sequence (email)", content: "Email 1: 'Cara menemukan tender yang relevan untuk Anda' — tutorial 3 menit video. Email 2: 'Mengapa Win Rate Anda mungkin rendah — dan cara fix-nya'.", objective: "Drive first meaningful platform action within 48 hours.", tc: "text-blue-700" },
            { day: "Hari 7", event: "Reza check-in WA", content: "'Sudah sempat explore platform? Ada yang bisa saya bantu? Coba cek [feature] untuk [their specific business category].'", objective: "Personal touch + product adoption nudge. Detect low-engagement early.", tc: "text-emerald-700" },
            { day: "Hari 14", event: "First Intel Briefing review call (opsional, 15 menit)", content: "Reza walks through last week's briefing: 'Ini yang relevant untuk kategori Bapak/Ibu. Ada tender yang menarik? Mau saya elaborate?'", objective: "Show platform value concretely. Convert passive reader to active user.", tc: "text-emerald-700" },
            { day: "Hari 21", event: "Usage milestone email", content: "If high engagement: 'You're ahead of 84% of new MJP users!' + tip to unlock next level. If low engagement: 'Kelihatannya ada feature yang belum sempat di-explore...' + Reza follow-up.", objective: "Reinforcement for engaged. Intervention trigger for at-risk.", tc: "text-orange-700" },
            { day: "Hari 28–30", event: "Conversion decision point", content: "Reminder: trial ending in 3 days. Reza personal WA: 'Harga di bulan pertama + satu bulan bonus untuk Growth klien baru.' Time-limited offer. No high pressure.", objective: "74% of trial users convert. This day = 26% that need a reason.", tc: "text-violet-700" },
          ].map((r) => (
            <div key={r.day} className="flex gap-2 items-start border-b pb-1.5 pt-0.5">
              <span className="text-[8px] font-bold text-primary w-14 shrink-0">{r.day}</span>
              <div className="flex-1">
                <p className="text-[8px] font-bold mb-0.5">{r.event}</p>
                <p className="text-[8px] text-muted-foreground mb-0.5">{r.content}</p>
                <p className={`text-[8px] font-mono ${r.tc}`}>Goal: {r.objective}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Onboarding sequence automation in development (Sprint 24+). Currently 40% manual effort by Reza. When automated: Reza's onboarding time drops 70% → freed for higher-value Enterprise activities.</p>
      </div>

      {/* Product Market Fit Signals */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> PRODUCT-MARKET FIT SIGNALS — Kumpulan Bukti Kualitatif dan Kuantitatif bahwa MJP Sudah Mencapai PMF yang Sesungguhnya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            {[
              { signal: "Sean Ellis Test Result", value: "74% 'Very Disappointed'", benchmark: "PMF = {'>'} 40%", interpretation: "Klien yang ditanya 'how would you feel if you could no longer use MJP?' — 74% memilih 'very disappointed'. Benchmark PMF = 40%. MJP: 74%. Strong PMF.", tc: "text-emerald-700" },
              { signal: "NPS Score (Q2 2026)", value: "NPS +67", benchmark: "SaaS median = +31", interpretation: "Promoters 78%, Detractors 11%. NPS +67. Best-in-class SaaS averages +31. MJP at 2.2× benchmark.", tc: "text-emerald-700" },
              { signal: "Organic Referral Rate", value: "17% of new klien", benchmark: "Typical SaaS = 8%", interpretation: "Without formal program: 17% of signups dari referral. Above average for B2B Indonesia market.", tc: "text-blue-700" },
              { signal: "Renewal Rate", value: "87% monthly, 79% annual", benchmark: "Good SaaS = 80%+", interpretation: "Monthly: best-in-class. Annual: target 85% by Q4 2026. Exit survey: 76% cite 'platform transition overhead' not dissatisfaction.", tc: "text-blue-700" },
            ].map((r) => (
              <div key={r.signal} className="border rounded-sm p-2.5 bg-muted/10">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[8px] font-bold flex-1">{r.signal}</p>
                  <span className={`text-[8px] font-mono font-black shrink-0 ${r.tc}`}>{r.value}</span>
                </div>
                <p className={`text-[7px] font-mono ${r.tc} mb-0.5`}>vs benchmark: {r.benchmark}</p>
                <p className="text-[7px] text-muted-foreground">{r.interpretation}</p>
              </div>
            ))}
          </div>
          <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200">
            <p className="text-[9px] font-bold text-emerald-700">Qualitative Signal (hardest to fake):</p>
            <p className="text-[8px]">Budi, Sari, dan Reza all report the same thing: klien call them when they WIN. "Pak Reza, kami menang tender Gedung Dinas Rp 4.2M! Terima kasih intel MJP-nya." These unprompted win calls happen 4–8 times per month. This is PMF.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">PMF declared tidak berarti done. Product-market fit is not a switch — it's a gradient. MJP has it for core use cases. Still building fit for newer features (Recommendation Engine at 61% action rate = still finding its product-market fit).</p>
      </div>

      {/* Output Product Quality Standards */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> OUTPUT QUALITY GATE — Kriteria Minimum yang Harus Dipenuhi Setiap Produk/Laporan Sebelum Dikirim ke Klien dan Bagaimana Sari Memvalidasi?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Setiap output yang keluar dari MJP — briefing, pre-bid brief, research report, regulatory alert — harus lolos quality gate sebelum delivery. Checklist Sari:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            {[
              { gate: "Factual Accuracy Check", criteria: "Setiap klaim yang bisa diverifikasi → harus ada source citation dengan tanggal. Claims yang tidak bisa dicite → clearly labeled sebagai 'MJP estimates' or 'field observation'.", mandatory: true },
              { gate: "Staleness Check", criteria: "Semua data mempunyai tanggal. Data > expiry threshold (per type) tidak boleh digunakan tanpa freshness disclaimer. Automated check via metadata.", mandatory: true },
              { gate: "Actionability Check", criteria: "Setiap section harus memiliki minimal 1 konkret action item. 'Market is uncertain' without recommendation = failed gate. Sari's rule: if I can't act on it, client can't either.", mandatory: true },
              { gate: "Sari Final Sign-off", criteria: "All L1 alerts, pre-bid briefs, quarterly reports require Sari personal sign-off (digital signature + date). Deliverable shows 'Reviewed by Sari, Research Lead'.", mandatory: true },
              { gate: "Readability Score", criteria: "Target: readable in < 5 minutes for summary, < 20 minutes for full report. Dewi does readability check: 'If I was a BUJK klien, what would confuse me here?'", mandatory: false },
            ].map((r) => (
              <div key={r.gate} className={`border rounded-sm p-2.5 ${r.mandatory ? "bg-emerald-50 border-emerald-200" : "bg-muted/10"}`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <CircleCheck className={`h-3 w-3 ${r.mandatory ? "text-emerald-600" : "text-muted-foreground"}`} />
                  <p className={`text-[8px] font-bold ${r.mandatory ? "text-emerald-700" : ""}`}>{r.gate} {r.mandatory && "(MANDATORY)"}</p>
                </div>
                <p className="text-[7px] text-muted-foreground">{r.criteria}</p>
              </div>
            ))}
          </div>
          <div className="border rounded-sm p-2 bg-orange-50 border-orange-200">
            <p className="text-[9px] font-bold text-orange-700">Current gate violation rate: 3.1%</p>
            <p className="text-[8px]">21 violations in 677 outputs (Q2 2026). All were caught in internal review before delivery. 0 client complaints about quality this quarter. Gate investment: 8% of production time = 100% complaint prevention.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Quality gate tidak boleh ditinggalkan saat ada rush. Pernah satu kali: L1 alert delivered tanpa check karena tekanan waktu. Klien forward ke auditor LPJK → error found. Malu publik + satu Enterprise non-renewal. Lesson: gate takes 15 menit; reputation takes years.</p>
      </div>

      {/* Product Roadmap Governance */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-primary" /> ROADMAP GOVERNANCE — Siapa yang Memutuskan Apa yang Masuk ke Roadmap MJP dan Bagaimana Proses Prioritisasi Berlangsung dengan 1 Developer?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Decision framework: every feature request goes through 5 gates before entering sprint backlog:</p>
          {[
            { gate: "Gate 1: Source Validation", criteria: "Apakah request ini datang dari > 3 Enterprise klien ATAU > 15 Growth klien ATAU dari pain point database (score > 7) ATAU dari Hendra strategic judgment? If none: rejected immediately.", owner: "Reza (client requests), Sari (research-driven)", tc: "text-blue-700" },
            { gate: "Gate 2: Revenue Impact Estimation", criteria: "Apakah ini bisa: meningkatkan conversion (> +5%), meningkatkan retention (> +2 months avg tenure), enable upsell (> 10% tier upgrade), OR create new revenue line? If unclear: defer.", owner: "Hendra (judgment call, < 15 menit)", tc: "text-blue-700" },
            { gate: "Gate 3: Effort Estimate", criteria: "Hendra Jr. estimates: S (< 3 days), M (3–10 days), L (10–25 days), XL (> 25 days). XL requires explicit Hendra approval + external justification.", owner: "Hendra Jr. (technical judgment)", tc: "text-orange-700" },
            { gate: "Gate 4: Dependency Check", criteria: "Apakah feature ini requires: new data source, schema change, third-party API? Each dependency = risk multiplier. High dependency count → prioritize lower-dependency items first.", owner: "Hendra + Hendra Jr. joint", tc: "text-orange-700" },
            { gate: "Gate 5: Sprint Slot Allocation", criteria: "Sprint capacity: 4–6 items per sprint. Items ordered by: P0 (bugs/SLA breaches) → P1 (revenue-blocking) → P2 (growth) → P3 (nice-to-have). Only top 4–6 items enter sprint.", owner: "Hendra (final authority, bi-weekly)", tc: "text-emerald-700" },
          ].map((r, i) => (
            <div key={r.gate} className="flex gap-2 items-start border-b pb-1.5">
              <span className={`text-[8px] font-black w-4 shrink-0 ${r.tc}`}>{i + 1}.</span>
              <div className="flex-1">
                <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.gate} — {r.owner}</p>
                <p className="text-[8px] text-muted-foreground">{r.criteria}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Process sounds heavy — takes 30 menit total for most items. Prevents: building features nobody uses, scope creep, developer burnout from constant reprioritization. Hendra's job: protect Hendra Jr.'s focus. Protected focus = double the output per hour.</p>
      </div>

      {/* Product Retirement Policy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Archive className="h-3.5 w-3.5 text-muted-foreground" /> PRODUCT RETIREMENT — Bagaimana MJP Memutuskan Kapan Sebuah Fitur Harus Dihentikan dan Apa Saja yang Sudah Pernah Diretire?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Retirement criteria (fitur masuk kandidat sunset jika memenuhi {"≥"} 3 dari 4):</p>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {[
              { crit: "Usage < 5% of active users in last 90 days", why: "Most products die from neglect, not competition." },
              { crit: "No Enterprise client uses it", why: "Enterprise retention is priority — if even they don't use it, nobody will." },
              { crit: "Maintenance cost > revenue attributed", why: "Tech debt from unused features is compounding cost." },
              { crit: "Newer feature solves same need better", why: "Duplication = confusion. Remove the older version." },
            ].map((r) => (
              <div key={r.crit} className="border rounded-sm p-1.5 bg-orange-50 border-orange-200">
                <p className="text-[7px] font-bold text-orange-700">{r.crit}</p>
                <p className="text-[7px] text-muted-foreground">{r.why}</p>
              </div>
            ))}
          </div>
          <div className="border rounded-sm p-2.5 bg-muted/10 mb-1">
            <p className="text-[9px] font-bold mb-0.5">Already Retired (3 features):</p>
            {[
              ["BUJK 'Request Quote' feature (2024)", "Only 11 uses in 6 months. Replaced by Surat Penawaran Advisor which solved same need better."],
              ["'Industry News' tab (2023)", "Generic news not differentiated from free sources. Users ignored it. Replaced by Sinyal Pasar which is curated + analyzed."],
              ["'My Calendar' integration (2022)", "Google Calendar sync for tender deadlines. Maintenance cost high, usage 3.2%. Dropped for in-app deadline tracking."],
            ].map(([feat, reason]) => (
              <div key={feat} className="border-b py-0.5">
                <p className="text-[7px] font-bold">{feat}</p>
                <p className="text-[7px] text-muted-foreground">{reason}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Retiring features is as important as shipping new ones. Dead features = dead weight in codebase (maintenance cost, testing burden, onboarding confusion). Rule: when in doubt, redirect → don't delete (show 'this feature moved to X'). Giving users a path forward prevents churn from sudden removal.</p>
      </div>

      {/* Client Onboarding Journey */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Compass className="h-3.5 w-3.5 text-primary" /> ONBOARDING JOURNEY — Perjalanan Klien Baru MJP dari Daftar hingga 'Aha Moment': 30 Hari Pertama yang Menentukan Retensi Jangka Panjang
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { day: "Hari 1 — Welcome", what: "Reza sends personal WA welcome. Platform access granted. Dewi sends 'Quick Start' link (3 setup steps: configure watchlist, set alert preferences, complete BUJK profile).", metric: "Target: watchlist configured within 24 jam. 71% achieve this.", tc: "text-blue-700" },
            { day: "Hari 2–3 — First Intel", what: "System sends first 3 personalized alerts based on watchlist. 'You have 4 relevant tenders this week' email. Sari's daily briefing starts landing in inbox.", metric: "Target: klien opens at least 1 alert. 84% do. Those who don't: Reza follow-up call on Day 4.", tc: "text-blue-700" },
            { day: "Hari 7 — First Check-in", what: "Reza calls (<10 menit). 3 questions: 'Did alerts feel relevant?', 'Any tender you plan to bid on based on MJP intel?', 'Any confusion with platform?'. Not sales — support.", metric: "Discovery: 31% of klien already acting on intel by Day 7.", tc: "text-emerald-700" },
            { day: "Hari 14 — Aha Moment Target", what: "Platform milestone: klien uses Competitor Radar OR Knowledge Registry OR Pre-Bid Brief. When any of these 3 are used first time = onboarding success probability +47%. Reza tracks this.", metric: "KPI: 68% of new klien hit aha moment by Day 14. Target: 80%.", tc: "text-orange-700" },
            { day: "Hari 30 — Onboarding Review", what: "Reza sends short survey (3 questions) + schedules optional 'MJP Deep Dive' call (45 menit, Sari + Reza). Shows: tenders tracked, alerts received, suggested next features.", metric: "Klien who complete 30-day review: 2.1× retention at Month 3 vs those who don't.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.day} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[9px] font-bold">{r.day}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.metric}</span>
              </div>
              <p className="text-[8px] text-muted-foreground">{r.what}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Current onboarding completion rate: 61% (reach Day 30 milestone). Target: 78%. Biggest drop-off: Days 7–14 (klien busy, forgot to configure watchlist). Fix in progress: automated reminder sequence + deeper platform integration with WhatsApp onboarding bot.</p>
      </div>

      {/* Product Sprint Retrospectives */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" /> SPRINT RETROS — Pelajaran Terbesar dari 5 Sprint Terakhir MJP: Apa yang Diperkirakan Selesai vs Kenyataannya, dan Mengapa Prediksi Selalu Meleset?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { sprint: "Sprint 18 (Jan 2026)", planned: "NLQ search engine v1 + Contractor Trust Score v2", completed: "Trust Score v2 ✅ · NLQ: 40% done (rolled to S20)", issue: "NLQ scope underestimated: embedding pipeline needed before search UI. Classic infrastructure-before-features mistake. Hendra: 'We built the house before the foundation.'", ratio: "1.3× over" },
            { sprint: "Sprint 19 (Feb 2026)", planned: "Mobile app offline mode + BIM knowledge vertical v1", completed: "Offline mode ✅ · BIM vertical: 6 of 20 assets only", issue: "BIM content requires domain expert Sari doesn't have. Needed to hire external BIM consultant. Procurement took 3 weeks unexpectedly.", ratio: "1.8× over" },
            { sprint: "Sprint 20 (Mar 2026)", planned: "NLQ continued + IjinTender integration + Decision Intelligence widget", completed: "Decision Intelligence ✅ · IjinTender ✅ · NLQ: 70% done", issue: "NLQ at 70% and still not shipped. Root cause: performance requirements (< 300ms at P99) not met by initial embedding search approach. Switched to hybrid BM25+embedding.", ratio: "1.5× over" },
            { sprint: "Sprint 21 (Apr 2026)", planned: "Export Excel with filter + Briefing preview + WhatsApp share", completed: "All 3 ✅", issue: "First sprint in 6 months where all items shipped. Pattern: smaller batch = higher completion. Hendra mandated WIP limit of 3 items/sprint going forward.", ratio: "0.9× (under budget)" },
            { sprint: "Sprint 22 (Jun 2026)", planned: "Knowledge Registry PDF export + Workroom server sync + Pain point photo", completed: "All 3 ✅", issue: "Sprint 21 pattern held. WIP limit working. One scope creep attempt (adding analytics to PDF export) rejected by Hendra: 'Scope creep is how we end up at 1.8×.'", ratio: "0.95× (on time)" },
          ].map((r) => (
            <div key={r.sprint} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[8px] font-bold flex-1">{r.sprint}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.ratio.includes("over") ? "text-red-700" : "text-emerald-700"}`}>{r.ratio}</span>
              </div>
              <p className="text-[7px] mb-0.5"><strong>Planned:</strong> {r.planned}</p>
              <p className="text-[7px] mb-0.5 text-emerald-700"><strong>Done:</strong> {r.completed}</p>
              <p className="text-[7px] text-muted-foreground">{r.issue}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Across 22 sprints: average delivery ratio 1.31× (31% over estimate). Pattern: large items (NLQ, BIM vertical) consistently over. Small items (widgets, integrations, exports) consistently on time. Lesson: break large items into sub-2-week milestones before sprint. WIP limit of 3 = biggest single improvement in delivery reliability.</p>
      </div>

      {/* Product Pricing Strategy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> PRICING RATIONALE — Mengapa MJP Memilih Harga yang Ada Sekarang: Sejarah Iterasi Harga, Tesis di Balik Setiap Tier, dan Kapan Hendra Akan Menaikkan Harga
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="border rounded-sm p-2.5 bg-muted/10 mb-1">
            <p className="text-[9px] font-bold mb-0.5">Pricing history:</p>
            <p className="text-[8px] font-mono">2022: Rp 299K (single tier, informal WA payment) → 2023 Q1: Rp 399K + Pro Rp 799K (2 tiers) → 2023 Q4: +Enterprise Rp 2.499K → 2025 Q1: Current pricing (Basic 499K, Pro 1.299K, Enterprise 3.499K). Each increase ~20–30%. Zero churn spike on any increase.</p>
          </div>
          {[
            { tier: "Basic — Rp 499K/bln", thesis: "Acquisition tier. Low enough that a J7 BUJK foreman can expense without director approval. Primary role: get klien into ecosystem. Then cross-sell SKK Express + upgrade to Pro.", features: "Tender alerts (100/bln), knowledge registry (read-only), basic watchlist", risk: "Heavy Basic usage = cost without high LTV. Monitor: upgrade path from Basic to Pro within 6 months." },
            { tier: "Pro — Rp 1.299K/bln", thesis: "Core value tier. Contains everything that drives win rate: competitor data, HPS model, full regulatory access, pre-bid briefs. This is where MJP earns its margin. Target: 45% of base.", features: "All Basic + Competitor Radar, HPS full model, pre-bid brief access, API (read)", risk: "If churn at Pro is high: value not landing. Indicator: use Competitor Radar in first 30 days." },
            { tier: "Enterprise — Rp 3.499K/bln (per company)", thesis: "Retention + expansion tier. High-touch, high-value. Reza's job: get 1 person at a J9 company hooked → expand to 10 seats. CAC is higher but LTV justifies.", features: "All Pro + team seats (5), API (write), dedicated AM (Reza), custom alert rules, SLA guarantee", risk: "Long sales cycle (avg 2.8 months). Early Enterprise loss = significant revenue miss. Pipeline always needs 3× coverage." },
          ].map((r) => (
            <div key={r.tier} className="border rounded-sm p-2.5 bg-muted/5 mb-1">
              <p className="text-[9px] font-bold text-primary mb-0.5">{r.tier}</p>
              <p className="text-[8px] mb-0.5"><strong>Thesis:</strong> {r.thesis}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Features: {r.features}</p>
              <p className="text-[7px] font-mono text-orange-700">Watch: {r.risk}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200">
            <p className="text-[9px] font-bold text-emerald-700">When will Hendra raise prices again?</p>
            <p className="text-[8px]">Triggers: (1) NPS Enterprise hits +75 (currently +71). (2) Churn drops below 10% for 3 consecutive months. (3) NLQ shipped + BIM vertical launched (product expansion justifies premium). Target window: Q2 2027. Planned: Basic Rp 699K, Pro Rp 1.799K, Enterprise Rp 4.999K. Rationale: +40% with {'>'} 30% more product value = fair exchange.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Zero churn spike on any historical price increase because increases were always telegraphed 60 days in advance, included a 'lock in current price' annual option, and coincided with visible product improvements. Klien felt: 'They're raising price because they're adding value, not because they can.' Trust makes price increases tolerable.</p>
      </div>

      {/* Feature Adoption Funnel */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> ADOPTION FUNNEL — Dari 487 Klien ke Fitur yang Benar-Benar Digunakan: Adoption Rate Setiap Fitur dan Korelasinya dengan Retensi Klien
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Feature</th>
                  <th className="p-1 text-center">Adoption</th>
                  <th className="p-1 text-center">Retention lift</th>
                  <th className="p-1 text-left text-muted-foreground">Why used / not used</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Daily Briefing (WA)", "91%", "+0%", "Default-on. Not a differentiator — baseline feature."],
                  ["Tender Alert (watchlist)", "78%", "+12%", "Requires setup effort. 22% never configure watchlist."],
                  ["Knowledge Registry", "64%", "+18%", "Discovered after aha moment. Education-driven."],
                  ["SKK Expiry Reminder", "51%", "+22%", "High value but requires Dewi's SKK date import."],
                  ["Competitor Radar", "38%", "+34%", "Pro+ only. Strong retention signal when used."],
                  ["HPS Model", "31%", "+29%", "Pro+ only. Complex output — needs user confidence."],
                  ["Pre-Bid Brief", "19%", "+41%", "Pro+ only. Time-intensive to generate. High value."],
                  ["Workroom Notes", "14%", "+15%", "New feature. Adoption growing."],
                  ["API", "8%", "+47%", "Enterprise only. Highest retention correlation."],
                  ["Mobile App", "23%", "+19%", "Newer feature. Growing. Field team primary users."],
                ].map((row, i) => (
                  <tr key={i} className={`border-b hover:bg-muted/20 ${parseFloat(row[2]) >= 30 ? "font-bold" : ""}`}>
                    <td className="p-1">{row[0]}</td>
                    <td className={`p-1 text-center font-bold ${parseFloat(row[1]) >= 70 ? "text-emerald-700" : parseFloat(row[1]) >= 30 ? "text-blue-700" : "text-muted-foreground"}`}>{row[1]}</td>
                    <td className={`p-1 text-center ${parseFloat(row[2]) >= 30 ? "text-emerald-700 font-bold" : "text-muted-foreground"}`}>{row[2]}</td>
                    <td className="p-1 text-muted-foreground">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200">
            <p className="text-[9px] font-bold text-emerald-700">Adoption → Retention correlation insight:</p>
            <p className="text-[8px]">Features with highest retention lift (API 47%, Pre-Bid Brief 41%, Competitor Radar 34%) all have low adoption rates (8–19%). The challenge: get more klien to these features faster. Reza's onboarding playbook change: in Day 14 call, demonstrate Competitor Radar live. Showing = faster adoption than documentation.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Feature adoption monitored monthly by Hendra. Any feature {'<'}10% adoption after 6 months = review: is it discoverable? Is it valuable? Is it too complex? Features that fail all 3 = candidate for deprecation. Current watch list: Workroom Notes (14%, new — allow 6 more months). Pre-Bid Brief generator (19%, complex UX — redesign in backlog).</p>
      </div>

      {/* Product Deprecation Log */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" /> DEPRECATION LOG — Fitur yang Pernah Ada Tapi Dihapus: Pelajaran dari 6 Keputusan Penghapusan Fitur dan Mengapa Menghapus Fitur Sesekali Adalah Tanda Kesehatan Produk
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { feature: "Forum Diskusi BUJK (2023)", reason: "Low engagement (6% DAU), high moderation burden (Sari spending 45 menit/day moderating). Quality of discussion poor. MJP is not a social network.", lesson: "Content platform ≠ community platform. MJP's value is intelligence quality, not peer-to-peer discussion.", removed: "Q2 2023" },
            { feature: "Tender Scoring (Manual 1–10)", reason: "Sari manually scored each tender 1–10. Not scalable. Inconsistent. Klien confused about what score meant.", lesson: "Subjective manual scoring doesn't scale. Replaced by structured HPS model + competition density metric.", removed: "Q3 2022" },
            { feature: "Daily SMS Alert", reason: "SMS cost: Rp 9jt/bln. Duplicate of WhatsApp. <3% of klien had SMS without WA.", lesson: "Dual-channel serving same purpose = cost without value. Eliminated cleanly.", removed: "Q4 2022" },
            { feature: "Kompetitor 'Share of Wallet' Metric", reason: "Ambitious metric estimating competitor's BUJK revenue. Methodology too uncertain (30% error margin). Klien reported using it to make incorrect consortium decisions.", lesson: "A metric with high error margin and real decision impact is dangerous. Better to not publish than to mislead.", removed: "Q1 2024" },
            { feature: "Regulatory Compliance Checklist Builder (v1)", reason: "Generic checklist tool klien used incorrectly for specific tenders. 4 klien reported false compliance confidence leading to disqualification.", lesson: "'General tools in specific contexts = dangerous.' Replaced by Sari-authored tender-specific checklist assets.", removed: "Q3 2023" },
            { feature: "Public BUJK Review/Rating", reason: "Legal risk: ratings could be seen as defamation. Also: competitors could submit fake reviews.", lesson: "Rating systems require moderation, legal framework, and trust scale MJP doesn't have yet. Replaced by BUJK Trust Score (model-based, not crowd-sourced).", removed: "Q1 2023" },
          ].map((r) => (
            <div key={r.feature} className="flex gap-2 border-b py-1.5">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[8px] font-bold line-through text-muted-foreground">{r.feature}</p>
                  <span className="text-[7px] font-mono text-red-700">{r.removed}</span>
                </div>
                <p className="text-[7px] text-muted-foreground mb-0.5">Removed: {r.reason}</p>
                <p className="text-[7px] font-mono text-primary">Lesson: {r.lesson}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Every deprecation was a difficult decision — klien notice when features disappear. MJP protocol: 60-day deprecation notice, migration guide to replacement feature, personal email from Hendra. Zero churned klien attributed to any of these 6 deprecations. Hendra: 'A product that never removes features is a product that accumulates debt. Removal with care = product maturity.'</p>
      </div>

      {/* Product Design Principles */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5 text-primary" /> DESIGN PRINCIPLES — 8 Prinsip Desain Produk MJP yang Membimbing Setiap Keputusan UI/UX: Dari Bahasa Indonesia-First hingga Aturan Tidak Boleh Menyembunyikan Data di Balik Klik Berlebihan
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { no: "P1", principle: "Bahasa Indonesia selalu — bukan pseudo-formal", desc: "Platform menggunakan bahasa Indonesia sehari-hari level manajer proyek, bukan bahasa birokrasi PUPR. Contoh: 'Tender ini mungkin ketat persaingannya' bukan 'Tingkat kompetisi tender terindikasi tinggi secara statistikal'.", impact: "Menghilangkan jarak antara data dan keputusan." },
            { no: "P2", principle: "Keputusan selalu tampak, bukan hanya data", desc: "Setiap panel data harus berakhir dengan 'apa yang harus dilakukan klien sekarang.' Informasi tanpa aksi = informasi yang terbuang. Aturan: setiap alert punya recommended action.", impact: "NPS meningkat 11 poin setelah principle ini diterapkan (Q3 2023)." },
            { no: "P3", principle: "Mobile-first sebelum desktop", desc: "Saat desain feature baru: Hendra sketches on paper, mobile viewport first. 'Jika tidak bisa di mobile, tidak cukup penting untuk ada.' Desktop = enhancement, bukan primary.", impact: "71% klien akses via mobile. Design principle matches real usage." },
            { no: "P4", principle: "Konfigurasi sesedikit mungkin", desc: "Default settings harus benar untuk 80% klien. Konfigurasi adalah beban kognitif. Setiap opsi tambahan = lebih banyak klien yang tidak menggunakannya dengan benar. Proof: 22% klien never configure watchlist = 22% feature failure.", impact: "Smart defaults reduce onboarding friction." },
            { no: "P5", principle: "Jangan sembunyikan data penting di balik 3+ klik", desc: "Daily Briefing → Tender Alert → Detail: 2 klik max. HPS estimate → explanation: 1 klik max. Setiap klik yang ditambahkan mengurangi kemungkinan klien mencapai informasi kritis.", impact: "Session depth metric: average klien reaches key info in <2 klik (vs. industry avg 3.4)." },
            { no: "P6", principle: "Error states harus memberi arah, bukan hanya mengeluh", desc: "Bukan: 'Error: data not found.' Tapi: 'Tender ini belum ada di database kami — coba search LPSE langsung [link] atau hubungi Sari jika ini kategori yang sering Anda cari [WA link].'", impact: "Support ticket volume turun 34% setelah error state redesign (Q1 2025)." },
            { no: "P7", principle: "Data confidence harus selalu terlihat", desc: "Setiap estimasi (HPS, competition score, Trust Score) menampilkan confidence indicator. Klien harus tahu kapan data adalah pasti vs. inferred. Tidak boleh menyembunyikan ketidakpastian.", impact: "Reduced misuse of uncertain data in high-stakes decisions." },
            { no: "P8", principle: "Platform tidak boleh lebih cerdas dari kliennya", desc: "Hindari smart algorithms yang mengambil keputusan tanpa klien tahu alasannya. ListFilter boleh digunakan, tapi selalu tampilkan: 'Anda melihat 47 dari 680 tender karena filter Anda: [filter list].'", impact: "Trust increases when klien understands what they're NOT seeing." },
          ].map((r) => (
            <div key={r.no} className="border-b py-1.5">
              <div className="flex gap-2 items-start">
                <span className="text-[7px] font-mono font-bold text-primary w-6 shrink-0">{r.no}</span>
                <div className="flex-1">
                  <p className="text-[8px] font-bold mb-0.5">{r.principle}</p>
                  <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
                  <p className="text-[7px] font-mono text-emerald-700">Impact: {r.impact}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Design principles documented by Hendra, reviewed with Hendra Jr. quarterly. Not a rigid rulebook — they're lenses. When a feature violates a principle, the team discusses whether to adapt the feature or adapt the principle. 3 principles were modified based on user research (P4 evolved from 'zero configuration' to 'minimize configuration' after Enterprise klien requested more control). Principles that can't evolve are doctrine, not design.</p>
      </div>

      {/* Client Success Playbook */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Award className="h-3.5 w-3.5 text-amber-500" /> CLIENT SUCCESS — Panduan Client Success MJP: 5 Momen Kritis dalam 90 Hari Pertama yang Menentukan Apakah Klien Akan Tetap atau Churn — dan Apa yang Dilakukan di Setiap Momen
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { moment: "Day 1 — Onboarding Call (Reza)", timing: "Dijadwalkan dalam 24 jam setelah signup", action: "30-menit call. Reza walks through: watchlist setup (KBLI + geography), WA number verification, 1 live tender search together. Goal: klien configures watchlist in the call, not later.", metric: "Success: klien's first L2 alert delivered within 24 hours of call. Failure: watchlist still empty at Day 3 = intervention.", tc: "text-primary" },
            { moment: "Day 7 — Check-in WA", timing: "Reza sends personal WA message", action: "'Halo Pak/Bu [nama] — sudah terima alert minggu ini? Ada yang perlu kami bantu setup?' Not a templated message — uses klien's name and references their specific watchlist sector.", metric: "Success: reply received (any). Failure: no reply by Day 9 = escalate to Sari for domain-specific resource recommendation.", tc: "text-blue-700" },
            { moment: "Day 14 — Aha Moment Check", timing: "Hendra's critical milestone", action: "Has klien used ANY non-alert feature? (Knowledge asset, HPS model, Trust Score, or SKK reminder). If not: Reza does mini-demo of the feature most relevant to klien's profile. This is the make-or-break moment for retention.", metric: "Klien who use 2+ features by Day 14: 84% retention at 90 days. Klien who only use alerts by Day 14: 41% retention.", tc: "text-amber-700" },
            { moment: "Day 30 — Value Verification Call (Pro+)", timing: "Reza or Sari (for Pro+)", action: "'Berapa tender yang Anda monitor bulan ini? Apakah ada info dari MJP yang mempengaruhi keputusan Anda?' Listen for specific wins (klien caught a tender they'd have missed, avoided a blacklisted sub-contractor, etc.).", metric: "Success: klien narrates at least 1 specific case where MJP made a difference. This story = the renewal anchor.", tc: "text-emerald-700" },
            { moment: "Day 60–90 — Upgrade Opportunity", timing: "If Pro: check feature usage", action: "Klien hitting Pro limits (or asking about consortium matching, API, multi-user): natural Enterprise conversation. Not a push — a recognition: 'It looks like you're outgrowing Pro — let me show you what Enterprise can add.'", metric: "6.3% of Pro klien convert to Enterprise within 90 days. Target 9%. Main trigger: consortium matching demo.", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.moment} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.moment}</p>
                <span className="text-[7px] font-mono text-muted-foreground shrink-0">{r.timing}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.action}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Metric: {r.metric}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Client success playbook written by Reza + Hendra (Q2 2023 after churn analysis showed most exits happened before Day 30). The Day 14 aha moment is the most impactful single intervention — identified from cohort analysis showing the bimodal retention pattern. Reza's bandwidth: 1 Reza can manage ~25 Day-14 checks per month at current klien growth rate. At 600 klien, need 1 dedicated Client Success role. That hire is on the SDR plan (Q1 2027).</p>
      </div>

      {/* Product Velocity Scorecard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Gauge className="h-3.5 w-3.5 text-primary" /> VELOCITY SCORECARD — Kartu Kecepatan Pengembangan Produk MJP: Berapa Cepat Tim Membangun dari Ide ke Produksi — dan Kenapa Kecepatan MJP adalah Keunggulan Kompetitif yang Sering Diremehkan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {[
              { stat: "6 minggu", label: "Pain point → MVP (avg 2022–2024)", tc: "text-primary" },
              { stat: "4 minggu", label: "Avg ship time 2025–2026", tc: "text-emerald-700" },
              { stat: "2 orang", label: "Entire product team (Hendra + Hendra Jr.)", tc: "text-muted-foreground" },
              { stat: "0 sprints", label: "No formal sprints — continuous flow", tc: "text-orange-700" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-base font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[8px] text-muted-foreground mb-1">Feature delivery timeline (selected features):</p>
          <div className="overflow-x-auto mb-1">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Feature</th>
                  <th className="p-1 text-center">Pain point identified</th>
                  <th className="p-1 text-center">MVP shipped</th>
                  <th className="p-1 text-center">Elapsed</th>
                  <th className="p-1 text-center">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["BUJK Trust Score", "Q4 2022 (Budi field note)", "Q1 2023", "8 minggu", "Top 3 renewal driver"],
                  ["Consortium Matching", "Q2 2023 (Budi field note)", "Q3 2023", "6 minggu", "Top 3 Enterprise feature"],
                  ["SKK Express", "Q3 2023 (Dewi frustration report)", "Q4 2023", "7 minggu", "Rp 340jt ARR Q4 2024"],
                  ["HPS Model v2", "Q1 2024 (Sari feedback)", "Q2 2024", "9 minggu (data intensive)", "Highest satisfaction score"],
                  ["Mobile App MVP", "Q3 2024 (Budi request)", "Q1 2025", "14 minggu", "Budi active daily"],
                  ["NLQ v1", "Q4 2024 (Hendra vision)", "Q4 2026 (target)", "~24 bulan (complex)", "TBD"],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className="p-1 text-center text-primary">{row[2]}</td>
                    <td className="p-1 text-center text-orange-700">{row[3]}</td>
                    <td className="p-1 text-emerald-700">{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700">Velocity secret: no meetings for features {'<'} 2 weeks of work</p>
            <p className="text-[8px]">Hendra and Hendra Jr.'s workflow: Hendra describes feature in Notion (max 1 page). Hendra Jr. builds. Daily async WA check-in. Demo when ready. No standup, no sprint review, no retrospective for small features. This saves ~5 hours/week of ceremony time = 65 hours/year = equivalent to 1.5 features per year just from removing process overhead.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">MJP's 4-week average feature velocity is competitive with well-funded startups who have 10× the engineering team. The advantage comes from: (1) no coordination overhead in 2-person team, (2) Hendra Jr.'s deep construction domain knowledge (no time lost explaining context), (3) no technical debt from over-engineering (build for current scale, refactor when needed). Post-Series A: hiring plan preserves this by keeping product team small (target 4 engineers max) and cross-functional.</p>
      </div>

      {/* User Research Methodology */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ScanSearch className="h-3.5 w-3.5 text-primary" /> USER RESEARCH — Metodologi Riset Pengguna MJP: Bagaimana Kami Tahu Apa yang Klien Butuhkan Tanpa Tim UX Khusus — 4 Metode yang Dijalankan dengan Konsisten dan Mengapa Hasilnya Lebih Kaya dari Survey
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { method: "Metode 1 — Budi's Field Interview (lihat Research page)", freq: "18 kunjungan/bulan", quality: "★★★★★", desc: "Highest fidelity. BUJK director speaks freely, no platform awareness. Budi's 5-phase protocol captures behavior, not perception. Primary input to problem backlog.", limit: "Geographic bias toward Jateng. J9 underrepresented (Budi's network skews J7–J8)." },
            { method: "Metode 2 — Reza's Lost Deal Debrief", freq: "Every closed deal (won + lost)", quality: "★★★★☆", desc: "Captures decision-making. Reza asks 3 questions every deal: 'What made you decide?' / 'What was your hesitation?' / 'What would make MJP perfect for you?' Stored in Notion.", limit: "Selection bias: only BUJK who responded to Reza's outreach. Misses non-Reza-reachable BUJK." },
            { method: "Metode 3 — In-App Behavior Analytics", freq: "Continuous (Hendra Jr. weekly review)", quality: "★★★☆☆", desc: "Which features are used, how often, by what klien segment. Reveals gaps between 'what klien say they want' vs. 'what they actually use'. Example: klien said they wanted more report templates but 73% never opened the template library.", limit: "Behavior data requires interpretation. Doesn't explain WHY someone does or doesn't use a feature." },
            { method: "Metode 4 — Power User Advisory (5 klien)", freq: "Monthly WA group check-in + quarterly call", quality: "★★★★☆", desc: "5 Enterprise klien who Hendra personally communicates with. They receive pre-release features, give structured feedback. Highly engaged, deeply familiar with platform. Sari uses their feedback to calibrate knowledge asset topics.", limit: "Not representative — all J9 Enterprise. Their feedback may not apply to J7 Pro majority." },
          ].map((r) => (
            <div key={r.method} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[8px] font-bold flex-1 text-primary">{r.method}</p>
                <span className="text-[7px] font-mono text-amber-600 shrink-0">{r.quality}</span>
                <span className="text-[7px] font-mono text-muted-foreground shrink-0">{r.freq}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className="text-[7px] font-mono text-orange-700">Limitation: {r.limit}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">MJP's research stack achieves enterprise-grade product insights without a dedicated UX/research team. The combination of field ethnography (Budi), commercial intelligence (Reza), behavioral data (Hendra Jr.), and power user advisory (Hendra) covers the full spectrum from tacit needs to stated preferences to actual behavior. Hendra's insight: 'We can't afford a research team. So we made every team member a researcher.' This cross-functional research model is itself a competitive advantage — insights never go through a translation layer that loses nuance.</p>
      </div>

      {/* Feature Adoption Cohort Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> COHORT ADOPTION — Analisis Adopsi Fitur per Kohort: Klien yang Bergabung di 2022 vs. 2023 vs. 2024 vs. 2025 — Mana yang Mengadopsi Fitur Terbaru Paling Cepat dan Apa yang Menggerakkan Adopsi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Feature adoption rate by klien cohort (% using feature regularly by 90-day mark):</p>
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Feature</th>
                  <th className="p-1 text-center">Cohort 2022</th>
                  <th className="p-1 text-center">Cohort 2023</th>
                  <th className="p-1 text-center">Cohort 2024</th>
                  <th className="p-1 text-center">Cohort 2025</th>
                  <th className="p-1 text-left">Trend</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Tender Alert (core)", "91%", "93%", "94%", "96%", "↑ Improving — onboarding better"],
                  ["Daily Briefing open", "62%", "71%", "78%", "83%", "↑ Format improvements drive open rate"],
                  ["BUJK Trust Score lookup", "34%", "52%", "67%", "74%", "↑ Reza actively demos in onboarding since 2023"],
                  ["Knowledge Asset reading", "41%", "58%", "63%", "71%", "↑ Better KBLI tagging makes assets more relevant"],
                  ["SKK Reminder (activated)", "28%", "44%", "61%", "79%", "↑ Explosive — Dewi's webinars drive awareness"],
                  ["HPS Estimate used", "18%", "31%", "39%", "47%", "↑ Pro klien adoption growing; J9 still underusing"],
                  ["Consortium Matching", "N/A", "9%", "23%", "31%", "↑ New in 2023; awareness growing"],
                  ["Mobile App (Budi release)", "N/A", "N/A", "41%", "57%", "↑ Q1 2025 release; strong early adoption"],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[2]}</td>
                    <td className="p-1 text-center text-blue-700">{row[3]}</td>
                    <td className="p-1 text-center text-primary font-bold">{row[4]}</td>
                    <td className="p-1 text-emerald-700">{row[5]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700">Key cohort insight: newer klien adopt features faster</p>
            <p className="text-[8px]">2025 cohort adopts features 28–50% faster than 2022 cohort at same 90-day mark. Cause: better onboarding (Reza's Day-1 call now covers 3 features vs. 1 in 2022), better in-app guidance (Hendra Jr. added contextual tooltips Q3 2024), and better KBLI tagging (features feel more relevant). This is compound onboarding improvement — the 2026 cohort will be even faster.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Cohort analysis is Hendra's primary product health metric. He tracks 90-day feature adoption as a leading indicator for 12-month retention. Correlation: klien using 3+ features by Day 90 have 89% 12-month retention. Klien using only 1 feature: 54%. The retention gap between 1-feature and 3-feature klien is the primary driver of Reza's 'Day-14 aha moment' obsession — getting klien to feature #2 and #3 quickly is not UX polish, it's survival.</p>
      </div>

      {/* Product Changelog & Communication */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Megaphone className="h-3.5 w-3.5 text-primary" /> PRODUCT CHANGELOG — Proses Komunikasi Perubahan Produk MJP ke 487 Klien: Bagaimana Setiap Update Disampaikan Agar Klien Paham Nilai yang Mereka Dapatkan — dan Mengapa MJP Tidak Kirim Newsletter Generik
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">MJP product changelog communication principles (Hendra's framework):</p>
          {[
            { principle: "P1 — Value-first language, not feature language", example: "❌ 'We added a Trust Score cache refresh button.' ✅ 'You can now get a real-time Trust Score update instantly — useful when vetting a BUJK for an urgent tender decision.'", rationale: "BUJK directors don't care about features. They care about what they can do now that they couldn't do before." },
            { principle: "P2 — KBLI-targeted changelog delivery", example: "Klien who submitted irigasi tenders in the last 90 days receive changelog noting HPS improvement for KBLI 42202. All other klien receive the generic changelog without the KBLI-specific insight.", rationale: "Relevance drives opens. Generic changelog open rate: 34%. KBLI-targeted: 71%. Hendra Jr. built KBLI-targeted delivery in Q1 2026." },
            { principle: "P3 — One major feature per changelog email", example: "If 3 features shipped in a week: one email per major feature, staggered across 3 weeks. Not one email with 3 features.", rationale: "Multiple features in one email = klien don't know where to look. One feature per email = clear focus, higher click-to-explore rate." },
            { principle: "P4 — Reza follows up by phone for Enterprise klien", example: "Enterprise klien receive changelog email + a Reza WA message: 'Saw the update on [feature] — wanted to check if you've tried it yet and if it applies to your current projects.' Day 2–3 after email.", rationale: "Enterprise retention requires human touch. Changelog email alone doesn't build relationship. Reza's follow-up converts passive awareness into active adoption." },
            { principle: "P5 — 'What we didn't ship' transparency", example: "Quarterly: Hendra writes a 'what we chose not to build this quarter and why' internal note shared with Reza and Sari. Not published to klien — for team alignment only.", rationale: "Prevents internal pressure from Reza ('why don't we have X yet?'). When Reza hears a klien request, he can accurately say 'that's in Q4 plan' vs. 'I don't know'." },
          ].map((r) => (
            <div key={r.principle} className="border-b py-1.5">
              <p className="text-[8px] font-bold text-primary mb-0.5">{r.principle}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5 italic">{r.example}</p>
              <p className="text-[7px] font-mono text-muted-foreground">{r.rationale}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Changelog communication is Hendra's direct responsibility (not delegated to Reza or Sari). Hendra writes the value-first descriptions himself. In 2025: 23 changelog emails sent to klien base. Average open rate: 47%. Average click-through (to in-app feature): 23%. Click-to-explore is the metric Hendra cares about — it means klien didn't just read about the feature, they tried it. Klien who explore a new feature within 7 days of changelog: 34% higher 12-month retention vs. klien who never explore it.</p>
      </div>

      {/* Product Accessibility & Mobile-First Design */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Smartphone className="h-3.5 w-3.5 text-primary" /> MOBILE DESIGN — Desain Mobile-First MJP: Mengapa 73% Klien Mengakses Platform via HP di Lapangan — Keputusan Desain Utama, Apa yang Tidak Bisa Dilakukan di Mobile, dan Roadmap Paritas Mobile 2026–2027
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {[
              { stat: "73%", label: "Sessions from mobile devices", tc: "text-primary" },
              { stat: "41%", label: "Mobile-only klien (never use desktop)", tc: "text-orange-700" },
              { stat: "4.2 min", label: "Avg mobile session duration", tc: "text-blue-700" },
              { stat: "2.8 min", label: "Avg desktop session duration", tc: "text-muted-foreground" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-sm font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          {[
            { category: "What works great on mobile (Budi-tested)", items: ["Tender alert WA notification → one-tap open in mobile browser → alert detail view", "BUJK Trust Score lookup (search + view Trust Score card + blacklist status)", "Daily Briefing reading (formatted for mobile — no tables, no charts in mobile view)", "SKK reminder tap-to-contact-Dewi (auto-populates WA message to Dewi)", "Photo upload for Pain Point form (camera native integration)"], tc: "text-emerald-700" },
            { category: "What doesn't work well on mobile yet", items: ["HPS model (complex table output — not mobile-optimized)", "Consortium matching (multi-step form — awkward on 5\" screen)", "Knowledge registry browsing (long list navigation loses context)", "Excel export (creates file but mobile browsers handle downloads poorly)", "Full tender list with 10+ filter options (too many taps)"], tc: "text-orange-700" },
            { category: "Mobile parity roadmap (Hendra Jr., Q3 2026 – Q1 2027)", items: ["HPS mobile card (simplified output — 3 scenarios instead of full table) [Q3 2026]", "Consortium matching mobile wizard (3-step instead of form) [Q4 2026]", "Knowledge registry swipe navigation (card-based instead of list) [Q1 2027]", "Native app (Expo — currently in beta for Budi's field team) [Q2 2027 general release]"], tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.category} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.category}</p>
              <div>{r.items.map((it, i) => <p key={i} className={`text-[7px] ${r.tc}`}>• {it}</p>)}</div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Mobile-first insight from Budi's field program: BUJK directors (primary user) primarily use mobile. They access MJP during site visits, in vehicles, and during LPSE procurement events. The mobile session (4.2 min) is longer than desktop (2.8 min) because mobile users are task-focused — they open MJP for a specific purpose and spend longer completing it. Desktop users browse more passively. Hendra Jr.: 'Every design decision runs through a mobile-first filter. If a feature requires a large screen to be useful, either simplify it or build a mobile-specific variant.'</p>
      </div>

      {/* Product Pricing Architecture */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Tags className="h-3.5 w-3.5 text-primary" /> PRICING ARCHITECTURE — Arsitektur Harga Produk MJP: Mengapa 3 Tier Harga Didesain Berbeda untuk 3 Jenis Pembeli — Logika Nilai di Balik Setiap Tier dan Bagaimana Harga Akan Berubah Pasca-Series A
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Tier</th>
                  <th className="p-1 text-center">Price/month</th>
                  <th className="p-1 text-center">Target buyer</th>
                  <th className="p-1 text-center">Core value</th>
                  <th className="p-1 text-center">Klien count</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Starter", "Rp 500k", "J7 BUJK, 1–2 KBLI", "Tender alerts for 2 KBLI categories. Daily briefing. Basic BUJK lookup.", "187 klien (38%)"],
                  ["Pro", "Rp 2.0jt", "J8 BUJK, 3–6 KBLI", "Full tender alerts. Regulatory alerts. HPS model (5/month). Knowledge registry access.", "241 klien (50%)"],
                  ["Enterprise", "Rp 4.5jt", "J9 BUJK, 7+ KBLI", "Unlimited. Consortium matching. Trust Score API. Priority Dewi SKK consultation.", "59 klien (12%)"],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className={`p-1 font-bold ${i === 0 ? "text-muted-foreground" : i === 1 ? "text-blue-700" : "text-primary"}`}>{row[0]}</td>
                    <td className="p-1 text-center text-emerald-700 font-bold">{row[1]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[2]}</td>
                    <td className="p-1 text-muted-foreground">{row[3]}</td>
                    <td className="p-1 text-center text-orange-700">{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {[
            { topic: "Why Starter exists (even though Rp 500k is below unit economics)", detail: "Starter is MJP's market entry product. Its purpose: get J7 BUJK into the platform habit. J7 BUJK who upgrade to Pro (avg upgrade timeline: 14 months) have higher LTV than klien who start Pro (they're more engaged, more likely to renew). Starter is a deliberate loss-leader for the Pro upgrade path. Blended CAC is lower when Starter does the initial acquisition. Reza's Pro conversation with a Starter klien: 15 minutes vs. 47 minutes for a cold Pro prospect.", tc: "text-muted-foreground" },
            { topic: "Post-Series A pricing evolution (Hendra's plan)", detail: "Two changes planned after Series A: (1) Starter price: Rp 500k → Rp 750k (Rp 250k increase — justified by 3 new Starter features: offline search, WA alert reliability improvements, basic competitor watchlist). (2) New Enterprise Plus tier at Rp 7.5–9jt/month for Document Intelligence + dedicated Sari monthly call + custom KBLI monitoring. Timing: 6 months after NLQ v1 launch. Reza's instruction: 'Every price increase must be preceded by a feature increase. Never raise price without raising value.'", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.topic} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.topic}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Current revenue mix: Starter: Rp 93.5jt/month (23% of sub revenue), Pro: Rp 482jt/month (64%), Enterprise: Rp 265.5jt/month (13% of sub revenue from 12% of klien — highest concentration). Enterprise klien contribute disproportionately to revenue and case study content. Reza's priority: grow Enterprise from 59 to 120 klien by end of 2027. Each Enterprise klien converted from Pro: +Rp 2.5jt/month incremental revenue per klien. 61 Enterprise additions × Rp 2.5jt = Rp 152.5jt/month incremental at target.</p>
      </div>

      {/* Feature Deprecation Policy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trash2 className="h-3.5 w-3.5 text-primary" /> DEPRECATION POLICY — Kebijakan Depresiasi Fitur MJP: Apa yang Terjadi Ketika Sebuah Fitur Tidak Digunakan — Proses 3-Langkah Sebelum Fitur Dihapus dan Mengapa Hendra Pernah Membalikkan Keputusan Depresiasi Berdasarkan Satu Percakapan Klien
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Feature deprecation is rare at MJP (0 features fully deprecated in 4 years) but the process is documented for when the time comes:</p>
          {[
            { step: "Step 1 — Usage threshold trigger", desc: "A feature is flagged for deprecation review when: (1) Monthly active users < 5% of total klien base for 3 consecutive months, AND (2) Feature has been live > 12 months (not a new feature still gaining adoption). In practice: only 2 features have ever crossed this threshold — both were eventually redesigned rather than deprecated.", tc: "text-muted-foreground" },
            { step: "Step 2 — Reza's 10-klien sample call", desc: "Before any deprecation decision: Reza calls 10 low-usage klien to ask: 'Do you know this feature exists? If yes, why don't you use it?' Answers reveal whether the issue is: (a) feature doesn't solve a real problem (→ deprecate), (b) feature exists but is too hard to find (→ UX fix), (c) feature is used by a specific segment not captured in the top-level metric (→ re-segment the metric).", tc: "text-blue-700" },
            { step: "Step 3 — Deprecation notice (30-day minimum) + migration path", desc: "If a feature is deprecated: (1) All users who have ever used it receive a WA + email notification 30 days before removal. (2) If the feature produced data (e.g., saved searches), Hendra Jr. ensures the data is exportable before removal. (3) Reza calls every klien who used the feature in the last 90 days to offer alternatives.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.step} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.step}</p>
              <p className="text-[7px] text-muted-foreground">{r.desc}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-amber-50 border-amber-200 mt-1">
            <p className="text-[8px] font-bold text-amber-800 mb-0.5">The reversal story (Q3 2024):</p>
            <p className="text-[7px] text-muted-foreground">Hendra decided to deprecate 'Tender Bookmark' feature (save a tender for later review) — only 4% usage. Before the deprecation notice went out, Reza called 10 klien. One Enterprise klien (J9 Sipil, Surabaya) said: 'That's the feature our Direktur Teknik uses every Monday to organize his weekly bid meeting. He bookmarks 8–12 tenders on Friday and reviews them Monday morning.' Reza told Hendra. Deprecation cancelled. Instead: redesigned the bookmark UI to be more visible (it was buried in the tender detail). Post-redesign usage: 23%. Hendra: 'One conversation saved a feature that 23% of klien now use. That's why we never deprecate without calling klien first.'</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Zero deprecated features in 4 years is not because MJP never makes feature mistakes — it's because the deprecation process consistently reveals that low-usage features have a small but intensely loyal user base whose workflow would be broken by removal. At MJP's current scale (487 klien), even a feature used by 3% = 14.6 klien. If those 14 klien are Enterprise klien who would churn if the feature disappeared, the CAC replacement cost of 14 Enterprise klien far exceeds the maintenance cost of the feature. Deprecation math only works at scale — when 3% = 90 klien and the maintenance cost is material. MJP is not there yet.</p>
      </div>

      {/* R96: Product Adoption Funnel Deep Dive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> PRODUCT ADOPTION FUNNEL DEEP DIVE — 6 Tahap dari Discovery hingga Power User: Di Mana Klien Paling Sering Drop Off, Berapa Lama Setiap Tahap, dan Apa yang MJP Lakukan untuk Mempercepat Adopsi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Tahap</th>
                  <th className="p-1 text-center">Duration avg</th>
                  <th className="p-1 text-center">Conversion</th>
                  <th className="p-1 text-center">Drop-off trigger</th>
                  <th className="p-1 text-center">MJP intervention</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["T1: Discovery", "0 hari", "100% → 34%", "Tidak relevan / tidak aware", "Reza's outreach + referral"],
                  ["T2: Trial Signup", "1–3 hari", "34% → 71%", "Onboarding terlalu panjang", "Simplified onboarding wizard"],
                  ["T3: First Alert Received", "1–7 hari", "71% → 88%", "Alert tidak relevant ke kategori klien", "KBLI onboarding profile"],
                  ["T4: First Value Moment", "7–21 hari", "88% → 62%", "Tidak aktif login setelah first week", "WA digest + nudge email D+7"],
                  ["T5: Convert to Paid", "21–30 hari", "62% → 48%", "Harga: tidak yakin ROI terbukti", "ROI calculator + Reza check-in call"],
                  ["T6: Power User", "90–180 hari", "48% → 31%", "Tidak explore fitur lanjutan", "Feature discovery email series"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className={`p-1 text-center font-bold ${parseFloat(row[2].split("→")[1]) >= 70 ? "text-emerald-700" : parseFloat(row[2].split("→")[1]) >= 50 ? "text-orange-700" : "text-red-700"}`}>{row[2]}</td>
                    <td className="p-1 text-center text-muted-foreground text-[7px]">{row[3]}</td>
                    <td className="p-1 text-center text-primary text-[7px]">{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {[
            { insight: "Biggest drop-off: T1 Discovery to Trial (66% drop)", detail: "Bukan karena produknya buruk — ini adalah awareness problem. 66% dari BUJK yang Reza contact tidak pernah dengar tentang MJP. Solusi utama: referral program (setiap klien yang refer mendapat 1 bulan gratis). Reza: 'Referral convert lebih cepat karena klien baru percaya klien yang refer, bukan Reza.'", tc: "text-red-700" },
            { insight: "Bottleneck terkritik: T4 First Value Moment ke T5 Convert (drop 26pp)", detail: "Klien yang mengalami first value moment (biasanya: menang tender atau prevent SKK expiry) convert pada rate 89%. Klien yang tidak mengalami first value moment dalam 21 hari trial: convert hanya 27%. Implication: Reza's D+10 check-in call is specifically designed to surface any first value moment klien might have missed — 'Apakah ada tender yang kamu menangkan atau dicegah bermasalah minggu ini?'", tc: "text-orange-700" },
            { insight: "Power user definition dan value", detail: "Power user = klien yang menggunakan 4+ fitur (tidak hanya Tender Alert). Power users memiliki churn rate 0.3% vs 2.1% untuk basic users. MJP's product email series (T6 intervention) educates klien tentang BUJK intelligence, SKK tracking, dan Workroom — fitur-fitur yang sering tidak digunakan tanpa nudge.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.insight} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.insight}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Adoption funnel data dikumpulkan oleh Hendra Jr. dari event logs platform (signup, first login, first alert click, first subscription payment, feature usage heatmap). Funnel dianalisis per cohort setiap bulan — Q2 2026 cohort menunjukkan improvement di T4→T5 conversion (48% vs 41% Q4 2025) thanks to Reza's D+10 check-in protocol yang dimulai February 2026. Target Hendra: T4→T5 conversion 55% by year-end. Jika tercapai, ARR impact tanpa penambahan trial volume: +14.6% ARR dari conversion rate improvement saja. Hendra: 'Conversion optimization adalah cara paling efisien untuk grow. Jauh lebih murah dari paid acquisition.'</p>
      </div>

      {/* R97: Feature Retention Correlation Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> FEATURE RETENTION CORRELATION MATRIX — Fitur Mana yang Paling Kuat Memprediksi Retensi 12 Bulan: Analisis Korelasi Penggunaan Fitur vs Churn di 487 Klien MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Feature</th>
                  <th className="p-1 text-center">Usage (% klien)</th>
                  <th className="p-1 text-center">12-mo retention (users)</th>
                  <th className="p-1 text-center">12-mo retention (non-users)</th>
                  <th className="p-1 text-center">Retention lift</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["SKK Expiry Reminder", "68%", "94%", "71%", "+23pp", "text-emerald-700"],
                  ["Tender Alert (daily)", "91%", "89%", "48%", "+41pp", "text-emerald-700"],
                  ["BUJK Trust Score lookup", "41%", "96%", "76%", "+20pp", "text-emerald-700"],
                  ["Workroom notes", "23%", "97%", "82%", "+15pp", "text-emerald-700"],
                  ["Regulatory Alert (read)", "54%", "91%", "69%", "+22pp", "text-emerald-700"],
                  ["Mobile app (any session)", "34%", "93%", "78%", "+15pp", "text-emerald-700"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className={`p-1 text-center font-bold ${row[5]}`}>{row[2]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[3]}</td>
                    <td className={`p-1 text-center font-bold ${row[5]}`}>{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {[
            { insight: "Highest retention predictor: Tender Alert daily usage (+41pp lift)", detail: "Ini adalah core value proposition — dan data mengkonfirmasi. Klien yang membuka Tender Alert setiap hari memiliki 89% 12-bulan retention vs 48% untuk yang tidak. Implikasi: apapun yang meningkatkan daily Tender Alert engagement adalah retention investment. Hendra: 'Setiap feature yang membuat klien buka platform setiap hari adalah anti-churn feature.'", tc: "text-emerald-700" },
            { insight: "Highest retention per user: BUJK Trust Score (+20pp, 96% retention)", detail: "Hanya 41% klien menggunakan Trust Score, tapi pengguna Trust Score memiliki retention tertinggi (96%). Ini adalah under-activated feature dengan outsized retention impact. Action: Reza's D+10 call sekarang explicitly demo Trust Score untuk setiap klien yang punya sub-kontraktor relationship. Target: increase Trust Score adoption dari 41% ke 60%.", tc: "text-primary" },
            { insight: "Workroom notes: hidden retention gem (97% retention, 23% adoption)", detail: "Klien yang menulis di Workroom notes memiliki retention 97% — tertinggi absolute di semua feature. Interpretation: Workroom notes adalah stickiness signal, bukan driver — klien yang menulis di Workroom sudah sangat committed ke platform. Tapi juga: feature ini dramatically under-discovered. Only 23% penetration despite highest retention.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.insight} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.insight}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Retention correlation matrix adalah Hendra Jr.'s most impactful data project in 2025. Sebelumnya, product decisions dibuat berdasarkan intuisi ("fitur ini penting karena klien minta"). Setelah matrix: setiap feature investment dievaluasi terhadap retention correlation. Fitur dengan low adoption dan low retention correlation (contoh: bulk export CSV, {'<'}5% adoption, retention neutral) masuk ke backlog freeze — tidak dihapus, tapi tidak dapat development attention. Fitur dengan high retention correlation tapi low adoption (Trust Score, Workroom) mendapat activation investment (onboarding, demo, nudge email). Hendra: 'Data ini mengubah cara kita allocate Hendra Jr.'s time. Sebelumnya: build fitur yang diminta. Sekarang: activate fitur yang retain.'</p>
      </div>

      {/* R98: Pricing Experiment History */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Tags className="h-3.5 w-3.5 text-primary" /> PRICING EXPERIMENT HISTORY — 6 Pricing Model yang MJP Pernah Coba: Mengapa Setiap Model Gagal atau Berhasil, dan Apa yang Menghasilkan Model Tier Saat Ini yang Paling Defensible
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { exp: "EXP-1 (2022): Per-tender fee model — Rp 5k per alert received", result: "FAILED in 6 months", reason: "Klien yang menerima 50+ alert/bulan merasa terbebani. Usage-based pricing menciptakan anxiety: klien mulai avoid terlalu banyak alert subscription karena takut bayar banyak. Ironic: model ini punish high engagement.", tc: "text-red-700" },
            { exp: "EXP-2 (2022): Flat monthly Rp 250k unlimited — single tier", result: "FAILED — unit economics", reason: "Enterprise klien yang butuh dedicated support dan custom features membayar sama dengan Starter klien. Effective cross-subsidization yang tidak sustainable. Hendra: 'Kami memberikan Enterprise service ke semua klien dengan Starter pricing. Itu adalah giving away margin.'", tc: "text-red-700" },
            { exp: "EXP-3 (2023): Per-user seat model — Rp 150k per user per month", result: "PARTIAL — abandoned after 12 months", reason: "BUJK kecil resist seat model karena mereka tidak think in 'users' — mereka think in 'perusahaan'. Friction: forcing klien to enumerate users before value is proven. BUT: generated useful data about team size per tier.", tc: "text-orange-700" },
            { exp: "EXP-4 (2023): Annual upfront discount — 20% off for annual payment", result: "SUCCESS — still active", reason: "Annual plan adoption: 34% of Pro klien pay annually. Benefit: cash flow improvement for MJP, lower churn for annual klien (switching cost higher), less monthly collection overhead.", tc: "text-emerald-700" },
            { exp: "EXP-5 (2024): Starter at Rp 499k (original), repriced to Rp 399k after A/B test", result: "SUCCESS — +23% Starter conversion", reason: "Rp 399k hits psychological threshold: below Rp 400k 'feels like under Rp 400k.' Rp 499k felt like 'almost Rp 500k.' Same product, 20% lower price, 23% more conversions. Revenue neutral per klien acquired — better if CAC is reduced.", tc: "text-emerald-700" },
            { exp: "EXP-6 (2025): Enterprise custom pricing — Rp 2–5jt/bulan based on usage", result: "SUCCESS — 23 Enterprise klien", reason: "Enterprise pricing unlocked relationship depth: Reza spent more time per Enterprise deal, which justified higher price. Enterprise klien have lower churn, higher NPS, and are more likely to refer. Current: Enterprise average Rp 2.8jt/bulan.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.exp} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.exp}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.result}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.reason}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Pricing experiment history adalah one of Hendra's most-discussed topics with Series A investors: it demonstrates pricing maturity and willingness to iterate based on data. Most Indonesian startups keep the same pricing for years because changing pricing is uncomfortable — it requires admitting the previous model was wrong. Hendra: 'Setiap pricing change yang kita buat adalah hypothesis yang diuji dengan real money. EXP-1 failed, EXP-2 failed, tapi setiap failure memberi kita insight yang akhirnya membentuk model yang kita punya sekarang. Kesalahan yang bisa kita explain adalah asset, bukan liability.'</p>
      </div>

      {/* R99: B2B API Product Roadmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Code className="h-3.5 w-3.5 text-primary" /> B2B API PRODUCT ROADMAP — Rencana MJP untuk Menjual Intelligence sebagai API kepada Partner SaaS, Perbankan, dan Asuransi Konstruksi: Target Segmen, Pricing Model, dan Projected Revenue Contribution
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { api: "API-1: Tender Feed API — real-time tender stream", segment: "SaaS ERP construction vendors yang ingin embed tender intelligence di product mereka", pricing: "Rp 5–15jt/bulan per partner, based on query volume. Revenue share: 0% (flat fee).", status: "MVP built — 2 pilot partners in discussions (Q3 2026 launch target)", value: "Partners get: real-time tender data without building crawler. MJP gets: distribution reach beyond direct sales — 1 SaaS partner with 5.000 BUJK users = equivalent to 500+ individual subscription equivalent in data exposure.", tc: "text-primary" },
            { api: "API-2: BUJK Vetting API — Trust Score + SKK status lookup", segment: "Perbankan BUMN yang butuh construction contractor credit assessment untuk bank garansi dan KMK (kredit modal kerja).", pricing: "Rp 3.000–8.000 per API call untuk bank garansi assessment, Rp 500 per call untuk SKK lookup. Volume: BNI processes ~12.000 contractor assessments per year.", status: "In design — BUMN bank partnership conversations started Q2 2026", value: "Recurring revenue stream that grows with construction lending volume, not just MJP sales effort. Bank garansi market: Rp 80T+ per year in Indonesia.", tc: "text-blue-700" },
            { api: "API-3: Regulatory Alert Webhook — push regulation changes to partner systems", segment: "Asosiasi konstruksi (GAPENSI, GAPEKSINDO, INKINDO) yang ingin push regulatory alerts ke member communication systems tanpa building their own monitoring.", pricing: "Rp 2–5jt/bulan per asosiasi. GAPENSI has 40.000+ members — if they push MJP alerts, brand exposure to all 40.000 (most of whom are not MJP subscribers).", status: "Concept — dependent on Hendra relationship with GAPENSI leadership. Q4 2026 pilot target.", value: "Association channel as distribution flywheel: member gets alert from GAPENSI (trusted source), alert credits MJP, member becomes aware of MJP subscription offering.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.api} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.api}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.status}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Segment: {r.segment}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Pricing: {r.pricing}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Value: {r.value}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">B2B API adalah Hendra's 'third revenue stream' vision beyond subscription (primary) and custom research (secondary). API revenue has fundamentally different economics: low marginal cost per call, predictable usage-based revenue, and distribution leverage through partners. The risk: building and maintaining a developer-grade API requires Hendra Jr.'s time away from consumer product features. Current decision: API-1 is the beachhead — one focused API, well-documented, reliably maintained. Only add API-2 after API-1 is proven. Hendra Jr.: 'API products are a different product with different quality standards. If MJP's consumer app goes down for 30 minutes, klien are annoyed. If our B2B API goes down for 30 minutes, a bank's loan officers cannot process applications. The reliability SLA is a different beast entirely.'</p>
      </div>

      {/* R100: Product Vision 2028 */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Compass className="h-3.5 w-3.5 text-primary" /> PRODUCT VISION 2028 — Seperti Apa Platform MJP dalam 2 Tahun: 5 Kapabilitas yang Belum Ada Hari Ini, Bagaimana Masing-Masing Mengubah Cara BUJK Beroperasi, dan Apa yang Harus Benar agar Visi Ini Terwujud
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { cap: "CAP-1: Predictive Bid Advisor", desc: "Bukan hanya 'apakah tender ini sesuai profil saya' tapi 'seharusnya kamu bid atau tidak, dan jika bid, berapa yang optimal?' — berdasarkan: historical win rate di LPSE yang sama, kompetitor profil yang likely bid, material cost trend, dan klien's current workload capacity. AI-driven, not rule-based.", requires: "12+ months of tender outcome data per klien (partially available) + win probability model v2 + capacity planning feature (new).", tc: "text-primary" },
            { cap: "CAP-2: BUJK Health Dashboard — internal ops intelligence", desc: "Klien input: ongoing project list, team composition, cash flow status. MJP output: 'Health Score' for the BUJK that predicts: risk of KPI miss, SKK gaps for upcoming projects, financial stress indicators. Shift from external intelligence (market data) to internal intelligence (company health).", requires: "Significant klien data input trust — requires Enterprise relationship depth and demonstrated data security. Reza must sell trust before selling feature.", tc: "text-blue-700" },
            { cap: "CAP-3: Consortium Matching for Large Tenders", desc: "Tenders above Rp 100M often require JO (Joint Operation). MJP identifies: which BUJK in the directory have complementary KBLI + SKK for a specific large tender, no blacklist history, and are not direct competitors. Presents as 'potential JO candidates' — not auto-connecting (legal complexity), just intelligent shortlisting.", requires: "BUJK directory completeness (">" 80% coverage), Trust Score maturity, and legal framework for platform-facilitated introductions.", tc: "text-emerald-700" },
            { cap: "CAP-4: Regulatory Compliance Autopilot", desc: "Platform monitors regulatory changes + klien's BUJK profile + active projects and automatically generates: 'This regulatory change affects your current project at [location]. Action required: update K3 plan by [date]. Download template.' Zero manual research needed from klien side.", requires: "Klien to share project data with MJP (new data relationship) + Knowledge Registry must be 100% current with < 48hr lag for all critical changes.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.cap} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.cap}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Requires: {r.requires}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Product Vision 2028 adalah dokumen yang Hendra tulis once per year — not as a commitment, but as a north star to bias architectural decisions made today. CAP-1 (Predictive Bid Advisor) influences Hendra Jr.'s current data schema design: store enough outcome data today to train the model in 2027. CAP-3 (Consortium Matching) influences Trust Score completeness investment: you cannot match JO candidates without comprehensive, verified BUJK data. The most important function of this vision document: it prevents short-term feature decisions that feel right today but close off future capabilities. Hendra Jr.: 'Setiap kali saya mau take a shortcut dalam data modelling, saya buka Vision 2028. Biasanya shortcut itu akan membuat CAP-1 atau CAP-3 sulit untuk dibangun. Itu cukup untuk membuat saya ambil jalur yang lebih panjang.'</p>
      </div>

      {/* R101: Product-Led Growth Strategy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> PRODUCT-LED GROWTH STRATEGY — Rencana MJP untuk Membuat Platform Itself Menjadi Growth Engine: 4 PLG Mechanisms yang Sedang Dibangun, dan Mengapa Ini Penting untuk Mengurangi Ketergantungan pada Reza
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { mechanism: "PLG-1: Free tier / freemium as acquisition", status: "UNDER DEBATE", detail: "Proposal: basic tender alert (5 alerts/week, 2 LPSE only) gratis selamanya — removed friction to signup. Downside: potential devaluation of paid tier, support cost for free users. Hendra's current position: 'Belum.' Alasan: MJP's current bottleneck is not awareness (Reza has enough leads) but conversion and retention. Freemium solves an awareness problem MJP doesn't have yet.", tc: "text-muted-foreground" },
            { mechanism: "PLG-2: Referral program with subscription credit", status: "IN DEVELOPMENT Q3 2026", detail: "Klien yang refer new paying klien: 1 free month per successful referral. Estimated cost: Rp 399–899k per referred klien (vs Reza's CAC of Rp 280k). But: referral-acquired klien historically have 40% lower churn than cold-acquired klien. LTV advantage more than compensates for higher CAC. Target: 20% of new klien from referral by Q4 2026.", tc: "text-primary" },
            { mechanism: "PLG-3: Share-to-WhatsApp native for tender alerts", status: "BUILT — optimization phase", detail: "Every tender alert has 1-tap WhatsApp share. When klien shares alert to their network: MJP branding + subscribe link included. Viral coefficient tracking (started Q2 2026): avg 0.3 share events per active user per month. Target: 0.5 by Q4 2026 through UX optimization (share button placement, pre-written message quality).", tc: "text-blue-700" },
            { mechanism: "PLG-4: Research report as product-led distribution", status: "ACTIVE — 3 reports published", detail: "Public research reports (State of SKK, BUJK Digital Readiness, etc.): downloadable for free with email capture. Email recipients: nurture sequence → Starter trial offer → paid conversion. From 847 total report downloads: 62 email captures, 23 Starter trials, 9 conversions. CAC dari channel ini: Rp 0 (sunk cost of Sari + Budi time for report). Reza: 'Report-acquireds menjadi klien dengan highest quality score dari semua channels saya.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.mechanism} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.mechanism}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.status}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Product-led growth adalah MJP's plan for the post-Series A phase when Reza is no longer the bottleneck but the amplifier. Current state: Reza IS the growth engine — 77% of new klien are Reza-sourced. Post-Series A state target: PLG + SDRs (under Head of Growth) = 50% of new klien. Reza becomes enterprise-focused: closes large deals, manages Enterprise relationships, handles strategic partnerships. PLG handles top-of-funnel without proportional increase in headcount. Hendra: 'Reza adalah founding reason kami bisa grow dari 0 to 847 klien. Reza juga adalah ceiling yang akan kami temui jika kami tidak build PLG channels yang bekerja tanpa dia. Membangun PLG bukan berarti Reza tidak penting. Artinya Reza menjadi lebih penting karena dia fokus ke hal yang hanya dia bisa lakukan.'</p>
      </div>

      {/* R102: Product Onboarding Journey */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Play className="h-3.5 w-3.5 text-primary" /> PRODUCT ONBOARDING JOURNEY — Dari Signup hingga 'Aha Moment': 5 Milestone yang Harus Dicapai Klien dalam 14 Hari Pertama, Activation Rate Aktual, dan Bagaimana Satu Perubahan UX Meningkatkan 30-Day Retention 14pp
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { milestone: "M1: First login (target: < 24 jam setelah signup)", rate: "96% achieve within 24h", action: "Automated: welcome email dengan direct login link. Reza calls new klien within 2 hours of signup for Pro and Enterprise. Starter: automated onboarding flow only.", tc: "text-primary" },
            { milestone: "M2: KBLI profile configured (target: < 48 jam)", rate: "71% achieve within 48h (the critical drop-off point)", action: "KBLI configuration is the first value-unlock: without it, tender alerts are too broad. UX change (Q2 2025): added KBLI configuration as mandatory step 2 of signup flow, not optional later. Before this change: 41% completion in 48h. After: 71%. This single UX change is the most impactful product improvement in MJP history.", tc: "text-orange-700" },
            { milestone: "M3: First tender alert received + opened (target: < 72 jam)", rate: "83% of KBLI-configured klien achieve within 72h", action: "System automatically sends 'here are 5 tenders matching your profile' email within 2 hours of KBLI configuration. Klien who open this email: 91% complete M4. Klien who don't open: 38% completion. Email subject line A/B test winner: 'Ada 5 tender [KBLI mereka] yang cocok untuk Anda hari ini' (vs generic 'Your MJP alerts are ready').", tc: "text-blue-700" },
            { milestone: "M4: First Knowledge Registry article accessed (target: < 7 hari)", rate: "62% achieve within 7 days", action: "Klien who access Knowledge Registry in first 7 days: 30-day retention 78%. Those who don't: 54%. 24pp retention differential — single strongest predictor of long-term retention MJP has identified. Onboarding intervention: 'Recommended reading' email on day 4 for klien who haven't opened Registry yet. Email headline: 'Regulasi yang paling sering bikin BUJK [kategori klien] ditolak tender — baca sebelum bid berikutnya.'", tc: "text-emerald-700" },
            { milestone: "M5: Aha Moment — first self-described value (NPS response citing specific feature)", rate: "44% achieve within 14 days (from first post-use NPS survey)", action: "14-day NPS survey with open text: 'Ceritakan satu hal yang MJP bantu kamu dalam 2 minggu ini.' 44% provide specific response ('saya temukan tender IKN yang cocok untuk KBLI saya', 'regulasi K3 yang selama ini saya cari'). These klien have found their aha moment. 12-month retention for M5-achievers: 91%.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.milestone} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.milestone}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.rate}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.action}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Onboarding journey analysis adalah Hendra Jr.'s most important product analytics work — because early-day experience is the strongest predictor of long-term retention in SaaS. The key finding: the KBLI configuration mandatory step (M2) was the single change with the largest downstream impact. Before: klien signed up, didn't configure KBLI, received irrelevant broad alerts, concluded MJP wasn't useful, churned at month 1. After: KBLI configured as mandatory → relevant alerts → Knowledge Registry discovery → retention. The cascade of improvements from one UX decision. Current focus: improving M4 (Knowledge Registry discovery) from 62% to 75% through better in-app discovery surfaces. Hendra Jr.: 'Onboarding adalah product's promise kept or broken. 14 hari pertama menentukan 80% dari semua retention outcomes. Investasi di onboarding adalah investasi dengan highest leverage di seluruh product roadmap.'</p>
      </div>

      {/* R103: Feature Deprecation and Sunset History */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Archive className="h-3.5 w-3.5 text-primary" /> FEATURE DEPRECATION HISTORY — 5 Fitur yang Pernah Dibangun tapi Kemudian Dihapus: Mengapa Mereka Dibangun, Mengapa Mereka Dihapus, dan Apa yang MJP Pelajari tentang Over-Engineering
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { feature: "FD-1: Tender Calendar View (2022)", built_for: "Klien yang ingin lihat semua deadline tender dalam kalender visual", why_removed: "Usage: 3.2% of active users in first 3 months post-launch. Investigation: klien yang mau pakai calendar view sudah punya Google Calendar. Integrating with Google Calendar: better solution. MJP Calendar: orphaned feature nobody wanted.", lesson: "Don't build UI chrome for its own sake. Usage data is the signal — 3.2% after 3 months is a failure signal, not a 'growing adoption' signal. Feature removed: saved Hendra Jr. 40 hours/year of maintenance.", tc: "text-muted-foreground" },
            { feature: "FD-2: Competitor price alert (naive version, 2023)", built_for: "Alert when competitor wins tender at significantly different HPS", why_removed: "Data: MJP didn't have reliable HPS final price data at the time (only announced HPS, not winning bid price). Result: alerts were based on incomplete data and frequently wrong. Klien complained alerts were misleading.", lesson: "Don't ship intelligence features without the data to back them up. Feature was rebuilt properly in 2025 with IjinTender integration providing actual price data.", tc: "text-orange-700" },
            { feature: "FD-3: 'Hot Tenders' leaderboard (2023)", built_for: "Gamification — show which tenders are being viewed by most klien", why_removed: "Created herd behavior: all klien started concentrating on same 'hot' tenders, driving up competition exactly where it was already highest. Enterprise klien complained that showing them the same tenders as everyone else defeated the purpose of personalization.", lesson: "Intelligence platform should decrease competition for klien, not coordinate it. Features that create herd behavior are anti-value for the klien.", tc: "text-red-700" },
            { feature: "FD-4: SMS fallback notifications (2022–2023)", built_for: "Klien with low internet connectivity who couldn't receive WhatsApp alerts reliably", why_removed: "SMS cost: Rp 180/message vs WhatsApp Rp 42/message. Usage: 23 klien opted in. Monthly cost for 23 klien: ~Rp 40k additional vs WhatsApp. But: SMS API integration required maintenance, created edge cases in notification system. ROI negative.", lesson: "Low-user features with high maintenance cost: sunset without guilt. The 23 klien were migrated to WhatsApp with UX guidance. Zero churn from the migration.", tc: "text-blue-700" },
            { feature: "FD-5: Workroom desktop app (Electron, 2024)", built_for: "Hendra Jr.'s experiment with offline-first Workroom for field use", why_removed: "3-month build. 4 beta testers. Feedback: 'I just use the website on my phone.' Mobile web was sufficient — desktop app solved a problem klien didn't have. Sunk cost: ~240 Hendra Jr. hours.", lesson: "Validate before building. 3 user interviews before starting Electron build would have saved 240 hours. Mobile app was the right investment, not desktop.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.feature} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.feature}: {r.built_for}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Why removed: {r.why_removed}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Lesson: {r.lesson}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Feature deprecation history adalah bagian dari MJP's product culture that Hendra is proudest of — the ability to kill things they built without ego attachment. Most product teams accumulate features indefinitely because removal feels like admitting failure. MJP's view: keeping a feature nobody uses is a maintenance burden, a complexity tax, and a distraction from things that matter. Current rule: any feature with {'<'} 5% active user rate after 6 months goes into 'deprecation review.' Features that survive: they serve a disproportionately important user segment (e.g., Enterprise-only feature at 3% but 100% Enterprise adoption). Features that don't: sunset with 30-day notice to affected users. Hendra Jr.: 'Kode yang tidak ada adalah kode yang tidak perlu di-maintain. Setiap feature yang kita hapus membuat platform lebih cepat, lebih mudah di-test, dan lebih mudah untuk hire engineer baru yang perlu memahaminya.'</p>
      </div>

      {/* R104: Mobile App Strategy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Smartphone className="h-3.5 w-3.5 text-primary" /> MOBILE APP STRATEGY — Mengapa MJP Membangun Mobile App Setelah 3 Tahun Web-Only: Data yang Membuktikan Mobile adalah Kebutuhan Nyata, Bukan 'Nice to Have', dan Bagaimana Mobile Melengkapi Web
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { insight: "The mobile imperative data", detail: "Hendra Jr.'s analytics (Q3 2025): 67% of MJP web sessions accessed from mobile browser. But mobile browser session duration: 4.2 minutes vs desktop 18.7 minutes. Interpretation: klien are checking MJP from the field on mobile, but the web experience is not optimized for that use case — they check quickly then abandon. Mobile app target: make the 4.2-minute mobile session as productive as possible (fast load, offline capability, thumb-friendly navigation). Not to replace desktop (research, detailed analysis): to serve the field use case better.", tc: "text-primary" },
            { insight: "Mobile-specific features that don't exist on web", detail: "Mobile app has 3 features web doesn't: (1) Offline tender search — cache nearby LPSE results for use in areas with poor signal, (2) Photo evidence capture — Budi's primary tool for field research documentation (camera integration), (3) WhatsApp native share — 1-tap share of tender details or contractor Trust Score to WhatsApp group. These aren't web features adapted for mobile — they're mobile-native capabilities that solve field-specific problems.", tc: "text-blue-700" },
            { insight: "Mobile user segment: field personnel, not executives", detail: "Web primary user: BUJK owner or procurement manager (office context, deep research sessions). Mobile primary user: site supervisor, BD field staff, Budi equivalent (field context, quick lookup + capture). These are different people with different needs. Mobile design follows: large touch targets, minimal text input, fast filter/search, photo capture always accessible. The two products serve the same platform but different workflow moments.", tc: "text-emerald-700" },
            { insight: "Mobile adoption trajectory and 12-month target", detail: "Mobile app launched: Q1 2026 (4 months ago). Current: 234 active users (klien who have installed and used at least once in last 30 days). Target Q1 2027: 600 active mobile users (71% of projected 847 klien who renew + new growth). Mobile activation rate (klien who download app after hearing about it from Reza): 41%. Target: 60% by Q4 2026 through in-app 'Download on mobile' prompt + WhatsApp announcement to all Pro+ klien.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.insight} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.insight}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Mobile strategy adalah keputusan produk yang Hendra defer-kan selama 3 tahun karena 'web-first made sense when our audience was primarily office-based.' The turning point: Budi's field research trips demonstrated that MJP-on-mobile would dramatically increase his productivity. Budi was manually writing notes, photographing them, then transcribing at hotel — a workflow that would be eliminated by mobile with photo evidence capture. When Budi's use case became clear: Hendra approved mobile development even before proving broader klien demand. The subsequent analytics (67% mobile browser sessions) retroactively validated the decision. Hendra Jr. built mobile on Expo (React Native) to maximize code sharing with web and reduce maintenance overhead. Current code sharing between web and mobile: ~40% of business logic shared via monorepo packages. Hendra Jr.: 'Mobile bukan versi kecil dari web. Mobile adalah different product untuk different workflow. Tapi mereka share data dan business logic. Monorepo architecture memungkinkan ini tanpa duplikasi maintenance.'</p>
      </div>

      {/* R105: NPS Deep-Dive — What Promoters Say vs What Detractors Say */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MessageCircle className="h-3.5 w-3.5 text-primary" /> NPS DEEP-DIVE — Apa yang Promoter (9-10) dan Detractor (0-6) Katakan: 5 Tema Terkuat dari Q1 2026 NPS Survey, dan Bagaimana Setiap Tema Membentuk Product Roadmap
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { theme: "PROMOTER THEME 1: 'MJP membuat saya terlihat lebih siap dari semua orang di tender'", freq: "67% of 9-10 responses", segment: "Enterprise + Pro Atas", quote: "'Ketika saya masuk aanwijzing dan sudah tahu HPS range dan siapa kompetitor yang mungkin datang — saya terlihat dan terasa jauh lebih siap. Panitia notice. Kompetitor notice.' — Owner BUJK Menengah, Surabaya", product_action: "Reinforce: tender preparation features (HPS estimation, competitor analysis). Deepen 'preparation confidence' UX — make users FEEL prepared, not just informed.", tc: "text-emerald-700" },
            { theme: "PROMOTER THEME 2: 'PDF briefing harian mengubah cara saya memulai hari kerja'", freq: "43% of 9-10 responses", segment: "Enterprise", quote: "'Dulu saya mulai hari dengan scroll LPSE manual. Sekarang saya buka PDF MJP di pagi hari dan dalam 5 menit tahu apa yang penting hari ini. Itu 45–60 menit waktu saya dikembalikan setiap hari.' — Direktur Teknik, BUJK Besar, Jakarta", product_action: "Task #11 (PDF briefing automation) is directly validating this theme. Investment confirmed. Expand briefing customization post-Task #11 merge.", tc: "text-primary" },
            { theme: "DETRACTOR THEME 1: 'Data coverage di daerah saya masih sangat kurang'", freq: "71% of 0-6 responses", segment: "Pro (outside Java)", quote: "'Saya di Maluku. MJP punya data Jawa yang sangat bagus. Di sini, banyak tender yang tidak muncul atau terlambat. Saya bayar sama dengan orang Jawa tapi dapat coverage yang jauh lebih sedikit.' — Owner BUJK Kecil, Ambon", product_action: "DIRECT ACTION: geographic coverage dashboard (show klien exactly what coverage they have vs national average). Reduce perceived unfairness. Long-term: Hendra Jr. to add 7 Tier-3 LPSE crawlers for eastern Indonesia by Q4 2026.", tc: "text-red-700" },
            { theme: "DETRACTOR THEME 2: 'Mobile app crash terlalu sering'", freq: "44% of 0-6 responses", segment: "Pro (all geographies)", quote: "'App nya bagus ide-nya tapi sering crash waktu offline. Sudah lapor 2 kali ke support, masih terjadi.' — Site Supervisor, BUJK Menengah, Medan", product_action: "CRITICAL BUG: offline crash on mobile is known (Task #24 — prevent data loss on force-close). Resolution in progress. This NPS feedback accelerated Task #24 priority.", tc: "text-orange-700" },
            { theme: "DETRACTOR THEME 3: 'Harga Pro terasa mahal untuk coverage yang tidak penuh'", freq: "38% of 0-6 responses", segment: "Pro (outside Java, small BUJK)", quote: "'Untuk BUJK kecil di daerah, Rp 499k sebulan itu bukan angka kecil. Kalau coverage di daerah saya 30% dari Jakarta — kenapa harganya sama?' — Owner BUJK Kecil, Kupang", product_action: "Pricing localization consideration: Hendra evaluating 'Starter tier' at Rp 199k/month with coverage that matches what's available in klien's province. Would reduce detractor score for price-sensitive non-Java segment.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.theme} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.theme}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.freq}</span>
              </div>
              <p className="text-[7px] italic text-muted-foreground mb-0.5">{r.quote}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Product action: {r.product_action}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">NPS deep-dive adalah quarterly practice Hendra Jr. runs — automated survey to random sample of 20% of klien, open-text analysis by Hendra. Current NPS (Q1 2026): 54 (industry benchmark for B2B SaaS: 30–40). Strong result, but directionally important finding: promoter themes are about capability and time-saving; detractor themes are about geographic coverage gap and mobile stability. These are solvable product problems — not fundamental value proposition failures. The detractor profile: primarily small BUJK outside Java. This is a KNOWN underserved segment (Budi's geographic bias self-critique). Addressing geographic coverage and mobile stability in 2026 would likely increase NPS to 65+, which would be exceptional for a product at this stage. Hendra: 'NPS angkanya penting. Tapi yang lebih penting adalah memahami dengan tepat mengapa orang memberikan angka yang mereka berikan. Setiap 0-6 yang jujur tentang alasannya adalah roadmap item yang sudah di-prioritaskan oleh klien sendiri.'</p>
      </div>

      {/* R106: Product-Market Fit Measurement — How MJP Knows It Has It */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> PRODUCT-MARKET FIT MEASUREMENT — 4 Cara Hendra Mengukur Apakah MJP Benar-benar Punya PMF atau Hanya Punya Klien yang Terlalu Sopan untuk Churn: Indikator yang Tidak Bisa Dimanipulasi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { test: "PMF Test 1: Sean Ellis 'very disappointed' survey", result: "Hendra ran Sean Ellis survey (would you be very disappointed if MJP disappeared?) with 200 klien sample (Q4 2025). Result: 41% 'very disappointed.' Benchmark for strong PMF: 40%+. MJP is at threshold. Breakdown by segment: Enterprise 71% very disappointed, Pro 38%, Starter 22%.", interpretation: "Enterprise PMF is strong (71% — well above threshold). Pro PMF is at threshold (38%). Starter is below threshold (22% — these are klien who might churn without major product improvement for their segment). Action: Starter tier improvement roadmap specifically targets improving Starter PMF.", tc: "text-primary" },
            { test: "PMF Test 2: Organic word-of-mouth rate", result: "Monthly tracking: what percentage of new Trial signups mention they heard about MJP from another klien? Current: 34% of new Trial signups are referral-sourced (no paid marketing involved). Industry benchmark for strong B2B word-of-mouth: 25%+.", interpretation: "34% organic referral rate is above benchmark — indicates klien proactively share MJP with peers. Strongest referral cohort: Enterprise klien who experienced a specific 'MJP saved us from a bad decision' moment (Trust Score case studies). Referral rate is the most honest PMF indicator: people don't refer products they're only moderately satisfied with.", tc: "text-blue-700" },
            { test: "PMF Test 3: Willingness to pay above market benchmark", result: "During 2024 price increase (Pro: Rp 399k → Rp 499k, Enterprise: Rp 2.4jt → Rp 2.8jt): churn rate during price increase month: 1.4% (vs 0.7% baseline). Price elasticity: 2x sensitivity. 98.6% of klien absorbed price increase — only 1.4% churned citing price.", interpretation: "Price increase retention rate of 98.6% is strong evidence of willingness to pay. If MJP lacked PMF, price increase would have triggered 5–10%+ churn (industry typical for B2B SaaS price increases). The 1.4% churn is acceptable — these are likely price-sensitive Starter klien who were marginal anyway.", tc: "text-emerald-700" },
            { test: "PMF Test 4: Usage during user's most stressful business moments", result: "Hendra Jr.'s analytics: MJP logins peak on Mondays and at tender deadline minus 3 days. But the most significant peak: logins increase 340% in the 2 weeks before BUJK qualification renewal deadlines (every 3 years). This is when BUJK are most anxious about their compliance status.", interpretation: "Platform usage peaking at moments of professional stress means MJP is the tool people reach for when it matters most — not just when they're browsing. This is the strongest possible PMF signal: the product is trusted for high-stakes moments, not just low-stakes exploration. Hendra: 'Klien yang datang ke MJP saat mereka paling butuh — itu adalah PMF yang tidak bisa dibuat-buat.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.test} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.test}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Result: {r.result}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Interpretation: {r.interpretation}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">PMF measurement adalah discipline Hendra adopted after a VC told him in 2024: 'Everyone says they have product-market fit. Almost nobody can prove it.' The 4 tests above are Hendra's response: measurable, difficult-to-fake indicators that separately and together point to strong PMF in the Enterprise segment and emerging PMF in Pro. The weakest signal: Starter (22% very disappointed, below threshold). This is consistent with MJP's internal understanding: Starter klien get alerts and basic tender search, but don't get the deep features (Trust Score, NLQ, PDF briefing) that drive the strongest PMF signals. Series A capital will either improve Starter's feature depth (increasing Starter PMF) or clarify that Starter is an acquisition funnel, not a retention segment. Hendra: 'PMF bukan binary. Ini adalah spectrum. Dan yang paling penting adalah tahu exactly di mana Anda berada pada spectrum itu, bukan hanya apakah Anda punya PMF atau tidak. Kami punya PMF yang kuat di Enterprise. Kami masih earning it di segmen lainnya.'</p>
      </div>

      {/* R107: The Product Decisions Hendra Regrets */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-primary" /> PRODUCT DECISIONS HENDRA REGRETS — 5 Keputusan Produk yang Hendra Tidak Akan Ulangi: Bukan Kegagalan Teknis, Tapi Pilihan Strategis yang Membuang Waktu atau Menciptakan Masalah yang Masih Terasa Hari Ini
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { decision: "REGRET-1: Membangun 'Social Forum' fitur di 2023 (dihapus 2024)", what_happened: "Hendra built a discussion forum within MJP — klien could post questions and other klien could answer. 3 months of engineering time. Usage: 12 posts total in 6 months. Feature was silently deprecated in deprecation wave (FD-4 reference). Why it failed: BUJK owners don't want to share competitive intelligence publicly with other BUJK. Forum required sharing context that klien considered proprietary.", lesson: "Features that require community behavior fail if the community has competing interests. Construction procurement is inherently competitive — a forum creates the wrong incentive structure. Better diagnosis before building would have revealed this.", tc: "text-muted-foreground" },
            { decision: "REGRET-2: Menunda pengembangan mobile app 18 bulan lebih lama dari yang seharusnya", what_happened: "Analytics showed 67% mobile browser sessions in Q1 2024. Hendra decided to optimize the web app for mobile browsers instead of building native mobile. 18 months later: web-on-mobile was still poor. Budi's field experience making this increasingly painful. Finally committed to native mobile app in Q3 2025.", lesson: "The data was clear in Q1 2024. The decision to delay native mobile was driven by engineering capacity (Hendra Jr. alone, no bandwidth) — a legitimate constraint but one that should have prompted Series A acceleration, not deferral. Mobile PMF signal was there; investment decision didn't match signal.", tc: "text-orange-700" },
            { decision: "REGRET-3: Terlalu cepat expand ke Starter tier tanpa product-market fit untuk segmen itu", what_happened: "In 2023: Hendra launched Starter tier at Rp 149k/month to 'expand market.' Result: Starter klien had 35% 12-month retention rate vs Pro's 67% and Enterprise's 92%. Starter was dragging down MJP's overall retention metric and creating support overhead for low-ARR klien.", lesson: "Expanding to a less-prepared segment too early dilutes product focus and creates false confidence ('we have 200 Starter klien!') while hiding the fact that retention is poor. Should have nailed Pro-tier retention before expanding to Starter.", tc: "text-blue-700" },
            { decision: "REGRET-4: Tidak mendokumentasikan sistem dari awal — technical debt compound effect", what_happened: "MJP's first 2 years: zero documentation. Hendra Jr. built everything in his head. When a crawler broke in 2023: 4.2 hours to diagnose because no documentation of how the system was built. When onboarding Hendra Jr.'s first potential collaborator in 2024: couldn't do it because nothing was documented.", lesson: "Documentation delay creates a compounding tax: every week without documentation is a week of knowledge that becomes harder to reconstruct. 30 minutes of documentation per feature day is a 6% time investment that pays back 10× in future debugging and knowledge transfer.", tc: "text-emerald-700" },
            { decision: "REGRET-5: Tidak segera mengganti vendor SMS/WhatsApp yang tidak reliable", what_happened: "In 2022–2023: MJP used a third-party SMS/WhatsApp alert provider with ~12% delivery failure rate. This was known. Hendra delayed switching because 'the current solution works well enough.' Result: 12% of alerts never reached klien — contributing to what was likely higher-than-necessary churn from Seasonal profile klien who 'didn't get alerts about a tender they wanted.' Switched to better provider in Q3 2023.", lesson: "12% delivery failure for the platform's primary value delivery mechanism is not 'well enough.' The avoidance of a switching inconvenience (estimated 3 days of Hendra Jr. work) created potentially Rp 40jt+ in churn from missed alerts over 18 months.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.decision} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.decision}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">What happened: {r.what_happened}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Lesson: {r.lesson}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Product decisions Hendra regrets adalah the document Hendra never shows to investors — but shares with every new hire. The purpose: 'I don't want you to make the same mistakes I made. And if you know the mistakes I made, you can challenge me when I'm about to make them again.' The 5 regrets above share a pattern: each was a delayed or misread signal. REGRET-1 (social forum): built without diagnosing competitive incentive structure. REGRET-2 (mobile delay): had the signal, delayed the decision. REGRET-3 (Starter expansion): expanded market before earning the right. REGRET-4 (documentation): known problem, rationalized away. REGRET-5 (alert vendor): 'well enough' as a substitute for 'good enough.' The common root: optimism bias — the human tendency to believe things will work out or that a known problem is less severe than it is. Hendra: 'Semua keputusan ini masuk akal pada saat itu. Itu yang membuat mereka berbahaya. Pelajarannya bukan "jangan buat keputusan yang terasa masuk akal" — pelajarannya adalah "selalu tanya: sinyal apa yang sedang saya abaikan?"'</p>
      </div>

      {/* R108: The Product Roadmap Trade-Off Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> ROADMAP TRADE-OFF FRAMEWORK — Ketika Semua Backlog Item Terasa Penting: 4 Jenis Trade-Off yang Harus Hendra Buat Setiap Kuartal dan Bagaimana MJP Membuat Keputusan Ini Secara Konsisten dan Transparan kepada Tim
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { tradeoff: "TRADE-1: Retention vs Acquisition — perbaiki yang ada vs menangkap yang baru", tension: "Every engineering hour spent on retention features (better onboarding, fixing churn drivers, deepening Enterprise features) is an hour not spent on acquisition features (new LPSE integrations, new competitor intelligence, viral sharing tools). Both have high RICE scores. Both are important. They compete for the same resource: Hendra Jr.'s time.", hendra_rule: "Default: Retention beats Acquisition when retention rate is below segment target (Enterprise target: 90%, Pro target: 65%, Starter target: 40%). When below target: 70% of Hendra Jr.'s feature time goes to retention. When at or above target: 50/50 split. Rationale: it costs 5–7× more to acquire a new klien than to retain an existing one. Below-target retention is always leaking faster than acquisition can fill.", tc: "text-primary" },
            { tradeoff: "TRADE-2: Depth vs Breadth — deeper for current klien vs wider for new segments", tension: "Current klien (Enterprise, Pro) want deeper features: more advanced Trust Score dimensions, more granular NLQ capabilities, more customizable alert logic. New market segments want breadth: IKN Intelligence tier, SKK planning tools for individuals, government procurement officer tools. Both directions grow ARR. They require different product philosophies.", hendra_rule: "Quarterly allocation: 60% of new feature development to current-segment depth, 40% to new-segment breadth. Rationale: current klien pay the bills; new segments provide growth upside. Below 40% breadth: growth stalls. Below 60% depth: current klien feel neglected and churn. This ratio was calibrated empirically over 3 years of observing NPS vs feature development allocation.", tc: "text-blue-700" },
            { tradeoff: "TRADE-3: Platform stability vs Feature velocity — perfect what exists vs ship new things", tension: "Technical debt accumulates faster during periods of high feature velocity. Accumulated technical debt: slows future development, creates reliability risks (outage probability increases), and degrades klien experience subtly. But slowing feature velocity to pay down technical debt: frustrates klien expecting new capabilities and hands market momentum to competitors.", hendra_rule: "Hendra Jr.'s 20% rule: 20% of his engineering time is reserved for technical debt reduction, architecture improvement, and platform hardening — non-negotiable regardless of product pressure. This is the minimum to prevent debt acceleration. In quarters following a period of high feature velocity: temporarily increases to 30%. Hendra: 'Platform yang tidak diperlihara adalah bom waktu yang Hendra Jr. harus defuse sambil membangun fitur baru di atasnya.'", tc: "text-emerald-700" },
            { tradeoff: "TRADE-4: Enterprise feature investment vs Starter/Pro feature investment", tension: "Enterprise klien (47 klien, 38% of ARR) want high-investment features: AI bid strategy analysis, JO network visualization, multi-project SKK portfolio management. Starter/Pro klien (800 klien, 62% of ARR) want simpler improvements: better search, faster alerts, cleaner UI. Per-klien investment efficiency: Enterprise features serve 47 klien; Starter/Pro improvements serve 800.", hendra_rule: "ARR-weighted investment: Enterprise contributes 38% of ARR → Enterprise features get 38% of 'discretionary feature budget' (after retention priorities are met). But Hendra's exception rule: any Enterprise feature that also benefits Pro klien (synergy features) gets counted as both Enterprise and Pro investment — these are prioritized. Example: improved Trust Score for Enterprise JO matching also improves Trust Score quality for Pro klien searching contractors.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.tradeoff} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.tradeoff}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Tension: {r.tension}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Hendra's rule: {r.hendra_rule}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Roadmap trade-off framework adalah the operating system for product decisions at MJP. Without explicit rules: every decision becomes a debate. With explicit rules: the debate is about whether the rule applies, not about the underlying values. The 4 trade-off rules above were developed over 5 years of product decision-making — each was codified after a period where the implicit rule failed and produced a bad outcome. TRADE-1 (retention vs acquisition): codified after 2023's over-investment in acquisition features that produced new klien but couldn't retain them. TRADE-2 (depth vs breadth): codified after 2022's over-investment in breadth that left Enterprise klien feeling unsupported. TRADE-3 (stability vs velocity): codified after the 2023 outage pattern that traced to accumulated technical debt. TRADE-4 (Enterprise vs Starter/Pro): codified after a period of Enterprise over-investment that led to Starter PMF decline. Each rule is a scar from a lesson. The rules are not permanent — Hendra reviews them annually at the offsite. The 2025 offsite produced one rule change: TRADE-1's retention target thresholds were updated to reflect current tier health (Starter target lowered from 50% to 40% after acknowledging that Starter retention is structurally lower due to discovery-mode klien behavior). Hendra: 'Framework ini bukan tentang mengikuti aturan secara membuta. Ini tentang memiliki aturan yang jelas sehingga ketika ada tekanan untuk menyimpang dari aturan, tekanan itu bisa dinilai secara eksplisit. Aturan yang tidak tertulis: mudah diabaikan saat tekanan datang.'</p>
      </div>

      {/* R109: MJP's Feature Completeness Definition */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-primary" /> FEATURE DONE DEFINITION — Bagaimana MJP Mendefinisikan Kapan Sebuah Feature 'Selesai': 6 Kriteria yang Harus Dipenuhi Sebelum Feature Dianggap Production-Ready, dan Bagaimana Definisi Ini Berkembang Selama 5 Tahun
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { criterion: "DONE-1: Functional correctness — feature bekerja sesuai spesifikasi", description: "The obvious first criterion: the feature does what it was designed to do. For MJP: this includes edge cases specific to Indonesian government data (null values in LPSE fields, inconsistent date formats, KBLI codes that appear in one portal format but not another). Hendra Jr.'s standard: 'I need to be confident that if a klien uses this feature with any LPSE tender from any of 671 portals, it will work correctly.'", evolution: "Year 1–2 definition: feature works for the 10 test cases Hendra Jr. ran. Current definition: feature works for automated test suite of 500+ cases across all KBLI categories, all 34 provinces, and edge case inputs. The evolution: CRITICAL bug caught in 2022 (incorrect HPS calculation for specific KBLI category) that wasn't caught by limited Year-1 testing. Now: expanded test coverage is non-negotiable.", tc: "text-primary" },
            { criterion: "DONE-2: Performance at scale — feature tidak memperlambat platform untuk semua klien", description: "Any new feature must be tested under realistic load: 847 simultaneous klien using the feature, or 40.000 LPSE events being processed while the feature is active. MJP's p95 latency target: {'<'}500ms for all user-facing requests even during peak load. New features must not degrade this target.", evolution: "Year 1 definition: feature responds in {'<'}3 seconds. Current: {'<'}500ms p95. The evolution: driven by Enterprise klien feedback (2023: 'your platform is too slow during Monday morning peak hours') and competitive pressure (C1 is fast). Achieving {'<'}500ms required Hendra Jr. to refactor core database queries twice — each refactor took 1 week.", tc: "text-blue-700" },
            { criterion: "DONE-3: Sari review (for any feature touching Knowledge Registry or NLQ)", description: "Any feature that surfaces Knowledge Registry content or produces NLQ answers requires Sari's explicit sign-off before production. This includes: new NLQ answer types, changes to how Knowledge Registry assets are retrieved, changes to confidence scoring. Sari's review: does the feature accurately represent the regulatory knowledge MJP is committed to providing? Are there edge cases where the feature could provide misleading information?", evolution: "Year 1–2: no Sari review requirement — product launches were Hendra Jr.-only. Introduced after 2023 NLQ incident (incorrect regulatory answer affecting klien bid). Sari review: adds 2–5 days per feature but has caught 4 significant accuracy issues before production since introduction.", tc: "text-emerald-700" },
            { criterion: "DONE-4: Budi/user validation (for features solving field-identified pain points)", description: "For features built to address pain points from Budi's field research: the feature must be validated with at least 1 narasumber who reported the original pain point. Validation method: Budi calls the narasumber, describes the feature, asks if it solves their problem. If narasumber says 'yes but': iterate. If narasumber says 'yes': feature cleared for production.", evolution: "Year 1: no user validation process. Introduced after the 'social forum' mistake (built without diagnosing competitive incentive structure). Current: Budi maintains a list of 'validation-pending' features — features that can't be marked DONE until narasumber validation is complete. Adds 3–14 days per feature but has prevented 2 confirmed features from going live that would have been removed within 6 months.", tc: "text-orange-700" },
            { criterion: "DONE-5: Mobile compatibility (for any UI feature)", description: "All UI features must work correctly on MJP's mobile app (iOS and Android, via Expo React Native). Mobile-first klien represent 67% of MJP's user sessions. A feature that works perfectly on desktop but is unusable on mobile is not done. Hendra Jr.'s mobile test: each feature must be tested personally on iPhone 12 (representing mid-range iOS) and Samsung Galaxy A32 (representing mid-range Android) before production.", evolution: "Year 1–2: mobile was not a priority (platform was desktop-first). Mobile compatibility criterion introduced in Year 3 when analytics showed mobile sessions overtaking desktop. Retroactive mobile compatibility work on existing features: approximately 80 hours of Hendra Jr.'s time in 2024.", tc: "text-primary" },
            { criterion: "DONE-6: Klien communication ready (for any user-facing feature)", description: "Every new user-facing feature requires: (1) in-app tooltip or help text, (2) Knowledge Registry asset (if the feature relates to a regulatory or procurement concept), (3) Reza briefing (so Reza can explain the feature in Enterprise account conversations), (4) release note for MJP's monthly product update email. Features that launch without communication artifacts: create confusion and support overhead.", evolution: "Year 1: features launched without any communication. Introduced after support tickets spiked following the NLQ launch in 2023 — klien didn't understand what NLQ was for or how to use it. Communication requirement: adds 0.5–1 day per feature but reduces post-launch support tickets by estimated 60%.", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.criterion} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.criterion}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.description}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Evolution: {r.evolution}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Feature done definition adalah MJP's most important product quality mechanism — because without a clear definition of done, 'done' means whatever is convenient at the moment. The 6 criteria above represent the accumulated learning from 5 years of feature shipping mistakes. Each criterion was added after a specific failure: DONE-3 (Sari review) after NLQ accuracy incident, DONE-4 (narasumber validation) after Social Forum waste, DONE-5 (mobile compatibility) after mobile session data, DONE-6 (communication) after NLQ launch support spike. The definition of done is also a forcing function for timeline estimation: when Hendra Jr. estimates a feature will take '2 weeks,' that estimate now includes all 6 criteria. Year-1 estimates were typically 2-3× too short because they only accounted for DONE-1 (functional correctness). Current estimates: more accurate because they account for the full definition. The criteria are published internally and shared with every new hire: 'This is what it means to finish something at MJP.' The rigor sometimes creates friction — Enterprise klien occasionally ask 'why is feature X taking so long?' The answer: 'Because we're making sure it meets all 6 criteria before it affects your procurement decisions.' Klien who understand this: respect the rigor and trust the output more. Hendra: 'Fitur yang setengah selesai yang sudah live adalah hutang yang perlu dibayar dua kali: sekali untuk memperbaiki masalahnya, sekali untuk memulihkan kepercayaan klien yang terpengaruh.'</p>
      </div>

      {/* R111: 3 Product Bets That Almost Didn't Happen */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> 3 FITUR YANG HAMPIR TIDAK DIBANGUN — Product Bets MJP yang Menghadapi Penolakan Internal Sebelum Akhirnya Menjadi Feature Terbaik Platform: Setiap Keputusan yang Sulit Mengandung Pelajaran tentang Cara Berpikir Produk yang Benar
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { feature: "ALMOST-1: Trust Score — ditolak karena 'terlalu berani mengklaim objektif'", opposition: "Year 2 (2022): Hendra Jr. proposed Trust Score. Hendra's initial reaction: 'Kita tidak bisa memberikan angka pada reputasi BUJK — ini terlalu subjektif dan akan membuka kita ke komplain dari BUJK yang mendapat skor rendah.' The objection was legitimate: no one in Indonesia had publicly rated contractor trustworthiness before. BUJK dengan skor rendah: bisa menjadi masalah legal atau reputasional untuk MJP.", resolution: "What changed Hendra's mind: Budi came back from field research with 3 documented cases of JO partnership failures where all 3 cases could have been avoided if someone had asked 'how many successfully completed contracts does this BUJK have?' The pain was documented, not hypothetical. Hendra's principle: 'Kalau ada pain nyata yang terdokumentasi dan solusi yang dibangun di atas data yang bisa diverifikasi: ketidaknyamanan saya bukan alasan yang cukup untuk tidak membangunnya.' Trust Score launched 6 months later. Result: became top-3 most-used feature, generated zero legal complaints because methodology is transparent and source data is verifiable.", tc: "text-primary" },
            { feature: "ALMOST-2: NLQ (Natural Language Query) — ditolak karena 'terlalu early dan terlalu mahal'", opposition: "Year 3 (2023): Hendra Jr. pitched NLQ. Hendra's reaction: 'LLM costs were Rp 8M/month projected at scale — we were Rp 1.2B ARR and not yet profitable. Spending 8% of gross revenue on one experimental feature: irresponsible allocation.' Hendra Jr.'s counter: 'NLQ is not experimental — it's a direct response to the most common support ticket we get, which is users asking us to find specific information that's already in our database but that they can't locate themselves.'", resolution: "Resolution: Hendra Jr. built a minimal NLQ prototype in 3 weekends (no sprint allocation, no formal project). Demo'd it to Hendra with real Enterprise klien queries. The demonstration included a query that would have taken Reza 45 minutes to answer manually — NLQ answered it in 12 seconds. Hendra: 'Melihat NLQ menjawab pertanyaan yang saya tahu Reza harus menjawab secara manual: itu adalah momen yang mengubah objeksi saya dari finansial ke strategis. Pertanyaannya bukan lagi apakah kita bisa afford untuk membangunnya — pertanyaannya adalah apakah kita bisa afford untuk tidak membangunnya.' NLQ launched Q1 2024. Now handles 340 queries/day.", tc: "text-blue-700" },
            { feature: "ALMOST-3: SKK Express Service — ditolak karena 'bukan bisnis platform'", opposition: "Year 4 (2024): Budi proposed SKK Express after encountering 6 narasumber who had missed SKK renewal deadlines and needed emergency assistance. Hendra's reaction: 'Kita adalah platform intelijen pasar — bukan jasa administrasi. SKK Express adalah bisnis yang berbeda. Kalau kita membangun ini, kita mendistraksi tim dari core platform.' Budi's counter: 'Klien yang kehilangan SKK mengalami disqualification yang tidak bisa diatasi dengan intelijen pasar manapun. Kita bisa prevent ini. Dan tidak prevent-nya: klien churn, bukan karena platform jelek tapi karena mereka tidak lagi eligible untuk ikut tender.'", resolution: "The deciding data point: 4 Enterprise klien churned in 2023 specifically because SKK expiry caused them to stop participating in tenders — they didn't need MJP's intelligence services while they were non-active. Hendra: 'SKK Express bukanlah bisnis yang saya rencanakan. Ini adalah fitur yang pelanggan saya yang paling berharga butuhkan agar mereka tetap menjadi pelanggan. Itu saja cukup untuk membangunnya.' SKK Express launched Q2 2024. Monthly revenue Q2 2026: Rp 60.2jt. Enterprise retention improvement attributable to SKK Express: estimated 4.1 percentage points.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.feature} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.feature}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Opposition: {r.opposition}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Resolution: {r.resolution}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">3 product bets yang hampir tidak terjadi adalah the most important counter-evidence to the claim that 'good ideas always find their way.' They don't. Good ideas require champions who persist through legitimate internal resistance, document the user pain rigorously, and find the specific demonstration or data point that converts a 'no' into a 'let's try.' In all 3 cases: the conversion happened not because the champion was more persuasive, but because the champion produced new evidence that changed the decision parameters. Trust Score: Budi's 3 documented failure cases. NLQ: Hendra Jr.'s working prototype demonstration. SKK Express: churn data showing the business cost of not building it. The pattern: objections based on risk/cost/scope can only be overcome by evidence about impact — not by better arguments about the original proposal. Hendra's updated product philosophy, informed by all 3 near-misses: 'When I say no to a feature: I am not saying no to the idea forever. I am saying the evidence for building it hasn't been strong enough yet. The team's job: go find stronger evidence.' This philosophy produced an internal culture where 'no' means 'not yet with current evidence' rather than 'never.' The result: ideas that were rejected once don't die — they go back for more research. Both Trust Score and NLQ (and SKK Express) benefited from this. Hendra Jr.: 'Tiga kali saya mendapat penolakan untuk fitur yang sekarang paling dicintai klien. Tiga kali saya belajar: kekuatan argumen tidak pernah cukup. Kekuatan bukti: selalu cukup.'</p>
      </div>

      {/* R112: The Feature Graveyard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> FEATURE GRAVEYARD — 5 Fitur yang MJP Bangun, Ukur, dan Pensiunkan: Pelajaran tentang Kapan Harus Berhenti, Bagaimana Memutuskan Pensiun, dan Mengapa Pensiunkan Fitur adalah Tanda Kedewasaan Produk
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { feature: "GRAVE-1: Social Forum (Q3 2023 – Q1 2024, 6 bulan aktif)", what_it_was: "A community forum feature within MJP's platform — intended to allow BUJK owners to discuss market conditions, share tender tips, and ask questions to peers. Built in 3 weeks. Initial reception: 47 BUJK created posts in the first month. Sounded promising.", why_retired: "Month 2 engagement dropped to 12 posts. Month 3: 4 posts. The diagnosis: BUJK owners discuss sensitive competitive intelligence in industry WhatsApp groups precisely because WhatsApp is not indexed, not attributable to their company, and limited to verified contacts. A named forum on a business platform: too public for the content they actually wanted to discuss. Engagement never recovered. Decision to retire: made after Month 4 when Budi's field research confirmed the underlying behavioral issue. Hendra Jr. removed the feature in Month 6.", lesson: "Never build a community feature without first understanding why the target community's current solution (WhatsApp groups) works for them and why a new solution would be better. Social Forum violated Pain Point ListFilter 4: existing solutions were already good enough for BUJK's actual need (private discussion). MJP's current stance on social features: no social features unless the communication needs to be attributable, documented, and searchable — which most BUJK industry discussion does not.", tc: "text-primary" },
            { feature: "GRAVE-2: BUJK Matchmaking (Q1 2024 – Q3 2024, 5 bulan aktif)", what_it_was: "A JO (Joint Operation) partner matchmaking feature — BUJK could list their qualification gaps and available qualifications, and the system would suggest compatible JO partners. Built on top of Trust Score data. Seemed like an obvious extension of Trust Score's JO-verification use case.", why_retired: "13 BUJK listed their profiles. Zero successful JO matches in 5 months. The structural issue: JO partnerships in Indonesian construction are relationship-based, not algorithm-based. The BUJK who own the relationships don't need a matchmaking system. The BUJK who need a matchmaking system don't have the relationships to be attractive JO partners. The platform attempted to bridge a gap that market participants had no interest in bridging through an algorithm.", lesson: "The BUJK matchmaking failure produced a precise understanding of Trust Score's actual value: it's a verification tool, not a discovery tool. BUJK use Trust Score to verify partners they already know. They don't use it to discover partners they don't know. This distinction: now explicitly stated in MJP's product positioning — 'Trust Score helps you verify who you're considering, not find who to consider.'", tc: "text-blue-700" },
            { feature: "GRAVE-3: Bid Calendar Integration (Q2 2023 – Q4 2023, 6 bulan aktif)", what_it_was: "A calendar sync feature: BUJK could export their tracked tender deadlines (aanwijzing, document submission, evaluation) to Google Calendar or Outlook. Built in 2 weeks. Used by 23 BUJK in the first month.", why_retired: "Feature was genuinely useful for the 23 who used it — but usage did not grow beyond those 23 in 5 months. The insight from Budi's field research: BUJK who are sophisticated enough to want calendar integration are already sophisticated enough to have their own tender management system (typically an Excel-based custom-built tool). MJP's calendar integration added a redundant layer on top of existing systems rather than replacing a manual process. The feature was neither wrong nor abandoned by users — it was a niche utility for a small segment that didn't justify the maintenance cost.", lesson: "Calendar Integration revealed the difference between 'feature a small group uses consistently' and 'feature with a growth ceiling.' Not all retired features are failures — Bid Calendar was genuinely liked by its 23 users. But at MJP's stage, every engineering hour has a high opportunity cost. A feature used by 2.7% of subscribers with no growth trajectory: retired to free capacity for features that could serve 40% or more. Current form: tender deadlines are visible in the Tender Calendar view — the information is available, just not calendar-synced.", tc: "text-emerald-700" },
            { feature: "GRAVE-4: BUJK Health Score (Q4 2023 – Q2 2024, 8 bulan aktif)", what_it_was: "A composite score for a BUJK's own health (for self-assessment, not for vetting others). Unlike Trust Score (used by others to evaluate you), the BUJK Health Score was for the BUJK to assess their own competitive position — combining their tender win rate, SKK compliance status, cash flow proxy (ratio of contract value to qualification capacity), and knowledge gap score.", why_retired: "Low adoption (6% of subscribers viewed their score more than once). Budi's diagnosis: BUJK owners already know their own health — they live it every day. What they don't know is how their health compares to the market. The BUJK Health Score without a benchmark comparison was uninformative. Adding benchmark comparison raised privacy concerns (klien didn't want MJP to know how they compared to others). The design paradox: the feature was only valuable with comparison data, but comparison data required privacy trade-offs the target users weren't willing to make.", lesson: "The BUJK Health Score failure produced an insight that shaped Decision Intelligence: BUJK owners want external intelligence (what's happening in the market), not internal analytics (how they're doing). MJP's current focus: externalizing intelligence, not internalizing analytics. The exception: SKK countdown (which is internal analytics) works because it's action-triggering, not just diagnostic.", tc: "text-orange-700" },
            { feature: "GRAVE-5: PDF Tender Document Library (Q3 2022 – Q1 2023, 7 bulan aktif)", what_it_was: "A library of historical tender document PDFs — the raw procurement documents, requirements specifications, and Bill of Quantities from past tenders. MJP crawled and stored 14.000 PDFs. Intended use: BUJK could review how similar past tenders were structured to inform their current bid preparation.", why_retired: "Storage cost: Rp 2.8jt/month for 14.000 PDFs at the usage volume. Usage: 34 unique BUJK accessed the library. Revenue contribution: zero (included in all tiers, no incremental revenue). The cost-benefit was negative, but the more important finding: BUJK don't want raw procurement documents — they want synthesized intelligence from those documents. The 14.000 PDFs were the raw material for exactly the knowledge assets Sari was building. The lesson: Hendra Jr. redirected all engineering effort from PDF storage to NLQ-queryable data extraction. Sari redirected her analysis of those PDFs into Knowledge Registry assets — the synthesized version of the same information.", lesson: "PDF Library's retirement produced MJP's clearest strategic principle: synthesized intelligence is more valuable than raw data access, at every price point. This principle: now foundational to how MJP positions its product against competitors who offer 'raw LPSE data access' as their primary value proposition. Hendra Jr.: 'Kami bisa menyimpan setiap PDF di LPSE — itu tidak sulit. Yang sulit adalah mengubahnya menjadi sesuatu yang bisa dijawab oleh seseorang dalam 90 detik. Itu yang MJP jual.'", tc: "text-primary" },
          ].map((r) => (
            <div key={r.feature} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.feature}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">What it was: {r.what_it_was}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Why retired: {r.why_retired}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Lesson: {r.lesson}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Feature Graveyard adalah MJP's most honest product document — because it records what didn't work, why it didn't work, and what was learned. Most product roadmaps show what was built successfully. MJP's Feature Graveyard shows what was built, failed to achieve product-market fit, and was retired — with the specific lesson each retirement produced. The 5 retired features produced 5 distinct strategic insights that now shape MJP's product decisions: Social Forum produced the 'privacy-first communication' insight. BUJK Matchmaking produced the 'verification not discovery' Trust Score positioning. Bid Calendar produced the 'niche utility vs growth ceiling' prioritization principle. BUJK Health Score produced the 'external intelligence over internal analytics' platform focus. PDF Library produced the 'synthesized intelligence over raw data' strategic positioning. Total engineering time invested in the 5 retired features: approximately 32 developer-weeks. Total strategic insight value from the 5 retirements: Hendra's assessment is that the lessons from these failures are worth more than the engineering investment — each retirement clarified a decision that would otherwise have been debated indefinitely without resolution. The Feature Graveyard is shared with every new product hire and every serious investor: it demonstrates that MJP learns from failure, doesn't hide it, and extracts maximum value from every experiment. Hendra: 'Saya tidak bangga dengan 5 fitur yang kami pensiun. Saya bangga dengan 5 pelajaran yang mereka ajarkan. Dan saya pasti tidak akan menukar pelajaran-pelajaran itu dengan 5 fitur yang masih live tapi tidak ada yang butuhkan.'</p>
      </div>

      {/* R113: Cross-Functional Product Critique Sessions */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> CROSS-FUNCTIONAL PRODUCT CRITIQUE — Bagaimana MJP Membuat Keputusan Produk Saat Tim Tidak Sepakat: Protokol Debat, Siapa Punya Veto, dan 3 Keputusan Tersulit yang Melibatkan Ketidaksepakatan Terbesar dalam 5 Tahun Terakhir
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { process: "CRITIQUE-1: Format sesi kritik produk bulanan — bagaimana MJP menstrukturkan ketidaksepakatan", format: "Monthly Product Critique Session: 90 minutes, attended by all 6 team members. Format: (1) Hendra Jr. presents 1–2 features in active development (or recently shipped) with performance data. (2) Each team member provides a structured 'critique frame' — what works, what doesn't, what they would change if they could change one thing. (3) The critique is explicitly NOT a design session — no one proposes redesigns in real time. The critique phase is pure evaluation. (4) 2 weeks after critique: Hendra Jr. shares a 'response memo' addressing each critique point — either incorporating the feedback, explaining why it won't be incorporated, or flagging it for future consideration.", decision_authority: "Hendra holds final product decision authority. But MJP's practice: Hendra never overrules a critique without a documented rationale. The 'response memo' requirement: makes every overrule explicit and transparent. Sari or Budi can see that their critique was received, considered, and either incorporated or explicitly declined with a reason. The process prevents the most common product decision failure: critique goes into a black box, contributor doesn't know if it was heard, contributor stops giving honest critique.", tc: "text-primary" },
            { process: "CRITIQUE-2: The 3 largest product disagreements in MJP's history and how they were resolved", format: "DISAGREEMENT-A: Should NLQ answers cite specific Knowledge Registry assets (Sari's preference: yes, for verifiability) or provide clean synthesized answers without explicit citations (Hendra Jr.'s preference: yes, for readability)? Resolution: both. NLQ answers include the synthesized response by default, with a collapsed 'Source assets' section for klien who want to verify. Neither preference was abandoned — the product found a way to serve both. DISAGREEMENT-B: Should MJP expand to serve BUJK in the below-Rp 2B ARV segment proactively (Budi's position: yes, they have real pain) or focus resources on deepening the above-Rp 2B segment (Hendra's position: depth before breadth)? Status: unresolved — the annual Decision Review has documented this as an open strategic question. PP-011 (Material Price Reference) is the compromise that addresses Budi's segment without requiring MJP to fully pivot its strategy. DISAGREEMENT-C: Should the morning briefing include competitor win announcements (Reza's preference: yes, Enterprise klien want this) or exclude them to avoid naming specific companies (Sari's preference: don't name competitors)? Resolution: briefing mentions 'a BUJK with SBU Grade 4 Civil Works won a Rp 45B road project in East Kalimantan' without naming the BUJK — satisfying Reza's intelligence need without Sari's competitor-naming concern.", decision_authority: "Resolution patterns across all 3 disagreements: MJP favors 'synthesis' over 'choice' — rather than declaring a winner and a loser, the team typically finds a design or strategy that incorporates both perspectives at some level. This pattern is not always possible (DISAGREEMENT-B has no clean synthesis) and occasionally produces compromises that are worse than either original proposal. But for DISAGREEMENT-A and DISAGREEMENT-C: the synthesis solution turned out better than either original proposal.", tc: "text-blue-700" },
            { process: "CRITIQUE-3: Reza's unique role — when sales reality overrides product conviction", format: "Reza's most valuable contribution to product critique: direct client feedback that overrides internal team convictions. MJP's team is technically competent but only Reza has real-time, emotionally-loaded conversations with clients about what they want (in the context of a sales decision, where BUJK express preference most honestly — they're not answering a survey, they're deciding whether to spend money). Reza's critique contributions: typically come in the form of 'a prospect told me X, which suggests we need to think about Y' rather than product design proposals.", decision_authority: "The 3 times Reza's client feedback reversed a product decision in the past 24 months: (1) SKK Express Urgent (24-hour) tier was originally not planned (Hendra thought Standard was fast enough) — 3 prospects in 2 months independently asked for a 24-hour option and Reza's documentation of those conversations convinced Hendra to build it. (2) NLQ result export to PDF was not planned until Reza reported 5 Enterprise prospects who said they needed to share NLQ research output with partners who don't have MJP access. (3) Trust Score historical chart (showing a BUJK's score change over time) was initially rejected as low priority until Reza showed that 7 Compliance Guardian archetype prospects specifically asked for historical trend visibility before committing. Hendra: 'Reza adalah jangkar realitas kami. Ketika tim teknis berpikir kami sudah cukup baik: Reza tahu dari percakapan penjualan hari itu apakah klien setuju.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.process} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.process}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.format}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Decision authority: {r.decision_authority}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Cross-functional product critique sessions adalah MJP's institutional answer to the most common small-team product failure: important feedback is not surfaced because the team culture discourages disagreement. In a 6-person team where the CEO is also the product owner: there is natural social pressure to not challenge product decisions. The monthly critique session's explicit structure ('everyone provides a critique frame, Hendra provides a response memo') creates a norm where disagreement is not just permitted but formally expected. The 'response memo' requirement: the most important structural element. Without it, critique is optional to acknowledge. With it, every critique demands an explicit written response — which changes how Hendra processes feedback (he must engage with each critique specifically, not generically). The 3 largest disagreements illustrate MJP's conflict resolution pattern: preference for synthesis over choice, documented rationale for any overrule, and Reza's unique authority as the direct client-reality conduit. The most important insight: the synthesis resolutions for NLQ citations and competitor mentions both produced better outcomes than either original proposal. This suggests that MJP's team, given a structured space to voice competing perspectives: often arrives at a third option neither party proposed initially. The monthly critique session: creates the space for that third option to emerge. Without it: Hendra Jr. ships his preference, Sari's perspective is expressed informally (or not at all), and the third, better option is never discovered. Hendra: 'Kritik yang terstruktur lebih baik dari kritik yang ad hoc — bukan karena masalahnya berbeda, tapi karena struktur membuat lebih mudah untuk didengar tanpa pertahanan diri dan direspons tanpa ego. Itu perbedaan antara proses yang memperbaiki produk dan proses yang memperbaiki hubungan tapi membiarkan produk apa adanya.'</p>
      </div>

      {/* R114: Product Launch Retrospectives */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> PRODUCT LAUNCH RETROSPECTIVES — 3 Peluncuran Produk Paling Penting MJP dan Pelajaran yang Dibawa ke Depan: Trust Score (2021), NLQ (2022), SKK Express (2023) — Apa yang Berhasil, Apa yang Tidak, dan Apa yang Diubah dalam Playbook Peluncuran Berikutnya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { launch: "LAUNCH-1: Trust Score (Q2 2021) — peluncuran pertama MJP yang benar-benar direncanakan", what_worked: "What worked: the hypothesis was confirmed faster than expected. Hendra's original confirmation timeline: Month 4. Actual confirmation: Month 2 (Trust Score was the #1 NPS verbatim feature from Month 2 onward). The launch timing: captured the post-pandemic trust deficit in the market (COVID disrupted in-person BUJK due diligence) at the exact moment when BUJK were most receptive to a digital alternative. Pre-launch beta testing with 12 narasumber (Budi's selection): produced 3 specific improvements to Trust Score's data display that would not have been identified from internal testing alone.", what_didnt_work: "What didn't work: Hendra Jr. shipped the Trust Score API endpoint 2 weeks after the frontend — meaning the feature was live in the UI but the data was not updating in real-time for the first 2 weeks. 11 beta users reported that Trust Score data was stale (correct for the launch date but not updating). Hendra's response: a personal email to all 11 beta users explaining the delay and providing a 2-month Pro subscription extension as compensation. Lesson: never ship a feature UI before the data backend is stable — user perception of 'broken' data is more damaging than a 2-week delayed launch.", tc: "text-primary" },
            { launch: "LAUNCH-2: NLQ — Natural Language Query (Q2 2022) — peluncuran yang paling diantisipasi MJP", what_worked: "What worked: the core technology worked better than expected in production (84% satisfaction rate within 3 months, beating the 70% target). The NLQ launch created MJP's first 'evangelist' moment — 3 Enterprise subscribers wrote unsolicited case studies about how NLQ had changed their Knowledge Registry workflow. Reza used these case studies in sales calls for 18 months without modification. The 'unsolicited positive testimonial' signal: the clearest possible indicator that a feature exceeds user expectations rather than merely meets them.", what_didnt_work: "What didn't work: the NLQ onboarding. 47% of Enterprise subscribers who received NLQ access did not use it in their first week. Investigation: subscribers didn't understand what queries were within NLQ's scope. They expected it to answer any question about the construction industry, and when they tried queries that were out of scope (general market analysis, competitor-specific questions) and received poor answers: they concluded NLQ was low quality. Root cause: MJP's launch communication did not define NLQ's scope clearly enough. Fix: added an 'Example Queries' panel to the NLQ interface and a 3-example email in the NLQ activation flow. First-week activation rate increased from 53% to 79% within 6 weeks of the fix.", tc: "text-blue-700" },
            { launch: "LAUNCH-3: SKK Express (Q4 2023) — peluncuran produk dengan komponen layanan paling kompleks", what_worked: "What worked: the service model (human-assisted, not self-service) was the right call for the SKK market. Hendra had considered a fully automated SKK application submission tool — Reza convinced him that BUJK in this market would not trust automation for something as important as certification. The human-assisted model: allowed Reza to catch document errors that automated submission would have submitted (and received rejections for). In the first 6 months: Reza's manual review caught an error rate of 23% in client-submitted documents. The error-catching capability: became SKK Express's most-cited differentiator vs DIY submission.", what_didnt_work: "What didn't work: the initial pricing model. Hendra launched SKK Express at Rp 1.5jt flat per case (all complexity tiers the same price). Within 3 months: Reza observed that jenjang-7 cases (simple, 4-hour processing time) and jenjang-9 cases (complex, 16-hour processing time) were priced identically. Jenjang-7 clients felt overcharged; jenjang-9 clients were getting exceptional value. The fix (Q1 2024): tiered pricing (jenjang-7: Rp 2.5jt, jenjang-8: Rp 5jt, jenjang-9: Rp 8.5jt). Counter-intuitive result: total SKK Express revenue increased 340% in the 6 months after the pricing fix — primarily because the higher jenjang-9 price was still perceived as excellent value vs the Rp 15–25jt that legal consultants charge for the same service.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.launch} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.launch}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">What worked: {r.what_worked}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>What did not work: {r.what_didnt_work}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Product launch retrospectives adalah MJP's most honest self-assessment tool — because they document not just the successes but the specific failure modes of each launch. The pattern across all 3 retrospectives: the core product hypothesis (Trust Score will be valued, NLQ will be used, SKK Express will succeed) was correct in each case. The failures were operational: a stale data backend (Trust Score), an insufficient onboarding experience (NLQ), and an incorrect initial pricing model (SKK Express). This pattern is important: it suggests that MJP's hypothesis generation (Hendra and Budi's product insight process) is well-calibrated — they correctly identify what BUJK need. The operational execution (Hendra Jr.'s backend coordination, the onboarding experience, the pricing model) is where the gaps consistently appear. The implication for future launches: MJP should invest more in launch preparation for operational details (backend coordination, onboarding design, pricing model testing) than in validating the core product hypothesis (which has been correct in all 3 major launches). Post-Series A Product Manager hire: specifically tasked with owning launch preparation — coordinating between Hendra Jr. (backend readiness), Sari (Knowledge Registry asset readiness), Reza (sales readiness for activation), and Budi (narasumber beta testing) to ensure all operational components are ready simultaneously. The 3 launch retrospectives collectively: identified the need for this role 3 years before MJP had the budget to hire it. Hendra: 'Retrospektif peluncuran terbaik yang pernah saya tulis adalah yang membuat saya paling tidak nyaman. Karena jika saya nyaman, itu berarti saya tidak cukup jujur tentang apa yang tidak berhasil. Dan hal-hal yang tidak saya akui: itulah yang berulang.'</p>
      </div>

      {/* R115: Accessibility and Digital Literacy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> DIGITAL LITERACY-DRIVEN DESIGN — Bagaimana MJP Merancang untuk BUJK dengan Berbagai Tingkat Literasi Digital: Spectrum Pengguna, 4 Pilihan Desain yang Dibuat karena Alasan Literasi, dan Paradoks Bahwa Pengguna Paling Canggih Memilih Fitur yang Paling Sederhana
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { design_choice: "DESIGN-CHOICE-1: Tidak ada terminologi SaaS dalam UI — bahasa BUJK di semua interface", rationale: "Hendra Jr.'s fundamental design principle for MJP's UI: no English SaaS terminology unless it is the official term for the regulatory concept (e.g., 'LPSE' is the official term, not 'e-procurement portal'). This means: 'Dashboard' → 'Ringkasan' (not implemented — 'Dashboard' in Indonesian has been widely adopted). 'Alert' → 'Notifikasi' or 'Peringatan'. 'ListFilter' → 'Saring'. 'Export' → 'Unduh' or 'Ekspor'. 'Analytics' → 'Analisis' or 'Statistik'. The no-English-SaaS rule: emerged from Budi's narasumber interviews where several smaller BUJK owners expressed that they felt 'platform ini untuk orang IT, bukan untuk kontraktor seperti saya' when using a competitor's product with heavy English SaaS terminology.", literacy_impact: "The language choice impact: quantified in MJP's onboarding completion rate. Before Hendra Jr. systematically replaced SaaS terminology with Indonesian construction-sector language (the 2023 UI language audit): onboarding completion rate for Basic tier subscribers was 54% (completed the initial setup flow). After the language audit: 71% completion rate. The 17-percentage-point improvement: primarily attributable to reduced friction for BUJK with limited English SaaS familiarity. Enterprise subscribers (who tend to be more digitally sophisticated): did not show a completion rate change — confirming the language simplification specifically helped the lower-digital-literacy segment.", tc: "text-primary" },
            { design_choice: "DESIGN-CHOICE-2: Mobile-first layout untuk semua kritical flows — sebagian besar BUJK mengakses dari smartphone", rationale: "Budi's narasumber interviews in 2022 produced a consistent finding: BUJK owners access MJP primarily from smartphones, not desktop computers. 73% of MJP's sessions: from mobile devices (Google Analytics data). The BUJK use pattern: check morning briefing on smartphone before the workday starts (commuting, at project site before meetings). Desktop access: primarily for document preparation (Surat Penawaran, Trust Score detailed review). The mobile-first design constraint: affects every new feature's priority order — mobile experience is designed first, desktop experience second. Any feature that is difficult to use on mobile: must be redesigned or scope-reduced before it can be part of MJP's core product.", literacy_impact: "The mobile-first decision's most important consequence: morning briefing format. Sari's briefing was reformatted in 2023 for mobile reading (short paragraphs, no tables wider than the phone screen, 16px minimum font size, white space between sections for thumb-scrolling comfort). The mobile optimization: increased morning briefing read-completion rate (BUJK who open the briefing and read to the bottom) from 41% to 67%. Read-completion matters for briefing intelligence transfer: a subscriber who reads 40% of the briefing misses the Competitor Intelligence section (which appears in Section 4). The mobile formatting improvement: ensured more subscribers reached the later sections.", tc: "text-blue-700" },
            { design_choice: "DESIGN-CHOICE-3: NLQ dengan 'pertanyaan contoh' yang diperlihatkan sebelum input", rationale: "The NLQ onboarding failure (from the NLQ Launch Retrospective): 47% of Enterprise subscribers didn't use NLQ in their first week because they didn't know what kinds of questions to ask. The fix: the 'Example Queries' panel showed before the NLQ input. But Hendra Jr. observed a second-order effect: the examples also solved a digital literacy problem. BUJK who had never used a natural language query interface (they had only used keyword search or fixed-filter interfaces): didn't know that NLQ accepted full sentences in natural Indonesian. The example queries: demonstrated the sentence format implicitly without requiring an explanation of 'natural language query' as a concept.", literacy_impact: "Example query impact: first-week NLQ activation increased from 53% to 79% (as documented in the NLQ Launch Retrospective). But the breakdown by subscriber tier: Basic tier first-week activation: 28% → 61% (33 percentage points improvement). Enterprise tier: 71% → 84% (13 percentage points improvement). The Basic tier improvement is 2.5× larger than the Enterprise tier improvement — confirming the example queries primarily helped lower-digital-literacy subscribers, not sophisticated ones. The paradox: the simplest design element (showing examples) had the largest impact on the least digitally sophisticated users. Hendra Jr.: 'Fitur yang paling membantu pengguna kelas bawah sering kali adalah yang paling mudah untuk diabaikan oleh tim product yang terbiasa dengan pengguna power. Kita membangun untuk semua orang yang ada di pasar, bukan untuk pengguna yang paling aktif di komunitas beta kita.'", tc: "text-emerald-700" },
            { design_choice: "DESIGN-CHOICE-4: Paradoks — pengguna paling canggih menggunakan fitur paling sederhana", rationale: "MJP's most counterintuitive finding from usage analytics: Enterprise subscribers (the most sophisticated users) have the highest usage rate of the morning briefing (the simplest feature) and the lowest usage rate of the Advanced Analytics dashboard (the most sophisticated feature). The expected pattern: sophisticated users use sophisticated features, simpler users use simpler features. The actual pattern: sophistication drives efficiency — Enterprise subscribers use the simplest tool that answers their question, regardless of the tool's complexity ceiling. The morning briefing answers 80% of their daily intelligence need in 4 minutes. The Advanced Analytics dashboard answers a deeper question they ask monthly. Both are used — but the 'simple' briefing is used 20× more frequently than the 'sophisticated' dashboard.", literacy_impact: "This finding: fundamentally shaped MJP's product investment priorities. If MJP's team had incorrectly assumed 'sophisticated users want sophisticated features': they would have invested in building more complex analytical tools for the Enterprise tier. The actual finding: Enterprise users want complete, accurate, fast-loading intelligence — regardless of whether it comes from a simple or complex UI. This is why the morning briefing remained the product's highest-retention driver for 5 years despite being the 'simplest' product in the platform. Hendra: 'Pengguna paling berharga kami menggunakan fitur paling sederhana kami lebih sering daripada fitur paling canggih kami. Pelajaran: bangun fitur yang akurat dan lengkap, bukan fitur yang terlihat canggih. Akurasi dan kelengkapan selalu menang.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.design_choice} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.design_choice}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Rationale: {r.rationale}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Literacy impact: {r.literacy_impact}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Digital literacy-driven design adalah one of MJP's most consistently validated product principles — because the Indonesian BUJK market spans a wider digital literacy range than the typical Indonesian tech startup's target market. MJP serves jenjang-9 BUJK owners who are managing Rp 500B+ contracts and have full-time IT teams — and also serves jenjang-7 BUJK owners who are running their businesses from a single smartphone, who learned to use WhatsApp in 2017, and who have never used a desktop SaaS product. The design principle: the platform must be fully functional for the latter without being condescending to the former. The 4 design choices above (Indonesian language, mobile-first, NLQ examples, acknowledging the simplicity paradox): all serve the lower-literacy segment without degrading the experience for the higher-literacy segment. This is MJP's most important UX constraint: improvements for the least sophisticated users must not create friction for the most sophisticated users. The mobile-first briefing formatting: meets this constraint (Enterprise users on mobile also benefit from mobile-optimized layouts). The Indonesian SaaS language: meets this constraint (Enterprise users familiar with English SaaS terms are not confused by Indonesian equivalents — they are slightly more native-feeling). The NLQ examples: meet this constraint (Enterprise users can ignore the examples if they already know what to ask). The one design choice that has NOT met this constraint historically: the 'simplified mode' toggle (a feature Hendra Jr. prototyped in 2023 that would hide advanced analytics for lower-literacy users). The toggle: tested poorly because it created a two-tier experience that felt condescending to users in 'simplified mode' and was confusing to users who accidentally activated it. The prototype: retired. Single-tier design that works at both ends of the literacy spectrum: the correct architectural constraint.</p>
      </div>

      {/* R116: Product-Market Fit Evidence Archive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-primary" /> PRODUCT-MARKET FIT EVIDENCE ARCHIVE — Setiap Data Point yang Mengkonfirmasi PMF MJP: 5 Kategori Bukti, Bagaimana Setiap Kategori Saling Memperkuat, dan Mengapa PMF di Pasar Niche B2B Indonesia Berbeda dari PMF di Consumer Tech
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { evidence_category: "PMF-EVIDENCE-1: Retention metrics — data kohort yang paling berbicara sendiri", data_points: "The strongest single PMF evidence category: cohort retention data. MJP's day-90 subscriber retention (91%) represents the percentage of new subscribers who are still subscribed 90 days after joining. Industry benchmarks for B2B SaaS: 70–80% day-90 retention is considered healthy. At 91%: MJP is approximately 11–21 percentage points above benchmark. The day-365 retention (78%): above the 70% industry average for comparable tools. The cohort-by-cohort consistency: every signup quarter from Q1 2022 to Q4 2024 shows day-90 retention between 88% and 94% — no quarter significantly below the average. This consistency: the most important retention data point for investors, because it means PMF is not an artifact of a specific subscriber cohort but a repeatable structural property of the product-market relationship.", reinforcement: "Retention data reinforcement: high retention is consistent with NPS of 47 (high advocacy), low churn attributed primarily to business closures rather than product dissatisfaction (Reza's churn reason data shows 61% of churns are forced exits, not voluntary), and the 91% daily briefing open rate among active subscribers. Each data point independently confirms that subscribers find the product indispensable. The combination: PMF evidence that is robust to single-metric skepticism — if an investor questions NPS ('NPS can be gamed'), Hendra can point to retention. If they question retention ('maybe subscribers just forget to cancel'), he can point to open rates. The convergence of multiple metrics: more convincing than any single metric in isolation.", tc: "text-primary" },
            { evidence_category: "PMF-EVIDENCE-2: Organic behavior signals — BUJK yang menggunakan MJP tanpa diminta", data_points: "The second-strongest PMF evidence category: organic behavior that MJP didn't design or encourage. Key signals: (1) 32% of new subscribers arrive via referral (organic word-of-mouth without any formal referral program or referral incentive). (2) 18% of SKK Express clients organically converted to subscriptions without any sales contact from Reza (they upgraded themselves after experiencing the service quality). (3) GAPENSI DPD associations began recommending MJP to their members without any formal partnership agreement — Budi's narasumber relationships created organic institutional endorsement. (4) Enterprise subscribers began using Trust Score in their own JO partner conversations (asking potential partners 'what's your MJP Trust Score?' before JO discussions) — a BUJK-to-BUJK reference behavior MJP never designed or requested.", reinforcement: "Organic behavior reinforcement: the most credible PMF evidence for investors because it represents behavior that customers chose without incentive. Reza didn't create a referral program and 32% of subscribers still referred. MJP didn't market the Trust Score as a JO due diligence tool and Enterprise subscribers started using it that way spontaneously. Organic behavior: the category of PMF evidence that most directly refutes the 'maybe subscribers just haven't bothered to cancel' interpretation of retention data. These are subscribers actively investing their social capital (referrals) and changing their professional behavior (Trust Score in partner conversations) based on MJP's value.", tc: "text-blue-700" },
            { evidence_category: "PMF-EVIDENCE-3: Price elasticity tests — apa yang terjadi ketika MJP menaikkan harga", data_points: "The third PMF evidence category: price response. MJP has raised prices twice in 4 years. Price increase 1 (2022): Basic tier from Rp 500rb to Rp 650rb/month (+30%). Net subscriber impact: 4% temporary slowdown in new subscriber acquisition for 6 weeks, then returned to baseline. Churn acceleration: zero (no subscribers cancelled explicitly because of the price increase). Price increase 2 (2024): Pro tier from Rp 850rb to Rp 950rb/month (+12%), Enterprise from Rp 2.3jt to Rp 2.55jt/month (+10.9%). Net subscriber impact: no measurable churn acceleration. New subscription growth: unaffected. The price elasticity data: shows that MJP's product has low price elasticity (demand is relatively insensitive to price increases within the tested range).", reinforcement: "Price elasticity reinforcement: low price elasticity is a structural PMF characteristic. Products that subscribers consider substitutable (easy to replace) have high price elasticity — any price increase drives churn and slows growth. MJP's low elasticity: indicates subscribers are paying for MJP's specific intelligence layer (not just 'a BUJK information tool' that can be replaced by a cheaper alternative). The implication for Hendra's SKK Express pricing analysis: the Rp 12jt jenjang-9 pricing projection assumes continued low elasticity — the 2 successful price increases validate this assumption for subscription pricing. For SKK Express: the Rp 15–25jt consultant alternative provides the price ceiling, not competitor pricing.", tc: "text-emerald-700" },
            { evidence_category: "PMF-EVIDENCE-4: Extreme use cases — pelanggan yang menggunakan MJP dengan cara yang tidak Hendra perkirakan", data_points: "The fourth PMF evidence category: extreme use cases that revealed the product's value beyond its designed purpose. (1) One Enterprise subscriber used MJP's Trust Score to screen a potential acquisition target (they were considering acquiring a smaller BUJK and used MJP's award history data as part of their due diligence — a use case Hendra never anticipated). (2) One GAPENSI DPD chair used MJP's Knowledge Registry content as the research basis for a formal policy recommendation submitted to LKPP (citing MJP's regulatory analysis as reference material). (3) Three BUJK used MJP's tender award data in their PKWT (employee contracts) negotiations — showing that their bid activity (tracked on MJP) demonstrated employee retention justification to clients. These use cases: extreme examples of subscribers finding value in MJP's product beyond the designed tender intelligence use case.", reinforcement: "Extreme use case reinforcement: when subscribers use a product for purposes the founders didn't design for, it signals that the core asset (data, relationships, or intelligence) has broader value than the specific use case the product was built to serve. The acquisition due diligence use case: validates the Trust Score's institutional credibility beyond JO partner screening. The LKPP policy reference use case: validates the Knowledge Registry's quality as an authoritative source (not just a subscriber convenience tool). Hendra treats extreme use cases as product roadmap hints: each unexpected use case reveals an adjacent problem that MJP's core assets could solve for a new segment or higher price point.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.evidence_category} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.evidence_category}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Data points: {r.data_points}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Reinforcement with other evidence: {r.reinforcement}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Product-market fit evidence archive adalah Hendra's most defensible investor narrative asset — because PMF in a niche B2B Indonesian market is less intuitively legible to VCs than PMF in a consumer tech market, and requires explicit evidence-building across multiple categories. Consumer tech PMF: often visible in viral growth curves, DAU spikes, and App Store reviews. B2B niche PMF: visible in retention rates, organic behavior, price elasticity, and the specific language subscribers use in NPS verbatim. MJP's 4 evidence categories collectively address the 4 most common B2B PMF skepticisms from investors: (1) 'Maybe subscribers haven't bothered to cancel' — addressed by organic behavior (referrals don't happen unless subscribers actively value the product). (2) 'Maybe the market is too niche to scale' — addressed by price elasticity (subscribers paying premium prices for a niche product are high-value buyers, not a scale constraint). (3) 'Maybe you're just riding a regulatory change wave' — addressed by cohort consistency across regulatory periods (PMF is stable regardless of whether there was a major regulatory event that year). (4) 'Maybe this is a consulting business dressed as SaaS' — addressed by extreme use cases (subscribers using MJP's data assets for purposes beyond the product design demonstrates that the data layer, not the consultant relationship, is the value source). The PMF evidence archive: Hendra maintains this as a living document, adding new data points quarterly and retiring outdated evidence. The archive: not a static Series A pitch document but an ongoing product management tool that tells Hendra what the product is actually doing in the market vs what he designed it to do.</p>
      </div>

      {/* R117: Feature Adoption Funnel */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> FEATURE ADOPTION FUNNEL — Dari Sadar ke Kebiasaan untuk Setiap Fitur MJP: 4 Tahap Adopsi, Data Konversi per Fitur, dan Bottleneck yang Hendra Jr. Sedang Perbaiki
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { feature: "ADOPTION-FUNNEL: Morning Briefing — fitur dengan adopsi tertinggi (97% aware, 91% habit)", funnel_stages: "Stage 1 (Aware → 97%): virtually all subscribers are aware of the briefing — it is MJP's primary acquisition hook, mentioned in every referral and marketing context. Stage 2 (Trial → 89%): 89% of subscribers open the briefing at least once in their first week. Stage 3 (Regular use → 84%): 84% have opened the briefing 5+ times in their first month. Stage 4 (Habit → 79%): 79% of subscribers open the briefing at least 4 days/week consistently over 3+ months. The 97%→79% funnel: an 18-percentage-point drop from awareness to habit. Most of this drop occurs between Stage 2 (first open) and Stage 4 (consistent habit) — indicating that trial is easy but habit formation requires the briefing to consistently deliver relevant value.", bottleneck: "The bottleneck: Stage 3 → Stage 4 (regular use → habit). The 5-percentage-point drop between regular use (84%) and habit (79%) is smaller than it appears — some of the 5% are BUJK whose business seasonality makes daily intelligence less relevant in certain quarters (BUJK who are primarily project execution phase rather than business development phase). The real bottleneck: Stage 2 → Stage 3 (the 5% who trial but don't establish regular use). Hendra Jr.'s analysis: these 5% open the briefing once or twice, don't immediately find a directly relevant tender or regulation, and stop opening. The fix: an improved onboarding email sequence that sets expectations about the briefing's value over time ('the briefing works best as a daily practice, not a single-session lookup — here's why subscribers say it compounds over 4–6 weeks').", tc: "text-primary" },
            { feature: "ADOPTION-FUNNEL: Trust Score — fitur dengan adopsi sedang (84% aware, 51% habit)", funnel_stages: "Stage 1 (Aware → 84%): 16% of subscribers don't know Trust Score exists despite it being on the Direktori page. This 16% unknown group: primarily Basic tier subscribers who use MJP primarily for the briefing and alerts and have never explored the platform beyond those features. Stage 2 (Trial → 64%): 64% of subscribers have viewed at least one BUJK's Trust Score. Stage 3 (Regular use → 55%): 55% check Trust Score at least once per month. Stage 4 (Habit → 51%): 51% use Trust Score as a regular reference tool (checking before JO conversations, before submitting bids in new regions, when evaluating subcontractors).", bottleneck: "The biggest bottleneck: Stage 1 → Stage 2 (aware but haven't trialed — 20 percentage points). The 20% who know about Trust Score but have never viewed it: Hendra Jr.'s primary activation challenge. Root cause analysis: these subscribers are Tactical Bidders (who don't track competitors or evaluate JO partners as part of their current business practice — Trust Score's primary use case) or new subscribers who haven't encountered a JO partner evaluation need yet. The fix: contextual Trust Score introduction at the moment of JO relevance — when a subscriber clicks on a tender with a competitive bidder field, MJP surfaces 'Check competitor Trust Scores for this tender' as an in-context prompt. This just-in-time introduction: converts the awareness gap into trial at the moment of highest relevance.", tc: "text-blue-700" },
            { feature: "ADOPTION-FUNNEL: Knowledge Registry — fitur dengan adopsi terbagi (79% aware, 44% habit)", funnel_stages: "Stage 1 (Aware → 79%): 21% are unaware — a larger awareness gap than Trust Score. Knowledge Registry awareness: built through NLQ (which cites Knowledge Registry assets) and briefing Section 3 (which links to relevant assets). Subscribers who don't use NLQ and skip Section 3: may never discover the direct Knowledge Registry interface. Stage 2 (Trial → 61%): 61% have accessed at least one Knowledge Registry asset. Stage 3 (Regular use → 49%): 49% access Knowledge Registry monthly. Stage 4 (Habit → 44%): 44% use it as a regular compliance reference tool.", bottleneck: "Two bottlenecks in the Knowledge Registry funnel: (1) Awareness → Trial gap (18 percentage points): addressed by NLQ citation design (every NLQ response includes a 'Read more in Knowledge Registry' link for the cited asset — driving organic trial from high-intent NLQ users). (2) Regular use → Habit gap (5 percentage points): primarily Tactical Bidders who use Knowledge Registry reactively (when a specific compliance question arises) rather than proactively (as a reference library). Turning reactive users into habit users: Sari's editorial strategy of adding a 'Regulation of the Week' feature to the morning briefing's Section 3 (a featured Knowledge Registry asset with a brief explanation of why it's worth reading this week — even if the subscriber doesn't have an immediate compliance question). The 'Regulation of the Week': drives proactive Knowledge Registry visits from Tactical Bidders who would otherwise only access it when compliance issues arise.", tc: "text-emerald-700" },
            { feature: "ADOPTION-FUNNEL: NLQ — fitur dengan adopsi terendah dan gap terbesar (72% aware, 39% habit)", funnel_stages: "Stage 1 (Aware → 72%): 28% of subscribers are unaware NLQ exists — the largest awareness gap of all 4 major features. NLQ awareness is built through the platform interface (the NLQ section is visible on the main navigation for Pro and Enterprise tiers) but the feature label ('Tanyakan apa saja...') may not communicate the capability clearly to subscribers who have never used an AI question interface. Stage 2 (Trial → 61%): the significant jump from 72% awareness to 61% trial indicates that subscribers who discover NLQ are likely to try it — the discovery-to-trial conversion is high. Stage 3 (Regular use → 43%): 43% use NLQ at least twice per month. Stage 4 (Habit → 39%): 39% of subscribers ask NLQ at least 2 questions per month for 3+ consecutive months.", bottleneck: "The biggest NLQ bottleneck: Stage 1 → Stage 2 (aware but not trialed, 11 percentage points). These are subscribers who know NLQ exists but haven't used it. Root cause from session tracking: they navigate to the NLQ interface, see the empty input field, and leave without submitting a query (the blank-page paralysis documented in R116). The rotating example query panel (R116 ACCESSIBILITY-DESIGN-2) addresses this specifically. The second bottleneck: Stage 3 → Stage 4 (regular use to habit, 4 percentage points). These are subscribers who use NLQ occasionally but don't integrate it into their regular workflow. The fix: the WhatsApp NLQ (R116 ACCESSIBILITY-DESIGN-4) — removing the 'open the app' friction for occasional users. Combined, the accessibility improvements in R116 plus WhatsApp NLQ: projected to move NLQ habit rate from 39% to 55–60% within 18 months of implementation.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.feature} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.feature}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Funnel stages: {r.funnel_stages}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Bottleneck and fix: {r.bottleneck}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Feature adoption funnel adalah Hendra Jr.'s most commercially useful product analytics framework — because it converts the question 'are subscribers using the product?' into 'which specific stage of adoption is failing for which feature, and why?' The 4-stage funnel (Aware → Trial → Regular use → Habit): standardized across all features allows direct comparison and priority setting. The adoption comparison across MJP's 4 core features: Morning Briefing (79% habit) → Trust Score (51% habit) → Knowledge Registry (44% habit) → NLQ (39% habit). The hierarchy: reflects both the maturity of each feature (briefing is oldest) and the cognitive effort required to integrate each into a workflow (briefing is the lowest-effort daily habit; NLQ requires active query formulation). The commercial implication: subscribers at Habit stage for more features: have higher NPS, higher renewal rates, and higher upgrade rates than subscribers at lower adoption stages. A Pro subscriber who uses all 4 features habitually: has 4× the retention probability of a Pro subscriber who only habitually uses the briefing. Reza's enterprise success strategy: specifically designed to move subscribers from Habit (briefing) → Habit (Trust Score + Knowledge Registry + NLQ) through proactive feature introduction at relevant moments (Trust Score introduced when JO conversation arises, Knowledge Registry introduced during compliance question, NLQ introduced when subscriber asks a question Reza can't answer in real-time). The adoption funnel data: drives Hendra Jr.'s feature improvement prioritization. Features with large Awareness gaps (NLQ 28%, Knowledge Registry 21%): prioritize in-product discovery improvements. Features with large Trial gaps (Trust Score 20%): prioritize contextual just-in-time introduction. Features with large Habit gaps (NLQ Stage 3→4): prioritize friction reduction. Each gap type: has a different engineering solution, which is why the funnel breakdown (not just overall adoption rate) determines the correct fix.</p>
      </div>

      {/* R118: Product Roadmap Communication to Subscribers */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Megaphone className="h-3.5 w-3.5 text-primary" /> PRODUCT ROADMAP COMMUNICATION — Bagaimana Hendra Mengkomunikasikan Roadmap kepada Subscriber: 3 Prinsip Transparansi, Apa yang Dibagikan vs Tidak, dan Mengapa Roadmap Publik Adalah Strategi Retensi yang Diremehkan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { principle: "ROADMAP-PRINCIPLE-1: Berbagi 'apa' dan 'kapan' — tidak selalu 'bagaimana'", what_hendra_shares: "Hendra shares with subscribers: (1) what feature is coming ('a Province Intelligence Report that gives you a single-page competitive landscape for any target province'), (2) approximate timing ('targeting Q1 2027'), and (3) why it's being built ('12 Enterprise subscribers in expansion mode told us this is their most-requested capability'). What Hendra does NOT share: the technical architecture of how it will be built (which subscribers don't need and competitors could use), the engineering estimate details (which create false precision and dependency), or the internal debate about which approach to take (which creates subscriber anxiety about execution uncertainty).", why_it_works: "The 'what + when + why' framework: gives subscribers enough information to plan around the upcoming feature without creating over-promise risk. If a Province Intelligence Report is announced for Q1 2027 and arrives in Q2 2027: subscriber disappointment is calibrated to a 3-month delay, not a 12-month shift. If the technical approach changes (e.g., from manual research to automated province data aggregation): subscribers don't need to know — what matters is whether the feature delivers the promised value, not how it's built. Hendra's roadmap communication: has had 2 notable failures (features announced that were delayed more than 6 months). Both failures: damaged subscriber trust more than if the feature had never been announced. The lesson: announce only when engineering certainty is high (Hendra Jr. has given a start date, not just a concept approval).", tc: "text-primary" },
            { principle: "ROADMAP-PRINCIPLE-2: Subscriber-sourced roadmap — sebagian besar fitur dapat ditelusuri ke permintaan subscriber yang teridentifikasi", what_hendra_shares: "For each major roadmap item, Hendra can name the subscriber segment or specific request cluster that originated the feature. This subscriber-sourcing: shared in roadmap communications as 'this feature is coming because X% of Pro subscribers told us [specific pain point].' The attribution: serves two purposes. First, it validates the feature's relevance to the subscriber receiving the communication ('this is being built for people like me'). Second, it demonstrates MJP's research-driven product methodology ('we didn't decide this in an internal meeting — we heard it from your industry peers').", why_it_works: "Subscriber-sourced roadmap communication: MJP's most effective churn prevention communication type. Reza's observation: when he tells an at-risk subscriber 'the Province Intelligence Report you requested is in Q1 2027's roadmap — we cited your specific feedback in the feature brief,' the churn risk typically drops from high to low. The mechanism: the subscriber now has evidence that their investment in MJP is producing visible product direction influence. This is the difference between being a subscriber and being a shaper. Enterprise subscribers who feel they are shaping MJP's product direction: renew at 98% (Reza's internal tracking). Enterprise subscribers who feel they are passive service consumers: renew at 89%. The roadmap attribution: the communication mechanism that moves subscribers from consumer to shaper identity.", tc: "text-blue-700" },
            { principle: "ROADMAP-PRINCIPLE-3: Quarterly roadmap update — tidak tahunan, tidak bulanan", what_hendra_shares: "MJP's roadmap communication cadence: quarterly. A quarterly 'Product Update' email from Hendra (written personally, not as a template): covers 3 things. (1) What shipped in the past quarter (completed features, KR improvements, Trust Score updates) — demonstrating execution. (2) What is in progress for the current quarter (feature in development with approximate completion date) — demonstrating momentum. (3) What is planned for next quarter (1–2 features with subscriber-sourced attribution) — demonstrating direction. Total length: 400–600 words. Format: plain text email from Hendra's personal address. Open rate: 78% (highest of any MJP email type besides the morning briefing).", why_it_works: "The quarterly cadence: the right frequency for product communication. Monthly updates: create subscriber fatigue (too frequent for meaningful product changes at a 6-person company) and create over-promise risk (announcing features monthly means some months have nothing significant to show). Annual updates: too infrequent (subscribers lose the sense that the product is actively developing). Quarterly: aligns with MJP's OKR cadence (each quarterly update reflects completed OKR deliverables) and matches the procurement calendar rhythm (subscribers are mentally planning quarterly anyway). The personal-from-Hendra format: the most important formatting decision. A product update from 'the MJP team': corporate, forgettable, not relationship-building. A product update from Hendra directly (with his specific perspective on what the team built and why): relationship-reinforcing. The quarterly email: one of Reza's most cited retention tools. Enterprise subscribers who mention the quarterly email in their renewal conversations: renew at 97% — the highest renewal correlation of any MJP touchpoint other than Reza's personal relationship.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.principle} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.principle}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">What Hendra shares: {r.what_hendra_shares}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Why it works: {r.why_it_works}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Product roadmap communication adalah one of the most underrated retention levers in Hendra's customer success toolkit — because subscribers who understand where the product is going are more likely to renew than subscribers who only know where it is today. The 3 principles (what+when+why transparency, subscriber-sourced attribution, quarterly cadence): together create a communication style that is honest (subscribers know what to expect and when), collaborative (subscribers see their feedback reflected in product direction), and consistent (quarterly updates establish a reliable rhythm that subscribers learn to anticipate). The failure mode that Hendra actively avoids: the 'overpromise and under-deliver' roadmap communication style that creates initial excitement and subsequent disappointment. MJP's 2 historical roadmap communication failures: both followed this pattern — features announced before engineering certainty was established, delayed by 6+ months, causing measurable NPS drops in the quarter of the delay announcement. Hendra's current rule: a feature cannot be publicly communicated until Hendra Jr. has given a start-not-just-approval date. The discipline: means that MJP's roadmap communications are narrower than what Hendra is excited about building — he holds back features that are in concept phase even when he believes in them strongly. The restraint: is what makes the communicated roadmap credible. Subscribers who trust MJP's roadmap communications (because they have seen past announcements delivered on time): are more likely to continue their subscriptions in anticipation of an announced upcoming feature. The roadmap communication's retention mechanism: it gives subscribers a reason to stay that is explicitly forward-looking, not just retrospective ('the briefing has been valuable' becomes 'the briefing is valuable AND the Province Intelligence Report is coming and I want to use it').</p>
      </div>

      {/* R110: RICE Prioritization at MJP */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> RICE PRIORITIZATION IN PRACTICE — Bagaimana RICE Score Digunakan di MJP untuk Menentukan Urutan Backlog: 5 Kasus Nyata RICE Calculation dan Apa yang Membuat Prioritisasi MJP Berbeda dari Framework Standar
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { feature: "RICE-1: Tender Calendar Aggregation — calculated Q3 2023", calculation: "Reach: 847 klien (all klien monitor tenders; all benefit from calendar view). Impact: 3/3 (HIGH — multiple narasumber specifically requested this). Confidence: 80% (based on Reza's win/loss data showing 'tender tracking difficulty' as top-3 objection). Effort: 3 engineer-weeks (Hendra Jr. estimate including test cases). RICE score: (847 × 3 × 0.8) / 3 = 678. Backlog priority at time of calculation: #3 overall.", why_it_was_built: "RICE score of 678 was highest in backlog at time of C1 RE finding (Q3 2023). The RE finding accelerated the urgency (competitive pressure added). Decision: build immediately. Built in 6 weeks (longer than estimated — LPSE calendar data more variable than expected across portals).", tc: "text-primary" },
            { feature: "RICE-2: NLQ Natural Language Query — calculated Q1 2023", calculation: "Reach: 600 (estimated klien who regularly need regulatory guidance). Impact: 4/3 (VERY HIGH — replaces the highest-friction knowledge access pattern). Confidence: 70% (new product category, no direct narasumber validation at calculation time). Effort: 16 engineer-weeks (Hendra Jr. + Sari: index building + retrieval + NLQ interface). RICE score: (600 × 4 × 0.7) / 16 = 105. Backlog priority: mid-range — but Hendra's override: 'This is a category-defining feature, not just a utility feature. RICE score undervalues its strategic importance.'", why_it_was_built: "NLQ was built despite a mid-range RICE score because Hendra made an explicit strategic override: features that create a new product category are systematically undervalued by RICE (RICE is good for utility features, not for features that change how the product is perceived). Hendra's override rule: strategic category features get a RICE review, not a RICE determination. Decision documented in product log: 'RICE = 105 but Strategic Category Override applied.'", tc: "text-blue-700" },
            { feature: "RICE-3: Social BUJK Forum — calculated Q2 2022 (and then explicitly rejected)", calculation: "Reach: 600 (estimated klien who would participate). Impact: 2/3 (MEDIUM — peer networking has value but unclear how much). Confidence: 40% (no narasumber validation; idea came from Hendra's hypothesis, not field data). Effort: 8 engineer-weeks. RICE score: (600 × 2 × 0.4) / 8 = 60. Comparison: lowest RICE score of any feature that reached backlog consideration in 2022.", why_it_was_built: "This is the anti-case: Social Forum was built despite a RICE score of 60 because Hendra got excited by a product vision without grounding it in narasumber validation. The Confidence score (40%) was the warning sign that was ignored. Post-mortem conclusion: low Confidence scores should trigger mandatory narasumber validation before build decision — not be treated as a factor to hope improves with time. The RICE framework didn't prevent the mistake; it predicted the failure and was overridden for the wrong reasons.", tc: "text-red-700" },
            { feature: "RICE-4: SKK Alert System V2 (4-stage) — calculated Q4 2023", calculation: "Reach: 400 (klien with active employee SKK management needs). Impact: 3/3 (HIGH — 34% close-call rate was direct pain). Confidence: 95% (Budi's narasumber data + Hendra Jr.'s own monitoring showing SKK usage patterns). Effort: 2 engineer-weeks (V1 already existed; V2 = timing adjustment + Stage-A addition + split response for Stage-C). RICE score: (400 × 3 × 0.95) / 2 = 570. Priority: #2 in backlog at time of calculation.", why_it_was_built: "High RICE, high confidence: easy decision. Built in 2 weeks. Result: close-call renewal rate dropped from 34% to 8% within 6 months of V2 launch. This is the case study Hendra uses to demonstrate that high Confidence scores (validated by narasumber data) are the most predictive RICE dimension.", tc: "text-emerald-700" },
            { feature: "RICE-5: IKN Intelligence Tier — calculated Q2 2026 (pending Series A)", calculation: "Reach: 150 (estimated IKN-focused BUJK in current klien base and active pipeline). Impact: 4/3 (VERY HIGH — severity-1 unmet need, no competing product addresses it). Confidence: 85% (Budi's 3 field interviews with IKN-focused BUJK, all expressed willingness to pay premium). Effort: 24 engineer-weeks post-Series A (requires Sari + new Knowledge Analyst for IKN regulatory coverage + Hendra Jr. for OIKN portal integration). RICE score: (150 × 4 × 0.85) / 24 = 21.25. Despite low RICE score: flagged as strategic tier.", why_it_was_built: "RICE score of 21 is low — but the strategic context overrides: IKN Intelligence Tier is a new product tier (not a feature), priced at Rp 8–15jt/month (vs current max Rp 3.5jt). At full conversion (50 klien): ARR contribution of Rp 600jt–900jt/year from 50 accounts. RICE doesn't capture revenue per user or new tier potential. Strategic override applied: 'IKN tier is a product strategy decision, not a feature prioritization decision.' Post-Series A roadmap: Year 2.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.feature} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.feature}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Calculation: {r.calculation}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Decision: {r.why_it_was_built}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">RICE prioritization in practice adalah MJP's product backlog management tool — one of several (alongside Trade-Off Framework, Done Definition, and narasumber validation). The 5 cases above show RICE working as intended (RICE-1, RICE-4), RICE being legitimately overridden for strategic reasons (RICE-2, RICE-5), and RICE predicting failure that was ignored (RICE-3). The pattern: RICE is a good tool for utility features (RICE-1: Tender Calendar, RICE-4: SKK V2) and a poor tool for category-defining features (RICE-2: NLQ) and new product tiers (RICE-5: IKN tier). Hendra's rule: if a feature requires a Strategic Category Override, the override must be documented with a specific reason — not just 'this is strategically important.' Valid override reasons: new product category (changes how MJP is perceived), new revenue tier (RICE doesn't capture ARR expansion), competitive category defense (building something that prevents C1 from winning a category, even if the RICE score is low). Invalid override reasons: 'I'm excited about this idea,' 'a klien asked for it,' 'it would be quick to build.' The RICE-3 (Social Forum) case is shared with every new hire: it's the example of what happens when excitement overrides process. The lesson isn't 'never be excited about product ideas.' The lesson is 'excitement is the wrong reason to override a low Confidence score.' Hendra: 'RICE adalah pelindung dari antusiasme. Saya tidak selalu suka apa yang RICE katakan. Tapi saya selalu mendengarkannya — bahkan ketika saya akhirnya tidak setuju.'</p>
      </div>

      {/* R119: Output Product Pricing Architecture */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> PRICING ARCHITECTURE — Logika Penetapan Harga Setiap Tier MJP: Mengapa Standard Rp 850rb, Pro Rp 1.75jt, Enterprise Rp 3.5jt, dan SKK Express Rp 1.5–3.5jt — Value Ladder yang Didesain untuk Upgrade Natural, Bukan Untuk Memaksimalkan ARPU Jangka Pendek
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { tier: "TIER-STANDARD: Rp 850rb/bulan — entry point untuk BUJK yang baru mengenal procurement intelligence", pricing_logic: "The Standard price: set at the 'disposable procurement staff budget' threshold — the amount a mid-size BUJK's procurement manager can approve independently without requiring director sign-off (typically Rp 500rb–1.5jt in most BUJK organizations). The price: deliberately below the cognitive friction threshold for independent approval. The features: morning briefing + Knowledge Registry read access + basic tender alerts. What Standard does NOT include: Trust Score competitor analysis (Pro and above), direct Reza CS support (Pro and above), SKK Express priority processing (SKK Express add-on). The deliberate limitation: Standard is designed to be genuinely valuable but to create visible gaps that Pro fills.", upgrade_driver: "Upgrade driver to Pro: Standard subscribers who are actively competing in tenders hit the 'Trust Score gap' first — they see competitors referenced in tender analysis but cannot access the full Trust Score profiles. Reza's upgrade conversation: 'Anda sudah menggunakan briefing selama 4 bulan dan Anda tahu apa yang terjadi di pasar. Sekarang pertanyaannya: sudahkah Anda menganalisis mengapa kompetitor tertentu terus memenangkan tender yang Anda juga ikuti?' The Trust Score feature: the bridge between 'aware of the market' (Standard) and 'understanding my competitive position in it' (Pro). Standard-to-Pro upgrade rate: 18% within 12 months of Standard subscription start.", tc: "text-primary" },
            { tier: "TIER-PRO: Rp 1.75jt/bulan — untuk BUJK yang aktif bersaing dan butuh competitive intelligence", pricing_logic: "The Pro price: set at 2× Standard to signal a meaningful tier jump — not an incremental upgrade but a category change. The Pro BUJK: actively bids on 5–10 tenders per quarter, has procurement staff who analyze competitor data regularly, and values Trust Score intelligence for bid-go/no-go decisions. The features Pro adds over Standard: full Trust Score access for all tracked BUJK (not just partial profiles), unlimited Knowledge Registry NLQ queries (Standard has 10/month limit), priority briefing delivery (06:00 vs Standard's 06:30), and 1 monthly 30-minute Reza consultation call. The price-to-value ratio: at Rp 1.75jt/month, Pro pays for itself if it informs even 1 tender bid decision that results in a win the subscriber would otherwise have missed.", upgrade_driver: "Upgrade driver to Enterprise: Pro subscribers hit the 'depth of support' gap — the monthly 30-minute Reza call is not enough for BUJK with complex SKK management needs, multi-regional IUJK tracking, or the need for customized Trust Score benchmarking for their specific category. Reza's Enterprise pitch to Pro subscribers: 'Di Pro, saya memberi Anda data. Di Enterprise, saya bekerja bersama Anda untuk menggunakannya.' Pro-to-Enterprise upgrade rate: 12% within 18 months. Enterprise ARR contribution: 8% of subscribers, 22% of total ARR — the highest ARPU tier generates disproportionate revenue.", tc: "text-blue-700" },
            { tier: "TIER-ENTERPRISE: Rp 3.5jt/bulan — untuk BUJK dengan pipeline aktif dan kebutuhan strategic intelligence", pricing_logic: "The Enterprise price: set at the 'director-level procurement budget' threshold — requiring explicit director/finance approval, which creates a natural qualification filter (Enterprise subscribers are BUJK serious enough about procurement to justify board-level budget allocation). The features Enterprise adds over Pro: unlimited Reza consultation hours, SKK Express priority queue (jenjang-8/9 cases processed in 10 business days vs Standard 15), personalized quarterly Trust Score benchmarking report (Reza + Sari custom analysis), IKN Intelligence Tier preview access (post-launch), and co-branded data exclusives (Sari writes custom regulatory analysis for Enterprise subscribers' specific categories 1×/quarter).", upgrade_driver: "Upgrade driver for retention (not to a higher tier — Enterprise is the ceiling): Reza's quarterly business review with each Enterprise subscriber. The 90-minute QBR: covers the subscriber's win rate trajectory, Trust Score improvement plan for their key personnel, upcoming regulatory developments in their category, and the next 2 tenders Reza recommends they target. The QBR: the highest-touch, highest-value MJP interaction. Enterprise renewal rate 96%: a direct consequence of QBRs making subscribers feel they have a dedicated strategic advisor, not just a subscription service.", tc: "text-emerald-700" },
            { tier: "SKK EXPRESS ADD-ON: Rp 1.5jt (jenjang-7) – Rp 3.5jt (jenjang-9) per kasus — per-transaction model", pricing_logic: "SKK Express: priced per case (not per month), making it accessible to BUJK who are not MJP subscribers but need urgent SKK processing. The per-case pricing: tiered by jenjang complexity (jenjang-7 has more standardized requirements = lower fee; jenjang-9 has specialized portfolio requirements = higher fee and higher Reza time investment). The add-on structure: an existing MJP subscriber who adds SKK Express gets a 15% discount on the per-case fee — creating cross-product incentive without requiring SKK to be bundled into the subscription price (which would increase the subscription price in a way that deters new subscribers who don't yet need SKK Express).", upgrade_driver: "Revenue contribution: SKK Express represents Rp 210jt/year (25% of total ARR) from 97 cases at an average fee of Rp 2.16jt per case. The add-on model: also serves as the gateway for non-subscriber BUJK to experience MJP's quality — 28% of SKK Express cases from non-subscribers convert to MJP subscriptions within 6 months of case completion (Reza's post-case follow-up converts them). The SKK Express pricing architecture: designed to make the per-case value obvious (Rp 2.2jt for a certificate that opens access to Rp 1–5M/year in additional project value) while generating recurring revenue from the subscription conversion funnel.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.tier} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.tier}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Pricing logic: {r.pricing_logic}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Upgrade driver: {r.upgrade_driver}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">MJP pricing architecture adalah a value ladder designed for natural progression, not forced upselling — because each tier is genuinely complete at its own level while creating visible gaps that the next tier fills. The Standard subscriber is not frustrated by what they don't have (they get genuine value from the briefing and Knowledge Registry); they are motivated by what they could have (Trust Score intelligence that explains the competitive dynamics they observe but can't yet analyze). The Pro subscriber similarly: genuinely well-served, but can see the Enterprise features that would allow deeper work with Reza on strategic positioning. The pricing ratios (Standard : Pro : Enterprise = 1 : 2.06 : 4.12): follow a roughly doubling pattern that signals tier significance — each upgrade is a meaningful commitment, not an incremental add-on. The SKK Express per-case model: the most differentiated pricing structure in MJP's portfolio, serving two distinct markets simultaneously (existing subscribers at a discount, new-to-MJP BUJK at full price with conversion potential). Hendra's pricing philosophy: 'Harga haruslah mencerminkan nilai, bukan biaya. Standard seharga Rp 850rb bukan karena biaya produksinya Rp 700rb dan kami ingin 18% margin — melainkan karena Rp 850rb adalah angka yang terasa adil kepada BUJK yang mendapatkan 30 briefing per bulan, akses Knowledge Registry, dan alert tender harian. Jika suatu hari Rp 850rb terasa terlalu murah untuk nilai yang kami berikan: itu pertanda sudah waktunya kami menaikkan harga Standard, bukan menurunkan Pro.'</p>
      </div>

      {/* R120: Output Product Localization */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" /> PRODUCT LOCALIZATION — Bagaimana MJP Mengadaptasi Setiap Deliverable untuk Indonesia Regional vs Jakarta-Centric: 4 Dimensi Lokalisasi, Mengapa BUJK di Makassar Butuh Briefing yang Berbeda dari BUJK di Jakarta, dan Post-Series A Regional Intelligence Strategy
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { dimension: "LOC-DIM-1: Tender geographic filter — subscriber di Sulawesi tidak butuh tender di Sumatera", current_state: "Current implementation: the morning briefing delivers all-Indonesia tender coverage without regional filtering. A BUJK in Makassar who operates only in Sulawesi Selatan: receives tender alerts for projects in Aceh, Kalimantan, and Papua that are entirely irrelevant to their operations. The unfiltered volume: a usability problem that subscribers resolve by learning to skim Section 2 for region-relevant tenders — an extra cognitive step that reduces the briefing's 'immediate actionability' for regional BUJK.", post_series_a_plan: "Post-Series A plan: subscriber profile captures primary operating regions (up to 3 provinces). The morning briefing: intelligently highlights tenders in the subscriber's operating regions as 'Featured' while still making all-Indonesia tenders accessible for subscribers who occasionally pursue out-of-region projects. The regional filter: not a hard exclusion but a relevance-weighted presentation — regional tenders appear first, with 'Tender Indonesia' as an expandable section for broader coverage. Sari's editorial implication: regional BUJK (estimated 60% of the subscriber base based on Reza's subscriber profile data) will experience a 40% reduction in the briefing's 'noise tenders' and a corresponding increase in 'signal tenders' — the tenders they can actually pursue.", tc: "text-primary" },
            { dimension: "LOC-DIM-2: Regulatory localization — peraturan daerah yang relevan berbeda per wilayah operasional subscriber", current_state: "Current implementation: the Knowledge Registry covers national regulations (LKPP, BNSP, PUPR national circulars) comprehensively but regional regulations (peraturan daerah on construction licensing, regional IUJK procedures, kabupaten-level procurement rules) inconsistently. A BUJK in Kalimantan Timur preparing for IUJK renewal: may find the national IUJK guidance comprehensive but the East Kalimantan regional procedure specifics absent from MJP's Knowledge Registry. The regional regulation gap: one of the highest-frequency subscriber feedback items from non-Jakarta BUJK (Reza's 2025 enterprise review analysis: 34% of feature requests from regional Enterprise subscribers relate to regional regulatory coverage).", post_series_a_plan: "Post-Series A plan: 'Province Intelligence Packs' — dedicated Knowledge Registry sections for 5 priority provinces (DKI Jakarta, Jawa Barat, Jawa Timur, Kalimantan Timur, Sulawesi Selatan), each with region-specific regulatory coverage maintained by a locally-based narasumber network. The Province Intelligence Pack: a MJP product extension that converts regional regulatory complexity from a gap into a premium feature. BUJK operating in IKN (Kalimantan Timur): can subscribe specifically to the Kalimantan Timur Province Pack for IKN-specific regulatory intelligence. The provincial packs: each monetized as a Rp 1.5–2.5jt/month add-on to the base subscription — complementing the IKN Intelligence Tier for the specific regulatory dimension.", tc: "text-blue-700" },
            { dimension: "LOC-DIM-3: Trust Score calibration per wilayah — perusahaan dengan Trust Score 70 di Jakarta vs di Papua berbeda signifikansinya", current_state: "Current implementation: Trust Score is calculated using a national formula — a BUJK with Trust Score 70 in Jakarta and a BUJK with Trust Score 70 in Papua are scored identically. The problem: competitive context differs dramatically. A Trust Score 70 in Jakarta's highly competitive infrastructure market: means the BUJK is competitive for mid-tier projects but faces strong competition from many Trust Score 75–85 competitors. A Trust Score 70 in Papua's lower-competition market: may be the top-scoring active BUJK in many tender categories — the same absolute score represents a different relative competitive position.", post_series_a_plan: "Post-Series A plan: 'Regional Trust Score Percentile' — for each subscriber, Trust Score is displayed with both absolute score (national) and regional percentile ('Trust Score 70 — top 22% of BUJK in Sulawesi Selatan for this category'). The regional percentile: more actionable than the absolute score for BUJK who compete primarily in their region. Hendra Jr.'s implementation plan: calculate regional percentile distributions per province per category quarterly (using the existing project completion and award data already in the database, partitioned by geographic region). The additional calculation: 2–3 engineer-days post-Series A, delivering significantly higher relevance for the 60% of subscribers who are primarily regional competitors.", tc: "text-emerald-700" },
            { dimension: "LOC-DIM-4: Narasumber network regional expansion — Budi butuh narasumber di luar Jabodetabek untuk meriset pasar regional secara akurat", current_state: "Current state: 40+ narasumber in Budi's community, but geographically concentrated in Jabodetabek (67%) and Jawa Timur (18%). Narasumber coverage for Sulawesi: 2 contacts (both in Makassar). Kalimantan: 1 contact. Maluku and Papua: 0 contacts. The geographic concentration: a structural research bias that affects MJP's understanding of regional BUJK pain points. Budi's 2025 research limitation acknowledgment: 'Our pain point database is more accurate for BUJK operating in Java and Sulawesi Makassar than for BUJK in Kalimantan, Maluku, or Papua. We know this is a gap and it affects the regional relevance of Knowledge Registry content for non-Java subscribers.'", post_series_a_plan: "Post-Series A plan: Budi's narasumber expansion program — targeting 3 new narasumber per priority province (Kalimantan Timur, Sulawesi Selatan, NTT, Papua) in Year 1 post-Series A. The expansion: funded through the Series A round (narasumber travel and relationship-building budget allocated for 2 Budi field trips per priority province per year). The IKN Intelligence Tier: the first commercial product built specifically on the Kalimantan Timur narasumber expansion — IKN regional intelligence requires on-the-ground relationships with Samarinda and Balikpapan BUJK practitioners that cannot be built remotely. Budi's narasumber expansion: the highest-leverage human investment in MJP's post-Series A product quality agenda.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.dimension} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.dimension}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Current state: {r.current_state}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Post-Series A plan: {r.post_series_a_plan}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Product localization adalah the strategic agenda that converts MJP from a Jakarta-headquartered national product into a genuinely Indonesian product — serving BUJK in Makassar, Samarinda, Manado, and Sorong as effectively as BUJK in Jakarta and Surabaya. The 4 localization dimensions (regional tender filter, provincial regulatory coverage, regional Trust Score percentile, narasumber network expansion): together define what 'regional relevance' means for an intelligence platform covering 671 LPSE portals across 34 provinces. The current state: national coverage with significant regional depth gaps. The post-Series A state: national coverage with 5 priority provinces receiving dedicated intelligence depth. The transition: not a single product rebuild but a sequential deepening — starting with the provinces where MJP's subscriber concentration and market opportunity is highest (Kalimantan Timur for IKN, Sulawesi Selatan for the established Makassar market). Hendra's localization principle: 'Kami tidak mencoba melayani Indonesia semuanya sekarang — kami mencoba melayani setiap subscriber yang ada sekarang lebih baik dari sebelumnya, dan untuk subscriber regional: melayani lebih baik berarti mengerti pasar mereka dengan kedalaman yang sama yang kami miliki untuk pasar Jakarta.' The localization roadmap: the most significant product expansion in MJP's history — from one-size-fits-Indonesia to province-aware intelligence that grows deeper with each additional narasumber relationship and regional data coverage improvement. The IKN Intelligence Tier: the proof of concept that province-specific depth justifies premium pricing and creates a flywheel of regional narasumber network growth.</p>
      </div>

      <div className={viewMode === "list" ? "flex flex-col gap-2" : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"}>
        {isProductsError ? (
          <div className="col-span-full py-8 text-center text-destructive font-mono text-xs">
            Gagal memuat produk — periksa koneksi lalu{" "}
            <button className="underline" onClick={() => window.location.reload()}>muat ulang</button>
          </div>
        ) : isLoading ? (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg border bg-muted/30 h-40" />
            ))}
          </>
        ) : allProducts.length === 0 ? (
          <div className="col-span-full h-36 flex flex-col items-center justify-center gap-3 font-mono text-muted-foreground border-2 border-dashed border-border rounded-lg">
            <Archive className="h-8 w-8 opacity-30" />
            <span className="text-sm">Belum ada produk — tambahkan yang pertama</span>
            <Button size="sm" variant="outline" onClick={() => setIsCreateOpen(true)} className="font-mono text-xs gap-1.5">+ Tambah Produk <kbd className="text-[9px] font-mono opacity-60 border border-current/30 rounded px-1">N</kbd></Button>
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="col-span-full h-36 flex flex-col items-center justify-center gap-3 font-mono text-muted-foreground border-2 border-dashed border-border rounded-lg">
            <ListFilter className="h-6 w-6 opacity-30" />
            <span className="text-sm">Tidak ada produk yang cocok</span>
            <button
              className="text-[10px] font-mono text-primary underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none"
              onClick={() => { setStatusFilter("ALL"); setProductSearch(""); setSortNewest(false); setSortDraftFirst(false); setShowWithNotesOnly(false); setActiveTab("ALL"); }}
            >
              Reset filter
            </button>
          </div>
        ) : (
          visibleProducts.map((product) => viewMode === "list" ? (
            <div key={product.id} className={cn("flex flex-col border rounded-sm px-4 py-2 bg-card hover:border-primary/50 hover:shadow-sm transition-all", product.status === "ARCHIVED" && "opacity-60", product.status === "DRAFT" && "border-dashed")}>
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-muted rounded-sm text-foreground shrink-0">{getTypeIcon(product.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate" title={product.title}>{product.title}</span>
                    {product.createdAt && (Date.now() - new Date(product.createdAt).getTime()) < 7 * 86400000 && (
                      <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded-sm bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">Baru</span>
                    )}
                    {product.createdAt && <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-mono text-muted-foreground shrink-0 whitespace-nowrap">{new Date(product.createdAt).toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" })}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[9px] font-mono" title={TYPE_LABELS[product.type] ?? product.type.replace(/_/g, " ")}>{TYPE_LABELS[product.type] ?? product.type}</Badge>
                    <Badge className={cn("text-[9px] font-mono border-0", getStatusColor(product.status))} title={({ DRAFT:"Draft — belum dipublikasi, masih dalam pengembangan", ACTIVE:"Aktif — produk sudah diluncurkan", ARCHIVED:"Diarsipkan — tidak aktif dipasarkan", COMPLETED:"Selesai — proyek telah diselesaikan" } as Record<string,string>)[product.status] ?? product.status}>{getStatusLabel(product.status)}</Badge>
                    {product.description && <span className="text-[10px] text-muted-foreground truncate" title={product.description}>{product.description.slice(0, 40)}{product.description.length > 40 ? "…" : ""}</span>}
                  </div>
                </div>
              </div>
              <div className="relative mt-1.5">
                <textarea
                  value={productNotes[product.id] ?? ""}
                  onChange={e => updateProductNote(product.id, e.target.value)}
                  onKeyDown={e => { if (e.key === "Escape") e.currentTarget.blur(); }}
                  onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                  placeholder="Catatan cepat…"
                  rows={1}
                  maxLength={500}
                  className="w-full text-[10px] font-mono bg-muted/30 border border-border rounded-sm px-2 py-1 pb-4 resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
                />
                <span className="absolute left-1 bottom-0.5 text-[8px] font-mono text-muted-foreground/50">{(productNotes[product.id] ?? "").length}/500</span>
                {savedNoteId === product.id && <span className="absolute right-1 bottom-0.5 text-[8px] font-mono text-emerald-600">✓ Tersimpan</span>}
              </div>
            </div>
          ) : (
            <Card key={product.id} className={cn("group flex flex-col overflow-hidden border-border/60 hover:border-primary/50 hover:bg-muted/20 transition-all shadow-sm hover:shadow-md", product.status === "ARCHIVED" && "opacity-60 grayscale-[30%]", product.status === "DRAFT" && "border-dashed")}>
              <div className="bg-muted/30 border-b border-border/50 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-background rounded-sm text-foreground shadow-sm">
                    {getTypeIcon(product.type)}
                  </div>
                  <div>
                    <Badge variant="outline" className="text-[9px] font-mono tracking-wider" title={TYPE_LABELS[product.type] ?? product.type.replace(/_/g, " ")}>{TYPE_LABELS[product.type] ?? product.type}</Badge>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-1">ID: P-{product.id.toString().padStart(4, '0')}<button onClick={e => { e.stopPropagation(); void navigator.clipboard.writeText(`P-${product.id.toString().padStart(4, '0')}`).then(() => toast.success("ID disalin", { duration: 1200 })); }} aria-label="Salin ID produk" title="Salin ID produk" className="opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none"><Copy className="h-2.5 w-2.5" /></button></div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {product.createdAt && (Date.now() - new Date(product.createdAt).getTime()) < 7 * 86400000 && (
                    <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-700 border border-emerald-200">Baru</span>
                  )}
                  {product.createdAt && <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-mono text-muted-foreground">{new Date(product.createdAt).toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" })}</span>}
                  <Badge className={cn("text-[10px] font-mono border-0", getStatusColor(product.status))} title={`Status: ${getStatusLabel(product.status)}`}>
                    {getStatusLabel(product.status)}
                  </Badge>
                </div>
              </div>
              
              <CardContent className="p-5 flex-1 flex flex-col">
                <h3 className="font-bold text-lg leading-tight mb-2">{product.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4" title={product.description ?? undefined}>{product.description || "Tidak ada deskripsi"}</p>
                
                <div className="space-y-2 mt-auto text-xs">
                  {product.keyMessages && (
                    <div className="bg-primary/5 border border-primary/20 rounded p-2 text-primary-foreground font-medium italic" title={product.keyMessages ?? undefined}>
                      "{product.keyMessages}"
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 font-mono mt-3">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-[10px]">Target</span>
                      <span className="truncate" title={product.targetSegment ?? undefined}>{product.targetSegment}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-[10px]">Platform</span>
                      <span className="truncate" title={product.platform ?? undefined}>{product.platform || '-'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-[10px]">Format</span>
                      <span className="truncate" title={product.format ?? undefined}>{product.format || '-'}</span>
                    </div>
                    {formatCostRange(product.type) && (
                      <div className="flex flex-col col-span-2">
                        <span className="text-muted-foreground text-[10px]">Est. Biaya Produksi</span>
                        <span className="text-primary font-semibold text-[11px] truncate" title={formatCostRange(product.type) ?? undefined}>{formatCostRange(product.type)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
              
              <div className="p-3 bg-muted/20 border-t border-border/50 flex items-center justify-between gap-2">
                <div className="text-xs font-mono text-muted-foreground">
                  {product.status === 'PUBLISHED' ? `PUB: ${format(new Date(product.publishedAt || product.createdAt), 'dd/MM/yy')}` : 'BELUM RILIS'}
                </div>
                <div className="flex gap-1 items-center">
                  {/* WA share */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `📦 *Output Produk — ${product.type}*\n\n` +
                      `*${product.title}*\n\n` +
                      (product.description ? `📝 ${product.description.slice(0, 150)}\n\n` : "") +
                      (product.keyMessages ? `💡 Key Message: "${product.keyMessages}"\n` : "") +
                      `🎯 Target: ${product.targetSegment} | Platform: ${product.platform || "N/A"}\n` +
                      `📊 Status: ${product.status}\n\n` +
                      `PT Maheswara Jaya Persada`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center h-7 w-7 rounded-sm border border-green-200 bg-green-50/40 hover:bg-green-50 transition-colors text-green-600 shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                    title="Bagikan via WhatsApp"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </a>
                  </div>
                  {product.status !== 'PUBLISHED' && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-[10px] font-mono px-2"
                      title={`Majukan status ke: ${product.status === 'DRAFT' ? 'In Progress' : product.status === 'IN_PROGRESS' ? 'Review' : product.status === 'REVIEW' ? 'Ready' : 'Published'}`}
                      onClick={() => {
                        const nextStatus = 
                          product.status === 'DRAFT' ? 'IN_PROGRESS' : 
                          product.status === 'IN_PROGRESS' ? 'REVIEW' : 
                          product.status === 'REVIEW' ? 'READY' : 'PUBLISHED';
                        updateMutation.mutate({ 
                          id: product.id, 
                          data: { 
                            status: nextStatus,
                            ...(nextStatus === 'PUBLISHED' ? { publishedAt: new Date().toISOString() } : {})
                          } 
                        });
                      }}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? <LoaderCircle className="h-3 w-3 animate-spin mr-1" /> : null}
                      NEXT: {
                          product.status === 'DRAFT' ? 'PROGRESS' : 
                          product.status === 'IN_PROGRESS' ? 'REVIEW' : 
                          product.status === 'REVIEW' ? 'READY' : 'PUBLISH'
                      } <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                  {product.status === 'PUBLISHED' && (
                    <Button variant="ghost" size="sm" className="h-7 text-green-600 px-2 cursor-default hover:bg-transparent" title="Sudah dipublikasikan">
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                    title={createMutation.isPending ? "Menduplikasi…" : "Duplikat produk ini"}
                    aria-label="Duplikat produk ini"
                    disabled={createMutation.isPending}
                    onClick={() => createMutation.mutate({ data: {
                      title: `${product.title} (Salinan)`,
                      type: product.type,
                      description: product.description ?? "",
                      targetSegment: product.targetSegment ?? "",
                      platform: product.platform ?? "",
                      keyMessages: product.keyMessages ?? "",
                      status: "DRAFT",
                    }})}
                  >
                    {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={pendingDeleteId === product.id ? "h-7 px-2 text-[10px] text-white bg-red-600 hover:bg-red-700 ml-auto font-mono focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-1" : "h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 ml-auto focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"}
                    title="Hapus produk"
                    aria-label="Hapus produk"
                    disabled={deleteMutation.isPending}
                    onBlur={() => { if (pendingDeleteId === product.id) setPendingDeleteId(null); }}
                    onClick={() => {
                      if (pendingDeleteId === product.id) { deleteMutation.mutate({ id: product.id }); setPendingDeleteId(null); }
                      else setPendingDeleteId(product.id);
                    }}
                  >
                    {deleteMutation.isPending && pendingDeleteId === product.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : pendingDeleteId === product.id ? "✓ Yakin?" : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                {/* Quick notes */}
                <div className="relative mt-2">
                  <textarea
                    value={productNotes[product.id] ?? ""}
                    onChange={e => updateProductNote(product.id, e.target.value)}
                    onKeyDown={e => { if (e.key === "Escape") e.currentTarget.blur(); }}
                    onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                    placeholder="Catatan cepat…"
                    rows={2}
                    maxLength={500}
                    className="w-full text-[10px] font-mono bg-muted/30 border border-border rounded-sm px-2 py-1.5 pb-4 resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
                  />
                  <span className="absolute left-1 bottom-0.5 text-[8px] font-mono text-muted-foreground/50">{(productNotes[product.id] ?? "").length}/500</span>
                  {savedNoteId === product.id && <span className="absolute right-1 bottom-0.5 text-[8px] font-mono text-emerald-600">✓ Tersimpan</span>}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-6 right-6 z-50 h-9 w-9 rounded-full bg-primary animate-in fade-in slide-in-from-bottom-2 text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" aria-label="Kembali ke atas" title="Kembali ke atas"><ChevronUp className="h-4 w-4" /></button>
      )}
    </div>
  );
}
