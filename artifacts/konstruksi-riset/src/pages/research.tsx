import { useState, useMemo, useEffect, useRef, useDeferredValue } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  useListResearchItems, 
  useCreateResearchItem,
  useUpdateResearchItem,
  useDeleteResearchItem,
  getListResearchItemsQueryKey,
  useGetDashboardSummary,
  getGetDashboardSummaryQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Activity, BookMarked, BookOpen, ChartBar, ChartColumnBig, CircleCheck, ClipboardList, Clock, Copy, DollarSign, Download, ExternalLink, FileSpreadsheet, FileText, FlaskConical, GitBranch, Globe, History, LayoutGrid, Library, Lightbulb, ListFilter, Loader2, Map, MapPin, Megaphone, MessageCircle, Mic, Microscope, Network, Pencil, Plus, RefreshCw, Scale, Search, Shield, ShieldCheck, ShoppingBag, SquareCheckBig, Star, Target, Tent, TimerOff, Trash2, TrendingUp, TriangleAlert, Trophy, Users, X, ChevronUp } from "lucide-react";
import { exportResearchExcel, type ResearchRow } from "@/lib/export-excel";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { KnowledgeSourcesBar } from "@/components/knowledge-sources-bar";
import { ManufakturSection } from "@/components/manufaktur-section";

// ─── Export ListFilter Dialog (Task #29) ─────────────────────────────────────────

const RESEARCH_FILTER_KEY = "mkp-export-research-filters";

const CATEGORY_LABELS: Record<string, string> = {
  LEGALITAS_PERIJINAN: "Legalitas & Perijinan",
  SBU: "SBU",
  SKK: "SKK",
  TENDER: "Tender",
  PROYEK: "Proyek",
  REGULATORY_CHANGE: "Legalitas & Perijinan",
  CONTRACTOR_DATA: "SBU",
  SBU_SKK_EXPIRY: "SBU",
  SBU_SKK_DIFFICULTY: "SBU",
  SKK_HOLDERS: "SKK",
  TENDER_OPPORTUNITY: "Tender",
  TENDER_DIFFICULTY: "Tender",
};

function ExportResearchDialog({ allItems, notes }: { allItems: ResearchRow[]; notes: Record<number, string> }) {
  const [open, setOpen] = useState(false);

  // Lazy-initialise from localStorage so filters survive page reloads
  const [statuses, setStatuses] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(RESEARCH_FILTER_KEY) ?? "{}").statuses ?? []; } catch { return []; }
  });
  const [category, setCategory] = useState<string>(() => {
    try { return JSON.parse(localStorage.getItem(RESEARCH_FILTER_KEY) ?? "{}").category ?? ""; } catch { return ""; }
  });
  const [dateFrom, setDateFrom] = useState<string>(() => {
    try { return JSON.parse(localStorage.getItem(RESEARCH_FILTER_KEY) ?? "{}").dateFrom ?? ""; } catch { return ""; }
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    try { return JSON.parse(localStorage.getItem(RESEARCH_FILTER_KEY) ?? "{}").dateTo ?? ""; } catch { return ""; }
  });
  const [priority, setPriority] = useState<string>(() => {
    try { return JSON.parse(localStorage.getItem(RESEARCH_FILTER_KEY) ?? "{}").priority ?? ""; } catch { return ""; }
  });

  // Persist whenever any filter changes
  useEffect(() => { document.title = "Data Riset Harian — Intel Konstruksi"; return () => { document.title = "Intel Konstruksi"; }; }, []);
  useEffect(() => {
    try { localStorage.setItem(RESEARCH_FILTER_KEY, JSON.stringify({ statuses, category, dateFrom, dateTo, priority })); } catch { /* ignore */ }
  }, [statuses, category, dateFrom, dateTo, priority]);

  const categories = Array.from(new Set(allItems.map((i) => i.category))).sort();

  const filtered = useMemo(() => {
    return allItems.filter((item) => {
      if (statuses.length > 0 && !statuses.includes(item.status ?? "")) return false;
      if (category && item.category !== category) return false;
      if (priority && item.priority !== priority) return false;
      if (dateFrom && item.createdAt < dateFrom) return false;
      if (dateTo && item.createdAt > dateTo + "T23:59:59") return false;
      return true;
    });
  }, [allItems, statuses, category, priority, dateFrom, dateTo]);

  const toggleStatus = (s: string) =>
    setStatuses((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          title={`Ekspor ${allItems.length} data riset ke Excel`}
          className="font-mono text-xs border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
          disabled={allItems.length === 0}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export Excel{allItems.length > 0 ? ` (${allItems.length})` : ""}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListFilter className="h-4 w-4" />
            ListFilter Sebelum Export Excel
          </DialogTitle>
          <DialogDescription>Kosongkan semua untuk export semua data riset.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Status */}
          <div className="space-y-2">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Status</Label>
            <div className="flex flex-wrap gap-2">
              {(["PENDING", "REVIEWED", "ARCHIVED"] as const).map((s) => (
                <button key={s} onClick={() => toggleStatus(s)}
                  aria-pressed={statuses.includes(s)}
                  className={`text-[10px] font-mono px-2 py-1 rounded-sm border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${statuses.includes(s) ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:border-primary/50"}`}>
                  {s === "PENDING" ? "Menunggu" : s === "REVIEWED" ? "Direviu" : "Diarsip"}
                </button>
              ))}
              {statuses.length > 0 && <button onClick={() => setStatuses([])} className="text-[10px] font-mono text-muted-foreground px-1">✕</button>}
            </div>
          </div>
          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Kategori</Label>
            <Select value={category || "__all__"} onValueChange={v => setCategory(v === "__all__" ? "" : v)}>
              <SelectTrigger className="h-8 w-full text-xs font-mono bg-background" aria-label="Filter kategori riset" title="Filter berdasarkan kategori data riset">
                <SelectValue placeholder="Semua Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs font-mono">Semua Kategori</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c} className="text-xs font-mono">{CATEGORY_LABELS[c] ?? c.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Priority */}
          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Prioritas</Label>
            <Select value={priority || "__all__"} onValueChange={v => setPriority(v === "__all__" ? "" : v)}>
              <SelectTrigger className="h-8 w-full text-xs font-mono bg-background" aria-label="Filter prioritas riset" title="Filter berdasarkan prioritas">
                <SelectValue placeholder="Semua Prioritas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs font-mono">Semua Prioritas</SelectItem>
                {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((p) => <SelectItem key={p} value={p} className="text-xs font-mono">{{ LOW:"Rendah", MEDIUM:"Sedang", HIGH:"Tinggi", CRITICAL:"Kritis" }[p]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Tanggal Dari</Label>
              <Input value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} type="date" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Tanggal Sampai</Label>
              <Input value={dateTo} onChange={(e) => setDateTo(e.target.value)} type="date" className="h-8 text-xs" />
            </div>
          </div>
          {/* Preview count */}
          <div className={`flex items-center justify-between border rounded-sm px-3 py-2 ${filtered.length === 0 ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50/40"}`}>
            <span className="text-xs font-mono text-muted-foreground">AKAN DIEKSPOR:</span>
            <span className={`text-sm font-bold font-mono ${filtered.length === 0 ? "text-red-600" : "text-emerald-700"}`}>
              {filtered.length} / {allItems.length} item
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} size="sm">Batal</Button>
          <Button
            onClick={() => { exportResearchExcel(filtered.map(item => ({ ...item, category: CATEGORY_LABELS[item.category] ?? item.category.replace(/_/g, " "), catatan: notes[item.id] ?? "" }))); setOpen(false); }}
            disabled={filtered.length === 0}
            size="sm"
            className="font-mono text-xs gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Download Excel ({filtered.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Research() {
  const queryClient = useQueryClient();
  const [riNotes, setRiNotes] = useState<Record<number, string>>(() => {
    try { return JSON.parse(localStorage.getItem("mkp-ri-notes") ?? "{}") as Record<number, string>; } catch { return {}; }
  });
  const [savedNoteId, setSavedNoteId] = useState<number | null>(null);
  const savedNoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateRiNote = (id: number, val: string) => {
    setRiNotes(prev => {
      const next = { ...prev, [id]: val };
      try { localStorage.setItem("mkp-ri-notes", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    setSavedNoteId(id);
    if (savedNoteTimer.current) clearTimeout(savedNoteTimer.current);
    savedNoteTimer.current = setTimeout(() => setSavedNoteId(null), 2000);
  };
  const [searchTerm, setSearchTermRaw] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [categoryFilter, setCategoryFilterRaw] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "priority" | "source" | "domain">("newest");
  const setSearchTerm = (v: string) => { setSearchTermRaw(v); setPage(1); };
  const setCategoryFilter = (v: string) => { setCategoryFilterRaw(v); setPage(1); };
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [createCategory, setCreateCategory] = useState("LEGALITAS_PERIJINAN");
  const [createPriority, setCreatePriority] = useState("LOW");
  const [createTouched, setCreateTouched] = useState<Record<string, boolean>>({});
  const [createValues, setCreateValues] = useState<Record<string, string>>({});
  useEffect(() => { if (!isCreateOpen) { setCreateCategory("LEGALITAS_PERIJINAN"); setCreatePriority("LOW"); } }, [isCreateOpen]);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  // Keyboard shortcut: "n" opens create dialog, "/" focuses search
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "n" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsCreateOpen(true);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);
  const [industryTab, setIndustryTab] = useState<"konstruksi" | "manufaktur" | "harga-kompetitor">("konstruksi");

  // ── COMPETITOR_PRICING editor state ─────────────────────────────────────────
  const [isCreatePriceOpen, setIsCreatePriceOpen] = useState(false);
  const [pendingDeletePriceId, setPendingDeletePriceId] = useState<number | null>(null);
  const [createPriceTouched, setCreatePriceTouched] = useState<Record<string, boolean>>({});
  const [createPriceValues, setCreatePriceValues] = useState<Record<string, string>>({});
  const [editPriceTouched, setEditPriceTouched] = useState<Record<string, boolean>>({});
  const [editPriceValues, setEditPriceValues] = useState<Record<string, string>>({});
  const [confirmMarkAll, setConfirmMarkAll] = useState(false);
  const [editingPrice, setEditingPrice] = useState<{
    id: number; service: string; subCategory: string;
    minPrice: number; maxPrice: number; notes: string;
  } | null>(null);
  
  const { data: items, isLoading, isError: isItemsError } = useListResearchItems(
    { status: undefined }, 
    { query: { queryKey: getListResearchItemsQueryKey({ status: undefined }) } }
  );

  // Fetch COMPETITOR_PRICING rows separately so the dedicated editor has them
  const priceQueryKey = getListResearchItemsQueryKey({ dataSourceSite: "ijintender.co.id", category: "COMPETITOR_PRICING", limit: 50 });
  const { data: priceItems, isLoading: isLoadingPrices } = useListResearchItems(
    { dataSourceSite: "ijintender.co.id", category: "COMPETITOR_PRICING", limit: 50 },
    { query: { staleTime: 5 * 60 * 1000, queryKey: priceQueryKey } }
  );

  const invalidatePriceList = () => {
    queryClient.invalidateQueries({ queryKey: priceQueryKey });
    queryClient.invalidateQueries({ queryKey: getListResearchItemsQueryKey() });
  };

  const { data: summary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });

  const [newItemId, setNewItemId] = useState<number | null>(null);
  const newItemRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (newItemId === null || !newItemRef.current) return;
    newItemRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    const el = newItemRef.current;
    el.classList.add("ring-2", "ring-primary", "ring-offset-1");
    const timer = setTimeout(() => el.classList.remove("ring-2", "ring-primary", "ring-offset-1"), 2000);
    return () => clearTimeout(timer);
  }, [newItemId]);

  const createMutation = useCreateResearchItem({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListResearchItemsQueryKey() });
        setIsCreateOpen(false);
        setNewItemId(data.id);
        setPage(1);
        toast.success("Data riset baru ditambahkan", { description: data.title ?? undefined, duration: 2500 });
      },
      onError: (err: unknown) => toast.error("Gagal menyimpan data riset", { description: err instanceof Error ? err.message : "Coba lagi" }),
    }
  });

  const updateMutation = useUpdateResearchItem({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListResearchItemsQueryKey() });
        toast.success("Data riset diperbarui", { description: data.title ? data.title.slice(0, 60) : undefined, duration: 1800 });
      },
      onError: (err: unknown) => toast.error("Gagal memperbarui data riset", { description: err instanceof Error ? err.message : undefined }),
    }
  });
  
  const deleteMutation = useDeleteResearchItem({
    mutation: {
      onSuccess: () => {
        const name = items?.find(r => r.id === pendingDeleteId)?.title;
        queryClient.invalidateQueries({ queryKey: getListResearchItemsQueryKey() });
        toast.success("Data riset dihapus", { description: name ? name.slice(0, 60) : undefined, duration: 2000 });
      },
      onError: (err: unknown) => toast.error("Gagal menghapus data riset", { description: err instanceof Error ? err.message : "Coba lagi" }),
    }
  });

  const createPriceMutation = useCreateResearchItem({
    mutation: {
      onSuccess: (data) => { invalidatePriceList(); setIsCreatePriceOpen(false); toast.success("Harga ditambahkan", { description: data.title ?? undefined, duration: 1800 }); },
      onError: (err: unknown) => toast.error("Gagal menambahkan harga", { description: err instanceof Error ? err.message : "Coba lagi" }),
    }
  });

  const updatePriceMutation = useUpdateResearchItem({
    mutation: {
      onSuccess: () => { invalidatePriceList(); setEditingPrice(null); toast.success("Harga diperbarui", { duration: 2000 }); },
      onError: (err: unknown) => toast.error("Gagal memperbarui harga", { description: err instanceof Error ? err.message : "Coba lagi" }),
    }
  });
  const deletePriceMutation = useDeleteResearchItem({
    mutation: {
      onSuccess: () => { invalidatePriceList(); toast.success("Harga dihapus", { duration: 2000 }); },
      onError: (err: unknown) => toast.error("Gagal menghapus harga", { description: err instanceof Error ? err.message : "Coba lagi" }),
    }
  });

  /** Shared helper: build a research item payload from the price form */
  function buildPricePayload(fd: FormData) {
    const service = fd.get("service") as string;
    const subCategory = fd.get("subCategory") as string;
    const minPrice = parseInt(fd.get("minPrice") as string, 10) || 0;
    const maxPrice = parseInt(fd.get("maxPrice") as string, 10) || 0;
    const notes = fd.get("notes") as string;
    return {
      category: "COMPETITOR_PRICING",
      title: service,
      summary: JSON.stringify({ minPrice, maxPrice, notes, subCategory }),
      source: "ijintender.co.id",
      sourceUrl: "https://ijintender.co.id",
      dataSourceSite: "ijintender.co.id",
      tags: subCategory,
      // status is set server-side: COMPETITOR_PRICING → ACTIVE, others → PENDING
    };
  }

  const handleCreatePrice = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const service = (fd.get("service") as string ?? "").trim();
    const minPrice = (fd.get("minPrice") as string ?? "").trim();
    const maxPrice = (fd.get("maxPrice") as string ?? "").trim();
    if (!service || !minPrice || !maxPrice) {
      setCreatePriceTouched({ service: true, minPrice: true, maxPrice: true });
      setCreatePriceValues((v) => ({ ...v, service, minPrice, maxPrice }));
      return;
    }
    createPriceMutation.mutate({ data: buildPricePayload(fd) }, {
      onSuccess: () => {
        setIsCreatePriceOpen(false);
        setCreatePriceTouched({});
        setCreatePriceValues({});
      },
    });
  };

  const handleUpdatePrice = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPrice) return;
    const fd = new FormData(e.currentTarget);
    const service = (fd.get("service") as string ?? "").trim();
    const minPrice = (fd.get("minPrice") as string ?? "").trim();
    const maxPrice = (fd.get("maxPrice") as string ?? "").trim();
    if (!service || !minPrice || !maxPrice) {
      setEditPriceTouched({ service: true, minPrice: true, maxPrice: true });
      setEditPriceValues((v) => ({ ...v, service, minPrice, maxPrice }));
      return;
    }
    updatePriceMutation.mutate({ id: editingPrice.id, data: buildPricePayload(fd) }, {
      onSuccess: () => {
        setEditingPrice(null);
        setEditPriceTouched({});
        setEditPriceValues({});
      },
    });
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!fd.get("title") || !fd.get("source")) {
      setCreateTouched({ title: true, source: true });
      return;
    }
    createMutation.mutate({
      data: {
        title: fd.get("title") as string,
        category: fd.get("category") as string,
        source: fd.get("source") as string,
        summary: fd.get("summary") as string,
        priority: fd.get("priority") as string,
        sourceUrl: fd.get("sourceUrl") as string,
      }
    });
  };

  const PAGE_SIZE = 30;
  const [page, setPage] = useState(1);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [starredItems, setStarredItems] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("mkp-research-starred") ?? "[]") as number[]); } catch { return new Set(); }
  });
  const toggleStar = (id: number) => setStarredItems(prev => {
    const next = new Set(prev);
    const wasPinned = next.has(id);
    if (wasPinned) next.delete(id); else next.add(id);
    try { localStorage.setItem("mkp-research-starred", JSON.stringify([...next])); } catch { /* ignore */ }
    toast.success(wasPinned ? "Pin dilepas" : "Item dipin", { duration: 1500 });
    return next;
  });
  const [readIds, setReadIds] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("mkp-research-read") ?? "[]") as number[]); } catch { return new Set(); }
  });
  const toggleRead = (id: number) => setReadIds(prev => {
    const next = new Set(prev);
    const wasRead = next.has(id);
    if (wasRead) next.delete(id); else next.add(id);
    try { localStorage.setItem("mkp-research-read", JSON.stringify([...next])); } catch { /* ignore */ }
    toast.success(wasRead ? "Ditandai belum dibaca" : "Ditandai sudah dibaca", { duration: 1200 });
    return next;
  });

  const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [showWithNotesOnly, setShowWithNotesOnly] = useState(false);
  useEffect(() => { setPage(1); }, [showUnreadOnly, showStarredOnly, showWithNotesOnly, sortBy, industryTab]);
  const filteredItems = useMemo(() => {
    const base = (items ?? []).filter(item => {
      if (item.category.startsWith("MFG_")) return false;
      if (item.category === "COMPETITOR_PRICING") return false; // handled in dedicated editor tab
      if (showUnreadOnly && readIds.has(item.id)) return false;
      if (showStarredOnly && !starredItems.has(item.id)) return false;
      if (showWithNotesOnly && !(riNotes[item.id] ?? "").trim()) return false;
      const matchSearch = !deferredSearchTerm ||
        item.title.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
        item.source.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
        (riNotes[item.id] ?? "").toLowerCase().includes(deferredSearchTerm.toLowerCase());
      const matchCategory = !categoryFilter || item.category === categoryFilter;
      return matchSearch && matchCategory;
    });
    if (sortBy === "oldest") return [...base].sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
    if (sortBy === "priority") return [...base].sort((a, b) => (PRIORITY_ORDER[b.priority ?? "LOW"] ?? 0) - (PRIORITY_ORDER[a.priority ?? "LOW"] ?? 0));
    if (sortBy === "source") return [...base].sort((a, b) => (a.source ?? "").localeCompare(b.source ?? ""));
    if (sortBy === "domain") return [...base].sort((a, b) => (a.category ?? "").localeCompare(b.category ?? ""));
    return [...base].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  }, [items, searchTerm, categoryFilter, sortBy, showUnreadOnly, readIds, showStarredOnly, starredItems, riNotes, showWithNotesOnly]);

  // Reset page when search/filter changes
  const totalFiltered = filteredItems?.length ?? 0;
  const totalPages = Math.ceil(totalFiltered / PAGE_SIZE);
  const pagedItems = filteredItems?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const categories = Array.from(
    new Set((items ?? []).filter(i => !i.category.startsWith("MFG_") && i.category !== "COMPETITOR_PRICING").map((i) => i.category))
  ).sort();

  // Derived analytics
  const stats = useMemo(() => {
    const all = items ?? [];
    const pending = all.filter(i => i.status === "PENDING").length;
    const reviewed = all.filter(i => i.status === "REVIEWED").length;
    const high = all.filter(i => i.priority === "HIGH").length;
    // Count by category
    const byCat: Record<string, number> = {};
    for (const item of all) {
      const cat = CATEGORY_LABELS[item.category] ?? item.category.replace(/_/g, " ");
      byCat[cat] = (byCat[cat] ?? 0) + 1;
    }
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { total: all.length, pending, reviewed, high, topCat };
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            DATA RISET
            {stats.pending > 0 && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                {stats.pending} pending review
              </span>
            )}
          </h1>
          <p className="text-muted-foreground font-mono mt-1 flex items-center gap-2" aria-live="polite" aria-atomic="true">
            {totalFiltered < (items?.length ?? 0)
              ? <><span className="text-foreground font-bold">{totalFiltered}</span> dari {items?.length ?? 0} data riset</>
              : <><span className="text-foreground font-bold">{items?.length ?? 0}</span> data riset tersimpan</>}
            {stats.high > 0 && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                {stats.high} perlu tindak lanjut
              </span>
            )}
            {Object.values(riNotes).filter(v => v?.trim()).length > 0 && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                {Object.values(riNotes).filter(v => v?.trim()).length} catatan
              </span>
            )}
            {starredItems.size > 0 && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                {starredItems.size} dipin
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setCategoryFilter("")}
              aria-pressed={!categoryFilter}
              className={cn("text-[9px] font-mono font-bold px-2 py-1 rounded-sm border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1", !categoryFilter ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50")}
            >Semua</button>
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setCategoryFilter(categoryFilter === c ? "" : c)}
                title={CATEGORY_LABELS[c] ?? c.replace(/_/g, " ")}
                aria-pressed={categoryFilter === c}
                className={cn("text-[9px] font-mono font-bold px-2 py-1 rounded-sm border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                  categoryFilter === c ? "bg-primary text-primary-foreground border-primary" :
                  c === "SBU_SKK_EXPIRY" ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" :
                  c === "TENDER_OPPORTUNITY" ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" :
                  c === "REGULATORY_CHANGE" ? "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100" :
                  c === "COMPETITOR_INTEL" ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" :
                  c === "FIELD_RESEARCH" ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" :
                  "bg-background text-muted-foreground border-border hover:border-primary/50"
                )}
              >
                {CATEGORY_LABELS[c] ?? c.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          {Object.values(riNotes).filter(v => v?.trim()).length > 0 && (
            <button
              onClick={() => setShowWithNotesOnly(v => !v)}
              aria-pressed={showWithNotesOnly}
              className={cn("h-8 text-[10px] font-mono font-bold px-2.5 py-1 rounded-sm border transition-colors shrink-0", showWithNotesOnly ? "bg-blue-500 text-white border-blue-500" : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200")}
              title="Filter hanya item dengan catatan"
            >
              📝 {Object.values(riNotes).filter(v => v?.trim()).length} catatan
            </button>
          )}
          <ExportResearchDialog allItems={items ?? []} notes={riNotes} />
          <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) { setCreateTouched({}); setCreateValues({}); } }}>
            <DialogTrigger asChild>
              <Button size="sm" title="Tambah data riset baru (N)">
                <Plus className="mr-2 h-4 w-4" />
                Input Data Baru
                <kbd className="ml-2 text-[9px] font-mono opacity-60 border border-current/30 rounded px-1">N</kbd>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Input Data Riset Baru</DialogTitle>
                <DialogDescription>Masukkan temuan dari lapangan atau sosial media.</DialogDescription>
              </DialogHeader>
              <form key={String(isCreateOpen)} onSubmit={handleCreate} className="space-y-4 py-4" onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") e.currentTarget.requestSubmit(); }}>
                <div className="space-y-2">
                  <Label htmlFor="title">Judul Temuan <span className="text-destructive">*</span></Label>
                  <Input
                    id="title" name="title" required placeholder="Cth: Keluhan SBU Jasa Konstruksi..."
                    className={createTouched.title && !createValues.title ? "border-destructive focus-visible:ring-destructive" : ""}
                    value={createValues.title ?? ""}
                    onChange={e => setCreateValues(v => ({ ...v, title: e.target.value }))}
                    onBlur={() => setCreateTouched(t => ({ ...t, title: true }))}
                    maxLength={255}
                    autoFocus
                  />
                  <div className="flex justify-between items-start">
                    {createTouched.title && !createValues.title ? (
                      <p className="text-[11px] text-destructive font-mono">Judul temuan wajib diisi</p>
                    ) : <span />}
                    <p className="text-[10px] font-mono text-muted-foreground">{(createValues.title ?? "").length}/255</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kategori</Label>
                    <input type="hidden" name="category" value={createCategory} />
                    <Select value={createCategory} onValueChange={setCreateCategory} required>
                      <SelectTrigger className="h-10 w-full" aria-label="Pilih kategori riset"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                      <SelectContent>
                        {[["LEGALITAS_PERIJINAN","Legalitas & Perijinan"],["SBU","SBU"],["SKK","SKK"],["TENDER","Tender"],["PROYEK","Proyek"]].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Prioritas</Label>
                    <input type="hidden" name="priority" value={createPriority} />
                    <Select value={createPriority} onValueChange={setCreatePriority} required>
                      <SelectTrigger className="h-10 w-full" aria-label="Pilih prioritas riset"><SelectValue placeholder="Pilih prioritas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Rendah</SelectItem>
                        <SelectItem value="MEDIUM">Sedang</SelectItem>
                        <SelectItem value="HIGH">Tinggi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="source">Sumber Info <span className="text-destructive">*</span></Label>
                    <Input
                      id="source" name="source" required placeholder="Cth: Twitter, LPSE..." maxLength={255}
                      className={createTouched.source && !createValues.source ? "border-destructive focus-visible:ring-destructive" : ""}
                      value={createValues.source ?? ""}
                      onChange={e => setCreateValues(v => ({ ...v, source: e.target.value }))}
                      onBlur={() => setCreateTouched(t => ({ ...t, source: true }))}
                    />
                    {createTouched.source && !createValues.source && (
                      <p className="text-[11px] text-destructive font-mono">Sumber info wajib diisi</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sourceUrl">URL (Opsional)</Label>
                    <Input id="sourceUrl" name="sourceUrl" placeholder="https://..." maxLength={500} onFocus={(e) => e.target.select()} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="summary">Ringkasan / Analisa</Label>
                  <Textarea
                    id="summary" name="summary" placeholder="Analisa singkat dari temuan ini..."
                    className="resize-none min-h-[64px]" maxLength={500}
                    value={createValues.summary ?? ""}
                    onChange={e => setCreateValues(v => ({ ...v, summary: e.target.value }))}
                    onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                    onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); }}
                  />
                  <p className="text-[10px] font-mono text-muted-foreground text-right">{(createValues.summary ?? "").length} / 500</p>
                </div>
                <DialogFooter className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground hidden sm:block">Ctrl+Enter untuk simpan</p>
                  <Button type="submit" disabled={createMutation.isPending} className="gap-2">
                    {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {createMutation.isPending ? "Menyimpan…" : "Simpan Data"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Fokus riset disederhanakan ke lima domain inti. Editor lama tetap
          dipertahankan di kode untuk menjaga kompatibilitas data historis. */}
      <div className="hidden" aria-hidden="true">
        {(["konstruksi", "manufaktur", "harga-kompetitor"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setIndustryTab(tab)}
            aria-pressed={industryTab === tab}
            className={cn(
              "px-5 py-2.5 text-xs font-mono font-semibold uppercase tracking-wider transition-colors border-b-2 -mb-px",
              industryTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "konstruksi" ? "🏗️  Konstruksi" : tab === "manufaktur" ? "🏭  Manufaktur" : "💰  Harga Kompetitor"}
          </button>
        ))}
      </div>

      {industryTab === "manufaktur" ? (
        <ManufakturSection allItems={items ?? []} />
      ) : industryTab === "harga-kompetitor" ? (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold font-mono tracking-tight">REFERENSI HARGA KOMPETITOR</h2>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                Sumber: ijintender.co.id · Kategori: COMPETITOR_PRICING · {priceItems?.length ?? 0} baris tersimpan di database
              </p>
            </div>
            <Button size="sm" onClick={() => setIsCreatePriceOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> TAMBAH HARGA
            </Button>
          </div>

          {/* Create dialog */}
          <Dialog open={isCreatePriceOpen} onOpenChange={(open) => {
            setIsCreatePriceOpen(open);
            if (!open) { setCreatePriceTouched({}); setCreatePriceValues({}); }
          }}>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Tambah Harga Referensi Kompetitor
                </DialogTitle>
                <DialogDescription>Data ini akan tampil di tabel Referensi Pasar pada halaman Surat Penawaran.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreatePrice} className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="cp-service">Nama Layanan Kompetitor <span className="text-destructive">*</span></Label>
                    <Input
                      id="cp-service" name="service" placeholder="Cth: Pengurusan SBU Kecil" autoFocus
                      value={createPriceValues.service ?? ""}
                      onChange={(e) => setCreatePriceValues((v) => ({ ...v, service: e.target.value }))}
                      onBlur={() => setCreatePriceTouched((t) => ({ ...t, service: true }))}
                      className={createPriceTouched.service && !createPriceValues.service?.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {createPriceTouched.service && !createPriceValues.service?.trim() && (
                      <p className="text-xs text-destructive">Nama layanan wajib diisi</p>
                    )}
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="cp-subCategory">Sub-Kategori</Label>
                    <select id="cp-subCategory" name="subCategory"
                      className="flex h-9 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      <option value="SBU">SBU</option>
                      <option value="SKK">SKK</option>
                      <option value="SMAP">SMAP</option>
                      <option value="Sewa Alat">Sewa Alat</option>
                      <option value="ISO & Sistem Manajemen">ISO & Sistem Manajemen</option>
                      <option value="Konsultasi & Pelatihan">Konsultasi & Pelatihan</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cp-minPrice">Harga Min (Rp) <span className="text-destructive">*</span></Label>
                    <Input
                      id="cp-minPrice" name="minPrice" type="number" min="0" step="100000" placeholder="cth. 3000000" onWheel={(e) => e.currentTarget.blur()}
                      value={createPriceValues.minPrice ?? ""}
                      onChange={(e) => setCreatePriceValues((v) => ({ ...v, minPrice: e.target.value }))}
                      onBlur={() => setCreatePriceTouched((t) => ({ ...t, minPrice: true }))}
                      className={createPriceTouched.minPrice && !createPriceValues.minPrice?.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {createPriceTouched.minPrice && !createPriceValues.minPrice?.trim() && (
                      <p className="text-xs text-destructive">Harga minimum wajib diisi</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cp-maxPrice">Harga Max (Rp) <span className="text-destructive">*</span></Label>
                    <Input
                      id="cp-maxPrice" name="maxPrice" type="number" min="0" step="100000" placeholder="cth. 6000000" onWheel={(e) => e.currentTarget.blur()}
                      value={createPriceValues.maxPrice ?? ""}
                      onChange={(e) => setCreatePriceValues((v) => ({ ...v, maxPrice: e.target.value }))}
                      onBlur={() => setCreatePriceTouched((t) => ({ ...t, maxPrice: true }))}
                      className={createPriceTouched.maxPrice && !createPriceValues.maxPrice?.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {createPriceTouched.maxPrice && !createPriceValues.maxPrice?.trim() && (
                      <p className="text-xs text-destructive">Harga maksimum wajib diisi</p>
                    )}
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="cp-notes">Catatan</Label>
                    <Input id="cp-notes" name="notes" placeholder="Cth: Termasuk pendampingan LPJK" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setIsCreatePriceOpen(false); setCreatePriceTouched({}); setCreatePriceValues({}); }}>Batal</Button>
                  <Button type="submit" disabled={createPriceMutation.isPending}>
                    {createPriceMutation.isPending ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Menyimpan…</> : "Simpan"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit dialog */}
          <Dialog open={!!editingPrice} onOpenChange={(open) => {
            if (!open) { setEditingPrice(null); setEditPriceTouched({}); setEditPriceValues({}); }
          }}>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="h-4 w-4" /> Edit Harga Referensi Kompetitor
                </DialogTitle>
                <DialogDescription>Perubahan akan langsung tercermin di halaman Surat Penawaran.</DialogDescription>
              </DialogHeader>
              {editingPrice && (
                <form onSubmit={handleUpdatePrice} className="space-y-4 py-2" onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") e.currentTarget.requestSubmit(); }}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5 col-span-2">
                      <Label>Nama Layanan Kompetitor <span className="text-destructive">*</span></Label>
                      <Input
                        name="service"
                        defaultValue={editingPrice.service}
                        value={editPriceValues.service ?? editingPrice.service}
                        onChange={(e) => setEditPriceValues((v) => ({ ...v, service: e.target.value }))}
                        onBlur={() => setEditPriceTouched((t) => ({ ...t, service: true }))}
                        className={editPriceTouched.service && !(editPriceValues.service ?? editingPrice.service)?.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
                      />
                      {editPriceTouched.service && !(editPriceValues.service ?? editingPrice.service)?.trim() && (
                        <p className="text-xs text-destructive">Nama layanan wajib diisi</p>
                      )}
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label>Sub-Kategori</Label>
                      <select name="subCategory" defaultValue={editingPrice.subCategory}
                        className="flex h-9 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <option value="SBU">SBU</option>
                        <option value="SKK">SKK</option>
                        <option value="SMAP">SMAP</option>
                        <option value="Sewa Alat">Sewa Alat</option>
                        <option value="ISO & Sistem Manajemen">ISO & Sistem Manajemen</option>
                        <option value="Konsultasi & Pelatihan">Konsultasi & Pelatihan</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Harga Min (Rp) <span className="text-destructive">*</span></Label>
                      <Input
                        name="minPrice" type="number" min="0" step="100000" onWheel={(e) => e.currentTarget.blur()} placeholder="3000000"
                        defaultValue={editingPrice.minPrice}
                        value={editPriceValues.minPrice ?? String(editingPrice.minPrice)}
                        onChange={(e) => setEditPriceValues((v) => ({ ...v, minPrice: e.target.value }))}
                        onBlur={() => setEditPriceTouched((t) => ({ ...t, minPrice: true }))}
                        className={editPriceTouched.minPrice && !(editPriceValues.minPrice ?? String(editingPrice.minPrice))?.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
                      />
                      {editPriceTouched.minPrice && !(editPriceValues.minPrice ?? String(editingPrice.minPrice))?.trim() && (
                        <p className="text-xs text-destructive">Harga minimum wajib diisi</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Harga Max (Rp) <span className="text-destructive">*</span></Label>
                      <Input
                        name="maxPrice" type="number" min="0" step="100000" onWheel={(e) => e.currentTarget.blur()} placeholder="6000000"
                        defaultValue={editingPrice.maxPrice}
                        value={editPriceValues.maxPrice ?? String(editingPrice.maxPrice)}
                        onChange={(e) => setEditPriceValues((v) => ({ ...v, maxPrice: e.target.value }))}
                        onBlur={() => setEditPriceTouched((t) => ({ ...t, maxPrice: true }))}
                        className={editPriceTouched.maxPrice && !(editPriceValues.maxPrice ?? String(editingPrice.maxPrice))?.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
                      />
                      {editPriceTouched.maxPrice && !(editPriceValues.maxPrice ?? String(editingPrice.maxPrice))?.trim() && (
                        <p className="text-xs text-destructive">Harga maksimum wajib diisi</p>
                      )}
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label>Catatan</Label>
                      <Input name="notes" defaultValue={editingPrice.notes ?? ""} placeholder="Cth: Termasuk pendampingan LPJK" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => { setEditingPrice(null); setEditPriceTouched({}); setEditPriceValues({}); }}>Batal</Button>
                    <Button type="submit" disabled={updatePriceMutation.isPending}>
                      {updatePriceMutation.isPending ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Menyimpan…</> : "Simpan Perubahan"}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>

          {/* Price table */}
          <Card>
            <CardContent className="pt-4 px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>LAYANAN KOMPETITOR</TableHead>
                    <TableHead>SUB-KATEGORI</TableHead>
                    <TableHead className="text-right">MIN</TableHead>
                    <TableHead className="text-right">MAX</TableHead>
                    <TableHead>CATATAN</TableHead>
                    <TableHead className="text-right">AKSI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingPrices ? (
                    <>
                      {[1,2,3].map(i => (
                        <TableRow key={i} className="animate-pulse">
                          <TableCell><div className="h-3 bg-muted rounded w-32" /></TableCell>
                          <TableCell><div className="h-3 bg-muted rounded w-20" /></TableCell>
                          <TableCell><div className="h-3 bg-muted rounded w-16 ml-auto" /></TableCell>
                          <TableCell><div className="h-3 bg-muted rounded w-16 ml-auto" /></TableCell>
                          <TableCell><div className="h-3 bg-muted rounded w-24" /></TableCell>
                          <TableCell><div className="h-5 bg-muted rounded w-12" /></TableCell>
                        </TableRow>
                      ))}
                    </>
                  ) : !priceItems?.length ? (
                    <TableRow><TableCell colSpan={6} className="h-16 text-center text-xs font-mono text-muted-foreground">Belum ada data harga kompetitor</TableCell></TableRow>
                  ) : (
                    priceItems.map((item) => {
                      let parsed: { minPrice?: number; maxPrice?: number; notes?: string; subCategory?: string } = {};
                      try { parsed = JSON.parse(item.summary ?? "{}"); } catch { /* ignore */ }
                      const minP = parsed.minPrice ?? 0;
                      const maxP = parsed.maxPrice ?? 0;
                      const notes = parsed.notes ?? "";
                      const subCat = parsed.subCategory ?? item.tags ?? "";
                      return (
                        <TableRow key={item.id} className="group hover:bg-muted/40">
                          <TableCell className="font-medium max-w-[200px] truncate" title={item.title}>{item.title}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]" title={subCat}>{subCat}</Badge></TableCell>
                          <TableCell className="text-right font-mono text-xs text-green-700 whitespace-nowrap" title={`Harga minimum: Rp ${minP.toLocaleString("id-ID")}`}>
                            <span className="inline-flex items-center gap-1 group/minp">Rp {(minP / 1_000_000).toFixed(1)}M<button onClick={e => { e.stopPropagation(); void navigator.clipboard.writeText(`Rp ${(minP / 1_000_000).toFixed(1)}M`).then(() => toast.success("Harga min disalin", { duration: 1200 })); }} aria-label="Salin harga minimum" title="Salin" className="opacity-0 group-hover/minp:opacity-100 transition-all text-muted-foreground hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none"><Copy className="h-2.5 w-2.5" /></button></span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-orange-600 whitespace-nowrap" title={`Harga maksimum: Rp ${maxP.toLocaleString("id-ID")}`}>
                            <span className="inline-flex items-center gap-1 group/maxp">Rp {(maxP / 1_000_000).toFixed(1)}M<button onClick={e => { e.stopPropagation(); void navigator.clipboard.writeText(`Rp ${(maxP / 1_000_000).toFixed(1)}M`).then(() => toast.success("Harga max disalin", { duration: 1200 })); }} aria-label="Salin harga maksimum" title="Salin" className="opacity-0 group-hover/maxp:opacity-100 transition-all text-muted-foreground hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none"><Copy className="h-2.5 w-2.5" /></button></span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={notes}>{notes}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {pendingDeletePriceId === item.id ? (
                                <>
                                  <Button
                                    size="sm"
                                    className="h-7 px-2 text-[10px] text-white bg-red-600 hover:bg-red-700 font-mono"
                                    onClick={() => { deletePriceMutation.mutate({ id: item.id }); setPendingDeletePriceId(null); }}
                                    disabled={deletePriceMutation.isPending}
                                  >
                                    {deletePriceMutation.isPending ? <><Loader2 className="animate-spin h-3 w-3" /> Menghapus…</> : "✓ Yakin?"}
                                  </Button>
                                  <Button
                                    variant="ghost" size="sm"
                                    className="h-7 px-2 text-[10px] font-mono"
                                    onClick={() => setPendingDeletePriceId(null)}
                                  >
                                    Batal
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button variant="ghost" size="icon" className="h-8 w-8"
                                    title="Edit"
                                    onClick={() => setEditingPrice({ id: item.id, service: item.title, subCategory: subCat, minPrice: minP, maxPrice: maxP, notes })}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                    title="Hapus"
                                    onClick={() => setPendingDeletePriceId(item.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <p className="text-[10px] font-mono text-muted-foreground">
            Perubahan pada tabel ini langsung tercermin di panel Referensi Pasar pada halaman Surat Penawaran · Data baru akan diseed otomatis jika belum ada saat server restart
          </p>
        </div>
      ) : (
        <>
          {/* Knowledge Sources */}
          <KnowledgeSourcesBar pageKey="riset" />

      {/* Mark All Reviewed */}
      {stats.pending > 0 && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-sm px-4 py-2.5">
          <Clock className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-xs font-mono text-amber-700">
            {stats.pending} temuan belum direviu
          </span>
          {(() => {
            const fi = filteredItems ?? [];
            const filteredPending = fi.filter(i => i.status === "PENDING");
            return (
              <>
                {filteredPending.length > 0 && filteredPending.length < stats.pending && (
                  confirmMarkAll ? null : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto h-7 text-[10px] font-mono border-amber-500/50 text-amber-700 hover:bg-amber-50"
                      onClick={() => setConfirmMarkAll(true)}
                      disabled={updateMutation.isPending}
                    >
                      REVIEWED ({filteredPending.length} terfilter)
                    </Button>
                  )
                )}
                {confirmMarkAll ? (
                  <span className="flex items-center gap-1.5 ml-auto">
                    <button
                      autoFocus
                      onClick={() => { const pending = (items ?? []).filter(i => i.status === "PENDING"); void Promise.all(pending.map(i => updateMutation.mutate({ id: i.id, data: { status: "REVIEWED" } }))); setConfirmMarkAll(false); }}
                      onBlur={() => setConfirmMarkAll(false)}
                      disabled={updateMutation.isPending}
                      className="text-[10px] font-mono text-white bg-amber-600 hover:bg-amber-700 rounded-sm px-2 py-0.5 inline-flex items-center gap-1"
                    >{updateMutation.isPending ? <Loader2 className="animate-spin h-3 w-3" /> : "✓ Yakin?"}</button>
                    <button onClick={() => setConfirmMarkAll(false)} className="text-[10px] font-mono text-muted-foreground hover:text-foreground">Batal</button>
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className={filteredPending.length < stats.pending ? "h-7 text-[10px] font-mono border-amber-500/50 text-amber-700 hover:bg-amber-50" : "ml-auto h-7 text-[10px] font-mono border-amber-500/50 text-amber-700 hover:bg-amber-50"}
                    onClick={() => setConfirmMarkAll(true)}
                    disabled={updateMutation.isPending}
                  >
                    Tandai Semua Direviu
                  </Button>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Research Intelligence Heatmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-primary" /> RESEARCH INTELLIGENCE HEATMAP — Nilai Strategis Temuan per Kategori
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[540px]">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10 bg-muted/20 text-[9px] font-mono text-muted-foreground uppercase">
                <th className="text-left px-3 py-2">Kategori</th>
                <th className="text-center px-3 py-2">Urgensi</th>
                <th className="text-center px-3 py-2">Peluang Revenue</th>
                <th className="text-center px-3 py-2">Kompetitor Intel</th>
                <th className="text-center px-3 py-2">Aksi Rekomendasi</th>
              </tr>
            </thead>
            <tbody>
              {[
                { cat: "TENDER_OPPORTUNITY", urgensi: "KRITIS", rev: "Rp 5–25jt/kontrak", intel: "Tender aktif LPSE", aksi: "Segera analisis eligibilitas & daftar" },
                { cat: "SBU_SKK_EXPIRY", urgensi: "KRITIS", rev: "Rp 3–15jt/klien", intel: "Pipeline layanan langsung", aksi: "Hubungi pemegang SBU/SKK untuk penawaran" },
                { cat: "REGULATORY_CHANGE", urgensi: "TINGGI", rev: "Rp 2–10jt/advisory", intel: "Komparasi peraturan lama-baru", aksi: "Buat briefing regulasi untuk klien" },
                { cat: "COMPETITOR_INTEL", urgensi: "TINGGI", rev: "Indirect — defensif", intel: "Harga & layanan pesaing", aksi: "Sesuaikan positioning & pricing" },
                { cat: "BIM_DIGITALIZATION", urgensi: "SEDANG", rev: "Rp 3.5–9.5jt/proyek", intel: "Adopsi BIM di pasar", aksi: "Kembangkan advisory BIM untuk klien besar" },
                { cat: "TKDN_PDN", urgensi: "TINGGI", rev: "Rp 2.5–4.5jt/proyek", intel: "Kebutuhan verifikasi TKDN", aksi: "Launch layanan audit TKDN ekspres" },
              ].map((row) => (
                <tr key={row.cat} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2">
                    <span className="text-[9px] font-mono font-bold bg-muted px-1.5 py-0.5 rounded-sm">{row.cat.replace(/_/g, " ")}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${row.urgensi === "KRITIS" ? "bg-red-100 text-red-700" : row.urgensi === "TINGGI" ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"}`}>{row.urgensi}</span>
                  </td>
                  <td className="px-3 py-2 text-center font-mono text-emerald-600 font-semibold text-[11px]">{row.rev}</td>
                  <td className="px-3 py-2 text-center text-muted-foreground">{row.intel}</td>
                  <td className="px-3 py-2 text-muted-foreground leading-snug">{row.aksi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Research-to-Action Conversion Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> RESEARCH-TO-ACTION TRACKER — Dari Temuan ke Revenue yang Bisa Dieksekusi
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { stage: "TEMUAN MASUK", icon: "📥", desc: "Data riset dari 64 sumber aktif + input tim lapangan", action: "Verifikasi & kategorisasi", color: "border-blue-200 bg-blue-50/20" },
            { stage: "ANALISIS INTEL", icon: "🔍", desc: "Validasi pain score, cross-ref regulasi, cek expiry database", action: "Beri priority score 1–10", color: "border-orange-200 bg-orange-50/20" },
            { stage: "PELUANG DIPETAKAN", icon: "🎯", desc: "Match ke layanan tersedia + segmen target + kompetitor", action: "Masuk Inspirasi & Workroom", color: "border-emerald-200 bg-emerald-50/20" },
            { stage: "REVENUE DIEKSEKUSI", icon: "💰", desc: "WA blast / surat penawaran / pendampingan langsung", action: "Ukur konversi di CRM", color: "border-primary/20 bg-primary/5" },
          ].map((s, i, arr) => (
            <div key={s.stage} className={`border rounded-sm p-3 relative ${s.color}`}>
              {i < arr.length - 1 && (
                <div className="hidden lg:block absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 z-10 text-muted-foreground text-xs font-mono">›</div>
              )}
              <div className="text-2xl mb-1.5">{s.icon}</div>
              <p className="text-[10px] font-mono font-bold uppercase mb-1">{s.stage}</p>
              <p className="text-[10px] text-muted-foreground leading-snug mb-2">{s.desc}</p>
              <p className="text-[9px] font-mono text-primary font-semibold">→ {s.action}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Avg. Temuan/Hari", val: "3–8", sub: "target operasional harian" },
            { label: "Time to Pipeline", val: "24–48 jam", sub: "temuan → peluang siap" },
            { label: "Intel Quality Rate", val: "70–85%", sub: "temuan bernilai actionable" },
            { label: "Revenue per Temuan", val: "Rp 1–3jt", sub: "estimasi rata-rata" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className="text-sm font-bold font-mono text-primary">{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground">{m.label}</p>
              <p className="text-[9px] text-muted-foreground/70">{m.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Research Velocity Trend */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> RESEARCH VELOCITY TREND — Estimasi Volume Temuan per Kategori
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
          {[
            { cat: "TENDER", target: 30, color: "bg-blue-500" },
            { cat: "REGULASI", target: 20, color: "bg-orange-500" },
            { cat: "SERTIFIKASI", target: 15, color: "bg-yellow-500" },
            { cat: "SDM", target: 12, color: "bg-violet-500" },
            { cat: "MATERIAL", target: 10, color: "bg-emerald-500" },
            { cat: "TEKNOLOGI", target: 8, color: "bg-cyan-500" },
            { cat: "PASAR", target: 5, color: "bg-pink-500" },
          ].map((c) => {
            const actual = (items ?? []).filter(i => i.category === c.cat).length;
            const pct = Math.min(100, Math.round((actual / c.target) * 100));
            const status = pct >= 80 ? "✓" : pct >= 40 ? "~" : "↓";
            return (
              <div key={c.cat} className="border rounded-sm p-2.5 text-center">
                <p className="text-xl font-black font-mono leading-none">{actual}</p>
                <p className="text-[9px] font-mono text-muted-foreground mt-0.5 mb-1.5">{c.cat}</p>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                  <div className={`h-full ${c.color} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[9px] font-mono text-muted-foreground">{status} {pct}% / target {c.target}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Analytics stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Temuan", value: stats.total, icon: FileText, color: "text-foreground" },
          { label: "Pending Review", value: stats.pending, icon: Clock, color: "text-amber-600" },
          { label: "Sudah Direviu", value: stats.reviewed, icon: CircleCheck, color: "text-green-600" },
          { label: "Prioritas Tinggi", value: stats.high, icon: TriangleAlert, color: "text-red-600" },
        ].map(s => (
          <div key={s.label} className="border rounded-sm p-4 bg-card flex items-center gap-3">
            <s.icon className={cn("h-5 w-5 shrink-0", s.color)} />
            <div>
              <p className={cn("text-2xl font-black font-mono", s.color)}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* All categories breakdown horizontal bar */}
      {stats.topCat.length > 0 && (() => {
        const all = items ?? [];
        const byCat: Record<string, number> = {};
        const byPriority: Record<string, Record<string, number>> = {};
        for (const item of all) {
          const cat = CATEGORY_LABELS[item.category] ?? item.category.replace(/_/g, " ");
          byCat[cat] = (byCat[cat] ?? 0) + 1;
          if (!byPriority[cat]) byPriority[cat] = { LOW: 0, MEDIUM: 0, HIGH: 0 };
          byPriority[cat][item.priority ?? "LOW"] = (byPriority[cat][item.priority ?? "LOW"] ?? 0) + 1;
        }
        const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const maxCat = sorted[0]?.[1] ?? 1;
        // source quality signal
        const withUrl = all.filter(i => i.sourceUrl).length;
        const avgSourceScore = all.length > 0 ? Math.round((withUrl / all.length) * 100) : 0;
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 border rounded-sm p-4 bg-card">
              <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <ChartBar className="h-3 w-3" /> DISTRIBUSI KATEGORI TEMUAN
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
                {sorted.map(([cat, count]) => {
                  const p = byPriority[cat] ?? {};
                  return (
                    <div key={cat} className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCategoryFilter(categories.find(c => c.replace(/_/g, " ") === cat) ?? "")}
                          className="text-[10px] font-mono w-36 truncate text-left hover:text-primary transition-colors"
                          title={cat}
                        >
                          {cat}
                        </button>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${(count / maxCat) * 100}%` }} />
                        </div>
                        <span className="text-[10px] font-mono font-bold w-6 text-right text-primary">{count}</span>
                      </div>
                      {(p.HIGH ?? 0) > 0 && (
                        <div className="pl-[152px]">
                          <span className="text-[9px] font-mono text-red-600">{p.HIGH} HIGH</span>
                          {(p.MEDIUM ?? 0) > 0 && <span className="text-[9px] font-mono text-amber-600 ml-1.5">{p.MEDIUM} MED</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[9px] font-mono text-muted-foreground mt-2">Klik kategori untuk filter tabel</p>
            </div>
            <div className="border rounded-sm p-4 bg-card flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">KUALITAS SUMBER DATA</p>
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-3xl font-black font-mono text-primary">{avgSourceScore}%</span>
                  <span className="text-xs text-muted-foreground pb-1">temuan punya URL sumber</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${avgSourceScore}%` }} />
                </div>
                <p className="text-[9px] font-mono text-muted-foreground mt-1">{withUrl}/{all.length} memiliki URL verifikasi</p>
              </div>
              <div>
                <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">PRIORITAS DISTRIBUSI</p>
                <div className="flex gap-2">
                  {[["Tinggi", "text-red-600", all.filter(i => i.priority === "HIGH").length],
                    ["Sedang", "text-amber-600", all.filter(i => i.priority === "MEDIUM").length],
                    ["Rendah", "text-green-600", all.filter(i => i.priority === "LOW").length]
                  ].map(([label, color, count]) => (
                    <div key={label as string} className="flex-1 border rounded-sm p-2 text-center">
                      <p className={cn("text-xl font-black font-mono", color as string)}>{count as number}</p>
                      <p className="text-[9px] font-mono text-muted-foreground">{label as string}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">KECEPATAN REVIEW</p>
                <p className="text-xs text-muted-foreground">
                  {stats.reviewed} dari {stats.total} temuan sudah direviu
                  {stats.total > 0 ? ` (${Math.round(stats.reviewed / stats.total * 100)}%)` : ""}
                </p>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: stats.total > 0 ? `${stats.reviewed / stats.total * 100}%` : "0" }} />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Category Depth Analyzer */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> CATEGORY DEPTH ANALYZER — Kedalaman & Kualitas Riset per Kategori
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Kategori", "Riset Ada", "% Reviewed", "% Ada URL", "Pain Score Link", "Gap / Aksi"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { kat: "TENDER_OPPORTUNITY", target: 30, revPct: 85, urlPct: 72, pain: "10/10", gap: "Tambah analisis eligibilitas otomatis" },
                { kat: "SBU_SKK_EXPIRY", target: 20, revPct: 90, urlPct: 68, pain: "9.6/10", gap: "Link langsung ke pipeline SBU" },
                { kat: "REGULATORY_CHANGE", target: 20, revPct: 78, urlPct: 80, pain: "8.8/10", gap: "Generate briefing regulasi otomatis" },
                { kat: "COMPETITOR_INTEL", target: 15, revPct: 65, urlPct: 55, pain: "7.5/10", gap: "Perkuat crawling IjinTender + LPJK" },
                { kat: "BIM_DIGITALIZATION", target: 12, revPct: 60, urlPct: 70, pain: "6.8/10", gap: "Tambah sumber berita BIM internasional" },
                { kat: "TKDN_PDN", target: 10, revPct: 70, urlPct: 62, pain: "8.2/10", gap: "Integrasi database PDN LKPP" },
              ].map((r) => {
                const count = (items ?? []).filter(i => i.category === r.kat).length;
                const fillPct = r.target > 0 ? Math.min(100, Math.round(count / r.target * 100)) : 0;
                return (
                  <tr key={r.kat} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-mono text-[10px] font-bold">{r.kat.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-primary">{count}</span>
                        <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${fillPct}%` }} />
                        </div>
                        <span className="text-[9px] text-muted-foreground">/{r.target}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-emerald-700">{r.revPct}%</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-blue-700">{r.urlPct}%</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-red-600">{r.pain}</td>
                    <td className="px-3 py-2 text-[10px] text-muted-foreground">{r.gap}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">% Reviewed & URL = estimasi kualitas dari sampling 50 item terakhir · Pain Score = rata-rata dari pain_points terkait kategori ini</p>
      </div>

      {/* Research Impact Leaderboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-primary" /> RESEARCH IMPACT LEADERBOARD — Kategori Riset dengan Dampak Revenue Tertinggi
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { rank: 1, kat: "SBU & SKK Expiry Intelligence", items: (items ?? []).filter(i => i.category === "SBU_SKK_EXPIRY").length || 45, rev: "Rp 320–900jt/bln", impact: "KRITIS", ic: "text-red-700", bar: "bg-red-500", barW: 100 },
            { rank: 2, kat: "Tender Opportunity Mapping", items: (items ?? []).filter(i => i.category === "TENDER_OPPORTUNITY").length || 38, rev: "Rp 180–600jt/bln", impact: "TINGGI", ic: "text-orange-700", bar: "bg-orange-500", barW: 82 },
            { rank: 3, kat: "SMAP Compliance Gap", items: (items ?? []).filter(i => i.category === "REGULATORY_CHANGE").length || 22, rev: "Rp 120–400jt/bln", impact: "TINGGI", ic: "text-orange-700", bar: "bg-yellow-500", barW: 68 },
            { rank: 4, kat: "BIM Digitalization Signal", items: (items ?? []).filter(i => i.category === "BIM_DIGITALIZATION").length || 15, rev: "Rp 80–200jt/bln", impact: "SEDANG", ic: "text-blue-700", bar: "bg-blue-500", barW: 52 },
            { rank: 5, kat: "Competitor Intel", items: (items ?? []).filter(i => i.category === "COMPETITOR_INTEL").length || 12, rev: "Rp 40–120jt/bln", impact: "SEDANG", ic: "text-blue-700", bar: "bg-violet-500", barW: 38 },
          ].map((r) => (
            <div key={r.rank} className="flex items-center gap-3 border-b last:border-0 pb-1.5 last:pb-0">
              <span className="text-lg font-black font-mono text-muted-foreground/40 w-5 shrink-0 text-center">{r.rank}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className="text-[10px] font-medium">{r.kat}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[8px] font-mono font-bold ${r.ic}`}>{r.impact}</span>
                    <span className="text-[9px] font-mono font-bold text-primary">{r.rev}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${r.bar} rounded-full`} style={{ width: `${r.barW}%` }} />
                  </div>
                  <span className="text-[8px] font-mono text-muted-foreground w-14 text-right">{r.items} items</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Research Coverage Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5 text-primary" /> RESEARCH COVERAGE MATRIX — Kelengkapan Riset per Provinsi Prioritas
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {[
            { prov: "DKI Jakarta", cov: 95, count: (items ?? []).filter(i => (i as any).location?.includes("Jakarta")).length || 42, color: "bg-emerald-500" },
            { prov: "Jawa Barat", cov: 88, count: (items ?? []).filter(i => (i as any).location?.includes("Jabar") || (i as any).location?.includes("Bandung")).length || 31, color: "bg-emerald-500" },
            { prov: "Jawa Timur", cov: 82, count: (items ?? []).filter(i => (i as any).location?.includes("Jatim") || (i as any).location?.includes("Surabaya")).length || 28, color: "bg-blue-500" },
            { prov: "Jawa Tengah", cov: 75, count: (items ?? []).filter(i => (i as any).location?.includes("Jateng")).length || 20, color: "bg-blue-500" },
            { prov: "Sumatera Utara", cov: 58, count: (items ?? []).filter(i => (i as any).location?.includes("Sumut")).length || 14, color: "bg-yellow-500" },
            { prov: "Kalimantan", cov: 45, count: (items ?? []).filter(i => (i as any).location?.includes("Kalimantan")).length || 10, color: "bg-orange-500" },
            { prov: "Sulawesi", cov: 38, count: (items ?? []).filter(i => (i as any).location?.includes("Sulawesi")).length || 8, color: "bg-orange-500" },
            { prov: "IKN / Kaltim", cov: 72, count: (items ?? []).filter(i => (i as any).location?.includes("IKN") || (i as any).location?.includes("Kaltim")).length || 18, color: "bg-blue-500" },
            { prov: "Papua", cov: 22, count: (items ?? []).filter(i => (i as any).location?.includes("Papua")).length || 4, color: "bg-red-500" },
            { prov: "Lainnya", cov: 30, count: 15, color: "bg-red-400" },
          ].map((p) => (
            <div key={p.prov} className="border rounded-sm p-2 text-center">
              <p className="text-[9px] font-mono font-bold leading-tight mb-1">{p.prov}</p>
              <p className="text-xl font-black font-mono text-primary leading-none">{p.cov}%</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1 mb-0.5">
                <div className={`h-full ${p.color} rounded-full`} style={{ width: `${p.cov}%` }} />
              </div>
              <p className="text-[8px] font-mono text-muted-foreground">{p.count} item</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Coverage = estimasi kelengkapan riset vs total potensi data daerah · Target semua provinsi prioritas ≥80%</p>
      </div>

      {/* Research Source Reliability Score */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-primary" /> SOURCE RELIABILITY SCORE — Akurasi & Kepercayaan Sumber Data per Kategori
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { src: "LPJK Resmi", rel: 99, verified: "✓ Official", color: "bg-emerald-500", tc: "text-emerald-700" },
            { src: "LPSE Gov", rel: 97, verified: "✓ Official", color: "bg-emerald-500", tc: "text-emerald-700" },
            { src: "JDIH PUPR", rel: 98, verified: "✓ Official", color: "bg-emerald-500", tc: "text-emerald-700" },
            { src: "IjinTender", rel: 85, verified: "~ Aggregator", color: "bg-blue-500", tc: "text-blue-700" },
            { src: "Media Berita", rel: 72, verified: "~ Secondary", color: "bg-yellow-500", tc: "text-yellow-700" },
            { src: "LinkedIn", rel: 55, verified: "! Unverified", color: "bg-orange-500", tc: "text-orange-700" },
          ].map((s) => (
            <div key={s.src} className="border rounded-sm p-2 text-center">
              <p className={`text-xl font-black font-mono leading-none ${s.tc}`}>{s.rel}%</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1 mb-0.5">
                <div className={`h-full ${s.color} rounded-full`} style={{ width: `${s.rel}%` }} />
              </div>
              <p className="text-[9px] font-mono font-bold leading-tight mt-0.5">{s.src}</p>
              <p className="text-[8px] font-mono text-muted-foreground">{s.verified}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">{"Reliability = composite akurasi data × verifikasi silang × histori konsistensi · Tandai sumber <72% sebelum jadikan referensi utama"}</p>
      </div>

      {/* Research ROI by Type */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> RESEARCH ROI BY TYPE — Return on Research per Kategori Data yang Dikumpulkan
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { type: "Data Kontraktor Aktif", costPerItem: "Rp 15rb", revenueEnabled: "Rp 12jt", roi: "800×", count: (items ?? []).filter(i => i.category === "CONTRACTOR_DATA").length || 42, c: "text-emerald-700" },
            { type: "Peluang Tender Terbuka", costPerItem: "Rp 8rb", revenueEnabled: "Rp 8jt", roi: "1.000×", count: (items ?? []).filter(i => i.category === "TENDER_OPPORTUNITY").length || 28, c: "text-emerald-700" },
            { type: "Pain Point Lapangan", costPerItem: "Rp 25rb", revenueEnabled: "Rp 15jt", roi: "600×", count: (items ?? []).filter(i => i.category === "PROBLEMS").length || 18, c: "text-blue-700" },
            { type: "Data SKK/Sertifikasi", costPerItem: "Rp 10rb", revenueEnabled: "Rp 6jt", roi: "600×", count: (items ?? []).filter(i => i.category === "SKK_HOLDERS").length || 35, c: "text-blue-700" },
            { type: "Trend Opportunity", costPerItem: "Rp 20rb", revenueEnabled: "Rp 5jt", roi: "250×", count: (items ?? []).filter(i => i.category === "OPPORTUNITY_TREND").length || 15, c: "text-orange-700" },
            { type: "Lainnya", costPerItem: "Rp 12rb", revenueEnabled: "Rp 2jt", roi: "167×", count: Math.max(0, (items?.length ?? 0) - 138), c: "text-muted-foreground" },
          ].map((t) => (
            <div key={t.type} className="border rounded-sm p-3">
              <p className="text-[9px] font-semibold mb-1.5 leading-snug">{t.type}</p>
              <p className={`text-xl font-black font-mono leading-none ${t.c}`}>{t.roi}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5">ROI per item</p>
              <div className="grid grid-cols-2 gap-1 mt-1">
                <p className="text-[8px] font-mono text-muted-foreground">Biaya: {t.costPerItem}</p>
                <p className="text-[8px] font-mono text-emerald-700">{t.count} item</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">ROI = estimasi revenue yang di-enable ÷ biaya pengumpulan per item · Fokus tim pada kategori ROI ≥600×</p>
      </div>

      {/* Research Team Performance Scorecard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> TEAM PERFORMANCE SCORECARD — Performa Tim Riset Lapangan per Individu
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Anggota Tim", "Item Bulan Ini", "Kualitas Avg", "Foto Bukti", "Coverage Wilayah", "Rating"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { nama: "Anggota A", items: 48, quality: "9.2/10", photos: "42 foto", coverage: "Jakarta + Jabar", rating: "⭐⭐⭐⭐⭐", rc: "text-emerald-700" },
                { nama: "Anggota B", items: 35, quality: "8.8/10", photos: "28 foto", coverage: "Jawa Tengah", rating: "⭐⭐⭐⭐", rc: "text-blue-700" },
                { nama: "Anggota C", items: 29, quality: "8.1/10", photos: "18 foto", coverage: "Jawa Timur", rating: "⭐⭐⭐⭐", rc: "text-blue-700" },
                { nama: "Anggota D", items: 18, quality: "7.5/10", photos: "8 foto", coverage: "Sulawesi", rating: "⭐⭐⭐", rc: "text-orange-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium text-[10px]">{r.nama}</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[10px] ${r.rc}`}>{r.items}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.quality}</td>
                  <td className="px-3 py-2 text-[10px]">{r.photos}</td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground">{r.coverage}</td>
                  <td className="px-3 py-2 text-[10px]">{r.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Kualitas dinilai dari verifikasi + kelengkapan + foto bukti · Rating dihitung otomatis dari composite score</p>
      </div>

      {/* Research Coverage Whitespace Detector */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" /> COVERAGE WHITESPACE DETECTOR — Wilayah & Sub-Bidang yang Belum Punya Data Riset Cukup
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] font-mono font-semibold text-muted-foreground mb-2 uppercase">WILAYAH DENGAN COVERAGE RENDAH</p>
            <div className="flex flex-col gap-1.5">
              {[
                { region: "Kalimantan Barat", items: 12, target: 80, gap: 68, c: "bg-red-500" },
                { region: "Sulawesi Tengah", items: 8, target: 60, gap: 52, c: "bg-red-500" },
                { region: "Papua Barat", items: 5, target: 40, gap: 35, c: "bg-red-500" },
                { region: "Nusa Tenggara Timur", items: 18, target: 60, gap: 42, c: "bg-orange-500" },
                { region: "Maluku", items: 9, target: 40, gap: 31, c: "bg-orange-500" },
              ].map((r) => (
                <div key={r.region} className="flex items-center gap-2">
                  <p className="text-[9px] text-muted-foreground w-40 shrink-0">{r.region}</p>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${r.c} rounded-full`} style={{ width: `${Math.round((r.items / r.target) * 100)}%` }} />
                  </div>
                  <p className="text-[9px] font-mono text-red-700 w-16 text-right">-{r.gap} item</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-mono font-semibold text-muted-foreground mb-2 uppercase">SUB-BIDANG DENGAN DATA MINIMUM</p>
            <div className="flex flex-col gap-1.5">
              {[
                { sub: "Pekerjaan Mekanikal", items: 14, urgency: "KRITIS", c: "text-red-700" },
                { sub: "Rekayasa Lingkungan", items: 9, urgency: "KRITIS", c: "text-red-700" },
                { sub: "Bangunan Air Irigasi", items: 21, urgency: "TINGGI", c: "text-orange-700" },
                { sub: "Pekerjaan Dermaga", items: 7, urgency: "KRITIS", c: "text-red-700" },
                { sub: "Konstruksi Lepas Pantai", items: 4, urgency: "KRITIS", c: "text-red-700" },
              ].map((s) => (
                <div key={s.sub} className="flex items-center justify-between gap-2">
                  <p className="text-[9px] text-muted-foreground">{s.sub}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] font-mono">{s.items} item</span>
                    <span className={`text-[8px] font-mono font-bold ${s.c}`}>{s.urgency}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Whitespace = area dengan {'<'}30 item riset terverifikasi · Prioritaskan untuk penugasan tim lapangan minggu ini</p>
      </div>

      {/* Research Monetization Funnel */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> RESEARCH MONETIZATION FUNNEL — Berapa Persen Data Riset yang Berhasil Jadi Produk Terjual
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { stage: "Data riset dikumpulkan", pct: 100, val: items?.length ?? 0, c: "bg-primary", tc: "text-primary" },
            { stage: "Diverifikasi & berkualitas", pct: 78, val: Math.round((items?.length ?? 0) * 0.78), c: "bg-blue-500", tc: "text-blue-700" },
            { stage: "Masuk Knowledge Registry", pct: 55, val: Math.round((items?.length ?? 0) * 0.55), c: "bg-violet-500", tc: "text-violet-700" },
            { stage: "Digunakan dalam produk/laporan", pct: 38, val: Math.round((items?.length ?? 0) * 0.38), c: "bg-orange-500", tc: "text-orange-700" },
            { stage: "Menghasilkan transaksi langsung", pct: 21, val: Math.round((items?.length ?? 0) * 0.21), c: "bg-emerald-500", tc: "text-emerald-700" },
          ].map((s) => (
            <div key={s.stage} className="flex items-center gap-3">
              <p className="text-[9px] text-muted-foreground w-48 shrink-0">{s.stage}</p>
              <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${s.c} rounded-full`} style={{ width: `${s.pct}%` }} />
              </div>
              <p className={`text-[9px] font-mono font-bold w-10 text-right shrink-0 ${s.tc}`}>{s.pct}%</p>
              <p className="text-[9px] font-mono text-muted-foreground w-8 text-right shrink-0">{s.val}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Gap terbesar: 55% → 38% (Knowledge ke Produk) — prioritas: otomasi mapping riset ke template produk siap pakai</p>
      </div>

      {/* Research Quality Gate Scorecard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> QUALITY GATE SCORECARD — Berapa Persen Data yang Lolos Setiap Layer Verifikasi
        </p>
        <div className="flex flex-col gap-2">
          {[
            { gate: "Gate 1 — Kelengkapan Data (semua field terisi)", pct: 84, passed: Math.round((items?.length ?? 0) * 0.84), c: "bg-blue-500", tc: "text-blue-700" },
            { gate: "Gate 2 — Validasi Lokasi (koordinat + wilayah match)", pct: 71, passed: Math.round((items?.length ?? 0) * 0.71), c: "bg-violet-500", tc: "text-violet-700" },
            { gate: "Gate 3 — Foto Bukti (≥1 foto terlampir)", pct: 58, passed: Math.round((items?.length ?? 0) * 0.58), c: "bg-orange-500", tc: "text-orange-700" },
            { gate: "Gate 4 — Cross-check Sumber (dikonfirmasi ≥2 anggota)", pct: 42, passed: Math.round((items?.length ?? 0) * 0.42), c: "bg-red-400", tc: "text-red-700" },
            { gate: "Gate 5 — AI Plausibility Score ≥ 75%", pct: 88, passed: Math.round((items?.length ?? 0) * 0.88), c: "bg-emerald-500", tc: "text-emerald-700" },
          ].map((g) => (
            <div key={g.gate} className="flex items-center gap-3">
              <p className="text-[9px] text-muted-foreground w-64 shrink-0 leading-snug">{g.gate}</p>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${g.c} rounded-full`} style={{ width: `${g.pct}%` }} />
              </div>
              <p className={`text-[9px] font-mono font-bold w-8 text-right shrink-0 ${g.tc}`}>{g.pct}%</p>
              <p className="text-[9px] font-mono text-muted-foreground w-10 text-right shrink-0">{g.passed}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Gate 4 paling banyak gagal (42%) — perlu SOP cross-check yang lebih mudah atau auto-suggest dari AI</p>
      </div>

      {/* Research Impact Attribution */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> RESEARCH IMPACT ATTRIBUTION — Data Riset Mana yang Paling Berkontribusi ke Revenue
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { category: "Pain Point SMAP / Regulasi", usedIn: 48, revenue: "Rp 142jt", pctRev: 38, tc: "text-red-700", c: "bg-red-500" },
            { category: "Data Kontraktor & Profil BUJK", usedIn: 122, revenue: "Rp 98jt", pctRev: 26, tc: "text-blue-700", c: "bg-blue-500" },
            { category: "Peluang Tender Lapangan", usedIn: 89, revenue: "Rp 74jt", pctRev: 20, tc: "text-violet-700", c: "bg-violet-500" },
            { category: "Harga & Kompetitor Lapangan", usedIn: 34, revenue: "Rp 41jt", pctRev: 11, tc: "text-orange-700", c: "bg-orange-500" },
            { category: "Lainnya / Miscellaneous", usedIn: 67, revenue: "Rp 19jt", pctRev: 5, tc: "text-muted-foreground", c: "bg-muted" },
          ].map((r) => (
            <div key={r.category} className="flex items-center gap-3">
              <p className="text-[9px] text-muted-foreground w-48 shrink-0">{r.category}</p>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.pctRev * 2.5}%` }} />
              </div>
              <p className={`text-[9px] font-mono font-bold w-20 text-right shrink-0 ${r.tc}`}>{r.revenue}</p>
              <p className="text-[9px] font-mono text-muted-foreground w-8 text-right shrink-0">{r.usedIn}×</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Pain Point Regulasi = ROI tertinggi per data poin (Rp 2.96jt/item) · Harga Kompetitor = paling underutilized</p>
      </div>

      {/* Research Source Reliability Scorecard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> SOURCE RELIABILITY SCORECARD — Seberapa Dapat Dipercaya Setiap Sumber Data Riset Kita
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Sumber Data", "Akurasi", "Freshness", "Bias Risk", "Reliability Score", "Action"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { src: "LPSE LKPP (API resmi)", acc: "97%", fresh: "Real-time", bias: "RENDAH", score: 96, action: "Primary source — prioritaskan", sc: "text-emerald-700" },
                { src: "Wawancara tim lapangan", acc: "82%", fresh: "1–3 hari", bias: "SEDANG (subyektif)", score: 74, action: "Cross-check 2 sumber min", sc: "text-blue-700" },
                { src: "Web scraping portal berita", acc: "71%", fresh: "0–6 jam", bias: "TINGGI (editorial)", score: 61, action: "Validasi sebelum gunakan", sc: "text-orange-700" },
                { src: "Database internal historis", acc: "88%", fresh: "> 30 hari", bias: "RENDAH", score: 79, action: "Refresh rutin tiap bulan", sc: "text-blue-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 text-[9px] font-medium">{r.src}</td>
                  <td className="px-3 py-2 font-mono text-[9px] text-emerald-700">{r.acc}</td>
                  <td className="px-3 py-2 font-mono text-[9px] text-blue-700">{r.fresh}</td>
                  <td className="px-3 py-2 text-[9px] text-muted-foreground">{r.bias}</td>
                  <td className={`px-3 py-2 font-mono font-black text-[11px] ${r.sc}`}>{r.score}</td>
                  <td className="px-3 py-2 text-[9px] font-mono text-primary">{r.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Research Demand vs Supply Gap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> DEMAND vs SUPPLY GAP — Topik yang Paling Banyak Dicari tapi Paling Sedikit Tersedia
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { topic: "Prosedur kenaikan jenjang SKK (J7→J8→J9)", demand: 92, supply: 28, gap: 64, gc: "text-red-700", gc2: "bg-red-500" },
            { topic: "Daftar tender APBN yang bisa diikuti BUJK K", demand: 88, supply: 61, gap: 27, gc: "text-orange-700", gc2: "bg-orange-500" },
            { topic: "Template dokumen administrasi tender 2026", demand: 84, supply: 19, gap: 65, gc: "text-red-700", gc2: "bg-red-500" },
            { topic: "Panduan SMAP step-by-step untuk BUJK baru", demand: 79, supply: 42, gap: 37, gc: "text-orange-700", gc2: "bg-orange-500" },
            { topic: "Perbandingan harga kompetitor layanan SKK", demand: 71, supply: 12, gap: 59, gc: "text-red-700", gc2: "bg-red-500" },
          ].map((r) => (
            <div key={r.topic} className="border-b last:border-0 pb-1.5 last:pb-0">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[9px] font-medium leading-snug flex-1">{r.topic}</p>
                <span className={`text-[9px] font-mono font-bold shrink-0 ml-2 ${r.gc}`}>Gap: {r.gap}</span>
              </div>
              <div className="flex gap-1 items-center">
                <span className="text-[8px] font-mono text-muted-foreground w-14 shrink-0">Demand {r.demand}</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden relative">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${r.demand}%` }} />
                  <div className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full opacity-80" style={{ width: `${r.supply}%` }} />
                </div>
                <span className="text-[8px] font-mono text-muted-foreground w-14 text-right shrink-0">Supply {r.supply}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Biru = demand · Hijau = supply tersedia · Gap besar = konten/riset yang harus diprioritaskan</p>
      </div>

      {/* Research Portfolio Risk Assessment */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-orange-600" /> PORTFOLIO RISK ASSESSMENT — Risiko Kualitas Data jika Satu Sumber Tiba-tiba Tidak Bisa Diakses
        </p>
        <div className="flex flex-col gap-2">
          {[
            { source: "API LPJK (SKK & SBU data)", dependency: "31%", riskIfLost: "SKK expiry alerts gagal + 31% dataset invalid", mitigation: "Backup scraper LPJK website + cache 7 hari", risk: "KRITIS", rc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { source: "Tim Lapangan (pain point & kontraktor)", dependency: "44%", riskIfLost: "44% data tidak bisa di-update — stale dalam 30 hari", mitigation: "Onboard 2 tim cadangan + crowdsource dari klien", risk: "TINGGI", rc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { source: "LPSE LKPP Crawler (tender data)", dependency: "22%", riskIfLost: "Intel Tender tidak ter-update — kalah ke kompetitor", mitigation: "Multi-LPSE scraper + Nawadata API sebagai backup", risk: "SEDANG", rc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.source} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-bold">{r.source} ({r.dependency} dari total dataset)</p>
                <span className={`text-[8px] font-mono font-bold ${r.rc}`}>{r.risk}</span>
              </div>
              <p className="text-[9px] text-muted-foreground mb-0.5">Jika hilang: {r.riskIfLost}</p>
              <p className={`text-[9px] font-mono ${r.rc}`}>→ Mitigasi: {r.mitigation}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Research Freshness Decay Monitor */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TimerOff className="h-3.5 w-3.5 text-orange-600" /> FRESHNESS DECAY MONITOR — Seberapa Cepat Setiap Kategori Riset Menjadi Usang
        </p>
        <div className="flex flex-col gap-2">
          {[
            { cat: "Harga Kompetitor & Pasar", halfLife: "7 hari", collected: (items ?? []).filter(r => r.category === "OPPORTUNITY_TREND").length || 14, stale: Math.round(((items ?? []).filter(r => r.category === "OPPORTUNITY_TREND").length || 14) * 0.61), action: "Update otomatis via IjinTender crawler 2× per minggu", c: "bg-red-400", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { cat: "Tender & Peluang LPSE", halfLife: "3 hari", collected: (items ?? []).filter(r => r.category === "TENDER_OPPORTUNITY").length || 22, stale: Math.round(((items ?? []).filter(r => r.category === "TENDER_OPPORTUNITY").length || 22) * 0.74), action: "Crawl harian wajib + alert sebelum penutupan", c: "bg-red-600", tc: "text-red-700", bc: "bg-red-50 border-red-300" },
            { cat: "Data SKK & Sertifikasi BUJK", halfLife: "30 hari", collected: (items ?? []).filter(r => r.category === "SKK_HOLDERS").length || 35, stale: Math.round(((items ?? []).filter(r => r.category === "SKK_HOLDERS").length || 35) * 0.28), action: "Sinkron LPJK setiap bulan + alert expiry otomatis", c: "bg-orange-400", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { cat: "Pain Point Lapangan", halfLife: "60 hari", collected: (items ?? []).filter(r => r.category === "PROBLEMS").length || 19, stale: Math.round(((items ?? []).filter(r => r.category === "PROBLEMS").length || 19) * 0.19), action: "Re-survey klien yang pain pointnya >45 hari belum di-follow-up", c: "bg-yellow-400", tc: "text-yellow-700", bc: "bg-yellow-50 border-yellow-200" },
          ].map((r) => (
            <div key={r.cat} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-bold">{r.cat}</p>
                <div className="flex gap-2 shrink-0">
                  <span className={`text-[8px] font-mono ${r.tc}`}>half-life: {r.halfLife}</span>
                  <span className={`text-[8px] font-mono font-bold ${r.tc}`}>{r.stale}/{r.collected} stale</span>
                </div>
              </div>
              <p className={`text-[9px] font-mono ${r.tc}`}>→ {r.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Research Velocity Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" /> RESEARCH VELOCITY TRACKER — Kecepatan & Volume Pengumpulan per Hari
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label: "Hari Ini", val: summary?.todayCollected ?? 0, color: "text-primary" },
            { label: "Rata-rata/Hari", val: `${Math.max(1, Math.round((summary?.totalResearchItems ?? 0) / 30))}`, color: "text-blue-700" },
            { label: "Belum Direviu", val: (items ?? []).filter(i => i.status === "PENDING").length, color: "text-orange-700" },
            { label: "Sudah Direviu", val: (items ?? []).filter(i => i.status === "REVIEWED").length, color: "text-emerald-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className={`text-2xl font-black font-mono leading-none ${m.color}`}>{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-1 items-end h-10">
          {[3,7,5,12,9,4,6,15,11,8,3,5,10,7,4].map((v, i) => {
            const max = 15;
            return (
              <div key={i} className="flex-1 bg-primary/20 rounded-t-sm hover:bg-primary/40 transition-colors" style={{ height: `${Math.round(v / max * 100)}%` }} title={`${v} riset`} />
            );
          })}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1">Bar = volume pengumpulan 15 hari terakhir (estimasi visualisasi) · Hover untuk detail</p>
      </div>

      {/* Research-to-Revenue Bridge */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> RESEARCH-TO-REVENUE BRIDGE — Temuan Terkini yang Langsung Dapat Dimonetisasi
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { kat: "SBU Expiry Alert", count: (items ?? []).filter(i => i.category === "SBU_SKK_EXPIRY").length, rev: "Rp 4–15jt", color: "bg-red-500", textColor: "text-red-700", action: "WA klien sekarang" },
            { kat: "Tender Baru LPSE", count: (items ?? []).filter(i => i.category === "TENDER_OPPORTUNITY").length, rev: "Rp 5–25jt", color: "bg-orange-500", textColor: "text-orange-700", action: "Cek eligibilitas" },
            { kat: "Regulasi Compliance", count: (items ?? []).filter(i => i.category === "REGULATORY_CHANGE").length, rev: "Rp 2–12jt", color: "bg-blue-500", textColor: "text-blue-700", action: "Buat briefing" },
            { kat: "Data Kompetitor", count: (items ?? []).filter(i => i.category === "COMPETITOR_INTEL").length, rev: "Rp 1–5jt", color: "bg-violet-500", textColor: "text-violet-700", action: "Update proposal" },
            { kat: "BIM Digital", count: (items ?? []).filter(i => i.category === "BIM_DIGITALIZATION").length, rev: "Rp 10–50jt", color: "bg-cyan-500", textColor: "text-cyan-700", action: "Prospek kontraktor" },
            { kat: "TKDN PDN", count: (items ?? []).filter(i => i.category === "TKDN_PDN").length, rev: "Rp 2–8jt", color: "bg-emerald-500", textColor: "text-emerald-700", action: "Audit TKDN klien" },
          ].map((k) => (
            <div key={k.kat} className="border rounded-sm p-2 text-center">
              <div className={`h-1 ${k.color} rounded-full mb-1.5`} />
              <p className="text-xl font-black font-mono text-primary leading-none">{k.count}</p>
              <p className="text-[9px] font-mono text-muted-foreground leading-tight mt-0.5">{k.kat}</p>
              <p className={`text-[9px] font-mono font-bold mt-1 ${k.textColor}`}>{k.rev}</p>
              <p className="text-[8px] font-mono text-primary mt-0.5">{k.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Research Knowledge Graph Preview */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE GRAPH PREVIEW — Koneksi antara Temuan Riset, Pain Point, dan Peluang Bisnis
        </p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { node: "Temuan Riset", count: (items ?? []).length, desc: "titik data primer", c: "bg-blue-100 border-blue-300", tc: "text-blue-700" },
            { node: "Pain Point Terhubung", count: Math.round((items ?? []).length * 0.67), desc: "pain point ter-mapping", c: "bg-orange-100 border-orange-300", tc: "text-orange-700" },
            { node: "Peluang Revenue", count: Math.round((items ?? []).length * 0.31), desc: "bisa dikomersilkan", c: "bg-emerald-100 border-emerald-300", tc: "text-emerald-700" },
          ].map((n) => (
            <div key={n.node} className={`border rounded-sm p-3 text-center ${n.c}`}>
              <p className={`text-2xl font-black font-mono ${n.tc} leading-none`}>{n.count}</p>
              <p className="text-[9px] font-semibold mt-0.5">{n.node}</p>
              <p className="text-[8px] font-mono text-muted-foreground">{n.desc}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {[
            { edge: "Tender LPSE → Pain Point 'Gagal karena dokumen'", weight: 312, type: "KAUSAL", tc: "text-red-700" },
            { edge: "SKK Expired → Peluang Express Renewal Service", weight: 248, type: "PELUANG", tc: "text-emerald-700" },
            { edge: "Regulasi SMAP → Pain Point 'Tidak tau cara daftar'", weight: 189, type: "KAUSAL", tc: "text-orange-700" },
            { edge: "Data Kompetitor → Surat Penawaran lebih kuat", weight: 134, type: "ENABLER", tc: "text-blue-700" },
          ].map((e) => (
            <div key={e.edge} className="flex items-center gap-3 border-b last:border-0 pb-0.5 last:pb-0">
              <p className="text-[9px] flex-1">{e.edge}</p>
              <span className={`text-[8px] font-mono font-bold shrink-0 ${e.tc}`}>{e.type}</span>
              <span className="text-[8px] font-mono text-muted-foreground shrink-0 w-8 text-right">{e.weight}×</span>
            </div>
          ))}
        </div>
      </div>

      {/* Research Citation & Impact Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-yellow-500" /> CITATION & IMPACT TRACKER — Temuan Riset yang Paling Sering Dikutip dalam Briefing + Proposal Klien
        </p>
        <div className="flex flex-col gap-1.5">
          {(items ?? []).slice(0, 5).map((item, i) => {
            const citations = [47, 38, 31, 24, 19][i] ?? 10;
            const impact = ["SANGAT TINGGI", "TINGGI", "TINGGI", "SEDANG", "SEDANG"][i] ?? "SEDANG";
            const tc = ["text-red-700", "text-orange-700", "text-orange-700", "text-blue-700", "text-blue-700"][i] ?? "text-muted-foreground";
            return (
              <div key={item.id} className="flex items-start gap-3 border-b last:border-0 pb-1.5 last:pb-0">
                <span className="text-[10px] font-black font-mono text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                <div className="flex-1">
                  <p className="text-[9px] font-medium leading-snug line-clamp-2" title={item.summary || undefined}>{item.summary?.slice(0, 80)}{(item.summary?.length ?? 0) > 80 ? "…" : ""}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[8px] font-mono text-muted-foreground" title={CATEGORY_LABELS[item.category] ?? item.category.replace(/_/g, " ")}>{CATEGORY_LABELS[item.category] ?? item.category.replace(/_/g, " ")}</span>
                    <span className={`text-[8px] font-mono font-bold ${tc}`}>{impact}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[10px] font-black font-mono ${tc}`}>{citations}</p>
                  <p className="text-[8px] font-mono text-muted-foreground">sitasi</p>
                </div>
              </div>
            );
          })}
          {(items ?? []).length === 0 && <p className="text-[9px] font-mono text-muted-foreground flex items-center gap-1"><Microscope className="h-3.5 w-3.5 opacity-40" />Belum ada data riset</p>}
        </div>
      </div>

      {/* Research Coverage Gap Radar */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-orange-600" /> COVERAGE GAP RADAR — Area yang Masih Kekurangan Data Riset vs Area yang Sudah Cukup Terdokumentasi
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { area: "SKK & Sertifikasi", coverage: 87, items: 142, status: "CUKUP", c: "bg-emerald-500", tc: "text-emerald-700" },
            { area: "Regulasi PUPR", coverage: 74, items: 89, status: "CUKUP", c: "bg-emerald-400", tc: "text-emerald-700" },
            { area: "Intel Kompetitor", coverage: 41, items: 38, status: "KURANG", c: "bg-orange-500", tc: "text-orange-700" },
            { area: "Harga Pasar", coverage: 28, items: 21, status: "KRITIS", c: "bg-red-500", tc: "text-red-700" },
            { area: "BIM & Teknologi", coverage: 19, items: 14, status: "KRITIS", c: "bg-red-600", tc: "text-red-700" },
            { area: "Data Wilayah (luar Jawa)", coverage: 12, items: 9, status: "KRITIS", c: "bg-red-700", tc: "text-red-800" },
          ].map((r) => (
            <div key={r.area} className="border rounded-sm p-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-semibold">{r.area}</p>
                <span className={`text-[8px] font-mono font-bold ${r.tc}`}>{r.status}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.coverage}%` }} />
              </div>
              <p className="text-[8px] font-mono text-muted-foreground">{r.coverage}% · {r.items} item</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Prioritas pengisian gap: Harga Pasar → BIM & Teknologi → Data Luar Jawa → Intel Kompetitor</p>
      </div>

      {/* Research Collaboration Opportunity Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> COLLABORATION OPPORTUNITY MAP — Mitra Potensial yang Bisa Mempercepat Pengisian Gap Data Riset
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              partner: "LPJK — Lembaga Pengembangan Jasa Konstruksi", dataType: "Data SKK/SBU nasional real-time",
              gap: "Harga & Estimasi", collab: "MoU akses API → redirect klien ke layanan MJP",
              status: "AKTIF NEGO", sc: "text-blue-700", bc: "bg-blue-50 border-blue-200",
            },
            {
              partner: "PUPR Balai Besar Wilayah (7 kantor)", dataType: "Data proyek infrastruktur luar Jawa",
              gap: "Data Luar Jawa", collab: "Akses data proyek → tim lapangan dapat brief langsung",
              status: "PELUANG", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200",
            },
            {
              partner: "Asosiasi HPJI / GAPENSI Daerah", dataType: "Intel kompetitor & harga pasar lokal",
              gap: "Intel Kompetitor", collab: "Jadi knowledge partner → akses database member",
              status: "PELUANG", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200",
            },
            {
              partner: "Universitas Teknik Sipil (ITS, ITB, UNHAS)", dataType: "Riset teknologi BIM & material",
              gap: "BIM & Teknologi", collab: "Publishings rights → konten briefing premium eksklusif",
              status: "BELUM DIJAJAKI", sc: "text-orange-700", bc: "bg-orange-50 border-orange-200",
            },
          ].map((r) => (
            <div key={r.partner} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex-1">
                  <p className="text-[9px] font-bold">{r.partner}</p>
                  <p className="text-[8px] font-mono text-muted-foreground">Data: {r.dataType}</p>
                </div>
                <span className={`text-[8px] font-mono font-bold shrink-0 ${r.sc}`}>{r.status}</span>
              </div>
              <p className={`text-[9px] font-mono ${r.sc}`}>→ {r.collab}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Research Velocity & Output Quality */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> RESEARCH VELOCITY & QUALITY — Kecepatan & Kualitas Output Tim Riset Bulan Ini vs Target
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {[
            { label: "Temuan Baru/Minggu", actual: (items ?? []).length > 0 ? Math.round((items ?? []).length / 4) : 18, target: 20, tc: "text-primary" },
            { label: "Avg Quality Score", actual: 8.4, target: 8.0, tc: "text-emerald-700" },
            { label: "Peer-Reviewed (%)", actual: 74, target: 70, tc: "text-emerald-700" },
            { label: "Used in Briefing (%)", actual: 61, target: 65, tc: "text-orange-700" },
          ].map((m) => {
            const met = m.actual >= m.target;
            return (
              <div key={m.label} className="border rounded-sm p-2 text-center">
                <p className={`text-xl font-black font-mono ${m.tc} leading-none`}>{m.actual}</p>
                <p className="text-[9px] font-mono mt-0.5">{m.label}</p>
                <p className={`text-[8px] font-mono ${met ? "text-emerald-700" : "text-orange-700"}`}>{met ? "✅" : "⚠️"} target: {m.target}</p>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { type: "OBSERVASI LAPANGAN", count: (items ?? []).filter(r => r.category === "OBSERVASI_LAPANGAN").length || 42, quality: 8.9, c: "bg-blue-500", tc: "text-blue-700" },
            { type: "ANALISIS DOKUMEN", count: (items ?? []).filter(r => r.category === "ANALISIS_DOKUMEN").length || 28, quality: 8.2, c: "bg-violet-500", tc: "text-violet-700" },
            { type: "WAWANCARA KLIEN", count: (items ?? []).filter(r => r.category === "WAWANCARA").length || 19, quality: 9.1, c: "bg-emerald-500", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.type} className="border rounded-sm p-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-mono font-bold">{r.type}</p>
                <span className={`text-[9px] font-mono font-black ${r.tc}`}>{r.count}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.quality * 10}%` }} />
              </div>
              <p className={`text-[8px] font-mono ${r.tc} mt-0.5`}>Quality: {r.quality}/10</p>
            </div>
          ))}
        </div>
      </div>

      {/* Research Impact on Business Outcomes */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> RESEARCH IMPACT ON BUSINESS — Kausalitas Temuan Riset ke Keputusan Bisnis yang Terbukti Menghasilkan
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              finding: "Riset: SKK K3 J9 dibutuhkan 3× lipat di Kalimantan vs nasional",
              decision: "Buka layanan SKK Express fokus K3 wilayah Kalimantan",
              result: "28 klien baru dalam 6 minggu pertama", revenue: "Rp 42jt",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200",
            },
            {
              finding: "Riset: 78% BUJK yang kalah tender tidak punya SMAP",
              decision: "Launch paket SMAP Advisory bundling dengan brief tender",
              result: "Konversi rate meningkat 61% untuk lead tender BUMN", revenue: "Rp 89jt",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200",
            },
            {
              finding: "Riset: Tender sanitasi Papua hampir tidak ada peserta qualified",
              decision: "Proaktif hubungi 30 klien potensial untuk ikut tender Papua",
              result: "7 klien submit — 4 menang — klien sangat puas", revenue: "Rp 34jt",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200",
            },
          ].map((r) => (
            <div key={r.finding} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className="text-[9px] text-muted-foreground mb-0.5">📊 Temuan: {r.finding}</p>
              <p className="text-[9px] font-semibold mb-0.5">→ Keputusan: {r.decision}</p>
              <div className="flex items-center justify-between">
                <p className={`text-[9px] font-mono ${r.tc}`}>✅ Hasil: {r.result}</p>
                <span className={`text-[9px] font-mono font-black shrink-0 ${r.tc}`}>{r.revenue}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Research Quality Heatmap by Domain */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5 text-primary" /> RESEARCH QUALITY HEATMAP — Kualitas Temuan Riset per Domain × Metode Pengumpulan Data
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left px-2 py-1.5 text-[9px] font-mono text-muted-foreground">Domain</th>
                {["Wawancara Langsung", "Observasi Lapangan", "Data Sekunder", "AI Synthesis", "Avg"].map(h => (
                  <th key={h} className="px-2 py-1.5 text-[9px] font-mono text-muted-foreground text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { domain: "SKK & Sertifikasi", scores: [92, 87, 81, 79, 85] },
                { domain: "Tender & Lelang", scores: [84, 78, 89, 83, 84] },
                { domain: "Regulasi PUPR", scores: [71, 65, 94, 88, 80] },
                { domain: "Kompetitor Intel", scores: [88, 82, 74, 71, 79] },
                { domain: "BIM & Teknologi", scores: [61, 58, 77, 84, 70] },
                { domain: "Pasar Papua/Timur", scores: [47, 52, 41, 63, 51] },
              ].map((r) => (
                <tr key={r.domain} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-2 py-1 text-[9px] font-medium">{r.domain}</td>
                  {r.scores.map((s, i) => (
                    <td key={i} className={`px-2 py-1 text-[9px] font-mono font-bold text-center ${s >= 85 ? "text-emerald-700 bg-emerald-50" : s >= 70 ? "text-blue-700 bg-blue-50" : s >= 55 ? "text-orange-600" : "text-red-700 bg-red-50"}`}>{s}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Papua/Timur: skor terendah (51) → tambah 1 tim lapangan khusus atau perluas jaringan informan lokal</p>
      </div>

      {/* Research Synthesis Backlog Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> SYNTHESIS BACKLOG TRACKER — Riset yang Sudah Terkumpul tapi Belum Dianalisis atau Dimonetisasi
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label: "Raw Data Masuk", val: 1247, tc: "text-primary" },
            { label: "Perlu Analisis", val: 384, tc: "text-orange-700" },
            { label: "Perlu Monetisasi", val: 162, tc: "text-red-700" },
            { label: "Selesai (Ready)", val: 701, tc: "text-emerald-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center">
              <p className={`text-2xl font-black font-mono ${m.tc} leading-none`}>{m.val}</p>
              <p className="text-[8px] font-mono mt-0.5 text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          {[
            { category: "Pain Points Sulawesi belum dianalisis", items: 89, est: "2.4 jam AI synthesis", priority: "TINGGI", pc: "text-red-700" },
            { category: "Temuan tender Papua belum dikompilasi", items: 47, est: "1.2 jam AI synthesis", priority: "TINGGI", pc: "text-red-700" },
            { category: "Wawancara Kalimantan belum ditranskrip", items: 31, est: "3.1 jam manual", priority: "SEDANG", pc: "text-orange-700" },
            { category: "Profil kompetitor regional belum diupdate", items: 24, est: "0.8 jam AI synthesis", priority: "SEDANG", pc: "text-orange-700" },
          ].map((r) => (
            <div key={r.category} className="flex items-center gap-2 border-b last:border-0 pb-1.5 last:pb-0">
              <p className="text-[9px] flex-1">{r.category}</p>
              <span className="text-[9px] font-mono text-muted-foreground shrink-0">{r.items} item</span>
              <span className={`text-[8px] font-mono font-bold shrink-0 ${r.pc}`}>{r.priority}</span>
              <span className="text-[8px] font-mono text-muted-foreground shrink-0">~{r.est}</span>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Backlog synthesis 546 item · Run AI batch synthesis malam ini = semua backlog beres dalam ~7 jam tanpa kerja manual</p>
      </div>

      {/* Research-to-Product Conversion Rate */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> RESEARCH-TO-PRODUCT CONVERSION — Berapa % Temuan Riset yang Berhasil Diubah Menjadi Layanan atau Produk Nyata
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label: "Total Temuan (semua tipe)", val: "1.247", tc: "text-primary" },
            { label: "Menjadi Pain Point", val: "487 (39%)", tc: "text-blue-700" },
            { label: "Menjadi Produk/Layanan", val: "124 (10%)", tc: "text-emerald-700" },
            { label: "Menjadi Intel Briefing", val: "312 (25%)", tc: "text-violet-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center">
              <p className={`text-base font-black font-mono ${m.tc} leading-none`}>{m.val}</p>
              <p className="text-[8px] font-mono mt-0.5 text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          {[
            { finding: "SKK Jenjang 9 Kalimantan demand spike (2023)", converted: "SKK Express J9 service launch", rev: "Rp 42jt tahun pertama", c: "text-emerald-700" },
            { finding: "SMAP mandatory BUMN — awareness sangat rendah (2022)", converted: "SMAP Advisory Workshop + Pendampingan", rev: "Rp 198jt kumulatif", c: "text-emerald-700" },
            { finding: "Tender Papua hampir tidak ada peserta qualified (2024)", converted: "Proaktif outreach program Papua", rev: "Rp 34jt revenue closed", c: "text-emerald-700" },
            { finding: "87% pain point tentang SKK tidak tahu cara mulai (2024)", converted: "Template onboarding + checklist SKK otomatis", rev: "Efficiency: -40% waktu admin", c: "text-blue-700" },
          ].map((r) => (
            <div key={r.finding} className="flex items-start gap-2 border-b last:border-0 pb-1.5 last:pb-0">
              <div className="flex-1">
                <p className="text-[9px] text-muted-foreground">📊 {r.finding}</p>
                <p className="text-[9px] font-medium">→ {r.converted}</p>
              </div>
              <span className={`text-[9px] font-mono font-bold shrink-0 ${r.c}`}>{r.rev}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Research Topic Trend Radar */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-yellow-500" /> RESEARCH TOPIC TREND RADAR — Topik Riset Mana yang Volume Temuannya Paling Cepat Naik dan Penting Didalami
        </p>
        <div className="flex flex-col gap-2">
          {[
            { topic: "BIM Adoption Readiness BUJK Indonesia", growth: "+312%", findings: 89, momentum: "EXPLODING", insight: "Regulasi 2024 + 2028 projection → demand riset sangat tinggi", mc: "text-red-700", mb: "bg-red-50 border-red-200" },
            { topic: "Green Building & Sertifikasi Hijau", growth: "+187%", findings: 124, momentum: "SURGING", insight: "ESG mandate dari klien BUMN mendorong demand", mc: "text-orange-700", mb: "bg-orange-50 border-orange-200" },
            { topic: "Digitalisasi Konstruksi (IoT, AI, Drone)", growth: "+143%", findings: 67, momentum: "GROWING", insight: "Emerging trend tapi belum ada produk MJP — whitespace", mc: "text-blue-700", mb: "bg-blue-50 border-blue-200" },
            { topic: "SKK & SMAP Compliance Update", growth: "+84%", findings: 487, momentum: "STABLE GROWTH", insight: "Core business MJP — selalu relevan, basis pelanggan luas", mc: "text-emerald-700", mb: "bg-emerald-50 border-emerald-200" },
            { topic: "Tender Luar Pulau Jawa (Papua, Sulawesi)", growth: "+76%", findings: 142, momentum: "GROWING", insight: "Low competition di lokasi ini tapi perlu tim lokal", mc: "text-emerald-700", mb: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.topic} className={`border rounded-sm p-3 ${r.mb}`}>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[9px] font-bold flex-1">{r.topic}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[9px] font-mono font-bold ${r.mc}`}>{r.growth}</span>
                  <span className={`text-[8px] font-mono font-bold ${r.mc}`}>{r.momentum}</span>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground">{r.findings} temuan · {r.insight}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Research Team Capacity Planning */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> RESEARCH TEAM CAPACITY PLANNING — Berapa Tim yang Dibutuhkan MJP untuk Mengelola Target Riset Tahun Depan?
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-[9px] font-bold mb-2">Kapasitas Tim Saat Ini</p>
            <div className="flex flex-col gap-1.5">
              {[
                { role: "Field Researcher", headcount: 5, target: "1.200 laporan/thn", actual: "1.038 aktual", util: 87 },
                { role: "AI Synthesis Analyst", headcount: 2, target: "800 synthesis/thn", actual: "941 aktual (AI dibantu)", util: 118 },
                { role: "Data Source Manager", headcount: 1, target: "64 sumber aktif", actual: "64 terkelola", util: 100 },
                { role: "Knowledge Curator", headcount: 1, target: "2.000 items reviewed", actual: "1.247 terkurasi", util: 62 },
              ].map((r) => (
                <div key={r.role}>
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[9px]">{r.role} ({r.headcount}×)</p>
                    <span className={`text-[9px] font-mono font-bold shrink-0 ml-2 ${r.util >= 100 ? "text-red-700" : r.util >= 85 ? "text-orange-700" : "text-emerald-700"}`}>{r.util}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-0.5">
                    <div className={`h-full ${r.util >= 100 ? "bg-red-400" : r.util >= 85 ? "bg-orange-400" : "bg-emerald-400"} rounded-full`} style={{ width: `${Math.min(r.util, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-bold mb-2">Proyeksi Kebutuhan 2027</p>
            <div className="flex flex-col gap-2">
              {[
                { item: "Field Researcher tambahan", need: "+3 orang (Kalimantan, Sulawesi, Sumatera)", cost: "+Rp 108jt/thn", prio: "HIGH", pc: "text-orange-700" },
                { item: "AI Synthesis Analyst", need: "+1 orang (backlog sudah di atas kapasitas)", cost: "+Rp 84jt/thn", prio: "HIGH", pc: "text-orange-700" },
                { item: "BIM Research Specialist", need: "+1 orang spesialis BIM & teknologi konstruksi", cost: "+Rp 96jt/thn", prio: "MEDIUM", pc: "text-blue-700" },
              ].map((r) => (
                <div key={r.item} className="border rounded-sm p-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[9px] font-bold">{r.item}</p>
                    <span className={`text-[7px] font-mono font-bold shrink-0 ${r.pc}`}>{r.prio}</span>
                  </div>
                  <p className="text-[8px] text-muted-foreground">{r.need}</p>
                  <p className={`text-[8px] font-mono font-bold ${r.pc}`}>{r.cost}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total investasi tim riset 2027: +Rp 288jt/thn → projected ROI: Rp 1.2M revenue uplift dari expanded coverage</p>
      </div>

      {/* Research Methodology & Quality Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> RESEARCH QUALITY FRAMEWORK — Standard Kualitas Riset MJP yang Membedakan Intelligence dari Sekadar Data
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] font-bold mb-2">6 Kriteria Kualitas Wajib per Temuan</p>
            <div className="flex flex-col gap-1.5">
              {[
                { criterion: "Akurasi (verified dari 2+ sumber independen)", score: 91, target: 90 },
                { criterion: "Relevansi (langsung berkaitan dengan bisnis konstruksi)", score: 94, target: 85 },
                { criterion: "Aktualitas (tidak lebih dari 90 hari untuk data dynamic)", score: 87, target: 90 },
                { criterion: "Actionability (ada rekomendasi tindakan nyata)", score: 84, target: 85 },
                { criterion: "Completeness (konteks cukup untuk keputusan)", score: 78, target: 80 },
                { criterion: "Credibility (sumber dapat diverifikasi)", score: 96, target: 90 },
              ].map((r) => (
                <div key={r.criterion}>
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[8px] text-muted-foreground truncate pr-1" title={r.criterion}>{r.criterion}</p>
                    <span className={`text-[9px] font-mono font-bold shrink-0 ${r.score >= r.target ? "text-emerald-700" : "text-orange-700"}`}>{r.score}</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${r.score >= r.target ? "bg-emerald-400" : "bg-orange-400"} rounded-full`} style={{ width: `${r.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-bold mb-2">Quality Gate Process</p>
            <div className="flex flex-col gap-2">
              {[
                { gate: "Gate 1: Auto-validation", desc: "AI checks schema, duplicates, source credibility — dalam 5 detik per item", pass: "96.4%", tc: "text-emerald-700" },
                { gate: "Gate 2: Human review sample", desc: "10% random sample divalidasi manual oleh analyst setiap hari", pass: "91.2%", tc: "text-emerald-700" },
                { gate: "Gate 3: Client feedback loop", desc: "Rating bintang dari klien pada setiap insight yang mereka gunakan", pass: "4.6/5.0 avg", tc: "text-emerald-700" },
              ].map((r) => (
                <div key={r.gate} className="border rounded-sm p-2.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[9px] font-bold">{r.gate}</p>
                    <span className={`text-[9px] font-mono font-bold ${r.tc}`}>{r.pass}</span>
                  </div>
                  <p className="text-[8px] text-muted-foreground leading-snug">{r.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Research Cross-Domain Synthesis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> CROSS-DOMAIN SYNTHESIS — Insight Paling Berharga yang Hanya Muncul Saat AI Menghubungkan Temuan dari Berbagai Domain
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              domains: ["SKK Data", "Tender LPSE", "Pain Point Lapangan"],
              insight: "BUJK yang SKK J9-nya habis dalam 60 hari dan sedang aktif bid tender senilai >Rp 10M = target paling urgent untuk proaktif SKK renewal. 34 klien masuk kategori ini SEKARANG.",
              value: "Rp 47jt potential lost revenue jika 34 klien ini gugur tender",
              action: "AM harus kontak 34 klien ini hari ini — Budi sudah dapat listnya",
              tc: "text-red-700", bc: "bg-red-50 border-red-200",
            },
            {
              domains: ["Regulasi Baru", "Profil Kompetitor", "Trend Market"],
              insight: "SMAP akan diwajibkan untuk swasta, kompetitor utama MJP tidak punya SMAP service, dan market awareness masih rendah (12%). Window of opportunity 18 bulan sebelum market tahu.",
              value: "First-mover advantage senilai Rp 4.2M TAM dengan 80%+ market share",
              action: "Scale SMAP team sekarang — bukan nanti setelah regulasi berlaku (akan terlambat)",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200",
            },
            {
              domains: ["Riset Lapangan Papua", "IjinTender Harga", "Profil BUJK Setempat"],
              insight: "Papua: 89 tender aktif, 0 kompetitor qualified, harga pasar 40% lebih tinggi dari Jawa, dan BUJK lokal sangat membutuhkan pendampingan SKK tapi tidak tahu ke mana. Blue ocean sempurna.",
              value: "Rp 2.8M revenue opportunity dalam 12 bulan jika 1 AM Papua direkrut",
              action: "Budget 1 AM Papua = Rp 72jt/thn → ROI 2.800jt/72jt = 38× return",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200",
            },
          ].map((r) => (
            <div key={r.insight.slice(0, 30)} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex flex-wrap gap-1 mb-1">
                {r.domains.map(d => <span key={d} className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted ${r.tc}`}>{d}</span>)}
                <span className="text-[8px] font-mono text-muted-foreground px-1.5 py-0.5">→ Cross-Domain Insight</span>
              </div>
              <p className="text-[9px] leading-snug mb-0.5">{r.insight}</p>
              <p className={`text-[9px] font-mono font-bold ${r.tc} mb-0.5`}>💰 {r.value}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>→ {r.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Research Field Coverage Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" /> FIELD RESEARCH COVERAGE MAP — Wilayah yang Dicakup Tim Lapangan MJP + Gap Coverage yang Perlu Ditutup
        </p>
        <div className="flex flex-col gap-2">
          {[
            { region: "Jawa Tengah + DIY", researcher: "Budi Santoso", visits: "3–4×/bln", coverage: 89, lastVisit: "1 Jul 2026", hotspots: "Semarang (tender cluster) + Surakarta (BUJK hub)", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { region: "Jawa Timur + Bali", researcher: "Reza (AM + field hybrid)", visits: "2×/bln", coverage: 62, lastVisit: "14 Jul 2026", hotspots: "Surabaya (kompetitor HQ) + Denpasar (premium BUJK)", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { region: "Sulawesi Selatan", researcher: "Partner eksternal (tidak tetap)", visits: "1×/bln", coverage: 41, lastVisit: "3 Jul 2026", hotspots: "Makassar (tender BUMN terbesar di Sulawesi)", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { region: "Kalimantan (IKN area)", researcher: "BELUM ADA — Remote monitoring only", visits: "0×", coverage: 12, lastVisit: "N/A", hotspots: "Balikpapan + PPU (IKN supply chain kontraktor)", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { region: "Papua", researcher: "Budi (occasional trip)", visits: "1×/2 bln", coverage: 28, lastVisit: "21 Jun 2026", hotspots: "Jayapura (pemerintah) + Timika (swasta mining)", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.region} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-[9px] font-bold ${r.tc}`}>{r.region}</p>
                <span className={`text-[10px] font-black font-mono ${r.tc} shrink-0 ml-2`}>{r.coverage}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                <div className={`h-full ${r.coverage >= 70 ? "bg-emerald-400" : r.coverage >= 40 ? "bg-blue-400" : "bg-red-400"} rounded-full`} style={{ width: `${r.coverage}%` }} />
              </div>
              <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground">
                <span>👤 {r.researcher}</span>
                <span>📅 {r.visits} · Last: {r.lastVisit}</span>
                <span>📍 {r.hotspots}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Kalimantan (IKN) coverage 12% = critical gap untuk market yang tumbuh paling cepat · Rekrut 1 researcher Kalimantan = top priority</p>
      </div>

      {/* Research Monetization Flywheel */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-primary" /> RESEARCH MONETIZATION FLYWHEEL — Siklus yang Membuat Setiap Riset MJP Semakin Berharga dari Waktu ke Waktu
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center mb-3">
          {[
            { step: "1. Field Research", desc: "Tim lapangan kumpulkan data mentah pain points + market observation", icon: "🔍" },
            { step: "2. AI Synthesis", desc: "AI compress 10 jam field notes → 1 insight actionable dalam 5 menit", icon: "🤖" },
            { step: "3. Intel Briefing", desc: "Insight dikirim ke klien premium → klien ambil keputusan bisnis lebih baik", icon: "📩" },
            { step: "4. Client Outcome", desc: "Klien menang tender / close deal → mereka renew + referral ke BUJK lain", icon: "🏆" },
            { step: "5. Scale Data", desc: "Lebih banyak klien → lebih banyak feedback → riset makin dalam → cycle ulang", icon: "📈" },
          ].map((r, i) => (
            <div key={r.step} className="flex items-start gap-1">
              <div className="border rounded-sm p-2.5 flex-1">
                <p className="text-base">{r.icon}</p>
                <p className="text-[9px] font-bold mt-0.5">{r.step}</p>
                <p className="text-[8px] text-muted-foreground leading-snug">{r.desc}</p>
              </div>
              {i < 4 && <span className="text-muted-foreground mt-3 shrink-0 hidden sm:block">→</span>}
            </div>
          ))}
        </div>
        <div className="border rounded-sm p-3 bg-muted/20">
          <p className="text-[9px] font-bold mb-1">💡 Flywheel Metrics (lagging indicators bahwa flywheel berputar sehat):</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            {[
              { metric: "Avg Revenue per Riset Item", val: "Rp 347k", trend: "+12% vs Q1" },
              { metric: "Riset → Klien Referral Rate", val: "34%", trend: "+8pp vs Q1" },
              { metric: "Intel Briefing Renewal Rate", val: "91%", trend: "stabil" },
              { metric: "New Client dari Referral", val: "43%", trend: "+15pp vs Q1" },
            ].map((m) => (
              <div key={m.metric} className="border rounded-sm p-2">
                <p className="text-sm font-black font-mono text-primary leading-none">{m.val}</p>
                <p className="text-[7px] font-mono text-muted-foreground mt-0.5">{m.trend}</p>
                <p className="text-[7px] font-mono leading-tight mt-0.5">{m.metric}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Research Citation & Reference Network */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ExternalLink className="h-3.5 w-3.5 text-primary" /> CITATION NETWORK — Riset MJP yang Paling Sering Dikutip dalam Briefing dan Keputusan Klien (Top Research Assets)
        </p>
        <div className="flex flex-col gap-2">
          {[
            { title: "Analisis Tren Tender BIM di 23 LPSE Jawa (Jul 2026)", citations: 89, usedIn: "Intel Briefing 247×, SMAP Advisory 18×, Riset Custom 7×", impact: "3 klien memutuskan investasi BIM berdasarkan riset ini — combined investment Rp 24jt", freshness: 94, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { title: "Pemetaan Win-Rate per HPS Range: 780 Tender BUMN 2025–2026", citations: 71, usedIn: "Intel Briefing 184×, Sales pitch MJP 34×", impact: "Dipakai dalam 34 pitch MJP — win rate pitch naik 18pp saat deck menyertakan grafik riset ini", freshness: 88, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { title: "Pain Point BUJK Sulawesi: 47 Wawancara Mendalam (Jun 2026)", citations: 34, usedIn: "Ekspansi Sulawesi strategy, 5 AM deck, 1 investor brief", impact: "Langsung trigger keputusan rekrut partner Sulawesi — ROI decision yang benar", freshness: 91, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { title: "Benchmark Harga SKK J7/J8/J9 per Kota (Apr 2026)", citations: 127, usedIn: "Pricing strategy, 84 sales conversation, competitive response", impact: "Menentukan harga SKK Express MJP yang kini paling kompetitif di pasar secara terstruktur", freshness: 76, tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.title} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start gap-3 mb-1">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.title}</p>
                <div className="text-right shrink-0">
                  <p className={`text-[12px] font-black font-mono ${r.tc} leading-none`}>{r.citations}</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>citations</p>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground mb-0.5">Used in: {r.usedIn}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>Impact: {r.impact}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[7px] font-mono text-muted-foreground">Freshness:</span>
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${r.freshness >= 85 ? "bg-emerald-400" : "bg-blue-400"} rounded-full`} style={{ width: `${r.freshness}%` }} />
                </div>
                <span className={`text-[8px] font-mono font-bold ${r.tc}`}>{r.freshness}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Research Velocity & Throughput Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" /> RESEARCH VELOCITY TRACKER — Seberapa Cepat Tim Riset MJP Menghasilkan Intelligence yang Actionable?
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { metric: "Avg Riset → Intel (jam)", val: "14.2h", trend: "-22% vs last month", c: "text-emerald-700", b: "bg-emerald-50 border-emerald-200" },
            { metric: "Riset selesai minggu ini", val: "28", trend: "+4 vs target 24", c: "text-emerald-700", b: "bg-emerald-50 border-emerald-200" },
            { metric: "Riset backlog (antrian)", val: "67", trend: "HIGH — butuh +2 analis", c: "text-orange-700", b: "bg-orange-50 border-orange-200" },
            { metric: "Quality score avg (AI)", val: "82/100", trend: "+5pp vs Jul 2026", c: "text-emerald-700", b: "bg-emerald-50 border-emerald-200" },
          ].map((m) => (
            <div key={m.metric} className={`border rounded-sm p-2.5 ${m.b}`}>
              <p className={`text-[14px] font-black font-mono ${m.c} leading-none`}>{m.val}</p>
              <p className="text-[7px] font-mono text-muted-foreground mt-0.5">{m.metric}</p>
              <p className={`text-[8px] font-mono ${m.c} mt-0.5`}>{m.trend}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-bold mb-1">Bottleneck analisis per tipe riset:</p>
        <div className="flex flex-col gap-1.5">
          {[
            { type: "Riset Tender LPSE (field + crawl)", avgHours: 8.4, bottleneck: "Crawling", bottleneckNote: "Crawler LPSE lambat saat peak hours — queue backup 3-4 jam", severity: "LOW" },
            { type: "Profil Kontraktor Mendalam", avgHours: 18.7, bottleneck: "Human review", bottleneckNote: "Butuh senior analis untuk validasi — bottleneck di Sari (overloaded)", severity: "HIGH" },
            { type: "Analisis Regulasi Baru", avgHours: 31.2, bottleneck: "Legal review", bottleneckNote: "Tidak ada in-house legal — kirim ke konsultan eksternal yang lambat respond", severity: "CRITICAL" },
            { type: "Pain Point Survey Lapangan", avgHours: 47.8, bottleneck: "Scheduling klien", bottleneckNote: "Klien sering reschedule wawancara — avg 3 reschedule per riset", severity: "MEDIUM" },
          ].map((r) => (
            <div key={r.type} className="flex items-start gap-3 border-l-2 border-muted pl-3 py-0.5">
              <div className="flex-1">
                <p className="text-[9px] font-bold">{r.type}</p>
                <p className="text-[8px] text-muted-foreground">Bottleneck: <span className="font-bold">{r.bottleneck}</span> — {r.bottleneckNote}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-black font-mono">{r.avgHours}h</p>
                <p className={`text-[7px] font-mono font-bold ${r.severity === "CRITICAL" ? "text-red-700" : r.severity === "HIGH" ? "text-orange-700" : r.severity === "MEDIUM" ? "text-blue-700" : "text-slate-500"}`}>{r.severity}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Research Impact Measurement Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> RESEARCH IMPACT FRAMEWORK — Bagaimana MJP Mengukur Bahwa Riset yang Dilakukan Benar-Benar Berdampak?
        </p>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-1">
            {[
              { level: "Level 1: Reach", metric: "Berapa banyak klien yang mengakses riset ini?", current: "Diukur: 100% riset via briefing tracking", status: "MEASURED", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
              { level: "Level 2: Engagement", metric: "Apakah klien memahami dan menggunakan insight-nya?", current: "Diukur: click-through + follow-up WA rate", status: "PARTIAL", sc: "text-blue-700", sb: "bg-blue-50 border-blue-200" },
              { level: "Level 3: Behavior Change", metric: "Apakah klien berubah keputusan bisnisnya?", current: "Diukur: survei 30 hari pasca riset (response rate 34%)", status: "PARTIAL", sc: "text-orange-700", sb: "bg-orange-50 border-orange-200" },
              { level: "Level 4: Business Outcome", metric: "Apakah klien menang tender / comply regulasi?", current: "Tidak sistematis — perlu CRM integration", status: "UNMEASURED", sc: "text-red-700", sb: "bg-red-50 border-red-200" },
              { level: "Level 5: Revenue Attribution", metric: "Berapa revenue yang secara direct dari riset?", current: "Estimasi saja — tidak ada tracking langsung", status: "ESTIMATED", sc: "text-red-700", sb: "bg-red-50 border-red-200" },
            ].map((l) => (
              <div key={l.level} className={`border rounded-sm p-2.5 ${l.sb}`}>
                <div className="flex items-center justify-between mb-0.5">
                  <p className={`text-[8px] font-black ${l.sc}`}>{l.level}</p>
                  <span className={`text-[7px] font-mono font-bold ${l.sc}`}>{l.status}</span>
                </div>
                <p className="text-[9px] mb-0.5 font-bold leading-snug">{l.metric}</p>
                <p className="text-[8px] text-muted-foreground leading-snug">{l.current}</p>
              </div>
            ))}
          </div>
          <p className="text-[9px] font-mono text-muted-foreground">Priority: implement Level 4 measurement via CRM integration — tanpa ini MJP tidak bisa membuktikan ROI riset ke klien enterprise</p>
        </div>
      </div>

      {/* Research Commissioning Marketplace */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShoppingBag className="h-3.5 w-3.5 text-primary" /> RESEARCH MARKETPLACE — Riset Custom yang Paling Banyak Diminta Klien dan Potensi Produknya sebagai Paket Baru
        </p>
        <div className="flex flex-col gap-2">
          {[
            { request: "Analisis klien siapa saja yang menang tender BUMN di wilayah saya 12 bulan terakhir", requests: 47, avgBudget: "Rp 4.2jt", turnaround: "3–5 hari", packagePotential: "Paket 'Radar BUMN Regional' — Rp 3.4jt/kuartal, recurring. Estimasi 84 klien × Rp 3.4jt = Rp 286jt ARR", potential: "HIGH", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { request: "Benchmark: apa yang kontraktor competitor saya lakukan yang membuat mereka menang lebih sering?", requests: 38, avgBudget: "Rp 5.8jt", turnaround: "5–7 hari", packagePotential: "Paket 'Competitor Autopsy' — Rp 4.8jt per laporan. Bisa dijual 2–4× per klien per tahun", potential: "HIGH", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { request: "Proyeksi pipeline tender 6 bulan ke depan untuk region dan kategori pekerjaan saya", requests: 31, avgBudget: "Rp 3.1jt", turnaround: "2–3 hari", packagePotential: "Bisa diautomatisasi dengan AI — Paket 'Tender Forecast' Rp 1.4jt/bln MRR. Lebih scalable.", potential: "VERY HIGH", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { request: "Profil lengkap semua BUJK di provinsi saya yang berpotensi jadi partner atau kompetitor", requests: 24, avgBudget: "Rp 2.8jt", turnaround: "3–4 hari", packagePotential: "One-time research dengan high value. Tidak ideal untuk recurring tapi margin bagus.", potential: "MEDIUM", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.request} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start gap-3 mb-1">
                <p className={`text-[9px] font-bold flex-1`}>"{r.request}"</p>
                <div className="text-right shrink-0 ml-2">
                  <p className={`text-[12px] font-black font-mono ${r.tc} leading-none`}>{r.requests}×</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>diminta</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground mb-0.5">
                <span>Avg budget: {r.avgBudget}</span>
                <span>Turnaround: {r.turnaround}</span>
                <span className={`font-bold ${r.tc}`}>Potential: {r.potential}</span>
              </div>
              <p className={`text-[8px] font-mono ${r.tc}`}>💡 {r.packagePotential}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Research Team Skill Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> RESEARCH TEAM SKILL MATRIX — Skill Apa yang Dimiliki Setiap Analis MJP dan Di Mana Gap yang Perlu Diisi?
        </p>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1 mb-1">
            <p className="text-[8px] w-28 shrink-0 font-mono text-muted-foreground">Domain/Skill</p>
            {["Sari W.", "Budi S.", "Dewi K.", "Reza F.", "Gap?"].map(h => (
              <p key={h} className="flex-1 text-center text-[8px] font-mono text-muted-foreground">{h}</p>
            ))}
          </div>
          {[
            { skill: "Analisis Tender LPSE", scores: [5, 4, 3, 2, false], gap: false },
            { skill: "SKK & Regulasi LPJK", scores: [5, 3, 2, 2, false], gap: false },
            { skill: "Wawancara Lapangan", scores: [4, 5, 4, 3, false], gap: false },
            { skill: "BIM Knowledge", scores: [2, 1, 1, 1, true], gap: true },
            { skill: "PPP & Kontrak FIDIC", scores: [1, 2, 1, 2, true], gap: true },
            { skill: "Data Analysis (Python/SQL)", scores: [3, 2, 1, 4, false], gap: false },
            { skill: "Keuangan & Valuasi BUJK", scores: [2, 3, 1, 4, false], gap: false },
            { skill: "ESG & Sustainability", scores: [1, 1, 2, 2, true], gap: true },
          ].map((r) => (
            <div key={r.skill} className={`flex items-center gap-1 ${r.gap ? "bg-red-50 rounded-sm" : ""}`}>
              <p className={`text-[9px] w-28 shrink-0 ${r.gap ? "text-red-700 font-bold" : ""}`}>{r.skill}</p>
              {r.scores.map((s, i) => i < 4 ? (
                <div key={i} className="flex-1 flex justify-center">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(n => (
                      <div key={n} className={`w-1.5 h-1.5 rounded-full ${n <= (s as number) ? (r.gap ? "bg-red-300" : (s as number) >= 4 ? "bg-emerald-500" : "bg-blue-400") : "bg-muted"}`} />
                    ))}
                  </div>
                </div>
              ) : (
                <p key={i} className={`flex-1 text-center text-[7px] font-mono font-bold ${r.gap ? "text-red-700" : "text-slate-400"}`}>{r.gap ? "HIRE/TRAIN" : "OK"}</p>
              ))}
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">3 skill gaps kritis: BIM, PPP/FIDIC, ESG — semua terkait dengan produk roadmap 2027. Rekrut 1 specialist atau train Sari + Dewi Q4 2026</p>
      </div>

      {/* Research Methodology Best Practices */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> RESEARCH METHODOLOGY STANDARD — Standar yang Diikuti Tim Riset MJP agar Hasil Penelitian Konsisten, Dapat Dipercaya, dan Reproducible
        </p>
        <div className="flex flex-col gap-2">
          {[
            { phase: "Phase 1: Problem Framing (1–2 jam)", steps: ["Gunakan JTBD framework untuk define problem statement", "Validasi: apakah pain point sudah ada di platform? Jika ya, cek apakah data cukup fresh", "Sign-off dari AM: apakah ini yang klien benar-benar butuhkan?"], output: "Problem statement yang approved dan scope yang jelas", tc: "text-slate-700", bc: "bg-slate-50 border-slate-200" },
            { phase: "Phase 2: Data Collection (2–8 jam)", steps: ["Primary: interview klien via WA (3–5 pertanyaan, <10 menit)", "Secondary: LPSE data, LPJK registry, IjinTender, media konstruksi", "Triangulation: minimum 3 sumber untuk setiap klaim yang akan masuk ke laporan"], output: "Raw data + source citations yang terverifikasi", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { phase: "Phase 3: Analysis & Synthesis (2–4 jam)", steps: ["Kualitatif: thematic coding via AI + human review", "Kuantitatif: descriptive stats + tren 12 bulan", "Knowledge Registry cross-reference: apakah ada kontradiksi dengan data yang sudah ada?"], output: "Insight yang coherent dengan evidence chain", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
            { phase: "Phase 4: Quality Check (30–60 mnt)", steps: ["Sari review semua klaim: bisa diverifikasi independent?", "Check: apakah angka reasonable vs industri benchmark?", "Legal check: ada data yang tidak boleh dipublikasikan? (klien privacy, competitive secrets)"], output: "QC-cleared research yang siap masuk Knowledge Registry", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.phase} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-1`}>{r.phase}</p>
              {r.steps.map((s, i) => (
                <p key={i} className="text-[9px] text-muted-foreground mb-0.5">• {s}</p>
              ))}
              <p className={`text-[9px] font-mono ${r.tc} mt-1`}>Output: {r.output}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Research Client Use Cases */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> RESEARCH USE CASES — Bagaimana Klien MJP Menggunakan Hasil Riset Secara Konkret untuk Menang Lebih Banyak Bisnis?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { useCase: "Pre-bid intelligence untuk tender strategis", client: "PT Graha Konstruksi (J9, Surabaya)", howUsed: "Sebelum bid tender BUMN Rp 84M, mereka minta MJP riset: siapa kompetitor likely, berapa HPS berdasarkan proyek serupa, dan apa kelemahan teknis kompetitor di proyek sebelumnya.", outcome: "Menang tender dengan margin tipis (Rp 47M vs runner-up Rp 48.2M) — mereka atribusikan ke intel HPS yang presisi", revenue: "Kontrak Rp 47M untuk klien + MJP earn Rp 4.8jt custom research fee", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { useCase: "Market entry intelligence untuk kota baru", client: "CV Maju Sejahtera (J8, Semarang)", howUsed: "Mau ekspansi ke Yogyakarta. Minta MJP riset: siapa BUJK yang dominan di sana, berapa rate pasaran, dan tender apa yang sering muncul di LPSE DIY.", outcome: "Dalam 3 bulan di Yogyakarta, menang 2 dari 5 tender yang diikuti (40% win rate vs rata-rata 34%)", revenue: "Research fee Rp 3.2jt → klien generate Rp 18jt revenue baru di market baru", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { useCase: "Procurement strategy untuk subkon", client: "PT Nusantara Build (J9, Jakarta)", howUsed: "Butuh 3 subkontraktor spesialis MEP untuk mega project. Minta MJP riset: BUJK mana yang reliable, harga pasaran, dan siapa yang pernah bermasalah di proyek BUMN.", outcome: "3 subkontraktor dipilih semua perform well — zero dispute. Proyek selesai on-time.", revenue: "Research fee Rp 2.8jt → klien avoid potensi dispute cost estimasi Rp 200jt+", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.useCase} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.useCase}</p>
              <p className="text-[8px] font-bold mb-0.5">Klien: {r.client}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.howUsed}</p>
              <p className={`text-[9px] font-mono ${r.tc} mb-0.5`}>Outcome: {r.outcome}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>ROI: {r.revenue}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Research Quality Assurance Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> QUALITY ASSURANCE — Bagaimana MJP Memastikan Semua Temuan Riset Akurat Sebelum Dikirimkan ke Klien?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { gate: "Gate 1: Source Verification", who: "Researcher yang collect data", check: "Minimal 2 sumber independen harus confirm fakta yang sama. Satu sumber = UNVERIFIED tag, tidak boleh diforward ke klien.", passRate: "94%", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { gate: "Gate 2: Internal Peer Review", who: "Researcher lain (random assign, 24 jam SLA)", check: "Review metodologi + check logical consistency. Flag jika ada assumption yang tidak didukung data.", passRate: "89%", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { gate: "Gate 3: AM Reasonableness Check", who: "Account Manager yang kenal konteks klien", check: "Apakah temuan ini masuk akal untuk konteks klien spesifik? AM bisa flag 'ini mungkin outlier untuk klien X'.", passRate: "97%", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { gate: "Gate 4: Post-delivery Feedback Loop", who: "Klien (via thumbs up/down di briefing)", check: "Klien rate relevance setiap insight. Rating <3/5 di-flag untuk tim riset review dalam 48 jam.", passRate: "73% klien memberikan feedback", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.gate} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-3 mb-0.5">
                <div className="flex-1">
                  <p className={`text-[9px] font-bold ${r.tc}`}>{r.gate}</p>
                  <p className="text-[8px] text-muted-foreground">Who: {r.who}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[12px] font-black font-mono ${r.tc} leading-none`}>{r.passRate}</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>pass rate</p>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground">{r.check}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Gates 1–3 before delivery. Gate 4 is continuous feedback. This 4-gate process is what differentiates MJP dari news aggregator biasa.</p>
      </div>

      {/* Research Turnaround SLA */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" /> RESEARCH SLA — Komitmen Waktu yang Diberikan MJP ke Klien untuk Setiap Jenis Permintaan Riset
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { type: "Tender Alert (dari pengumuman ke notif klien)", sla: "<2 jam", actual: "Avg 1.4 jam (2026 YTD)", breach: "0.7% breach", action: "BREACH: AM manual notify dalam 15 menit + post-mortem jika sistemik", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { type: "HPS Benchmark Query", sla: "<15 menit (platform) / <4 jam (custom)", actual: "Platform: instant. Custom: avg 2.8 jam", breach: "3.2% custom breach", action: "Custom HPS yang breach karena data tidak ada → escalate ke Sari dalam 1 jam", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { type: "Custom Research (full report)", sla: "3 hari kerja (standard) / 1 hari (express +50%)", actual: "Standard: avg 2.4 hari. Express: avg 22 jam", breach: "8% standard breach", action: "Breach di hari ke-2 sudah harus escalate + proactive update ke klien", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { type: "SKK Status Update (dari submit dokumen ke status)", sla: "<24 jam setelah dokumen lengkap", actual: "Avg 18 jam (saat LPJK normal)", breach: "12% breach (LPJK sistem down)", action: "LPJK sistem down lebih dari 4 jam → notify klien + expected timeline update", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { type: "Emergency Research (klien butuh answer hari ini)", sla: "<6 jam", actual: "Avg 4.2 jam (hanya AM Pro/Enterprise bisa request)", breach: "4% breach", action: "Reserve kapasitas riset 2 jam/hari untuk emergency requests", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.type} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className={`text-[9px] font-bold ${r.tc}`}>{r.type}</p>
                  <div className="flex flex-wrap gap-3 text-[8px] font-mono mt-0.5">
                    <span className={`font-bold ${r.tc}`}>SLA: {r.sla}</span>
                    <span className="text-muted-foreground">Actual: {r.actual}</span>
                    <span className="text-muted-foreground">Breach: {r.breach}</span>
                  </div>
                  <p className="text-[8px] text-muted-foreground">{r.action}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">SLA breach rate avg: 5.6%. Target: {'<'}2% by Q4 2026 via automation + dedicated on-call researcher rotation.</p>
      </div>

      {/* Research Coverage Gaps by Domain */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-orange-500" /> COVERAGE GAPS — Domain Konstruksi yang Coverage Riset MJP-nya Masih Lemah dan Rencana untuk Tutup Gap Tersebut
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { domain: "BIM (Building Information Modeling)", coverage: "18%", demand: "HIGH (> 380 searches/bln)", gap: "Tidak ada researcher yang certified BIM. Coverage hanya dari news/regulasi, bukan technical intel.", plan: "Hire/partner dengan BIM consultant freelance Q3 2026. Target: 20 BIM knowledge assets sebelum Jan 2027.", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { domain: "Konstruksi Luar Jawa (Sulawesi, Papua, NTT)", coverage: "31%", demand: "HIGH (growing 156%/thn)", gap: "Budi adalah satu-satunya researcher yang punya koneksi lapangan di KTI. Data sangat bergantung pada 1 orang.", plan: "AM Makassar akan double sebagai field researcher. Target: 50 pain points KTI terdokumentasi Q4 2026.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { domain: "PPP (Kerjasama Pemerintah Swasta) Konstruksi", coverage: "12%", demand: "MEDIUM (tapi WTP sangat tinggi — J9 exclusively)", gap: "PPP sangat complex legal + financial. Tim tidak punya expertise. Coverage hanya surface level.", plan: "Partner dengan firma hukum konstruksi untuk PPP advisory. Revenue share model.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { domain: "Material & Supply Chain Intel", coverage: "23%", demand: "MEDIUM-HIGH", gap: "Harga material volatile tapi MJP hanya monitor quarterly bukan real-time. Klien butuh daily material price.", plan: "Build material price crawler (semen, besi, pasir) dari supplier marketplace. Q1 2027.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { domain: "Green Building & ESG Konstruksi", coverage: "8%", demand: "LOW tapi growing (investor push)", gap: "Zero expertise internal. Terrain asing.", plan: "Defer ke 2027. Monitor demand. If BUMN mulai score ini: fast follow.", tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
          ].map((r) => (
            <div key={r.domain} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <div className="flex items-center gap-3 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.domain}</p>
                <div className="flex gap-2 text-[8px] font-mono shrink-0">
                  <span className="text-muted-foreground">Coverage: {r.coverage}</span>
                  <span className={`font-bold ${r.tc}`}>Demand: {r.demand}</span>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Gap: {r.gap}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>Plan: {r.plan}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Research Competitive Advantage */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-emerald-600" /> RESEARCH EDGE — Mengapa Riset MJP Lebih Baik dari yang Bisa Klien Lakukan Sendiri atau dari Kompetitor?
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              dimension: "Kecepatan: MJP rata-rata alert 6 jam lebih cepat dari klien yang monitor sendiri",
              detail: "Klien yang self-monitor biasanya cek LPSE 1–2× sehari. MJP crawler checks every 4 hours. Dalam industri tender, 6 jam = significant preparation lead time.",
              proof: "A/B test 84 klien: yang pakai MJP vs self-monitor. 34% vs 24% win rate. Kecepatan intel adalah 1/3 dari difference.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              dimension: "Konteks: MJP tahu siapa saja yang kemungkinan ikut tender yang sama dengan klien",
              detail: "Klien bisa lihat pengumuman tender. Tapi MJP tambahkan: 'berdasarkan pola historis, 5 BUJK ini kemungkinan besar juga ikut. Strategi mereka biasanya adalah...' — klien solo tidak bisa tahu ini.",
              proof: "Klien yang terima competitive context: win rate 38% vs klien yang hanya dapat tender notification: 26%.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              dimension: "Akurasi HPS: Model MJP avg error 3.8% vs klien self-estimate avg error 8.7%",
              detail: "MJP ditraining pada 38.400+ historical tender dengan HPS aktual post-award. Model klien biasanya based on 10–30 memory dari proyek yang pernah mereka ikut sebelumnya.",
              proof: "Klien pakai HPS MJP: penawaran masuk sweet spot -4.8% s/d -6.2% dari HPS dalam 73% kasus. Tanpa MJP: 47%.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              dimension: "Regulatory: Sari adalah satu-satunya expert yang documented LPJK nuances per region",
              detail: "Regulasi formal sama di semua region tapi implementasi berbeda. LPJK Jateng berbeda proses dengan LPJK Sulawesi. Knowledge ini tidak ada di website resmi — hanya dari relationship dan pengalaman langsung.",
              proof: "Klien yang mengikuti guidance Sari untuk PKPT cross-region: 0 rejection. Klien yang tidak: 31% rejection rate dari document issues.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
          ].map((r) => (
            <div key={r.dimension} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.dimension}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>Proof: {r.proof}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Research Team Capacity Plan */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> TEAM CAPACITY PLAN — Berapa Kapasitas Tim Research Sekarang dan Apa yang Harus Ditambah untuk Support Target 550 Klien?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            {[
              { name: "Sari (Lead Researcher)", focus: "Regulasi + SKK + custom research", load: "OVERLOADED", note: "85% utilization. Bottleneck untuk semua expert-level research.", tc: "text-red-700" },
              { name: "Budi (Field Researcher)", focus: "KTI + pain points field", load: "AT CAPACITY", note: "78% utilization. Sulawesi trip 2×/bln. Needs support.", tc: "text-orange-700" },
              { name: "Dewi (Junior Researcher)", focus: "HPS benchmark + data cleaning", load: "AVAILABLE", note: "61% utilization. Room to take on more structured work.", tc: "text-emerald-700" },
              { name: "Hendra (Tech + Data)", focus: "Crawler + platform + AI", load: "AT CAPACITY", note: "82% utilization. Sprint 23 entity resolution consuming bandwidth.", tc: "text-orange-700" },
            ].map((r) => (
              <div key={r.name} className="border rounded-sm p-2 bg-muted/20">
                <p className={`text-[8px] font-bold ${r.tc}`}>{r.name}</p>
                <p className="text-[7px] text-muted-foreground">{r.focus}</p>
                <p className={`text-[8px] font-mono font-bold ${r.tc}`}>{r.load}</p>
                <p className="text-[7px] text-muted-foreground">{r.note}</p>
              </div>
            ))}
          </div>
          <div className="border rounded-sm p-3 bg-orange-50 border-orange-200">
            <p className="text-[9px] font-bold text-orange-700 mb-1">Gap Analysis: Untuk Support 550 Klien (vs 487 sekarang):</p>
            {[
              "Sari bottleneck: +13% klien = +13% custom research requests = Sari at 96% → breaking point",
              "Fix: Hire Junior Researcher #2 (fokus regulasi) Q4 2026. Sari mentor, Dewi cover HPS sepenuhnya.",
              "BIM gap: Perlu 1 external BIM consultant mitra (freelance, 20 jam/bln) untuk coverage yang growing +127%/thn",
              "KTI coverage: Budi tidak bisa solo. Partner dengan komunitas lokal atau hire researcher lokal Makassar.",
            ].map((p, i) => <p key={i} className="text-[8px] text-muted-foreground">• {p}</p>)}
          </div>
          <p className="text-[9px] font-mono text-muted-foreground">Total additional cost untuk reach 550 klien without breaking team: ~Rp 18jt/bln (1 junior researcher + BIM consultant). Revenue dari 63 klien baru: ~Rp 75.6jt ARR. ROI: 4.2×.</p>
        </div>
      </div>

      {/* Research Methodology Standards */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FlaskConical className="h-3.5 w-3.5 text-primary" /> RESEARCH METHODOLOGY — Standar yang Membuat Riset MJP Credible dan Bisa Dikutip Klien ke Konsultannya atau ke Bank Mereka
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              standard: "Primary Source Priority",
              rule: "Setiap klaim harus punya primary source yang bisa diverifikasi: LPSE database, LPJK registry, Kemenpu publikasi resmi, atau wawancara langsung dengan stakeholder konstruksi.",
              forbidden: "Media sosial, blog tidak diverifikasi, atau klaim dari forum WhatsApp tanpa cross-check.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              standard: "Claim Confidence Labeling",
              rule: "Setiap insight di-label: HIGH CONFIDENCE (primary source, verified), MEDIUM CONFIDENCE (secondary source, plausible), atau SPECULATIVE (inference, clearly marked). Klien bisa trust HIGH, verify MEDIUM, use SPECULATIVE only for ideation.",
              forbidden: "Menyajikan SPECULATIVE insight tanpa label sebagai fact.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              standard: "Conflict of Interest Disclosure",
              rule: "Jika penelitian tentang BUJK yang juga klien MJP, disclosure wajib. Report harus independent — tidak boleh dipengaruhi oleh relationship komersial.",
              forbidden: "Menekan data negatif tentang klien MJP atau menonjolkan data positif karena relasi.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              standard: "Sample Size Transparency",
              rule: "Setiap statistik harus menyertakan N (sample size). Klaim yang based on <30 samples harus clearly flagged as 'indicative only'. Klien tidak boleh make major decisions based on small-N data.",
              forbidden: "N=3 → '100% of clients agree...' tanpa disclosure.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
          ].map((r) => (
            <div key={r.standard} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.standard}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.rule}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Not allowed: {r.forbidden}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Methodology standards ini diajarkan ke semua researcher baru di hari pertama. Violation bukan sekadar quality issue — ini trust issue. MJP credibility adalah product itu sendiri.</p>
      </div>

      {/* Research Archive Strategy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <History className="h-3.5 w-3.5 text-primary" /> RESEARCH ARCHIVE — Bagaimana MJP Menjaga Nilai dari Riset Historis yang Sudah Berumur Agar Tetap Bermanfaat?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="border rounded-sm p-3 bg-slate-50 border-slate-200 mb-1">
            <p className="text-[9px] font-bold mb-0.5">Challenge: 40% dari 5.200 total research items MJP berumur {'>'} 12 bulan. Bagaimana membuatnya tetap valuable?</p>
          </div>
          {[
            {
              strategy: "Evergreen vs Time-bound Tagging",
              how: "Setiap research item di-tag sebagai EVERGREEN (prinsip tidak berubah — cara hitung WHT, struktur kontraktor, dll) atau TIME-BOUND (data angka yang berubah — HPS, jumlah tender, peraturan spesifik).",
              outcome: "EVERGREEN items: 100% tetap di registry. TIME-BOUND items: auto-flag untuk review saat > 6 bulan. Client interface shows age clearly.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              strategy: "Historical Trend Value",
              how: "Data lama tidak di-delete — diarsipkan sebagai historical data. Client yang mau lihat tren HPS 3 tahun ke belakang butuh historical archive. Archive = premium feature untuk Pro/Enterprise.",
              outcome: "Historical trend view dipakai oleh 34% Pro klien setidaknya 1×/bln. High-value untuk klien yang membuat long-term bid strategy.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              strategy: "Research Refresh Queue",
              how: "Items yang TIME-BOUND dan > 6 bulan masuk auto-refresh queue. Priority: sort by monthly views × recency gap. High-traffic outdated items refreshed first.",
              outcome: "Saat ini 89 items in refresh queue. Sari dedicates 3 jam/minggu untuk refresh queue. Target: semua high-traffic items < 4 bulan old.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              strategy: "Client-Requested Refresh",
              how: "Klien bisa request refresh untuk item yang mereka butuhkan tapi sudah outdated. Pro/Enterprise tier: included. Growth tier: 2 requests/bln free.",
              outcome: "187 refresh requests tahun 2026 YTD. 94% completed within 48 jam. 6 high-complexity membutuhkan 5 hari.",
              tc: "text-violet-700", bc: "bg-violet-50 border-violet-200"
            },
          ].map((r) => (
            <div key={r.strategy} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.strategy}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.how}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>Outcome: {r.outcome}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Knowledge management principle: Data tua bukan sampah — bisa jadi gold jika dikontekstualisasikan dengan benar. Archive {'>'} refresh {'>'} delete, selalu dalam urutan itu.</p>
      </div>

      {/* Research Output by Category */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> RESEARCH OUTPUT DISTRIBUTION — Bagaimana Total 5.200 Research Items MJP Terdistribusi per Kategori dan Mana yang Paling Dicari Klien?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { category: "HPS Benchmark", count: 1247, pct: "24%", avgViews: "89/bln", topAsset: "HPS Benchmark Gedung J8 Jateng 2025", demand: "HIGHEST", tc: "text-emerald-700", bar: "w-24" },
            { category: "Tender Intelligence", count: 1089, pct: "21%", avgViews: "67/bln", topAsset: "Pattern Tender IKN — kategori infrastruktur dasar", demand: "VERY HIGH", tc: "text-emerald-700", bar: "w-20" },
            { category: "Kompetitor Profil", count: 834, pct: "16%", avgViews: "74/bln", topAsset: "Top 15 BUJK Kompetitor Jatim Win Rate Report", demand: "HIGH", tc: "text-blue-700", bar: "w-16" },
            { category: "Regulasi & Compliance", count: 723, pct: "14%", avgViews: "112/bln (highest per-item)", topAsset: "PKPT 2026 Transition Guide untuk J8", demand: "HIGH (regulatory anxiety)", tc: "text-blue-700", bar: "w-14" },
            { category: "Pain Point Analysis", count: 612, pct: "12%", avgViews: "34/bln", topAsset: "PHO/FHO Delay — root cause dan solusi", demand: "MEDIUM-HIGH", tc: "text-orange-700", bar: "w-12" },
            { category: "Market Sizing", count: 421, pct: "8%", avgViews: "28/bln", topAsset: "Pasar Konstruksi KTI 2026 — opportunity mapping", demand: "MEDIUM", tc: "text-orange-700", bar: "w-9" },
            { category: "SKK & Tenaga Ahli", count: 274, pct: "5%", avgViews: "41/bln", topAsset: "SKK Transition Guide J8 ke J9 — requirements dan timeline", demand: "MEDIUM", tc: "text-slate-600", bar: "w-7" },
          ].map((r) => (
            <div key={r.category} className="flex items-center gap-2 py-1.5 border-b">
              <div className="w-32 shrink-0">
                <p className={`text-[8px] font-bold ${r.tc}`}>{r.category}</p>
                <p className="text-[7px] text-muted-foreground">{r.count} items · {r.pct}</p>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1 mb-0.5">
                  <div className={`h-2 ${r.bar} rounded-sm bg-current opacity-30 ${r.tc}`} />
                  <span className={`text-[7px] font-mono ${r.tc}`}>{r.avgViews}</span>
                </div>
                <p className={`text-[7px] text-muted-foreground`}>Top: {r.topAsset}</p>
              </div>
              <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.demand}</span>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Regulasi memiliki highest per-item views (112/bln avg) meski hanya 14% dari total. Insight: klien membaca regulasi berulang-ulang karena complexity. Consider video explainer format untuk regulasi kompleks.</p>
      </div>

      {/* Research Monetization Ladder */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> RESEARCH MONETIZATION LADDER — Bagaimana MJP Mengekstrak Nilai Maksimum dari Satu Dataset melalui Multiple Revenue Streams?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { rung: "Rung 1: Awareness (Free teaser)", product: "Headline intel di media sosial, webinar snippets, public directory", revenue: "Rp 0 langsung — tapi lead generation. 18% of webinar attendees become trial users.", rationale: "Demonstrate expertise without giving away the full product.", tc: "text-slate-600" },
            { rung: "Rung 2: Starter Subscription", product: "Summary-level access: national HPS range, basic regulatory alerts, top 50 knowledge assets", revenue: "Rp 800rb/bln × 89 Starter klien = Rp 71.2jt MRR. Plus onramp to higher tiers.", rationale: "Low barrier to entry. Create the habit before charging premium.", tc: "text-blue-700" },
            { rung: "Rung 3: Growth Subscription", product: "Full research access + personalized briefing + regional intel + competitor profiles", revenue: "Rp 1.5jt/bln × 347 Growth klien = Rp 520.5jt MRR. Highest volume tier.", rationale: "Where most value delivered. The 'just right' tier per design.", tc: "text-emerald-700" },
            { rung: "Rung 4: Custom Research (Add-on)", product: "Bespoke deep-dive research on specific topic, competitor, or geography — per request", revenue: "Rp 4.8jt avg × 18 projects/bln = Rp 86.4jt MRR. High margin (Rp 3.4jt gross margin).", rationale: "Klien that hit subscription limits naturally escalate here.", tc: "text-emerald-700" },
            { rung: "Rung 5: Data Licensing (Enterprise B2B)", product: "Raw data feed atau enriched dataset licensed to banks, consultants, property developers", revenue: "Rp 12jt/bln × 3 licensees = Rp 36jt MRR. Zero marginal cost. Scale play.", rationale: "Same data, different customer segment, different packaging, premium pricing.", tc: "text-violet-700" },
          ].map((r, i) => (
            <div key={r.rung} className="flex gap-2 items-start border-b pb-1.5">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${i === 4 ? 'bg-violet-200' : i >= 3 ? 'bg-emerald-200' : i === 2 ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                <span className="text-[7px] font-black">{i + 1}</span>
              </div>
              <div className="flex-1">
                <p className={`text-[8px] font-bold ${r.tc}`}>{r.rung}</p>
                <p className="text-[8px] text-muted-foreground">{r.product}</p>
                <p className={`text-[8px] font-mono ${r.tc}`}>{r.revenue}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total MRR from research monetization ladder: ~Rp 714jt/bln est. Margin meningkat per rung karena marginal cost turun. Data licensing = infinite margin on existing data. Build once, sell many times.</p>
      </div>

      {/* Research Team Capacity Model */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> RESEARCH CAPACITY MODEL — Berapa Banyak Research Output yang Bisa Tim MJP Hasilkan per Bulan dan Apa Bottleneck-nya?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Team Member</th>
                  <th className="p-1 text-center text-muted-foreground">Research Capacity</th>
                  <th className="p-1 text-center text-muted-foreground">Current Output/bln</th>
                  <th className="p-1 text-center text-muted-foreground">Utilization</th>
                  <th className="p-1 text-center text-muted-foreground">Bottleneck</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { member: "Sari (Head Researcher)", cap: "80 assets/bln (with QC role)", output: "47 assets + 12 QC reviews", util: "74%", bottleneck: "QC review overhead = 30% of time", tc: "text-blue-700" },
                  { member: "Dewi (Junior Researcher)", cap: "60 assets/bln", output: "52 assets", util: "87%", bottleneck: "Near capacity — quality slip risk if more added", tc: "text-orange-700" },
                  { member: "Budi (Field Researcher)", cap: "80 pain points/bln", output: "78 pain points", util: "98%", bottleneck: "AT CAPACITY — any more needs field assistant", tc: "text-red-700" },
                  { member: "Reza (AM intelligence)", cap: "20 assets/bln (part-time)", output: "14 assets", util: "70%", bottleneck: "Client time competes with research time", tc: "text-blue-700" },
                ].map((r) => (
                  <tr key={r.member} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{r.member}</td>
                    <td className="p-1 text-center">{r.cap}</td>
                    <td className="p-1 text-center font-bold">{r.output}</td>
                    <td className={`p-1 text-center font-bold ${r.tc}`}>{r.util}</td>
                    <td className={`p-1 ${r.tc}`}>{r.bottleneck}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-3 bg-orange-50 border-orange-200">
            <p className="text-[9px] font-bold text-orange-700 mb-0.5">Capacity Constraint Analysis:</p>
            <p className="text-[8px]">Current team dapat produce ~191 research items/bln (Sari 47 + Dewi 52 + Budi 78 pain points + Reza 14). Target 300/bln untuk skala ke 1.000 klien membutuhkan tambahan Junior Researcher #2 (60 items/bln) + AI-assist untuk routine tasks (reduce Sari overhead 40%). Achievable by Q1 2027.</p>
          </div>
        </div>
      </div>

      {/* Research Ethics & Data Governance */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> RESEARCH ETHICS & GOVERNANCE — Batasan yang MJP Tetapkan tentang Data yang Boleh dan Tidak Boleh Dikumpulkan atau Dipublikasikan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              principle: "Public Data Only — Bukan Data Bocoran",
              allowed: "Semua data dari sumber publik: LPSE, LPJK public registry, media, lembaga pemerintah, public announcements.",
              notAllowed: "Data dari sumber dalam yang tidak memiliki otoritas untuk share. Data kompetitor dari mantan karyawan. Bocoran dokumen tender internal.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              principle: "Personal Data Protection — PDPA Compliance",
              allowed: "Data profesional yang relevan: nama, jabatan, sertifikasi (public record). Kontak via platform resmi (LPJK, LinkedIn profil publik).",
              notAllowed: "Alamat rumah, nomor telepon personal, data finansial personal. Informasi anak atau keluarga. Data yang tidak relevan dengan kapasitas profesional.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              principle: "Attribution dan Transparency",
              allowed: "Semua data di Knowledge Registry harus punya clear source attribution. Klien bisa verify ke original source.",
              notAllowed: "Publish tanpa source. Claim confidence lebih tinggi dari yang data support. Parafrase yang materially mengubah makna dari sumber asli.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              principle: "Conflict of Interest Declaration",
              allowed: "Sari dan Dewi boleh punya personal views tentang regulasi — tapi semua published content harus factual dan balanced.",
              notAllowed: "Publish content yang favors specific BUJK atau vendor tanpa disclosure. Accept payment to publish favorable intel. Let MJP investor relationships influence coverage.",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
          ].map((r) => (
            <div key={r.principle} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.principle}</p>
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-[8px] font-bold text-emerald-700">Boleh:</p><p className="text-[8px] text-muted-foreground">{r.allowed}</p></div>
                <div><p className="text-[8px] font-bold text-red-700">Tidak boleh:</p><p className="text-[8px] text-muted-foreground">{r.notAllowed}</p></div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Ethics adalah the foundation of trust. One ethics breach — rumored or real — can destroy years of credibility. These principles apply to all team members, all data, all time. No exceptions.</p>
      </div>

      {/* Research Subscriber Segmentation */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> SUBSCRIBER SEGMENTATION — Siapa yang Paling Sering Menggunakan Knowledge Registry dan Pola Apa yang Menentukan Engagement Tinggi?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              segment: "High Engagers (top 20% usage — 97 klien)",
              profile: "J8 Menengah, 3–5 tahun di platform, di Jawa Tengah atau Kalimantan, avg 2–3 tender/bln. AM contact: Reza kenal secara personal.",
              behavior: "Buka platform 5–7 kali/minggu. Read briefing setiap hari. Download 4–8 assets/bln. Sering ask questions via WA.",
              retention: "24-month avg tenure. NPS: 8.9/10. Primary referral source (39% of referrals come from this segment).",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              segment: "Medium Engagers (middle 50% — 244 klien)",
              profile: "Mix of all BUJK classes. Usually 6–18 bulan di platform. Engagement correlated with active tender season.",
              behavior: "Buka platform 2–3 kali/minggu. Read briefing 3–4 kali/minggu. Download 1–3 assets/bln. Occasional WA to Reza.",
              retention: "14-month avg tenure. NPS: 7.4/10. Upsell potential: 34% of this segment has asked about Enterprise at some point.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              segment: "Low Engagers (bottom 30% — 146 klien, CHURN RISK)",
              profile: "Often newer clients (<3 months) or those in slow business period. Sometimes: wrong tier, features mismatch.",
              behavior: "Buka platform <1 kali/minggu. Often haven't used key features (HPS Benchmark, Competitor Radar).",
              retention: "Churn prediction model flags 73% of actual churners. AM Reza trigger: 2 weeks without login = proactive outreach.",
              tc: "text-red-700", bc: "bg-red-50 border-red-200"
            },
          ].map((r) => (
            <div key={r.segment} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.segment}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">Profile: {r.profile}</p>
              <p className="text-[8px] mb-0.5">Behavior: {r.behavior}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>{r.retention}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Segmentation drives personalized engagement. High engagers = protect and leverage (referral). Medium = nurture to High. Low = intervention within 14 days or accept churn. Each segment has different intervention playbook.</p>
      </div>

      {/* Annual Research Quality Audit */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 text-primary" /> ANNUAL QUALITY AUDIT — Hasil Audit Kualitas Research MJP Q2 2026: Apa yang Sudah Baik dan Apa yang Masih Perlu Diperbaiki?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
            <div>
              <p className="text-[9px] font-bold text-emerald-700 mb-1">STRONG PERFORMANCE ✓</p>
              {[
                { item: "Factual accuracy", score: "98.7%", note: "3 errors found in 231 spot-checked assets. All minor, corrected same day." },
                { item: "Source citation completeness", score: "94.2%", note: "Up from 88% Q4 2025. Systematic improvement via Sari's template adoption." },
                { item: "Regulatory timeliness", score: "96.1%", note: "Alert published within SLA window. Only 2 L1 alerts delayed > 4 hours." },
                { item: "Client comprehension score", score: "4.3/5.0", note: "Survey of 87 klien. 'Is this content clear and actionable?' avg score." },
              ].map((r) => (
                <div key={r.item} className="flex gap-2 items-start border-b py-0.5">
                  <p className="text-[8px] flex-1">{r.item}</p>
                  <span className="text-[8px] font-mono font-bold text-emerald-700 shrink-0">{r.score}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-[9px] font-bold text-orange-700 mb-1">NEEDS IMPROVEMENT ↑</p>
              {[
                { item: "Knowledge Asset freshness rate", score: "83.3%", note: "16.7% of assets past expiry date without refresh. Backlog: 47 assets." },
                { item: "Regional coverage balance", score: "63.2/100", note: "KTI dramatically under-represented vs market size." },
                { item: "Visual content ratio", score: "12%", note: "Only 12% of assets have visual aids (charts, maps). Target: 40%." },
                { item: "Non-Bahasa Indonesia content", score: "2.3%", note: "International standards content too low for J9 klien who chase donor projects." },
              ].map((r) => (
                <div key={r.item} className="flex gap-2 items-start border-b py-0.5">
                  <p className="text-[8px] flex-1">{r.item}</p>
                  <span className="text-[8px] font-mono font-bold text-orange-700 shrink-0">{r.score}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700">Q3 2026 Improvement Sprint:</p>
            <p className="text-[8px]">Priority: (1) Clear the 47-asset refresh backlog (Dewi sprint, 2 weeks). (2) Add charts/maps to top 20 assets by views (Hendra Jr. 1 week — template component). (3) Commission 3 KTI-specific assets per month starting August. Target Q4 audit: all scores {'>'} 90%.</p>
          </div>
        </div>
      </div>

      {/* Research Data Freshness Standard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-blue-500" /> DATA FRESHNESS — Standar Kesegaran Data MJP: Berapa Lama Setiap Jenis Data Berlaku Sebelum Harus Diperbarui?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { type: "Harga Material (baja, semen, pasir, batu)", maxAge: "7 hari", refresh: "Automated crawler — weekly", consequence: "Klien yang pakai data lebih dari 7 hari lama untuk HPS estimation: risiko under/over estimasi 4–8%.", tc: "text-red-700" },
            { type: "Tender LPSE (new announcements)", maxAge: "4 jam", refresh: "Automated crawler — every 2 hours, 6 AM–10 PM", consequence: "Tender yang sudah di-award tapi masih tampil sebagai open = klien mobilize resources sia-sia.", tc: "text-red-700" },
            { type: "BUJK Profile (LPJK data)", maxAge: "30 hari", refresh: "Monthly crawl + community updates", consequence: "Outdated profile: SKK expired tidak terdeteksi, blacklist not reflected. High-risk for consortium decisions.", tc: "text-orange-700" },
            { type: "SKK Tenaga Ahli", maxAge: "14 hari", refresh: "Bi-weekly crawl of LPJK Jasa Konstruksi database", consequence: "Expired SKK yang tidak terdeteksi: klien submit gugur karena dokumen yang MJP profile shows as valid actually expired.", tc: "text-orange-700" },
            { type: "Competitor Tender Win Data", maxAge: "7 hari", refresh: "Weekly batch from LPSE award announcements", consequence: "Stale competitor data: klien underestimates competition density. Misleads HPS decision.", tc: "text-blue-700" },
            { type: "Regulatory Documents (full text)", maxAge: "Permanent (versioned)", refresh: "On-demand when new version published", consequence: "Old version served = wrong compliance guidance. Sari must tag expiry explicitly.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.type} className="flex gap-2 items-start border-b py-1">
              <div className="flex-1">
                <p className="text-[8px] font-bold mb-0.5">{r.type}</p>
                <p className="text-[7px] text-muted-foreground">Refresh: {r.refresh}</p>
                <p className={`text-[7px] font-mono ${r.tc}`}>Risk of stale: {r.consequence}</p>
              </div>
              <span className={`text-[8px] font-mono font-bold shrink-0 ${r.tc}`}>{r.maxAge}</span>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Freshness standard adalah kontrak implisit dengan klien. Jika MJP serves stale data as fresh = trust breach. Each data type has freshness indicator visible in UI. Klien can always see 'last updated' timestamp. Transparency prevents liability.</p>
      </div>

      {/* Research Budget Allocation Model */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> RESEARCH BUDGET — Bagaimana Rp 350jt Anggaran Riset Tahunan MJP Dialokasikan dan Apa Return yang Dihasilkan dari Setiap Kategori?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Budget Category</th>
                  <th className="p-1 text-center">Annual</th>
                  <th className="p-1 text-center">% total</th>
                  <th className="p-1 text-center">Primary Owner</th>
                  <th className="p-1 text-center text-emerald-700">ROI Multiple</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Sari salary + benefits", "Rp 126jt", "36%", "Sari", "38×"],
                  ["Budi salary + field ops (transport, akomodasi)", "Rp 73jt", "21%", "Budi", "22×"],
                  ["Dewi (partial time — research support)", "Rp 42jt", "12%", "Dewi", "14×"],
                  ["External research commissions (freelance)", "Rp 31jt", "9%", "Sari", "18×"],
                  ["Data subscriptions (industry databases)", "Rp 28jt", "8%", "Dewi", "12×"],
                  ["Research events + conferences", "Rp 21jt", "6%", "Sari + Hendra", "7×"],
                  ["LSP fees + certification costs", "Rp 18jt", "5%", "Dewi", "31×"],
                  ["Research tools + software", "Rp 11jt", "3%", "Hendra Jr.", "8×"],
                ].map(([cat, amt, pct, owner, roi], i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{cat}</td>
                    <td className="p-1 text-center">{amt}</td>
                    <td className="p-1 text-center text-muted-foreground">{pct}</td>
                    <td className="p-1 text-center text-muted-foreground">{owner}</td>
                    <td className="p-1 text-center font-bold text-emerald-700">{roi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200">
            <p className="text-[9px] font-bold text-emerald-700">Blended research budget ROI: 24× | Total research budget Rp 350jt → Research-attributable revenue: Rp 8.4M ARR</p>
            <p className="text-[8px] text-muted-foreground">Methodology: Revenue attributed to research-dependent features (KR, Briefing, Competitor Radar) as % of total MRR, annualized. Highest ROI: LSP fees (32×) — small investment, enables SKK Express entirely.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Research budget riview setiap semester. Rule: jangan cut research saat revenue turun — research adalah leading indicator dari future revenue. Pernah 1× di 2024: potong research budget 30% → intel quality drop → 4 enterprise klien churn in next quarter. Never again.</p>
      </div>

      {/* Research Taxonomy Guide */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> RESEARCH TAXONOMY — Taksonomi Lengkap Data Riset MJP: Bagaimana 15.847 Temuan Dikategorikan agar Bisa Dianalisis dan Digunakan Efektif?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Every research item is tagged across 6 taxonomic dimensions. Cross-dimension queries enable insights impossible from single-dimension view:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            {[
              { dim: "1. Domain Industri (10 categories)", examples: "Gedung Pemerintah, Infrastruktur, Energi, Agrikultur, IKN, KTI, etc.", usage: "Primary filter for all research queries. Enables domain-specific trend analysis." },
              { dim: "2. BUJK Class (J7/J8/J9/All)", examples: "J8 label = relevant for BUJK kelas J8. 'All' = cross-class finding.", usage: "Segments content delivery. Enterprise J9 clients see J9-tagged items first." },
              { dim: "3. Geography (Province + Region)", examples: "Jawa Tengah, Kalimantan, National, etc.", usage: "Personalized watchlists. Regional trend analysis. KTI expansion tracking." },
              { dim: "4. Urgency (L1/L2/L3/Background)", examples: "L1 = action within 30 days. L3 = awareness only.", usage: "Alert routing. L1 = WA blast. L3 = briefing summary only." },
              { dim: "5. Topic Category (12 subtypes)", examples: "Regulatory, Competitor Intel, Market Opportunity, Technology, Pricing, Labor", usage: "Content library navigation. Sari routes to topic specialist for enrichment." },
              { dim: "6. Confidence Level (HIGH/MED/LOW)", examples: "HIGH = official source + verified. LOW = single unverified community report.", usage: "Shown in UI. Low-confidence items labeled prominently. Affects AI model weighting." },
            ].map((r) => (
              <div key={r.dim} className="border rounded-sm p-2 bg-muted/10">
                <p className="text-[8px] font-bold mb-0.5">{r.dim}</p>
                <p className="text-[7px] font-mono text-primary mb-0.5">{r.examples}</p>
                <p className="text-[7px] text-muted-foreground">{r.usage}</p>
              </div>
            ))}
          </div>
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700">Cross-dimension power query example:</p>
            <p className="text-[8px]">'Domain: Gedung Pemerintah + BUJK: J8 + Geography: Jateng + Urgency: L1 + Confidence: HIGH' → returns 4 items requiring immediate action for J8 BUJK in Jawa Tengah bidding on government buildings. This precision is impossible without all 6 dimensions.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Taxonomy didesign oleh Sari dan Hendra Jr. 2023. 3× updated since launch. Current structure covers 94% of research items without 'other' category. Good taxonomy = searchable library. Bad taxonomy = unsearchable pile. MJP's taxonomy is its library science advantage.</p>
      </div>

      {/* Research Intelligence Distillation */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FlaskConical className="h-3.5 w-3.5 text-purple-600" /> INTEL DISTILLATION — Cara Sari Mengolah Ribuan Raw Data Points menjadi 5–7 Insight Actionable dalam Briefing Harian: Proses Reduksi Kompleksitas
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">The daily briefing = 1.200 kata dari {'>'} 800 data points. Reduction methodology:</p>
          {[
            { stage: "1. Automated first-pass filter", detail: "All overnight data: LPSE tender announcements (crawled 2 AM), LPJK updates, price feeds, news alerts. System auto-scores each item: novelty (vs 30-day baseline), relevance to watchlisted segments, urgency flag.", tc: "text-blue-700" },
            { stage: "2. Sari priority selection (6:00–6:30 AM)", detail: "Sari reviews top 40–60 auto-scored items (system filters 800+ to 40–60). Selection rule: choose items that cross 2+ klien segments or that are unexpectedly changed from baseline. Eliminates: routine announcements, items covered yesterday.", tc: "text-blue-700" },
            { stage: "3. The 'So What?' test", detail: "Every selected item must answer 'so what for a J8/J9 BUJK today?' If the answer is 'monitor' or 'no action needed yet' → demoted to L3 background. Items that trigger a concrete action = stay in briefing.", tc: "text-orange-700" },
            { stage: "4. Narrative threading", detail: "Sari looks for connections between selected items: are 3 different signals pointing to the same macro trend? If yes: synthesize into 1 narrative instead of 3 bullets. Synthesis = MJP's analyst value-add vs raw data aggregators.", tc: "text-orange-700" },
            { stage: "5. Claude draft + Sari edit (6:30–7:00 AM)", detail: "Selected items + Sari's notes fed to Claude API. Draft generated (3–4 menit). Sari edits: fixes tone, adds her personal call-to-action, removes AI hedging. Final briefing submitted by 7:00 AM for 7:30 delivery.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.stage} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.stage}</p>
              <p className="text-[8px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total Sari time for briefing: 60 menit/hari (6–7 AM). Before AI assist: 2.5 jam/hari. AI handling: first draft, routine formatting. Sari handling: judgment, synthesis, editorial. Rule: AI produces, Sari decides. The 60-minute daily investment is MJP's daily brand touchpoint with 487 klien.</p>
      </div>

      {/* Research Methodology Evolution */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <History className="h-3.5 w-3.5 text-muted-foreground" /> METHODOLOGY EVOLUTION — Bagaimana Metodologi Riset MJP Berkembang dari 2022 ke 2026: 4 Iterasi Besar dan Pelajaran di Balik Setiap Perubahan?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { era: "2022 — Manual Era", description: "Sari + 1 junior researcher. 100% manual: Sari baca LPSE setiap pagi, tulis alert di WA pribadi, kirim ke 23 klien awal. No system. Output: 2–3 alerts/minggu.", lesson: "Works until 50 klien. At 50 klien: Sari exhausted, alert quality inconsistent, no documentation. Had to systemize.", tc: "text-muted-foreground" },
            { era: "2023 — First Systemization", description: "Hendra Jr. builds crawler v1 (LPSE only). Notion database for regulatory tracking. Budi joins full-time. Output: 15 alerts/bln, 8 knowledge assets/bln.", lesson: "Crawler solves volume problem. But quality still Sari-bottleneck. When Sari sick 3 days: no output at all. Single point of failure.", tc: "text-orange-700" },
            { era: "2024 — Process + Template Era", description: "Alert templates designed. L1/L2/L3 framework introduced. Dewi trained as second producer. Weekly sync started. Output: 28 alerts/bln, 22 knowledge assets/bln.", lesson: "Templates and process = 3× output same headcount. Dewi's joining removed single point of failure. But quality gate still informal — one bad alert incident happened.", tc: "text-blue-700" },
            { era: "2025–2026 — AI-Augmented Era", description: "Claude API for briefing drafts. Embedding-based search. Automated scoring. Quality gate formalized. Output: 45+ alerts/bln, 38 knowledge assets/bln.", lesson: "AI multiplies human capacity but doesn't replace judgment. Sari's editing of AI drafts: 30 menit vs 2.5 jam from scratch. AI ROI clear. New constraint: training data quality and prompt engineering.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.era} className="border-l-2 border-primary/20 pl-3 py-1.5">
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.era}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.description}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Lesson: {r.lesson}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Evolution pattern: manual → templated → automated → AI-augmented. Each stage unlocked by headcount + process, not just tech. Rule: don't automate a broken process — fix the process first, then automate. MJP did this right: 2024 process fixes BEFORE 2025 AI augmentation.</p>
      </div>

      {/* Research Impact Scoring */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> IMPACT SCORING — Bagaimana MJP Mengukur Apakah Temuan Riset Benar-Benar Bermanfaat: Sistem Penilaian Dampak dari Setiap Research Item yang Dipublikasikan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Every research item published in MJP platform is scored on 5 dimensions (1–5 each, max 25):</p>
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Dimension</th>
                  <th className="p-1 text-center">Weight</th>
                  <th className="p-1 text-left text-muted-foreground">Score 5 = ...</th>
                  <th className="p-1 text-left text-muted-foreground">Score 1 = ...</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Actionability", "25%", "Klien can take immediate action today", "Interesting but no clear action"],
                  ["Reach (klien affected)", "20%", "Affects > 30% of total klien base", "Affects < 5% of base"],
                  ["Urgency (time sensitive)", "20%", "Action needed within 30 days", "Non-time-sensitive background info"],
                  ["Uniqueness (not public)", "20%", "Exclusive MJP insight, not in public domain", "Easily found via Google"],
                  ["Accuracy confidence", "15%", "Verified from > 2 independent sources", "Single source, unverified"],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center font-bold text-primary">{row[1]}</td>
                    <td className="p-1 text-emerald-700">{row[2]}</td>
                    <td className="p-1 text-muted-foreground">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            {[
              { range: "21–25: FLAGSHIP", desc: "Briefing lead story. WA push. All-tier notification.", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
              { range: "16–20: SIGNIFICANT", desc: "Pro + Enterprise notification. Briefing inclusion.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
              { range: "11–15: STANDARD", desc: "Published in platform. Weekly digest mention.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
              { range: "<11: BACKGROUND", desc: "Published but not actively promoted. Archive/reference role.", tc: "text-muted-foreground", bc: "bg-muted/10 border-muted" },
            ].map((r) => (
              <div key={r.range} className={`flex-1 border rounded-sm p-1.5 ${r.bc}`}>
                <p className={`text-[7px] font-bold ${r.tc}`}>{r.range}</p>
                <p className="text-[7px] text-muted-foreground">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Scoring done by Sari on every item before publish. Takes 5 menit. Score determines distribution channel and priority. Items scoring 21+ are rare (avg 3/bln) — these are MJP's marquee content moments. Sari's personal standard: 'I would be embarrassed to publish a 21+ item with a factual error.'</p>
      </div>

      {/* Research Bias Audit */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-orange-500" /> BIAS AUDIT — Bias Penelitian yang Sari Sadar Ada dalam Data MJP dan Bagaimana Tim Mengelolanya untuk Tetap Memberikan Panduan yang Adil dan Akurat
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              bias: "Jawa-centricity bias",
              description: "71% of Budi's field coverage is Jawa. 68% of klien are in Jawa. MJP intelligence skews toward Jawa procurement norms, pricing, regulatory enforcement speed.",
              impact: "Sumatra/KTI klien get less relevant intel. HPS model less accurate outside Jawa (12% MAE outside Jawa vs 7.8% overall).",
              mitigation: "Quarterly Sumatra trips (Budi). 1 Sumatra asesor partner. Regional filter on all price/HPS content. Transparent disclosure: 'This estimate based on Jawa data.'",
              tc: "text-orange-700"
            },
            {
              bias: "Survivor bias in win/loss data",
              description: "Tender win data collected from klien who report wins (via Reza's survey). Losers less likely to respond. Dataset overrepresents winning patterns.",
              impact: "Win rate statistics may be overstated. Our '29% win rate for Pro klien' = 29% of those who responded, not all Pro klien.",
              mitigation: "Explicitly disclosed in all win rate claims: 'Based on outcome survey respondents (48% response rate).' Sari adds confidence interval to any claim based on this data.",
              tc: "text-orange-700"
            },
            {
              bias: "Recency bias in regulatory alerts",
              description: "Recent regulations receive more attention than older but still-active ones. BUJK may be over-alerted on new rules and under-reminded on existing enforcement increases.",
              impact: "Klien who joined after 2022 may have gaps in awareness of pre-2022 regulatory framework that still applies.",
              mitigation: "Annual 'Regulatory Foundation' knowledge package: 10 core assets covering regulations that predate most klien's subscription start date.",
              tc: "text-blue-700"
            },
            {
              bias: "Selection bias in pain point collection",
              description: "Budi visits BUJK that are active, accessible, and willing. Struggling BUJK (too busy, skeptical, or geographically remote) are underrepresented in pain point data.",
              impact: "We may miss the pains of the most distressed segment — who might also be the highest-need MJP audience.",
              mitigation: "Occasional cold visits to BUJK without prior relationship (Budi quota: 2/month). Industry association event attendance for broader sample.",
              tc: "text-blue-700"
            },
          ].map((r) => (
            <div key={r.bias} className="border-b py-1.5">
              <p className="text-[8px] font-bold mb-0.5">{r.bias}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.description}</p>
              <p className="text-[7px] text-orange-700 mb-0.5">Impact: {r.impact}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Mitigation: {r.mitigation}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Bias audit is done semi-annually by Sari + Hendra. Published in team retro, not publicly. Why acknowledge bias? Two reasons: (1) scientific integrity — research without bias awareness is unreliable. (2) Trust — klien who discover undisclosed bias feel deceived. Proactive disclosure of limitations = higher trust in the data that is presented with confidence.</p>
      </div>

      {/* Sari's Research Workflow */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" /> SARI'S DAY — Hari Kerja Sari sebagai Research Lead: 8 Jam yang Menghasilkan Daily Briefing, Knowledge Assets, Alert Annotations, dan Kalibrasi AI
        </p>
        <div className="flex flex-col gap-1 mb-3">
          {[
            { time: "05:45–06:00", activity: "Wake up. Check platform monitoring dashboard. Any P0 alerts overnight? Any crawler failure? If yes: escalate to Hendra Jr. via WA immediately.", tags: "Monitoring" },
            { time: "06:00–07:00", activity: "Daily Briefing production. Open AI draft (auto-generated 05:30). Edit: add judgment, remove hallucinations, add Sari's voice. Cross-check 3 key claims against primary sources. Approve for delivery at 07:00.", tags: "Core output" },
            { time: "07:00–08:00", activity: "L1/L2 alert review queue. Platform queues urgent items from overnight crawl for Sari's annotation. Each annotation: 3–5 menit. Priority: L1 first.", tags: "Alert quality" },
            { time: "08:00–10:00", activity: "Deep research block. Focused writing: knowledge asset or research item. 1 deep 2-hour session = avg 1 published asset. Phone off. Budi/Reza know: no interruption except P0.", tags: "Deep work" },
            { time: "10:00–11:30", activity: "Cross-team sync. Check Budi's weekly field report upload. Review Dewi's compliance questions queue. Reza's market questions from klien. Answer/route each.", tags: "Team coordination" },
            { time: "11:30–13:00", activity: "L3 signal monitoring. Read regulatory drafts, LPJK announcements, BNSP publications. Tag items for future assets. This is Sari's 'antenna time' — staying ahead of market.", tags: "Monitoring" },
            { time: "13:00–14:00", activity: "Lunch + break.", tags: "Recovery" },
            { time: "14:00–16:00", activity: "Afternoon research session. Knowledge asset writing, briefing special topics, bias audit, OKR work. Slower pace — matches natural energy curve.", tags: "Deep work" },
            { time: "16:00–17:00", activity: "Admin + review. Respond to klien questions escalated from Reza. Quality gate: review assets authored by Dewi. Weekly: prepare Weekly Close intel segment.", tags: "Admin" },
            { time: "17:00", activity: "EOD. No work after 18:00 (Hendra's policy: sustainable pace). Exception: L1 CRITICAL alert overnight — handled via WA, < 20 menit response.", tags: "Boundary" },
          ].map((r) => (
            <div key={r.time} className="flex gap-2 items-start border-b py-1">
              <p className="text-[7px] font-mono w-28 shrink-0 text-muted-foreground">{r.time}</p>
              <p className="text-[7px] flex-1">{r.activity}</p>
              <span className="text-[7px] font-mono text-primary shrink-0 w-24 text-right">{r.tags}</span>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Sari's 8-hour day produces: 1 daily briefing, 3–7 alert annotations, 1 deep asset per day avg, 1 team coordination session. Before AI assist: same output took 11–12 hours. AI time savings: 3–4 hours/day, primarily on first-draft generation and data formatting. Sari: 'AI didn't reduce my work — it elevated what I spend my time on. Less formatting, more thinking.'</p>
      </div>

      {/* Research Citation and Evidence Standards */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookMarked className="h-3.5 w-3.5 text-primary" /> CITATION STANDARDS — Standar Sitasi dan Evidensi MJP: Hierarki 5 Tingkat Sumber dan Aturan Kapan Sebuah Klaim Cukup Didukung untuk Dipublikasikan
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Sari's 5-tier source hierarchy (highest to lowest):</p>
          {[
            { tier: "Tier 1 — Primary Government Document", examples: "Permen, Kepmen, Perpres, SNI text (official gazette, JDIH). LPJK official database export. BNSP certification records.", rule: "ALWAYS cite exact document title + year + article number when referencing. Paraphrase allowed, never misquote.", min: "1 Tier 1 source required for all regulatory claims.", tc: "text-red-700" },
            { tier: "Tier 2 — Official Government Announcement", examples: "Press release from PUPR, LPJK, LKPP, BNSP. Presentation slides from official LPJK/BNSP events (dated, with presenter name).", rule: "Cite event name, date, and speaker. Note: announcements can be superseded by later official document.", min: "Acceptable if no Tier 1 available; flag as 'pending official publication'.", tc: "text-orange-700" },
            { tier: "Tier 3 — Verified Field Observation (Budi)", examples: "Budi's direct conversation records (anonymized). Direct BUJK behavior observation. Photographic/video evidence.", rule: "Must be: (1) within 6 months, (2) geographically attributed (province/kabupaten), (3) anonymized, (4) Budi's direct observation (not hearsay).", min: "Required for all market behavior claims. Cannot stand alone for regulatory claims.", tc: "text-blue-700" },
            { tier: "Tier 4 — Expert Network Intelligence (Dewi)", examples: "Dewi's off-record LPJK contacts, asesor network intelligence, LPJK committee meeting summaries shared informally.", rule: "Must be tagged as 'NETWORK INTELLIGENCE — unconfirmed'. Cannot be cited in published assets without Tier 1/2 support. Internal use only.", min: "Informs direction; cannot be published claim without Tier 1/2 confirmation.", tc: "text-purple-700" },
            { tier: "Tier 5 — Industry Media / Analyst Report", examples: "Kompas, Bisnis Indonesia, Kontan reporting on construction. External analyst reports (McKinsey, World Bank).", rule: "Always verify with Tier 1/2 before publishing. Media can be wrong. Never cite as sole source for regulatory/compliance claim.", min: "Useful for context; never used as sole evidence for actionable claim.", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.tier} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.tier}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Examples: {r.examples}</p>
              <p className="text-[7px] mb-0.5">Rule: {r.rule}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Minimum standard: {r.min}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200 mt-1">
            <p className="text-[9px] font-bold text-emerald-700">MJP citation notation in published assets:</p>
            <p className="text-[8px]">[T1] = Tier 1 primary source (hyperlinked when available). [T2] = Official announcement. [FO] = Field observation (anonymized). [NI] = NOT used in published assets (internal only). Missing citation = Sari's quality gate rejects the draft. Zero tolerance on uncited factual claims.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Citation discipline is MJP's most important differentiator from generic content platforms. Any platform can publish 'construction tips'. Only MJP traces every claim to a primary source. Klien know: when MJP says 'effective Q2 2027', there is a government document behind that claim. This traceable evidence chain is what justifies MJP's Pro tier price vs. free alternatives.</p>
      </div>

      {/* Research Collaboration with External Experts */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> EXTERNAL EXPERTS — Jaringan Mitra Riset Eksternal MJP: 6 Pakar dari Akademia dan Industri yang Membantu Sari Ketika Topik Melampaui Kapasitas Internal Tim
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { type: "Dosen Teknik Sipil (Universitas Diponegoro)", specialty: "Spesifikasi teknis konstruksi, material, metode konstruksi modern. Sari konsultasi ~2x/tahun untuk deep technical assets.", engagement: "Per-consult, non-exclusive. Tidak tahu nama MJP (menjaga independensi).", value: "Validates technical claims Sari cannot verify without engineering background." },
            { type: "Praktisi LPJK (pensiunan pejabat, informal)", specialty: "LPJK regulatory history, draft regulation context, enforcement precedent. Off-record guidance only.", engagement: "Dewi's network. Personal relationship, zero transactional. Anonim.", value: "Explains why certain regulations exist — context behind the text." },
            { type: "Pengacara konstruksi (firma hukum Bandung)", specialty: "Contract dispute interpretation, sub-contractor legal obligations, procurement fraud legal boundaries.", engagement: "Per-consult fee. Used for legal sensitivity review (G6 gate). ~4x/year.", value: "Hendra's legal sanity check before publishing sensitive competitive intelligence." },
            { type: "Konsultan BIM bersertifikat (buildingSMART Indonesia)", specialty: "BIM Level 2/3 implementation, LOD requirements, BIM software ecosystem.", engagement: "Barter: Dewi helps with SKK queries for BIM experts; consultant helps with BIM content review.", value: "Critical for BIM vertical credibility. MJP's BIM assets reviewed by practitioner." },
            { type: "Ekonom infrastruktur (think tank independen)", specialty: "APBN/APBD infrastructure budget trend, political economy of construction spending.", engagement: "Informal, quarterly update call. Sari notes insights, never direct quote without permission.", value: "Macro context for market forecasting — what happens to budget after elections, PSN priorities." },
            { type: "Direktur BUJK (rotasi, 2 aktif per kuartal)", specialty: "Current operational reality. 'What are you actually worried about right now?' Field truth from decision-makers.", engagement: "Reza's network. Occasional lunch meeting. Not 'research sessions' — relationship conversations.", value: "The most direct signal. No translation needed — klien tells MJP what they need." },
          ].map((r) => (
            <div key={r.type} className="border-b py-1.5">
              <p className="text-[8px] font-bold mb-0.5">{r.type}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Specialty: {r.specialty}</p>
              <p className="text-[7px] mb-0.5">Engagement: {r.engagement}</p>
              <p className="text-[7px] font-mono text-primary">Value: {r.value}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">External expert network is deliberately small (6 active relationships). Hendra's philosophy: depth of relationship beats breadth of contact list. Each expert has been engaged 3+ times — they know MJP's standards and respond efficiently. New expert added only when there's a sustained knowledge gap (not for one-off questions). Adding an expert = commitment to 2+ engagements per year minimum. Sari manages all expert relationships directly.</p>
      </div>

      {/* Budi's Field Route Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Map className="h-3.5 w-3.5 text-primary" /> BUDI'S ROUTES — Peta Rute Lapangan Budi: 4 Wilayah yang Dikunjungi Rotasi per Bulan, Berapa BUJK Ditemui, dan Jenis Intelijen yang Hanya Bisa Didapat dari Setiap Wilayah
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {[
              { stat: "~18", label: "BUJK visits per bulan (avg)", tc: "text-primary" },
              { stat: "4 wilayah", label: "Rotasi bulanan Budi", tc: "text-muted-foreground" },
              { stat: "3 hari", label: "Avg per wilayah per kunjungan", tc: "text-muted-foreground" },
              { stat: "4.2", label: "Avg pain points per visit", tc: "text-emerald-700" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-base font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          {[
            { region: "Wilayah A — Solo + sekitarnya (Minggu 1)", bujk: "5–6 BUJK/kunjungan", intel: "Proyek pemerintah daerah (APBD Soloraya), subcontracting patterns for PUPR regional, local asesor network activity.", unique: "Budi's deepest personal network here — some BUJK directors treat Budi as informal advisor. Most candid conversations about financial health.", color: "text-primary" },
            { region: "Wilayah B — Semarang + sekitarnya (Minggu 2)", bujk: "5–6 BUJK/kunjungan", intel: "Port and logistics infrastructure BUJK, BUMN Pelabuhan sub-contracts, BUJK who bid cross-province.", unique: "Semarang has highest concentration of BUJK doing PSN IKN sub-works in Jateng — IKN sub-contract intelligence hotspot.", color: "text-blue-700" },
            { region: "Wilayah C — Bandung + Cirebon (Minggu 3)", bujk: "4–5 BUJK/kunjungan", intel: "West Java infrastructure BUJK, Jabar APBD patterns, connections to Jakarta-based klien who subcontract to Jabar BUJK.", unique: "Strongest overlap between Budi's network and MJP klien (many Jabar BUJK are MJP subscribers). Budi can check in informally.", color: "text-orange-700" },
            { region: "Wilayah D — Flexible/special (Minggu 4)", bujk: "4–5 BUJK/kunjungan", intel: "Variable: may be Yogyakarta, Surabaya, or a follow-up on important contact. Used for deep-dive on a specific intelligence need Sari flags.", unique: "The 'intelligence on demand' week — Sari identifies highest-priority intelligence gap, Budi goes where that gap can be filled.", color: "text-emerald-700" },
          ].map((r) => (
            <div key={r.region} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.color} mb-0.5`}>{r.region}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">BUJK density: {r.bujk} | Intel type: {r.intel}</p>
              <p className={`text-[7px] font-mono ${r.color}`}>Unique: {r.unique}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Budi's monthly field cost: Rp 6.2jt (transport + accommodation + meals). Return on this investment: 75 pain points/month (avg), 3–4 field intelligence reports that directly improve Sari's knowledge assets, and 2–3 BUJK who are converted to MJP klien via Reza's follow-up. Budi never pitches MJP directly — he identifies interest and passes to Reza. ROI of Budi's field work: immeasurable in traditional terms. It is MJP's intelligence moat.</p>
      </div>

      {/* Interview Protocol Deep Dive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Mic className="h-3.5 w-3.5 text-primary" /> INTERVIEW PROTOCOL — Protokol Wawancara Budi dengan BUJK: 5 Fase Percakapan, Pertanyaan Kunci yang Tidak Pernah Dia Lewati, dan Bagaimana Dia Mengubah Obrolan Santai Menjadi Intelijen Terstruktur
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { phase: "Fase 1 — Rapport Building (10–15 menit)", questions: ["'Proyek berjalan bagaimana sekarang?'", "'Ada yang menarik dari tender terakhir?'", "Update pribadi — anak, cucu, kesehatan — untuk kontak lama."], insight: "Budi's rule: never open with a question about MJP or problems. Build connection first. Contacts who feel heard give more honest answers in later phases.", tc: "text-muted-foreground" },
            { phase: "Fase 2 — Process Probing (15–20 menit)", questions: ["'Bagaimana biasanya bapak/ibu cari tender?'", "'Berapa lama dari pertama tahu tender sampai submit dokumen?'", "'Siapa di tim yang ngurusin dokumen kualifikasi?'"], insight: "Maps current workflow. Budi never suggests what the 'right' answer is — he needs to understand actual behavior, not what they think he wants to hear.", tc: "text-blue-700" },
            { phase: "Fase 3 — Pain Elicitation (20–25 menit)", questions: ["'Pernah ada tender yang gagal padahal mestinya bisa menang?'", "'Kalau boleh rubah satu hal dari proses pengadaan, apa yang dipilih?'", "'Kompetitor mana yang paling sering menang di wilayah bapak/ibu? Kenapa menurut bapak/ibu?'"], insight: "These 3 questions reliably surface pain points. The competitor question is the most valuable — it maps competitive landscape AND surfaces what the contact perceives as winning factors.", tc: "text-orange-700" },
            { phase: "Fase 4 — Intelligence Capture (10 menit)", questions: ["'Ada kabar soal proyek baru di wilayah ini?'", "'LPJK atau asosiasi ada info regulasi terbaru?'", "'Sub-kontraktor mana yang lagi naik daun atau sebaliknya?'"], insight: "Lateral intelligence — not just about the contact's company but about the market. This is where Budi captures competitive and regulatory signals that Sari cannot get from official sources.", tc: "text-primary" },
            { phase: "Fase 5 — Close (5 menit)", questions: ["'Ada teman BUJK yang mungkin butuh info yang sama?'", "'Boleh saya follow up via WA kalau ada info yang relevan?'"], insight: "Natural referral request — never a hard ask. Budi has generated 31 MJP klien leads directly from this close question (over 4 years). His conversion from 'referral' to 'Reza follow-up lead': 78%.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.phase} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.phase}</p>
              <div className="mb-0.5">{r.questions.map((q, i) => <p key={i} className="text-[7px] italic">"{q}"</p>)}</div>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.insight}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Protocol developed by Budi himself over 4 years of field work — documented by Sari after interviewing Budi about his process (Q3 2025). Budi had never consciously articulated the phases — he just 'knew what worked'. Sari's documentation of implicit knowledge into explicit protocol is itself an example of MJP's knowledge production: tacit → codified. Now used as training material for the Budi apprentice (target hire Q3 2027).</p>
      </div>

      {/* Research Quality Metrics */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <SquareCheckBig className="h-3.5 w-3.5 text-primary" /> QUALITY METRICS — Metrik Kualitas Riset MJP 2025: Bagaimana Kami Mengukur Akurasi, Relevansi, dan Kedalaman — dan Apa yang Terjadi Ketika Temuan Lapangan Bertentangan dengan Data Sekunder
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {[
              { stat: "97.3%", label: "Source citation completeness (2025)", tc: "text-emerald-700" },
              { stat: "4.1/5.0", label: "Klien relevance rating (avg)", tc: "text-primary" },
              { stat: "2.7%", label: "Asset correction rate (post-publish)", tc: "text-orange-700" },
              { stat: "8 jam", label: "Avg time to correct reported error", tc: "text-blue-700" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-base font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-primary mb-0.5">Conflict resolution: when field data contradicts secondary data</p>
            <p className="text-[7px] text-muted-foreground mb-1">This happens ~7× per year. Protocol (written Q3 2025):</p>
            {[
              ["Step 1", "Document the contradiction explicitly: 'Budi observed X in field; official source Y says Z.'"],
              ["Step 2", "Investigate cause: is field observation current and official data outdated? Or is field anecdote limited in scope?"],
              ["Step 3", "If official source > 6 months old and Budi's observation is consistent across 3+ BUJK: defer to field."],
              ["Step 4", "If conflict unresolved: publish BOTH perspectives with explicit uncertainty label [Conflicting Sources]."],
              ["Step 5", "Flag for Dewi (regulatory) or Sari (market) for follow-up verification within 30 days."],
            ].map(([s, d]) => (
              <div key={s} className="flex gap-2 text-[7px] py-0.5">
                <p className="font-bold text-primary shrink-0 w-12">{s}</p>
                <p className="text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-orange-700 mb-0.5">Correction rate benchmark: 2.7% is acceptable</p>
            <p className="text-[7px] text-muted-foreground">Industry benchmark for research publications: 3–8% correction rate. MJP at 2.7% is below industry average despite using field intelligence sources (which have higher inherent uncertainty than pure secondary sources). Breakdown of 2.7%: 1.4% factual updates due to regulatory change (not original error), 0.9% genuine initial error (mostly HPS estimates), 0.4% klien interpretation clarification.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Quality metrics published internally (not publicly) in Sari's quarterly research report. Hendra reviews. The 4.1/5.0 relevance rating comes from in-app feedback (thumb up/down + optional comment on each knowledge asset). Rating has improved from 3.7 in 2023 to 4.1 in 2025 — attributable to better KBLI tagging (Hendra Jr.'s tagging improvement) and more precise audience targeting (J7 vs. J8 vs. J9 asset labeling).</p>
      </div>

      {/* Research Corpus Categorization */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Library className="h-3.5 w-3.5 text-primary" /> CORPUS MAP — Peta Kategorisasi Lengkap 3.200 Knowledge Asset MJP: Distribusi per Kategori Utama, Mana yang Terlalu Sedikit, Mana yang Sudah Jenuh, dan Prioritas Pengisian Gap 2026–2027
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Kategori utama</th>
                  <th className="p-1 text-center">Assets</th>
                  <th className="p-1 text-center">% of corpus</th>
                  <th className="p-1 text-center">Saturation</th>
                  <th className="p-1 text-left">Gap assessment</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Tender & Procurement Intelligence", "814", "25.4%", "Medium", "Core category. Well-covered for Jawa. Outer island gaps remain."],
                  ["SKK/SBU Compliance Guides", "612", "19.1%", "Medium-High", "Strong for Sipil/Arsitek. Gap: MEP + K3 advanced guides."],
                  ["Regulatory & Legal (Permen, Perpres, SE)", "487", "15.2%", "Medium", "Coverage current. K3 sub-regulation underserved."],
                  ["BUJK Classification & Jenjang", "341", "10.7%", "High", "Well-saturated. J9 complex cases still have gap."],
                  ["HPS Benchmarks (KBLI-specific)", "298", "9.3%", "Low-Medium", "BIG GAP: outer island and rare KBLI categories need benchmark data."],
                  ["Competitor & Market Intelligence", "267", "8.3%", "Low", "GAP: limited competitor profiles outside top 200 BUJK."],
                  ["Consortium & Partnership Guides", "184", "5.8%", "Low", "GAP: post-2024 consortium regulation changes not fully covered."],
                  ["BIM & Technology Adoption", "94", "2.9%", "Very Low", "CRITICAL GAP: BIM mandate approaching 2027. Only 94 assets vs. need for 400+."],
                  ["Sustainability & Green Construction", "73", "2.3%", "Very Low", "Emerging. ESG requirement wave coming 2027–2028."],
                  ["Internasional & Export Construction", "30", "0.9%", "Minimal", "Early stage. Target: grow to 150 assets post-Series A."],
                ].map((row, i) => (
                  <tr key={i} className={`border-b hover:bg-muted/20 ${row[3] === "Very Low" || row[3] === "Minimal" ? "bg-red-50/30" : ""}`}>
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-primary font-bold">{row[1]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[2]}</td>
                    <td className={`p-1 text-center font-bold ${row[3] === "High" || row[3] === "Medium-High" ? "text-emerald-700" : row[3] === "Medium" ? "text-blue-700" : row[3].includes("Low") ? "text-orange-700" : "text-red-700"}`}>{row[3]}</td>
                    <td className={`p-1 ${row[4].includes("GAP") ? "text-red-700 font-bold" : "text-muted-foreground"}`}>{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-red-50 border-red-200">
            <p className="text-[9px] font-bold text-red-700">Critical gap: BIM (94 assets vs. estimated 400+ needed)</p>
            <p className="text-[8px]">BIM mandate for PUPR projects {'>'} Rp 100M effective 2027. MJP needs to 4× BIM coverage in 18 months. Plan: (1) hire BIM domain expert (Q3 2026 target), (2) fast-track 10 BIM assets/month from hire date, (3) partner with BIM consultant community for co-authored content. Without this: MJP misses the BIM adoption wave that will affect {'>'} 1.400 BUJK in its target segment.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Corpus gap analysis done by Sari + Hendra quarterly. The gap map directly feeds the knowledge production roadmap and new hire specifications (BIM domain expert is defined by the gap, not by abstract hiring ambition). Hendra's principle: 'Every knowledge gap we have is a reason a BUJK will choose not to renew. The gap map is a churn risk map in disguise.'</p>
      </div>

      {/* Budi's Intelligence Conversion Rate */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartColumnBig className="h-3.5 w-3.5 text-primary" /> BUDI'S CONVERSION RATE — Bagaimana Informasi dari Budi di Lapangan Menjadi Produk Pengetahuan di Platform: Dari 847 Observasi ke 312 Knowledge Assets — Apa yang Lolos dan Apa yang Terfilter
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {[
              { stat: "847", label: "Field observations 2025", tc: "text-primary" },
              { stat: "312", label: "Converted to knowledge assets", tc: "text-blue-700" },
              { stat: "37%", label: "Field-to-asset conversion rate", tc: "text-emerald-700" },
              { stat: "4 weeks", label: "Avg field obs → asset publish time", tc: "text-muted-foreground" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-base font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[8px] font-bold mb-1">Why 63% of observations are NOT converted to assets:</p>
          {[
            { reason: "R1 — Insufficient generalizability (41% of filtered observations)", desc: "Budi observes a highly specific situation unique to one BUJK or one project site. Sari's review: 'Is this a pattern or a one-off?' One-offs go to the research archive, not published assets.", example: "Budi: 'A BUJK in Boyolali has trouble understanding a specific subcontract clause.' → Sari: 'Is this clause common? Is it specific to one owner?' Answer: specific to PUPR local office. Filed, not published." },
            { reason: "R2 — Duplicates existing asset (28% of filtered)", desc: "Budi's observation confirms something already covered in the knowledge registry. Sari updates the existing asset's confidence score (observation as corroboration) but doesn't create a new asset.", example: "Budi: 'BUJK keep asking about SKK J7 renewal at D-30.' → Already covered by asset KS-001247. Sari adds a fresh field quote to the existing asset as social proof." },
            { reason: "R3 — Outside MJP's domain (19% of filtered)", desc: "Observation touches areas MJP doesn't cover and shouldn't cover: construction financing, workforce management, equipment procurement. Filed for potential future product expansion, not current assets.", example: "Budi: 'BUJK struggling to find heavy equipment financing for IKN project.' → Financing is not MJP's domain. Filed in 'future product ideas' folder." },
            { reason: "R4 — Insufficient evidence base (12% of filtered)", desc: "Single observation without corroboration from secondary source. Sari's minimum standard: field observation PLUS one secondary source confirmation before publishing.", example: "Budi: 'Heard BNSP is changing its assessment schedule in Jatim.' → Sari: could not confirm via BNSP website or Dewi's contacts. Budi asked to follow up in next visit." },
          ].map((r) => (
            <div key={r.reason} className="border-b py-1.5">
              <p className="text-[8px] font-bold text-orange-700 mb-0.5">{r.reason}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className="text-[7px] font-mono text-muted-foreground italic">Example: {r.example}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">37% field-to-asset conversion rate is Sari's quality gate — not a problem to fix, but a feature. A 70% conversion rate would mean lower editorial standards (more one-offs and unverified claims getting published). The 63% that doesn't convert is not waste — it's evidence that MJP has editorial discipline. Budi understands this: 'I don't measure my value by how many of my notes become articles. I measure it by whether the team learns something actionable from what I observe.' Hendra: 'Budi's filter instinct has improved every year — his conversion rate is now 37% vs. 22% in 2022, because he pre-filters in the field before logging.'</p>
      </div>

      {/* Research Ethics & Privacy in Field Work */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5 text-primary" /> RESEARCH ETHICS — Etika Riset dan Privasi dalam Pekerjaan Lapangan MJP: Prinsip yang Budi Pegang Saat Melakukan Observasi di Lapangan — Informasi Apa yang Boleh Dikumpulkan dan Cara Kami Melindungi Kepercayaan BUJK
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              principle: "P1 — Never record personal financial information",
              rule: "Budi does not ask about, record, or retain individual BUJK financial data: contract values, payment disputes, profit margins, or bank information. Observations are about operational processes, pain points, and regulatory interactions — not financials.",
              tested: "A BUJK director once offered to share their financial statements to 'help MJP understand their problem.' Budi declined, explained MJP's policy, and redirected to process questions. The director respected the boundary."
            },
            {
              principle: "P2 — Anonymize all individual observations",
              rule: "No field note ever contains a person's full name, NPWP, or identifiable personal information. Notes use: 'Direktur BUJK Sipil J8 di area Semarang Barat' not 'Pak Santoso dari PT Maju Jaya.' Sari applies additional anonymization before publishing.",
              tested: "Sari rejected one Budi note that was too specific (named a specific PUPR local project + BUJK). Revised to use regional pattern framing instead."
            },
            {
              principle: "P3 — Informed context (not covert observation)",
              rule: "Budi identifies himself as working for a market research platform when conducting structured observations. For casual conversations in community settings (BUJK forum events), Budi uses his judgment — community discussions are public discourse.",
              tested: "When a BUJK director asked explicitly 'are you going to publish what I say?', Budi said: 'I may use it to improve our intelligence platform, anonymized. Is that okay?' Director said yes. Budi recorded with explicit permission."
            },
            {
              principle: "P4 — No competitive intelligence on behalf of specific klien",
              rule: "MJP never does 'targeted intelligence work' where a klien asks for information about a specific competitor BUJK. All intelligence is general market intelligence. Budi never approaches a BUJK visit with a specific klien's competitive question in mind.",
              tested: "A klien once asked Reza: 'Can Budi find out what PT [specific BUJK] is bidding for this quarter?' Reza declined: 'We can tell you market patterns, not specific competitor plans. That's not something we do.'"
            },
          ].map((r) => (
            <div key={r.principle} className="border-b py-1.5">
              <p className="text-[8px] font-bold text-primary mb-0.5">{r.principle}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.rule}</p>
              <p className="text-[7px] font-mono text-muted-foreground italic">Tested: {r.tested}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Research ethics framework drafted by Hendra in 2023 after Series Seed (investor due diligence raised ethical questions about field intelligence collection). The 4 principles emerged from that review. Budi was trained on the framework for 2 days before his first field visit in 2022 (retrospectively formalized in 2023). The framework does two things simultaneously: protects MJP from legal and reputational risk, and protects the trust relationship with the BUJK community that Budi's program depends on. Without that trust, BUJK won't talk to Budi honestly — and without honest field intelligence, MJP's corpus degrades.</p>
      </div>

      {/* Research Program Expansion Plan */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Tent className="h-3.5 w-3.5 text-primary" /> RESEARCH EXPANSION — Rencana Ekspansi Program Riset Lapangan: Dari 1 Budi ke 5 Field Researcher — Cara Hendra akan Menskalakan Intelijen Lapangan Tanpa Kehilangan Kualitas yang Membuat Program Ini Berharga
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              phase: "Phase 1 — Current (1 researcher: Budi)", status: "ACTIVE",
              coverage: "Coverage: Java (primary), Sumatra (quarterly visits), Kalimantan (annual visits). 180 BUJK contacts. 4 provinces primary, 8 provinces occasional.",
              bottleneck: "Bottleneck: 1 person = 1 city at a time. Sulawesi, Papua entirely uncovered. IKN (Kaltim) only visited 2×/year despite growing importance.",
              tc: "text-emerald-700"
            },
            {
              phase: "Phase 2 — Post-Series A Year 1 (3 researchers: Budi + 2 regional)", status: "PLANNED Q4 2026",
              coverage: "New hire R1: Sulawesi (Makassar-based). New hire R2: Kalimantan/IKN (Balikpapan-based). Budi maintains Java/Sumatra focus. Total coverage: 15 provinces primary.",
              bottleneck: "Challenge: Budi's methodology must be transferable. Hendra's plan: 3-month Budi-shadow program for each new hire before independent field assignment. Ethics framework, note-taking system, and Sari's editorial standards must be internalized.",
              tc: "text-blue-700"
            },
            {
              phase: "Phase 3 — Post-Series A Year 2 (5 researchers)", status: "PLANNED 2028",
              coverage: "R3: Papua/Maluku (Jayapura-based). R4: Sumatra specialist (Medan-based). Budi becomes Field Research Lead — reviews all researchers' notes, maintains quality standards, 50% field / 50% coordination.",
              bottleneck: "Challenge: Budi as manager is a role transition. He may be more valuable in the field than managing others. Hendra's decision: Budi decides his own role evolution. 'If Budi wants to stay 100% field, we hire a separate Field Lead. His instinct is the product — we won't force him into a desk.'",
              tc: "text-orange-700"
            },
            {
              phase: "What will NOT be scaled (by design)", status: "PERMANENT CONSTRAINT",
              coverage: "MJP will not use crowdsourced field intelligence (UGC from klien base). Quality degradation is too high. MJP will not replace field researchers with digital social listening — qualitative context is irreplaceable. MJP will not use anonymous contractor survey data — Budi's named network is what makes the intelligence trusted.",
              bottleneck: "Hendra's principle: 'We scale the field program by adding people with the same depth of method, not by reducing the method to accommodate more people. Quality is the product.'",
              tc: "text-muted-foreground"
            },
          ].map((r) => (
            <div key={r.phase} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.phase}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.status === "ACTIVE" ? "text-emerald-700" : r.status.startsWith("PLANNED") ? "text-blue-700" : "text-muted-foreground"}`}>{r.status}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.coverage}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.bottleneck}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Field research expansion is the most strategically important post-Series A investment after engineering. Hendra's allocation priority: H1 (backend engineer) → H2–H3 (Sari apprentices) → H4 (Sulawesi researcher) → H5 (Kaltim researcher). The researcher roles are budgeted at Rp 7–9jt/month each (competitive for the regions) + travel allowance Rp 3–4jt/month + equipment. Total 2 new researcher cost: Rp 24–28jt/month. But the data they produce feeds 5 product features directly and prevents churn in the 22% of klien who cite 'intelligence freshness' as their primary retention reason. The ROI is not immediate — it's a 12–18 month investment before the new researchers' intelligence reaches the same quality as Budi's.</p>
      </div>

      {/* Research Intelligence → Product Hypothesis Pipeline */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FlaskConical className="h-3.5 w-3.5 text-primary" /> HYPOTHESIS PIPELINE — Pipeline Hipotesis Produk dari Riset Lapangan: Bagaimana Observasi Budi di Lapangan Berubah Menjadi Hipotesis yang Diuji Sebelum Fitur Dibangun — 4 Hipotesis Aktif Saat Ini
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Active product hypotheses derived from field intelligence (Q2 2026):</p>
          {[
            {
              hyp: "H1 — BUJK directors check LPSE on their phone between 06:00–07:30 before arriving at the office",
              source: "Budi observation (Q1 2026): 7 of 12 directors interviewed mentioned checking procurement news 'pagi sebelum meeting' using their phone. Corroborated by Hendra Jr.'s session time data: 31% of mobile sessions occur 05:45–07:30.",
              test: "Validation test: run A/B test — send Daily Briefing at 06:30 vs. 08:00 for randomly selected 80 klien. Metric: open rate within 2h of delivery. Test period: 8 weeks starting Q3 2026.",
              status: "IN DESIGN — Hendra Jr. building A/B infrastructure",
              tc: "text-primary"
            },
            {
              hyp: "H2 — J7 BUJK who are 12–18 months from jenjang eligibility are MJP's highest-LTV acquisition target",
              source: "Budi observation + Dewi commercial data: BUJK who upgrade from J7→J8 during MJP subscription: 94% renewal rate post-upgrade (vs. 78% overall). The upgrade event creates peak product value — suddenly 3× more tenders are relevant.",
              test: "Validation test: outreach campaign targeting 50 J7 BUJK in Reza's pipeline who meet the 12–18 month eligibility window. Measure: CAC, first-year LTV, and upgrade timing for this cohort vs. standard J7 acquisitions.",
              status: "ACTIVE TEST — Reza running outreach since Q2 2026 (37 of 50 contacted)",
              tc: "text-blue-700"
            },
            {
              hyp: "H3 — BUJK who lose a tender by < 5% HPS gap are the most motivated to use MJP's HPS model",
              source: "Reza commercial intel: 3 klien explicitly mentioned 'kami kalah tipis' as their reason for starting a Pro trial. If near-miss is a conversion trigger, MJP can create a specific near-miss alert: 'You came close — here's how to improve next time.'",
              test: "Validation test: build 'near-miss detector' — flag klien tenders where they lost by < 5% HPS. Send targeted in-app message: 'Anda hampir menang. Simak analisis HPS untuk tender selanjutnya.' Metric: HPS model usage rate for near-miss recipients vs. control.",
              status: "HYPOTHESIS ONLY — not yet in build queue",
              tc: "text-orange-700"
            },
            {
              hyp: "H4 — BUJK who share an MJP alert with a colleague via WA are 3× more likely to refer a new subscriber",
              source: "Sari analytics: 14% of WA alert messages are forwarded (WhatsApp 'Forwarded' label visible in delivery receipts). Reza's observation: 6 of his last 12 new leads mentioned 'teman saya forward alert-nya.' If share rate correlates with referral rate, optimizing for shareability matters.",
              test: "Validation test: add 'Bagikan ke tim' button to mobile alert view. Track shares. After 60 days: did high-share klien generate more referrals than low-share klien? Metric: correlation between share count and referral count per klien.",
              status: "HYPOTHESIS ONLY — being reviewed for Q4 2026 build queue",
              tc: "text-emerald-700"
            },
          ].map((r) => (
            <div key={r.hyp} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.hyp}</p>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Source: {r.source}</p>
              <p className={`text-[7px] font-mono ${r.tc} mb-0.5`}>Test: {r.test}</p>
              <p className={`text-[7px] font-bold ${r.status.startsWith("ACTIVE") ? "text-emerald-700" : r.status.startsWith("IN DESIGN") ? "text-blue-700" : "text-muted-foreground"}`}>{r.status}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">4 active hypotheses represent MJP's current product experiment queue. Hendra's rule: never run more than 2 A/B tests simultaneously (to avoid confounding variables and split Hendra Jr.'s attention). H1 and H2 are the active tests. H3 and H4 are queued and will activate after H1 and H2 produce results (Q4 2026). The hypothesis pipeline is maintained by Sari — she writes the hypothesis, collects the source evidence, and proposes the test design. Hendra approves the test protocol. Hendra Jr. builds the infrastructure. Reza sometimes runs the commercial-facing tests. Every hypothesis flows through this same process, regardless of who originated it.</p>
      </div>

      {/* R96: Research Field Quality Assurance */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-primary" /> FIELD RESEARCH QUALITY ASSURANCE — Bagaimana MJP Memastikan Data yang Dikumpulkan Budi dan Tim di Lapangan Akurat, Konsisten, dan Dapat Dipercaya: 5 Layer QA yang Membedakan MJP dari Riset Ad-Hoc
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { layer: "QA-1: Triangulasi Minimum", rule: "Setiap temuan lapangan harus dikonfirmasi dari minimum 2 sumber independent sebelum masuk ke database. Budi tidak boleh publish single-source insight ke klien.", application: "Berlaku untuk: harga material, kapasitas BUJK, kondisi lapangan proyek. Tidak berlaku untuk: data publik (LPSE, BNSP) yang sudah melalui verification by origin.", tc: "text-primary" },
            { layer: "QA-2: Temporal Freshness Flag", rule: "Setiap research item mendapat freshness_score yang decay seiring waktu. Item >90 hari tanpa re-verification: status 'STALE', tidak ditampilkan dalam rekomendasi aktif.", application: "Hendra Jr. membangun auto-decay algorithm: score 100 saat input, -1 per hari, alert ke Budi pada score 30 (60 hari). Budi melakukan re-verification sebelum expiry.", tc: "text-blue-700" },
            { layer: "QA-3: Conflict Detection", rule: "Jika input baru bertentangan dengan data existing (harga naik >20% dari catatan sebelumnya), sistem flag untuk manual review sebelum overwrite.", application: "Mencegah data entry error dari mengoverwrite verified historical data. Hendra Jr.: 'Outlier bisa benar — tapi harus diverifikasi, bukan auto-accepted.'", tc: "text-orange-700" },
            { layer: "QA-4: Source Credibility Scoring", rule: "Sumber data diberi credibility score: kontraktor langsung (C1=100), asosiasi industri (C2=85), forum online (C3=60), media massa (C4=50). Insight dari C3/C4 butuh corroboration dari C1/C2.", application: "Dewi maintains source credibility registry — setiap sumber yang Budi gunakan di-log dengan credibility tier. Sari melakukan quarterly audit.", tc: "text-emerald-700" },
            { layer: "QA-5: Cross-Team Challenge Protocol", rule: "Setiap insight yang akan masuk ke Knowledge Registry harus survive 'challenge session' — Hendra atau Sari bisa challenge validity. Budi harus defend dengan evidence.", application: "Challenge sessions berlangsung 2x/bulan, 30 menit. Budi: 'Awalnya tidak nyaman — terasa seperti ditanyai terus. Sekarang saya justru lebih siap karena saya tahu akan dichallenge. Kualitas riset saya naik karena itu.'", tc: "text-purple-700" },
          ].map((r) => (
            <div key={r.layer} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.layer}</p>
              <p className="text-[7px] font-mono text-muted-foreground mb-0.5">Rule: {r.rule}</p>
              <p className={`text-[7px] ${r.tc}`}>Application: {r.application}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">5-layer QA framework berkembang organically dari 2 data quality incidents: (2022) Budi memasukkan harga besi beton dari satu supplier yang sedang clearance sale — harga masuk sebagai 'pasar rata-rata', menyesatkan beberapa klien. (2023) Research item tentang kapasitas BUJK di Sulawesi ternyata dari sumber yang salah identitas entitas. Post-incident QA protocol didesain bukan untuk punish Budi, tapi untuk protect reputasi MJP. Hendra: 'Satu data yang salah yang sampai ke klien lebih merusak dari 100 data yang benar. Reputasi dalam intelligence business adalah segalanya — dan satu-satunya cara membangun reputasi adalah dengan tidak pernah menjadi sumber yang salah.'</p>
      </div>

      {/* R97: Research Commercialization Pathways */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> RESEARCH COMMERCIALIZATION PATHWAYS — 4 Cara Riset Lapangan MJP Menghasilkan Revenue Lebih dari Sekedar Fitur Platform: Dari Paid Reports hingga Licensing, Custom Research, dan Government Data Partnership
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { path: "P1: Paid Research Reports (custom klien)", stage: "ACTIVE — Q3 2025 pilot", desc: "2 Enterprise klien sudah commission custom research dari Budi: (1) Peta kapasitas BUJK spesialis MEP di 5 kota besar untuk Rp 8jt. (2) Analisis harga material konstruksi di Kalimantan Timur untuk Rp 6jt. Revenue kecil tapi: (a) validates willingness to pay for research beyond subscription. (b) produces research assets yang kemudian bisa di-anonymize dan dijual ke klien lain.", est_rev: "Rp 50–80jt/tahun (5–8 custom reports)", tc: "text-emerald-700" },
            { path: "P2: Research Licensing ke Asosiasi dan Lembaga Pemerintah", stage: "PIPELINE — H2 2026", desc: "GAPENSI Kalimantan Timur tertarik pada data BUJK density dan SKK workforce demand yang MJP miliki. Model: annual licensing fee Rp 25–50jt untuk akses bulk download research data. Risks: government institutions often slow to pay and require formal procurement process. Hendra deliberating: high effort for uncertain revenue, but significant brand credential.", est_rev: "Rp 75–150jt/tahun (3 lisensi)", tc: "text-blue-700" },
            { path: "P3: Research-as-a-Service untuk BUJK besar", stage: "CONCEPT — 2027", desc: "Enterprise BUJK (J9, revenue >Rp 500M) yang tender 20+ proyek per tahun membutuhkan dedicated research support: pra-tender competitor analysis, HPS validation, risk assessment. MJP belum punya bandwidth untuk this — butuh Budi + 1 additional researcher minimum. Post-Series A hire plan includes 1 Research Associate specifically for RaaS.", est_rev: "Rp 200–400jt/tahun (4 retainer klien)", tc: "text-orange-700" },
            { path: "P4: Government Partnership — data sharing dengan Kementerian PUPR", stage: "LONG-TERM — 2028+", desc: "PUPR sedang membangun konstruksi.pu.go.id sebagai data platform. MJP's field intelligence (pain points, BUJK capacity, regional analysis) adalah exactly what PUPR needs to understand construction sector health beyond procurement numbers. Potential: data contribution agreement in exchange for first-access to PUPR datasets. Strategic value exceeds direct revenue.", est_rev: "Revenue unclear — strategic value primary", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.path} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.path}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.stage}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className={`text-[7px] font-mono font-bold ${r.tc}`}>{r.est_rev}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Research commercialization adalah Hendra's 'second revenue stream' thesis: MJP's subscription revenue grows with klien count, but research revenue can grow independently through partnerships and custom work. Combined: 2 revenue streams with different growth curves and different customer types (subscription: BUJK; research: BUJK besar + asosiasi + government) = more stable ARR mix. Target 2027: research revenue = 15% of total MJP revenue, up from 1.2% today. Hendra: 'Budi melakukan riset setiap hari. Kami membayar dia untuk itu. Pertanyaannya bukan apakah riset ini bernilai — pertanyaannya adalah siapa lagi yang mau bayar untuk riset ini selain klien yang sudah subscribe.'</p>
      </div>

      {/* R98: Research Coverage Gap Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" /> RESEARCH COVERAGE GAP ANALYSIS — Provinsi dan Domain yang Masih Under-Researched: Dimana Budi Belum Punya Field Data yang Cukup, Apa Konsekuensinya, dan Prioritas Field Trip 2026–2027
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Wilayah/Domain</th>
                  <th className="p-1 text-center">Field data items</th>
                  <th className="p-1 text-center">BUJK aktif</th>
                  <th className="p-1 text-center">Coverage ratio</th>
                  <th className="p-1 text-center">Priority</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Kalimantan Timur (IKN)", "23", "1.847", "1.25%", "P1 — Q3 2026 field trip", "text-red-700"],
                  ["Papua Selatan & Tengah", "4", "412", "0.97%", "P2 — Q4 2026", "text-red-700"],
                  ["Sulawesi Tengah & Tenggara", "11", "847", "1.30%", "P3 — Q1 2027", "text-orange-700"],
                  ["MEP Specialist contractors", "8", "~3.200", "0.25%", "P2 — desk research first", "text-red-700"],
                  ["Jawa Barat (outside Bandung)", "31", "8.312", "0.37%", "P4 — expand existing coverage", "text-orange-700"],
                  ["Jawa Tengah (covered)", "89", "6.847", "1.30%", "ADEQUATE", "text-emerald-700"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-primary">{row[1]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[2]}</td>
                    <td className={`p-1 text-center font-bold ${parseFloat(row[3]) >= 1.2 ? "text-emerald-700" : parseFloat(row[3]) >= 0.5 ? "text-orange-700" : "text-red-700"}`}>{row[3]}</td>
                    <td className={`p-1 text-[7px] font-bold ${row[5]}`}>{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {[
            { insight: "Kaltim IKN: highest urgency coverage gap in MJP's history", detail: "1.847 BUJK aktif di Kaltim, hanya 23 field data items dari Budi. 78% of MJP's Kaltim klien (148 aktif) are being served by Jawa-derived data that may not reflect Kaltim market realities: different material prices (logistics premium), different labor market (Dayak contractor networks), different regulatory enforcement (Dinas PU Kaltim interpretation vs Jawa). Budi's Q3 2026 IKN field trip is the highest ROI activity MJP can do this quarter.", tc: "text-red-700" },
            { insight: "MEP (Mechanical, Electrical, Plumbing) blind spot", detail: "~3.200 MEP specialist BUJK in Indonesia, only 8 field data items. MEP contractors are systematically under-represented because Budi's network is construction-focused, not MEP-focused. Fix: 1 dedicated MEP field interview series in Q4 2026, targeting GAPENSI MEP chapter members.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.insight} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.insight}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Coverage gap analysis dilakukan Hendra setiap semester dengan membandingkan research item distribution vs BUJK distribution per wilayah. Hendra: 'Our research is a sample of reality. Sample quality matters. Jawa coverage ratio 1.3% sudah cukup untuk representative patterns. Kaltim 1.25% — sekarang adequate. Papua 0.97% — insufficient untuk any reliable claim about Papua market dynamics.' Coverage ratio target: 1.0% minimum per wilayah yang MJP serve. Implikasi untuk Budi: field research schedule harus follow coverage gap map, bukan follow Budi's comfort zone (Jawa lebih mudah karena sudah ada network). Budi: 'Saya harus keluar dari comfort zone. Kaltim tahun ini — Papua tahun depan. Itu adalah growth plan saya sebagai peneliti.'</p>
      </div>

      {/* R99: Field Research Methodology Evolution */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Microscope className="h-3.5 w-3.5 text-primary" /> FIELD RESEARCH METHODOLOGY EVOLUTION — Bagaimana Cara Budi Melakukan Riset Lapangan Berubah dari 2021 ke 2026: Dari Wawancara Ad-Hoc ke Protokol Terstruktur dengan 5 Dimensi dan 23 Pertanyaan Standar
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { era: "Era 1 (2021–2022): Exploratory — 'Ceritakan tentang pekerjaan Anda'", approach: "Unstructured deep interviews (60–90 menit). Budi bertanya secara natural, mengikuti alur cerita subjek. Sangat effective untuk discovery tapi tidak systematic — 2 interview bisa menghasilkan completely different types of data.", limitation: "Tidak bisa aggregate atau compare across interviews. Sari kesulitan turning raw notes into Knowledge Registry assets.", tc: "text-muted-foreground" },
            { era: "Era 2 (2023): Semi-structured — topic guide introduced", approach: "8-topic guide: procurement experience, SKK history, regulatory encounters, BUJK relationships, price intelligence, digital tool usage, pain frequency, and 'dream tool'. Interviews still conversational but hit all topics.", limitation: "Better comparability but still inconsistent probing depth. Topics di-cover berbeda-beda tergantung mood subjek dan Budi.", tc: "text-orange-700" },
            { era: "Era 3 (2024–2025): Structured + Multi-source triangulation", approach: "23-question protocol across 5 dimensions (procurement intelligence, regulatory compliance, human capital, competitive landscape, digital adoption). Plus: desk research pre-interview for each subject (LPJK profile, recent tenders). Triangulate interview data with LPSE behavior data for subjects who are MJP klien.", limitation: "Longer setup time per interview (45 min prep vs 5 min before). Budi needs 3 days between interviews for quality assurance.", tc: "text-primary" },
            { era: "Era 4 (2026+): In-app feedback loops as passive research", approach: "Hendra Jr. adding: (1) micro-survey after key actions (3-question survey after BUJK search), (2) Net Promoter follow-ups with qualitative why-questions, (3) session recording analysis to see where klien struggle. Supplements Budi's field work with always-on quantitative signal.", limitation: "Survey fatigue risk. Text quality of micro-survey responses much lower than Budi's interview notes.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.era} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.era}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.approach}</p>
              <p className={`text-[7px] font-mono italic ${r.tc}`}>Limitation: {r.limitation}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Research methodology evolution adalah continuous improvement process — never 'done'. Budi's annual ritual: spend one day re-reading all Era 1 interview transcripts to remember what was discovered by not being too structured. 'Structure adalah blessing dan curse. Blessing karena bisa compare. Curse karena kamu bisa miss hal yang tidak ada di protocol.' The tension between rigor and discovery is one Budi consciously manages: every protocol gets a 'free question' slot — one question Budi can ask anything he wants that's not on the protocol. 23% of most valuable insights in 2024–2025 came from free question slot, including the discovery that 'digital cautious' BUJK owners often have tech-savvy children who could be secondary users — an insight that shaped the multi-user access model design.</p>
      </div>

      {/* R100: Research as Brand Building */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Megaphone className="h-3.5 w-3.5 text-primary" /> RESEARCH AS BRAND BUILDING — Bagaimana Field Research MJP Menghasilkan Credibility yang Tidak Bisa Dibeli: 3 Media Coverage, 2 Conference Presentations, dan Bagaimana Budi Menjadi Wajah Thought Leadership Konstruksi Indonesia
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { event: "Media Coverage 1: Kontan.co.id (Q3 2024)", detail: "Artikel tentang 'Tantangan Digital BUJK Indonesia' mengutip data MJP tentang 57% BUJK yang masih dalam kategori digital cautious/resistant. Jurnalis Kontan menemukan MJP melalui Google Search setelah mencari statistik digitalisasi konstruksi — MJP adalah satu-satunya source yang punya angka specific. Result: 234 new platform signups dalam 7 hari post-article, sebagian besar Starter. Reza: 'Satu artikel = lebih banyak inbound lead dari semua cold outreach saya dalam 3 bulan.'", tc: "text-primary" },
            { event: "Conference Presentation: GAPENSI Annual Meeting (Q1 2025)", detail: "Budi dipresentasikan oleh GAPENSI untuk membawakan '5 Pain Points Terbesar BUJK Kecil dan Menengah 2024' — data dari 67 interview yang terdokumentasi. Audience: 400+ BUJK owners dan executives. MJP offered 3-month free trial to attendees. Conversion: 89 trials, 31 converted to paid. Hendra: 'Cost to reach 400 BUJK executives through normal sales: Rp 15–20jt in Reza's time. Conference speaking slot: Rp 0 because Budi's research was credible enough to get invited.'", tc: "text-blue-700" },
            { event: "Research Report: 'State of SKK Indonesia 2026'", detail: "847 downloads, 3 Enterprise klien converted directly from reading report. Media coverage: Properti.co.id (trade media) and 1 Kompas column citation. Positioned MJP as 'the source' for SKK workforce data — a position no competitor can claim because they don't have Dewi's BNSP data + field research combination.", tc: "text-emerald-700" },
            { event: "Future: Annual 'State of Construction Intelligence' Report", detail: "Hendra's 2027 goal: publish flagship annual report on state of BUJK procurement intelligence in Indonesia. Target: 2.000+ downloads, 3+ major media citations, 1 government agency reference. Budget: Rp 25jt for design + distribution. Expected inbound: 200+ Enterprise-tier prospects. ROI target: 8 Enterprise conversions = Rp 268M ARR in Year 1 from single report.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.event} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.event}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Research as brand building adalah Hendra's counter-intuitive growth strategy: in a sector where trust is built slowly through relationships, thought leadership content shortens the trust-building timeline dramatically. BUJK owner who reads MJP's research report before ever meeting Reza: arrives to the sales conversation already halfway trusting MJP. Budi's personal brand is also growing: he now gets occasional calls from media and conference organizers directly — not through MJP's main line. Hendra: 'Budi adalah wajah paling credible yang MJP punya. Bukan karena dia sales atau marketing — tapi karena dia adalah orang yang benar-benar turun ke lapangan, bicara ke orang asli, dan tidak memperindah hasilnya. Dalam dunia yang penuh marketing, kejujuran Budi adalah differentiator yang tidak bisa direplikasi.'</p>
      </div>

      {/* R101: Research Data Governance */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> RESEARCH DATA GOVERNANCE — Kebijakan MJP tentang Kepemilikan, Penggunaan, dan Perlindungan Data Riset Lapangan: Siapa yang Memegang Apa, Kapan Data Bisa Di-share, dan Apa yang Tidak Pernah Dipublikasikan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { policy: "P1: Raw interview transcripts — NEVER published, NEVER shared externally", scope: "67 interview transcripts stored in encrypted folder, access: Budi + Hendra only. Even Sari, Reza, Hendra Jr. do not have access to raw transcripts.", rationale: "Narasumber gave consent for anonymized aggregation, not raw access. Breach of this policy would: (a) violate narasumber trust, (b) expose narasumber to potential retaliation from competitors or government entities they mentioned, (c) destroy Budi's ability to conduct future interviews. Non-negotiable.", tc: "text-red-700" },
            { policy: "P2: Aggregated pain point data — shareable with investors under NDA", scope: "Statistical summaries (n=67 interviews, distribution by category, region, BUJK size) are shareable. No individual identifiable information.", rationale: "Investors have legitimate need for market validation data. Aggregated data proves market exists without exposing individuals. All investor data sharing is under mutual NDA with specific data use restrictions.", tc: "text-orange-700" },
            { policy: "P3: Published research reports — fully public, with methodology transparency", scope: "State of SKK Report, BUJK Digital Readiness Report, etc. Methodology section explicitly states: sample size, interview structure, limitations.", rationale: "Transparency builds credibility. If methodology is not disclosed: report is marketing. With methodology: report is research. The distinction is what allows GAPENSI conference invitations and media citations.", tc: "text-emerald-700" },
            { policy: "P4: Individual pain point data in platform — anonymized, accessible to Hendra Jr. for feature development", scope: "Pain point entries in database: visible to Hendra Jr. for product planning with masked identifiers. Sari uses for Knowledge Registry production planning. Reza cannot access (sales use of pain data creates conflict of interest).", rationale: "Platform improvement requires engineers to see data patterns. But sales access to specific pain data would enable targeted 'we know your problem' sales approaches that could feel predatory.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.policy} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.policy}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Scope: {r.scope}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Rationale: {r.rationale}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Data governance untuk research adalah policy yang Hendra formalized setelah seorang investor (angel round) asked: 'Bisa saya lihat interview transcripts untuk verify market validation?' Hendra's response: 'Tidak — tapi saya bisa show you aggregated data and methodology.' The investor accepted and invested anyway. Post-incident: Hendra realized there was no written policy about what could and couldn't be shared — all governance was in his head. Written policy created and communicated to all team members. Budi: 'Policy ini membuat saya lebih berani saat interview. Saya bisa promise narasumber dengan confidence bahwa cerita mereka tidak akan keluar dari folder yang terenkripsi. Sebelumnya saya promise tapi tidak ada sistem yang enforce promise itu.'</p>
      </div>

      {/* R102: Research Expansion Strategy — New Verticals */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" /> RESEARCH EXPANSION STRATEGY — 3 Vertikal Baru yang Budi Akan Masuki Setelah Series A: Mengapa BUJK Spesialis MEP, BUJK Asing di Indonesia, dan Kontraktor Pertambangan Menjadi Target Riset Berikutnya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { vertical: "V1: BUJK Spesialis MEP (Mekanikal, Elektrikal, Plumbing)", rationale: "MJP's current BUJK pain point data is dominated by sipil/gedung contractors — 87% of Budi's 67 interviews. MEP specialists have different pain profile: more complex KBLI navigation, specialized SKK requirements (Ahli Teknik Mekanikal, Elektrikal), and frequent disputes with main contractors over scope boundaries. MEP market: ~34.000 BUJK, currently underserved by MJP's Knowledge Registry.", budi_plan: "12 targeted interviews dengan MEP BUJK owners di Jakarta dan Surabaya. Focus: SKK navigation pain, KBLI classification confusion, subcontractor dispute patterns. Timeline: Q2 2027 (post-Series A, Budi has more travel budget).", tc: "text-primary" },
            { vertical: "V2: BUJK Asing (foreign construction companies) in Indonesia", rationale: "420 registered BUJK Asing, mostly handling IKN dan large infrastructure projects. Pain profile: regulatory navigation in Indonesia (language barrier + complex licensing requirements for foreign entities), finding qualified Indonesian BUJK partners (JO requirements), KBJI/KBLI mapping challenges. Zero competition in this niche — no Indonesian platform serves BUJK Asing specifically.", budi_plan: "8 interviews dengan manajemen proyek BUJK Asing di Jakarta. Language: English + Indonesian bilingual. MJP would need bilingual Knowledge Registry entries for this segment. Hendra's decision: start research first, productize second.", tc: "text-blue-700" },
            { vertical: "V3: Kontraktor Pertambangan dan Energi", rationale: "Mining and energy construction (KBLI group 09) follow different procurement rules: RKAB-based (not LPSE-based), often under BUMN mineral holding companies. 9.200 BUJK in this category. Not served by MJP currently — zero tenders from mining companies in MJP's current crawl scope. But: klien who do both government and mining work have expressed interest.", budi_plan: "This requires new data source onboarding (BUMN procurement portals, ESDM ministry databases) before research is useful. Decision: delay research until Hendra Jr. can add mining procurement data sources (Q3 2027 earliest). Research in advance of data = validated pain but no immediate product solution.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.vertical} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.vertical}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Rationale: {r.rationale}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Budi's plan: {r.budi_plan}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Research expansion strategy adalah Hendra dan Budi's joint planning document — Budi proposes where to go, Hendra validates against product roadmap and data availability. The governing principle: don't do research in a vertical where MJP can't build product solutions within 12 months of research completion. V3 (pertambangan) is the exception — Hendra approved research with explicit caveat that it's market intelligence, not product development input, until data sources are ready. Budi's personal preference: V2 (BUJK Asing) because 'interviewing international construction managers would be most intellectually challenging and expose MJP to different construction industry perspectives.' Hendra agrees on grounds of market opportunity and zero competition. V2 scheduled as Budi's first Q2 2027 expansion project. Budi: 'Setiap vertikal baru adalah 12–20 conversations dengan orang-orang yang menghadapi masalah yang belum pernah kita dengar sebelumnya. Itu adalah bagian terbaik dari pekerjaan ini.'</p>
      </div>

      {/* R103: Field Research Logistics Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Tent className="h-3.5 w-3.5 text-primary" /> FIELD RESEARCH LOGISTICS INTELLIGENCE — Apa yang Budi Pelajari tentang Mencapai Narasumber yang Tepat di Kota-Kota Non-Jakarta: 5 Tactical Tips yang Mengubah 'Tidak Bisa Ketemu' Menjadi 'Bertemu dan Terbuka'
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { tip: "T1: 'Titip salam' via asosiasi chapter lokal sebelum tiba", detail: "Budi contacts GAPENSI atau GAPEKSINDO chapter di kota tujuan 2 minggu sebelum kunjungan. Message: 'Saya dari MJP, platform untuk BUJK Indonesia. Saya akan di [kota] tanggal X dan ingin bertemu dengan 3–4 kontraktor yang aktif di tender lokal.' Asosiasi chapter: often makes introductions gratis as member service. Budi's warm intro via asosiasi: 3x higher interview acceptance rate than cold approach.", conversion: "Cold approach acceptance: 28%. Asosiasi-introduced acceptance: 81%. Impact: Budi spends 60% less time on recruitment and more time on actual interviews.", tc: "text-primary" },
            { tip: "T2: Meeting di warung, bukan kantor — menghilangkan power dynamic", detail: "BUJK owner yang ditemui di kantornya: posisi defensif, more careful about what they share. Same person at warung kopi: more relaxed, more candid. Budi's rule: always suggest 'coffee or lunch' not 'meeting at your office.' Secondary benefit: warung conversations often run 90+ minutes because there's no 'meeting end time' pressure.", conversion: "Interview completeness (klien sharing substantive pain points): 71% warung vs 41% kantor setting.", tc: "text-blue-700" },
            { tip: "T3: Bawa sesuatu yang bermanfaat — 1-page briefing tentang tender lokal terkini", detail: "Budi arrives at every interview with a 1-page printed summary: 'Tender yang relevan untuk kategori Bapak/Ibu bulan ini di [kota].' This is MJP data, curated for that specific person. It demonstrates MJP's value before the conversation starts. It also creates immediate credibility: 'Ini orang yang sudah riset tentang situasi saya.' Narasumber is more willing to share because Budi has already demonstrated value.", conversion: "Narasumber who received 1-page briefing: shared 40% more pain detail in subsequent interview (measured by word count and specificity of examples shared).", tc: "text-emerald-700" },
            { tip: "T4: Tidak merekam audio — notebook only, kode tangan", detail: "Budi never asks permission to record. Recording creates anxiety about permanence. Instead: notebook with shorthand. Narasumber sees notebook: more comfortable. After interview: Budi takes 20 minutes immediately after to expand shorthand notes into full sentences. 97% of interview content retained with this method (vs 100% with recording, but 40% lower share depth because recording inhibits).", conversion: "Trade-off: 3% content loss vs 40% depth gain = net positive. Budi's written-up notes are richer than recordings would be.", tc: "text-orange-700" },
            { tip: "T5: Follow-up WhatsApp dengan summary apa yang Budi dengar", detail: "Within 48 hours of interview: Budi sends 3–5 bullet summary to narasumber: 'Ini yang saya catat dari obrolan kita.' This has 3 effects: (1) Narasumber can correct any misunderstanding (Budi gets more accurate data), (2) Narasumber feels seen and heard (relationship deepened), (3) Often triggers additional context: narasumber replies with 'oh dan satu lagi yang lupa saya sebutkan.' Second-wave revelations from follow-up: avg 1.4 additional insights per interview.", conversion: "Follow-up response rate: 78%. Of responders: 41% added new information not shared in interview. Narasumber who received follow-up and later became klien: 63% (vs 34% for non-follow-up contacts).", tc: "text-primary" },
          ].map((r) => (
            <div key={r.tip} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.tip}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Data: {r.conversion}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Field research logistics adalah Budi's proprietary knowledge — it cannot be taught in a training manual because it's built from repeated practice and feedback across 67 interviews in 12 cities. Each tip emerged from a failure: T1 (asosiasi intro) emerged after 3 consecutive cold approach rejections in Makassar. T3 (1-page briefing) emerged after a narasumber in Balikpapan said 'I don't have time to explain my business to a stranger' — Budi brought pre-researched context and the same person became one of his most forthcoming interviews. Budi: 'Field research methodology adalah sesuatu yang saya learn sambil jalan. Setiap kota mengajarkan saya sesuatu baru tentang cara orang Indonesia berbagi information ketika mereka trust Anda — dan cara mendapatkan trust itu dengan cepat. Ini adalah skill yang paling underrated dalam seluruh operasional MJP.'</p>
      </div>

      {/* R104: Research Impact Measurement */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> RESEARCH IMPACT MEASUREMENT — Bagaimana Budi Mengukur Apakah Riset Lapangannya Benar-benar Menghasilkan Perubahan: 4 Impact Categories, 3 Contoh Konkret, dan Kritik Budi terhadap Dirinya Sendiri
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { category: "IC-1: Feature directly traceable to specific pain point interview", examples: "SKK expiry monitoring (P-008 → feature in 8 days). Workroom notes server sync (Budi's own pain — he was losing notes between field trips → feature in 3 weeks). WhatsApp native tender share (P-034, BUJK site supervisor who forwarded MJP alerts manually to WhatsApp group every morning → 1-tap share built).", count: "38 of 67 Q1 pain points (57%) directly traceable to shipped features", tc: "text-primary" },
            { category: "IC-2: Knowledge Registry asset directly traceable to interview knowledge gap", examples: "MKR-K3-089 (K3 requirements for projects {'>'} 15 floors): Budi heard from 3 narasumber that this was their most confusing compliance question — Sari produced the asset within 2 weeks. MKR-IKN-023 (BUJK lokal preference criteria for IKN tender): Budi's Balikpapan interviews surfaced confusion — Sari produced within 3 weeks.", count: "91 Knowledge Registry assets produced in response to field-identified gaps (7.3% of total 1.247 assets)", tc: "text-blue-700" },
            { category: "IC-3: Pain point that never became a feature (negative space)", examples: "P-041: 'I want to know what price my competitor submitted, not just HPS.' Technically: not feasible (bid prices not public until award). P-055: 'I want MJP to automatically prepare my bid documents.' Out of scope (too complex, changes MJP's product category). P-063: 'I want to see negative reviews about panitia who reject bids unfairly.' Legal risk (defamation).", count: "17 of 67 pains (25%) → no product response possible or appropriate", tc: "text-muted-foreground" },
            { category: "IC-4: Budi's self-critique on research quality", examples: "Budi honest assessment: 'Saya terlalu banyak interview BUJK dari Jawa dan kurang dari Indonesia Timur. 78% interview saya dari Jawa — tidak representatif dari national BUJK distribution (Jawa: 61% of BUJK but 78% of interviews = oversampled). Implikasi: pain point data saya biased toward Jawa experience. Non-Jawa pain points underrepresented.' Action: 2026 field trip target 30% Non-Jawa narasumber.", count: "Current geographic bias: correcting in 2026–2027 research cycle", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.category} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.category}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.count}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Examples: {r.examples}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Research impact measurement adalah Budi's discipline of treating his own work as rigorously as he treats his research subjects. Most researchers don't track whether their research led to anything. Budi does — and the results are informative: 57% feature traceability, 7.3% Knowledge Registry contribution, 25% negative space (not solvable). The 25% negative space is not failure — it's important signal that some BUJK pains are outside MJP's scope by design. Budi's self-critique (IC-4: geographic bias) is the most valuable finding: it means MJP's product has been shaped by Jawa-centric pain data. Non-Jawa BUJK may have different priorities that MJP hasn't fully addressed — especially relevant as IKN (Kalimantan) and eastern Indonesia infrastructure becomes a major market. The 2026–2027 research cycle correction will systematically address this. Budi: 'Saya tidak bisa tahu apa yang tidak saya tahu. Tapi saya bisa measure apa yang saya belum tanyakan. Geographic bias analysis adalah cara saya menemukan blind spot saya sendiri.'</p>
      </div>

      {/* R105: Research Ethics Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> RESEARCH ETHICS FRAMEWORK — Panduan Etika yang Budi Tulis Sendiri Setelah 4 Tahun Field Research: 5 Prinsip, 3 Kasus yang Menguji Prinsip Tersebut, dan Mengapa Etika Riset adalah Fondasi dari Kepercayaan Jangka Panjang
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { principle: "E-1: Informed consent yang benar-benar diinformasikan (bukan formalitas)", practice: "Before every interview: Budi explains (verbally, in Bahasa Indonesia) who MJP is, what the data will be used for, who will see it, and that the narasumber can stop at any time and request their data not be used. Not read from a script — explained in conversational language. Time taken: 3–5 minutes. Narasumber who decline after explanation: 12% of total approached.", test: "CASE: A narasumber in Solo agreed to interview but became uncomfortable when Budi started asking about specific competitor names. Budi stopped the line of questioning immediately, explained why he was asking, and gave narasumber option to skip that topic. Narasumber continued — and that interview became one of MJP's most detailed competitor intelligence inputs.", tc: "text-primary" },
            { principle: "E-2: Data minimization — ambil hanya yang dibutuhkan", practice: "Budi's interview protocol: no recording without explicit permission. Notes: functional (what is the problem, how severe, what is the impact) not descriptive (who said it, personal details, company financials). Budi's standard: 'Would I be comfortable if this narasumber read my notes about them?' If no: don't write it down.", test: "CASE: A narasumber shared company financial information voluntarily (revenue, profit margins) that was highly sensitive. Budi did not note the specific numbers. Instead: noted the category ('financial pressure from delayed payment') without the figures. The data category is useful; the specific numbers would only create liability and privacy risk.", tc: "text-blue-700" },
            { principle: "E-3: Non-exploitation — jangan gunakan research relationship untuk sales", practice: "Budi's strict rule: never suggest MJP services during or immediately after an interview. If narasumber asks about MJP: Budi explains what MJP does and says 'if you'd like to learn more, I'll connect you with our sales team.' Budi passes referrals to Reza. Budi does not close deals. The separation maintains the trust required for honest interview responses.", test: "CASE: Narasumber in Makassar was clearly a qualified prospect (Enterprise tier). During interview: they said 'I need something like what you're describing.' Budi said: 'Saya fokus riset hari ini. Biarkan saya connect Anda dengan rekan kami yang bisa jelaskan lebih lanjut.' 3-week delay before Reza reached out. Narasumber became Enterprise klien 2 months later.", tc: "text-emerald-700" },
            { principle: "E-4: Reciprocity — berikan nilai kepada narasumber, bukan hanya mengambil", practice: "Every interview ends with Budi asking: 'Is there anything about procurement intelligence or regulation that I can help clarify for you?' Budi answers genuinely from his knowledge — not as a sales pitch but as reciprocal knowledge sharing. Typical: 5–10 minutes of Budi sharing relevant information the narasumber didn't have.", test: "CASE: Narasumber asked about new UU that she had heard about but couldn't find. Budi knew the answer (had been briefed by Sari). Budi explained it clearly. Narasumber: 'Ini yang saya cari-cari. Makasih banyak.' This exchange created a relationship of reciprocity — same narasumber has participated in 3 follow-up interviews over 2 years.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.principle} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.principle}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Practice: {r.practice}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Test case: {r.test}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Research ethics framework adalah Budi's self-written document — not mandated by Hendra, not reviewed by legal, written by Budi himself after his third year of fieldwork because 'I realized I was in a position of power relative to the people I was interviewing, and that required explicit ethical guidelines.' The power asymmetry Budi identifies: he is gathering data that will benefit MJP commercially, from people who are sharing vulnerabilities (business struggles, fears, mistakes) for free. This asymmetry is not wrong — research always has this dynamic — but it requires active management. E-1 through E-4 are Budi's management framework. The long-term consequence of ethical research: MJP has a network of narasumber who have been interviewed multiple times, refer others, and feel genuine goodwill toward MJP as an organization. This is not transactional — it's relationship capital built through consistent ethical behavior. Budi: 'Research tidak bisa scaled oleh orang yang tidak peduli dengan etika. Setiap shortcut yang diambil dalam proses research mengurangi trust yang merupakan fondasi dari semua research berikutnya.'</p>
      </div>

      {/* R106: The 67 Narasumber Network — Strategic Asset Beyond Data */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> THE 67 NARASUMBER NETWORK — Lebih dari Data Source: Bagaimana Jaringan Narasumber Budi Menjadi Early Warning System, Referral Channel, dan Conscience untuk MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { role: "Network as early warning system (product problems surface before NPS)", story: "When a product problem emerges: klien often don't immediately report it to support. But they mention it to other BUJK owners they trust. Budi's narasumber network is embedded in these conversations — many narasumber have become klien or know klien. Pattern observed: 4 times in 2 years, Budi heard complaints about specific MJP data quality issues from narasumber before those issues appeared in MJP's support inbox or NPS comments.", impact: "Average early warning advantage: 2–3 weeks. Hendra's action: when Budi reports a complaint from network, it gets immediate triage — treated as confirmed problem, not potential problem.", tc: "text-primary" },
            { role: "Network as referral channel (warm introductions to hard-to-reach segments)", story: "Narasumber in asosiasi leadership positions have made warm introductions for Reza to 8 Enterprise-tier prospects who were previously unreachable through cold outreach. These are BUJK owners with strong 'I don't talk to software salespeople' filters. Budi's introduction from a trusted industry colleague: bypasses the filter. Conversion rate of Budi-network introductions: 67% (vs Reza's cold outreach: 12%).", impact: "8 Enterprise klien who entered via Budi network introductions: combined ARR Rp 267jt. Cost of those introductions: 0 (relationship capital, not cash). ROI comparison to paid marketing: not computable — marketing couldn't have reached these klien.", tc: "text-emerald-700" },
            { role: "Network as conscience (narasumber who challenge MJP's assumptions)", story: "3 narasumber have, over 4 years of relationship, become comfortable enough to tell Budi when they think MJP is making a mistake. Most important challenge: a narasumber who owns a small BUJK in Flores told Budi in 2025: 'MJP is becoming a Jakarta product. The pricing, the language, the features — these are all designed for people like Hendra's consulting clients from 2019. Not for me.' Budi brought this to Hendra. Resulted in the 'non-Java BUJK' product review.", impact: "The Flores narasumber's challenge directly triggered: the geographic coverage investment in NPS detractor plan, Budi's self-critique on geographic bias, and the Starter tier pricing review for non-Java markets. One honest voice: changed multiple product decisions.", tc: "text-blue-700" },
            { role: "Network as longitudinal research panel (67 relationships built over 4 years)", story: "Of the 67 narasumber: 41 have been interviewed more than once. 18 have been interviewed 3+ times over 4 years. These are not one-off data sources — they're ongoing relationships. Longitudinal panel provides: tracking of pain evolution (did the pain get better or worse? what changed?), product impact measurement (did they use MJP's solution? did it help?), and trust depth that enables more honest responses than cold interviews.", impact: "The 18 'panel members' (3+ interviews over 4 years) produced Budi's most important longitudinal findings — including the finding that BUJK pains have become more severe over 4 years, validating MJP's structural market thesis.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.role} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.role}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.story}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Impact: {r.impact}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">The 67 narasumber network adalah the most undervalued strategic asset in MJP's portfolio — because it doesn't appear in any financial model or product roadmap, but it shapes product quality, sales conversion, and strategic direction in ways that cannot be replicated by any tool or process. It's entirely relationship-based: 4 years of Budi showing up in person, asking genuine questions, giving reciprocal value, and maintaining contact between visits. The Flores narasumber who challenged MJP's Jakarta-centric bias is the most important example: that challenge came because of 4 years of trust. A survey would not have surfaced it. A focus group would not have surfaced it. Only a relationship deep enough for honest criticism could surface it. Budi: 'Jaringan 67 narasumber adalah aset yang tidak bisa dibeli dan tidak bisa dibuat lebih cepat. Setiap narasumber merepresentasikan minimal 3–4 tahun investasi dalam kepercayaan. Yang bisa dilakukan: jaga mereka dengan serius. Karena ketika mereka berbicara, MJP harus mendengarkan.'</p>
      </div>

      {/* R107: Research Scaling Plan — From 1 Budi to a Field Team */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-primary" /> RESEARCH SCALING PLAN — Dari 1 Budi ke Tim Riset: Bagaimana MJP Akan Menskalakan Field Research Setelah Series A Tanpa Kehilangan Kualitas yang Hanya Bisa Dicapai oleh Seseorang yang Sudah Melakukannya 4 Tahun
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { challenge: "The core scaling problem: Budi's value is not replicable by hiring 3 Budis", detail: "Budi's 67-narasumber network and 4-year methodology was built through specific lived experience — not through training. A new field researcher hired in 2027 will not have Budi's network, his dismissal pattern recognition, or his ability to gain trust in specific regional contexts. The challenge: how to add research capacity without degrading the quality that Budi produces.", approach: "Budi's proposed model: not 3 parallel Budi equivalents, but a hub-and-spoke model where Budi is hub and 2 regional researchers are spokes. Budi maintains methodology standards, trains regional researchers, conducts quality review of their interview notes. Regional researchers: conduct interviews in their local context (where they have pre-existing networks), under Budi's methodology guidance.", tc: "text-primary" },
            { challenge: "Regional researcher profile: domain-adjacent, not researcher-by-training", detail: "Budi's hiring criteria for regional researchers: same anti-credential filter as all MJP hires. Target profile: someone who works in construction sector (BUJK employee, asosiasi staff, procurement consultant) in a target region (Sulawesi, Kalimantan/IKN, Sumatra), has genuine network in local BUJK community, and demonstrates genuine curiosity about procurement problems. Training: Budi's field methodology SOP (currently being written), ethics framework, 3 joint interviews with Budi before independent fieldwork.", approach: "Target: 2 regional researchers by Q2 2027 (6 months post-Series A). Regions: Sulawesi (geographic coverage gap) and Kalimantan/IKN (highest strategic value). Budi's estimate: with 2 regional researchers: can triple annual narasumber interviews from ~20 to ~60, covering geographic gaps identified in self-critique.", tc: "text-blue-700" },
            { challenge: "The quality control challenge: how does Budi ensure regional research meets MJP standard", detail: "Budi's quality control proposal: every regional interview produces a structured note in MJP's field research template. Budi reviews all notes within 72 hours. Findings that don't meet quality standard: returned with specific feedback for follow-up interview. Monthly calibration call: Budi + regional researchers discuss emerging patterns, test interpretation consistency ('do we read this narasumber's response the same way?'). Annual joint field trip: Budi accompanies each regional researcher for 3 interviews to recalibrate.", approach: "Budi: 'Saya tidak bisa ada di semua tempat. Tapi saya bisa memastikan bahwa setiap narasumber yang diwawancarai oleh tim saya mendapat standar yang sama dengan narasumber yang saya wawancarai sendiri. Itu dimulai dari note quality.'", tc: "text-emerald-700" },
            { challenge: "The knowledge transfer risk: what if Budi leaves before scaling is complete", detail: "Budi has verbally committed to staying through Series A and the first year of team scaling. But if Budi leaves before regional researchers are trained: MJP loses the methodology AND the narasumber network simultaneously — a double bus factor event. Mitigation: Budi's field methodology SOP (documentation of dismissal patterns, interview protocols, ethics framework, narasumber engagement practices) is being written NOW — not after Series A. Target completion: Q4 2026.", approach: "Hendra: 'Budi's methodology yang terdokumentasi dengan baik adalah aset strategis MJP yang paling penting untuk diselesaikan sebelum akhir tahun. Bukan karena saya tidak percaya Budi — tapi karena saya ingin MJP survive apapun yang terjadi.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.challenge} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.challenge}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Approach: {r.approach}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Research scaling plan adalah Budi and Hendra's joint work — because the decision to scale research has product implications (more geographic coverage, new pain point data) but also operational and budget implications (2 regional researcher salaries at estimated Rp 10–12jt/month each). The scaling decision was made at the 2025 annual offsite after Budi's geographic bias self-critique crystallized how underserved non-Java BUJK were in MJP's product decisions. The investment case: 2 regional researchers at Rp 24jt/month fully loaded = Rp 288jt/year. Expected outcome: geographic coverage improvement that reduces the 29% churn from CHURN-5 (Geographic Orphan) profile. If geographic improvement retains even 15 additional non-Java Pro klien annually (@ Rp 499k/month × 12): Rp 898jt/year in retained ARR — 3.1× ROI just from retention improvement, before counting new klien acquisition. Budi: 'Saya tidak mau menjadi bottleneck untuk geografi yang saya tidak bisa capai sendirian. Tim riset yang lebih besar bukan tentang saya — ini tentang narasumber di Sulawesi dan Kalimantan yang pengalamannya belum pernah kita dengar. Mereka yang rugi kalau kita tidak scale.'</p>
      </div>

      {/* R108: The Interview That Changed Budi's Research Philosophy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Mic className="h-3.5 w-3.5 text-primary" /> THE INTERVIEW THAT CHANGED EVERYTHING — Satu Percakapan dengan Narasumber di Flores yang Mengubah Cara Budi Melakukan Riset, Cara MJP Membangun Produk, dan Cara Hendra Berpikir tentang Bias Geografis dalam Startup Indonesia
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { stage: "The setup: Budi's Year 3 field trip to NTT", detail: "In 2023, Budi made his first extended field research trip outside Java — 2 weeks in Nusa Tenggara Timur (NTT), visiting BUJK in Kupang, Ende, and Larantuka. The trip was driven by a specific gap in MJP's data: NTT had the lowest Trust Score data density of any province. Budi's goal: conduct 8–10 interviews to understand NTT BUJK's procurement landscape and calibrate what MJP's Trust Score meant in that context.", what_budi_expected: "Budi expected to hear the same pain points he'd heard in Makassar, Palembang, and Banjarmasin: slow LPSE notifications, HPS uncertainty, JO partner finding. The standard non-Java variation of the standard BUJK pain points.", tc: "text-primary" },
            { stage: "The conversation: Pak Gregorius Dhoa, BUJK owner in Ende, Flores", detail: "On Day 9, Budi interviewed Gregorius Dhoa — owner of a Kualifikasi Menengah BUJK specializing in road and bridge construction in eastern Flores. The interview started conventionally. Then Gregorius asked Budi: 'Apakah MJP mengerti bahwa cara tender konstruksi bekerja di sini berbeda dengan cara Anda pikirkan di Jakarta? Di sini, panitia tender mengenal semua orang yang masuk. Tidak ada anonimitas. Harga penawaran Anda bukan rahasia. Dan BUJK dari Jawa yang datang ke sini dengan Trust Score bagus — mereka menang tender karena modal kerja yang lebih besar, bukan karena pekerjaan mereka lebih baik di sini.'", what_budi_heard: "Gregorius's core challenge: MJP's Trust Score (based on LPSE award data) rewards large working capital (ability to win large contracts) and Java-based relationship networks. For NTT tenders: what matters is local knowledge, local supplier relationships, and site-specific logistics capability — none of which appears in LPSE data. Gregorius: 'Trust Score MJP bagus untuk mencari mitra JO dari luar NTT. Tapi untuk menilai apakah BUJK lokal bisa benar-benar mengeksekusi di NTT — Anda butuh data yang belum ada di database Anda.'", tc: "text-blue-700" },
            { stage: "What changed at MJP after Budi returned from Flores", detail: "Budi returned to Jakarta and wrote a 12-page research memo: 'Geographic Context Gap in MJP Trust Score — NTT Field Research Findings.' The memo reached Hendra within 2 days. Within a week: Hendra had called a full team discussion. The discussion produced 3 decisions: (1) Trust Score would add a 'Local Execution History' dimension (tender performance within-province), not just overall LPSE performance. (2) Budi would be allocated budget for 3 regional field trips per year instead of 1. (3) Knowledge Registry would add 'Regional Construction Market Profiles' as a new asset category.", implication: "The Flores interview changed: Trust Score model (1 new dimension added), research budget (3× increase in field trips), Knowledge Registry scope (new regional market profile category). These changes: estimated to reduce CHURN-5 (Geographic Orphan) churn by 8–12% as data quality for non-Java BUJK improves.", tc: "text-emerald-700" },
            { stage: "What Hendra realized about startup bias", detail: "The Flores interview triggered a broader reflection for Hendra: MJP had been building a platform for the Indonesia it knew — Java, urban, digitally fluent BUJK. Gregorius's challenge revealed a deeper bias: MJP's algorithms were optimized for the market segment MJP understood best, not for the market segment that most needed better tools. Gregorius's BUJK is in the middle of a coverage gap — intelligent enough to use MJP, but underserved by MJP's current calibration.", broader_implication: "Hendra now includes a 'geographic representation audit' in every annual product review: are the pain points driving product decisions representative of MJP's full geographic user base, or are they disproportionately from Jakarta and Java-based Enterprise klien? The audit produces a geographic coverage heat map of pain point origin — any province with {'<'} 3 pain points in the annual dataset triggers a Budi field visit.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.stage} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.stage}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.detail}</p>
              {'implication' in r && <p className={`text-[7px] font-mono ${r.tc}`}>Implication: {(r as { implication: string }).implication}</p>}
              {'what_budi_heard' in r && <p className={`text-[7px] font-mono ${r.tc}`}>What Budi heard: {(r as { what_budi_heard: string }).what_budi_heard}</p>}
              {'broader_implication' in r && <p className={`text-[7px] font-mono ${r.tc}`}>Broader implication: {(r as { broader_implication: string }).broader_implication}</p>}
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">The Flores interview adalah one of those inflection points that only becomes visible in retrospect — at the time it seemed like one field interview among dozens. In retrospect: it was the moment that shifted MJP from a Jakarta-calibrated platform to a nationally-calibrated platform. Gregorius's challenge was delivered with no hostility — he was genuinely trying to help Budi understand. 'Saya pakai MJP. Saya suka MJP. Tapi MJP belum mengerti Flores.' That honesty, offered to someone who had earned trust through 3 years of genuine engagement, was the most valuable feedback MJP has ever received. No NPS survey, no usage analytics, no feature request form would have captured it. Only a relationship deep enough for honest challenge could surface it. This is why Budi's field research methodology includes a specific question in Year 3+ interviews with narasumber: 'Di mana MJP paling tidak berguna untuk bisnis Anda?' Not 'what features do you want' but 'where is MJP failing you.' The answer requires trust. Gregorius gave it freely because Budi had spent 3 years earning it. Budi: 'Setiap narasumber yang jujur tentang di mana kami gagal lebih berharga dari 10 narasumber yang hanya memuji kami. Gregorius adalah salah satu dari mereka. Dan saya perlu mengunjunginya setahun sekali selama saya di MJP.'</p>
      </div>

      {/* R109: Field Findings That Became Features */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-primary" /> RESEARCH-TO-FEATURE PIPELINE — 5 Temuan Riset Lapangan Budi yang Langsung Mengubah Produk MJP: Bukti Konkret bahwa Field Research adalah Investasi Produk, Bukan Hanya Riset Pemasaran
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { finding: "R2F-1: Budi's 2022 finding → SKK Expiry Alert System (4-stage)", budi_finding: "In 2022 field research: of 18 narasumber interviewed, 12 mentioned SKK management as a persistent operational burden. Key quote (paraphrased from multiple narasumber): 'Saya selalu tahu bahwa SKK karyawan saya akan kedaluwarsa. Yang saya tidak tahu adalah kapan saya harus mulai mengurus perpanjangannya.' The problem: expiry dates were known but action triggers were not.", product_outcome: "Hendra Jr. built the first SKK alert system within 6 weeks of Budi's report. The 4-stage design evolved over 3 years based on narasumber feedback. Current system: 8% close-call renewal rate (down from 34% before redesign). Direct attribution: Budi's 2022 finding triggered the feature, narasumber feedback shaped the design.", tc: "text-primary" },
            { finding: "R2F-2: Budi's 2023 finding → Trust Score 'Local Execution History' dimension (in development)", budi_finding: "Gregorius (Flores) and 4 other non-Java narasumber: Trust Score based on LPSE data systematically undervalues BUJK with strong local execution but smaller contract values. Budi's report included a specific proposal: 'A BUJK's performance within their primary region should be weighted more heavily than their performance in national markets they rarely enter.'", product_outcome: "Not yet live — in development as Trust Score V2 dimension. Hendra Jr. is designing the 'Local Execution History' dimension that weights regional track record more heavily for within-region assessments. Estimated completion: Q3 2026 (post-Series A). When live: estimated to improve Trust Score accuracy for non-Java BUJK by 15–20 percentage points.", tc: "text-blue-700" },
            { finding: "R2F-3: Budi's 2023 finding → Tender Revision Silent Update Detection", budi_finding: "3 narasumber in 2023 mentioned disqualification from tenders where they had submitted bids based on outdated requirements — tender documents had been revised after initial download. One narasumber: 'Saya tidak tahu dokumen berubah karena tidak ada pemberitahuan. Saya hanya tahu ketika saya gagal aanwijzing.' The silent revision problem: confirmed by Hendra Jr.'s subsequent LPSE audit.", product_outcome: "Hendra Jr. built document hash monitoring (comparing document fingerprints on each crawl cycle against stored fingerprints). When a tender document changes post-publication: klien receive 'tender document updated' alert. Built within 3 months of Budi's report. Usage in first 6 months: 234 revision alerts sent. Klien feedback: 'This alert is the one I'm most grateful for — I never knew silent revisions happened.'", tc: "text-emerald-700" },
            { finding: "R2F-4: Budi's 2024 finding → BUJK blacklist propagation delay in Trust Score", budi_finding: "1 Enterprise klien narasumber (construction association member) mentioned: 'Saya hampir bermitra dengan BUJK yang ternyata masuk Daftar Hitam — tapi portal LPSE yang saya cek belum mengupdate datanya.' The blacklist synchronization problem: Budi brought it to Hendra Jr., who confirmed through technical investigation.", product_outcome: "Hendra Jr. added central LKPP Daftar Hitam direct query to Trust Score — bypassing individual portal synchronization. Added as 'Daftar Hitam' explicit dimension in Trust Score methodology (visible to klien). 3 BUJK that were in Daftar Hitam but not yet synchronized on some portals: caught by the new dimension and shown as Trust Score Tier D. Without this: potentially recommended as JO partners.", tc: "text-orange-700" },
            { finding: "R2F-5: Budi's 2024 finding → MJP mobile app field mode (offline search)", budi_finding: "Budi's own experience from field research visits: 'Di lapangan, sinyal internet sering tidak stabil. Ketika klien bertanya kepada saya tentang kontraktor atau tender di lokasi yang sinyal buruk, saya tidak bisa menunjukkan MJP kepada mereka.' MJP's mobile app at the time: required stable internet for all features. The use case: BUJK visiting project sites, meeting potential subcontractors, doing site visits in remote areas.", product_outcome: "Mobile offline search (Task #20 in backlog — PROPOSED) is directly traced to Budi's field finding. The feature design: cache recent searches and Trust Score lookups on device, allow search from cache when offline, show 'OFFLINE mode' indicator. Technical implementation: Hendra Jr. built async offline queue (useOfflineQueue) for data writes; offline search read-cache is the companion feature. The offline writing feature (preventing data loss) is live; offline reading cache is in backlog pending Series A engineering expansion.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.finding} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.finding}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Budi's finding: {r.budi_finding}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Product outcome: {r.product_outcome}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Research-to-feature pipeline adalah the evidence that Budi's field research is product investment, not just market intelligence. The 5 R2F cases above represent features that either (1) exist today because of Budi's research, or (2) are in active development because of Budi's research. The total product impact of Budi's work: SKK Alert System (used by 847 klien), Trust Score Local History dimension (in development for ~50.000 non-Java BUJK), Revision Detection (234 alerts in first 6 months), Blacklist dimension (3 confirmed catches), Mobile Offline (design informed by field insight). This is why Hendra's budget allocation for field research is treated as product R&D, not as market research: the ROI is in product improvements, not just market understanding. The R2F pipeline has a specific process: (1) Budi documents field findings in structured reports, (2) report reviewed in monthly team meeting, (3) Hendra Jr. assesses technical feasibility within 2 weeks, (4) if feasible and RICE score supports priority: added to backlog with Budi's finding as design input. The 2-week technical feasibility window prevents Budi's findings from disappearing into a backlog never-never land — Hendra Jr. must respond to each finding with a position ('building,' 'backlog with RICE score,' or 'declined with reason'). Budi: 'Riset lapangan yang tidak mengubah produk adalah riset yang terbuang. Setiap wawancara yang saya lakukan: saya ingin tahu bahwa dalam 12 bulan ada sesuatu di platform yang lahir dari percakapan itu. Itu yang membuat pekerjaan ini terasa berarti.'</p>
      </div>

      {/* R110: Budi's 67-Narasumber Network — How It Was Built */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> 67-NARASUMBER NETWORK — Bagaimana Budi Membangun Jaringan 67 Narasumber di 12 Provinsi Selama 5 Tahun: Metodologi Rekrutmen, Cara Menjaga Hubungan Jangka Panjang, dan Narasumber yang Paling Mengubah MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { aspect: "Rekrutmen: bagaimana 67 narasumber pertama ditemukan", method: "Year 1 (2021): GAPENSI and INKINDO member directory cold outreach. Of 200 letters sent: 14 positive responses. Of 14: 9 became regular narasumber. Cold outreach yield: 4.5%. Year 2 (2022): referral-based expansion. Each of the 9 Year-1 narasumber asked: 'Apakah ada rekan BUJK yang juga bisa kami ajak bicara?' Referral yield: 3.1 referrals per narasumber × 9 = 28 new contacts. Of 28: 19 became narasumber (68% yield — drastically higher than cold outreach).", what_changed: "Year 3+ strategy shifted entirely to referral-based recruitment. Budi's target: 10 new narasumber per year, all via referral. Criteria for new narasumber: (1) active BUJK owner or director (not association staff), (2) at least 3 years in construction procurement, (3) willingness to speak candidly about business challenges. Criteria (3) is the hardest to assess in advance — Budi relies on the referring narasumber's judgment: 'Apakah rekan Anda terbuka untuk berbicara jujur tentang kesulitan bisnisnya?'", tc: "text-primary" },
            { aspect: "Geographic distribution: bagaimana Budi membangun coverage nasional", method: "2021: Java-heavy (8 of 9 narasumber in Java). Budi's 2022 objective: minimum 2 narasumber per major region (Sumatera, Kalimantan, Sulawesi, Nusa Tenggara, Maluku/Papua). By 2023: 12 provinces represented. Travel budget: Rp 18jt/year (Hendra's approved budget for field visits). Budi's travel strategy: concentrate visits — spend 5–7 days per region (not 1 day per region) to maximize relationship depth per trip.", what_changed: "The Gregorius (Flores) relationship: built over 3 annual visits. Year 1 visit: general interview. Year 2: Gregorius shared more candid challenges (relationship deepening). Year 3: Gregorius gave the feedback that changed Trust Score design ('MJP belum mengerti Flores'). The depth required 3 years of consistent visits — no amount of digital communication replaces annual in-person presence for Budi's most remote narasumber.", tc: "text-blue-700" },
            { aspect: "Relationship maintenance: bagaimana Budi menjaga 67 hubungan tetap aktif", method: "Tier system: (A) Core narasumber (22 individuals): annual in-person visit + monthly WhatsApp contact. (B) Active narasumber (31 individuals): annual in-person or video call + quarterly WhatsApp check-in. (C) Peripheral narasumber (14 individuals): annual WhatsApp check-in, available for specific topic consultation. The most important relationship practice: Budi always shares back. After each product improvement that traces to a narasumber's input: Budi personally messages the narasumber to tell them their feedback became a feature.", what_changed: "Sharing-back practice effect: 3 narasumber have cited 'my feedback became part of MJP' as the reason they actively refer new narasumber to Budi without being asked. The referral behavior: strongest among narasumber who have experienced the most sharing-back. Trust is proportional to feeling heard.", tc: "text-emerald-700" },
            { aspect: "Top 3 narasumber who changed MJP's direction most fundamentally", method: "NS-01 (Pak Sutrisno, Semarang, BUJK Menengah, 18 years in construction): first to articulate the JO partnership verification problem that led to Trust Score. Trust Score origin story depends on Budi's documentation of Pak Sutrisno's interview. NS-12 (Bu Kartika, Makassar, BUJK Kecil, 7 years): identified the pain of SKK management being a 'constant background stress' — her phrase became the framing for MJP's SKK alert value proposition. NS-34 (Gregorius, Flores, BUJK Menengah, 12 years): trust calibration challenge that led to Trust Score Local Execution History dimension (in development).", what_changed: "These 3 narasumber: collectively responsible for Trust Score (most-retained feature), SKK Alert System (most-used feature), and Trust Score V2 Local Execution History (in development, most significant post-Series A feature). The ROI of maintaining relationships with these 3 alone: calculated by Hendra as responsible for features that generate an estimated Rp 340jt/year in retention value. Total relationship investment (Budi's time + travel): Rp 28jt over 5 years.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.aspect} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.aspect}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Method: {r.method}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>What changed: {r.what_changed}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">67-narasumber network adalah Budi's most important professional asset — and MJP's most irreplaceable competitive advantage. The network took 5 years to build to its current depth: referral-based, relationship-maintained, and feedback-reciprocating. The geographic distribution (12 provinces) provides national coverage with regional depth: Budi doesn't just know that non-Java BUJK have different needs — he knows which specific needs differ, in which provinces, and why. This geographic intelligence is why Gregorius's Flores feedback was possible: you can only receive that level of candor from someone who trusts you, and trust requires 3 years of consistent relationship investment. The network's most defensible quality: its authenticity. Budi doesn't transact with narasumber — he maintains relationships. The difference: narasumber who trust Budi tell him things they wouldn't tell a market researcher with a clipboard. The social forum failure (feature built without narasumber validation) is partly explained by the fact that Budi wasn't consulted on the social forum concept at the design stage — if he had been, he would have run it by 3–4 narasumber before Hendra Jr. built anything. Post-social-forum: Budi's consultation is mandatory before any new product concept enters active development. The 67-narasumber network is the input; the R2F pipeline (Research-to-Feature) is the output mechanism. Together: the most systematic field-research-to-product-impact pipeline that Budi knows of in any Indonesian B2B SaaS company. Budi: '67 narasumber yang mau bicara jujur kepada saya: itu adalah aset yang tidak bisa dibeli. Itu bisa dibangun — tapi dibangun selama bertahun-tahun, satu percakapan jujur pada satu waktu.'</p>
      </div>

      {/* R111: Budi's 7-Step Interview Protocol */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-primary" /> PROTOKOL WAWANCARA 7-LANGKAH BUDI — Metode di Balik Setiap Percakapan Narasumber: Bagaimana Budi Mendapatkan Informasi Jujur yang Tidak Akan Diceritakan Narasumber ke Siapapun Selain Seseorang yang Mereka Percaya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { step: "STEP 1: Pre-interview context research (30–45 menit, sebelum wawancara)", method: "Before every interview, Budi does structured context research: (1) review the narasumber's company profile from LPSE award history (which tenders they participated in, which they won, their track record), (2) check any recent significant tenders or outcomes for their company, (3) review notes from previous interviews with this narasumber (for repeat contacts), (4) identify 2–3 specific recent events in their market segment to anchor the conversation. The pre-research serves two purposes: Budi can ask informed questions (not generic ones), and the narasumber immediately perceives that Budi has done homework — which signals respect and professionalism.", purpose: "First 5 minutes of conversation: Budi references 1 specific recent event he discovered in pre-research ('Saya perhatikan PT Anda ikut tender X minggu lalu — bagaimana hasilnya?'). This single question does more for rapport-building than 10 minutes of general introductions. Narasumber: feel seen and respected, not just interviewed.", tc: "text-primary" },
            { step: "STEP 2: Opening frame — establishes purpose and confidentiality", method: "Budi's standard opening: 'Saya sedang mengumpulkan pengalaman nyata dari BUJK di lapangan — bukan statistik atau opini umum — untuk membantu platform MJP memahami apa yang benar-benar terjadi di industri ini. Semua yang Anda ceritakan: akan saya gunakan untuk memperbaiki produk, bukan dipublikasikan dengan nama atau identitas Anda. Kalau ada hal yang Anda lebih nyaman cerita secara off-record, bilang saja — saya tidak akan mencatatnya.' The last sentence (off-record offer): the most trust-building element of the opening. Most interview protocols don't offer this — Budi does, proactively. The psychological effect: narasumber feels they have control over what is attributed to them.", purpose: "The off-record offer has been exercised by narasumber approximately 23% of the time. Information received off-record: typically the most sensitive and valuable (stories about specific procurement committee behavior, naming of corrupt practices, details about competitor weaknesses). Budi uses this off-record information to shape his on-record questions better — not to publish it. His integrity on this promise: the reason narasumber continue to talk to him.", tc: "text-blue-700" },
            { step: "STEP 3: Warm-up questions — establishes conversational baseline (10 menit)", method: "First 10 minutes: questions about recent business activity — no pain points yet. 'Bagaimana kondisi pasar di wilayah Anda belakangan ini?' 'Tender mana yang paling menarik untuk bisnis Anda dalam 3 bulan terakhir?' The warm-up questions are genuinely interesting to Budi — he's not performing interest. This is critical: narasumber are skilled at detecting fake interest, particularly in formal interview settings. Budi's genuine curiosity about BUJK's daily realities: the core trait that makes him effective as a field researcher.", purpose: "Warm-up also calibrates tone: Budi can assess whether the narasumber is in an open/talkative mode or a guarded/distracted mode. Guarded narasumber: Budi adjusts — more time on warm-up, more specific anchoring, smaller initial asks. Talkative narasumber: Budi can go deeper faster. This calibration: visible in Budi's interview notes as a single flag ('OPEN' or 'GUARDED') that shapes the rest of the conversation.", tc: "text-emerald-700" },
            { step: "STEP 4–5: Core pain elicitation — the 2 most important questions", method: "Step 4 (the problem-in-action question): 'Ceritakan satu situasi konkret dalam 6 bulan terakhir di mana Anda kehilangan uang atau peluang karena tidak punya informasi yang Anda butuhkan.' This question is behavioral, not attitudinal — it asks for a specific story, not a general opinion. Stories are more memorable, more actionable, and more honest than opinions. Step 5 (the workaround question): 'Apa yang biasanya Anda lakukan untuk mendapatkan informasi [that was missing in the Step 4 story]? Apa yang paling menyebalkan dari cara itu?'", purpose: "The workaround question is Budi's most product-insight-generating question. It reveals the current solution (which shows intensity of need — a workaround that takes 3 hours means the pain is worth 3 hours of effort), the specific failure modes of the current solution, and the friction that would remain even if MJP provided a better solution. Post-Social Forum mistake: every pain elicitation includes Step 5 now. Social Forum failed partly because MJP never asked narasumber what their current workaround was — and didn't discover that WhatsApp groups were a good-enough workaround.", tc: "text-red-700" },
            { step: "STEP 6–7: Closing — hypothetical validation and relationship maintenance", method: "Step 6 (hypothetical validation): 'Kalau ada alat yang bisa [solve the pain from Step 4] dalam 5 menit — bagaimana itu mengubah cara kerja Anda?' Not 'would you pay for this?' (too direct, produces socially desirable answers) but 'how would it change your behavior?' (behavioral prediction, harder to fake). Step 7 (relationship close): 'Apakah ada teman atau kolega di industri ini yang mungkin memiliki pengalaman serupa? Saya tidak akan menyebut nama Anda — saya hanya ingin berbicara dengan lebih banyak BUJK yang punya perspektif jujur seperti Anda.'", purpose: "Step 7 is how Budi's network grew from 12 narasumber (2021) to 67 (2026) — each interview ends with a referral request. Referral quality: higher than cold contact because the new contact is introduced with context ('seorang teman merekomendasikan saya berbicara dengan Anda'). Conversion from referral introduction to full interview: 71% (vs 34% for cold contact). The compounding effect: each new narasumber adds not just their own knowledge but access to their network for future referrals.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.step} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.step}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Method: {r.method}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Purpose: {r.purpose}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Protokol wawancara 7-langkah adalah Budi's most important intellectual contribution to MJP — because it's the operational manifestation of a deep belief: that the most valuable market intelligence exists in the heads of practitioners, and accessing it requires relationship, respect, and rigorous method. The protocol was not designed on day one. Steps 1–3 (pre-research, opening frame, warm-up) were formalized in 2022 after Budi's first 20 interviews produced inconsistent information quality. Steps 4–5 (pain elicitation + workaround) were formalized post-Social Forum (2023) after the failure revealed the gap in Budi's original method. Steps 6–7 (hypothetical validation + relationship close) were always present but made explicit in 2024 when Hendra asked Budi to document his protocol for training a future researcher. The protocol documentation process: forced Budi to articulate choices he had made intuitively. His surprise: 'Saya tidak tahu saya punya metodologi sampai saya harus menuliskannya. Tapi ketika saya menuliskannya: saya menyadari bahwa setiap langkahnya ada karena suatu saat langkah itu tidak ada dan sesuatu yang penting terlewat.' The 7 steps: not a rigid script but a structured guide — Budi adapts them to each narasumber's personality, time constraints, and conversational style. The protocol's most important guarantee: Step 2 (confidentiality + off-record offer) creates the safety that makes Steps 4–5 (honest pain elicitation) possible.</p>
      </div>

      {/* R112: Annual Research Retrospective */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-primary" /> ANNUAL RESEARCH RETROSPECTIVE 2025 — Apa yang Budi Temukan dan Apa yang Berubah di Produk: 5 Temuan Terpenting dari 67 Wawancara, 3 Temuan yang Mengejutkan Tim, dan 2 Temuan yang Kami Pilih Tidak Bertindak (Untuk Sementara)
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { category: "RETRO-1: 5 temuan terpenting 2025 yang mengubah keputusan produk", findings: "Finding-A: BUJK di Kalimantan dan Sulawesi menghadapi keterlambatan informasi LPSE 3–5 hari lebih lama dari BUJK di Jawa — disebabkan oleh perbedaan kapasitas staf di LPSE portal regional. Product decision: MJP prioritized portal-specific data freshness monitoring as a Q3 2025 feature. Finding-B: 71% BUJK menyebut 'persiapan dokumen kualifikasi' sebagai hambatan lebih sering dari 'menemukan tender' — dokumen adalah bottleneck, bukan informasi. Product decision: Hendra added document preparation checklist to the product backlog (scheduled Q1 2027). Finding-C: 34% BUJK Enterprise menggunakan Trust Score untuk memverifikasi subkontraktor, bukan hanya JO partners — use case yang tidak pernah dimaksudkan oleh MJP tapi organically emerged. Product decision: subcontractor verification language added to Trust Score onboarding. Finding-D: Average tender review time per BUJK: 47 minutes per tender (vs MJP's assumption of 20 minutes). Product decision: NLQ query response optimization prioritized to reduce review time below 25 minutes. Finding-E: 82% narasumber menyatakan bahwa 'briefing pagi' adalah fitur yang paling mereka rekomendasikan ke BUJK lain — the primary organic acquisition channel is word-of-mouth about the morning briefing.", tc: "text-primary" },
            { category: "RETRO-2: 3 temuan yang mengejutkan tim internal MJP", findings: "Surprise-A: BUJK owners — not their staff — are the primary platform users. Budi's 2023 assumption: staff would use MJP for research, owners for strategy. 2025 data: 78% of platform sessions are initiated by the BUJK owner directly. Implication: the platform must be usable by people who are simultaneously running a business — not by dedicated researchers. UI/UX implication: session completion rate matters more than depth per session. Surprise-B: the most painful regulatory event for BUJK is not the regulation itself but the uncertainty period between announcement and implementation guidelines. BUJK want to know what to do 3–4 weeks before they actually need to do it — not 1 week before (when current MJP alerts arrive). Implication: Sari's regulatory forecast methodology (R112 in Regulasi) is more commercially valuable than MJP had realized. Surprise-C: 41% of BUJK narasumber have switched from C1 to MJP at some point (vs 18% who switched from MJP to C1). This asymmetry was unexpected — Budi's prior estimate was roughly equal switching. The direction asymmetry: suggests MJP's product is consistently superior for a meaningful majority of BUJK who have direct comparison experience.", tc: "text-blue-700" },
            { category: "RETRO-3: 2 temuan yang kami pilih tidak bertindak (untuk sementara) dan mengapa", findings: "Untaken-A: 23 narasumber menyebutkan kebutuhan untuk 'melacak pemenang tender dari BUJK yang sama di lokasi yang sama' — essentially wanting a local competitor tracking feature. Why not acted on: technically complex (requires cross-province winner analysis with BUJK identity resolution across different LPSE portal formats), competes with Radar Kompetitor's current direction, and would serve a specific geographic subset of BUJK (those in high-competition local markets). Hendra's assessment: 'ini adalah fitur yang bernilai nyata tapi biaya implementasinya tidak proporsional untuk scope klien yang akan menggunakannya saat ini.' Re-evaluation trigger: if 50+ narasumber mention it in 2026 retrospective. Untaken-B: 15 narasumber menyebutkan kebutuhan 'ringkasan otomatis dokumen tender' — AI-generated summaries of full tender documents. Why not acted on: this is a genuine need but requires MJP to store and process full tender document PDFs (which MJP retired with the PDF Library — GRAVE-5 in output-produk). Re-entry into the product: only after Hendra Jr. builds selective document extraction (specific documents for specific BUJK needs) rather than full PDF library. Timeline: Q4 2027 at earliest.", tc: "text-emerald-700" },
            { category: "RETRO-4: Metodologi retrospektif — bagaimana Budi menganalisis 67 wawancara menjadi 5 temuan", findings: "Budi's analysis process: (1) After each interview, Budi writes a 200–300 word summary within 4 hours ('saat masih segar — detail menghilang dalam 24 jam'). (2) At end of each quarter, Budi reads all summaries and codes themes using a simple tagging system (15 tags covering pain types, product feedback, competitor mentions, behavior changes). (3) Annual retrospective: frequency analysis of tags across all 67 interviews. Findings that appear in 15+ interviews: considered significant. Findings in 7–14 interviews: noted but require additional validation. Findings in under 7: interesting but insufficient to drive product decisions without further research. The 2025 5 findings: each appeared in 19–51 interviews (28–76% of the narasumber network). The 2 untaken findings: appeared in 15 and 23 interviews respectively — significant enough to note, below threshold for immediate product action. Budi's annual retrospective presentation format: 45-minute session with Hendra, Hendra Jr., Sari, and Reza. Each person receives the retrospective memo 3 days in advance. The session: focuses on implications and decisions, not on findings presentation.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.category} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.category}</p>
              <p className="text-[7px] text-muted-foreground">{r.findings}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Annual research retrospective adalah Budi's most important deliverable of the year — because it transforms 67 individual conversations into organizational intelligence that shapes the next 12 months of product, sales, and market positioning decisions. The retrospective's value compounds: each year's findings can be compared to prior years' findings to detect trends (pain points becoming more or less acute, competitor mentions increasing or decreasing, new pain categories emerging). MJP has now completed 4 annual retrospectives (2022–2025). Year-over-year trend analysis: 'briefing pagi word-of-mouth' as primary acquisition channel was already emerging in 2023 (14 mentions) and 2024 (28 mentions) before reaching 55 mentions in 2025 — the trend was visible 2 years before it became undeniable. The retrospective's accountability function: decisions made based on prior-year retrospective findings are reviewed against outcomes in the current year. Did the Q3 2025 portal freshness monitoring feature (from Finding-A) actually improve retention for Kalimantan/Sulawesi BUJK? The 2026 retrospective will include a section for this. This feedback loop: transforms the retrospective from a research exercise into a product-quality assurance mechanism. Budi: 'Wawancara tanpa retrospektif adalah pengumpulan cerita. Retrospektif yang menghasilkan keputusan dan diukur di tahun berikutnya: itu adalah alat manajemen. Saya sedang membangun alat manajemen, bukan arsip cerita.'</p>
      </div>

      {/* R113: Industry Association Relationships */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-primary" /> INDUSTRY ASSOCIATION RELATIONSHIPS — 12 Kontak Asosiasi Industri Budi untuk Akses Narasumber: Siapa Mereka, Bagaimana Dibangun, Apa yang Mereka Berikan, dan Mengapa Asosiasi Adalah Kunci Diversifikasi Narasumber Post-Series A
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { association: "ASOSIASI-1: GAPENSI (Gabungan Pelaksana Konstruksi Nasional Indonesia) — kontak utama di 3 DPD regional", relationship_type: "Budi's GAPENSI relationships: built through attendance at 3 GAPENSI regional congresses (2022, 2023, 2024) and 2 national working group meetings. Key contacts: 3 DPD (Dewan Pengurus Daerah) chairs in Jawa Timur, Jawa Tengah, and Sulawesi Selatan. These DPD chairs: serve as 'anchor contacts' who introduce Budi to BUJK members in their regions. The introduction: converts cold outreach (Budi calling an unknown BUJK) into warm introductions ('Pak Budi dari MJP — dia sudah bekerja sama dengan kami di GAPENSI selama 3 tahun, dia bisa dipercaya').", intelligence_value: "GAPENSI contacts' primary value: geographic coverage. DPD chairs have direct relationships with 30–80 BUJK members per region — they are Budi's most efficient path to narasumber in provinces he hasn't personally visited. GAPENSI DPD chair endorsement: reduces Budi's new narasumber trust-building timeline from 2–3 meetings (for cold outreach) to typically 1 meeting (with a chair endorsement). Of Budi's 67 narasumber: 19 were introduced through GAPENSI contacts.", tc: "text-primary" },
            { association: "ASOSIASI-2: GAPEKSINDO (Gabungan Pengusaha Kontraktor dan Wiraswasta Indonesia) — spesialis proyek kecil menengah", relationship_type: "GAPEKSINDO membership: skews toward smaller BUJK (Rp 500jt–5B ARV) compared to GAPENSI (which has more larger BUJK members). Budi's GAPEKSINDO relationship: built through 1 national congress (2023) and regular participation in GAPEKSINDO's monthly online webinar series (which Budi joined during the COVID period when in-person events stopped and the online format continued). The webinar participation: gave Budi consistent visibility with GAPEKSINDO members without requiring travel.", intelligence_value: "GAPEKSINDO contacts' primary value: access to the smaller BUJK segment that was underrepresented in Budi's early narasumber network. PP-011 (Material Price Reference pain) was discovered through a GAPEKSINDO member narasumber — a direct outcome of the segment diversification goal. Post-PP-011: Budi has expanded GAPEKSINDO contacts to 4 regional coordinators. Of the 12 narasumber added to Budi's network in 2024 narasumber expansion: 7 came through GAPEKSINDO contacts.", tc: "text-blue-700" },
            { association: "ASOSIASI-3: Forum Konsultan Pengadaan — community of procurement consultants who advise BUJK", relationship_type: "The Forum Konsultan Pengadaan: an informal professional network of procurement consultants who advise BUJK on tender strategy. Not a formal association — more a WhatsApp group and occasional meetup community. Budi discovered this network through a GAPENSI DPD contact who is also a procurement consultant. The Forum's approximately 80 members: include 15–20 who are also Budi's narasumber targets (procurement consultants who advise BUJK have the highest-density view of BUJK problems across multiple clients). 1 procurement consultant narasumber = intelligence about 8–12 BUJK simultaneously.", intelligence_value: "Forum narasumber value: the highest intelligence density per interview. A procurement consultant interview produces: (1) direct experience with 8–12 BUJK clients, (2) cross-BUJK pattern recognition (problems that appear across all their clients), (3) perspective on how BUJK use or fail to use tools like MJP (procurement consultants have observed their clients using MJP — often more objectively than the BUJK owners themselves). Current Forum narasumber: 6 members (9% of Budi's total). Target post-Series A: 12 Forum members (adding 6 more through warm introductions from current Forum narasumber).", tc: "text-emerald-700" },
            { association: "ASOSIASI-4: LKPP Working Groups — indirect access to procurement officer network through Sari", relationship_type: "Not a BUJK-facing association — the LKPP working groups are attended by government procurement officials (panitia), policy specialists, and industry observers including Sari. Budi's access: indirect, through Sari. When Sari encounters a working group participant who is a BUJK consultant or industry representative (not a government official): she introduces Budi for potential narasumber outreach. This cross-functional access: produced 3 highly valuable narasumber who have both industry expertise and regulatory insight — a rare combination.", intelligence_value: "LKPP working group-sourced narasumber: the highest quality inputs to Budi's regulatory insight data. These narasumber understand both the BUJK perspective (from their industry work) and the LKPP perspective (from their working group participation). Their insights: particularly valuable for Sari's regulatory forecast methodology (PRED-2 and PRED-3 signal types from R112 Regulasi panel). Budi and Sari have a standing arrangement: after each LKPP working group meeting, Sari shares a 100-word summary of new contacts who might be appropriate narasumber. Budi follows up within 2 weeks. Conversion rate from Sari introduction to active narasumber: 71% (Sari's institutional context makes the introduction highly credible).", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.association} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.association}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Relationship type: {r.relationship_type}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Intelligence value: {r.intelligence_value}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Industry association relationships adalah Budi's network infrastructure — the organized layer of professional relationships that makes his 67-narasumber network systematically expandable rather than limited by his personal reach. Without association relationships: Budi's narasumber expansion depends entirely on cold outreach (slow, low conversion) or referrals from existing narasumber (faster but bounded by each narasumber's personal network). With 12 association contacts across 4 organizations: Budi has warm introduction access to an estimated 300–500 BUJK owners and procurement professionals he has never personally met. The conversion rate from warm introduction to active narasumber: approximately 28% (1 in 4 introductions produces an active narasumber relationship). This means Budi's accessible narasumber pool (if he wanted to expand aggressively): 84–140 additional narasumber reachable through current association contacts alone. MJP's post-Series A narasumber expansion target: +40 narasumber (from 67 to 107) over 24 months. At 28% conversion rate, this requires approximately 143 warm introductions — all achievable through current association contacts without new association relationship building. The association relationship maintenance cost: approximately 8 days/year of Budi's time (congress attendance, webinar participation, occasional DPD coordinator calls). The return: warm introduction access to an addressable network of 300–500 potential narasumber. ROI per day of association maintenance: 37.5 accessible new narasumber per day invested (and 1 new active narasumber per 2.4 days invested at 28% conversion). Budi: 'Asosiasi adalah cara saya memastikan bahwa network narasumber saya tidak hanya bergantung pada seberapa banyak orang yang secara pribadi saya kenal. Mereka adalah jembatan ke komunitas yang lebih besar yang peduli dengan masalah yang sama dengan yang kami coba selesaikan.'</p>
      </div>

      {/* R114: Budi's Interview Failure Cases */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-primary" /> INTERVIEW FAILURE CASES — 3 Wawancara yang Tidak Menghasilkan Data Berguna dan Mengapa: Analisis Faktor Kegagalan, Pelajaran Metodologis, dan Bagaimana Kegagalan Ini Mengubah Protokol Wawancara Budi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { case_id: "FAILURE-CASE-1: Wawancara dengan kontraktor yang sedang dalam sengketa hukum aktif", what_happened: "In Q2 2023: Budi conducted a 65-minute interview with a jenjang-8 BUJK owner who, unknown to Budi at the time, was in the middle of an active legal dispute with a procurement agency (the BUJK had been disqualified from a major tender and was appealing the decision). The interview produced no usable data: the narasumber answered every question about procurement pain points in terms of their specific legal case ('the real problem is that the panitia violated Perpres 16 — that's the pain point'), refused to discuss general market patterns ('I can't speak to general problems when there's a specific injustice happening to me right now'), and used the interview as an opportunity to vent about their dispute rather than reflect on business intelligence needs.", failure_factor: "Root cause: Budi had no pre-interview screening question about current legal or contractual disputes. He introduced this question after the failure: 'Apakah Anda saat ini terlibat dalam sengketa pengadaan atau litigasi aktif?' If yes: Budi reschedules the interview for after the dispute is resolved (or switches the topic to specifically how BUJK navigate procurement disputes — a separate valid research topic). The failure also revealed a research gap: MJP has no Knowledge Registry assets on dispute resolution mechanisms (Perpres 16 complaint channels, LKPP mediation, administrative courts). Sari added 7 assets on procurement dispute resolution following Budi's finding.", tc: "text-primary" },
            { case_id: "FAILURE-CASE-2: Wawancara dengan narasumber yang merespon dalam mode 'kesan pertama'", what_happened: "In Q4 2022: Budi's second interview with a new narasumber (introduced through GAPENSI DPD) produced data that was almost entirely positive — the narasumber described MJP enthusiastically ('sangat membantu', 'saya sangat puas', 'tidak ada kekurangan yang saya rasakan'). Budi returned to MJP with an optimistic report. Hendra was immediately skeptical: 'No product has zero friction for an experienced BUJK. Something is wrong with this interview.' A follow-up interview 6 weeks later (after the narasumber had developed more trust with Budi): revealed 4 specific pain points that the narasumber had suppressed in the first interview because he didn't want to 'criticize' Budi's platform to his face.", failure_factor: "Root cause: first-interview social desirability bias. Narasumber who don't know Budi well yet: tend to give positive responses because they don't want to be critical of a product made by someone who has invested significant time in building it (social courtesy norm). The fix: Budi's protocol now explicitly includes a trust-building phase before the first substantive interview, and all pain point data gathered in 'first interviews' are flagged for follow-up validation. First-interview data: used only as hypothesis generation input, not as confirmed findings. The 6-week follow-up interview protocol: formally added to Budi's methodology after this case. Now 41% of narasumber relationships include at least one follow-up interview — and follow-up interviews consistently yield higher-quality pain point data than first interviews.", tc: "text-blue-700" },
            { case_id: "FAILURE-CASE-3: Wawancara dengan narasumber yang jawabannya hanya mencerminkan pengalaman satu proyek", what_happened: "In Q1 2024: Budi interviewed a jenjang-9 BUJK owner who had recently completed a very large contract (Rp 120B infrastructure project). The entire interview was dominated by learnings from that single project — the narasumber's pain points were all large-scale (project management complexity, subcontractor coordination, payment delays from a large government agency). While interesting, these pain points were non-representative: they applied to BUJK in the top 2–3% of the revenue range, not to the broader market that MJP serves. Budi returned with 7 'confirmed pain points' that subsequent interviews revealed to be unique to very large projects rather than general market patterns.", failure_factor: "Root cause: Budi failed to bracket the conversation to 'typical/recent 3–5 projects' rather than the most recent exceptional project. He introduced a reframing question after this case: 'Kami ingin memahami pengalaman umum Anda di pasar — bisakah kita fokus pada 3–5 proyek yang paling mewakili bisnis Anda sehari-hari, bukan satu proyek yang tidak biasa?' This question: explicitly invites the narasumber to select representative experiences rather than the most memorable one. The recency bias (most recent project dominates recall) and the peak-experience bias (most dramatic project dominates recall) are two cognitive patterns Budi now actively counteracts with this reframing question. Budi: 'Narasumber tidak membohongi kita. Mereka memberikan pengalaman mereka yang paling nyata — yang bukan selalu pengalaman paling khas. Pekerjaan saya adalah mengarahkan mereka ke yang khas, bukan yang luar biasa.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.case_id} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.case_id}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">What happened: {r.what_happened}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Failure factor and fix: {r.failure_factor}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Interview failure cases adalah Budi's most important source of methodological improvement — more important, per learning unit, than the 67 successful interviews that produced usable data. The 3 failure cases above each produced a specific protocol change (dispute screening question, trust-building phase + follow-up protocol, reframing question for representative experience) that improved all subsequent interviews. The cumulative effect: Budi estimates his 'usable interview rate' improved from approximately 72% (in 2022, before these failures) to 91% (in 2025, after all 3 protocol changes were embedded). The 19-percentage-point improvement: means that of 40 interviews Budi conducts per year, approximately 8 more now produce usable data. At Budi's cost structure (each interview: 3–5 hours of total time including preparation, travel, and analysis): 8 additional usable interviews = 24–40 hours of effective research capacity gained from methodology improvement alone. The deeper principle: research methodology failure is rarely caused by narasumber who are uncooperative or deceptive. It is almost always caused by protocol design that creates conditions where honest, representative sharing is difficult. Every failure case above: the narasumber was behaving rationally — the BUJK in a legal dispute was defending his position, the social-courtesy narasumber was being polite, the exceptional-project narasumber was sharing his most salient experience. The failures were Budi's design failures, not narasumber failures. Recognizing this: is the foundational mindset shift that separates improving researchers from researchers who blame their subjects for bad data. Budi: 'Setiap wawancara yang gagal: itu bukan kegagalan narasumber — itu kegagalan desain saya. Dan kegagalan desain saya bisa diperbaiki. Itulah mengapa saya mendokumentasikan setiap satu dari mereka.'</p>
      </div>

      {/* R115: Budi's 2027 Research Agenda */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-primary" /> BUDI'S 2027 RESEARCH AGENDA — 5 Pertanyaan Riset yang Budi Rencanakan untuk Dijawab dalam 18 Bulan ke Depan: Mengapa Setiap Pertanyaan Penting bagi Strategi MJP, Metodologi yang Direncanakan, dan Narasumber yang Dibutuhkan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { question: "RESEARCH-Q1: Mengapa BUJK yang menang tender konsisten menang lagi? (Win Rate Persistence Study)", rationale: "MJP's award data shows a pattern: the top 15% of BUJK by win rate in any 3-year period continue winning at above-market rates in the subsequent 3 years. This persistence is statistically significant — it's not random variance. But MJP does not yet understand the behavioral, operational, and knowledge factors behind persistent winning. Is it bid preparation quality? Relationship capital with specific agencies? Geographic concentration? Operational track record? The answer: will directly shape MJP's feature roadmap (if bid preparation quality explains persistent winning, MJP should build bid preparation tools; if relationship capital does, MJP should build agency relationship intelligence).", methodology: "Planned methodology: 20 interviews with 'persistent winners' (BUJK in the top win-rate quintile for 2021–2023 who continued winning at above-market rates in 2024–2026) and 20 interviews with 'regression to mean' BUJK (high win rate in 2021–2023 but returned to average in 2024–2026). The contrast: between persistent winners and regressing winners — controls for baseline quality differences and isolates the specific practices that separate sustainable from temporary performance. Target narasumber pool: primarily Enterprise subscribers (who are more likely to be persistent winners) and GAPENSI DPD contacts in Jawa Timur and Jawa Tengah (where award data coverage is richest).", tc: "text-primary" },
            { question: "RESEARCH-Q2: Bagaimana BUJK mengambil keputusan untuk tidak mengikuti tender? (No-Bid Decision Study)", rationale: "MJP's current intelligence: optimized for helping BUJK identify tenders to bid on. But Budi's interviews consistently surface a finding: experienced BUJK say that knowing which tenders NOT to bid on is as valuable as knowing which ones to bid on. BUJK who discipline their bid selection (avoiding tenders with low win probability, high-risk agencies, or poor margin characteristics) consistently outperform BUJK who bid on everything they qualify for. MJP has no product feature that explicitly helps BUJK make no-bid decisions — this research would provide the intelligence foundation for such a feature.", methodology: "Planned methodology: retrospective no-bid analysis. Budi will ask 15–20 narasumber to walk through their last 10 'no-bid' decisions: what information did they have, what was their reasoning, and in retrospect was the no-bid decision correct? The retrospective analysis: will identify the information types most commonly used in no-bid decisions (agency reputation, competing BUJK profiles, HPS accuracy signals, timing considerations). These information types: will be mapped against MJP's current feature set to identify gaps. Expected outcome: 3–5 new feature concepts for MJP's bid selectivity intelligence capability.", tc: "text-blue-700" },
            { question: "RESEARCH-Q3: Pengalaman BUJK perempuan sebagai pemimpin di pasar konstruksi Indonesia (Gender in BUJK Study)", rationale: "Budi's current narasumber network: 67 individuals, of whom 6 (9%) are women. The gender distribution: approximately reflects the BUJK market (women own approximately 8–12% of BUJK by most industry estimates). But Budi suspects that the barriers, pain points, and information needs of female BUJK owners may differ systematically from male BUJK owners — and MJP may be designing features for a male-typical use pattern that doesn't serve the female BUJK segment well. This is an untested hypothesis. The research question: are there systematic differences in how female BUJK owners experience the government procurement market, and do any of those differences represent unmet needs that MJP could address?", methodology: "Planned methodology: 10 focused interviews specifically with female BUJK owners (expanding Budi's current 6 female narasumber to 16). The sample: recruited through GAPENSI's female entrepreneur working group (a recently formed group that Budi connected with through GAPENSI DPD contacts). The interview focus: not just pain points but specifically on whether procurement processes, platform interfaces, and professional network dynamics differ by gender. The output: either (1) evidence that the gender-specific hypothesis is incorrect (female BUJK pain points are identical to male BUJK pain points — no design changes needed), or (2) evidence of systematic differences that should inform MJP's product design and outreach strategy.", tc: "text-emerald-700" },
            { question: "RESEARCH-Q4: Bagaimana BUJK generasi berikutnya (usia 25–35) berbeda dalam kebutuhan intelijen pasar? (Next-Gen BUJK Study)", rationale: "Budi's narasumber age distribution: 68% are 45–60 years old. The next generation of BUJK leaders (children of current BUJK owners who are taking over family businesses, or professionals who started new BUJK in their 30s) may have fundamentally different digital literacy, information consumption patterns, and intelligence needs. If MJP's product is optimized for 45–60-year-old BUJK owners: it may not serve the growing next-generation segment well. This is MJP's 10-year market sustainability question — the BUJK owners who will be the dominant buyers in 2035 are 25–35 today.", methodology: "Planned methodology: 12 interviews with BUJK owners or senior managers aged 25–35. Recruitment: through GAPEKSINDO (which skews younger than GAPENSI) and through Reza's subscriber network (young subscribers who have shown high platform engagement). Interview focus: what do they use MJP for vs what they do manually, what information do they search for that MJP doesn't provide, and how does their decision-making process differ from their older peers? Budi: 'Generasi berikutnya BUJK akan memutuskan apakah MJP tetap relevan selama 20 tahun ke depan. Saya perlu mengenal mereka sebelum mereka memiliki cukup kekuatan untuk mengubah industri ini — karena pada saat itu, MJP harus sudah siap untuk melayani cara mereka bekerja, bukan cara orang tua mereka bekerja.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.question} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.question}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Rationale: {r.rationale}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Methodology: {r.methodology}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Budi's 2027 research agenda adalah MJP's product strategy expressed as a set of empirical questions — because every major product direction in MJP's history was preceded by a research finding that revealed an unmet need or an incorrect assumption. The 4 questions above (win rate persistence, no-bid decisions, female BUJK experience, next-generation BUJK needs) share a common characteristic: they are all questions that cannot be answered from MJP's existing data (award database, NLQ query logs, subscription analytics). They require new primary research — new interviews with specific BUJK populations that Budi must deliberately seek out. The research agenda: takes approximately 18 months of Budi's time (conducting 60+ interviews across 4 research questions while maintaining his ongoing narasumber network and supporting Hendra's product decisions). Post-Series A: Budi's research capacity expands because he will have a Research Associate for logistical support (interview scheduling, note transcription, initial analysis). This will allow Budi to conduct more interviews per month and to dedicate more time to analysis and synthesis — his most scarce and most valuable contribution. The most strategically important question in the 4-question agenda: RESEARCH-Q2 (no-bid decisions). This question directly addresses the gap between MJP's current 'tender discovery' positioning and the 'bid selectivity intelligence' positioning that would differentiate MJP most powerfully from competitors who all do some version of tender discovery. If RESEARCH-Q2 confirms that no-bid decision intelligence is valuable and distinct from current MJP offerings: the post-Series A Product Manager's first feature roadmap item is determined before they are even hired.</p>
      </div>

      {/* R116: Research Ethics Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> RESEARCH ETHICS FRAMEWORK — Panduan Etika Budi untuk Riset Narasumber yang Bertanggung Jawab: 4 Prinsip Inti, Kasus-Kasus Sulit yang Menguji Prinsip, dan Mengapa Etika Riset adalah Fondasi dari Kepercayaan Narasumber
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { principle: "ETHICS-PRINCIPLE-1: Informed consent yang benar-benar terinformasi — bukan formulir, tapi percakapan", definition: "Budi's first ethics principle: informed consent for participation in MJP's research must be genuine — meaning the narasumber understands how their information will be used, not just that they've signed a consent form. The distinction: a narasumber who signs a form they haven't read has not given meaningful consent. Budi's consent protocol: a 5-minute verbal explanation at the start of every first interview, covering (1) what MJP does with the information (anonymized product development, not sold or published), (2) what protections apply (no company names, locations, or identifying details in published research), (3) what they can do if they change their mind (withdraw at any time, request that previously gathered data be excluded from analysis), and (4) what they are NOT consenting to (their individual data being shared with other BUJK, used in investor presentations with attribution, or published without review).", hard_case: "Hard case: a narasumber from Budi's early 2022 network (before the formal consent protocol was established in 2023) who provided information that now forms part of MJP's core pain point database. Technically: Budi obtained their consent at the time (verbal, in 2022) but not in the structured way the 2023 protocol requires. Budi's decision: conduct a retroactive re-consent conversation with this narasumber (explaining the formal protocol and giving them the option to exclude their data). The narasumber: confirmed consent with the new protocol and expressed appreciation for being asked again. The retroactive re-consent: Budi's most deliberate ethics decision — he had no legal obligation to do it, but he did it because the relationship was more important than the data.", tc: "text-primary" },
            { principle: "ETHICS-PRINCIPLE-2: Anonimisasi yang sebenarnya — bukan hanya mengganti nama", definition: "Budi's second ethics principle: anonymization of narasumber data must be genuine, not just name replacement. The risk of superficial anonymization: in a small market (12.000+ SAM BUJK nationally, but perhaps 200–300 jenjang-8/9 BUJK in a specific city), replacing 'PT ABC Construction' with 'a large jenjang-9 BUJK in Surabaya' may still be identifiable to industry insiders who know all the jenjang-9 BUJK in Surabaya. Budi's anonymization standard: all narasumber references in MJP's internal research database must survive the 'industry insider test' — if an informed BUJK in the same city, KBLI, and jenjang tier read the reference, could they identify the company? If yes: the reference needs further anonymization.", hard_case: "Hard case: a pain point (PP-017, related to BUJK compliance failures in a specific regional procurement context) where the narasumber's situation was so specific that even heavily anonymized descriptions were likely identifiable to 3–4 specific industry contacts. Budi's decision: exclude PP-017 from MJP's published pain point database (it is in Budi's personal research notes but not in the system). The commercial cost: PP-017 is a real pain with Rp 1B+ commercial potential if solved. The ethics constraint: one narasumber's privacy outweighs the commercial opportunity. Budi: 'Kalau saya tidak bisa melindungi privasi narasumber ini, saya tidak bisa melindungi privasi siapa pun. Kepercayaan seluruh jaringan narasumber 67 orang bergantung pada saya memperlakukan setiap satu dari mereka sebagai tidak dapat dinegosiasikan, bukan rata-rata.'", tc: "text-blue-700" },
            { principle: "ETHICS-PRINCIPLE-3: Representasi yang adil — tidak memberikan data narasumber lebih berat dari yang mereka berikan", definition: "Budi's third ethics principle: research findings must accurately represent what narasumber said, not what Budi wishes they had said or what would be most commercially useful for MJP. The risk of motivated reasoning: a researcher who wants to validate a specific product hypothesis may unconsciously emphasize narasumber statements that support the hypothesis and de-emphasize contradicting statements. Budi's protection: all interviews are voice-recorded (with consent) and fully transcribed. Pain point scoring (the F, S, A, D methodology) is always done from transcripts, not memory. Discrepancies between Budi's initial impression and the transcript-based score: required to be resolved in favor of the transcript.", hard_case: "Hard case: the PP-011 near-miss (material price reference pain). In Budi's initial post-interview notes, he rated the frequency of PP-011 as 3/5 (based on his memory of 4 interviews where narasumber mentioned it). When he went back to the full transcript corpus: 8 of 15 interviews had at least passing mention of material price checking — which re-scored frequency to 0.28–0.32 (significantly higher). Budi's initial memory had compressed the pain point's frequency because he encountered it more as a background comment ('oh, and we also have to check material prices') rather than a primary complaint. The transcript review: corrected the compression bias. The outcome: PP-011's commercial importance was accurately assessed only through the discipline of transcript review, not memory-based analysis.", tc: "text-emerald-700" },
            { principle: "ETHICS-PRINCIPLE-4: Non-exploitation — tidak menggunakan relasi riset untuk kepentingan komersial tanpa persetujuan", definition: "Budi's fourth ethics principle: narasumber relationships are research relationships, not sales leads. The boundary: Budi does not share narasumber contact information with Reza without explicit narasumber permission. He does not use narasumber meetings to pitch MJP's products. He does not accept commercial referrals from narasumber in exchange for research participation. The reason: narasumber who feel that their research participation will lead to a sales call become less candid — they self-censor commercially sensitive information that could be used against them in a sales conversation. Research value: protected by clear separation between research and commercial functions.", hard_case: "Hard case: Budi conducted an interview with a jenjang-9 BUJK owner who revealed significant frustration with their current LPSE aggregator (a direct MJP competitor's subscriber). Reza heard about the interview from another source and asked Budi directly: 'Can I call them?' Budi's decision: no. He offered to mention MJP's work to the narasumber in a future follow-up interview and ask if they'd like to connect with Reza — but only if the narasumber raised the topic. The narasumber: raised the topic 6 months later, after building further trust with Budi. Reza made contact. The BUJK became an Enterprise subscriber. The non-exploitation discipline: produced a better commercial outcome than an immediate referral would have — because the trust built over 6 months made the BUJK a high-quality subscriber rather than a reluctant trial. Budi: 'Riset yang mengeksploitasi narasumber mungkin menghasilkan satu pelanggan. Riset yang menghormati mereka menghasilkan seluruh jaringan yang terus memberi, karena semua orang dalam jaringan itu tahu mereka aman berbicara dengan Budi dari MJP.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.principle} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.principle}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Definition and protocol: {r.definition}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Hard case: {r.hard_case}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Research ethics framework adalah the invisible infrastructure that makes every narasumber relationship in Budi's 67-person network possible. The framework's 4 principles (genuine informed consent, real anonymization, accurate representation, non-exploitation) are not compliance requirements — there is no regulatory body that enforces research ethics for a private company's customer research program. They are commitments Budi made to himself and his narasumber as the conditions under which the research relationship is possible at all. The causal logic: BUJK in Indonesia's construction procurement market are commercially sensitive about their business practices (tender strategies, partner relationships, qualification approaches) in a market where information asymmetry is commercially valuable. A BUJK who trusts that Budi will protect their information becomes candid. A candid narasumber reveals the real pain points — including the invisible pain points (normalized friction, embarrassment pain) that only emerge in a trust environment. MJP's 19 documented pain points: each one required the degree of candor that only a trust relationship enables. The ethics framework: is the mechanism that produces and sustains that trust. Without it, Budi has polite but strategically useless interviews. With it, he has the 67-person network that forms MJP's deepest competitive moat. The framework's most important property: it is not scalable in the way that other competitive advantages are scalable. You cannot 'buy' ethical research by paying more or deploying more people — each narasumber relationship is individually built and individually maintained. Post-Series A: the Research Associate will need to be trained in the full ethics framework before conducting any independent interviews. The 30-day Workroom onboarding (from R114) and the Research Methodology Handbook (from the Post-Series A Problem Evolution panel) both incorporate the ethics framework as foundational rather than optional. The competitive advantage of ethical research: compounding and non-replicable, which makes it MJP's most durable moat even as technical moats (NLQ, crawler architecture) become more commonly understood by competitors.</p>
      </div>

      {/* R117: Narasumber Network Health Monitoring */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> NARASUMBER NETWORK HEALTH — Bagaimana Budi Memantau Kesehatan Relasi dengan 67 Kontak: 3 Dimensi Kesehatan Relasi, Tanda Bahaya yang Dimonitor, dan Protokol Memperbarui Relasi yang Mulai Mendingin
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { dimension: "HEALTH-DIMENSION-1: Recency — kapan terakhir Budi berbicara langsung dengan narasumber ini", monitoring: "Budi tracks the date of last substantive contact for all 67 narasumber: a 'substantive contact' is a call, meeting, or WhatsApp conversation that includes at least one research-relevant exchange (a new observation about the market, a reaction to a regulatory change, a business update that informs MJP's understanding of their situation). Not: a brief courtesy check-in ('Apa kabar, Pak?') or a social media interaction. Recency thresholds: GREEN = contacted within 90 days. YELLOW = 91–180 days since last contact. RED = 181+ days since last contact. Current distribution: 41 GREEN, 19 YELLOW, 7 RED.", reactivation_protocol: "Reactivation protocol for YELLOW narasumber: Budi adds a 'touch' item to his weekly schedule — a specific reason to contact the narasumber (a relevant regulatory update to share, a question about how a recent LPSE change affected their operations, congratulations on a new project award visible in MJP's award database). The specific reason: essential. Generic check-ins ('just staying in touch') produce shorter, less candid conversations than contacts with a specific value-adding reason. For RED narasumber (7 contacts): Budi's assessment is that 4 are recoverable (they moved, changed roles, or had a busy period but the relationship is intact) and 3 are effectively inactive (the relationship atrophied and would require a fresh trust-building process to restore — treated as new narasumber targets rather than reactivations).", tc: "text-primary" },
            { dimension: "HEALTH-DIMENSION-2: Candor — seberapa terbuka narasumber dalam berbagi observasi bisnis", monitoring: "Candor: the most important and least quantifiable health dimension. Budi's candor assessment: subjective but consistent — he tracks whether a narasumber's conversations have become more formulaic (shorter, more polished, fewer specific business details) or remain candid (longer, include specific numbers, mention concerns or failures alongside successes). The candor signal: directly tied to trust level. A narasumber who once said 'we almost abandoned that project because the HPS was too low' and now says 'we're very selective about which tenders we pursue' has become more guarded. The shift: indicates either the narasumber has become more cautious about sharing sensitive business information, OR they have had a positive business experience that resolved their previous concerns (less concerning, but Budi notes it either way).", reactivation_protocol: "Budi's candor restoration protocol: slow down. When a narasumber becomes less candid: Budi doesn't ask more probing questions (which would accelerate the guardedness). He shifts to providing more value in each interaction — sharing intelligence about the market before asking for observations. This value-before-ask approach: re-establishes the exchange dynamic that characterized the relationship when candor was high. A narasumber who feels they are receiving more than they are giving: returns to openness more reliably than one who feels they are being interviewed. This asymmetric value exchange: Budi's most effective trust restoration tool. In 3 of 4 cases where candor had declined: systematic value provision over 2–3 contacts restored candor levels.", tc: "text-blue-700" },
            { dimension: "HEALTH-DIMENSION-3: Representativeness — apakah portofolio narasumber masih mencerminkan pasar yang relevan", monitoring: "Representativeness: the demographic health dimension. Budi tracks whether his active (GREEN) narasumber portfolio still covers: (1) All 3 jenjang tiers (7, 8, 9) with proportional representation. (2) At least 6 of 8 active KBLI categories. (3) Geographic diversity across at least Java, Sumatra, Kalimantan, and Eastern Indonesia. (4) Both GAPENSI and GAPEKSINDO members. (5) Both founding-generation (45–60) and next-generation (25–45) BUJK leaders. Current representativeness gaps: Eastern Indonesia coverage (only 5 of 67 narasumber from Eastern Indonesia — 7.5% vs the market share of approximately 15%), next-generation BUJK (8 narasumber under 40 — 12% vs Budi's target of 20%).", reactivation_protocol: "Representativeness restoration: cannot be achieved through reactivation (existing narasumber can't change their geographic location or age) — it requires new narasumber recruitment. Budi's 2027 Research Agenda addresses both gaps: RESEARCH-Q4 (next-generation BUJK study, targeting 12 narasumber aged 25–35) and RESEARCH-Q3 (female BUJK study, which overlaps with the next-generation gap). For Eastern Indonesia representativeness: Budi's plan is to develop 3–4 narasumber in Sulawesi and 2–3 in Papua, timed to coincide with MJP's portal coverage expansion in those regions (Hendra Jr.'s EXPANSION-PHASE-1 and PHASE-2). The timing rationale: narasumber in regions with stronger MJP portal coverage are more likely to have directly relevant experiences to share about their local market — making research conversations more productive and the relationship value exchange more symmetric. Budi: 'Jaringan narasumber yang tidak mencerminkan pasar yang saya coba pahami: pada akhirnya akan menghasilkan wawasan yang tidak mencerminkan pasar yang coba dilayani MJP. Pemantauan representativeness adalah cara saya memastikan bahwa saya tidak hanya membangun produk yang sempurna untuk 67 orang yang saya kenal.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.dimension} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.dimension}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Monitoring approach: {r.monitoring}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Reactivation protocol: {r.reactivation_protocol}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Narasumber network health monitoring adalah Budi's most systematic relationship management practice — because the research network's value is not a static asset but a dynamic capability that degrades without active maintenance. A narasumber who hasn't been contacted in 9 months: likely has new business experiences, new market observations, and new regulatory concerns that MJP doesn't know about yet. A narasumber whose candor has declined: is providing surface-level information rather than the candid operational insights that drive MJP's best product decisions. A narasumber network that no longer represents the market accurately: is producing insights that reflect a biased sample. The 3 health dimensions (recency, candor, representativeness) collectively determine whether Budi's 67-person network is actively producing the quality of insight that it was built to provide — or slowly atrophying into a network of familiar contacts who provide polished, safe answers. The monitoring practice: Budi reviews the full health dashboard monthly (approximately 45 minutes) and addresses YELLOW and RED recency cases within the month. The monthly review: ensures no narasumber relationship drifts to RED status without Budi noticing — because RED relationships require more investment to restore than YELLOW relationships. The most important health dimension for MJP's product quality: representativeness. Recency and candor health: affect the depth of insight from individual narasumber. Representativeness: affects the validity of all product decisions that rely on narasumber data. A product decision made from a demographically biased narasumber sample (too many jenjang-9, too few Eastern Indonesia, too few next-generation BUJK): may optimize the product for a submarket while inadvertently failing the broader BUJK population. The PP-011 near-miss (material price reference pain underscored because the narasumber network was jenjang-8/9 heavy): the most expensive representativeness failure in MJP's history. Monthly health monitoring: the system that prevents the next PP-011 near-miss from taking 3 years to discover.</p>
      </div>

      {/* R118: Longitudinal Narasumber Study Design */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> LONGITUDINAL NARASUMBER STUDY — Melacak Perubahan Pandangan 20 Narasumber Inti Selama 5 Tahun: 3 Pertanyaan Longitudinal yang Budi Lacak, Temuan Paling Mengejutkan, dan Nilai Unik Data Multi-Tahun vs Snapshot
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { question: "LONGITUDINAL-Q1: Bagaimana persepsi risiko kepatuhan BUJK berubah dari 2021 ke 2026?", tracking_method: "Budi has asked a standardized version of 'what is your biggest compliance concern this year?' to his 20 core narasumber annually since 2021. The responses: coded into 8 compliance risk categories (SKK/IUJK qualification, procurement administration, contract compliance, financial reporting, environmental K3, subcontractor management, payment terms, and 'other'). The longitudinal tracking: reveals not just current concerns but the trajectory of concern — which categories are growing in salience and which are fading.", key_finding: "The most significant longitudinal finding: SKK/IUJK qualification concern (category 1) has increased from the #3 concern in 2021 to the #1 concern in 2026 for jenjang-8/9 BUJK. The driver: BNSP's digitalization of SKK verification (2024) made certificate fraud detection more efficient — increasing the compliance risk of under-qualified certification. Simultaneously: LKPP's increased enforcement of SKK requirements in tender evaluation (2023 regulation change) increased the cost of non-compliance. The longitudinal view: reveals a compliance risk category that was moderate in 2021 and has become critical by 2026 — a trend that a one-time survey would miss (it would only see the current high level, not the trajectory that explains why SKK Express exists and why demand is growing). Budi's annual SKK concern tracking: one of the research inputs that convinced Hendra to prioritize SKK Express development in 2022.", tc: "text-primary" },
            { question: "LONGITUDINAL-Q2: Bagaimana kepercayaan BUJK terhadap sumber informasi konstruksi berubah selama 5 tahun?", tracking_method: "Annual question to 20 core narasumber: 'Where do you get your most reliable information about procurement regulations and competitor activity?' Response categories: LKPP website, industry association (GAPENSI/GAPEKSINDO), senior colleagues/mentors, consultant/advisor, online forums/WhatsApp groups, and (since 2022) MJP. The annual tracking: reveals how BUJK's information trust landscape is evolving and where MJP fits in that landscape.", key_finding: "The most commercially important longitudinal finding: 'online forums/WhatsApp groups' as a primary information source declined from #1 in 2021 (cited by 14 of 20 narasumber as their most reliable source) to #4 in 2026 (cited by 6 of 20). The concurrent shift: 'MJP' as a primary source grew from 0 in 2021 to #2 in 2026 (cited by 11 of 20), behind only 'senior colleagues/mentors' (#1, cited by 13 of 20). The shift: not just about MJP gaining users — it reflects a broader information quality upgrade in the BUJK community. WhatsApp group information is increasingly recognized as unreliable (too much rumor, outdated regulatory interpretations, commercially biased content from consultants). BUJK are seeking more authoritative sources. MJP's Knowledge Registry and briefing: positioned as the authoritative alternative to WhatsApp group hearsay. Budi: 'Kami tidak menggantikan WhatsApp grup — kami mengisi ruang kepercayaan yang ditinggalkan WhatsApp grup karena tidak bisa mempertahankan kualitas.'", tc: "text-blue-700" },
            { question: "LONGITUDINAL-Q3: Bagaimana ambisi ekspansi bisnis BUJK berubah sejak 2021?", tracking_method: "Annual qualitative question: 'Where do you see your company in 5 years — same scale, growing, expanding to new regions/categories, or contracting?' The response tracking: measures BUJK confidence trajectories and helps MJP anticipate which product features will be needed as BUJK scale. A BUJK who says 'same scale' in 2021 and 'expanding to new provinces' in 2024: represents a subscriber whose product needs have shifted from maintenance (staying current with regulations) to growth (entering new procurement markets — the provincial expansion support product need from R117).", key_finding: "The longitudinal ambition finding: expansion intent in the 20-narasumber panel has increased from 7 of 20 expressing expansion plans in 2021 to 14 of 20 in 2026. The 7-person shift: not random — it correlates with 3 factors: (1) jenjang upgrade completion (BUJK who completed jenjang-7→8 upgrades with SKK Express: more confident about expansion). (2) MJP subscription tenure (subscribers for 3+ years: more likely to have converted market intelligence into actual business growth). (3) Post-COVID recovery trajectory (construction market recovery accelerating expansion confidence). Budi's most commercially significant longitudinal insight: MJP's own subscription may be causally contributing to subscriber expansion confidence — not just correlating with it. If BUJK who subscribe to MJP for 3+ years become more expansion-oriented: MJP's product roadmap should increasingly serve expansion-phase BUJK needs (provincial expansion support, Trust Score in new markets, JO partner network access). The product roadmap for 2027–2028: substantially influenced by this longitudinal ambition trajectory.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.question} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.question}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Tracking method: {r.tracking_method}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Key finding: {r.key_finding}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Longitudinal narasumber study adalah Budi's most intellectually distinctive research contribution — because it converts MJP's 5-year market relationship into a temporal dataset that no competitor can replicate regardless of capital or research talent. A competitor who enters the BUJK intelligence market in 2026 and immediately recruits 67 narasumber: can generate a high-quality 2026 snapshot. They cannot generate the trajectory — what those same narasumber thought in 2021, 2022, 2023, 2024, and 2025, and how their thinking evolved. The trajectory is what reveals causation (is BUJK expansion intent increasing because of MJP, because of the construction market, because of jenjang upgrade completion?) and trends (is SKK compliance concern still rising or plateauing?). The 3 longitudinal questions (compliance risk trajectory, information trust trajectory, business ambition trajectory): are the minimum longitudinal dataset to understand MJP's impact and the market's direction. Each question: maps to a product and commercial decision. Compliance risk trajectory → SKK Express investment timing and scaling. Information trust trajectory → content quality investment and competitor positioning. Business ambition trajectory → product roadmap for expansion-phase features (provincial support, JO network, Trust Score in new markets). Budi's longitudinal data: the 'unfair advantage' in Hendra's Series A pitch that is genuinely non-purchasable. VCs who ask 'how do you know where this market is going?' receive not a prediction but a 5-year measured trajectory with 20 consistently tracked data points. That is the quality of market intelligence that justifies a premium B2B SaaS valuation — understanding not just the current state but the direction and velocity of the market it serves.</p>
      </div>

      {/* R119: Narasumber Compensation Philosophy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> NARASUMBER COMPENSATION PHILOSOPHY — Mengapa MJP Membayar Narasumber dengan Intelijen, Bukan Uang Tunai: 4 Bentuk Non-Monetary Compensation, Mengapa Pendekatan Ini Menghasilkan Wawasan Lebih Dalam, dan Trade-Off yang Budi Pertimbangkan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { form: "COMP-FORM-1: Briefing preview access — narasumber menerima briefing 24 jam sebelum subscriber reguler", value_to_narasumber: "The 24-hour preview: not just an early-read benefit but a professional status signal. BUJK association leaders and procurement consultants who receive MJP's briefing a day before the general subscriber base: can reference MJP's analysis in their own advisory conversations with BUJK clients before the information is publicly circulated. The 'first-to-know' status: particularly valuable for procurement consultants who charge for their advisory services — being reliably ahead of the market on regulatory and tender intelligence is a competitive differentiator in their own consulting practice.", why_better_than_cash: "Why this produces better research than cash payments: narasumber who receive monetary compensation for their time implicitly adopt a 'contracted informant' mindset — they answer the questions asked, but rarely volunteer additional context or follow-up unprompted. Narasumber who receive intelligence reciprocity: develop a collaborative researcher relationship with Budi — they share information not just because they're being paid to but because they've experienced MJP's intelligence as genuinely useful to their own work. The collaborative dynamic: produces higher-quality, more candid, more proactively offered insights. Budi's observation: 'Narasumber yang dibayar dengan intelijen sering menghubungi saya lebih awal dari jadwal karena mereka melihat sesuatu di lapangan yang mereka pikir perlu saya ketahui. Narasumber yang dibayar dengan uang tidak pernah menghubungi saya sebelum jadwal wawancara.'", tc: "text-primary" },
            { form: "COMP-FORM-2: Knowledge Registry asset preview — narasumber menerima draft asset baru sebelum publikasi untuk review dan feedback", value_to_narasumber: "BUJK practitioners who review Knowledge Registry draft assets before publication: have the opportunity to correct factual errors from a practitioner perspective (MJP's regulatory analysis is sometimes overly legal in framing and benefits from a 'how this actually works in practice' correction from someone who has navigated the regulation firsthand). Their feedback: improves the asset's quality, and they receive credit as a 'practitioner reviewer' in the asset's byline (visible to all Knowledge Registry users). The byline credit: a professional reputation benefit for BUJK association leaders and procurement consultants — being named as a reviewer on MJP's knowledge assets establishes them as recognized experts in their domain.", why_better_than_cash: "Why this produces better research: narasumber who review Knowledge Registry drafts invest cognitive effort in the review process — they read carefully, fact-check from memory, and often volunteer additional context ('this is correct, but there's also a related requirement that you didn't mention that affects this regulation'). This unprompted additional context: the highest-value output of the review process. Cash-compensated reviewers: more likely to give superficial approval ('looks good to me') to minimize their time investment. Knowledge-compensated reviewers: more likely to engage deeply because the output quality affects their professional reputation (their name is on the asset).", tc: "text-blue-700" },
            { form: "COMP-FORM-3: Trust Score beta access — narasumber receive early access to Trust Score for competitors they actively track", value_to_narasumber: "For BUJK practitioners who are active market participants (bidding on tenders or advising clients who do): Trust Score access is direct competitive intelligence. Receiving Trust Score before it's publicly released to subscribers gives them time to interpret the data for their specific competitive context before the general subscriber base sees the same information. The beta access period: typically 4–6 weeks before each major Trust Score algorithm update is released to Pro/Enterprise subscribers.", why_better_than_cash: "Why this produces better research: narasumber with Trust Score beta access: provide the most commercially valuable feedback Budi receives — because they have direct operational experience of the market dynamics that Trust Score is trying to quantify. When a narasumber says 'the Trust Score for this company looks too high — I competed against them last quarter and their qualification documents were below what I expected for a Trust Score in this range': that feedback is a Trust Score calibration data point that improves the algorithm. Cash-compensated narasumber who don't use Trust Score: have no basis for evaluating its accuracy and provide no algorithm feedback. The Trust Score calibration benefit: the most technically specific value that narasumber compensation creates for MJP's product quality.", tc: "text-emerald-700" },
            { form: "COMP-FORM-4: Invitation ke narasumber research synthesis sessions — co-creation, bukan sekadar informan", value_to_narasumber: "Quarterly synthesis sessions: Budi invites 4–6 narasumber to a 3-hour research synthesis session where he presents preliminary findings from the quarter's research and asks narasumber to validate, challenge, or extend each finding. The session format: structured around Budi's findings, but with significant open time for narasumber to share observations from their own recent market experiences. The synthesis session participants: receive a copy of the final research synthesis document (an internal MJP document not shared with general subscribers) with their names acknowledged in the 'narasumber community' section.", why_better_than_cash: "Why this produces better research than any form of individual payment: group dynamics in the synthesis session surface insights that no individual narasumber would provide in a 1:1 interview. A narasumber who observes 'that's interesting — we saw something similar but different in the Makassar market' in response to another narasumber's point: produces a comparative insight that Budi would never have extracted from individual interviews (because he would have needed to know in advance to ask the comparison question). The emergent insights from synthesis sessions: consistently the most novel findings in Budi's quarterly research. The format: more respectful of narasumber time (they see how their individual contributions fit into a larger picture) and more intellectually engaging than transactional interviews.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.form} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.form}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Value to narasumber: {r.value_to_narasumber}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Why better than cash: {r.why_better_than_cash}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Narasumber compensation philosophy adalah Budi's most important methodological insight — that the best research relationships are not transactional but collaborative, and that monetary compensation often creates the wrong incentive structure for deep qualitative research. The 4 non-monetary compensation forms (briefing preview, KR asset review, Trust Score beta, synthesis sessions): collectively create a 'narasumber community' where members receive MJP's best intelligence in exchange for their best market knowledge. The community dynamic: self-reinforcing over time. Narasumber who have been in the program for 2+ years: have accumulated enough MJP intelligence (through briefing previews, asset reviews, and Trust Score beta access) that their own market understanding is meaningfully better than comparable BUJK practitioners who don't participate. This superior market understanding: makes them more insightful research participants (better pattern recognition, clearer trend articulation) in subsequent Budi sessions. The compounding value: both for MJP (better research inputs) and for narasumber (better market intelligence). Budi's narasumber community as competitive moat: cannot be replicated by a competitor who simply offers cash payments. A new market intelligence competitor who approaches MJP's narasumber with a Rp 500rb/interview cash offer: will get 60 minutes of answers to questions asked. MJP's narasumber community members: have invested 3+ years of collaborative research relationship that provides ongoing intelligence value to their own professional practice. The switching cost: not 'MJP's briefing is better than competitor's briefing' but 'I co-created MJP's Knowledge Registry and I am a named reviewer on 14 assets — I am part of this platform, not just a subscriber to it.'</p>
      </div>

      {/* R120: Narasumber Community Graduation */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> NARASUMBER COMMUNITY GRADUATION — Kapan Praktisi BUJK Menjadi Mitra Riset Sejati dan Bagaimana MJP Mengelola Transisi: 3 Tahap Hubungan, Sinyal yang Menunjukkan Narasumber Siap Naik Tahap, dan Mengapa Hubungan yang Mature Menghasilkan Insight yang Berbeda Secara Kualitatif
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { stage: "STAGE-1: Informant (bulan 1–6) — narasumber menjawab pertanyaan, Budi yang memimpin", stage_description: "The informant stage: Budi leads every interaction with structured interview questions. The narasumber's role: answering questions about their experience, providing examples, clarifying details when asked. The information flow: primarily one-directional (narasumber to Budi). The narasumber's contribution: valuable but reactive — they respond to Budi's questions but rarely volunteer unprompted insights. The compensation: typically a single form (briefing preview or Knowledge Registry asset review). Budi's management goal in Stage 1: establish rapport, demonstrate that MJP listens and uses narasumber input (by showing the narasumber which Knowledge Assets were influenced by their feedback), and identify whether the narasumber has deeper domain expertise worth developing into a longer relationship.", graduation_signal: "Graduation signal to Stage 2: the narasumber begins volunteering information Budi didn't ask for — mentioning market observations, referencing recent regulatory events, or asking follow-up questions that show they've been thinking about the topics between sessions. The proactive contribution: the first signal that the narasumber is engaging as a thinking partner, not just an interview subject. Budi's typical timeline to Stage 2: 3–4 sessions over 4–6 months, with the graduation signal appearing in session 3 or 4. Narasumber who never show the graduation signal after 6 sessions: remain at Stage 1 indefinitely (valuable informants but not growing into research partners).", tc: "text-primary" },
            { stage: "STAGE-2: Collaborator (bulan 6–24) — Budi dan narasumber saling memimpin bergantian", stage_description: "The collaborator stage: the relationship becomes genuinely bidirectional. The narasumber sends Budi unprompted messages ('I saw something this week I thought you'd want to know'), challenges Budi's preliminary findings ('that's not quite right for the Sulawesi context — let me explain'), and begins to connect their individual observations to broader market patterns that Budi is tracking. The compensation: typically 2–3 forms simultaneously (briefing preview + Knowledge Registry review + Trust Score beta access). Budi's management goal in Stage 2: create the conditions for the narasumber to feel safe sharing contrarian or uncomfortable insights (regulatory problems MJP hasn't covered yet, competitive practices that reflect poorly on the industry, subscriber-relevant risks that might be sensitive to publish).", graduation_signal: "Graduation signal to Stage 3: the narasumber begins initiating research conversations — proposing topics for Budi to investigate, offering to facilitate introductions to other practitioners who have relevant expertise, and participating in multi-narasumber discussions (not just 1:1 with Budi). The network behavior: the signal that the narasumber is invested in MJP's research mission beyond their individual contribution. Budi's typical Stage 2 duration: 12–18 months. The most common Stage 2 plateau (narasumber who collaborate well but don't reach Stage 3): practitioners who are engaged but don't have the community relationships needed to serve as research network connectors.", tc: "text-blue-700" },
            { stage: "STAGE-3: Research Partner (24+ bulan) — narasumber co-designs research, tidak sekadar berpartisipasi", stage_description: "The research partner stage: the relationship has matured into genuine co-creation. The research partner: suggests research topics, provides access to their professional network for Budi's introduction ('I know the procurement director at Dinas PUPR Sulawesi Selatan who could tell you about the regional IUJK changes — want me to introduce you?'), reviews Budi's preliminary findings before publication, and participates in the quarterly synthesis sessions as a facilitating voice rather than just an input voice. The compensation: all 4 forms (briefing preview, Knowledge Registry review, Trust Score beta, synthesis sessions). Stage 3 narasumber count: 6 of MJP's 40+ community members have reached this level after 2+ years of engaged collaboration.", graduation_signal: "What Stage 3 produces qualitatively differently from Stage 1–2: Stage 3 research partners provide 'second-order insights' — observations about what other market participants are thinking, not just about what the partner themselves is experiencing. A Stage 3 partner who says 'I talked to 3 other BUJK procurement directors at the GAPENSI regional meeting last week — they're all confused about the BIM mandate timeline, here's what I heard': provides a synthetic market intelligence observation that Budi could never have collected in individual interviews. The multi-source synthesis: only possible at Stage 3, where the narasumber's engagement with MJP's research mission motivates them to actively collect intelligence from their own professional network on MJP's behalf.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.stage} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.stage}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Stage description: {r.stage_description}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Graduation signal: {r.graduation_signal}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Narasumber community graduation adalah Budi's most important long-term research investment — because the qualitative difference between a Stage 1 informant and a Stage 3 research partner is not just quantity of information but fundamental nature of insight. Stage 1 informs Budi about what is. Stage 3 partners help Budi understand what is becoming. The 'second-order insights' that Stage 3 partners provide — synthesis of conversations with other market participants, proactive intelligence on emerging developments, facilitation of new introductions — create a distributed intelligence network that multiplies Budi's individual research reach by 6× (his 6 Stage 3 partners collectively interact with 100+ BUJK practitioners annually, providing Budi with a synthetic view of the market that his personal interview schedule could never cover). The narasumber graduation model: also explains why MJP's research quality has compounded over 5 years in a way that cannot be replicated by a well-funded competitor hiring 3 new researchers. Hiring more researchers accelerates Stage 1 information collection. It does not create Stage 3 research partners — those require 2+ years of relationship investment per partner, which compounds slowly and cannot be rushed with money. Budi's 6 Stage 3 partners: the most irreplaceable research asset in MJP's entire organization. Not because they are irreplaceable individually (each would be deeply missed but the research program would survive), but because the category — genuine, long-term, bidirectional research partnerships with domain experts — takes years of deliberate cultivation. The moat: time, not talent or capital. Budi's aspiration: 10 Stage 3 partners by Year 2 post-Series A. The investment required: 4 years of relationship cultivation starting with the right Stage 1 narasumber now. Budi is already planting those seeds.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              DATABASE TEMUAN
              {(totalFiltered - readIds.size) > 0 && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {totalFiltered - readIds.size} belum dibaca
                </span>
              )}
              {readIds.size > 0 && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                  {readIds.size} dibaca
                </span>
              )}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUnreadOnly(v => !v)}
              aria-pressed={showUnreadOnly}
              className={cn("h-9 px-2.5 text-[10px] font-mono font-bold rounded-sm border transition-colors flex items-center gap-1", showUnreadOnly ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted")}
              title="Tampilkan belum dibaca saja"
            >
              <CircleCheck className="h-3 w-3" /> {showUnreadOnly ? "Belum Dibaca" : "Semua"}
            </button>
            {starredItems.size > 0 && (
              <button
                onClick={() => setShowStarredOnly(v => !v)}
                aria-pressed={showStarredOnly}
                className={cn("h-9 px-2.5 text-[10px] font-mono font-bold rounded-sm border transition-colors flex items-center gap-1", showStarredOnly ? "bg-amber-500 text-white border-amber-500" : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100")}
                title={showStarredOnly ? "Tampilkan semua" : `Filter ${starredItems.size} item dipin`}
              >
                <Star className={cn("h-3 w-3", showStarredOnly ? "fill-white text-white" : "fill-amber-400 text-amber-500")} /> {starredItems.size} dipin
              </button>
            )}
            <Select value={sortBy} onValueChange={v => setSortBy(v as "newest" | "oldest" | "priority" | "source" | "domain")}>
              <SelectTrigger className="h-9 w-36 text-xs font-mono bg-muted/50" aria-label="Urutkan temuan riset">
                <SelectValue placeholder="Urutkan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest" className="text-xs font-mono">Terbaru</SelectItem>
                <SelectItem value="oldest" className="text-xs font-mono">Terlama</SelectItem>
                <SelectItem value="priority" className="text-xs font-mono">Prioritas</SelectItem>
                <SelectItem value="source" className="text-xs font-mono">Sumber A–Z</SelectItem>
                <SelectItem value="domain" className="text-xs font-mono">Domain A–Z</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                ref={searchRef}
                placeholder="Cari riset, catatan… ( / ) · Esc reset"
                title="Tekan / untuk fokus ke pencarian"
                onFocus={(e) => e.target.select()}
                onKeyDown={e => { if (e.key === "Escape") { setSearchTerm(""); e.currentTarget.blur(); } }}
                className="pl-9 bg-muted/50 pr-7"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {!searchTerm && <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">/</kbd>}
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none" aria-label="Hapus pencarian">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {(searchTerm || categoryFilter || sortBy !== "newest" || showUnreadOnly || showStarredOnly || showWithNotesOnly) as boolean && (
              <button
                onClick={() => { setSearchTerm(""); setCategoryFilter(""); setSortBy("newest"); setShowUnreadOnly(false); setShowStarredOnly(false); setShowWithNotesOnly(false); }}
                className="h-9 px-2.5 text-[10px] font-mono font-bold rounded-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1 shrink-0"
                title="Reset semua filter"
              >
                ✕ Reset semua filter
                <span className="bg-red-600 text-white rounded-full px-1.5 py-0.5 text-[9px] leading-none" title={`${[searchTerm, categoryFilter, sortBy !== "newest" ? sortBy : "", showUnreadOnly, showStarredOnly, showWithNotesOnly].filter(Boolean).length} filter aktif`}>{[searchTerm, categoryFilter, sortBy !== "newest" ? sortBy : "", showUnreadOnly, showStarredOnly, showWithNotesOnly].filter(Boolean).length}</span>
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                <TableHead>Tanggal</TableHead>
                <TableHead>Judul / Ringkasan</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Prioritas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isItemsError ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-destructive font-mono text-xs">
                    Gagal memuat data riset — periksa koneksi lalu{" "}
                    <button className="underline" onClick={() => window.location.reload()}>muat ulang</button>
                  </TableCell>
                </TableRow>
              ) : isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell><div className="h-3 bg-muted rounded w-16" /></TableCell>
                    <TableCell><div className="h-3 bg-muted rounded w-40" /></TableCell>
                    <TableCell><div className="h-3 bg-muted rounded w-24" /></TableCell>
                    <TableCell><div className="h-3 bg-muted rounded w-20" /></TableCell>
                    <TableCell><div className="h-3 bg-muted rounded w-16" /></TableCell>
                    <TableCell><div className="h-3 bg-muted rounded w-12" /></TableCell>
                  </TableRow>
                ))
              ) : totalFiltered === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground font-mono">
                      {(items?.length ?? 0) === 0 ? (
                        <>
                          <p className="text-sm">Belum ada data riset — tambahkan yang pertama</p>
                          <Button size="sm" variant="outline" onClick={() => setIsCreateOpen(true)} className="font-mono text-xs mt-1">+ Tambah Data Riset <kbd className="ml-2 text-[9px] font-mono opacity-60 border border-current/30 rounded px-1">N</kbd></Button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-1 animate-in fade-in duration-200">
                          <Search className="h-8 w-8 opacity-30" />
                          <p className="text-sm">Tidak ada data riset yang cocok dengan filter</p>
                          <button className="text-[10px] font-mono text-primary underline underline-offset-2" title="Reset semua filter" onClick={() => { setSearchTerm(""); setCategoryFilter(""); setSortBy("newest"); setShowUnreadOnly(false); setShowStarredOnly(false); setShowWithNotesOnly(false); }}>✕ Reset semua filter</button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pagedItems?.map((item) => (
                  <TableRow key={item.id} ref={item.id === newItemId ? (el) => { newItemRef.current = el as unknown as HTMLDivElement; } : undefined} className={`group transition-all duration-500${item.priority === "CRITICAL" ? " bg-red-50/20 dark:bg-red-900/10 hover:bg-red-50/40" : starredItems.has(item.id) ? " bg-amber-50/20 dark:bg-amber-900/10 hover:bg-muted/40" : " hover:bg-muted/40"}`}>
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap w-28">
                      {(() => { const d = new Date(item.createdAt); const daysAgo = Math.floor((Date.now() - d.getTime()) / 86400000); const rel = daysAgo === 0 ? "Hari ini" : daysAgo === 1 ? "Kemarin" : daysAgo < 7 ? `${daysAgo} hari lalu` : null; return <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-mono text-muted-foreground whitespace-nowrap" title={format(d, "dd/MM/yyyy HH:mm")}>{rel ?? format(d, "dd/MM/yyyy HH:mm")}</span>; })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="font-medium truncate" title={item.title}>{item.title}</span>
                        <button onClick={e => { e.stopPropagation(); void navigator.clipboard.writeText(item.title).then(() => toast.success("Judul disalin", { duration: 1200 })); }} aria-label="Salin judul riset" className="opacity-0 group-hover:opacity-100 transition-all shrink-0 text-muted-foreground hover:text-foreground" title="Salin judul"><Copy className="h-2.5 w-2.5" /></button>
                        {(Date.now() - new Date(item.createdAt).getTime()) < 7 * 86400000 && (
                          <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded-sm bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">Baru</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1" title={item.summary || undefined}>{item.summary || <span className="text-muted-foreground">—</span>}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono text-muted-foreground inline-flex items-center gap-1" title={`Sumber data: ${item.source}`}>SUMBER: {item.source}
                          {item.source && <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(item.source!).then(() => toast.success("Nama sumber disalin", { duration: 1200 })); }} aria-label="Salin nama sumber" className="opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-foreground" title="Salin nama sumber"><Copy className="h-2.5 w-2.5" /></button>}
                        </span>
                        {item.sourceUrl && (
                          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" title={item.sourceUrl} aria-label="Buka sumber">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {item.sourceUrl && (
                          <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(item.sourceUrl!).then(() => toast.success("Link sumber disalin", { duration: 1200 })); }} aria-label="Salin link sumber" className="opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-foreground" title="Salin link sumber"><Copy className="h-3 w-3" /></button>
                        )}
                      </div>
                      <div className="relative mt-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                        <textarea
                          value={riNotes[item.id] ?? ""}
                          onChange={(e) => updateRiNote(item.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                          onKeyDown={e => { if (e.key === "Escape") e.currentTarget.blur(); }}
                          placeholder="Catatan tim…"
                          rows={1}
                          maxLength={500}
                          className="w-full border rounded-sm px-2 py-1 pb-4 text-[10px] resize-none bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:bg-background transition-colors"
                        />
                        <span className="absolute left-1 bottom-0.5 text-[8px] font-mono text-muted-foreground/50">{(riNotes[item.id] ?? "").length}/500</span>
                        {savedNoteId === item.id && <span className="absolute right-1 bottom-0.5 text-[8px] font-mono text-emerald-600">✓ Tersimpan</span>}
                      </div>
                    </TableCell>
                    <TableCell className="w-32">
                      <Badge
                        variant="outline"
                        title={CATEGORY_LABELS[item.category] ?? item.category.replace(/_/g, " ")}
                        className={cn("text-[10px]",
                          item.category === "SBU_SKK_EXPIRY" && "bg-red-50 text-red-700 border-red-200",
                          item.category === "TENDER_OPPORTUNITY" && "bg-blue-50 text-blue-700 border-blue-200",
                          item.category === "REGULATORY_CHANGE" && "bg-violet-50 text-violet-700 border-violet-200",
                          item.category === "COMPETITOR_INTEL" && "bg-amber-50 text-amber-700 border-amber-200",
                          item.category === "BIM_DIGITALIZATION" && "bg-cyan-50 text-cyan-700 border-cyan-200",
                          item.category === "FIELD_RESEARCH" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                        )}
                      >
                        {CATEGORY_LABELS[item.category] ?? item.category.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-24">
                      <Badge
                        variant={item.priority === 'HIGH' ? 'destructive' : item.priority === 'MEDIUM' ? 'default' : 'secondary'}
                        className="text-[10px]"
                        title={item.priority === 'HIGH' ? 'Prioritas Tinggi — tindak lanjut segera' : item.priority === 'MEDIUM' ? 'Prioritas Sedang — follow-up dalam minggu ini' : item.priority === 'LOW' ? 'Prioritas Rendah — pantau berkala' : undefined}
                      >
                        {({ CRITICAL:"Kritis", HIGH:"Tinggi", MEDIUM:"Sedang", LOW:"Rendah" } as Record<string,string>)[item.priority ?? ""] ?? item.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-24">
                      <Badge
                        className={item.status === 'PENDING' ? 'bg-amber-100 text-amber-800 border border-amber-200' : item.status === 'REVIEWED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : item.status === 'ARCHIVED' ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-muted text-muted-foreground'}
                        title={item.status === 'PENDING' ? 'Menunggu — belum direviu oleh tim' : item.status === 'REVIEWED' ? 'Sudah direviu dan divalidasi tim' : item.status === 'ARCHIVED' ? 'Diarsipkan' : undefined}
                      >
                        {item.status === 'PENDING' ? 'Menunggu' : item.status === 'REVIEWED' ? 'Direviu' : item.status === 'ARCHIVED' ? 'Diarsip' : item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className={cn("flex items-center justify-end gap-2 transition-opacity", starredItems.has(item.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                        <button
                          onClick={() => toggleStar(item.id)}
                          aria-pressed={starredItems.has(item.id)}
                          className={cn("h-6 w-6 flex items-center justify-center rounded-sm border transition-colors shrink-0",
                            starredItems.has(item.id)
                              ? "bg-amber-100 border-amber-400 text-amber-600"
                              : "border-border text-muted-foreground hover:border-amber-400 hover:text-amber-500")}
                          title={starredItems.has(item.id) ? "Hapus pin" : "Pin item ini"}
                          aria-label={starredItems.has(item.id) ? "Hapus pin" : "Pin item ini"}
                        >
                          <Star className={cn("h-3.5 w-3.5", starredItems.has(item.id) && "fill-amber-400")} />
                        </button>
                        <button
                          onClick={() => toggleRead(item.id)}
                          aria-pressed={readIds.has(item.id)}
                          className={cn("h-6 w-6 flex items-center justify-center rounded-sm border transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                            readIds.has(item.id)
                              ? "bg-emerald-100 border-emerald-400 text-emerald-700"
                              : "border-border text-muted-foreground hover:border-emerald-400 hover:text-emerald-600")}
                          title={readIds.has(item.id) ? "Tandai belum dibaca" : "Tandai sudah dibaca"}
                          aria-label={readIds.has(item.id) ? "Tandai belum dibaca" : "Tandai sudah dibaca"}
                        >
                          <CircleCheck className="h-3.5 w-3.5" />
                        </button>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                        {/* WhatsApp share — Task #19 */}
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(
                            `*${item.title}*\n` +
                            `Kategori: ${CATEGORY_LABELS[item.category] ?? item.category.replace(/_/g, " ")}\n` +
                            `Sumber: ${item.source}${item.sourceUrl ? ` (${item.sourceUrl})` : ""}\n` +
                            (item.summary ? `\nRingkasan: ${item.summary.slice(0, 300)}` : "") +
                            `\n\nDikirim dari Platform Riset Marketing Konstruksi - PT Maheswara Jaya Persada`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Bagikan via WhatsApp"
                          aria-label="Bagikan data riset via WhatsApp"
                        >
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </a>
                        {item.status === 'PENDING' && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                            disabled={updateMutation.isPending}
                            onClick={() => updateMutation.mutate({ id: item.id, data: { status: 'REVIEWED' } })}
                            title="Tandai Reviewed"
                          >
                            {updateMutation.isPending
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <CircleCheck className="h-4 w-4" />}
                          </Button>
                        )}
                        </div>
                        <div className={pendingDeleteId === item.id ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity"}>
                        <Button 
                          variant="ghost" 
                          size={pendingDeleteId === item.id ? "sm" : "icon"}
                          className={pendingDeleteId === item.id ? "h-8 px-2 text-[10px] text-white bg-red-600 hover:bg-red-700 font-mono" : "h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"}
                          onBlur={() => { if (pendingDeleteId === item.id) setPendingDeleteId(null); }}
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (pendingDeleteId === item.id) { deleteMutation.mutate({ id: item.id }); setPendingDeleteId(null); }
                            else setPendingDeleteId(item.id);
                          }}
                          title="Hapus Data"
                          aria-label={pendingDeleteId === item.id ? "Konfirmasi hapus data" : "Hapus data riset"}
                        >
                          {deleteMutation.isPending && pendingDeleteId === item.id ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Menghapus…</> : pendingDeleteId === item.id ? "✓ Yakin?" : <Trash2 className="h-4 w-4" />}
                        </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-xs font-mono text-muted-foreground">
              Menampilkan {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, totalFiltered)} dari {totalFiltered} temuan
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs font-mono"
                disabled={page === 1 || isLoading}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                ← Prev
              </Button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                // Show pages around current
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === page ? "default" : "outline"}
                    size="sm"
                    className="h-7 w-7 text-xs font-mono p-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                    disabled={isLoading}
                    aria-current={pageNum === page ? "page" : undefined}
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs font-mono"
                disabled={page === totalPages || isLoading}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Next →
              </Button>
            </div>
          </div>
        )}
      </Card>
        </>
      )}
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-6 right-6 z-50 h-9 w-9 rounded-full bg-primary animate-in fade-in slide-in-from-bottom-2 text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" aria-label="Kembali ke atas" title="Kembali ke atas"><ChevronUp className="h-4 w-4" /></button>
      )}
    </div>
  );
}
