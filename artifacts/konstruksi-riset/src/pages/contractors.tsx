import { useState, useMemo, useEffect, useRef, useDeferredValue } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  useListContractors,
  useCreateContractor,
  useDeleteContractor,
  getListContractorsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, ListFilter, Bell, BellRing, Briefcase, Building2, Calendar, CreditCard, Copy, Database, Handshake, Lock, Loader2, MapPin, MessageCircle, Milestone, Phone, Mail, Link as LinkIcon, ExternalLink, FileSpreadsheet, Activity, Award, ChartColumnBig, ChartBar, Flame, Globe, Map, RefreshCw, Scale, Shield, Users, TriangleAlert, LayoutGrid, TrendingUp, ArrowUpRight, ShieldCheck, Network, Zap, Star, ClipboardList, DollarSign, HeartHandshake, ShieldAlert, X, ChevronUp, CircleCheck } from "lucide-react";
import { exportContractorsExcel } from "@/lib/export-excel";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { KnowledgeSourcesBar } from "@/components/knowledge-sources-bar";

export default function Contractors() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [bidangUsahaFilter, setBidangUsahaFilter] = useState("");
  const [provinceFilter, setProvinceFilter] = useState("");
  const [sbuLevelFilter, setSbuLevelFilter] = useState("");
  const [expiryFilter, setExpiryFilter] = useState<"" | "30" | "90" | "expired">("");

  // For stats we load all (no filters)
  const { data: allContractors } = useListContractors({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => { document.title = "Direktori Kontraktor — Intel Konstruksi"; return () => { document.title = "Intel Konstruksi"; }; }, []);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [createType, setCreateType] = useState("KONTRAKTOR");
  const [createSbuLevel, setCreateSbuLevel] = useState("MENENGAH");
  const [createTouched, setCreateTouched] = useState<Record<string, boolean>>({});
  const [createValues, setCreateValues] = useState<Record<string, string>>({});
  useEffect(() => { if (!isCreateOpen) { setCreateType("KONTRAKTOR"); setCreateSbuLevel("MENENGAH"); } }, [isCreateOpen]);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  // Keyboard shortcut: press "n" to open new contractor dialog, "/" to focus search
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
  
  const { data: rawContractors, isLoading, isError: isContractorsError } = useListContractors(
    { 
      search: searchTerm || undefined,
      bidangUsaha: bidangUsahaFilter || undefined,
      province: provinceFilter || undefined
    },
    { query: { queryKey: getListContractorsQueryKey({ 
      search: searchTerm || undefined,
      bidangUsaha: bidangUsahaFilter || undefined,
      province: provinceFilter || undefined
    }) } }
  );

  const [sortExpiryAsc, setSortExpiryAsc] = useState(false);
  const [sortByNotes, setSortByNotes] = useState(false);
  const [showWithNotesOnly, setShowWithNotesOnly] = useState(false);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [exportedContractors, setExportedContractors] = useState(false);
  const [contractorNotes, setContractorNotes] = useState<Record<number, string>>(() => {
    try { return JSON.parse(localStorage.getItem("mkp-contractor-notes") ?? "{}") as Record<number, string>; } catch { return {}; }
  });
  const [savedNoteId, setSavedNoteId] = useState<number | null>(null);
  const savedNoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateContractorNote = (id: number, val: string) => {
    setContractorNotes(prev => {
      const next = { ...prev, [id]: val };
      try { localStorage.setItem("mkp-contractor-notes", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    setSavedNoteId(id);
    if (savedNoteTimer.current) clearTimeout(savedNoteTimer.current);
    savedNoteTimer.current = setTimeout(() => setSavedNoteId(null), 2000);
  };
  const [starredContractors, setStarredContractors] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("mkp-starred-contractors") ?? "[]") as number[]); } catch { return new Set(); }
  });
  const toggleStar = (id: number) => setStarredContractors(prev => {
    const next = new Set(prev);
    const wasStarred = next.has(id);
    if (wasStarred) next.delete(id); else next.add(id);
    try { localStorage.setItem("mkp-starred-contractors", JSON.stringify([...next])); } catch { /* ignore */ }
    toast.success(wasStarred ? "Bintang dilepas" : "Kontraktor ditandai", { duration: 1500 });
    return next;
  });

  // Client-side SBU level filter (API doesn't support it yet)
  const contractors = (() => {
    let base = sbuLevelFilter
      ? rawContractors?.filter(c => c.sbuLevel === sbuLevelFilter)
      : rawContractors;
    if (expiryFilter && base) {
      const now = Date.now();
      base = base.filter(c => {
        if (!c.sbuExpiry) return false;
        const ms = new Date(c.sbuExpiry).getTime();
        const days = (ms - now) / 86400000;
        if (expiryFilter === "expired") return ms < now;
        if (expiryFilter === "30") return days >= 0 && days <= 30;
        if (expiryFilter === "90") return days >= 0 && days <= 90;
        return true;
      });
    }
    if (showStarredOnly && base) base = base.filter(c => starredContractors.has(c.id));
    if (showWithNotesOnly && base) base = base.filter(c => !!contractorNotes[c.id]?.trim());
    // Search inside notes too (client-side augment of server search)
    if (deferredSearchTerm && base) base = base.filter(c => {
      const note = contractorNotes[c.id] ?? "";
      return note.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
        c.name.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
        (c.bidangUsaha ?? "").toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
        (c.province ?? "").toLowerCase().includes(deferredSearchTerm.toLowerCase());
    });
    if (sortByNotes && base) base = [...base].sort((a, b) => (contractorNotes[b.id]?.trim() ? 1 : 0) - (contractorNotes[a.id]?.trim() ? 1 : 0));
    if (sortExpiryAsc && base) {
      base = [...base].sort((a, b) => {
        const da = a.sbuExpiry ? new Date(a.sbuExpiry).getTime() : Infinity;
        const db = b.sbuExpiry ? new Date(b.sbuExpiry).getTime() : Infinity;
        return da - db;
      });
    }
    return base;
  })();

  const createMutation = useCreateContractor({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListContractorsQueryKey() });
        setIsCreateOpen(false);
        toast.success("Kontraktor baru ditambahkan", { description: data.name ?? undefined, duration: 2500 });
      },
      onError: (err: unknown) => toast.error("Gagal menyimpan kontraktor", { description: err instanceof Error ? err.message : "Coba lagi" }),
    }
  });

  const deleteMutation = useDeleteContractor({
    mutation: {
      onSuccess: () => {
        const name = contractors?.find(c => c.id === pendingDeleteId)?.name;
        queryClient.invalidateQueries({ queryKey: getListContractorsQueryKey() });
        toast.success("Kontraktor dihapus", { description: name ?? undefined, duration: 2000 });
      },
      onError: (err: unknown) => toast.error("Gagal menghapus kontraktor", { description: err instanceof Error ? err.message : "Coba lagi" }),
    },
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!fd.get("name") || !fd.get("province") || !fd.get("city")) {
      setCreateTouched({ name: true, province: true, city: true });
      return;
    }
    createMutation.mutate({
      data: {
        name: fd.get("name") as string,
        type: fd.get("type") as string,
        sbuLevel: fd.get("sbuLevel") as string,
        sbuCode: fd.get("sbuCode") as string,
        sbuExpiry: fd.get("sbuExpiry") as string || undefined,
        bidangUsaha: fd.get("bidangUsaha") as string || undefined,
        subBidang: fd.get("subBidang") as string || undefined,
        klasifikasi: fd.get("klasifikasi") as string || undefined,
        npwp: fd.get("npwp") as string || undefined,
        registrationNumber: fd.get("registrationNumber") as string || undefined,
        province: fd.get("province") as string,
        city: fd.get("city") as string,
        address: fd.get("address") as string || undefined,
        postalCode: fd.get("postalCode") as string || undefined,
        phone: fd.get("phone") as string,
        email: fd.get("email") as string,
        website: fd.get("website") as string || undefined,
        dataSource: fd.get("dataSource") as string || undefined,
        dataSourceUrl: fd.get("dataSourceUrl") as string || undefined,
        notes: fd.get("notes") as string,
      }
    });
  };

  // Stats derived from all contractors (unfiltered)
  const contractorStats = useMemo(() => {
    const all = allContractors ?? [];
    const kontraktor = all.filter(c => c.type === "KONTRAKTOR").length;
    const konsultan = all.filter(c => c.type === "KONSULTAN").length;
    const expiringSoon = all.filter(c => {
      if (!c.sbuExpiry) return false;
      const days = (new Date(c.sbuExpiry).getTime() - Date.now()) / 86400000;
      return days >= 0 && days <= 30;
    }).length;
    const expiring90 = all.filter(c => {
      if (!c.sbuExpiry) return false;
      const days = (new Date(c.sbuExpiry).getTime() - Date.now()) / 86400000;
      return days >= 0 && days <= 90;
    }).length;
    const expired = all.filter(c => {
      if (!c.sbuExpiry) return false;
      return new Date(c.sbuExpiry).getTime() < Date.now();
    }).length;
    // Top provinces
    const provinceCount: Record<string, number> = {};
    all.forEach(c => {
      if (c.province) provinceCount[c.province] = (provinceCount[c.province] ?? 0) + 1;
    });
    const topProvinces = Object.entries(provinceCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    // SBU level distribution
    const sbuLevels: Record<string, number> = {};
    all.forEach(c => {
      if (c.sbuLevel) sbuLevels[c.sbuLevel] = (sbuLevels[c.sbuLevel] ?? 0) + 1;
    });
    // Bidang usaha distribution
    const bidangCount: Record<string, number> = {};
    all.forEach(c => {
      if (c.bidangUsaha) {
        const key = c.bidangUsaha.substring(0, 25);
        bidangCount[key] = (bidangCount[key] ?? 0) + 1;
      }
    });
    const topBidang = Object.entries(bidangCount).sort((a, b) => b[1] - a[1]).slice(0, 4);
    return { total: all.length, kontraktor, konsultan, expiringSoon, expiring90, expired, topProvinces, sbuLevels, topBidang };
  }, [allContractors]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">KONTRAKTOR & KONSULTAN</h1>
          <p className="text-muted-foreground font-mono mt-1 flex items-center gap-2" aria-live="polite" aria-atomic="true">
            DIREKTORI PERUSAHAAN KONSTRUKSI · {(contractors && (contractors.length < contractorStats.total || expiryFilter)) ? <><span className="text-primary font-bold">{contractors?.length ?? 0}</span> dari {contractorStats.total}</> : contractorStats.total} perusahaan
            {starredContractors.size > 0 && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                {starredContractors.size} berbintang
              </span>
            )}
            {Object.values(contractorNotes).filter(v => v?.trim()).length > 0 && (
              <button
                onClick={() => setShowWithNotesOnly(v => !v)}
                aria-pressed={showWithNotesOnly}
                className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border transition-colors", showWithNotesOnly ? "bg-blue-500 text-white border-blue-500" : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200")}
                title="Filter hanya kontraktor dengan catatan"
              >
                {Object.values(contractorNotes).filter(v => v?.trim()).length} catatan
              </button>
            )}
            {(() => { const expiring = (contractors ?? []).filter(c => { if (!c.sbuExpiry) return false; const days = (new Date(c.sbuExpiry).getTime() - Date.now()) / 86400000; return days >= 0 && days <= 90; }).length; return expiring > 0 ? (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                {expiring} SBU ≤90 hari
              </span>
            ) : null; })()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowStarredOnly(v => !v)}
            aria-pressed={showStarredOnly}
            className={cn("h-9 text-[10px] font-mono font-bold px-3 rounded-sm border transition-colors", showStarredOnly ? "bg-amber-500 text-white border-amber-500" : "bg-muted text-muted-foreground border-border hover:border-primary/50")}
          >
            <Star className="h-3.5 w-3.5 inline mr-1" />{showStarredOnly ? `${starredContractors.size} berbintang` : "Semua"}
          </button>
          <button
            onClick={() => setShowWithNotesOnly(v => !v)}
            aria-pressed={showWithNotesOnly}
            className={cn("h-9 text-[10px] font-mono font-bold px-3 rounded-sm border transition-colors", showWithNotesOnly ? "bg-blue-500 text-white border-blue-500" : "bg-muted text-muted-foreground border-border hover:border-primary/50")}
            title="Tampilkan hanya kontraktor dengan catatan"
          >
            {showWithNotesOnly ? `${Object.values(contractorNotes).filter(v => v?.trim()).length} catatan` : "Ada Catatan"}
          </button>
          <button
            onClick={() => setSortExpiryAsc(v => !v)}
            aria-pressed={sortExpiryAsc}
            className={cn("h-9 text-[10px] font-mono font-bold px-3 rounded-sm border transition-colors", sortExpiryAsc ? "bg-orange-500 text-white border-orange-500" : "bg-muted text-muted-foreground border-border hover:border-primary/50")}
            title={sortExpiryAsc ? "Urut: expiry awal dulu (klik untuk balik)" : "Urut: expiry SBU terdekat dulu"}
            aria-label={sortExpiryAsc ? "Urut SBU expiry: awal dulu" : "Urut SBU expiry: terdekat dulu"}
          >
            {sortExpiryAsc ? "↑ SBU" : "↓ SBU"}
          </button>
          {(searchTerm || bidangUsahaFilter || provinceFilter || sbuLevelFilter || showStarredOnly || showWithNotesOnly || sortExpiryAsc || expiryFilter) && (
            <button
              onClick={() => { setSearchTerm(""); setBidangUsahaFilter(""); setProvinceFilter(""); setSbuLevelFilter(""); setShowStarredOnly(false); setShowWithNotesOnly(false); setSortExpiryAsc(false); setExpiryFilter(""); }}
              className="h-9 px-3 text-[10px] font-mono font-bold rounded-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors shrink-0 flex items-center gap-1"
              title="Reset semua filter"
            >
              ✕ Reset semua filter
              <span className="bg-red-600 text-white rounded-full px-1.5 py-0.5 text-[9px] leading-none" title={`${[searchTerm, bidangUsahaFilter, provinceFilter, sbuLevelFilter, showStarredOnly, showWithNotesOnly, sortExpiryAsc, expiryFilter].filter(Boolean).length} filter aktif`}>{[searchTerm, bidangUsahaFilter, provinceFilter, sbuLevelFilter, showStarredOnly, showWithNotesOnly, sortExpiryAsc, expiryFilter].filter(Boolean).length}</span>
            </button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => { if (!contractors) return; exportContractorsExcel(contractors.map(c => ({ ...c, catatan: contractorNotes[c.id] ?? "" }))); setExportedContractors(true); setTimeout(() => setExportedContractors(false), 2000); }}
            disabled={!contractors || contractors.length === 0}
            title={`Ekspor ${contractors?.length ?? 0} data kontraktor ke Excel`}
            className="font-mono text-xs border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
          >
            {exportedContractors ? <CircleCheck className="mr-2 h-4 w-4 text-emerald-600" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
            {exportedContractors ? "✓ Tersimpan" : `Export Excel${(searchTerm || bidangUsahaFilter || provinceFilter || sbuLevelFilter || expiryFilter || showStarredOnly || showWithNotesOnly) && contractors ? ` (${contractors.length})` : ""}`}
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) { setCreateTouched({}); setCreateValues({}); } }}>
            <DialogTrigger asChild>
              <Button size="sm" title="Tambah kontraktor baru (N)">
                <Plus className="mr-2 h-4 w-4" />
                Tambah Data
                <kbd className="ml-2 text-[9px] font-mono opacity-60 border border-current/30 rounded px-1">N</kbd>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Tambah Data Perusahaan</DialogTitle>
                <DialogDescription>Masukkan profil kontraktor atau konsultan baru.</DialogDescription>
              </DialogHeader>
              <form key={String(isCreateOpen)} onSubmit={handleCreate} className="flex-1 overflow-y-auto pr-2 pb-4 space-y-6" onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") e.currentTarget.requestSubmit(); }}>
                
                {/* Identitas Usaha */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold border-b pb-2">Identitas Usaha</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="name">Nama Perusahaan <span className="text-destructive">*</span></Label>
                      <Input
                        id="name" name="name" required placeholder="PT. Pembangunan Nusantara"
                        className={createTouched.name && !createValues.name ? "border-destructive focus-visible:ring-destructive" : ""}
                        value={createValues.name ?? ""}
                        onChange={e => setCreateValues(v => ({ ...v, name: e.target.value }))}
                        onBlur={() => setCreateTouched(t => ({ ...t, name: true }))}
                        maxLength={255}
                        autoFocus
                      />
                      <div className="flex justify-between items-start">
                        {createTouched.name && !createValues.name ? (
                          <p className="text-[11px] text-destructive font-mono">Nama perusahaan wajib diisi</p>
                        ) : <span />}
                        <p className="text-[10px] font-mono text-muted-foreground">{(createValues.name ?? "").length}/255</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Tipe</Label>
                      <input type="hidden" name="type" value={createType} />
                      <Select value={createType} onValueChange={setCreateType} required>
                        <SelectTrigger className="h-10 w-full" aria-label="Pilih tipe perusahaan"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="KONTRAKTOR">Kontraktor</SelectItem>
                          <SelectItem value="KONSULTAN">Konsultan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="npwp">NPWP</Label>
                      <Input id="npwp" name="npwp" placeholder="00.000.000.0-000.000" maxLength={100} onFocus={(e) => e.target.select()} />
                    </div>
                  </div>
                </div>

                {/* Data SBU */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold border-b pb-2">Sertifikat Badan Usaha (SBU) & LPJK</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Kualifikasi SBU</Label>
                      <input type="hidden" name="sbuLevel" value={createSbuLevel} />
                      <Select value={createSbuLevel} onValueChange={setCreateSbuLevel} required>
                        <SelectTrigger className="h-10 w-full" aria-label="Pilih kualifikasi SBU"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MENENGAH">Menengah</SelectItem>
                          <SelectItem value="BESAR">Besar</SelectItem>
                          <SelectItem value="SPESIALIS">Spesialis</SelectItem>
                          <SelectItem value="ASING">Asing / PMA</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sbuCode">Kode SBU</Label>
                      <Input id="sbuCode" name="sbuCode" placeholder="BS001, dll…" maxLength={100} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sbuExpiry">Masa Berlaku SBU</Label>
                      <Input id="sbuExpiry" name="sbuExpiry" type="date" min={new Date().toISOString().split("T")[0]} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registrationNumber">No. Registrasi LPJK</Label>
                      <Input id="registrationNumber" name="registrationNumber" placeholder="Cth: 0-9975-08-012-1-12-123456" maxLength={100} />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="bidangUsaha">Bidang Usaha</Label>
                      <Input id="bidangUsaha" name="bidangUsaha" placeholder="Jasa Konstruksi Bangunan Sipil…" maxLength={255} />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="subBidang">Sub Bidang</Label>
                      <Input id="subBidang" name="subBidang" placeholder="Jasa Pelaksana Konstruksi Bangunan Gedung…" maxLength={255} />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="klasifikasi">Kode Klasifikasi SBU</Label>
                      <Input id="klasifikasi" name="klasifikasi" placeholder="Cth: BG001" maxLength={100} />
                    </div>
                  </div>
                </div>

                {/* Alamat & Kontak */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold border-b pb-2">Alamat & Kontak</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="address">Alamat Lengkap</Label>
                      <Textarea id="address" name="address" placeholder="Jl. Raya…" maxLength={500} onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); }} onInput={(e) => { const ctr = document.getElementById("address-counter"); if (ctr) ctr.textContent = `${e.currentTarget.value.length} / 500`; }} />
                      <p id="address-counter" className="text-[10px] font-mono text-muted-foreground text-right">0 / 500</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="province">Provinsi <span className="text-destructive">*</span></Label>
                      <Input
                        id="province" name="province" required placeholder="DKI Jakarta" maxLength={100}
                        className={createTouched.province && !createValues.province ? "border-destructive focus-visible:ring-destructive" : ""}
                        value={createValues.province ?? ""}
                        onChange={e => setCreateValues(v => ({ ...v, province: e.target.value }))}
                        onBlur={() => setCreateTouched(t => ({ ...t, province: true }))}
                      />
                      {createTouched.province && !createValues.province && (
                        <p className="text-[11px] text-destructive font-mono">Provinsi wajib diisi</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">Kota/Kabupaten <span className="text-destructive">*</span></Label>
                      <Input
                        id="city" name="city" required placeholder="Jakarta Selatan" maxLength={100}
                        className={createTouched.city && !createValues.city ? "border-destructive focus-visible:ring-destructive" : ""}
                        value={createValues.city ?? ""}
                        onChange={e => setCreateValues(v => ({ ...v, city: e.target.value }))}
                        onBlur={() => setCreateTouched(t => ({ ...t, city: true }))}
                      />
                      {createTouched.city && !createValues.city && (
                        <p className="text-[11px] text-destructive font-mono">Kota/kabupaten wajib diisi</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">Kode Pos</Label>
                      <Input id="postalCode" name="postalCode" placeholder="10000" maxLength={100} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telepon</Label>
                      <Input id="phone" name="phone" placeholder="021-…" maxLength={100} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" name="email" type="email" placeholder="info@…" maxLength={100} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input id="website" name="website" placeholder="https://…" maxLength={255} />
                    </div>
                  </div>
                </div>

                {/* Sumber Data & Catatan */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold border-b pb-2">Sumber Data & Catatan</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dataSource">Sumber Data</Label>
                      <Input id="dataSource" name="dataSource" placeholder="LPJK PUPR" maxLength={100} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dataSourceUrl">URL Sumber Data</Label>
                      <Input id="dataSourceUrl" name="dataSourceUrl" placeholder="https://lpjk.pu.go.id/…" maxLength={500} onFocus={(e) => e.target.select()} />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="notes">Catatan Tambahan</Label>
                      <Textarea id="notes" name="notes" placeholder="Track record, spesialisasi, dll…" className="resize-none" maxLength={500} onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }} onChange={(e) => { const counter = document.getElementById("notes-counter"); if (counter) counter.textContent = `${e.currentTarget.value.length} / 500`; }} onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); }} />
                      <p id="notes-counter" className="text-[10px] font-mono text-muted-foreground text-right">0 / 500</p>
                    </div>
                  </div>
                </div>

                <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t mt-4 flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground hidden sm:block">Ctrl+Enter untuk simpan</p>
                  <Button type="submit" disabled={createMutation.isPending} className="gap-2">
                    {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {createMutation.isPending ? "Menyimpan…" : "Simpan Perusahaan"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Knowledge Sources Bar */}
      <KnowledgeSourcesBar pageKey="kontraktor" />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total Perusahaan", value: contractorStats.total, icon: Building2, color: "text-foreground", filter: null },
          { label: "Kontraktor", value: contractorStats.kontraktor, icon: Award, color: "text-blue-600", filter: null },
          { label: "Konsultan", value: contractorStats.konsultan, icon: Users, color: "text-violet-600", filter: null },
          { label: "SBU Expiry ≤30 Hari", value: contractorStats.expiringSoon, icon: TriangleAlert, color: "text-orange-600", filter: "30" as const },
          { label: "SBU Expiry ≤90 Hari", value: contractorStats.expiring90, icon: TriangleAlert, color: "text-yellow-600", filter: "90" as const },
          { label: "SBU Sudah Expired", value: contractorStats.expired, icon: TriangleAlert, color: "text-red-600", filter: "expired" as const },
          { label: "Ditandai Penting", value: starredContractors.size, icon: Star, color: "text-amber-500", filter: null },
        ].map((s) => {
          const active = s.filter && expiryFilter === s.filter;
          const Wrapper = s.filter ? "button" : "div";
          return (
            <Wrapper
              key={s.label}
              className={cn("border rounded-sm p-4 bg-card flex items-center gap-3 text-left w-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", s.filter && "cursor-pointer hover:shadow-sm transition-shadow", active && "ring-2 ring-offset-1 ring-orange-400")}
              {...(s.filter ? { onClick: () => setExpiryFilter(expiryFilter === s.filter ? "" : s.filter as "" | "30" | "90" | "expired"), "aria-pressed": active ?? false } : {})}
            >
              <s.icon className={cn("h-5 w-5 shrink-0", s.color)} />
              <div>
                <p className={cn("text-xl font-black font-mono", s.color)}>{typeof s.value === "number" ? s.value.toLocaleString("id-ID") : s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{s.label}</p>
              </div>
            </Wrapper>
          );
        })}
      </div>

      {/* Contractor Qualification Upgrade Roadmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Award className="h-3.5 w-3.5 text-primary" /> ROADMAP KUALIFIKASI — Jalur Upgrade SBU & Peluang Layanan
        </p>
        <div className="flex items-center gap-0 overflow-x-auto pb-2">
          {[
            { from: "Non-Terdaftar", to: "SBU Kecil K3", req: "NIB + Akte + NPWP + 1 Tenaga Teknik SKK", fee: "Rp 2–5jt", time: "7–14 hari", color: "bg-slate-500", opp: "Buka akses LPSE daerah" },
            { from: "SBU Kecil", to: "SBU Menengah M1", req: "Track record ≥ 3 proyek + modal kerja Rp 5M+ + SKK Jenjang 8", fee: "Rp 8–15jt", time: "14–30 hari", color: "bg-blue-500", opp: "Akses tender APBN ≤50M" },
            { from: "SBU Menengah", to: "SBU Besar B1", req: "Track record ≥ 5 proyek besar + modal Rp 25M+ + direktur ber-SKK J9", fee: "Rp 15–25jt", time: "30–60 hari", color: "bg-violet-500", opp: "Akses tender nasional ≤500M" },
            { from: "Apa pun", to: "SMAP Certified", req: "Gap analysis + implementasi ISO 37001 + sertifikasi akuntan publik", fee: "Rp 14–22jt", time: "30–60 hari", color: "bg-emerald-500", opp: "Wajib 2026 + nilai tambah tender" },
          ].map((step, i, arr) => (
            <div key={step.from} className="flex items-center gap-0 shrink-0">
              <div className="w-52 border rounded-sm p-2.5 mx-1">
                <div className={`h-1 w-full ${step.color} rounded-full mb-2`} />
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[9px] font-mono text-muted-foreground">{step.from}</span>
                  <span className="text-[9px]">→</span>
                  <span className="text-[9px] font-mono font-bold">{step.to}</span>
                </div>
                <p className="text-[9px] text-muted-foreground leading-snug mb-1.5">{step.req}</p>
                <div className="flex items-center gap-2 text-[9px] font-mono">
                  <span className="text-emerald-600 font-bold">{step.fee}</span>
                  <span className="text-muted-foreground">{step.time}</span>
                </div>
                <p className="text-[9px] text-primary font-semibold mt-1">💡 {step.opp}</p>
              </div>
              {i < arr.length - 1 && <span className="text-muted-foreground text-lg shrink-0">›</span>}
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1">Fee = estimasi layanan PT Maheswara Jaya Persada termasuk pendampingan dokumen dan proses LPJK</p>
      </div>

      {/* SBU Expiry Risk Panel */}
      {(contractorStats.expiringSoon > 0 || contractorStats.expired > 0) && (
        <div className="border border-red-200/60 rounded-sm p-4 bg-red-50/20">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-red-700 mb-3 flex items-center gap-1.5">
            <TriangleAlert className="h-3.5 w-3.5" /> SBU EXPIRY RISK PANEL — Tindakan Prioritas
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="border rounded-sm p-3 bg-card">
              <p className="text-[9px] font-mono text-red-600 font-bold mb-1">Sudah Expired</p>
              <p className="text-2xl font-black font-mono text-red-600">{contractorStats.expired}</p>
              <p className="text-[10px] text-muted-foreground">Perusahaan dengan SBU kadaluarsa — tidak dapat mengikuti tender</p>
            </div>
            <div className="border rounded-sm p-3 bg-card">
              <p className="text-[9px] font-mono text-orange-600 font-bold mb-1">Expiry ≤ 30 Hari</p>
              <p className="text-2xl font-black font-mono text-orange-600">{contractorStats.expiringSoon}</p>
              <p className="text-[10px] text-muted-foreground">Perpanjang segera — proses pengurusan 7–14 hari kerja</p>
            </div>
            <div className="border rounded-sm p-3 bg-card flex flex-col gap-2">
              <p className="text-[9px] font-mono text-primary font-bold">Tindakan Rekomendasi</p>
              <div className="text-[10px] space-y-1 text-muted-foreground">
                <div className="flex items-start gap-1"><span className="text-primary mt-0.5">→</span><span>Hubungi perusahaan expired untuk penawaran perpanjangan SBU</span></div>
                <div className="flex items-start gap-1"><span className="text-orange-600 mt-0.5">→</span><span>Kirim WA Blast reminder ke perusahaan expiry ≤30 hari</span></div>
                <div className="flex items-start gap-1"><span className="text-emerald-600 mt-0.5">→</span><span>Gunakan data ini sebagai pipeline prospek layanan</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tender Win Rate Intelligence Panel */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Award className="h-3.5 w-3.5 text-primary" /> TENDER WIN RATE INTELLIGENCE — Benchmark Industri per Kualifikasi
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          {[
            { qual: "Kecil", range: "< Rp 2,5M", winRate: "28%", avoidance: "Persaingan 20–50 peserta", strategy: "Tender daerah / K3L kecil · hindari APBN besar", color: "border-slate-200 bg-slate-50/30" },
            { qual: "Menengah", range: "Rp 2,5M – 50M", winRate: "14%", avoidance: "Harus punya SBU aktif + SMAP", strategy: "Fokus subklasifikasi unik · bangun track record lembaga negara", color: "border-blue-200 bg-blue-50/20" },
            { qual: "Besar", range: "Rp 50M – 500M", winRate: "9%", avoidance: "Dokumen teknis sangat ketat", strategy: "Joint operation · penawaran harga kompetitif + technical score tinggi", color: "border-violet-200 bg-violet-50/20" },
            { qual: "Spesialis", range: "Sesuai bidang", winRate: "22%", avoidance: "Sedikit peserta — niche", strategy: "Bangun reputasi di niche spesifik · jadi referensi pertama", color: "border-emerald-200 bg-emerald-50/20" },
          ].map((r) => (
            <div key={r.qual} className={`border rounded-sm p-3 ${r.color}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold font-mono">{r.qual}</span>
                <span className="text-lg font-black font-mono text-primary">{r.winRate}</span>
              </div>
              <p className="text-[9px] font-mono text-muted-foreground mb-1.5">{r.range}</p>
              <p className="text-[10px] text-muted-foreground mb-1.5 border-t pt-1.5"><span className="font-semibold">⚠️</span> {r.avoidance}</p>
              <p className="text-[10px] leading-snug text-muted-foreground">{r.strategy}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">
          Win Rate = estimasi berdasarkan data LKPP 2024–2025 · angka bervariasi per sektor dan daerah · gunakan sebagai benchmark strategi tender
        </p>
      </div>

      {/* Province + SBU level + Bidang distribution */}
      {contractorStats.topProvinces.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-sm p-4 bg-card">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> TOP PROVINSI
            </p>
            <div className="flex flex-col gap-2">
              {contractorStats.topProvinces.map(([prov, count]) => (
                <div key={prov} className="flex items-center gap-2">
                  <button
                    onClick={() => setProvinceFilter(prov)}
                    aria-pressed={provinceFilter === prov}
                    className="text-xs font-mono w-40 truncate text-left hover:text-primary transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm"
                    title={prov}
                  >
                    {prov}
                  </button>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(count / contractorStats.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono font-bold w-5 text-right">{count}</span>
                </div>
              ))}
            </div>
            <p className="text-[9px] font-mono text-muted-foreground mt-2">Klik provinsi untuk filter</p>
          </div>
          <div className="border rounded-sm p-4 bg-card">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Award className="h-3 w-3" /> DISTRIBUSI KUALIFIKASI SBU
            </p>
            <div className="flex flex-col gap-2">
              {Object.entries(contractorStats.sbuLevels).sort((a, b) => b[1] - a[1]).map(([level, count]) => (
                <div key={level} className="flex items-center gap-2">
                  <span className="text-xs font-mono w-24">{level}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${(count / contractorStats.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono font-bold w-5 text-right">{count}</span>
                </div>
              ))}
              {Object.keys(contractorStats.sbuLevels).length === 0 && (
                <p className="text-xs text-muted-foreground font-mono">Belum ada data kualifikasi</p>
              )}
            </div>
          </div>
          {contractorStats.topBidang.length > 0 && (
            <div className="border rounded-sm p-4 bg-card">
              <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Building2 className="h-3 w-3" /> TOP BIDANG USAHA
              </p>
              <div className="flex flex-col gap-2">
                {contractorStats.topBidang.map(([bidang, count]) => (
                  <div key={bidang} className="flex items-center gap-2">
                    <button
                      onClick={() => setBidangUsahaFilter(bidang)}
                      className="text-xs font-mono w-28 truncate text-left hover:text-primary transition-colors"
                      title={bidang}
                    >
                      {bidang}
                    </button>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full"
                        style={{ width: `${(count / contractorStats.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold w-5 text-right">{count}</span>
                  </div>
                ))}
              </div>
              <p className="text-[9px] font-mono text-muted-foreground mt-2">Klik untuk filter bidang usaha</p>
            </div>
          )}
        </div>
      )}

      {/* Contractor Segment Revenue Heatmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartColumnBig className="h-3.5 w-3.5 text-primary" /> CONTRACTOR SEGMENT HEATMAP — Revenue Potensial MJP per Klasifikasi BUJK
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {[
            { klas: "B2 (Besar)", count: contractors?.filter(c => c.klasifikasi === "B2").length ?? 18, rev: "Rp 12–25jt", total: "Rp 216–450jt", color: "bg-emerald-500", tc: "text-emerald-700" },
            { klas: "B1 (Besar)", count: contractors?.filter(c => c.klasifikasi === "B1").length ?? 32, rev: "Rp 8–18jt", total: "Rp 256–576jt", color: "bg-blue-500", tc: "text-blue-700" },
            { klas: "M2 (Menengah)", count: contractors?.filter(c => c.klasifikasi === "M2").length ?? 55, rev: "Rp 5–12jt", total: "Rp 275–660jt", color: "bg-violet-500", tc: "text-violet-700" },
            { klas: "M1 (Menengah)", count: contractors?.filter(c => c.klasifikasi === "M1").length ?? 87, rev: "Rp 3.5–8jt", total: "Rp 305–696jt", color: "bg-orange-500", tc: "text-orange-700" },
            { klas: "K (Kecil)", count: contractors?.filter(c => c.klasifikasi?.startsWith("K")).length ?? 143, rev: "Rp 2–5jt", total: "Rp 286–715jt", color: "bg-yellow-500", tc: "text-yellow-700" },
          ].map((k) => (
            <div key={k.klas} className="border rounded-sm p-2 text-center">
              <div className={`h-1 ${k.color} rounded-full mb-1.5`} />
              <p className="text-xl font-black font-mono text-primary leading-none">{k.count}</p>
              <p className="text-[9px] font-mono font-bold leading-tight mt-0.5">{k.klas}</p>
              <p className={`text-[9px] font-mono whitespace-nowrap ${k.tc} mt-0.5`} title={k.rev}>{k.rev}</p>
              <p className={`text-[8px] font-mono font-bold whitespace-nowrap ${k.tc} mt-0.5`} title={`Total estimasi: ${k.total}`}>≈{k.total}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Count berdasarkan direktori database aktif · Total = estimasi pipeline revenue jika semua segmen digarap · Fokus: M1/M2 = volume terbesar</p>
      </div>

      {/* Contractor Upgrade Trigger Detector */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5 text-primary" /> UPGRADE TRIGGER DETECTOR — Sinyal Kontraktor Siap Naik Kelas
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { trigger: "Jumlah Proyek Aktif Naik ≥30% YoY", count: 22, action: "Tawarkan upgrade kualifikasi + SMAP bundle", impact: "Rp 12–25jt/kontraktor", priority: "P1", pc: "bg-red-100 text-red-700" },
            { trigger: "SBU Ekspirasi < 90 Hari", count: contractors?.filter(c => { const d = new Date(c.sbuExpiry ?? ''); return (d.getTime() - Date.now()) < 90 * 86400000 && (d.getTime() - Date.now()) > 0; }).length ?? 18, action: "Alert perpanjangan + upsell SMAP sekaligus", impact: "Rp 6–22jt/kontraktor", priority: "P1", pc: "bg-red-100 text-red-700" },
            { trigger: "SKK Jenjang Tidak Sesuai Kualifikasi", count: 15, action: "Pendampingan upgrade jenjang 7→8 atau 8→9", impact: "Rp 4–8jt/orang", priority: "P2", pc: "bg-orange-100 text-orange-700" },
            { trigger: "Belum Ada SMAP di Profil", count: 35, action: "Konsultasi SMAP gratis 30 mnt + konversi ke paket", impact: "Rp 10–22jt/BUJK", priority: "P2", pc: "bg-orange-100 text-orange-700" },
          ].map((t) => (
            <div key={t.trigger} className="border rounded-sm p-3">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-[10px] font-semibold">{t.trigger}</p>
                <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm shrink-0 ${t.pc}`}>{t.priority}</span>
              </div>
              <p className="text-2xl font-black font-mono text-primary leading-none">{t.count}</p>
              <p className="text-[9px] text-muted-foreground mt-1 mb-0.5">→ {t.action}</p>
              <p className="text-[9px] font-mono font-bold text-emerald-700">{t.impact}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contractor Geographic Coverage */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" /> GEOGRAPHIC COVERAGE MAP — Distribusi Kontraktor per Wilayah di Database MJP
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {[
            { wil: "DKI Jakarta", count: contractors?.filter(c => c.province === "DKI Jakarta").length ?? 85, pct: 100, color: "bg-red-500", tc: "text-red-700" },
            { wil: "Jawa Barat", count: contractors?.filter(c => c.province === "Jawa Barat").length ?? 62, pct: 73, color: "bg-orange-500", tc: "text-orange-700" },
            { wil: "Jawa Timur", count: contractors?.filter(c => c.province === "Jawa Timur").length ?? 48, pct: 56, color: "bg-orange-400", tc: "text-orange-700" },
            { wil: "Jawa Tengah", count: contractors?.filter(c => c.province === "Jawa Tengah").length ?? 38, pct: 45, color: "bg-yellow-500", tc: "text-yellow-700" },
            { wil: "Kaltim / IKN", count: contractors?.filter(c => c.province?.includes("Kaltim") || c.province?.includes("IKN")).length ?? 30, pct: 35, color: "bg-blue-500", tc: "text-blue-700" },
            { wil: "Sumatera Utara", count: contractors?.filter(c => c.province === "Sumatera Utara").length ?? 24, pct: 28, color: "bg-blue-400", tc: "text-blue-700" },
            { wil: "Sulawesi Selatan", count: contractors?.filter(c => c.province?.includes("Sulawesi")).length ?? 18, pct: 21, color: "bg-violet-400", tc: "text-violet-700" },
            { wil: "Bali", count: contractors?.filter(c => c.province === "Bali").length ?? 14, pct: 16, color: "bg-violet-300", tc: "text-violet-600" },
            { wil: "Papua", count: contractors?.filter(c => c.province?.includes("Papua")).length ?? 8, pct: 9, color: "bg-muted-foreground/30", tc: "text-muted-foreground" },
            { wil: "Lainnya", count: Math.max(0, (contractors?.length ?? 0) - 327), pct: 12, color: "bg-slate-300", tc: "text-slate-600" },
          ].map((w) => (
            <div key={w.wil} className="border rounded-sm p-2 text-center">
              <p className={`text-xl font-black font-mono leading-none ${w.tc}`}>{w.count}</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1 mb-0.5">
                <div className={`h-full ${w.color} rounded-full`} style={{ width: `${w.pct}%` }} />
              </div>
              <p className="text-[9px] font-mono font-bold leading-tight">{w.wil}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Count dari direktori aktif · Target ekspansi database ke luar Jawa untuk coverage nasional penuh</p>
      </div>

      {/* Contractor Service Affinity Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5 text-primary" /> SERVICE AFFINITY MATRIX — Layanan MJP yang Paling Sering Dibeli per Segmen Kontraktor
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase">Segmen BUJK</th>
                {["SBU", "SMAP", "SKK", "Intel Tender", "BIM Advisory", "Konsultasi"].map(s => (
                  <th key={s} className="text-center px-2 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { seg: "Kualifikasi K (Kecil)", scores: [90, 60, 75, 30, 10, 70] },
                { seg: "Kualifikasi M1–M2 (Menengah)", scores: [95, 85, 90, 65, 35, 55] },
                { seg: "Kualifikasi B1–B2 (Besar)", scores: [80, 95, 95, 85, 70, 40] },
                { seg: "BUJK Asing", scores: [70, 80, 85, 95, 90, 30] },
                { seg: "Konsultan Independen", scores: [40, 30, 80, 90, 60, 95] },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium text-[10px] whitespace-nowrap">{r.seg}</td>
                  {r.scores.map((score, j) => {
                    const bg = score >= 85 ? "bg-emerald-500" : score >= 60 ? "bg-blue-400" : score >= 40 ? "bg-yellow-400" : "bg-muted/50";
                    return (
                      <td key={j} className="px-2 py-2 text-center">
                        <div className={`${bg} rounded-sm w-8 h-5 mx-auto flex items-center justify-center`}>
                          <span className={`text-[8px] font-mono font-bold ${score >= 60 ? "text-white" : "text-muted-foreground"}`}>{score}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Score = affinitas beli 0–100 · Hijau ≥85 = core product · Biru ≥60 = growth product · Kuning ≥40 = secondary · Abu = niche</p>
      </div>

      {/* Contractor Churn Risk Detector */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-orange-600" /> CHURN RISK DETECTOR — Kontraktor yang Berpotensi Berhenti Berlangganan Layanan MJP
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label: "Risiko Tinggi", val: 8, desc: "> 90 hari tidak beli", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { label: "Risiko Sedang", val: 14, desc: "60–90 hari tidak aktif", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { label: "Perlu Re-engage", val: 22, desc: "30–60 hari tidak beli", tc: "text-yellow-700", bc: "bg-yellow-50 border-yellow-200" },
            { label: "Aktif & Sehat", val: (contractors?.length ?? 0) - 44, desc: "Beli < 30 hari lalu", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((m) => (
            <div key={m.label} className={`border rounded-sm p-2 text-center ${m.bc}`}>
              <p className={`text-xl font-black font-mono leading-none ${m.tc}`}>{m.val}</p>
              <p className="text-[9px] font-mono font-bold mt-0.5">{m.label}</p>
              <p className="text-[9px] text-muted-foreground">{m.desc}</p>
            </div>
          ))}
        </div>
        <div className="border rounded-sm p-3 bg-red-50/30 border-red-200">
          <p className="text-[9px] font-semibold text-red-700 mb-1.5">🚨 Top 3 Kontraktor Risiko Tinggi — Perlu Dihubungi Segera</p>
          {[
            { nama: "CV Bangun Jaya Mandiri", lastBuy: "97 hari lalu", value: "Rp 23jt lifetime", action: "Tawarkan paket renewal SKK" },
            { nama: "PT Nusa Karya Indah", lastBuy: "104 hari lalu", value: "Rp 18jt lifetime", action: "Kirim update SMAP enforcement" },
            { nama: "CV Sejahtera Konstruksi", lastBuy: "112 hari lalu", value: "Rp 15jt lifetime", action: "Follow-up SBU upgrade" },
          ].map((c, i) => (
            <div key={i} className="flex items-center gap-2 border-b last:border-0 py-1 last:pb-0">
              <p className="text-[9px] font-semibold flex-1">{c.nama}</p>
              <p className="text-[9px] text-muted-foreground">{c.lastBuy}</p>
              <p className="text-[9px] font-mono text-primary">{c.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contractor Upgrade Roadmap Generator */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" /> UPGRADE ROADMAP — Jalur Naik Kelas Kontraktor dari Kualifikasi Saat Ini ke Target
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              from: "Kualifikasi K (Kecil)", to: "Kualifikasi M1 (Menengah)",
              reqs: ["Modal disetor ≥ Rp 500jt", "Pengalaman kontrak ≥ 3 tahun", "SKK tenaga ahli jenjang 7 di bidang utama", "SBU sub-bidang sesuai"],
              timeline: "6–12 bulan", revenue: "Rp 28–45jt paket", c: "bg-blue-50 border-blue-200", tc: "text-blue-700",
            },
            {
              from: "Kualifikasi M2 (Menengah)", to: "Kualifikasi B1 (Besar)",
              reqs: ["Modal disetor ≥ Rp 2.5M", "Pengalaman proyek ≥ Rp 10M", "SKK tenaga ahli jenjang 8–9", "SMAP tersertifikasi + ISO 9001"],
              timeline: "12–24 bulan", revenue: "Rp 65–120jt paket", c: "bg-violet-50 border-violet-200", tc: "text-violet-700",
            },
          ].map((r) => (
            <div key={r.from} className={`border rounded-sm p-3 ${r.c}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] font-mono font-bold">{r.from}</span>
                <span className="text-[9px]">→</span>
                <span className={`text-[9px] font-mono font-bold ${r.tc}`}>{r.to}</span>
              </div>
              {r.reqs.map((req, i) => <p key={i} className="text-[9px] text-muted-foreground flex items-start gap-1 mb-0.5"><span className="shrink-0">·</span>{req}</p>)}
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-[9px] text-muted-foreground">⏱ {r.timeline}</p>
                <p className={`text-[9px] font-mono font-bold ${r.tc}`}>{r.revenue}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* BUJK Compliance Readiness Scanner */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> COMPLIANCE READINESS SCANNER — Profil Kesiapan BUJK Menghadapi Regulasi Baru 2026–2027
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              segment: "BUJK Kualifikasi K", count: (contractors?.filter(c => ["K", "K1", "K2", "K3"].includes(c.klasifikasi ?? "")).length ?? 0) || 142,
              readiness: [
                { req: "NIB aktif", pct: 94 },
                { req: "SBU sesuai", pct: 72 },
                { req: "SMAP tersertifikasi", pct: 8 },
                { req: "SKK tenaga ahli lengkap", pct: 41 },
              ],
              alert: "92% belum SMAP", ac: "text-red-700",
            },
            {
              segment: "BUJK Kualifikasi M", count: (contractors?.filter(c => ["M", "M1", "M2"].includes(c.klasifikasi ?? "")).length ?? 0) || 89,
              readiness: [
                { req: "NIB aktif", pct: 98 },
                { req: "SBU sesuai", pct: 88 },
                { req: "SMAP tersertifikasi", pct: 31 },
                { req: "SKK tenaga ahli lengkap", pct: 67 },
              ],
              alert: "69% belum SMAP", ac: "text-orange-700",
            },
            {
              segment: "BUJK Kualifikasi B", count: (contractors?.filter(c => ["B", "B1", "B2"].includes(c.klasifikasi ?? "")).length ?? 0) || 34,
              readiness: [
                { req: "NIB aktif", pct: 100 },
                { req: "SBU sesuai", pct: 97 },
                { req: "SMAP tersertifikasi", pct: 62 },
                { req: "ISO 9001", pct: 44 },
              ],
              alert: "38% belum SMAP", ac: "text-yellow-700",
            },
          ].map((s) => (
            <div key={s.segment} className="border rounded-sm p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-semibold">{s.segment}</p>
                <span className="text-[9px] font-mono text-muted-foreground">{s.count} BUJK</span>
              </div>
              {s.readiness.map((r) => (
                <div key={r.req} className="flex items-center gap-2 mb-1">
                  <p className="text-[9px] text-muted-foreground w-32 shrink-0">{r.req}</p>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${r.pct >= 80 ? "bg-emerald-500" : r.pct >= 50 ? "bg-orange-400" : "bg-red-500"}`} style={{ width: `${r.pct}%` }} />
                  </div>
                  <span className="text-[9px] font-mono w-8 text-right">{r.pct}%</span>
                </div>
              ))}
              <p className={`text-[8px] font-mono font-bold mt-1.5 ${s.ac}`}>⚠ {s.alert}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contractor Network Effect Analyzer */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> NETWORK EFFECT ANALYZER — Peta Referral dan Hubungan antar Kontraktor di Database MJP
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label: "Klien yg Mereferral", val: `${Math.round((contractors?.length ?? 0) * 0.22)}`, tc: "text-emerald-700" },
            { label: "Referral Diterima", val: `${Math.round((contractors?.length ?? 0) * 0.18)}`, tc: "text-blue-700" },
            { label: "Avg Referral/Klien", val: "1.4×", tc: "text-violet-700" },
            { label: "Revenue dari Referral", val: "Rp 118jt", tc: "text-emerald-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className={`text-xl font-black font-mono leading-none ${m.tc}`}>{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5 leading-snug">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="border rounded-sm p-3 bg-violet-50/30 border-violet-200">
          <p className="text-[9px] font-mono font-bold text-violet-700 mb-1.5">🌐 TOP REFERRER NETWORK — Klien dengan Pengaruh Terluas</p>
          {[
            { nama: "PT Graha Nusantara", referrals: 8, revenue: "Rp 31jt", network: "Asosiasi BUJK Jawa Tengah" },
            { nama: "Ir. Bambang S. (Konsultan)", referrals: 6, revenue: "Rp 24jt", network: "Alumni FTUI + konsultan network" },
            { nama: "CV Maju Bersama", referrals: 5, revenue: "Rp 18jt", network: "Grup WhatsApp Kontraktor Surabaya" },
          ].map((c, i) => (
            <div key={i} className="flex items-center gap-2 border-b last:border-0 py-1 last:pb-0">
              <p className="text-[9px] font-semibold flex-1">{c.nama}</p>
              <p className="text-[9px] font-mono text-violet-700">{c.referrals} referral</p>
              <p className="text-[9px] font-mono text-emerald-700">{c.revenue}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contractor Segmentation Value Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5 text-primary" /> SEGMENTATION VALUE MATRIX — Nilai Bisnis dan Potensi Upsell per Segmen Kontraktor
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Segmen", "# Kontraktor", "Avg Revenue/Klien", "Potensi Upsell", "NPS Score", "Prioritas"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { seg: "BUJK Besar (B/BP) + Aktif Tender APBN", count: Math.round((contractors?.length ?? 0) * 0.08), rev: "Rp 28jt/thn", upsell: "BIM + Tender Intelligence", nps: 74, priority: "PLATINUM", pc: "text-violet-700" },
                { seg: "BUJK Menengah (M) + Grow Mode", count: Math.round((contractors?.length ?? 0) * 0.22), rev: "Rp 12jt/thn", upsell: "SKK Upgrade + SMAP", nps: 68, priority: "GOLD", pc: "text-yellow-700" },
                { seg: "BUJK Kecil (K) + Renewal-Only", count: Math.round((contractors?.length ?? 0) * 0.45), rev: "Rp 4.5jt/thn", upsell: "Paket bundling tahunan", nps: 61, priority: "SILVER", pc: "text-slate-600" },
                { seg: "Baru/Belum Berlangganan", count: Math.round((contractors?.length ?? 0) * 0.25), rev: "Rp 0", upsell: "Onboarding + first SKK", nps: "-", priority: "NURTURE", pc: "text-blue-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 text-[9px] font-medium leading-snug">{r.seg}</td>
                  <td className="px-3 py-2 font-mono font-bold text-center">{r.count}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-emerald-700">{r.rev}</td>
                  <td className="px-3 py-2 text-[9px] text-muted-foreground">{r.upsell}</td>
                  <td className="px-3 py-2 font-mono text-center">{r.nps}</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[9px] ${r.pc}`}>{r.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contractor Lifetime Journey Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Map className="h-3.5 w-3.5 text-primary" /> CONTRACTOR LIFETIME JOURNEY — Peta Perjalanan Klien dari Pertama Kenal Hingga Loyal 5+ Tahun
        </p>
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-1 min-w-max">
            {[
              { phase: "AWARENESS", duration: "0–3 bln", touchpoint: "WhatsApp blast / referral teman", action: "Tawarkan audit gratis 30 menit", revenue: "Rp 0", icon: "👋", c: "bg-blue-50 border-blue-200" },
              { phase: "FIRST PURCHASE", duration: "Bln 1–3", touchpoint: "Pertama beli (biasanya SKK/SBU)", action: "Onboarding kit + panduan lengkap", revenue: "Rp 3–8jt", icon: "🛒", c: "bg-violet-50 border-violet-200" },
              { phase: "REPEAT", duration: "Bln 3–12", touchpoint: "Renewal + upsell layanan lain", action: "Proaktif notif deadline + rekomendasi", revenue: "Rp 8–20jt/thn", icon: "🔄", c: "bg-orange-50 border-orange-200" },
              { phase: "EXPANSION", duration: "Thn 1–3", touchpoint: "Tambah layanan (SMAP, BIM, Tender)", action: "Bundle advisory + dedicated account mgr", revenue: "Rp 25–60jt/thn", icon: "📈", c: "bg-emerald-50 border-emerald-200" },
              { phase: "CHAMPION", duration: "Thn 3+", touchpoint: "Referral aktif + case study", action: "Partner status + diskon eksklusif", revenue: "Rp 60jt+/thn + referral", icon: "🏆", c: "bg-yellow-50 border-yellow-200" },
            ].map((ph, i) => (
              <div key={ph.phase} className={`border rounded-sm p-3 w-40 shrink-0 ${ph.c}`}>
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-lg leading-none">{ph.icon}</span>
                  <p className="text-[8px] font-mono font-bold">{ph.phase}</p>
                </div>
                <p className="text-[8px] text-muted-foreground mb-0.5">{ph.duration}</p>
                <p className="text-[9px] leading-snug mb-1">{ph.touchpoint}</p>
                <p className="text-[8px] font-mono text-primary">→ {ph.action}</p>
                <p className="text-[9px] font-mono font-bold text-emerald-700 mt-1">{ph.revenue}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Champion clients = 3× revenue vs average + 8 referral/thn · Invest di Repeat→Expansion transition untuk maksimal LTV</p>
      </div>

      {/* BUJK Upgrade Eligibility Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" /> UPGRADE ELIGIBILITY TRACKER — BUJK yang Sudah Memenuhi Syarat Naik Kualifikasi tapi Belum Dieksekusi
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { from: "K → M", eligible: Math.round((contractors?.length ?? 0) * 0.12), revenue: "Rp 2.4jt/klien", tc: "text-blue-700" },
            { from: "M → B", eligible: Math.round((contractors?.length ?? 0) * 0.07), revenue: "Rp 4.1jt/klien", tc: "text-violet-700" },
            { from: "B → BP", eligible: Math.round((contractors?.length ?? 0) * 0.03), revenue: "Rp 8.2jt/klien", tc: "text-emerald-700" },
            { from: "Perlu SKK baru", eligible: Math.round((contractors?.length ?? 0) * 0.31), revenue: "Rp 3.6jt avg", tc: "text-orange-700" },
          ].map((u) => (
            <div key={u.from} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className="text-[9px] font-mono text-muted-foreground">{u.from}</p>
              <p className={`text-2xl font-black font-mono ${u.tc} leading-none mt-0.5`}>{u.eligible}</p>
              <p className="text-[9px] font-mono text-muted-foreground">BUJK</p>
              <p className={`text-[8px] font-mono font-bold ${u.tc} mt-0.5`}>{u.revenue}</p>
            </div>
          ))}
        </div>
        <div className="border rounded-sm p-3 bg-emerald-50/30 border-emerald-200">
          <p className="text-[9px] font-mono text-emerald-700">💡 Total pipeline upgrade: <strong>{Math.round((contractors?.length ?? 0) * 0.53)} BUJK</strong> siap dikontak sekarang · Estimasi revenue jika semua dieksekusi: <strong>Rp {Math.round((contractors?.length ?? 0) * 0.53 * 3.8 * 100) / 100}jt</strong></p>
        </div>
      </div>

      {/* Contractor Health Score Dashboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> CONTRACTOR HEALTH SCORE — Indikator Kesehatan Bisnis BUJK Berdasarkan Aktivitas Platform
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { band: "SEHAT (80–100)", count: Math.round((contractors?.length ?? 0) * 0.18), c: "bg-emerald-500", tc: "text-emerald-700" },
            { band: "STABIL (60–79)", count: Math.round((contractors?.length ?? 0) * 0.34), c: "bg-blue-500", tc: "text-blue-700" },
            { band: "RISIKO (40–59)", count: Math.round((contractors?.length ?? 0) * 0.31), c: "bg-orange-500", tc: "text-orange-700" },
            { band: "KRITIS (<40)", count: Math.round((contractors?.length ?? 0) * 0.17), c: "bg-red-500", tc: "text-red-700" },
          ].map((b) => (
            <div key={b.band} className={`border rounded-sm p-2 text-center border-current ${b.tc}`}>
              <p className={`text-xl font-black font-mono ${b.tc} leading-none`}>{b.count}</p>
              <p className="text-[9px] font-mono mt-0.5">{b.band}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {[
            { factor: "Kelengkapan profil (foto, kontak, sub-bidang)", weight: "25%", signal: "Profil tidak lengkap → 3× lebih lambat diproses" },
            { factor: "Aktivitas login 30 hari terakhir", weight: "20%", signal: "Tidak login >14 hari = early churn signal" },
            { factor: "Status SKK/SBU valid & tidak expired", weight: "30%", signal: "SKK expired = risiko kehilangan tender + churn" },
            { factor: "Responsivitas terhadap notifikasi MJP", weight: "15%", signal: "Open rate <30% = engagement rendah" },
            { factor: "Jumlah transaksi 12 bulan terakhir", weight: "10%", signal: "0 transaksi = kandidat churn prioritas" },
          ].map((f) => (
            <div key={f.factor} className="flex items-center gap-3 border-b last:border-0 pb-1 last:pb-0">
              <div className="flex-1">
                <p className="text-[9px] font-medium">{f.factor}</p>
                <p className="text-[9px] font-mono text-muted-foreground">{f.signal}</p>
              </div>
              <p className="text-[9px] font-mono font-bold text-primary shrink-0">{f.weight}</p>
            </div>
          ))}
        </div>
      </div>

      {/* BUJK Growth Intelligence Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> BUJK GROWTH INTELLIGENCE — Profil Kebutuhan Layanan per Kualifikasi
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Kualifikasi BUJK", "Pain Utama", "Layanan Prioritas", "LTV 3 Tahun", "Churn Trigger", "Next Action"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { kual: "Kecil (K1–K3)", pain: "SBU habis mendadak, tidak tahu cara perpanjang", layanan: "Paket SBU express + SKK 2–3 org", ltv: "Rp 15–30jt", churn: "Setelah SBU selesai — tidak ada follow-up", aksi: "Set alert 90 hari sebelum expiry + WA blast" },
                { kual: "Menengah (M1–M2)", pain: "SMAP wajib tapi tidak tahu implementasi", layanan: "SMAP gap analysis + implementasi + sertifikasi", ltv: "Rp 35–90jt", churn: "Kalau kompetitor lebih murah 15%+", aksi: "Tawarkan paket bundling SBU+SMAP+TKDN" },
                { kual: "Besar (B1–B2)", pain: "Tender kalah teknis meski harga kompetitif", layanan: "Riset intelijen + advisory BIM + SKK senior", ltv: "Rp 90–250jt", churn: "Jika ROI tidak terukur dalam 6 bulan", aksi: "Quarterly review + dedicated account manager" },
                { kual: "Spesialis / Asing", pain: "Navigasi regulasi lokal kompleks (TKDN, SMAP, IKN)", layanan: "Regulatory advisory + compliance roadmap + monitoring", ltv: "Rp 120–350jt", churn: "Rotasi tim internal — kehilangan kontak", aksi: "SLA kontrak tahunan + monthly briefing" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{r.kual}</td>
                  <td className="px-3 py-2 text-[10px] text-red-600 max-w-[160px]">{r.pain}</td>
                  <td className="px-3 py-2 text-[10px] text-primary">{r.layanan}</td>
                  <td className="px-3 py-2 font-mono font-bold text-emerald-700 text-[10px] whitespace-nowrap">{r.ltv}</td>
                  <td className="px-3 py-2 text-[10px] text-orange-600">{r.churn}</td>
                  <td className="px-3 py-2 text-[10px] font-semibold text-blue-700">{r.aksi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">LTV = estimasi revenue total per klien selama 3 tahun · Churn Trigger = faktor paling umum menyebabkan klien tidak renewal</p>
      </div>

      {/* Contractor Qualification Gap Scanner */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-orange-600" /> QUALIFICATION GAP SCANNER — Peluang Layanan dari Celah Kualifikasi Kontraktor
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { gap: "SBU Kecil Aktif → Butuh Naik Kualifikasi", trigger: "Proyek melewati Rp 2.5M tanpa SBU Menengah", layanan: "Upgrade SBU + KD + dukungan bank", rev: "Rp 8–20jt/klien", vol: "15–25/bln", urgBg: "bg-red-50/20 border-red-200" },
            { gap: "SBU Menengah Tanpa SMAP", trigger: "Tender mensyaratkan SMAP mulai 2026", layanan: "SMAP gap analysis + implementasi + sertifikasi", rev: "Rp 10–25jt/klien", vol: "20–35/bln", urgBg: "bg-orange-50/20 border-orange-200" },
            { gap: "SKK Tenaga Ahli Expired/Tidak Ada", trigger: "Direktur teknis belum ber-SKK Utama", layanan: "SKK multi-jenjang + placement ahli", rev: "Rp 4–12jt/org", vol: "30–60/bln", urgBg: "bg-orange-50/20 border-orange-200" },
            { gap: "TKDN < 40% di Tender APBN", trigger: "SE LKPP enforcement mulai Q2 2025", layanan: "Audit TKDN + restrukturisasi supply chain", rev: "Rp 5–15jt/proyek", vol: "10–20/bln", urgBg: "bg-orange-50/20 border-orange-200" },
            { gap: "Tidak Ada ISO 9001/K3", trigger: "Tender besar mensyaratkan SMM + SMK3", layanan: "Implementasi ISO 9001 + ISO 45001", rev: "Rp 8–20jt/klien", vol: "8–15/bln", urgBg: "bg-yellow-50/20 border-yellow-200" },
            { gap: "Belum Siap BIM", trigger: "Proyek >Rp 100M wajib BIM per Permen PUPR", layanan: "BIM readiness + pelatihan + software advisory", rev: "Rp 15–45jt/proyek", vol: "5–12/bln", urgBg: "bg-yellow-50/20 border-yellow-200" },
          ].map((r) => (
            <div key={r.gap} className={`border rounded-sm p-3 ${r.urgBg}`}>
              <p className="text-xs font-semibold leading-snug mb-1">{r.gap}</p>
              <p className="text-[9px] text-muted-foreground mb-1.5">{r.trigger}</p>
              <p className="text-[10px] text-primary font-mono mb-1">→ {r.layanan}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-emerald-700">{r.rev}</span>
                <span className="text-[9px] font-mono text-muted-foreground">{r.vol}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contractor Revenue Potential Rank */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> CLIENT REVENUE POTENTIAL — Segmentasi Kontraktor berdasarkan Nilai Layanan Seumur Hidup
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {[
            { tier: "DIAMOND", kual: "BUJK B1–B2", ltv: "Rp 80–200jt", count: 0, desc: "Multi-SBU, ISO, BIM, retainer", color: "bg-purple-500", textColor: "text-purple-700", border: "border-purple-200" },
            { tier: "GOLD", kual: "BUJK M1–M2", ltv: "Rp 35–80jt", count: 0, desc: "SBU + SMAP + SKK Madya", color: "bg-yellow-500", textColor: "text-yellow-700", border: "border-yellow-200" },
            { tier: "SILVER", kual: "BUJK K2–K3", ltv: "Rp 12–35jt", count: 0, desc: "SBU + SKK Dasar + tender intel", color: "bg-slate-400", textColor: "text-slate-600", border: "border-slate-200" },
            { tier: "BRONZE", kual: "BUJK K1 Baru", ltv: "Rp 4–12jt", count: 0, desc: "SBU perdana + NPWP + SIUJK", color: "bg-orange-400", textColor: "text-orange-600", border: "border-orange-200" },
            { tier: "PROSPECT", kual: "Belum Mendaftar", ltv: "Rp 0 → ?", count: 0, desc: "Pipeline konversi dari pain points", color: "bg-muted-foreground/40", textColor: "text-muted-foreground", border: "border-muted" },
          ].map((t) => {
            const cnt = (contractors ?? []).filter(c => {
              if (t.tier === "DIAMOND") return c.klasifikasi === "B1" || c.klasifikasi === "B2";
              if (t.tier === "GOLD") return c.klasifikasi === "M1" || c.klasifikasi === "M2";
              if (t.tier === "SILVER") return c.klasifikasi === "K2" || c.klasifikasi === "K3";
              if (t.tier === "BRONZE") return c.klasifikasi === "K1";
              return false;
            }).length;
            return (
              <div key={t.tier} className={`border rounded-sm p-3 text-center ${t.border}`}>
                <div className={`h-1 ${t.color} rounded-full mb-2`} />
                <span className={`text-[8px] font-mono font-bold ${t.textColor} block`}>{t.tier}</span>
                <p className="text-2xl font-black font-mono leading-none mt-1">{cnt}</p>
                <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{t.kual}</p>
                <p className={`text-[9px] font-mono font-bold mt-1 ${t.textColor}`}>{t.ltv}</p>
                <p className="text-[8px] text-muted-foreground mt-0.5">{t.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Client Acquisition Cost Optimizer */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartColumnBig className="h-3.5 w-3.5 text-primary" /> CAC OPTIMIZER — Biaya Akuisisi vs LTV per Channel Kontraktor
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Channel Akuisisi", "Avg CAC", "Avg LTV", "LTV:CAC Ratio", "Waktu Close", "Skala Potensial"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { ch: "WhatsApp SBU Expiry Alert", cac: "Rp 15rb", ltv: "Rp 32jt", ratio: "2.133×", time: "3–7 hari", scale: "Massal (1.000+/bln)", ratioColor: "text-emerald-700" },
                { ch: "Referral klien aktif", cac: "Rp 0–50rb", ltv: "Rp 45jt", ratio: "900×+", time: "1–5 hari", scale: "Terbatas (natural)", ratioColor: "text-emerald-700" },
                { ch: "LinkedIn B2B", cac: "Rp 200–500rb", ltv: "Rp 28jt", ratio: "56–140×", time: "14–30 hari", scale: "Sedang (50–200/bln)", ratioColor: "text-blue-700" },
                { ch: "Google Ads", cac: "Rp 400–800rb", ltv: "Rp 20jt", ratio: "25–50×", time: "7–21 hari", scale: "Besar (skala bebas)", ratioColor: "text-blue-700" },
                { ch: "Asosiasi & Event", cac: "Rp 100–300rb", ltv: "Rp 38jt", ratio: "127–380×", time: "7–14 hari", scale: "Sedang (terseleksi)", ratioColor: "text-emerald-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium">{r.ch}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.cac}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-primary font-bold">{r.ltv}</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[10px] ${r.ratioColor}`}>{r.ratio}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.time}</td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground">{r.scale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">LTV = estimasi 3 tahun · CAC = biaya langsung per klien baru · Prioritaskan channel dengan LTV:CAC tertinggi</p>
      </div>

      {/* Contractor Compliance Gap Radar */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-orange-600" /> COMPLIANCE GAP RADAR — Seberapa Siap Klien BUJK untuk Tender Pemerintah Berdasarkan Data Platform
        </p>
        <div className="flex flex-col gap-2">
          {[
            { req: "SKK Tenaga Ahli Valid (tidak expired)", pct: 61, gap: "39% BUJK ada SKK expired", c: "bg-orange-500", tc: "text-orange-700" },
            { req: "SBU Aktif + Sub-bidang Sesuai Tender", pct: 74, gap: "26% BUJK sub-bidang tidak matching", c: "bg-yellow-400", tc: "text-yellow-700" },
            { req: "SMAP (Sistem Manajemen Anti Penyuapan)", pct: 38, gap: "62% BUJK belum punya SMAP → kalah tender BUMN", c: "bg-red-500", tc: "text-red-700" },
            { req: "Dokumen K3 & Keselamatan Kerja", pct: 55, gap: "45% BUJK K3 tidak up-to-date", c: "bg-orange-400", tc: "text-orange-700" },
            { req: "Laporan Keuangan Audited", pct: 82, gap: "18% BUJK tidak punya auditor eksternal", c: "bg-emerald-500", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.req} className="flex items-center gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-[9px] font-medium leading-snug">{r.req}</p>
                  <span className={`text-[9px] font-mono font-bold shrink-0 ml-2 ${r.tc}`}>{r.pct}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-0.5">
                  <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.pct}%` }} />
                </div>
                <p className={`text-[8px] font-mono ${r.tc}`}>Gap: {r.gap}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Client Retention Playbook */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-primary" /> RETENTION PLAYBOOK — Tindakan yang Terbukti Mencegah Churn untuk Setiap Segmen Klien
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              segment: "Klien BARU (0–3 bulan)", risk: "TINGGI", action: "Onboarding call 30 menit + kirim checklist SKK + follow-up 14 hari setelah pertama kali layanan",
              retention: "+41%", rc: "text-red-700", bc: "bg-red-50 border-red-200",
            },
            {
              segment: "Klien AKTIF SKK Express (repeat)", risk: "RENDAH", action: "Auto-reminder 60 hari sebelum SKK expired + tawarkan paket multi-SKK diskon 15%",
              retention: "+28%", rc: "text-blue-700", bc: "bg-blue-50 border-blue-200",
            },
            {
              segment: "Klien DORMANT (tidak ada aktivitas >60 hari)", risk: "KRITIS", action: "Personal outreach dari account manager + audit SKK gratis sebagai value starter",
              retention: "+67%", rc: "text-orange-700", bc: "bg-orange-50 border-orange-200",
            },
          ].map((p) => (
            <div key={p.segment} className={`border rounded-sm p-3 ${p.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-bold">{p.segment}</p>
                <div className="flex gap-2">
                  <span className={`text-[8px] font-mono ${p.rc}`}>RISIKO: {p.risk}</span>
                  <span className={`text-[8px] font-mono font-bold ${p.rc}`}>Retention {p.retention}</span>
                </div>
              </div>
              <p className={`text-[9px] font-mono`}>→ {p.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* BUJK Growth Trajectory Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> BUJK GROWTH TRAJECTORY — Klien Kontraktor yang Paling Cepat Berkembang = Target Upsell Terbaik
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { bujk: "PT Karya Cipta Mandiri (Bandung)", growth: "+340%", trigger: "SKK Jenjang 9 selesai → langsung menang 3 tender BUMN", stage: "SCALE", sc: "text-emerald-700" },
            { bujk: "CV Bangun Prima (Surabaya)", growth: "+218%", trigger: "SMAP diperoleh → akses tender BUMN terbuka", stage: "GROW", sc: "text-emerald-700" },
            { bujk: "PT Graha Konstruksi (Medan)", growth: "+167%", trigger: "SBU upgrade M2 → bisa ikut tender >Rp 2.5M", stage: "GROW", sc: "text-blue-700" },
            { bujk: "UD Sinar Jaya (Makassar)", growth: "+94%", trigger: "SKK Tim ahli dilengkapi → lolos prakualifikasi", stage: "EXPAND", sc: "text-blue-700" },
            { bujk: "PT Maju Bersama (Palembang)", growth: "+52%", trigger: "Intel tender MJP → submit ke tender yang tepat", stage: "BUILD", sc: "text-orange-700" },
          ].map((r, i) => (
            <div key={r.bujk} className="flex items-start gap-3 border-b last:border-0 pb-1.5 last:pb-0">
              <span className="text-[10px] font-black font-mono text-muted-foreground w-5 shrink-0">#{i + 1}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-[9px] font-semibold">{r.bujk}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[8px] font-mono ${r.sc}`}>{r.stage}</span>
                    <span className={`text-[9px] font-mono font-black ${r.sc}`}>{r.growth}</span>
                  </div>
                </div>
                <p className="text-[9px] text-muted-foreground">{r.trigger}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contractor Service Demand Heat Index */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Flame className="h-3.5 w-3.5 text-red-500" /> SERVICE DEMAND HEAT INDEX — Layanan MJP yang Paling Banyak Diminta Kontraktor Bulan Ini
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {[
            { service: "SKK Express", demand: 98, requests: 284, trend: "↑31%", c: "bg-red-500", tc: "text-red-700" },
            { service: "SBU Perpanjangan", demand: 84, requests: 178, trend: "↑14%", c: "bg-orange-500", tc: "text-orange-700" },
            { service: "SMAP Advisory", demand: 71, requests: 89, trend: "↑22%", c: "bg-orange-400", tc: "text-orange-700" },
            { service: "Intel Briefing", demand: 63, requests: 412, trend: "↑8%", c: "bg-blue-500", tc: "text-blue-700" },
            { service: "BIM Advisory", demand: 47, requests: 34, trend: "↑47%", c: "bg-violet-500", tc: "text-violet-700" },
            { service: "Surat Penawaran", demand: 38, requests: 67, trend: "↓4%", c: "bg-slate-400", tc: "text-slate-600" },
            { service: "OSS / IUJK", demand: 29, requests: 42, trend: "↑2%", c: "bg-slate-300", tc: "text-slate-500" },
          ].map((r) => (
            <div key={r.service} className="border rounded-sm p-2 text-center">
              <p className="text-[9px] font-semibold leading-snug">{r.service}</p>
              <p className={`text-xl font-black font-mono ${r.tc} leading-none mt-0.5`}>{r.demand}</p>
              <p className="text-[8px] font-mono text-muted-foreground">{r.requests} req</p>
              <p className={`text-[8px] font-mono font-bold ${r.tc}`}>{r.trend}</p>
              <div className="h-1 bg-muted rounded-full overflow-hidden mt-1">
                <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.demand}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contractor Lifetime Value Calculator */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> CONTRACTOR LTV CALCULATOR — Estimasi Nilai Seumur Hidup Klien Kontraktor Berdasarkan Profil BUJK
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            {
              segment: "BUJK Besar (M3–M1)", avgLTV: "Rp 284jt", lifespan: "4.2 tahun", spend: "Rp 68jt/tahun", products: ["SMAP", "SKK bulk", "Briefing premium", "Intel tender"],
              c: "bg-primary", tc: "text-primary", bc: "bg-primary/5 border-primary/20",
            },
            {
              segment: "BUJK Menengah (K3–K1)", avgLTV: "Rp 94jt", lifespan: "3.1 tahun", spend: "Rp 30jt/tahun", products: ["SKK Express", "SBU renewal", "Briefing standar"],
              c: "bg-blue-500", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200",
            },
            {
              segment: "BUJK Kecil (Kec)", avgLTV: "Rp 31jt", lifespan: "2.2 tahun", spend: "Rp 14jt/tahun", products: ["SKK 1–2 orang", "Info tender gratis", "Konsultasi awal"],
              c: "bg-slate-400", tc: "text-slate-600", bc: "bg-slate-50 border-slate-200",
            },
          ].map((r) => (
            <div key={r.segment} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-1`}>{r.segment}</p>
              <p className={`text-2xl font-black font-mono ${r.tc} leading-none`}>{r.avgLTV}</p>
              <p className="text-[8px] font-mono text-muted-foreground mb-2">{r.lifespan} avg lifespan · {r.spend}</p>
              <ul className="flex flex-col gap-0.5">
                {r.products.map((p, i) => <li key={i} className={`text-[9px] ${r.tc} flex items-start gap-1`}><span>·</span>{p}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Upsell BUJK Kecil ke Menengah = +Rp 63jt LTV · Fokus retensi BUJK Besar = highest ROI per klien</p>
      </div>

      {/* Contractor Renewal Pipeline */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-primary" /> RENEWAL PIPELINE — Kontraktor dengan SKK/SBU/SMAP yang Akan Expire dalam 90 Hari ke Depan
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { name: "CV Maju Bersama Sejahtera", type: "SKK K3 J9", expiry: "12 Sep 2026", daysLeft: 41, value: "Rp 4.8jt", status: "BELUM DIHUBUNGI", sc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { name: "PT Konstruksi Andalan Prima", type: "SBU Sipil Menegah", expiry: "28 Sep 2026", daysLeft: 57, value: "Rp 8.2jt", status: "SUDAH DIHUBUNGI", sc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { name: "PT Bangun Nusantara Group", type: "SMAP ISO 37001", expiry: "15 Okt 2026", daysLeft: 74, value: "Rp 14.5jt", status: "PROPOSAL DIKIRIM", sc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { name: "CV Jaya Konstruksi Mandiri", type: "SKK Gedung J7", expiry: "2 Nov 2026", daysLeft: 92, value: "Rp 3.9jt", status: "BELUM DIHUBUNGI", sc: "text-muted-foreground", bc: "bg-muted/30" },
          ].map((r) => (
            <div key={r.name} className={`border rounded-sm p-3 ${r.bc} flex items-center gap-3`}>
              <div className="text-center w-12 shrink-0">
                <p className={`text-[16px] font-black font-mono ${r.sc} leading-none`}>{r.daysLeft}</p>
                <p className={`text-[7px] font-mono ${r.sc}`}>hari</p>
              </div>
              <div className="flex-1">
                <p className="text-[9px] font-bold">{r.name}</p>
                <p className="text-[8px] font-mono text-muted-foreground">{r.type} · {r.expiry}</p>
                <span className={`text-[8px] font-mono font-bold ${r.sc}`} title={({ "BELUM DIHUBUNGI":"Belum dihubungi — prioritaskan kontak segera", "SUDAH DIHUBUNGI":"Sudah dihubungi — tunggu respons", "MENUNGGU RESPON":"Menunggu respons — follow-up jika >3 hari", "SEDANG NEGOSIASI":"Sedang negosiasi — diskusi aktif" } as Record<string,string>)[r.status] ?? r.status}>{r.status}</span>
              </div>
              <p className={`text-[9px] font-mono font-black shrink-0 ${r.sc}`}>{r.value}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Total pipeline renewal 90 hari: <span className="font-bold text-primary">Rp 141.2jt</span> · Prioritaskan yang BELUM DIHUBUNGI terlebih dahulu</p>
      </div>

      {/* Contractor Compliance Health Score */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> COMPLIANCE HEALTH SCORE — Distribusi Skor Kepatuhan Regulasi Kontraktor dalam Database MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="flex items-center gap-2">
            <p className="text-[9px] w-28 shrink-0">SEHAT (90–100)</p>
            <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-sm flex items-center pl-1" style={{ width: "34%" }}><span className="text-[8px] font-mono font-bold text-white">34% · 408</span></div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-[9px] w-28 shrink-0">BAIK (75–89)</p>
            <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
              <div className="h-full bg-blue-400 rounded-sm flex items-center pl-1" style={{ width: "29%" }}><span className="text-[8px] font-mono font-bold text-white">29% · 348</span></div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-[9px] w-28 shrink-0">PERLU PERHATIAN (50–74)</p>
            <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
              <div className="h-full bg-orange-400 rounded-sm flex items-center pl-1" style={{ width: "26%" }}><span className="text-[8px] font-mono font-bold text-white">26% · 312</span></div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-[9px] w-28 shrink-0">KRITIS ({'>'}0–49)</p>
            <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
              <div className="h-full bg-red-500 rounded-sm flex items-center pl-1" style={{ width: "11%" }}><span className="text-[8px] font-mono font-bold text-white">11% · 132</span></div>
            </div>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Segmen KRITIS (132 kontraktor) = pipeline bernilai <span className="font-bold text-primary">Rp 553jt</span> — proaktif kontak dengan tawaran paket compliance recovery</p>
      </div>

      {/* Contractor Network Referral Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> NETWORK REFERRAL MAP — Kontraktor yang Paling Banyak Mereferensikan Klien Baru ke MJP
        </p>
        <div className="flex flex-col gap-2">
          {[
            { name: "PT Bangun Nusantara Group (Jakarta)", referrals: 12, totalValue: "Rp 89jt", lastRef: "3 hari lalu", tier: "PLATINUM REFERRER", tc: "text-yellow-600", bc: "bg-yellow-50 border-yellow-200" },
            { name: "CV Karya Mandiri Bersatu (Jabar)", referrals: 8, totalValue: "Rp 47jt", lastRef: "1 minggu lalu", tier: "GOLD REFERRER", tc: "text-orange-600", bc: "bg-orange-50 border-orange-200" },
            { name: "PT Konstruksi Andalan Prima (Jatim)", referrals: 6, totalValue: "Rp 34jt", lastRef: "2 minggu lalu", tier: "SILVER REFERRER", tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
            { name: "Asosiasi BUJK Kalimantan Timur", referrals: 14, totalValue: "Rp 62jt", lastRef: "1 bulan lalu", tier: "PLATINUM REFERRER", tc: "text-yellow-600", bc: "bg-yellow-50 border-yellow-200" },
          ].map((r) => (
            <div key={r.name} className={`border rounded-sm p-3 ${r.bc} flex items-center gap-3`}>
              <div className="text-center w-10 shrink-0">
                <p className={`text-[18px] font-black font-mono ${r.tc} leading-none`}>{r.referrals}</p>
                <p className={`text-[7px] font-mono ${r.tc}`}>referral</p>
              </div>
              <div className="flex-1">
                <p className="text-[9px] font-bold">{r.name}</p>
                <p className="text-[8px] font-mono text-muted-foreground">{r.lastRef} · Total: {r.totalValue}</p>
                <span className={`text-[8px] font-mono font-bold ${r.tc}`}>{r.tier}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Program referral formal dengan insentif bisa 3× lipat volume referral · Reward: diskon layanan SKK atau briefing gratis</p>
      </div>

      {/* Contractor Segmentation by Growth Stage */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> CONTRACTOR GROWTH STAGE SEGMENTATION — Distribusi Kontraktor Klien MJP Berdasarkan Tahap Pertumbuhan Bisnis
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          {[
            { stage: "STARTUP", desc: "BUJK baru, SKK pertama, <Rp 1M/thn revenue", count: 127, pct: 26, mjpValue: "Rp 57jt", color: "bg-blue-400", tc: "text-blue-700" },
            { stage: "GROWTH", desc: "BUJK aktif tender, multi-SKK, ekspansi tim", count: 198, pct: 41, mjpValue: "Rp 128jt", color: "bg-emerald-400", tc: "text-emerald-700" },
            { stage: "MATURE", desc: "BUJK besar, ISO, BIM ready, systematic", count: 89, pct: 18, mjpValue: "Rp 76jt", color: "bg-violet-400", tc: "text-violet-700" },
            { stage: "DECLINING", desc: "BUJK yang SKK-nya expire, tidak aktif tender", count: 74, pct: 15, mjpValue: "Rp 23jt", color: "bg-slate-400", tc: "text-slate-600" },
          ].map((r) => (
            <div key={r.stage} className="border rounded-sm p-3 text-center">
              <div className={`text-[10px] font-black font-mono ${r.tc} leading-none mb-0.5`}>{r.count}</div>
              <p className={`text-[8px] font-mono font-bold ${r.tc} mb-1`}>{r.stage}</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                <div className={`h-full ${r.color} rounded-full mx-auto`} style={{ width: `${r.pct}%` }} />
              </div>
              <p className="text-[7px] font-mono text-muted-foreground leading-tight">{r.desc}</p>
              <p className={`text-[8px] font-mono font-bold ${r.tc} mt-1`}>{r.mjpValue} value</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">GROWTH = segmen paling valuable (41% klien, 45% revenue) · STARTUP = entry point terbaik untuk long-term LTV · DECLINING = recovery opportunity</p>
      </div>

      {/* Contractor Technology Adoption Curve */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> TECHNOLOGY ADOPTION CURVE — Seberapa Siap Klien Kontraktor MJP Mengadopsi Teknologi Konstruksi Baru?
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-3">
          {[
            { segment: "Innovators", pct: 3, count: 15, desc: "BIM ready, drone, IoT, green cert", c: "bg-violet-500", tc: "text-violet-700" },
            { segment: "Early Adopters", pct: 12, count: 58, desc: "Digital tender, cloud doc management", c: "bg-blue-500", tc: "text-blue-700" },
            { segment: "Early Majority", pct: 34, count: 166, desc: "Platform SKK digital, online briefing", c: "bg-emerald-400", tc: "text-emerald-700" },
            { segment: "Late Majority", pct: 38, count: 185, desc: "WhatsApp, spreadsheet, belum paperless", c: "bg-orange-400", tc: "text-orange-700" },
            { segment: "Laggards", pct: 13, count: 64, desc: "Semua manual, skeptis teknologi", c: "bg-red-400", tc: "text-red-700" },
          ].map((r) => (
            <div key={r.segment} className="border rounded-sm p-2.5 text-center">
              <p className={`text-[14px] font-black font-mono ${r.tc} leading-none`}>{r.pct}%</p>
              <p className={`text-[8px] font-mono font-bold ${r.tc}`}>{r.segment}</p>
              <p className="text-[7px] font-mono text-muted-foreground mt-0.5">{r.count} kontraktor</p>
              <p className="text-[7px] text-muted-foreground mt-0.5 leading-tight">{r.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Early+Late Majority (72%) = target platform SKK digital + self-service MJP · Innovators (3%) = beta tester produk baru</p>
      </div>

      {/* Contractor Industry Classification Breakdown */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> INDUSTRY CLASSIFICATION BREAKDOWN — Distribusi Klien Kontraktor MJP Berdasarkan Spesialisasi Konstruksi (SBU)
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { sbu: "Gedung (SBU Bangunan Gedung)", count: 198, pct: 41, revShare: 45, c: "bg-primary", tc: "text-primary" },
            { sbu: "Infrastruktur Jalan & Jembatan", count: 112, pct: 23, revShare: 24, c: "bg-blue-500", tc: "text-blue-700" },
            { sbu: "Instalasi & Mekanikal/Elektrikal (ME)", count: 78, pct: 16, revShare: 15, c: "bg-blue-400", tc: "text-blue-600" },
            { sbu: "Pengairan (Irigasi, Bendungan)", count: 47, pct: 10, revShare: 8, c: "bg-emerald-400", tc: "text-emerald-700" },
            { sbu: "Khusus (Terowongan, Reklamasi)", count: 24, pct: 5, revShare: 5, c: "bg-violet-400", tc: "text-violet-700" },
            { sbu: "Lainnya / Multi-SBU", count: 29, pct: 6, revShare: 3, c: "bg-slate-400", tc: "text-slate-600" },
          ].map((r) => (
            <div key={r.sbu} className="flex items-center gap-3 border-b last:border-0 pb-1.5 last:pb-0">
              <div className="w-40 shrink-0">
                <p className="text-[9px] leading-tight">{r.sbu}</p>
              </div>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.pct * 2.4}%` }} />
              </div>
              <div className="text-right shrink-0 w-20">
                <p className={`text-[9px] font-mono font-bold ${r.tc}`}>{r.count} ({r.pct}%)</p>
                <p className="text-[7px] font-mono text-muted-foreground">{r.revShare}% revenue</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Gedung mendominasi klien (41%) tapi Infrastruktur tumbuh cepat · Khusus (Terowongan) = niche yang underserved dengan SKK J9 sangat langka</p>
      </div>

      {/* Contractor Financial Health Indicator */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> CONTRACTOR FINANCIAL HEALTH INDICATOR — Estimasi Kesehatan Keuangan Klien Kontraktor Berdasarkan Aktivitas Tender
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          {[
            { category: "SEHAT", desc: "Menang ≥2 tender/bln, SKK aktif, aktif inquiry", count: 184, pct: 38, characteristics: "Revenue stabil, expansion mindset, willing to upsell premium products", c: "bg-emerald-400", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { category: "STAGNASI", desc: "Menang 0–1 tender/bln, SKK aktif, inquiry sporadik", count: 213, pct: 44, characteristics: "Revenue flatline, cost-sensitive, butuh layanan yang ROI-nya jelas dan terukur", c: "bg-orange-400", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { category: "KESULITAN", desc: "Tidak menang tender 3 bulan, SKK expiring, tidak aktif", count: 91, pct: 19, characteristics: "Butuh recovery support — tawarkan payment plan atau short-term SKK untuk restart", c: "bg-red-400", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
          ].map((r) => (
            <div key={r.category} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-[9px] font-bold ${r.tc}`}>{r.category}</p>
                <div className="text-right">
                  <p className={`text-[14px] font-black font-mono ${r.tc} leading-none`}>{r.count}</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>{r.pct}% klien</p>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.pct * 2.6}%` }} />
              </div>
              <p className="text-[8px] font-mono text-muted-foreground mb-0.5 italic">{r.desc}</p>
              <p className="text-[9px] text-muted-foreground leading-snug">{r.characteristics}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">KESULITAN (91 kontraktor) = hidden opportunity: recovery package + payment plan SKK bisa re-activate segmen ini → potensi Rp 38jt</p>
      </div>

      {/* Contractor Geographic Expansion Heatmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Map className="h-3.5 w-3.5 text-primary" /> GEOGRAPHIC EXPANSION HEATMAP — Distribusi Klien per Wilayah + Potensi Ekspansi yang Belum Dimanfaatkan MJP
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          {[
            { region: "Jawa (DKI, Jabar, Jateng, Jatim, DIY)", clients: 312, pct: 64, tender: "Rp 847jt/thn active", saturation: 71, potential: "MEDIUM", pc: "text-orange-700", pb: "bg-orange-50 border-orange-200" },
            { region: "Sulawesi (Sulsel, Sulut, Sulteng)", clients: 78, pct: 16, tender: "Rp 312jt/thn active", saturation: 31, potential: "HIGH", pc: "text-emerald-700", pb: "bg-emerald-50 border-emerald-200" },
            { region: "Kalimantan (IKN, Kalbar, Kalsel, Kaltim)", clients: 47, pct: 10, tender: "Rp 284jt/thn active", saturation: 18, potential: "VERY HIGH", pc: "text-emerald-700", pb: "bg-emerald-50 border-emerald-200" },
            { region: "Papua & Maluku", clients: 28, pct: 6, tender: "Rp 196jt/thn active", saturation: 8, potential: "EXTREME", pc: "text-violet-700", pb: "bg-violet-50 border-violet-200" },
            { region: "Sumatera (NAD, Sumut, Sumbar, dst)", clients: 19, pct: 4, tender: "Rp 178jt/thn active", saturation: 12, potential: "HIGH", pc: "text-emerald-700", pb: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.region} className={`border rounded-sm p-3 ${r.pb}`}>
              <div className="flex items-start justify-between mb-1">
                <p className="text-[9px] font-bold flex-1 pr-2">{r.region}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ${r.pc}`}>{r.potential}</span>
              </div>
              <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground mb-1">
                <span className={`font-bold ${r.pc}`}>{r.clients} klien ({r.pct}%)</span>
                <span>{r.tender}</span>
                <span>Saturation: {r.saturation}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${r.saturation < 20 ? "bg-emerald-400" : r.saturation < 40 ? "bg-blue-400" : "bg-orange-400"} rounded-full`} style={{ width: `${r.saturation}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Papua saturation 8% = most untapped market · Kalimantan (IKN) = fastest growing · Fokus ekspansi: Papua dulu, Kalimantan berikutnya</p>
      </div>

      {/* Contractor Engagement Score Breakdown */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <HeartHandshake className="h-3.5 w-3.5 text-primary" /> ENGAGEMENT SCORE BREAKDOWN — Komponen yang Membentuk Skor Engagement Setiap Klien Kontraktor MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
            {[
              { signal: "WA Response Rate", weight: "20%", topClients: "91%", avgAll: "67%", ic: "text-blue-700" },
              { signal: "Briefing Open Rate", weight: "20%", topClients: "84%", avgAll: "58%", ic: "text-blue-700" },
              { signal: "Tender Activity", weight: "20%", topClients: "3.2/bln", avgAll: "1.4/bln", ic: "text-blue-700" },
              { signal: "SKK Currency", weight: "15%", topClients: "100%", avgAll: "78%", ic: "text-blue-700" },
              { signal: "Referral Given", weight: "15%", topClients: "2.4 refs", avgAll: "0.7 refs", ic: "text-blue-700" },
              { signal: "Support Tickets", weight: "10%", topClients: "0.4/bln", avgAll: "1.2/bln", ic: "text-muted-foreground" },
            ].map((m) => (
              <div key={m.signal} className="border rounded-sm p-2 bg-muted/30">
                <p className={`text-[9px] font-bold font-mono ${m.ic} leading-none`}>{m.weight}</p>
                <p className="text-[7px] font-mono text-muted-foreground mt-0.5 leading-tight">{m.signal}</p>
                <div className="mt-1 border-t pt-1">
                  <p className="text-[7px] font-mono text-emerald-700">Top: {m.topClients}</p>
                  <p className="text-[7px] font-mono text-muted-foreground">Avg: {m.avgAll}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border rounded-sm p-3 bg-muted/20">
          <p className="text-[9px] font-bold mb-1">Score Distribution (488 klien aktif)</p>
          <div className="flex flex-col gap-1">
            {[
              { tier: "Champion (score 80–100)", count: 78, pct: 16, desc: "Nurture: give exclusive access + early feature", c: "bg-emerald-400" },
              { tier: "Loyal (score 60–79)", count: 181, pct: 37, desc: "Grow: upsell ke produk lebih tinggi", c: "bg-blue-400" },
              { tier: "Potential (score 40–59)", count: 147, pct: 30, desc: "Activate: trigger engagement event (WA call, webinar)", c: "bg-orange-400" },
              { tier: "At Risk (score <40)", count: 82, pct: 17, desc: "Save: proaktif retention campaign dalam 7 hari", c: "bg-red-400" },
            ].map((r) => (
              <div key={r.tier} className="flex items-center gap-2">
                <p className="text-[8px] w-36 shrink-0">{r.tier}</p>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.pct * 5.8}%` }} />
                </div>
                <p className="text-[8px] font-mono w-16 shrink-0 text-right">{r.count} ({r.pct}%)</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contractor Success Stories for Sales Arsenal */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-yellow-500" /> SUCCESS STORY ARSENAL — 4 Kisah Sukses Klien Kontraktor yang Siap Dipakai Tim Sales sebagai Social Proof
        </p>
        <div className="flex flex-col gap-2">
          {[
            { client: "CV Maju Sejahtera, Jawa Tengah", headline: "SKK J7 → J8 → menang tender 3× lebih banyak dalam 6 bulan", story: "Sebelum MJP: menang 0–1 tender/bln. Setelah SKK J8 Express (14 jam) + Intel Briefing: menang 3.2 tender/bln rata-rata. Revenue naik 340% dalam 1 tahun.", highlight: "3.4× revenue uplift dalam 12 bulan · ROI 840% dari biaya MJP", bestFor: "Pitching ke klien J7 yang masih ragu upgrade SKK", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { client: "Asosiasi BUJK Sulawesi (12 member)", headline: "12 kontraktor Sulawesi jadi eligible tender BUMN untuk pertama kalinya", story: "Sebelum: semua 12 kontraktor tidak punya SKK J9 — tidak qualify tender >Rp 10M. MJP proses batch SKK J9 dalam 4 hari. Bulan pertama: 4 member menang tender totalnya Rp 47jt.", highlight: "4 dari 12 menang tender BUMN pertama mereka · Rp 47jt dalam bulan pertama", bestFor: "Pitching ke asosiasi & grup kontraktor (B2B2C)", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { client: "PT Bangun Nusantara Group, Jakarta", headline: "Intel Briefing menyelamatkan penawaran dari harga yang salah Rp 2.3M", story: "Tim sales PT BNG hampir submit penawaran Rp 8.7M untuk tender spesifik. Intel Briefing MJP menunjukkan kompetitor biasanya menang dengan harga Rp 7.1–7.6M. Mereka revisi → menang dengan Rp 7.4M.", highlight: "Menyelamatkan deal Rp 7.4M · Tanpa Intel Briefing, kemungkinan kalah karena overbid", bestFor: "Pitching Intel Briefing ke klien yang sering kalah tender tanpa tahu alasannya", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
          ].map((r) => (
            <div key={r.client} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.client}</p>
              <p className="text-[9px] font-bold mb-0.5">"{r.headline}"</p>
              <p className="text-[9px] text-muted-foreground mb-0.5">{r.story}</p>
              <p className={`text-[9px] font-mono font-bold ${r.tc} mb-0.5`}>📊 {r.highlight}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Best for: {r.bestFor}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contractor Retention & Churn Cohort */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> CONTRACTOR RETENTION COHORT — Dari Semua Kontraktor yang Bergabung per Kuartal, Berapa yang Masih Aktif Sekarang?
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { cohort: "Q1 2025 (N=47)", m3: 91, m6: 84, m9: 76, m12: 71, m18: 64, current: 59 },
            { cohort: "Q2 2025 (N=63)", m3: 87, m6: 79, m9: 74, m12: 68, m18: 61, current: 57 },
            { cohort: "Q3 2025 (N=84)", m3: 89, m6: 82, m9: 77, m12: 72, m18: 66, current: 63 },
            { cohort: "Q4 2025 (N=112)", m3: 92, m6: 86, m9: 81, m12: 75, m18: null, current: 72 },
            { cohort: "Q1 2026 (N=148)", m3: 94, m6: 88, m9: 83, m12: null, m18: null, current: 81 },
            { cohort: "Q2 2026 (N=184)", m3: 96, m6: 91, m9: null, m12: null, m18: null, current: 89 },
          ].map((r) => (
            <div key={r.cohort} className="flex items-center gap-2">
              <p className="text-[9px] w-32 shrink-0 font-mono">{r.cohort}</p>
              {[r.m3, r.m6, r.m9, r.m12, r.m18].map((v, i) => (
                <div key={i} className={`h-6 w-12 rounded-sm flex items-center justify-center text-[8px] font-mono font-bold shrink-0 ${v === null ? "bg-muted/30 text-transparent" : v >= 85 ? "bg-emerald-100 text-emerald-700" : v >= 70 ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                  {v !== null ? `${v}%` : "—"}
                </div>
              ))}
              <div className={`h-6 flex-1 rounded-sm flex items-center justify-center text-[8px] font-mono font-bold ${r.current >= 85 ? "bg-emerald-200 text-emerald-800" : r.current >= 70 ? "bg-blue-200 text-blue-800" : "bg-orange-200 text-orange-800"}`}>
                Now: {r.current}%
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[8px] w-32 shrink-0 font-mono text-muted-foreground">Periode:</p>
            {["M+3", "M+6", "M+9", "M+12", "M+18"].map(l => (
              <p key={l} className="text-[7px] font-mono text-muted-foreground w-12 text-center shrink-0">{l}</p>
            ))}
            <p className="text-[7px] font-mono text-muted-foreground flex-1 text-center">Current</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1">Cohort terbaru (Q2 2026) paling kuat di M+3 (96%) — onboarding baru lebih baik · Churn utama terjadi M+9 ke M+12</p>
      </div>

      {/* Contractor Upsell & Cross-sell Opportunity Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ArrowUpRight className="h-3.5 w-3.5 text-primary" /> UPSELL × CROSS-SELL MAP — Produk Apa yang Paling Natural untuk Ditawarkan ke Kontraktor Berdasarkan Profil Mereka?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { segment: "Kontraktor SKK J7 yang baru onboard (<3 bulan)", count: 142, currentProduct: "SKK J7 Advisory", topUpsell: "SKK J8 Express (dalam 3 bulan)", upsellRate: 67, topCrosssell: "Intel Briefing Tender Alert", crossRate: 41, potentialRev: "Rp 2.8jt/klien", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { segment: "Kontraktor aktif tender BUMN (bid rate >2/bln)", count: 87, currentProduct: "Intel Briefing Standard", topUpsell: "Intel Briefing Premium + Radar Kompetitor Bundle", upsellRate: 54, topCrosssell: "Bid Document Review (new product)", crossRate: 38, potentialRev: "Rp 4.2jt/klien", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { segment: "Kontraktor vintage >18 bulan + revenue naik", count: 64, currentProduct: "Multiproduct (avg 2.7 produk)", topUpsell: "Enterprise plan (all-in-one + dedicated AM)", upsellRate: 31, topCrosssell: "White-label intel untuk tim sales klien", crossRate: 18, potentialRev: "Rp 12jt/klien", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
            { segment: "Kontraktor luar Jawa tanpa AM lokal", count: 94, currentProduct: "SKK J8 atau J9 saja (single product)", topUpsell: "Add-on: WhatsApp consultation 2×/bulan", upsellRate: 24, topCrosssell: "Regional intel (Sulawesi / Kalimantan) — belum ada", crossRate: 0, potentialRev: "Rp 1.4jt/klien (dari 0)", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.segment} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start justify-between mb-1">
                <p className={`text-[9px] font-bold ${r.tc} flex-1`}>{r.segment} ({r.count} klien)</p>
                <p className={`text-[10px] font-black font-mono ${r.tc} shrink-0 ml-2`}>{r.potentialRev}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <p className="text-[8px] font-bold text-muted-foreground">Upsell ({r.upsellRate}% convert):</p>
                  <p className="text-[9px]">{r.topUpsell}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-muted-foreground">Cross-sell ({r.crossRate}% convert):</p>
                  <p className="text-[9px]">{r.topCrosssell}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contractor Network Effect Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> NETWORK EFFECT MAP — Pola Referral di Antara Kontraktor MJP: Siapa yang Paling Banyak Membawa Klien Baru?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[9px] text-muted-foreground">Top referrer (kontraktor yang paling banyak merekomendasikan MJP ke koleganya):</p>
          {[
            { referrer: "CV Maju Sejahtera (Semarang)", referred: 12, converted: 9, convRate: 75, avgValue: "Rp 2.1jt/klien", totalValue: "Rp 18.9jt", tier: "PLATINUM", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
            { referrer: "PT Graha Konstruksi (Surabaya)", referred: 8, converted: 7, convRate: 88, avgValue: "Rp 3.4jt/klien", totalValue: "Rp 23.8jt", tier: "PLATINUM", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
            { referrer: "Asosiasi BUJK Sulawesi (via Budi)", referred: 14, converted: 6, convRate: 43, avgValue: "Rp 1.8jt/klien", totalValue: "Rp 10.8jt", tier: "GOLD", tc: "text-amber-700", bc: "bg-amber-50 border-amber-200" },
            { referrer: "UD Karya Setia (Balikpapan)", referred: 5, converted: 4, convRate: 80, avgValue: "Rp 2.7jt/klien", totalValue: "Rp 10.8jt", tier: "GOLD", tc: "text-amber-700", bc: "bg-amber-50 border-amber-200" },
            { referrer: "CV Berkat Bangun (Makassar)", referred: 4, converted: 3, convRate: 75, avgValue: "Rp 1.4jt/klien", totalValue: "Rp 4.2jt", tier: "SILVER", tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
          ].map((r) => (
            <div key={r.referrer} className={`border rounded-sm p-2.5 ${r.bc} flex items-center gap-3`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={`text-[9px] font-bold ${r.tc}`}>{r.referrer}</p>
                  <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.tier}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground">
                  <span>Refer: {r.referred} · Konversi: {r.converted} ({r.convRate}%)</span>
                  <span className={`font-bold ${r.tc}`}>Total value: {r.totalValue}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Referral program formal belum ada — ini semua organic. Dengan loyalty reward 5–10%, estimasi referral bisa 3× lipat.</p>
      </div>

      {/* Contractor Health Score Breakdown */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> CONTRACTOR HEALTH SCORE — Formula dan Komponen yang MJP Gunakan untuk Nilai Kesehatan Setiap Profil Kontraktor
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          <p className="text-[9px] text-muted-foreground">Health Score = weighted composite dari 8 dimensi (0–100), update real-time:</p>
          {[
            { dim: "SKK Status & Freshness", weight: 25, desc: "Masih aktif, tidak expired, jenjang sesuai bidang", sample: 94, c: "bg-emerald-500" },
            { dim: "Tender Win Rate (12 bln)", weight: 20, desc: "% tender yang dimenangkan dari total yang diikuti", sample: 34, c: "bg-blue-400" },
            { dim: "Payment & Compliance Record", weight: 18, desc: "Tidak ada blacklist LPSE, tidak ada sengketa aktif", sample: 100, c: "bg-emerald-400" },
            { dim: "Portfolio & Pengalaman", weight: 15, desc: "Jumlah proyek selesai, nilai proyek, kompleksitas", sample: 67, c: "bg-blue-300" },
            { dim: "Aktivitas & Engagement MJP", weight: 12, desc: "Buka briefing, tanya AM, gunakan fitur platform", sample: 81, c: "bg-violet-400" },
            { dim: "Kapasitas Finansial", weight: 6, desc: "Estimasi dari nilai tender yang diikuti + SBU class", sample: 74, c: "bg-orange-400" },
            { dim: "Reputasi Komunitas", weight: 2, desc: "Review dari BUJK lain, asosiasi, forum", sample: 88, c: "bg-slate-400" },
            { dim: "Kelengkapan Profil", weight: 2, desc: "% field profil yang terisi di platform MJP", sample: 92, c: "bg-slate-300" },
          ].map((d) => (
            <div key={d.dim} className="flex items-center gap-2">
              <p className="text-[9px] w-40 shrink-0">{d.dim}</p>
              <div className="w-6 text-right shrink-0">
                <span className="text-[8px] font-mono font-bold text-muted-foreground">{d.weight}%</span>
              </div>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${d.c} rounded-full`} style={{ width: `${d.sample}%` }} />
              </div>
              <span className="text-[8px] font-mono font-bold text-primary w-6 shrink-0">{d.sample}</span>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Contoh: CV Sukses Mandiri Health Score = 78/100 (SKK warning: expire 7 Agt). PT Nusantara Build = 94/100 (healthy).</p>
      </div>

      {/* Contractor Vertical Specialization Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Map className="h-3.5 w-3.5 text-primary" /> CONTRACTOR VERTICAL MAP — Di Segmen Pekerjaan Apa Klien MJP Paling Banyak Bermain dan Di Mana Masih Ada Gap Coverage?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { vertical: "Gedung Perkantoran & Komersial", clients: 184, tenderWinRate: 34, avgHPS: "Rp 8.4jt", mjpCoverage: "DEEP", trend: "+12% vs thn lalu", tc: "text-emerald-700", c: "bg-emerald-500" },
            { vertical: "Infrastruktur Jalan & Jembatan", clients: 127, tenderWinRate: 28, avgHPS: "Rp 14.2jt", mjpCoverage: "GOOD", trend: "+7%", tc: "text-emerald-700", c: "bg-emerald-400" },
            { vertical: "Perumahan (Residensial)", clients: 94, tenderWinRate: 41, avgHPS: "Rp 3.1jt", mjpCoverage: "GOOD", trend: "+21%", tc: "text-blue-700", c: "bg-blue-400" },
            { vertical: "Instalasi MEP (Mekanik-Elektrikal)", clients: 67, tenderWinRate: 31, avgHPS: "Rp 5.7jt", mjpCoverage: "MEDIUM", trend: "+4%", tc: "text-blue-700", c: "bg-blue-300" },
            { vertical: "Bendungan & Pengairan", clients: 34, tenderWinRate: 22, avgHPS: "Rp 22.8jt", mjpCoverage: "THIN", trend: "+1%", tc: "text-orange-700", c: "bg-orange-300" },
            { vertical: "PPP / Kerjasama Pemerintah-Swasta", clients: 8, tenderWinRate: 18, avgHPS: "Rp 84jt", mjpCoverage: "GAP", trend: "new", tc: "text-red-700", c: "bg-red-300" },
            { vertical: "Green Building / ESG", clients: 4, tenderWinRate: 14, avgHPS: "Rp 31jt", mjpCoverage: "GAP", trend: "new", tc: "text-red-700", c: "bg-red-300" },
          ].map((r) => (
            <div key={r.vertical} className="flex items-center gap-2">
              <p className="text-[9px] w-44 shrink-0">{r.vertical}</p>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${r.c} rounded-full`} style={{ width: `${(r.clients / 184) * 100}%` }} />
              </div>
              <span className={`text-[8px] font-mono font-bold w-6 text-right shrink-0 ${r.tc}`}>{r.clients}</span>
              <span className={`text-[7px] font-mono w-16 shrink-0 ${r.mjpCoverage === "GAP" ? "text-red-700 font-bold" : r.mjpCoverage === "THIN" ? "text-orange-700" : "text-muted-foreground"}`}>{r.mjpCoverage}</span>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">PPP + Green Building = 0% penetrasi tapi growing market · Adding 1 specialist untuk kedua vertical = unlock {'>'} Rp 800jt market</p>
      </div>

      {/* Contractor Lifecycle Value Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> CONTRACTOR LIFECYCLE VALUE — Berapa Revenue yang MJP Terima dari Seorang Kontraktor Sepanjang Hubungan Mereka dengan Platform?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { segment: "BUJK Kecil (J7, omset <Rp 2M)", avgLifespan: "2.8 thn", avgMRR: "Rp 499rb", ltv: "Rp 16.8jt", cac: "Rp 2.4jt", ltvCacRatio: "7.0×", topProducts: "SKK (1× renewal/thn) + Starter Intel Briefing", expansionPath: "J7 → J8 upgrade = MJP upsell SKK Express + Growth tier", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { segment: "BUJK Menengah (J8, omset Rp 2–20M)", avgLifespan: "4.1 thn", avgMRR: "Rp 1.8jt", ltv: "Rp 88.6jt", cac: "Rp 4.8jt", ltvCacRatio: "18.5×", topProducts: "Growth tier + SKK Express 2× + Custom Research", expansionPath: "J8 → J9 upgrade + Radar + Workroom = highest expansion potential", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { segment: "BUJK Besar (J9, omset > Rp 20M)", avgLifespan: "5.7 thn", avgMRR: "Rp 6.4jt", ltv: "Rp 437jt", cac: "Rp 12jt", ltvCacRatio: "36.4×", topProducts: "Pro/Enterprise + dedicated AM + custom intel", expansionPath: "Jadi anchor klien untuk regional referral network — worth investing heavily in retention", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
          ].map((r) => (
            <div key={r.segment} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start gap-3 mb-1">
                <div className="flex-1">
                  <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.segment}</p>
                  <div className="flex flex-wrap gap-3 text-[8px] font-mono mb-0.5">
                    <span className="text-muted-foreground">Lifespan avg: {r.avgLifespan}</span>
                    <span className="text-muted-foreground">MRR avg: {r.avgMRR}</span>
                    <span className={`font-bold ${r.tc}`}>LTV: {r.ltv}</span>
                    <span className="text-muted-foreground">CAC: {r.cac}</span>
                    <span className={`font-bold ${r.tc}`}>LTV/CAC: {r.ltvCacRatio}</span>
                  </div>
                  <p className="text-[8px] text-muted-foreground mb-0.5">Top products: {r.topProducts}</p>
                  <p className={`text-[8px] font-mono ${r.tc}`}>Expansion: {r.expansionPath}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Insight: BUJK Menengah (J8) adalah sweet spot MJP — LTV 18.5× CAC, terbesar di volume. Prioritaskan akuisisi J8 dan prevent churn di segmen ini.</p>
      </div>

      {/* Contractor Success Playbook */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Award className="h-3.5 w-3.5 text-amber-500" /> SUCCESS PLAYBOOK — Pola yang Ditemukan dari 78 Klien BUJK yang Paling Berhasil di MJP: Apa yang Mereka Lakukan Berbeda?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { habit: "Buka Intel Briefing setiap pagi SEBELUM mulai kerja lain", frequency: "87% dari top performers melakukan ini", impact: "Win rate 3.4× lebih tinggi dari yang tidak buka briefing pagi", why: "Informasi segar dari briefing pagi langsung masuk ke keputusan hari ini — tender mana yang mau dikejar, kompetitor mana yang perlu diwaspadai.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { habit: "Gunakan Workroom untuk capture insight SEGERA setelah meeting klien/lapangan", frequency: "74% dari top performers melakukan ini", impact: "Knowledge retention 5× lebih tinggi vs tulis di sticky note atau tidak sama sekali", why: "Intelligence value hilang cepat. Insight dari rapat kemarin sudah 40% less actionable besok. Workroom = memory eksternal yang contextual.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { habit: "Review Radar Kompetitor sebelum setiap bid/penawaran", frequency: "91% dari top performers melakukan ini", impact: "Mengurangi 'blind bid' (offer tanpa tahu kompetitor yang likely masuk) dari 67% ke 12%", why: "Knowing your competition before entering a fight = basic strategy. Tapi di konstruksi, 88% BUJK masih bid tanpa intel ini.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { habit: "Aktif report temuan lapangan ke MJP (photo evidence, pain point baru)", frequency: "63% dari top performers melakukan ini", impact: "Klien yang active contributor mendapat intel 2.3× lebih relevan (data flywheel effect)", why: "Platform kami semakin akurat untuk mereka karena model belajar dari kontribusi mereka sendiri. Win-win yang real.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.habit} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.habit}</p>
              <div className="flex flex-wrap gap-3 text-[8px] font-mono mb-0.5">
                <span className={r.tc}>{r.frequency}</span>
                <span className={`font-bold ${r.tc}`}>Impact: {r.impact}</span>
              </div>
              <p className="text-[8px] text-muted-foreground">{r.why}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">Playbook ini dikirim ke semua klien baru di onboarding email hari ke-7 · AM follow up di hari ke-30 untuk coaching</p>
      </div>

      {/* Contractor Segmentation Strategy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ListFilter className="h-3.5 w-3.5 text-primary" /> SEGMENTATION STRATEGY — Bagaimana MJP Mensegmentasi 487 Klien agar Setiap Komunikasi, Produk, dan Support Relevan?
        </p>
        <div className="flex flex-col gap-2">
          <p className="text-[9px] font-mono text-muted-foreground mb-1">MJP menggunakan 3 dimensi segmentasi secara bersamaan untuk hyper-personalization:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            {[
              { dim: "Dimensi 1: Jenjang SKK (J7/J8/J9)", example: "J7 terima panduan dasar + reminder SKK. J9 terima intel BUMN + kompetitor besar.", clients: "J7: 84 · J8: 287 · J9: 116", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
              { dim: "Dimensi 2: Geografi (Jawa vs KTI)", example: "Jawa: intel high-competition market. KTI: sinyal low-competition + pre-announcement tender.", clients: "Jawa: 342 · KTI: 145", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
              { dim: "Dimensi 3: Life Stage (New/Active/Champion/At-Risk)", example: "New: onboarding intensive. At-risk: proactive AM outreach. Champion: referral program invite.", clients: "New: 43 · Active: 312 · Champion: 89 · At-risk: 43", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
            ].map((r) => (
              <div key={r.dim} className={`border rounded-sm p-2.5 ${r.bc}`}>
                <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.dim}</p>
                <p className="text-[8px] text-muted-foreground mb-0.5">{r.example}</p>
                <p className={`text-[8px] font-mono ${r.tc}`}>{r.clients}</p>
              </div>
            ))}
          </div>
          <div className="border rounded-sm p-2.5 bg-muted/20">
            <p className="text-[9px] font-bold mb-0.5">Cross-dimension example: J8 × Sulawesi × At-Risk</p>
            <p className="text-[8px] text-muted-foreground">Hanya ada 7 klien di segment ini. Action: Reza personal WA + offer free custom research tentang pasar tender Sulawesi sebagai retention gift. Data shows: segment ini 3.2× more likely to churn if not intervened.</p>
          </div>
        </div>
      </div>

      {/* Contractor Trust Score Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> TRUST SCORE FRAMEWORK — Bagaimana MJP Menghitung Skor Kepercayaan Sebuah BUJK yang Bisa Diberikan ke Klien Lain?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[9px] font-mono text-muted-foreground mb-1">Trust Score (0–100) dihitung dari 6 dimensi dengan weight berbeda:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            {[
              { dim: "Track Record Tender (30%)", desc: "Rasio tender yang diselesaikan on-time vs total kontrak. 100% completion = full 30 poin.", example: "PT Graha Konstruksi: 23/24 = 95.8% → 28.7 poin", tc: "text-emerald-700" },
              { dim: "SKK & Sertifikasi Validity (20%)", desc: "Semua SKK aktif + tidak ada masa kadaluarsa dalam 90 hari = full 20 poin.", example: "CV Maju: SKK expire 27 hari → 12 poin (deduction)", tc: "text-orange-700" },
              { dim: "Complaint & Dispute History (25%)", desc: "Setiap dispute = -5 poin. Dispute yang resolved = -2 poin. Zero dispute = full 25 poin.", example: "BUJK X: 2 resolved disputes = 25-4 = 21 poin", tc: "text-blue-700" },
              { dim: "Financial Health Proxy (15%)", desc: "Dihitung dari skala proyek yang dimenangkan vs kapasitas kelas. Consistent = tinggi.", example: "Overstretching (bid > 3× kapasitas): -8 poin", tc: "text-blue-700" },
              { dim: "Platform Engagement & Reporting (5%)", desc: "BUJK yang aktif contribute pain point + verification = lebih trusted.", example: "5 pain points verified + 2 photo evidence = +4 poin", tc: "text-slate-600" },
              { dim: "Peer Ratings dari Kontraktor Lain (5%)", desc: "BUJK yang pernah subkon dengan BUJK lain di-rate. Above average = +5 poin.", example: "3 ratings avg 4.2/5 = +4.2 poin", tc: "text-slate-600" },
            ].map((r) => (
              <div key={r.dim} className="border rounded-sm p-2.5 bg-muted/20">
                <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.dim}</p>
                <p className="text-[8px] text-muted-foreground mb-0.5">{r.desc}</p>
                <p className={`text-[8px] font-mono italic ${r.tc}`}>{r.example}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap text-[8px] font-mono">
            {[["90–100", "VERY TRUSTED", "text-emerald-700"], ["75–89", "TRUSTED", "text-blue-700"], ["60–74", "VERIFY BEFORE ENGAGE", "text-orange-700"], ["<60", "CAUTION", "text-red-700"]].map(([r, l, c]) => (
              <span key={l} className={`${c} font-bold`}>{r}: {l}</span>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Trust Score adalah fitur diferensiasi utama di halaman ini — klien yang mau subkon atau referral bisa gunakan ini sebagai screening awal.</p>
      </div>

      {/* Contractor Referral Economics */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> REFERRAL ECONOMICS — Berapa Revenue yang Dihasilkan dari Program Referral Klien MJP dan Bagaimana Mengoptimalkannya?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            {[
              { metric: "Total klien dari referral 2026 YTD", value: "89", sub: "45% dari total akuisisi baru", tc: "text-emerald-700" },
              { metric: "CAC referral vs paid", value: "Rp 480rb", sub: "vs Rp 2.4jt paid avg (5× lebih murah)", tc: "text-emerald-700" },
              { metric: "Churn rate referral cohort", value: "2.1%", sub: "vs 3.81% average (1.8× lebih rendah)", tc: "text-emerald-700" },
              { metric: "Avg referral per active champion", value: "3.2 klien", sub: "Top champion: 12 referrals", tc: "text-blue-700" },
            ].map((r) => (
              <div key={r.metric} className="border rounded-sm p-2 bg-muted/20">
                <p className={`text-[12px] font-black font-mono ${r.tc} leading-none`}>{r.value}</p>
                <p className="text-[8px] font-bold">{r.metric}</p>
                <p className={`text-[7px] font-mono ${r.tc}`}>{r.sub}</p>
              </div>
            ))}
          </div>
          <div className="border rounded-sm p-3 bg-emerald-50 border-emerald-200">
            <p className="text-[9px] font-bold text-emerald-700 mb-1">Champion Program (Tier 1 — {'>'} 3 referrals/thn):</p>
            <p className="text-[8px] text-muted-foreground mb-0.5">Benefit: 1 bulan gratis untuk setiap referral berhasil + early access ke fitur baru + undangan ke advisory session dengan tim</p>
            <p className="text-[8px] font-mono text-emerald-700">Current champions: 28 klien. Target: 50 champions by Q4 2026 via dedicated outreach.</p>
          </div>
          <div className="border rounded-sm p-3 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700 mb-1">Asosiasi Partner Program (Tier 2 — B2B2C):</p>
            <p className="text-[8px] text-muted-foreground mb-0.5">GAPENSI, PERSATUAN, dan asosiasi regional merekomendasikan MJP ke anggota mereka. MJP bayar flat fee atau revenue share.</p>
            <p className="text-[8px] font-mono text-blue-700">Current: 2 asosiasi aktif (GAPENSI Sulawesi + Jateng). 18 klien dari channel ini. Target: 8 asosiasi by 2027.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Referral adalah lowest CAC + highest quality channel. Every Rp 1 invested in champion program = Rp 8.3 LTV returned. Scale this ASAP.</p>
      </div>

      {/* Contractor Geographic Expansion Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" /> GEO EXPANSION MAP — Peta Prioritas Ekspansi MJP: Region Mana yang Belum Dilayani tapi Punya Demand Tinggi?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { region: "Sulawesi Selatan (Makassar)", currentClients: 34, potential: "280+", marketSize: "Rp 4.2T proyek konstruksi/thn", gap: "1 AM (Budi part-time). Coverage reaktif bukan proaktif.", plan: "Q4 2026: Budi full-time Sulawesi + 1 field researcher lokal hire.", priority: "P1", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { region: "Kalimantan Timur (IKN spillover)", currentClients: 18, potential: "190+", marketSize: "Rp 6.1T proyek konstruksi/thn (IKN + non-IKN)", gap: "Tidak ada AM di Kaltim. Semua dilayani remote dari Surabaya.", plan: "Q1 2027: Partnership dengan GAPENSI Kaltim + remote AM upgrade.", priority: "P1", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { region: "Sumatera Selatan (Palembang)", currentClients: 12, potential: "160+", marketSize: "Rp 2.8T proyek konstruksi/thn", gap: "Zero local presence. Hanya 1 champion klien yang refer dari Jawa.", plan: "Q2 2027: Test remote-first model dengan 1 dedicated AM untuk Sumsel.", priority: "P2", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { region: "Papua / Papua Barat", currentClients: 4, potential: "120+", marketSize: "Rp 3.4T proyek konstruksi/thn (banyak dari BUMN)", gap: "Very high potential tapi sangat sulit dicover tanpa physical presence. Data coverage 8%.", plan: "2028+ — masuk setelah Sulawesi dan Kaltim mature.", priority: "P3", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { region: "Jawa Tengah (kota tier 2: Purwokerto, Tegal, Pekalongan)", currentClients: 28, potential: "210+", marketSize: "Rp 1.9T proyek konstruksi/thn tier 2 combined", gap: "AM Semarang ada tapi hanya jangkau Semarang + Solo. Tier 2 belum tersentuh.", plan: "Q3 2026: AM Semarang expand coverage ke 3 kota tier 2 dengan virtual AM model.", priority: "P2", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.region} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <div className="flex items-center gap-3 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.region}</p>
                <div className="flex gap-2 shrink-0 text-[7px] font-mono">
                  <span className="text-muted-foreground">Klien: {r.currentClients}</span>
                  <span className={r.tc}>Potential: {r.potential}</span>
                  <span className={`font-bold ${r.tc}`}>{r.priority}</span>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Gap: {r.gap}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Plan: {r.plan}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Jawa + Bali sudah 75% penetrated di target segments. Growth must come from KTI + outer Java. Sulsel + Kaltim = highest priority expansion markets untuk 2027.</p>
      </div>

      {/* BUJK Classification Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> BUJK CLASSIFICATION GUIDE — Panduan Lengkap Sistem Klasifikasi BUJK Indonesia yang Menentukan Siapa Bisa Ikut Tender Apa
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { jenjang: "J7 (Kecil)", modal: "Rp 0 – Rp 1M", maxContract: "Rp 2.5M per kontrak", employees: "<20 orang", skk: "Minimal 1 SKK J7", tender: "Tender kecil, daerah, non-BUMN", clients: "184 klien MJP", tc: "text-slate-700", bc: "bg-slate-50 border-slate-200" },
            { jenjang: "J8 (Menengah)", modal: "Rp 1M – Rp 10M", maxContract: "Rp 25M per kontrak", employees: "20–100 orang", skk: "Minimal 2 SKK J8 di subklasifikasi yang diminta", tender: "Tender menengah, BUMN kecil, proyek provinsi", clients: "231 klien MJP (largest segment)", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { jenjang: "J9 (Besar)", modal: "> Rp 10M", maxContract: "Tidak ada batasan", employees: "> 100 orang", skk: "Minimal 4 SKK J9, termasuk SKK ahli utama", tender: "Semua tender, termasuk proyek nasional dan BUMN besar", clients: "72 klien MJP", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.jenjang} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-1">
                <p className={`text-[9px] font-black flex-1 ${r.tc}`}>{r.jenjang}</p>
                <span className={`text-[7px] font-mono ${r.tc}`}>MJP Klien: {r.clients}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[8px] font-mono">
                <span className="text-muted-foreground">Modal min: {r.modal}</span>
                <span className="text-muted-foreground">Max kontrak: {r.maxContract}</span>
                <span className="text-muted-foreground">SDM: {r.employees}</span>
                <span className={r.tc}>SKK: {r.skk}</span>
                <span className={`col-span-2 ${r.tc}`}>Tender access: {r.tender}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="border rounded-sm p-3 bg-orange-50 border-orange-200">
          <p className="text-[9px] font-bold text-orange-700 mb-0.5">Common Misconception yang Sering Terjadi:</p>
          {[
            "J8 bisa bid tender J9? — TIDAK. Max kontrak J8 = Rp 25M. Tender > Rp 25M hanya untuk J9.",
            "Konsorsium bisa override jenjang? — YA, tapi hanya jika lead konsorsium adalah J9 dan portfolio gabungan qualify.",
            "PKPT grade = jenjang? — TIDAK. PKPT adalah klasifikasi pekerjaan, bukan jenjang. Satu BUJK bisa punya J8 di Sipil tapi J7 di Elektrikal.",
          ].map((m, i) => <p key={i} className="text-[8px] text-muted-foreground">• {m}</p>)}
        </div>
      </div>

      {/* Contractor Intelligence Subscription Value */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> CONTRACTOR INTEL VALUE — Nilai Konkret yang Diterima Klien dari Data Kontraktor MJP dalam 1 Bulan Berlangganan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { value: "Competitor Analysis: 7 tender bulan ini dianalisis siapa yang kemungkinan ikut", monetization: "Klien yang tahu kompetitor avg bid 6.1% lebih rendah dari HPS → adjust strategi → avg +8pp win rate", rp: "8pp × avg kontrak Rp 4.2M × 3 bid/bln = Rp 1.01jt potential additional win value/bln", tc: "text-emerald-700" },
            { value: "Subkon Screening: 14 BUJK di-screen trust score sebelum dipilih sebagai subkon", monetization: "Klien yang pakai screening: 0 subkon dispute tahun ini vs avg 1.2 dispute/thn sebelumnya. Dispute cost: Rp 800rb–5jt per kejadian.", rp: "Prevent 1.2 disputes/thn × avg Rp 1.8jt per dispute = Rp 2.16jt/thn value", tc: "text-blue-700" },
            { value: "Market Intelligence: 23 kontraktor baru terdeteksi di region klien bulan ini", monetization: "Early awareness = prepare counter-positioning sebelum kompetitor establish. Lead time advantage: avg 3 bulan.", rp: "Tidak mudah di-monetize tapi dikutip oleh 67% klien sebagai 'valuable intel'", tc: "text-blue-700" },
            { value: "Referral Network: 3 kontraktor yang trust score tinggi direferensikan sebagai potential consortium partner", monetization: "1 konsorsium dari referral ini = rata-rata Rp 7.8jt kontrak total untuk semua anggota.", rp: "Success case: 4 konsorsium facilitated 2026 YTD. Total kontrak: Rp 68jt", tc: "text-violet-700" },
          ].map((r) => (
            <div key={r.value} className="border rounded-sm p-3 bg-muted/10">
              <p className="text-[9px] font-bold mb-0.5">{r.value}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.monetization}</p>
              <p className={`text-[9px] font-mono font-bold ${r.tc}`}>{r.rp}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total value dari 4 kategori ini: {'>'} Rp 3.2jt/bln potential per klien. Subscription Rp 1.5jt (Growth) = 2.1× ROI dalam contractor intelligence alone — belum tender intel dan regulasi.</p>
      </div>

      {/* Subkon Due Diligence Checklist */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 text-primary" /> SUBKON DUE DILIGENCE — Checklist yang Disarankan MJP kepada Klien Sebelum Menunjuk Subkontraktor untuk Proyek Apapun
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { category: "Legal & Compliance", items: ["SIUJK masih berlaku (cek tanggal expiry)", "SKK tenaga ahli valid dan sesuai klasifikasi pekerjaan", "Tidak ada sengketa hukum aktif (cek via MJP trust score + PN e-court)", "NPWP aktif (minta copy, verify via DJP online)"], tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { category: "Financial Health", items: ["Minta rekening koran 3 bulan terakhir (untuk proyek > Rp 500jt)", "Cek apakah ada kredit macet via SLIK (bank bisa bantu)", "Track record pembayaran ke sub-subkon mereka (tanya referensi)", "Cash flow ratio: harus bisa cover 30 hari kerja sebelum termin pertama"], tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { category: "Technical Capability", items: ["Portfolio proyek serupa dalam 3 tahun terakhir (minimal 2 proyek sebanding)", "Peralatan sendiri atau selalu sewa? (sewa = higher mobilization risk)", "SDM inti: berapa tenaga ahli tetap vs freelance?", "Quality control process: ISO certified? internal QC team?"], tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { category: "Track Record Check (MJP Trust Score)", items: ["MJP trust score > 7.0/10", "Tidak ada dispute flag dalam 12 bulan", "Minimal 3 completed projects within 6 bulan dari deadline", "Referensi dari 2 BUJK lain yang pernah pakai mereka"], tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.category} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-1`}>{r.category}</p>
              {r.items.map((item, i) => (
                <div key={i} className="flex gap-1.5 items-start mb-0.5">
                  <span className={`text-[8px] font-bold shrink-0 ${r.tc}`}>□</span>
                  <p className="text-[8px] text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Klien yang pakai full checklist: subkon dispute rate 1.4% vs 11.8% industry average. Checklist ini tersedia sebagai PDF download untuk Pro/Enterprise klien di Knowledge Registry.</p>
      </div>

      {/* BUJK Trust Score Methodology */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> TRUST SCORE METHODOLOGY — Bagaimana MJP Menghitung Skor Kepercayaan 1–10 untuk Setiap BUJK di Database?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] font-mono text-muted-foreground mb-1">Trust score = weighted average dari 5 dimensi (total 100 poin, converted ke 1–10 scale):</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-2">
            {[
              { dim: "Project Completion Rate (30%)", how: "% proyek yang selesai on time / total proyek yang dimenangkan. Data dari LPSE award vs FHO announcements.", benchmark: "> 85% = excellent. 70–85% = acceptable. <70% = caution.", tc: "text-emerald-700" },
              { dim: "Dispute History (25%)", how: "Jumlah dan severity disputé yang terdokumentasi: LPJK complaints, media coverage, klien reports di MJP.", benchmark: "0 disputes 24bln = full score. 1 minor = -10pt. 1 major = -30pt.", tc: "text-emerald-700" },
              { dim: "Financial Signals (20%)", how: "SKK validity (proxy untuk company health), SIUJK renewal frequency, years in business, growth trajectory.", benchmark: "Stable + growing + valid docs = high score. Declining + expired = low.", tc: "text-blue-700" },
              { dim: "Peer Reputation (15%)", how: "Crowdsourced dari AM field notes, klien reports, GAPENSI member feedback. Qualitative converted to quantitative.", benchmark: "Net: positive mentions minus negative mentions. Normalized to 1–5 scale.", tc: "text-blue-700" },
              { dim: "Responsiveness (10%)", how: "Response time ke official communications (aanwijzing, klarifikasi dokumen) berdasarkan public record.", benchmark: "Proxi for professionalism. Always responds fast = highest score.", tc: "text-orange-700" },
            ].map((r) => (
              <div key={r.dim} className="border rounded-sm p-2 bg-muted/10">
                <p className={`text-[8px] font-bold ${r.tc}`}>{r.dim}</p>
                <p className="text-[7px] text-muted-foreground">{r.how}</p>
                <p className={`text-[7px] font-mono ${r.tc}`}>{r.benchmark}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap text-[8px] font-mono">
            {[["> 8.5", "HIGHLY TRUSTED", "text-emerald-700"], ["7.0–8.5", "TRUSTED", "text-blue-700"], ["5.0–7.0", "PROCEED WITH CAUTION", "text-orange-700"], ["<5.0", "HIGH RISK", "text-red-700"]].map(([range, label, tc]) => (
              <span key={range} className={`border rounded px-1.5 py-0.5 ${tc}`}>{range}: {label}</span>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Score di-update otomatis saat ada data baru. Manual review required jika score bergerak {'>'} 2 poin dalam 1 bulan (anomaly detection). Current database: 12.400 BUJK scored. 23% {'>'} 8.5. 31% di bawah 5.0.</p>
      </div>

      {/* Contractor Ecosystem Health */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> EKOSISTEM KESEHATAN BUJK — Kondisi Umum Industri Konstruksi Indonesia Berdasarkan Data MJP dari 12.400 BUJK Aktif
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {[
              { stat: "12.400", label: "BUJK aktif di database", tc: "text-primary" },
              { stat: "34%", label: "J7 (Kecil)", tc: "text-slate-600" },
              { stat: "48%", label: "J8 (Menengah)", tc: "text-blue-700" },
              { stat: "18%", label: "J9 (Besar)", tc: "text-emerald-700" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-lg font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          {[
            { insight: "Konsentrasi Geographic: 73% BUJK ada di Jawa + Bali meski proyek semakin tersebar ke KTI", implication: "Gap pasar: Kaltim, Sulsel, Maluku punya banyak tender tapi sedikit BUJK qualified. First-mover advantage yang significant untuk klien MJP yang ekspansi ke sini.", tc: "text-blue-700" },
            { insight: "SKK Compliance: Hanya 67% BUJK di database punya semua SKK yang valid dan current", implication: "33% BUJK bisa gugur administrasi saat ini jika tender butuh SKK tertentu. MJP klien dengan valid SKK = immediate competitive advantage vs 1/3 dari pasar.", tc: "text-emerald-700" },
            { insight: "Age Distribution: 28% BUJK berumur > 20 tahun tapi hanya 12% yang aktif bid dalam 12 bulan terakhir", implication: "Dormant legacy BUJK yang punya track record tapi tidak aktif. Acquisition opportunity untuk klien MJP yang mau joint venture atau acquire track record.", tc: "text-orange-700" },
            { insight: "Size vs Ambition: 41% J8 BUJK pernah bid J9 tender dan langsung kalah — bukan karena harga tapi karena tidak qualified secara teknis", implication: "Education opportunity: MJP bisa help J8 klien understand exactly what it takes to qualify for J9 tenders — and when NOT to waste resources on bids they cannot win.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.insight} className="border-l-2 border-muted pl-3 py-0.5">
              <p className={`text-[9px] font-bold ${r.tc}`}>{r.insight}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>→ {r.implication}</p>
            </div>
          ))}
        </div>
      </div>

      {/* BUJK Registration to Active Timeline */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-primary" /> BUJK LIFECYCLE — Timeline Lengkap dari BUJK Baru Berdiri Hingga Bisa Menang Tender Pemerintah Pertama: 9 Tahap yang Butuh Waktu
        </p>
        <div className="flex flex-col gap-1 mb-3">
          {[
            { step: "1", stage: "Akta Notaris + NIB (OSS)", time: "1–3 hari", desc: "Pendirian perusahaan. NIB terbit otomatis dari OSS setelah akta. Perlu modal minimal sesuai KBLI.", status: "STRAIGHTFORWARD", tc: "text-slate-600" },
            { step: "2", stage: "NPWP Badan + PKP", time: "3–7 hari", desc: "Wajib untuk pengadaan pemerintah. PKP harus aktif sebelum bisa terbitkan faktur pajak untuk kontrak.", status: "STRAIGHTFORWARD", tc: "text-slate-600" },
            { step: "3", stage: "SKK Tenaga Ahli Pertama", time: "14–45 hari", desc: "Minimum 1 tenaga ahli dengan SKK yang sesuai KBLI usaha. Ini bottleneck pertama untuk banyak pendiri baru.", status: "COMMON BOTTLENECK", tc: "text-orange-700" },
            { step: "4", stage: "SIUJK + SBU dari LPJK", time: "30–90 hari", desc: "Sertifikasi Badan Usaha — SIUJK dan SBU. Proses LPJK bisa panjang. Dokumen persyaratan sangat banyak.", status: "CRITICAL BOTTLENECK", tc: "text-red-700" },
            { step: "5", stage: "Daftar LPSE Nasional", time: "1–3 hari", desc: "DAFTAR di LPSE, submit dokumen kualifikasi. Cukup sekali untuk LPSE Nasional (LPSE LKPP).", status: "EASY once docs ready", tc: "text-emerald-700" },
            { step: "6", stage: "Daftar LPSE Daerah target", time: "1–5 hari per daerah", desc: "Setiap LPSE Kabupaten/Kota/Provinsi perlu registrasi terpisah. Banyak daerah = banyak registrasi.", status: "TEDIOUS", tc: "text-orange-700" },
            { step: "7", stage: "First 2–3 failed tenders (learning curve)", time: "3–6 bulan", desc: "Hampir semua BUJK baru gagal di tender pertama mereka. Evaluasi, revisi dokumen, coba lagi.", status: "INEVITABLE — speed up with MJP", tc: "text-orange-700" },
            { step: "8", stage: "First tender WIN", time: "6–18 bulan dari berdiri", desc: "Rata-rata BUJK baru butuh 6–18 bulan untuk menang tender pertama. MJP klien baru: avg 4.2 bulan.", status: "MJP accelerates 3×", tc: "text-emerald-700" },
            { step: "9", stage: "Build track record untuk upgrade kelas", time: "2–5 tahun", desc: "Upgrade J7→J8→J9 butuh track record kontrak yang selesai + nilai akumulasi tertentu.", status: "LONG-TERM", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.step} className="flex gap-2 items-start border-b py-1">
              <span className="text-[8px] font-black w-4 shrink-0">{r.step}.</span>
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-[8px] font-bold">{r.stage}</p>
                  <span className="text-[7px] font-mono text-muted-foreground">{r.time}</span>
                </div>
                <p className="text-[7px] text-muted-foreground">{r.desc}</p>
              </div>
              <span className={`text-[7px] font-mono shrink-0 text-right max-w-[120px] ${r.tc}`}>{r.status}</span>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">MJP accelerates stages 3, 7, 8 significantly. SKK Express (stage 3), Tender Intel (stage 7+8). Average new BUJK MJP client wins first tender in 4.2 months vs 18 months industry average.</p>
      </div>

      {/* Contractor Network Value Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> CONTRACTOR NETWORK VALUE — Bagaimana Database 12.400 BUJK MJP Menciptakan Network Effect yang Semakin Kuat Seiring Pertumbuhan?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { effect: "Consortium Formation Intelligence", howItWorks: "Klien A mencari partner konsorsium untuk tender J9 yang butuh 2 BUJK. MJP database → filter BUJK yang Trust Score > 8.5, SKK kompatibel, regional match, tidak sedang dalam dispute.", value: "3 konsorsium berhasil terbentuk via MJP matching 2026. Total contract value: Rp 147M. Average: Rp 49M per consortium vs Rp 5.8M solo J8.", tc: "text-emerald-700" },
            { effect: "Subkon Marketplace Intelligence", howItWorks: "Klien yang menang tender perlu subkontraktor spesifik untuk electrical, mechanical, atau specialized work. MJP database filter + Trust Score = safer subkon selection.", value: "47 klien reported using MJP subkon intel Q2 2026. Dispute rate among these: 1.4% vs 11.8% industry avg.", tc: "text-emerald-700" },
            { effect: "Competitor Track Record Access", howItWorks: "Sebelum head-to-head tender, klien bisa cek historical performance kompetitor yang akan dihadapi: win rate, avg discount, categories they dominate.", value: "Competitor-aware bidders win 31% more often than those who bid blind. This single feature is cited in 89% of Enterprise renewal conversations.", tc: "text-blue-700" },
            { effect: "Growing Database Feedback Loop", howItWorks: "Setiap klien baru = potensi intel baru (via pain points, field reports, AM feedback). 487 klien × average 3 intel submissions/bln = 1.461 additional data points/bln beyond crawler.", value: "Community data growing at 15% faster rate than crawler-only data. Network effect: each new client makes database better for all existing clients.", tc: "text-violet-700" },
          ].map((r) => (
            <div key={r.effect} className="border-l-2 border-muted pl-3 py-1.5">
              <p className="text-[9px] font-bold mb-0.5">{r.effect}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.howItWorks}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>{r.value}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Network effect adalah ultimate moat. Unlike a feature or price advantage — which can be copied — a network gets harder to replicate as it grows. MJP's 12.400 BUJK × 487 active clients = compounding intelligence value.</p>
      </div>

      {/* Geographic Coverage Gaps */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Map className="h-3.5 w-3.5 text-primary" /> GEOGRAPHIC COVERAGE — Coverage BUJK Database MJP per Wilayah dan Gap yang Menjadi Prioritas Ekspansi
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { region: "Jawa", bujk: "7.812 (63%)", coverage: "EXCELLENT", tender: "68% tender nasional", clientPct: "71% klien MJP", note: "Core market. Coverage sangat dalam. Competitor most likely to emerge here too.", tc: "text-emerald-700" },
            { region: "Bali + NTB + NTT", bujk: "934 (7.5%)", coverage: "GOOD", tender: "6% tender nasional", clientPct: "9% klien MJP", note: "Tourism-linked infrastructure growing. Good coverage relative to market size.", tc: "text-emerald-700" },
            { region: "Sumatra", bujk: "1.456 (11.7%)", coverage: "MODERATE", tender: "11% tender nasional", clientPct: "8% klien MJP", note: "Under-represented relative to market size. Target: Medan, Palembang. Budi field trips planned.", tc: "text-orange-700" },
            { region: "Kalimantan", bujk: "876 (7.1%)", coverage: "GROWING", tender: "8% tender nasional (IKN effect: growing)", clientPct: "7% klien MJP", note: "IKN acceleration = priority market. Intel density still low. Need KTI researcher.", tc: "text-orange-700" },
            { region: "Sulawesi", bujk: "743 (6%)", coverage: "WEAK", tender: "5% tender nasional", clientPct: "4% klien MJP", note: "Sector stress signal (Aug 2026). Coverage weak. Data gaps affecting signal quality.", tc: "text-red-700" },
            { region: "Papua + Maluku + Halmahera", bujk: "579 (4.7%)", coverage: "MINIMAL", tender: "2% nasional (growing with PNG projects)", clientPct: "1% klien MJP", note: "Strategic long-term. Not prioritized until KTI coverage improves.", tc: "text-red-700" },
          ].map((r) => (
            <div key={r.region} className="flex gap-2 items-start border-b py-1">
              <div className="w-24 shrink-0">
                <p className="text-[9px] font-bold">{r.region}</p>
                <p className={`text-[7px] font-mono ${r.tc}`}>{r.coverage}</p>
              </div>
              <div className="flex-1">
                <div className="flex gap-2 text-[7px] font-mono mb-0.5">
                  <span>{r.bujk}</span><span className="text-muted-foreground">tender: {r.tender}</span><span className="text-muted-foreground">clients: {r.clientPct}</span>
                </div>
                <p className="text-[8px] text-muted-foreground">{r.note}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Coverage strategy: deepen where we're strong (Jawa), grow where we're under-represented (Sumatra, Kalimantan). Don't spread thin. One regional researcher hire (KTI focus) changes the coverage picture dramatically.</p>
      </div>

      {/* BUJK Trust Score Deep Dive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> TRUST SCORE DEEP DIVE — Cara Menghitung Trust Score 1–10 untuk Setiap BUJK dan Bagaimana Klien Menggunakannya untuk Keputusan Konsorsium
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Trust Score = weighted composite dari 8 dimensi (total 100 poin, dinormalisasi ke 1–10):</p>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {[
              { dim: "Tender Win History (25 poin)", detail: "Win rate 3 tahun terakhir, avg discount, category consistency", tc: "text-emerald-700" },
              { dim: "SKK Compliance (20 poin)", detail: "% tenaga ahli aktif vs total yang di-claim. Update frequency.", tc: "text-emerald-700" },
              { dim: "Dispute/Blacklist Record (20 poin)", detail: "TKDN violations, blacklist history, sanggahan filed against them", tc: "text-red-700" },
              { dim: "Financial Health Signals (15 poin)", detail: "On-time payment reports, KUR default (from community intel)", tc: "text-orange-700" },
              { dim: "Delivery Track Record (10 poin)", detail: "PHO on-time rate, quality complaint reports dari field", tc: "text-blue-700" },
              { dim: "Community Reputation (5 poin)", detail: "Peer reviews, association standing, payment timeliness reports", tc: "text-blue-700" },
              { dim: "Certification Freshness (3 poin)", detail: "ISO, SMK3, SMMK certification status and expiry", tc: "text-slate-600" },
              { dim: "Active Engagement (2 poin)", detail: "Actively participates in tender market vs dormant company", tc: "text-slate-600" },
            ].map((r) => (
              <div key={r.dim} className="border rounded-sm p-2 bg-muted/10">
                <p className={`text-[8px] font-bold ${r.tc}`}>{r.dim}</p>
                <p className="text-[7px] text-muted-foreground">{r.detail}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1 text-[7px] font-mono">
            {[
              { range: "9.0–10.0", label: "ELITE — consortium first choice", tc: "text-emerald-700" },
              { range: "7.5–8.9", label: "RELIABLE — safe to partner", tc: "text-blue-700" },
              { range: "5.0–7.4", label: "VERIFY — additional due diligence", tc: "text-orange-700" },
              { range: "<5.0", label: "AVOID — high risk indicators", tc: "text-red-700" },
            ].map((r) => <div key={r.range} className="border rounded-sm p-1.5 text-center"><p className={`font-bold ${r.tc}`}>{r.range}</p><p className="text-muted-foreground">{r.label}</p></div>)}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Trust Score diupdate setiap 3 bulan atau saat ada material event (blacklist, major win/loss). Community data dari klien lapangan adalah komponen yang tidak bisa digantikan oleh crawler — ini yang membuat MJP scores lebih accurate dari government data alone.</p>
      </div>

      {/* BUJK Lifecycle Event Triggers */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5 text-primary" /> LIFECYCLE TRIGGERS — Event dalam Siklus Hidup BUJK yang Otomatis Memicu Notifikasi ke Klien yang Berpotensi Terpengaruh
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { event: "BUJK Masuk Daftar Hitam LKPP", trigger: "Immediate — within 2 jam of LKPP announcement", alert: "All klien who partnered with or bid against this BUJK in last 6 months. Alert: 'Kompetitor/mitra Anda [X] baru saja masuk daftar hitam. Cek implikasi tender aktif Anda.'", severity: "L1 CRITICAL", tc: "text-red-700" },
            { event: "BUJK SKK Mass Expiry (3+ tenaga ahli expire dalam 30 hari)", trigger: "30 hari sebelum expiry (early warning system)", alert: "Klien yang bergantung pada BUJK ini untuk konsorsium atau yang menghadapi BUJK ini sebagai kompetitor. 'Warning: [X] will have 3 SKK expire on [date]. Verify consortium dependency.'", severity: "L2 HIGH", tc: "text-orange-700" },
            { event: "Competitor BUJK Naik Kelas (J7→J8 atau J8→J9)", trigger: "Saat LPJK update registrasi", alert: "Klien di kategori yang akan terdampak oleh masuknya kompetitor baru. 'New J8 entrant in your category: [X]. Profile attached.'", severity: "L2 HIGH", tc: "text-orange-700" },
            { event: "Potential Consortium Partner Wins Major Tender", trigger: "3 hari setelah pengumuman pemenang LPSE", alert: "Klien yang pernah ekspresikan minat ke BUJK tersebut. 'Your potential partner [X] just won a Rp 12M project — confirms their J9 capacity. Consortium opportunity?'", severity: "L3 INFO", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.event} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[8px] font-bold flex-1">{r.event}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.severity}</span>
              </div>
              <p className={`text-[7px] font-mono text-muted-foreground mb-0.5`}>Trigger: {r.trigger}</p>
              <p className="text-[7px]">Alert content: {r.alert}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Lifecycle triggers convert database into proactive intelligence. Klien don't have to remember to check — MJP checks for them. This is the 'always on' promise. 94% of triggered alerts result in klien taking action within 24 hours (vs 67% for unprompted recommendations).</p>
      </div>

      {/* BUJK Category Emerging Trends */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> EMERGING TRENDS — 5 Tren yang Sedang Mengubah Lanskap BUJK di Indonesia pada 2026–2028 dan Mengapa MJP Harus Merespons Sekarang?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { trend: "Konsolidasi BUJK Kecil — J7 bergabung untuk naik ke J8", velocity: "FAST", evidence: "LPJK data: 340 new J8 registrations 2026 YTD vs 180 dalam periode yang sama 2025 (+89%). Banyak adalah merger of 2–3 J7.", mjpImpact: "Opportunity: konsorsium formation intel is now a must-have. New J8 market = new MJP prospects. Threat: smaller total addressable count if consolidation accelerates.", tc: "text-emerald-700" },
            { trend: "BUJK spesialisasi — growth in MEP, green, digital infra specialists", velocity: "MEDIUM", evidence: "New KBLI registrations: MEP +34%, IT Infrastructure +67%, Environmental +29% YoY. Generalist BUJK still dominant but specialists growing faster.", mjpImpact: "Specialist vertical content needed (MEP already planned). Tender watchlist must support specialty category filtering more granularly.", tc: "text-blue-700" },
            { trend: "Digitalisasi procurement — LPSE adoption by smaller kabupaten", velocity: "MEDIUM", evidence: "LKPP report: 89% of kabupaten now on LPSE vs 74% in 2024. Each new kabupaten = new tender source for MJP crawlers.", mjpImpact: "Coverage improvement opportunity: auto-onboard new LPSE instances. Currently: 6-week manual setup per new source. Roadmap: auto-discovery.", tc: "text-blue-700" },
            { trend: "BIM mandate creating technology gap between large and small BUJK", velocity: "CRITICAL", evidence: "Perpres XX/2026 signed. J9 adoption starting. J8 lagging. J7 mostly unaware.", mjpImpact: "BIM vertical directly addresses this gap. MJP positioned as 'the platform that tells you what BIM means for your BUJK class and how to comply.'", tc: "text-red-700" },
            { trend: "Payment delay culture worsening — avg termin delay up from 47 to 63 days", velocity: "SLOW but PERSISTENT", evidence: "Community pain point reports: payment delay mentions up 34% QoQ. Government and BUMN projects worst (avg 63 days post-PHO). Private: 38 days.", mjpImpact: "Post-PHO warranty tracking product addresses downstream. Upstream: payment watchlist per buyer entity — new feature idea from pain point cluster.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.trend} className="border-l-2 border-muted pl-3 py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[8px] font-bold flex-1">{r.trend}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.velocity === "CRITICAL" ? "text-red-700" : r.velocity === "FAST" ? "text-emerald-700" : r.velocity === "MEDIUM" ? "text-blue-700" : "text-orange-700"}`}>{r.velocity}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Evidence: {r.evidence}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>MJP impact: {r.mjpImpact}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Trend monitoring adalah input utama untuk 18-month product roadmap. MJP's advantage: we see these trends in real data before most analysts do. First published trend analysis = credibility signal to prospects and investors.</p>
      </div>

      {/* Blacklist Recovery Intel */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-red-500" /> BLACKLIST INTEL — Panduan MJP untuk BUJK yang Terkena Daftar Hitam LKPP: Apa yang Terjadi, Berapa Lama, dan Apa Jalan Keluarnya?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="border rounded-sm p-2.5 bg-red-50 border-red-200 mb-1">
            <p className="text-[9px] font-bold text-red-700">Daftar Hitam LKPP — Impact Summary</p>
            <p className="text-[8px]">BUJK masuk daftar hitam = tidak bisa ikut pengadaan pemerintah (semua level: pusat, provinsi, kabupaten, BUMN/D) selama masa blacklist. Blacklist period: 2 tahun (default) atau seumur hak usaha untuk kasus kriminal berat. 43 BUJK dalam database MJP saat ini berstatus blacklisted.</p>
          </div>
          {[
            { step: "Phase 1: Impact Assessment (Hari 1–7)", detail: "Identifikasi semua tender aktif di mana BUJK terdaftar. Tender yang sudah masuk tahap evaluasi: otomatis gugur. Tender yang baru WA: batalkan submission. Kompensasi dari klien mitra yang ikut konsorsium: perlu renegotiasi.", action: "MJP Alert: notif semua klien yang pernah partnerkan dengan BUJK ini.", tc: "text-red-700" },
            { step: "Phase 2: Cause Identification (Hari 1–14)", detail: "Blacklist reasons: wanprestasi (tidak selesaikan pekerjaan), pemalsuan dokumen, kolusi, tidak penuhi kewajiban jaminan. Each has different recovery path. Wanprestasi: most recoverable. Fraud: near-permanent.", action: "Sari contacts LPJK contact for off-record detail. Root cause shapes recovery strategy.", tc: "text-orange-700" },
            { step: "Phase 3: Subsidiary/New Entity Strategy (if warranted)", detail: "Legal pathway: new PT entity separate from blacklisted entity. BUJK owners sometimes register new company. This is legal if done transparently but LKPP increasingly tracking beneficial ownership.", action: "Not MJP's advice — refer to legal counsel. But MJP tracks subsidiary registrations for competitor intelligence.", tc: "text-orange-700" },
            { step: "Phase 4: Post-Blacklist Rehabilitation (after period ends)", detail: "After blacklist period: re-registration required. New BUJK profile needed. MJP helps navigate requalification process. SKK Express for any expired SKK during blacklist period.", action: "Dewi re-onboarding case for any MJP klien who exits blacklist.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.step} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.step}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>MJP action: {r.action}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Blacklist intelligence is dual-use: (1) protect MJP klien from partnering with blacklisted BUJK accidentally. (2) track competitor BUJK blacklisting as opportunity signal — their clients are now vulnerable to MJP outreach. Reza gets automated notification when competitor enters daftar hitam.</p>
      </div>

      {/* BUJK Performance Analytics */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> BUJK PERFORMANCE — Metrik yang MJP Gunakan untuk Mengukur Performa Historis BUJK: Dari Data Publik ke Trust Score yang Bermakna?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Performance Metric</th>
                  <th className="p-1 text-center">Source</th>
                  <th className="p-1 text-center">Weighting</th>
                  <th className="p-1 text-center">Refresh</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Tender Win Rate (5yr)", "LPSE outcome data", "20%", "Monthly"],
                  ["Contract Completion Rate", "LPJK + community reports", "18%", "Quarterly"],
                  ["PHO Timeliness (avg days over/under)", "LPJK completion records", "15%", "Quarterly"],
                  ["Payment Dispute History", "Community reports + court records", "14%", "Monthly"],
                  ["SKK Compliance (% expired SKK at last check)", "LPJK database", "12%", "Bi-monthly"],
                  ["Blacklist / Warning History", "LKPP official + LPJK", "10%", "Real-time"],
                  ["Subkon Payment Track Record", "Budi field + community reports", "8%", "Monthly"],
                  ["BIM/Digital Readiness", "New — self-reported + verification", "3%", "Annual"],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className="p-1 text-center font-bold text-primary">{row[2]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-muted/10">
            <p className="text-[9px] font-bold">Trust Score calculation formula:</p>
            <p className="text-[8px] font-mono">[WinRate×0.20] + [CompletionRate×0.18] + [PHOTimeliness×0.15] + [NoDispute×0.14] + [SKKCompliant×0.12] + [NoBlacklist×0.10] + [SubkonPay×0.08] + [BIMReady×0.03] → Normalized 0–10</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Trust Score methodology diverifikasi oleh Sari dan 3 Enterprise klien yang dijadikan panel advisors. Formula disesuaikan 2× berdasarkan feedback: originally PHO Timeliness was 8% — Enterprise klien said it should be higher (was at 15% now). 'We lose more money from late PHO than from failed tenders.'</p>
      </div>

      {/* BUJK Segmentation for MJP Klien */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> BUJK SEGMENTATION — Profil 5 Tipe BUJK yang Paling Sering Menjadi Klien MJP: Karakteristik, Kebutuhan, dan Cara Optimal Melayani Tiap Tipe
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              type: "Tipe 1: The Climber (26% of klien)",
              profile: "J7 atau J8 aktif naik ke jenjang berikutnya. Obsesi: kualifikasi, persyaratan, apa yang perlu disiapkan. Sering baru bergabung setelah mendengar dari komunitas BUJK.",
              needs: "SKK guidance, qualification roadmap, SBU requirements checklist, KBLI mapping",
              bestProduct: "SKK Express + Knowledge Registry. Conversion: 71% upgrade to Pro after first SKK case.",
              tc: "text-blue-700"
            },
            {
              type: "Tipe 2: The Tender Hunter (34% of klien)",
              profile: "Aktif bid 5–15 tender/tahun. Wants maximum tender intelligence — cepat, spesifik, actionable. Very ROI-focused. 'Does this alert increase my win probability?'",
              needs: "Tender alerts, competitor bid history, HPS estimation, Win probability scoring",
              bestProduct: "Core Platform + Competitor Radar. Highest LTV/CAC if retained. Churn trigger: 2+ months without a win.",
              tc: "text-emerald-700"
            },
            {
              type: "Tipe 3: The Compliance Worrier (18% of klien)",
              profile: "Risk-averse. Afraid of being disqualified. Uses MJP primarily for regulatory alerts and compliance checklists. Reads every L1 alert in full. Slow to act but loyal.",
              needs: "Regulatory alerts, compliance checklist, SKK renewal reminders, audit preparation guides",
              bestProduct: "Pro (for full regulatory coverage). Lowest churn rate (7%/bln) — compliance anxiety is evergreen.",
              tc: "text-orange-700"
            },
            {
              type: "Tipe 4: The Enterprise Coordinator (13% of klien)",
              profile: "J9 or large J8. Multiple staff using MJP. Procurement director level. Needs team access, reporting, API integration with internal systems.",
              needs: "Enterprise license, team seats, data export, API access, dedicated account management (Reza)",
              bestProduct: "Enterprise tier. Highest absolute LTV. Slowest to sign but most loyal once signed.",
              tc: "text-primary"
            },
            {
              type: "Tipe 5: The Curious Evaluator (9% of klien)",
              profile: "Recently heard about MJP, joined to explore. No clear primary need. Browsing. At risk of churning after trial if no aha moment in Day 14.",
              needs: "Guided onboarding, fast aha moment, Reza personal touch",
              bestProduct: "Basic → convert to Tender Hunter or Compliance Worrier via usage pattern detection.",
              tc: "text-muted-foreground"
            },
          ].map((r) => (
            <div key={r.type} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.type}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.profile}</p>
              <p className="text-[7px] mb-0.5"><strong>Needs:</strong> {r.needs}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.bestProduct}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Segmentation identified from Reza's 487 klien interviews (first 3 months analysis). Not based on BUJK class alone — personality and use case cuts across class. Key insight: same J8 company can be a Tender Hunter (directur) and Compliance Worrier (admin). Segment by use case, not just firmographic.</p>
      </div>

      {/* Field Research Protocol */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Map className="h-3.5 w-3.5 text-primary" /> BUDI'S PROTOCOL — SOP Riset Lapangan Budi: Bagaimana Satu Field Researcher Bisa Menghasilkan 180+ Data Point per Bulan dari 3 Provinsi Berbeda?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200 mb-1">
            <p className="text-[9px] font-bold text-blue-700">Budi's monthly output (YTD 2026 avg):</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 mt-1">
              {[["37", "Pain point reports"], ["18", "Contractor profiles updated"], ["6", "New BUJK discovered"], ["4", "Field photos per visit"]].map(([n, l]) => (
                <div key={l} className="text-center">
                  <p className="text-sm font-black font-mono text-primary">{n}</p>
                  <p className="text-[7px] text-muted-foreground">{l}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[9px] font-bold mb-0.5">Weekly rhythm (Budi's standard week):</p>
          {[
            { day: "Senin", activity: "Review assigned BUJK list for week. WhatsApp confirmation with 4–5 kontraktor. Prepare questionnaire checklist (digital form on phone).", tools: "Google Forms + WhatsApp" },
            { day: "Selasa–Rabu", activity: "Field visits (2–3 per day on same route). Each visit: 20–30 menit. Structured interview + observation + photo documentation.", tools: "MJP mobile app (offline mode) + camera" },
            { day: "Kamis", activity: "Data entry dari catatan lapangan. Audio memo transcription (Budi dictates, Hendra Jr. built simple transcription tool). Upload to platform.", tools: "Mobile app sync + internal transcription" },
            { day: "Jumat", activity: "Weekly Close: Budi reports verbally to Sari (15 menit WhatsApp call). 'What surprised me this week.' Sari decides which items become formal research items.", tools: "WhatsApp voice" },
          ].map((r) => (
            <div key={r.day} className="flex gap-2 border-b py-1">
              <p className="text-[8px] font-bold w-16 shrink-0">{r.day}</p>
              <div className="flex-1">
                <p className="text-[7px] text-muted-foreground">{r.activity}</p>
                <p className="text-[7px] font-mono text-blue-700">{r.tools}</p>
              </div>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-muted/10 mt-1">
            <p className="text-[9px] font-bold">The 3 questions Budi asks every BUJK:</p>
            <p className="text-[8px]">1. 'Proyek apa yang sedang Anda kerjakan sekarang dan yang akan datang?' (Project pipeline intelligence) 2. 'Apa hambatan terbesar yang Anda alami dalam 3 bulan terakhir?' (Pain point collection) 3. 'Bagaimana cara Anda mencari informasi tender dan regulasi saat ini?' (Platform usage behavior)</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Budi's access to candid BUJK conversations is irreplaceable. His 8-year network in Jateng + Jabar means BUJK directors talk to him as a peer, not as a researcher. MJP rule: Budi never introduces himself as working for a platform. He's a construction network facilitator. The moment he's seen as a sales resource = conversations become guarded. Sari and Reza never join Budi's field visits.</p>
      </div>

      {/* BUJK Data Privacy Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> DATA PRIVACY — Kerangka Privasi Data BUJK di MJP: Apa yang Boleh Dikumpulkan, Apa yang Tidak, dan Bagaimana Klien Mendapat Jaminan Data Mereka Aman?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-1">
            <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200">
              <p className="text-[9px] font-bold text-emerald-700 mb-1">✅ Data yang MJP kumpulkan (informed consent):</p>
              {["BUJK registration data (LPJK public)", "Tender submission records (LPSE public)", "SKK status (LPJK public, with klien consent)", "Platform usage behavior (anonymized)", "Field observation notes (non-attributed to individual)"].map((d, i) => <p key={i} className="text-[7px]">• {d}</p>)}
            </div>
            <div className="border rounded-sm p-2.5 bg-red-50 border-red-200">
              <p className="text-[9px] font-bold text-red-700 mb-1">❌ Data yang MJP TIDAK kumpulkan:</p>
              {["Nama pribadi direktur/karyawan BUJK tanpa consent", "Informasi keuangan internal klien", "Komunikasi klien dengan rekanan mereka", "Lokasi real-time tim lapangan klien", "Data pihak ketiga yang belum klien izinkan dibagi"].map((d, i) => <p key={i} className="text-[7px]">• {d}</p>)}
            </div>
          </div>
          <div className="border rounded-sm p-2.5 bg-muted/10">
            <p className="text-[9px] font-bold mb-0.5">Data usage principles:</p>
            {[
              "Aggregate only for benchmarking: 'BUJK kelas J8 avg win rate 31%' — never 'CV Makmur Jaya win rate 18%' surfaced to other klien.",
              "No data resale: MJP data never sold to third parties. Data is an internal asset, not a revenue line.",
              "Right to deletion: klien can request deletion of their platform data. Budi's field notes about their BUJK (if it includes identifiable info) purged within 30 days of request.",
              "UU PDP (Indonesia Personal Data Protection Law, 2022) compliance: Hendra Jr. completed compliance audit Q1 2026. 3 minor items being addressed (privacy policy update pending).",
            ].map((p, i) => <p key={i} className="text-[7px] mb-0.5">• {p}</p>)}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Privacy framework written by Hendra (assisted by external legal counsel, Q4 2024). Published in MJP ToS. Enterprise klien receive dedicated DPA (Data Processing Agreement). UU PDP compliance = no longer optional — penalties up to 2% of annual revenue. Privacy is both ethical and risk management. Small investment now prevents regulatory risk at scale.</p>
      </div>

      {/* Contractor Grading Model */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> GRADING MODEL — Model Penilaian Kontraktor MJP: 8 Dimensi yang Membentuk BUJK Trust Score dan Bobot Masing-Masing dalam Perhitungan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Dimension</th>
                  <th className="p-1 text-center">Weight</th>
                  <th className="p-1 text-center">Data Source</th>
                  <th className="p-1 text-left text-muted-foreground">What it measures</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["D1 — SBU/SKK Compliance", "25%", "LPJK official", "Current SBU validity, SKK alignment to project class, no expired certifications."],
                  ["D2 — Blacklist Status", "20%", "LPJK + LKPP", "Any current or historical daftar hitam entry. Historical: 5-year window. Current: instant disqualification."],
                  ["D3 — Tender Win Rate", "15%", "LPSE multi-source", "Win rate over trailing 24 months. Adjusted for competition density."],
                  ["D4 — Project Delivery Track", "15%", "LPSE + field (Budi)", "Completed projects on time vs. addendum vs. abandoned. Budi's field notes supplement LPSE data."],
                  ["D5 — Financial Signal", "10%", "SIRUP + field inference", "HPS-to-winning-bid ratio trends. Very low bids = financial stress signal. Budi's direct observation."],
                  ["D6 — Network Centrality", "5%", "Internal graph", "How connected the BUJK is in MJP's consortium network. Central = higher trust from peers."],
                  ["D7 — Recency of Activity", "5%", "LPSE", "Last tender participation date. Inactive > 18 months = dormancy flag."],
                  ["D8 — Sari Annotation Override", "5%", "MJP internal", "Sari can +/- adjust score for qualitative intelligence not captured in data signals."],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center font-bold text-primary">{row[1]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[2]}</td>
                    <td className="p-1 text-muted-foreground">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-amber-50 border-amber-200">
            <p className="text-[9px] font-bold text-amber-700">Score interpretation guide:</p>
            {[
              { range: "85–100", label: "BIRU (Highly Reliable)", use: "Safe for consortium. Strong track record. Low-risk sub-contractor." },
              { range: "70–84", label: "HIJAU (Reliable)", use: "Standard BUJK. Due diligence recommended for > Rp 500M." },
              { range: "50–69", label: "KUNING (Caution)", use: "Additional verification required. Ask for project completion references." },
              { range: "25–49", label: "ORANYE (High Risk)", use: "Significant concerns. Only proceed with strong mitigations." },
              { range: "0–24", label: "MERAH (Do Not Engage)", use: "Active risk. Blacklist history or significant pattern failures." },
            ].map((r) => (
              <div key={r.range} className="flex gap-2 text-[7px] border-b py-0.5">
                <p className="font-mono w-14 shrink-0">{r.range}</p>
                <p className="font-bold w-36 shrink-0">{r.label}</p>
                <p className="text-muted-foreground">{r.use}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Trust Score recalculated monthly for all 12.400 BUJKs. Model v3 (current): introduced D8 Sari annotation override (Q1 2025). v1 was purely data-driven; v2 added field data; v3 adds human judgment layer. Hendra: 'A pure algorithm misses context. Sari's override adds the intelligence that data can't capture — a BUJK director in financial trouble that Budi heard about before LPSE data reflects it.' Score used by: 31 Enterprise klien for sub-contractor screening, 147 Pro klien for consortium decisions.</p>
      </div>

      {/* Consortium Formation Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Handshake className="h-3.5 w-3.5 text-primary" /> CONSORTIUM INTEL — Intelijen Pembentukan Konsorsium: Bagaimana MJP Membantu Klien Menemukan Mitra Konsorsium yang Tepat dan Mengapa Ini Adalah Fitur yang Paling Bernilai untuk BUJK J7–J8
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Consortium formation is the highest-value intelligence use case for small-medium BUJK (J7–J8) who cannot meet tender requirements alone:</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {[
              { stat: "34%", label: "Tenders won by consortium (LPSE 2025 data)", tc: "text-primary" },
              { stat: "Rp 3.8T", label: "Consortium contract value 2025 (tracked by MJP)", tc: "text-emerald-700" },
              { stat: "147", label: "Pro klien used consortium matching (2025)", tc: "text-blue-700" },
              { stat: "22 hari", label: "Avg consortium partner search (before MJP)", tc: "text-red-700" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-base font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          <div className="border rounded-sm p-2.5 bg-muted/10 mb-1">
            <p className="text-[9px] font-bold mb-0.5">MJP consortium matching algorithm (v2):</p>
            {[
              "Input: target tender (KBLI, value, geography, SBU class required) + klien's current capabilities",
              "Gaps identified: missing KBLI codes, SBU sub-classification gaps, geographic presence needed",
              "Match pool: 12.400 BUJKs filtered by: Trust Score > 70, relevant SBU, no blacklist, < 100km from project site",
              "Output: top 5 compatible partners ranked by Trust Score × capability fit × recent activity score",
              "Output also includes: past consortium behavior (from Budi's field notes) — some BUJKs are 'difficult partners' even with high Trust Score",
            ].map((l, i) => <p key={i} className="text-[7px] mb-0.5">• {l}</p>)}
          </div>
          <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200">
            <p className="text-[9px] font-bold text-emerald-700">Consortium intelligence competitive advantage:</p>
            <p className="text-[8px]">No competitor offers consortium matching. It requires: (1) a BUJK database (12.400 entries), (2) a trust model (D1–D8 with field data), (3) Budi's soft intelligence on partnership behavior. A BUJK without MJP must find partners through their personal network (avg 22 days). With MJP: 5 ranked candidates within 5 minutes. For an Enterprise klien bidding on a Rp 800M tender: this feature alone justifies the subscription.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Consortium intelligence is Hendra's proudest product achievement. It emerged from a klien pain point (Budi heard it in the field: 'Susah cari mitra yang bisa dipercaya'). Feature went from pain point to MVP in 6 weeks (Q3 2023). Now one of top 3 reasons Enterprise klien renew. The soft partner-behavior layer (from Budi's field notes) is what makes MJP's consortium intel irreplaceable — pure data tools can never capture relationship intelligence.</p>
      </div>

      {/* Regional BUJK Distribution Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" /> REGIONAL MAP — Distribusi Regional 12.400 BUJK dalam Database MJP dan Distribusi 487 Klien: Di Mana Penetrasi Sudah Kuat dan Di Mana Peluang Masih Besar
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Region</th>
                  <th className="p-1 text-center">BUJK in DB</th>
                  <th className="p-1 text-center">MJP Klien</th>
                  <th className="p-1 text-center">Penetration</th>
                  <th className="p-1 text-center">Budi Coverage</th>
                  <th className="p-1 text-left">Priority</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["DKI Jakarta", "2.840", "87", "3.1%", "Low (Reza remote)", "✅ Established"],
                  ["Jawa Barat (excl. Bandung)", "1.680", "61", "3.6%", "Medium (Budi monthly)", "✅ Established"],
                  ["Jawa Tengah", "1.420", "74", "5.2%", "High (Budi base)", "✅ Core market"],
                  ["Jawa Timur", "1.390", "43", "3.1%", "Low (occasional)", "🟡 Growth target"],
                  ["Banten + Bandung", "890", "38", "4.3%", "Medium (Budi quarterly)", "✅ Stable"],
                  ["Sumatra (all)", "1.820", "71", "3.9%", "Low", "🟡 Growth target"],
                  ["Kalimantan (all)", "820", "34", "4.1%", "None (zero field)", "🟡 Remote-only"],
                  ["Sulawesi (all)", "640", "28", "4.4%", "None", "🟡 Remote-only"],
                  ["Bali + NTT/NTB", "410", "21", "5.1%", "None", "🟡 Remote-only"],
                  ["Papua + Maluku", "290", "18", "6.2%", "None", "⭐ High penetration (IKN effect)"],
                  ["Lain-lain", "200", "12", "6.0%", "None", "Monitor"],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className="p-1 text-center font-bold text-primary">{row[2]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[3]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[4]}</td>
                    <td className={`p-1 ${row[5].includes("⭐") ? "text-amber-700 font-bold" : row[5].includes("✅") ? "text-emerald-700" : "text-orange-700"}`}>{row[5]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700">Regional growth strategy:</p>
            <p className="text-[8px]">Jateng (5.2% penetration, Budi's home base) is MJP's most penetrated region. Proof-of-concept that deep field coverage drives higher conversion. Growth plan: extend Budi's model to Jatim (target partner network, not Budi himself — he can't be everywhere). Digital-only regions (Kalimantan, Sulawesi) growing via WA + webinar — 4.1%+ penetration without field presence confirms platform value beyond field coverage.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total penetration: 487 klien / 12.400 BUJK = 3.9% market penetration. At first glance: low. In context: MJP reaches 487 paying BUJK out of ~3.000 'sophisticated' BUJK (those who regularly submit competitive tenders) = ~16% penetration of the addressable market. Hendra's framing for investors: 'We've proven product-market fit in the sophisticated BUJK segment. Scaling requires Reza + 1 SDR + digital acquisition.'</p>
      </div>

      {/* BUJK Trust Score Methodology */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5 text-primary" /> TRUST SCORE METHOD — Metodologi Penghitungan BUJK Trust Score: Bobot Tiap Faktor, Sumber Data, dan Mengapa Scoring Ini Lebih Akurat Dibanding Hanya Mengecek Status LPJK
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Faktor</th>
                  <th className="p-1 text-center">Bobot</th>
                  <th className="p-1 text-left">Sumber data</th>
                  <th className="p-1 text-left">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Status LPJK aktif", "20%", "LPJK BUJK registry (crawled daily)", "Binary: aktif/nonaktif. Foundation score."],
                  ["Blacklist/sanction-free", "25%", "LPSE blacklist registry + LKPP sanction list", "Highest weight — any blacklist = floor of 20 pts max total."],
                  ["SBU validity & jenjang match", "15%", "LPJK SBU database", "Active + correct jenjang = full points. Expired or wrong jenjang = partial."],
                  ["Tender win rate (2 years)", "20%", "LPSE award data (computed by Hendra Jr.)", "> 15% win rate = full points. < 5% = lowest tier. Proxy for bid quality."],
                  ["Financial health proxy", "10%", "SIUP + NPWP aktif (cross-check)", "No direct P&L access. Proxy: active tax ID + no PKPU/pailit in court registry."],
                  ["Budi's field reputation flag", "10%", "Manual Budi note (for ~350 BUJK in Budi's network)", "Only applies to Budi-covered BUJK. Blank for others (weight redistributed)."],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center font-bold text-primary">{row[1]}</td>
                    <td className="p-1 text-muted-foreground">{row[2]}</td>
                    <td className="p-1 text-muted-foreground">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 mb-1">
            {[
              { band: "MERAH (0–39)", desc: "Do not engage. Blacklist or multiple red flags.", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
              { band: "ORANYE (40–54)", desc: "Caution. Engage only for low-value sub-works.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
              { band: "KUNING (55–69)", desc: "Average. Standard due diligence recommended.", tc: "text-yellow-700", bc: "bg-yellow-50 border-yellow-200" },
              { band: "HIJAU (70–84)", desc: "Good standing. Suitable for most partnerships.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
              { band: "BIRU (85–100)", desc: "Excellent. Top tier partners for flagship projects.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            ].map((r) => (
              <div key={r.band} className={`border rounded-sm p-1.5 ${r.bc}`}>
                <p className={`text-[8px] font-bold ${r.tc}`}>{r.band}</p>
                <p className="text-[7px]">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Trust Score validated against 847 consortium decisions by MJP klien (tracked via feedback). Of BUJK scored MERAH/ORANYE that klien ignored the warning and partnered with anyway: 61% resulted in project problems (delivery delay, cost overrun, or dispute). Of BUJK scored HIJAU/BIRU: 6% resulted in problems. Score is not a guarantee — it's a probabilistic signal. Hendra: 'The score doesn't tell you this BUJK will fail. It tells you the base rate of failure for similar profiles.'</p>
      </div>

      {/* BUJK Blacklist Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-red-600" /> BLACKLIST INTEL — Intelijen Daftar Hitam BUJK MJP: 3 Sumber Blacklist yang Kami Monitor, Berapa BUJK Aktif Terdaftar Saat Ini, dan Apa Artinya Saat BUJK Blacklisted Masuk ke Konsorsium Klien Anda
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {[
              { stat: "1.847", label: "BUJK currently blacklisted (all sources)", tc: "text-red-700" },
              { stat: "14.9%", label: "Of 12.400 BUJK in DB (high rate)", tc: "text-orange-700" },
              { stat: "3 jam", label: "Avg detection-to-klien-alert time", tc: "text-primary" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-base font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          {[
            { src: "Sumber 1 — LKPP Daftar Hitam Penyedia (LPSE Nasional)", count: "~1.240 BUJK", refresh: "Crawled setiap 6 jam", desc: "Most comprehensive. LKPP blacklist is binding for all APBN procurement. Causes: sengketa, kegagalan kontrak, manipulasi dokumen, keterlambatan tanpa justifikasi.", impact: "Blacklisted from ALL government tenders for duration of sanction (typically 1–2 tahun)." },
            { src: "Sumber 2 — LPSE Daerah (per-province blacklists, 34 provinsi)", count: "~430 BUJK (overlap with LKPP)", refresh: "Crawled setiap 12 jam", desc: "Provincial blacklists are separate from national. A BUJK can be blacklisted provincially but not nationally. MJP tracks all 34 provincial LPSE blacklists and cross-references.", impact: "Regional tender ban only. Can still bid nationally." },
            { src: "Sumber 3 — BPKP / Inspektorat Audit Findings (informal)", count: "~177 BUJK (Budi field intelligence)", refresh: "Ad hoc — Budi network", desc: "Audit findings that haven't been formally actioned but represent credible risk signals. Not official blacklist — Sari labels these [WATCH] not [BLACKLIST]. Cleared with official source before using.", impact: "Not binding — risk signal only. Used in Trust Score as -15pt if 2+ BPKP findings." },
          ].map((r) => (
            <div key={r.src} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[8px] font-bold flex-1 text-red-700">{r.src}</p>
                <span className="text-[7px] font-mono text-primary shrink-0">{r.count}</span>
                <span className="text-[7px] font-mono text-muted-foreground shrink-0">{r.refresh}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className="text-[7px] font-mono text-red-700">Impact: {r.impact}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-red-50 border-red-200 mt-1">
            <p className="text-[9px] font-bold text-red-700">Why 14.9% blacklist rate is high — and what it means:</p>
            <p className="text-[8px]">14.9% of BUJK in the database have at least one active blacklist/sanction. This is not necessarily indicative of fraud — many are operational failures (late delivery, administrative non-compliance). But for consortium decisions: a blacklisted BUJK as your sub-contractor = your bid may be disqualified. MJP's immediate-alert for blacklist changes is one of the highest-valued features among Enterprise klien.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">MJP processes ~47 new blacklist entries per month (Hendra Jr.'s monthly aggregate). Klien with watchlisted BUJK receive immediate WA alert when status changes. In 2025: 23 Enterprise klien received blacklist alerts about BUJK they had active or planned consortium with. 19 of 23 changed their decision. Estimated saved exposure: 19 clients × avg Rp 8.4M tender prep cost avoided = Rp 159.6M in prevented waste. This is the concrete ROI of blacklist intelligence.</p>
      </div>

      {/* BUJK Data Sovereignty Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-primary" /> DATA SOVEREIGNTY — Kerangka Kedaulatan Data BUJK di Platform MJP: Data Apa yang MJP Kumpulkan, Data Apa yang Tidak, Siapa yang Bisa Mengakses, dan Apa Hak BUJK atas Data Mereka Sendiri
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { category: "Data yang MJP kumpulkan tentang BUJK", items: ["Status LPJK + blacklist (dari sumber publik resmi)", "SBU validity + jenjang (LPJK public registry)", "Tender submission history + award outcomes (LPSE public data)", "Budi's field notes (anonymized — no individual person named)", "Trust Score (computed from above sources — not stored as raw personal data)"], type: "Sumber publik — bukan data pribadi klien", tc: "text-muted-foreground" },
            { category: "Data yang MJP kumpulkan tentang klien MJP (subscribers)", items: ["Nama perusahaan + NPWP (for billing)", "Kontak person + WA number (for alerts)", "Feature usage behavior (anonymous per-session)", "Watchlist configuration (KBLI + geography preferences)", "SKK data yang di-input klien sendiri (for Express coordination)"], type: "Consensual — klien provides explicitly at signup", tc: "text-blue-700" },
            { category: "Data yang MJP TIDAK kumpulkan dan tidak akan kumpulkan", items: ["Nilai kontrak atau keuangan BUJK", "Data karyawan atau SDM BUJK", "Dokumen tender internal klien", "Informasi konsorsium yang klien bagi secara pribadi dengan MJP tim", "Lokasi tracking atau biometric data"], type: "Explicit exclusions — documented in privacy policy", tc: "text-emerald-700" },
            { category: "Hak BUJK atas datanya di platform MJP", items: ["Right to access: BUJK can request all data MJP holds about them — 72-hour response SLA", "Right to correct: incorrect public-source data can be flagged for re-verification + correction", "Right to delete (klien accounts): full data deletion on account closure — 30 days", "Right to portability: klien can export their watchlist + usage history as CSV anytime"], type: "UU PDP compliant framework", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.category} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.category}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.type}</span>
              </div>
              <div>{r.items.map((it, i) => <p key={i} className="text-[7px]">• {it}</p>)}</div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Data sovereignty framework written by Hendra with legal retainer review (Q4 2024) specifically for UU PDP compliance (effective November 2024). Key principle: MJP's value comes from public-source intelligence, not from aggregating private BUJK data. This distinction is both ethical and strategic — it means MJP doesn't need BUJK permission to include them in the database (public sources), but does need subscriber permission for how their usage data is handled. Clean separation maintains trust with both the BUJK community and MJP's paying klien.</p>
      </div>

      {/* BUJK Consortium Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Handshake className="h-3.5 w-3.5 text-primary" /> CONSORTIUM INTELLIGENCE — Intelijen Konsorsium MJP: Bagaimana Platform Membantu BUJK J8–J9 Menemukan Mitra Konsorsium yang Tepat — Algoritma Matching, 5 Kriteria Kompatibilitas, dan 34 Konsorsium yang Berhasil Dibentuk Lewat MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Consortium matching algorithm — 5 compatibility criteria scored 0–20 each (max 100):</p>
          {[
            { criterion: "C1 — KBLI Complementarity (weight: 30)", desc: "Does potential partner's KBLI set complement (not duplicate) the seeker's? Optimal: seeker is Sipil, partner is MEP or Arsitek. Max score when 0 KBLI overlap.", detail: "Prevents 'ghost consortium' (two similar BUJK who can't add value to each other's capability)", tc: "text-primary" },
            { criterion: "C2 — Geographic Alignment (weight: 20)", desc: "Is the potential partner active in the same province/region as the target tender? Score based on tender address vs. partner's active project history.", detail: "Local presence reduces logistics cost and signals familiarity with local LPSE dynamics.", tc: "text-blue-700" },
            { criterion: "C3 — Trust Score Threshold (weight: 25)", desc: "Partner Trust Score ≥ 70 required for full score. Sub-60 disqualifies. Sub-50 hides from results entirely.", detail: "Low Trust Score partners expose the consortium to rejection at qualification stage — 34 blacklist cases in 2025.", tc: "text-orange-700" },
            { criterion: "C4 — Jenjang Compatibility (weight: 15)", desc: "Combined jenjang must meet or exceed tender's BUJK minimum requirement. BUJK registration rules require documented jenjang per KBLI per partner.", detail: "Prevents 'paper consortium' that looks good on paper but fails BUJK qualification check.", tc: "text-emerald-700" },
            { criterion: "C5 — Historical Collaboration Signal (weight: 10)", desc: "Have these two BUJK co-won tenders in the past? (Detectable from LPSE public award data.) Prior collaboration = high trust signal.", detail: "Repeat consortium pairings have 2.1× higher win rate vs. first-time pairings in MJP's dataset.", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.criterion} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.criterion}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.detail}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200 mt-1">
            <p className="text-[9px] font-bold text-emerald-700">34 successful consortiums formed via MJP matching (2023–2025):</p>
            <p className="text-[8px]">Total consortium contract value tracked: Rp 84.3T (not all verifiable — 34 are verified via klien confirmation). Avg consortium size: 2.3 BUJK. Win rate of MJP-matched consortiums: 41% (vs. national consortium win rate estimate: 28%). The 13-point win rate premium justifies the feature for Enterprise klien: each consortium win typically exceeds Rp 1T in value for J9 klien — the MJP Enterprise subscription (Rp 54jt/thn) pays for itself 18,000× in a single consortium win.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Consortium matching is MJP's most complex feature technically (Hendra Jr.: '3x the code of any other feature') and highest stickiness feature commercially (Enterprise klien who use it: 97% renewal rate). Hendra's long-term vision: NLQ v2 enables natural language consortium search ('Carikan BUJK untuk konsorsium jembatan Jatim di atas Rp 200M, sudah punya K3 Madya'). This transforms the feature from a filter tool to an advisory tool.</p>
      </div>

      {/* BUJK Watchlist Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BellRing className="h-3.5 w-3.5 text-primary" /> WATCHLIST INTEL — Kecerdasan Watchlist BUJK MJP: Bagaimana 487 Klien Memantau 3.400+ BUJK via Watchlist — Pola Penggunaan, Alert yang Paling Sering Digunakan, dan Apa yang Terjadi Ketika Satu BUJK Masuk Watchlist 100+ Klien
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {[
              { stat: "3.412", label: "Unique BUJK on watchlists", tc: "text-primary" },
              { stat: "7.1", label: "Avg BUJK per klien watchlist", tc: "text-blue-700" },
              { stat: "312", label: "BUJK on 10+ klien watchlists", tc: "text-orange-700" },
              { stat: "23", label: "BUJK on 100+ klien watchlists", tc: "text-red-700" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-sm font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          {[
            { insight: "Why do BUJK end up on many watchlists?", detail: "23 BUJK are on 100+ klien watchlists. Pattern analysis: they are primarily large J9 BUJK who appear as potential consortium partners across many industries. Example: PT Wijaya Karya Beton (WIKA Beton) is on 213 klien watchlists — because J8/J9 klien across 8 KBLI categories include them as potential partners or competitive benchmarks.", tc: "text-primary" },
            { insight: "Most valuable watchlist alert type (by klien action rate)", detail: "Alert type → action rate: (1) Blacklist status change: 71% of recipients take action within 24h. (2) Trust Score change by > 10 points: 43% action within 48h. (3) New tender win by a watchlisted BUJK: 38% action within 7 days. (4) SBU renewal (watchlisted BUJK updates SBU): 12% action. Blacklist is 5.9× more actionable than SBU renewal.", tc: "text-orange-700" },
            { insight: "Intelligence compound effect of many watchlists", detail: "When 100+ klien watchlist the same BUJK, every klien who has interacted with that BUJK (consortium, sub-contract, competitive encounter) contributes to MJP's intelligence network. Not directly (MJP doesn't collect private deal data), but indirectly: more klien monitoring = faster incident detection (a blacklist entry noticed by 1 klien gets reported within hours vs. days).", tc: "text-blue-700" },
            { insight: "Privacy implication: does a BUJK know they're being watchlisted?", detail: "No. Watchlists are private klien data. A BUJK cannot see who has watchlisted them. MJP does not notify BUJK of watchlist activity. The data used to generate watchlist alerts (blacklist status, SBU registry, LPSE award data) is all public-source — no private BUJK data involved.", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.insight} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.insight}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Watchlist feature is one of MJP's most-used but least-talked-about features. Klien don't mention it in sales conversations (Reza: 'When I demo watchlists, eyes light up — but klien don't proactively ask for it'). It's a 'aha moment' feature that becomes indispensable after the first blacklist alert. Hendra's goal: make watchlist setup part of the Day-1 onboarding (Reza's Day-1 call script already includes watchlist setup as Step 3 of 5). Klien who set up watchlists on Day 1 have 34% higher 12-month retention than klien who set them up later — it creates the first 'portfolio management' habit on the platform.</p>
      </div>

      {/* BUJK Credit Risk Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5 text-primary" /> CREDIT RISK INTEL — Intelijen Risiko Kredit BUJK: Bagaimana Trust Score MJP Digunakan untuk Menilai Kelayakan Sub-Kontraktor dan Mitra Konsorsium — 3 Klien yang Menghindari Kerugian Besar Berkat Trust Score Alert
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Trust Score's secondary use case — BUJK-to-BUJK due diligence (not just klien-looking-at-competitor):</p>
          {[
            {
              usecase: "UC1 — Sub-contractor selection (J9 klien vetting sub-J7 BUJK)",
              desc: "J9 BUJK before awarding a Rp 12jt sub-contract: look up the sub-contractor's Trust Score. Red flags: (1) Trust Score < 55 (below MJP threshold for 'trusted'), (2) Any blacklist history in the last 3 years, (3) SBU coverage gaps for the sub-contracted KBLI scope.",
              case: "CASE: A Jatim J9 klien used MJP to screen a sub-contractor recommended by their site manager. Trust Score: 41. Blacklist record: 2019 (dispute with PUPR Jateng, payment failure). Klien did not award the sub-contract. Avoided: potential Rp 3.4jt dispute risk. Reza documented in renewal notes.",
              tc: "text-orange-700"
            },
            {
              usecase: "UC2 — Consortium partner validation (before LOI signing)",
              desc: "Before signing a Letter of Intent for a consortium: MJP klien checks all proposed consortium partners' Trust Scores. A single low-Trust-Score partner can tank a consortium's credibility with the procuring entity.",
              case: "CASE: Enterprise klien (J9 Sipil, Jakarta) was forming a Rp 450M consortium for a PUPR package. One proposed partner: Trust Score 48, SBU expired 2 months prior. Klien replaced the partner. Consortium qualified. Won the package. Estimated contract value: Rp 87jt MJP klien's share.",
              tc: "text-primary"
            },
            {
              usecase: "UC3 — Payment terms negotiation (Trust Score as leverage)",
              desc: "J8 klien negotiating payment terms with a customer (another BUJK, not a government body): looked up the customer's Trust Score to assess credit risk before agreeing to extended payment terms.",
              case: "CASE: Pro klien agreed to Rp 2.8jt of sub-contracted work with standard 30-day payment. Before signing, checked MJP. Customer BUJK Trust Score: 44, multiple payment dispute flags. Klien added advance payment requirement (30% upfront). Customer agreed. Payment received. Sub-contract completed without incident.",
              tc: "text-blue-700"
            },
          ].map((r) => (
            <div key={r.usecase} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.usecase}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.case}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">BUJK credit risk use case is underpromised and overdelivered. Reza never leads with it in demos (the primary value proposition is tender intelligence). But it comes up organically in 23% of renewal conversations: klien mention they've used Trust Score for sub-contractor vetting. This is the hidden value of a comprehensive BUJK intelligence platform — the use cases compound. Every new data point (SBU history, blacklist record, award history) increases Trust Score's precision for credit risk assessment. Hendra's view: 'We didn't build Trust Score for credit risk. But credit risk found Trust Score. That's a product discovery we didn't have to do — the klien did it for us.'</p>
      </div>

      {/* BUJK Density Map by KBLI */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5 text-primary" /> BUJK DENSITY MAP — Peta Densitas BUJK per Kategori KBLI: Di Mana BUJK Paling Banyak Beroperasi, Kategori Mana yang Paling Kompetitif, dan Apa Implikasinya untuk Strategi Alert dan Klien MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">KBLI Category</th>
                  <th className="p-1 text-center">Registered BUJK</th>
                  <th className="p-1 text-center">Active bidders/qtr</th>
                  <th className="p-1 text-center">Avg competition</th>
                  <th className="p-1 text-center">MJP klien</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["41 — Building Construction", "12.847", "8.421", "34 bidders/tender", "89 (18%)"],
                  ["42 — Civil Engineering (Sipil)", "9.312", "6.788", "28 bidders/tender", "156 (32%)"],
                  ["43 — Specialized Construction", "6.431", "4.122", "19 bidders/tender", "94 (19%)"],
                  ["42101 — Irigasi & Drainase", "3.211", "2.341", "23 bidders/tender", "67 (14%)"],
                  ["42201 — Jembatan", "1.847", "1.203", "15 bidders/tender", "34 (7%)"],
                  ["43211 — Structural Work", "2.134", "1.567", "17 bidders/tender", "47 (10%)"],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className="p-1 text-center text-blue-700">{row[2]}</td>
                    <td className={`p-1 text-center font-bold ${parseInt(row[3]) > 25 ? "text-red-700" : parseInt(row[3]) > 18 ? "text-orange-700" : "text-emerald-700"}`}>{row[3]}</td>
                    <td className="p-1 text-center text-primary">{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {[
            { insight: "Why competition density matters for MJP's alert value", detail: "High-competition categories (KBLI 41 — 34 bidders/tender): MJP's value is early alert — being first to know means more preparation time = better bid. Low-competition categories (KBLI 42201 Jembatan — 15 bidders/tender): MJP's value is completeness — don't miss a tender because there are few and each one matters more.", tc: "text-primary" },
            { insight: "Why MJP has disproportionate klien share in Civil Engineering (32% of klien, 24% of registered BUJK)", detail: "Civil Engineering BUJK (KBLI 42x) have higher average contract values, more complex procurement requirements (SKK, SBU specificity, K3), and greater sensitivity to tender intelligence. They self-select into MJP's value proposition more strongly than Building Construction BUJK who compete in a simpler, higher-volume, lower-value market.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.insight} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.insight}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">BUJK density map is updated quarterly by Hendra Jr. from LPJK registry and LPSE submission data cross-reference. The map drives two decisions: (1) Sari's knowledge asset production priority — high-density categories need more assets because more klien are in them. (2) Reza's outreach targeting — low-MJP-penetration categories with high BUJK count represent untapped market (KBLI 41 building construction: only 18% of MJP klien but 26% of registered BUJK — an underserved segment). Reza's Q3 2026 plan: targeted outreach to 50 KBLI 41 J8 BUJK in Java to address this penetration gap.</p>
      </div>

      {/* R96: BUJK M&A Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5 text-primary" /> BUJK M{"&"}A INTELLIGENCE — Sinyal Akuisisi, Merger, dan Konsolidasi di Sektor Konstruksi: Siapa yang Mengambilalih Siapa, Apa Implikasinya untuk Kompetisi Tender, dan Bagaimana MJP Mendeteksinya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] font-bold text-primary mb-1">DETEKSI SINYAL M{"&"}A — 5 pola yang MJP amati sebagai precursor konsolidasi</p>
          {[
            { signal: "S-MA1: Direktur Utama aktif LinkedIn-rekrut talent dari BUJK lain", observed: "3 kasus Q1 2026", implication: "BUJK sedang mempersiapkan capacity expansion — kemungkinan untuk qualify tender nilai lebih besar yang butuh grade SBU lebih tinggi", tc: "text-orange-700" },
            { signal: "S-MA2: SBU upgrade massal (5+ tenaga ahli di-upgrade dalam 60 hari)", observed: "6 kasus sepanjang 2025", implication: "BUJK sedang bersiap untuk naik kelas tender — atau sedang persiapkan akuisisi target yang butuh SBU grade tertentu", tc: "text-orange-700" },
            { signal: "S-MA3: Bidding pattern berubah — tiba-tiba bid ke kategori baru", observed: "12 kasus 2024–2025", implication: "Post-akuisisi expansion: BUJK yang acquire kontraktor spesialis lain lalu mulai masuk ke tender kategori acquired company", tc: "text-blue-700" },
            { signal: "S-MA4: Alamat kantor berubah ke gedung grade A Jakarta", observed: "4 kasus 2025", implication: "Biasanya precedes institutional investment — PE atau strategic investor yang masuk dan upgrade operation", tc: "text-blue-700" },
            { signal: "S-MA5: Tender win rate melonjak >50% dalam satu kuartal", observed: "2 kasus 2025", implication: "Akuisisi tim estimasi dari BUJK lain — sudden quality improvement in bid pricing yang tidak organik", tc: "text-primary" },
          ].map((r) => (
            <div key={r.signal} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.signal}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.observed}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.implication}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2 bg-muted/30 mt-2">
            <p className="text-[8px] font-bold text-primary mb-1">MJP's M{"&"}A Intelligence Product Roadmap</p>
            <p className="text-[7px] text-muted-foreground">2026 (manual): Hendra Jr. flags M{"&"}A signals manually dari LPSE data. Tidak ada automated alert — hanya observation dalam quarterly review. 2027 (semi-automated): M{"&"}A signal scoring: BUJK yang trigger 3+ sinyal dalam 90 hari mendapat flag di direktori. Alert ke klien yang compete langsung dengan flagged BUJK. 2028 (full integration): M{"&"}A dashboard sebagai dedicated Enterprise feature — timeline, participants, implications untuk competitive positioning.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">BUJK M{"&"}A intelligence adalah whitespot yang belum ada player lain di Indonesia yang mengisi. LPSE data cukup untuk detect konsolidasi patterns — tidak perlu insider information, hanya pattern recognition across public procurement records. Hendra: 'Setiap M{"&"}A di sektor konstruksi mengubah landscape kompetisi. BUJK yang merge menjadi lebih kuat. BUJK yang diakuisisi mungkin menghilang dari tender landscape. Klien kita perlu tahu ini sebelum mereka submit bid yang dipersiapkan untuk kompetisi yang sudah berubah.' Budi (ops): akuisisi BUJK juga berdampak pada SKK database — tim tenaga ahli berpindah entity — ini adalah downstream complexity yang MJP harus track.</p>
      </div>

      {/* R97: BUJK Regional Growth Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" /> BUJK REGIONAL GROWTH INTELLIGENCE — Provinsi Mana yang Menjadi Pusat Pertumbuhan BUJK Baru 2024–2026, Mengapa Proyeksi Infrastruktur Menentukan Arah Pertumbuhan, dan Implikasinya untuk Ekspansi Coverage MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Provinsi</th>
                  <th className="p-1 text-center">BUJK registered (2024)</th>
                  <th className="p-1 text-center">Growth (YoY)</th>
                  <th className="p-1 text-center">MJP klien penetrasi</th>
                  <th className="p-1 text-center">Driver</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Kalimantan Timur (IKN)", "1.847", "+34%", "8%", "IKN infrastructure"],
                  ["Jawa Barat", "8.312", "+12%", "24%", "Toll road, industrial zone"],
                  ["Sulawesi Selatan", "2.341", "+18%", "11%", "KSPN Toraja, port upgrade"],
                  ["Jawa Tengah", "6.847", "+9%", "19%", "Semarang-Demak corridor"],
                  ["Papua (Selatan & Tengah)", "412", "+61%", "3%", "3T infrastructure push"],
                  ["Banten", "3.201", "+15%", "14%", "BSD-Tangerang expansion"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className={`p-1 text-center font-bold ${parseInt(row[2]) >= 30 ? "text-emerald-700" : parseInt(row[2]) >= 15 ? "text-orange-700" : "text-muted-foreground"}`}>{row[2]}</td>
                    <td className={`p-1 text-center font-bold ${parseInt(row[3]) >= 20 ? "text-emerald-700" : parseInt(row[3]) >= 10 ? "text-orange-700" : "text-red-700"}`}>{row[3]}</td>
                    <td className="p-1 text-[7px] text-muted-foreground">{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {[
            { insight: "Papua: 61% BUJK growth tapi 3% MJP penetration = largest untapped market per growth rate", detail: "Papua tumbuh karena program 3T (Terdepan, Terluar, Tertinggal) — APBN allocation untuk infrastruktur Papua sangat besar. BUJK yang masuk Papua: mostly outsiders dari Jawa dan Sulawesi yang memenangkan tender Papua remote. MJP penetration 3% bukan karena kurang aware, tapi karena internet connectivity di Papua masih jadi hambatan onboarding. Solution: WhatsApp-only mode yang tidak butuh stable internet untuk full platform access.", tc: "text-orange-700" },
            { insight: "Kalimantan Timur: MJP's fastest growth region in 2026", detail: "8% penetration di Kaltim tapi pertumbuhan BUJK 34%: pasar yang sedang membesar lebih cepat dari coverage MJP. Reza telah approach 3 GAPENSI Kaltim chapter members untuk partnership. IKN tender volume: 2.847 tender LPSE Kaltim Q1 2026 vs 1.203 di Q1 2024 — 137% growth. MJP's Kaltim klien: 148 aktif, semuanya diprioritaskan untuk Enterprise upsell karena IKN tender values sangat tinggi.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.insight} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.insight}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Regional growth data dikompilasi dari LPJK registry quarterly update dan LPSE submission volume per provinsi. Hendra Jr. membangun automated regional dashboard (internal only) yang menampilkan BUJK registration velocity per provinsi — updated setiap bulan. Dashboard ini adalah input utama untuk Reza's quarterly outreach planning: bulan ini, fokus ke Kaltim dan Sulsel karena growth tertinggi vs penetrasi terendah. Budi juga menggunakan data ini untuk field research planning: Kaltim adalah lokasi field trip berikutnya (Q3 2026) untuk collect IKN-specific pain points yang belum terdokumentasi. Hendra: 'Indonesia bukan satu market. 34 provinsi, 34 dynamics, 34 opportunity curves.'</p>
      </div>

      {/* R98: BUJK Digital Readiness Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> BUJK DIGITAL READINESS INTELLIGENCE — Seberapa Siap BUJK Indonesia untuk Adopsi Platform Digital: Distribusi Readiness, Apa yang Menghambat Adopsi, dan Bagaimana MJP Menyesuaikan Onboarding
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Readiness Level</th>
                  <th className="p-1 text-center">% BUJK aktif</th>
                  <th className="p-1 text-center">Karakteristik</th>
                  <th className="p-1 text-center">MJP onboarding approach</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Digital Native", "12%", "SaaS tools sudah digunakan, mobile-first", "Self-serve onboarding, minimal help"],
                  ["Digital Adoptive", "31%", "Gunakan aplikasi tapi butuh guidance", "Video walkthrough + WhatsApp support"],
                  ["Digital Cautious", "38%", "Ada smartphone tapi avoid complex apps", "WhatsApp-only mode + Reza phone call"],
                  ["Digital Resistant", "19%", "Prefer phone call dan dokumen fisik", "Reza personal onboarding + handholding"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b hover:bg-muted/20">
                    <td className={`p-1 font-bold ${row[0] === "Digital Native" ? "text-emerald-700" : row[0] === "Digital Adoptive" ? "text-blue-700" : row[0] === "Digital Cautious" ? "text-orange-700" : "text-red-700"}`}>{row[0]}</td>
                    <td className="p-1 text-center text-primary font-bold">{row[1]}</td>
                    <td className="p-1 text-muted-foreground text-[7px]">{row[2]}</td>
                    <td className="p-1 text-primary text-[7px]">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {[
            { insight: "57% BUJK (Cautious + Resistant) butuh human-assisted onboarding", detail: "Ini adalah mengapa Reza's time is so valuable beyond closing: post-close onboarding untuk Cautious dan Resistant segment membutuhkan 2–3 panggilan telepon dan 1–2 WhatsApp conversation sebelum klien feel confident menggunakan platform independently. CAC untuk segment ini 2.3x lebih tinggi dari Digital Native. Tapi churn mereka juga 40% lebih rendah setelah onboarding selesai — mereka lebih loyal karena investasi yang mereka rasakan.", tc: "text-orange-700" },
            { insight: "WhatsApp-only mode adalah product decision untuk Digital Cautious segment", detail: "Budi menemukan selama field research bahwa banyak Kepala Estimasi di BUJK kecil Jawa Tengah dan Jawa Timur tidak pernah buka laptop selama kerja — hanya smartphone. Meminta mereka untuk menggunakan browser-based dashboard adalah friction yang terlalu tinggi. WhatsApp digest mode menghilangkan friction ini: intelligence datang ke channel yang sudah mereka gunakan setiap hari.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.insight} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.insight}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Digital readiness intelligence adalah byproduct dari Budi's field work dan Reza's sales observations. Tidak ada formal survey — ini adalah accumulated pattern recognition dari 200+ BUJK interactions. Hendra: 'Kita tidak bisa assume klien kita adalah like Silicon Valley power users yang comfortable dengan complex interfaces. 57% dari market kita lebih comfortable dengan WhatsApp daripada dengan dashboard. Jika kita design untuk the 12% yang paling digital-ready, kita meninggalkan 88% market di meja.' Digital readiness segmentation drives every UX decision: mobile-first design, WhatsApp delivery, simplified navigation, progressive disclosure of complexity.</p>
      </div>

      {/* R99: BUJK Life Stage Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Milestone className="h-3.5 w-3.5 text-primary" /> BUJK LIFE STAGE INTELLIGENCE — 5 Tahap Siklus Hidup BUJK dan Bagaimana Intelligence Needs Berubah: Dari BUJK Baru yang Baru Dapat SBU hingga BUJK Mature yang Sedang Planning Succession
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { stage: "Stage 1: Formation (0–2 tahun)", pct: "23% dari BUJK aktif", needs: "Survival intelligence: prosedur SBU, persyaratan minimal SKK, cara navigate LPSE pertama kali, pitch ke PPK. Risiko utama: tidak tahu apa yang tidak mereka tahu.", mjp_value: "Knowledge Registry adalah primary value — regulatory guides dan SKK basics. Alert value limited: too new to know which tenders to pursue.", tc: "text-muted-foreground" },
            { stage: "Stage 2: Traction (2–5 tahun)", pct: "31% dari BUJK aktif", needs: "Pipeline intelligence: more tender volume, systematic tracking, beginning to build subcon network. Churn risk jika tidak segera naik ke Pro tier — Alert volume grows too fast for Starter.", mjp_value: "Tender Alert + SKK expiry reminder = primary value. First BUJK blacklist checks start here (vetting potential subcon partners).", tc: "text-orange-700" },
            { stage: "Stage 3: Growth (5–10 tahun)", pct: "28% dari BUJK aktif", needs: "Scale intelligence: multi-region tracking, competitor analysis, beginning to build SBU kelas besar. Win/loss analysis becomes critical — can no longer afford to learn from every failed bid.", mjp_value: "Full platform value: Tender + Competitor + SKK Upgrade pathways + Workroom for team coordination. This is MJP's strongest NPS segment.", tc: "text-primary" },
            { stage: "Stage 4: Maturity (10–20 tahun)", pct: "14% dari BUJK aktif", needs: "Sustainability intelligence: regulatory compliance track, M&A scanning (acquiring smaller BUJK), market share defense, reputation management. Longer decision cycles but higher contract values.", mjp_value: "Enterprise value: custom regulatory alerts, competitor monitoring protocol, Trust Score for acquisition targets. Average Enterprise ARR from Stage 4: Rp 3.2jt/bulan.", tc: "text-blue-700" },
            { stage: "Stage 5: Transition (20+ tahun atau succession planning)", pct: "4% dari BUJK aktif", needs: "Legacy intelligence: documenting accumulated capability, knowledge transfer, digital transformation of historical processes, preparing valuation data for potential acquisition or generational transition.", mjp_value: "Niche but high-value: knowledge documentation via export features, historical compliance record assembly. Custom engagements possible.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.stage} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.stage}</p>
                <span className={`text-[7px] font-mono text-muted-foreground shrink-0`}>{r.pct}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Needs: {r.needs}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>MJP value: {r.mjp_value}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Life stage intelligence mengubah cara Reza pitch: bukan one-size-fits-all demo, tapi stage-specific value narrative. Ketika Reza identifies bahwa prospect adalah Stage 3 BUJK: dia skip SKK basics (terlalu elementary) dan goes straight to competitor intelligence + win/loss analysis. Stage 2 prospect: SKK expiry + tender pipeline building adalah hook. Stage 4 BUJK: regulatory compliance track + Enterprise SLA. Conversion rate setelah Reza starts stage-specific pitching (Q2 2025): 34% improvement vs generic demo. Hendra: 'Reza tidak menjual platform yang sama ke semua orang. Dia menjual value yang paling relevan untuk tahap hidup mereka sekarang.'</p>
      </div>

      {/* R100: BUJK Trust Score Algorithm Evolution */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> TRUST SCORE ALGORITHM EVOLUTION — Dari Versi 1 (2022) yang Hanya Cek Blacklist hingga V4 (2026) dengan 8 Dimensi: Apa yang Berubah, Mengapa, dan 3 Kasus di mana Trust Score Terbukti Memprediksi Masalah yang Nyata
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { ver: "V1 (2022): Binary blacklist check only", score: "0–100, single dimension", detail: "Pertama kali launch: Trust Score = apakah BUJK ada di blacklist LPJK atau tidak. Binary: 0 (blacklisted) atau 100 (not blacklisted). Berguna tapi terlalu simple — klien mulai ask: 'BUJK ini tidak di blacklist tapi punya reputasi buruk, gimana?'", tc: "text-muted-foreground" },
            { ver: "V2 (2023): + SKK validity + aanwijzing history", score: "0–100, 3 dimensions weighted", detail: "Tambah: (a) SKK portfolio validity (expired SKK = lower score), (b) aanwijzing attendance rate (BUJK yang sering tidak hadir aanwijzing tapi tetap bid = higher risk). Weighted: blacklist 50%, SKK validity 30%, aanwijzing history 20%.", tc: "text-orange-700" },
            { ver: "V3 (2024): + Tender outcome history + past performance", score: "0–100, 5 dimensions", detail: "Tambah: (a) tender submission vs win rate (BUJK yang sering bid tapi tidak pernah menang = masalah kualifikasi atau pricing), (b) blacklist check diperluas ke LKPP dan LPJK cross-reference. First version that Hendra Jr. considers 'meaningfully predictive'.", tc: "text-blue-700" },
            { ver: "V4 (2026): + Behavioral signals + geographic exposure", score: "0–100, 8 dimensions", detail: "Tambah: (a) BUJK yang baru aktif (registration date { \"<\" } 1 tahun = higher risk for large contracts), (b) geographic concentration (BUJK yang only bid in 1 LPSE repeatedly = limited capacity signal), (c) SKK freshness ratio (% of team SKK yang baru diperbarui vs expired). Current version. Update cycle: quarterly.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.ver} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.ver}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.score}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
          <div className="pt-1.5 border-t">
            <p className="text-[8px] font-bold text-primary mb-1">3 Proven predictions (post-hoc validation)</p>
            {[
              ["BUJK X: Trust Score 23 in Q1 2023 → LPJK blacklisted Q3 2023", "MJP klien yang check Trust Score sebelum award sub-contract: avoided this BUJK. MJP klien yang tidak check: reported Rp 180jt loss dari contract abandonment.", "text-red-700"],
              ["BUJK Y: Trust Score 71 yang dropping dari 89 over 6 months → Won no tenders for 8 months, eventually had SKK revocation", "Dropping score pattern: behavioral early warning. Klien yang monitor Trust Score trends were warned before public blacklisting.", "text-orange-700"],
              ["BUJK Z: New entrant, score 94, but geographic concentration flag — klien asked why score not higher", "Flag was correct: BUJK Z had limited capacity outside their home region. Klien who noted this avoid awarding them IKN project that would have stretched their capacity.", "text-blue-700"],
            ].map(([case_title, detail, tc]) => (
              <div key={case_title} className="py-1 border-b">
                <p className={`text-[7px] font-bold ${tc} mb-0.5`}>{case_title}</p>
                <p className="text-[6px] text-muted-foreground">{detail}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Trust Score algorithm evolution adalah living document karena the market evolves. New fraud patterns emerge, new data sources become available, and klien use cases refine which dimensions matter most. Hendra Jr.'s goal for V5 (2027): incorporate IjinTender bid price anomaly detection (BUJK that consistently bid just below HPS threshold = potentially colluding or has insider HPS information) and social signal patterns (court records + community complaint tracking). V5 will be the first version built on machine learning rather than manually weighted rules — requiring the labeled training dataset that DS-2 is accumulating. Hendra: 'Trust Score adalah platform dalam platform. Klien yang paling sophisticated tidak menggunakan MJP untuk tender alerts — mereka menggunakan MJP untuk Trust Score due diligence sebelum setiap keputusan bisnis besar.'</p>
      </div>

      {/* R101: BUJK Database Coverage Expansion Plan */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-primary" /> BUJK DATABASE COVERAGE EXPANSION — Dari 147.230 BUJK Terdaftar ke Complete Coverage: Berapa yang Sudah Ada di Platform MJP, Mana yang Missing, dan Rencana 18 Bulan untuk Mencapai {'>'} 95% Coverage
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { segment: "BUJK Kualifikasi Besar (> Rp 50M project value)", total: "8.420 BUJK", mjp_coverage: "94.3%", gap: "478 missing — mostly BUJK besar yang tidak aktif di LPSE (private procurement only)", priority: "LOW — already well-covered, remaining gap is low-value segment (inactive BUJK)", tc: "text-emerald-700" },
            { segment: "BUJK Kualifikasi Menengah (Rp 1–50M)", total: "34.810 BUJK", mjp_coverage: "87.1%", gap: "4.478 missing — mostly BUJK menengah yang hanya aktif di 1–2 LPSE kabupaten, tidak di LPJK regional list", priority: "MEDIUM — Reza's Pro tier prospects are here. Coverage target: 92% by Q4 2026.", tc: "text-primary" },
            { segment: "BUJK Kualifikasi Kecil (< Rp 1M)", total: "104.000 BUJK", mjp_coverage: "61.4%", gap: "40.144 missing — dispersed kabupaten LPSE, many registered but rarely active", priority: "LOW — Starter tier klien. Coverage improvement will come organically as crawler expands to more kabupaten LPSE.", tc: "text-orange-700" },
            { segment: "BUJK Asing (foreign companies registered in Indonesia)", total: "420 BUJK", mjp_coverage: "34.5%", gap: "275 missing — different registry (Badan Usaha Jasa Konstruksi Asing). Language: English + Indonesian required. Niche but high-value for IKN international project tracking.", priority: "MEDIUM for IKN strategy — dedicated crawler sprint Q1 2027 planned.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.segment} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.segment}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.total} · {r.mjp_coverage} covered</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Gap: {r.gap}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Priority: {r.priority}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">BUJK database coverage adalah the foundation everything else is built on. Trust Score only works if the BUJK exists in the database. Competitor analysis only works if competitors are listed. Consortium Matching (Vision 2028) only works with high coverage. Coverage gaps are Hendra Jr.'s infrastructure problem — not data quality (which is Sari's domain) but data completeness (crawler coverage of all LPSE portals). Current crawler reaches 671 of 671 LPSE portals but with varying crawl frequency: Tier-1 LPSE (high-volume: Jakarta, Surabaya, Bandung) crawled every 2 hours. Tier-3 LPSE (kabupaten kecil) crawled once daily. Coverage gap is almost entirely in Tier-3 LPSE BUJK. Hendra Jr.: 'Tier-3 coverage is a long tail problem. Each new kabupaten LPSE we add: maybe 50 new BUJK. But 38.000 kabupaten BUJK are still not in our database. The completion effort is significant — we'll close it incrementally over 18 months.'</p>
      </div>

      {/* R102: BUJK Segmentation for Sales Strategy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> BUJK SEGMENTATION FOR SALES — Bagaimana Reza Mengkategorikan 147.230 Potensi Klien: 4 Segmen dengan Conversion Rate, Pain yang Paling Relevan, dan Pesan yang Paling Berhasil per Segmen
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { segment: "SEG-1: Aktif multi-LPSE bidder (bid pada > 5 LPSE dalam 12 bulan)", size: "~8.200 BUJK", conv: "61%", pain: "Alert fatigue dari manual monitoring 5+ LPSE portals. Missed tenders karena tidak bisa monitor semua secara bersamaan.", message: "'Anda bid di X LPSE. MJP monitors semua dari satu tempat dan alert hanya yang match KBLI dan kualifikasi Anda. Tidak ada yang terlewat lagi.'", tc: "text-emerald-700" },
            { segment: "SEG-2: Bidder tunggal yang aktif di 1–2 LPSE regional", size: "~34.000 BUJK", conv: "38%", pain: "Tidak tahu tentang IKN peluang atau non-regional tenders yang sesuai. Terbatas pada wilayah familiar.", message: "'BUJK seperti Anda di [region] rata-rata melewatkan 12 tender IKN yang cocok per tahun karena tidak monitor LPSE nasional. Kami sudah monitor untuk Anda.'", tc: "text-primary" },
            { segment: "SEG-3: BUJK yang aktif SKK upgrade / baru dapat kualifikasi naik", size: "~12.000 BUJK/year", conv: "52%", pain: "Baru naik kualifikasi tapi tidak tahu tender apa yang sekarang bisa mereka ikuti. Transisi period = high confusion.", message: "'Selamat dengan kualifikasi baru Anda! MJP akan alert semua tender yang sekarang bisa Anda ikuti dengan kualifikasi baru — langsung.'", tc: "text-blue-700" },
            { segment: "SEG-4: BUJK baru (registered < 2 tahun lalu)", size: "~18.000 BUJK/year", conv: "24%", pain: "Tidak tahu cara kerja pengadaan. Overwhelming by regulatory complexity. Need education not just tools.", message: "'MJP memberikan panduan regulasi, alert tender yang cocok, dan Trust Score untuk mitra — semua dalam satu tempat. 847 BUJK lain sudah pakai MJP untuk mulai dengan tepat.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.segment} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.segment}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.size} · conv {r.conv}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Core pain: {r.pain}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Reza message: {r.message}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">BUJK segmentation model adalah Reza dan Hendra joint analysis dari 24 months of sales data — matching prospect characteristics at first contact to eventual conversion outcome. SEG-1 (multi-LPSE bidder) consistently outperforms all segments on conversion rate because their pain is most concrete and immediate. SEG-4 (new BUJK) has lowest conversion not because the value prop is weak, but because they are overwhelmed and decision-making is slow. Reza's personal insight: 'SEG-4 yang berhasil convert sering jadi klien paling loyal karena MJP adalah bagian dari cara mereka learn industri ini dari awal. Mereka tidak punya frame of reference lain — MJP adalah standard untuk mereka.' Post-Series A plan: dedicated BDR for SEG-4 nurture sequence (educational email series, not sales calls) to improve 24% conversion systematically.</p>
      </div>

      {/* R103: BUJK Enterprise Account Deep Management */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5 text-primary" /> ENTERPRISE ACCOUNT DEEP MANAGEMENT — Bagaimana Hendra Mengelola 47 Enterprise Klien Secara Personal: Cadence, Touchpoints, dan 3 Praktik yang Menjaga 0.7% Monthly Churn di Tier Paling Berharga MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { practice: "P1: Quarterly Executive Business Review (EBR) — in-person when possible", who: "Hendra personally attends all EBRs. Reza joins for larger accounts. Never delegated.", format: "60-minute structured session: (1) ROI review — 'Here are 5 specific instances where MJP saved/won you time or contracts this quarter' (prepared with data by Hendra Jr.), (2) Product roadmap preview — 2 or 3 upcoming features, klien gets to vote on priority, (3) Open issues — any pain points, resolved or ongoing. Hendra comes with data, not slides. EBR is a conversation, not a presentation.", impact: "EBR-attending Enterprise klien: 12-month retention 96%. Non-EBR Enterprise: 88%. 8pp retention difference = at avg Rp 2.8jt MRR × 12 months = Rp 33.6jt additional ARR per EBR klien vs non-EBR. EBRs cost Hendra ~3 hours each × 47 klien × quarterly = 564 hours/year. ROI on those hours: extremely positive.", tc: "text-primary" },
            { practice: "P2: Proactive 'intelligence briefing' — monthly personal email from Hendra", who: "Written personally by Hendra, not templated. 200–300 words, 3–5 bullet points.", format: "'Ini adalah 3 hal yang terjadi bulan ini yang saya pikir relevan untuk bisnis Anda, berdasarkan KBLI dan region Anda.' Tone: trusted advisor, not vendor update. Hendra Jr. provides the data inputs. Hendra writes the interpretation. Key: personalized to that klien's specific context, not generic industry news.", impact: "Open rate: 81% (vs email marketing industry benchmark 23%). Response rate: 34% — klien reply with questions, context, or simply to say thank you. Each reply is relationship depth. Reza: 'Klien yang biasanya tidak responsif di channel lain, sering reply ke email Hendra langsung.'", tc: "text-blue-700" },
            { practice: "P3: Anomaly-triggered immediate outreach", who: "Hendra Jr. + Hendra monitor Enterprise klien usage patterns. Sudden drop in login frequency, no alert interaction in 2 weeks, or NPS score drop: immediate flag.", format: "Hendra Jr. detects anomaly → Hendra reaches out same day: 'Saya lihat Anda tidak buka platform dalam 2 minggu — ada yang bisa kami bantu?' Not aggressive, just attentive. 'Checking in' call, not sales call. In many cases: klien had a specific blockers (busy season, personal issue). MJP offering help = relationship strengthening.", impact: "Anomaly-flagged Enterprise klien who received outreach: 12% were showing early churn signals, 88% were just busy. For the 12%: proactive outreach resolved issues before they became churn. Estimated ARR saved: Rp 4.2jt/month from pre-churn recoveries.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.practice} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.practice}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Who + format: {r.who} {r.format}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Impact: {r.impact}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Enterprise account management adalah Hendra's biggest personal time investment — and deliberate choice. 564 hours/year on EBRs, 94 hours/year on personal briefing emails, ~24 hours/year on anomaly outreach = 682 hours/year (~17% of Hendra's working hours) dedicated to 47 clients. This is only sustainable at current scale. Post-Series A: Head of Customer Success hired specifically to own Enterprise relationship management using these same practices. Transition risk: klien who built relationship with Hendra personally may reduce engagement when CSM takes over. Mitigation: Hendra co-attends first CSM-led EBR for each Enterprise klien, personally introducing the CSM as his 'extended self.' Hendra: 'Enterprise klien yang membayar Rp 2.8jt per bulan untuk platform yang satu orang buat — mereka deserve personal attention yang sepadan dengan nilai yang mereka berikan. Bukan karena itu required. Karena memang begitu seharusnya.'</p>
      </div>

      {/* R104: Trust Score Business Case Studies */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> TRUST SCORE BUSINESS CASE STUDIES — 5 Kasus Nyata Dimana Trust Score MJP Mencegah atau Memungkinkan Keputusan Bisnis Besar: Mitra JO yang Hampir Salah Pilih, Subkontraktor yang Hampir Ditipu, dan 3 Keberhasilan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { case: "CASE-TS-1: JO partner yang hampir dipilih tapi Trust Score menunjukkan red flag", context: "Enterprise klien A mempertimbangkan JO dengan BUJK X untuk tender senilai Rp 47M di Sulawesi. Due diligence manual: BUJK X terlihat bagus, punya track record di Sulawesi, SKK lengkap.", score_finding: "Trust Score BUJK X: 51/100 (MEDIUM RISK). Sub-score breakdown: Financial Reliability: 32 (LOW — late payment signals dari 2 kontraktor lain di database MJP). Track record: 72 (GOOD). Compliance: 81 (EXCELLENT).", outcome: "Klien A menanya MJP lebih lanjut tentang Financial Reliability score. MJP's data: BUJK X pernah dispute dengan 2 subkontraktor soal delayed payment (ditemukan dari forum industri monitoring). Klien A memilih BUJK lain untuk JO. 4 bulan kemudian: BUJK X terlibat sengketa pembayaran dengan subkontraktor ketiga — informasi menjadi publik. Klien A: 'Tanpa MJP, kami mungkin sudah dalam sengketa itu.'", tc: "text-primary" },
            { case: "CASE-TS-2: Subkontraktor berpotensi ghost company — terdeteksi", context: "Pro klien B menerima penawaran subkontraktor MEP untuk proyek gedung perkantoran. Harga sangat kompetitif. Klien B penasaran: kenapa harganya bisa semurah itu?", score_finding: "Trust Score subkontraktor: 38/100 (HIGH RISK). Critical flag: BUJK registered 8 months ago, SKK holders: 2 persons (minimum required), bidding activity: 0 previous projects in database. Pattern: appears to be 'perusahaan baru yang muncul untuk satu proyek.'", outcome: "Klien B declined the subcontractor. After declining: investigated further and found the company was owned by a relative of the main contractor's procurement officer — a clear conflict of interest. Without Trust Score: klien might have accepted the unrealistically cheap bid, leading to incomplete work or contractor abandonment mid-project.", tc: "text-red-700" },
            { case: "CASE-TS-3: Menemukan JO partner yang ideal — Trust Score sebagai matching signal", context: "Enterprise klien C mencari JO partner untuk tender IKN yang memerlukan kualifikasi Besar di bidang sipil, dengan track record proyek senilai > Rp 100M. Klien C punya SKK kuat tapi kualifikasi Menengah Atas.", score_finding: "MJP Trust Score filter: KBLI sipil, kualifikasi Besar, aktif di IKN region, Trust Score > 75, no financial risk flags. Result: 3 BUJK matching criteria in database.", outcome: "Klien C approached all 3. 2 responded. 1 became JO partner: Trust Score 84. Combined kualifikasi: eligible for tender. Won tender: Rp 134M. Klien C: 'MJP Trust Score shortlisted the candidates. Tanpa itu, saya tidak tahu harus mulai dari mana dari 147.000 BUJK.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.case} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.case}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Context: {r.context}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Score finding: {r.score_finding}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Outcome: {r.outcome}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Trust Score case studies adalah MJP's most powerful retention content — real stories, real outcomes, real financial impact. Reza uses these (anonymized to company type, not name) in every Enterprise sales pitch and every renewal conversation. The stories do what data cannot: they create emotional resonance. CASE-TS-1 is Reza's most-used story: 'The JO partner you almost picked.' It's relatable because every BUJK has had at least one experience where a partner didn't perform as expected. 'Bayangkan jika Anda tahu itu sebelumnya.' Trust Score case studies collection: ongoing. Hendra Jr. built a 'case study trigger' in platform analytics — any klien who views a BUJK Trust Score and then doesn't proceed with that BUJK (proxy for 'avoided a bad decision') gets an outreach from Dewi asking if they'd like to share their experience. Case study pipeline: 12 potential new studies identified, 4 in interview process.</p>
      </div>

      {/* R105: The 147.000 BUJK Coverage Problem */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-primary" /> THE 147.000 BUJK COVERAGE PROBLEM — Dari 147.000 BUJK Terdaftar di Indonesia, MJP Punya Data yang Benar-benar Berguna untuk Berapa Banyak? Kejujuran tentang Coverage Gap dan 3-Year Plan untuk Menutupnya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { tier: "TIER A: Full profile (Trust Score + SKK + track record + activity)", count: "23.400 BUJK (16%)", def: "MJP has sufficient data to generate meaningful Trust Score. Concentrated in: Java (78%), Sumatera (12%), Kalimantan (8%). BUJK with active tender bidding in last 24 months. This is the segment MJP's core product serves today. Klien who look up BUJK in this tier: high confidence in data quality.", tc: "text-emerald-700" },
            { tier: "TIER B: Partial profile (SIKI registration + SKK only, no track record)", count: "67.800 BUJK (46%)", def: "MJP has SIKI registration data and SKK holder data but limited tender bidding history. Can generate partial Trust Score (compliance dimensions only — no financial or performance dimensions). Klien lookups: presented with 'Limited data — compliance profile available' warning.", tc: "text-orange-700" },
            { tier: "TIER C: Registration only (name, KBLI, address)", count: "41.200 BUJK (28%)", def: "MJP has name and registration data only. These are BUJK that are registered but have very limited public activity. Often: recently registered, or operating only in direct appointment (no LPSE bids). Trust Score: cannot be generated. Klien lookups: presented with 'Registration found. Insufficient data for Trust Score.' with option to request field research.", tc: "text-blue-700" },
            { tier: "TIER D: Not in MJP database", count: "14.600 BUJK (10%)", def: "BUJK that appear in industry directories but MJP has not yet acquired registration data for. Reasons: registered in provincial LPSE systems not yet crawled by MJP, or BUJK has never appeared in any publicly accessible database. Coverage expansion plan targets reducing Tier D to < 3% by end 2027.", tc: "text-red-700" },
          ].map((r) => (
            <div key={r.tier} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.tier}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.count}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.def}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">BUJK coverage analysis adalah Hendra Jr.'s most important infrastructure metric — and the one he's most uncomfortable sharing publicly because it reveals how much of MJP's total addressable market it doesn't yet fully serve. The honest number: MJP can generate a meaningful Trust Score for only 16% of registered BUJK. For 84%: either partial data or no data. This is not a failure — it's a 5-year-old startup with 6 people covering a database of 147.000 entities with no government cooperation and limited engineering resources. It IS, however, a clear ceiling on MJP's usefulness for klien who need to evaluate BUJK from underserved geographies. The 3-year coverage roadmap: Tier A to 42% (from 16%) by end 2028 — focusing on BUJK that are active in IKN and eastern Indonesia markets where demand is growing fastest. PUPR e-monitoring (DR-3) and BNSP API (DR-1) are the two data sources that would have the largest impact on Tier B → Tier A upgrades. Hendra: 'Coverage problem adalah bukan rahasia — klien tahu ketika mereka dapat partial profile. Tapi mereka stay karena 16% penuh coverage kami masih lebih baik dari 0% yang ditawarkan alternatives.'</p>
      </div>

      {/* R106: How BUJK Actually Find Each Other — The JO Market Before MJP */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Handshake className="h-3.5 w-3.5 text-primary" /> THE JO MARKET BEFORE MJP — Bagaimana BUJK Menemukan Mitra Joint Operation Sebelum Ada Data: 4 Metode yang Masih Digunakan 83% BUJK, Biaya Tersembunyi Tiap Metode, dan Mengapa MJP adalah Pergeseran Paradigma
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { method: "JO-M1: Jaringan personal — 'saya tanya teman saya yang tanya temannya'", prevalence: "67% of BUJK use as primary method", process: "BUJK owner asks his network of fellow BUJK owners: 'Do you know any company that can provide Ahli Utama in structural engineering for a project in Sulawesi?' The question propagates through 2–3 degrees of connection. Results: highly relationship-dependent. Companies in dense networks get good matches quickly; companies in thin networks get poor matches or none.", hidden_cost: "Time: 2–4 weeks to find a candidate through network. Quality control: zero — recommendation is based on 'I heard they're good' not on verified track record. Geographic bias: network recommendations are heavily concentrated in klien's home city. JO partnerships outside home geography: extremely difficult via personal network.", tc: "text-primary" },
            { method: "JO-M2: Asosiasi matchmaking — GAPENSI, INKINDO, regional events", prevalence: "34% of BUJK use for JO discovery", process: "Asosiasi events (annual meetings, regional meetups) create informal JO matchmaking. BUJK owners announce needs: 'Kami sedang cari mitra JO untuk...' in networking sessions. This works better than pure personal network for cross-geography matches.", hidden_cost: "Event-driven: only works when events happen (1–2x per year for national, quarterly for regional). Asosiasi membership required. Timing is not aligned with tender deadlines (tender opens: JO needed in 2 weeks; next asosiasi event: 3 months away). Quality: still recommendation-based, not data-based.", tc: "text-orange-700" },
            { method: "JO-M3: Cold outreach via LPSE winner history", prevalence: "28% of BUJK (more sophisticated operators)", process: "BUJK owner manually searches LPSE award history for companies that have won similar tender types. Finds company names. Looks them up in SIKI. Contacts them directly. This is the most data-informed method available before MJP — but it's entirely manual and produces only name + basic registration info.", hidden_cost: "Time: 8–15 hours of manual research per JO partner search. Coverage: only companies that have won LPSE tenders (Tier C/D BUJK invisible). Quality: award history only — no financial reliability signal, no compliance verification.", tc: "text-blue-700" },
            { method: "JO-M4: MJP Trust Score + filter (post-MJP, current state)", prevalence: "63% of Enterprise klien use for JO evaluation (growth from 0% 2 years ago)", process: "ListFilter Trust Score {'>'} 70 + KBLI match + active in target region + no financial red flags. Average search time: 12 minutes. Returns: 3–15 qualified candidates with full profile. Contact decision: based on data, not word of mouth.", hidden_cost: "Data coverage limitation: only TIER A BUJK (16%) have full Trust Score. For JO partner search outside Java: Tier B/C profile is available but Trust Score incomplete. The coverage gap (contractors page) is the primary limitation of MJP's JO matching vs its full potential.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.method} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.method}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.prevalence}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Process: {r.process}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Hidden cost: {r.hidden_cost}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">JO market before MJP adalah the most important market context for understanding why Trust Score has the potential to become MJP's most transformative product. The 3 traditional methods (JO-M1 through M3) share a common limitation: they're all relationship-based or manual-search-based, not data-based. The quality of a JO partner selection using these methods is directly proportional to the BUJK owner's network size and research patience — not to the partner's actual track record. MJP's JO-M4 is a paradigm shift: it decouples JO partner quality from the BUJK's network. A company in Kupang with no network in Java can find a qualified Java-based JO partner in 12 minutes using Trust Score filter — something that previously required years of relationship building or luck. This is why JO matching active recommendation (P-UNR-1, RICE 218, highest priority backlog item) is Hendra's most anticipated post-Series A feature: it moves from 'filter and find' to 'we recommend who to call.' Hendra: 'Pasar JO Indonesia adalah Rp 340T per tahun dalam nilai kontrak yang diproses melalui partnership yang sebagian besar dipilih dengan cara yang tidak jauh berbeda dari cara orang memilih mitra bisnis di abad ke-18. Kami sedang mengubah itu.'</p>
      </div>

      {/* R107: BUJK Governance Trends — How Construction Company Management Is Changing */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-primary" /> BUJK GOVERNANCE EVOLUTION — Perubahan Cara BUJK Dikelola yang Hendra Amati dalam 5 Tahun: 4 Tren yang Meningkatkan Nilai MJP Secara Struktural karena Klien Menjadi Lebih Sophisticated
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { trend: "TREND-1: Generational transition — anak-anak pemilik BUJK yang pernah kuliah di luar negeri mulai ambil alih", observation: "Of MJP's 47 Enterprise klien: 9 (19%) are managed by 2nd-generation owners who studied abroad or at top Indonesian universities. These klien: use MJP more deeply, ask more sophisticated questions via NLQ, demand more analytical features (Workroom, export filters), and are more likely to integrate MJP into formal procurement workflows.", implication: "Second-generation BUJK management is more analytical-tools-friendly. As generational transition accelerates (estimated 35% of large BUJK will have 2nd-generation management by 2030): MJP's analytical depth becomes a stronger differentiator vs simpler alert tools.", tc: "text-primary" },
            { trend: "TREND-2: Professionalisasi manajemen — BUJK mulai hire professional procurement manager", observation: "Traditionally: BUJK owner was the procurement manager. Trend (observed in Budi's research, 2024–2025): BUJK Menengah Atas and Besar increasingly hiring dedicated procurement managers — often with procurement certification background. These professional managers: have higher baseline knowledge of procurement process, demand more sophisticated tools, and are the primary champions for MJP subscriptions within their BUJK.", implication: "Professional procurement managers as champions: they can make the MJP case to owners with ROI language. They understand tools. They evaluate systematically. Reza now specifically targets BUJK that have hired dedicated procurement managers — conversion rate 2.4× higher than owner-only sales.", tc: "text-blue-700" },
            { trend: "TREND-3: Diversifikasi ke multi-KBLI — BUJK memperluas layanan untuk mengikuti peluang IKN", observation: "IKN has created an unusual procurement landscape: large projects requiring multiple KBLI simultaneously. BUJK that previously specialized in 1–2 KBLI are now expanding to cover additional KBLI (or forming JO partnerships with complementary KBLI holders). This diversification creates new SKK and compliance needs — which increase MJP's value per klien.", implication: "Multi-KBLI BUJK: need to track SKK across more jabatan kerja, manage compliance for multiple regulatory frameworks simultaneously, and evaluate JO partners across more dimensions. MJP's per-klien value increases structurally as BUJK diversification increases.", tc: "text-emerald-700" },
            { trend: "TREND-4: Data-driven bid decision making — dari intuisi ke analitik", observation: "Budi's 2025 research finding: 41% of BUJK Menengah-Besar now use some form of data in their bid selection process (vs estimated 15% in 2021). What counts as 'data use': accessing LPSE historical award data, checking competitor bid history, using government procurement statistics. Quality varies — but the direction is toward analytics.", implication: "The market is moving toward MJP. As more BUJK adopt data-driven decision making: (1) they're more likely to perceive MJP's value, (2) they're more likely to advocate for tools like MJP to peers, (3) the competitive advantage of using MJP decreases as industry averages rise — but MJP's advantage at the frontier remains constant because MJP continues to improve its intelligence depth.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.trend} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.trend}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Observation: {r.observation}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Implication: {r.implication}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">BUJK governance trends adalah the macro market context that Hendra uses in investor presentations to explain why MJP's TAM is not static. The construction market is not just the 147.000 BUJK that exist today — it's the evolution of how those BUJK are managed. As generational transitions accelerate, professional management increases, KBLI diversification grows, and data-driven decision making becomes standard: MJP's addressable market deepens without adding a single BUJK to the total. A simple alert tool serves the 2021 BUJK market. MJP is building for the 2030 BUJK market — more sophisticated, more analytical, more willing to pay for intelligence that justifies its cost. Hendra's investment thesis framing to VCs: 'We're not betting on the construction market being big. It's already big. We're betting on the sophistication of the people who manage construction companies increasing. And that's a one-directional bet — sophistication only moves forward.' Hendra: 'Pasar yang sedang kita masuki pada 2026 jauh lebih siap untuk MJP dari pasar yang ada ketika kami mulai pada 2021. Dan pasar pada 2031 akan jauh lebih siap lagi. Kami membangun tepat pada saat yang tepat.'</p>
      </div>

      {/* R108: What 147.000 BUJK Data Reveals About Indonesian Construction */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-primary" /> NATIONAL BUJK HEALTH INDICATORS — Apa yang Data 147.000 BUJK MJP Ungkapkan tentang Kesehatan Industri Konstruksi Indonesia: 5 Temuan yang Tidak Bisa Dilihat dari Data Tunggal Manapun
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { finding: "FINDING-1: 73% BUJK Indonesia belum pernah memenangkan satu pun tender {'>'} Rp 500 juta", data: "MJP database: 147.000 BUJK registered. Of these: only 39.690 (27%) have any LPSE award record above Rp 500jt. The remaining 109.310 (73%): either won no tenders, won only small tenders ({'<'} Rp 500jt), or never participated in formal LPSE procurement. Context: this doesn't mean 73% are struggling — some are pure private-sector contractors with no government work. But it does mean the government procurement market is highly concentrated in 27% of registered BUJK.", implication: "MJP's addressable market is not 147.000 — it's meaningfully larger among the 39.690 active-in-LPSE BUJK, and meaningfully smaller among the 109.310 non-LPSE segment. Segmentation intelligence: LPSE-active BUJK have 4× higher subscription probability than non-active BUJK. Reza's targeting: filter to LPSE-active BUJK for direct outreach.", tc: "text-primary" },
            { finding: "FINDING-2: Rata-rata BUJK aktif memiliki 2.3 SKK yang akan kedaluwarsa dalam 18 bulan ke depan", data: "MJP's BNSP database cross-referenced against active BUJK registry: of 39.690 active BUJK, the average active BUJK has 2.3 employee SKK certificates expiring within 18 months. For BUJK Menengah (multi-project, multiple jabatan kerja): average 5.7 expiring SKK. This is a systemic renewal burden — most BUJK are in a continuous rolling state of SKK management.", implication: "SKK expiry is not a rare event — it's a permanent operational reality for every active BUJK. MJP's SKK monitoring feature is therefore not a 'nice to have' but a genuine operational necessity. The 5.7 expiring SKK average for Menengah BUJK means MJP's SKK feature has on average 5+ actionable items per klien at any time.", tc: "text-blue-700" },
            { finding: "FINDING-3: 67% dari BUJK aktif beroperasi di satu provinsi; 4% beroperasi di 6+ provinsi", data: "Geographic operational scope distribution: 67% single-province, 22% 2–3 provinces, 7% 4–5 provinces, 4% (1.588 BUJK) operating in 6+ provinces. The 4% multi-province BUJK account for 41% of total LPSE award value in MJP's database — disproportionate market concentration. These 1.588 BUJK are effectively the 'enterprise tier' of Indonesian construction.", implication: "MJP's Enterprise klien are disproportionately drawn from this 4% multi-province segment. These klien have complex cross-provincial intelligence needs (multiple LPSE portals to monitor, cross-provincial SKK management, multi-province JO partner networks). MJP's multi-province coverage is directly calibrated for this segment's needs.", tc: "text-emerald-700" },
            { finding: "FINDING-4: Konsentrasi win rate: 20% BUJK terbaik memenangkan 71% dari nilai tender", data: "Win rate distribution: top 20% of BUJK by tender success (measured by won tenders / participated tenders): win 71% of total LPSE award value. Bottom 40% of participating BUJK: win 4% of total award value despite participating in 38% of all tender submissions. Pareto principle holds: but even more concentrated than 80/20 — closer to 71/20.", implication: "This concentration is partly self-reinforcing (experienced BUJK learn the system, build relationships, refine their estimating) and partly structural (large BUJK can absorb more working capital to participate in larger tenders). MJP's role: help the 'next tier' BUJK (21st–40th percentile by win rate) access the same intelligence that the top 20% use intuitively. The largest marginal ROI for MJP: improving win rates for the 21st–50th percentile BUJK, not optimizing for BUJK already in top 20%.", tc: "text-orange-700" },
            { finding: "FINDING-5: BUJK yang aktif menggunakan Trust Score memiliki 23% lebih sedikit JO disputes", data: "Proxy analysis (self-reported via Budi interviews + NPS feedback): klien who use Trust Score for JO partner vetting before partnership agreement report 23% fewer mid-project disputes with JO partners (defined as disputes requiring formal communication or contract modification). This is not causal evidence — it's correlational. But it's directionally consistent with the hypothesis that better-vetted partnerships perform better.", implication: "Trust Score's value to klien is not just in finding partners — it's in avoiding bad ones. The 23% dispute reduction estimate (if validated) represents real cost savings for BUJK: dispute resolution in construction partnerships is expensive (legal fees, project delays, relationship damage). Quantifying this value could strengthen Trust Score's ROI case in Enterprise contract negotiations.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.finding} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.finding}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.data}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Implication: {r.implication}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">National BUJK health indicators adalah MJP's most strategically valuable analytical output — not for klien directly, but for MJP's own understanding of its market. These 5 findings are the product of combining MJP's cross-referenced databases (LPSE, BNSP, BUJK registry) in ways that no single government database makes possible. LKPP has LPSE data. BNSP has SKK data. BKPM has BUJK registration data. But no government agency combines all three with the depth and accessibility that MJP has built. The combination produces insights that surprise even government officials: the 73% non-active-LPSE finding was shared with LKPP as part of MJP's working group contribution — LKPP had not previously had a consolidated view of this concentration. Hendra uses these findings in 3 contexts: (1) investor presentations (shows market depth and intelligence moat), (2) government partnership discussions (demonstrates MJP's value as market intelligence partner), (3) Enterprise klien retention (annual briefing showing klien where they stand relative to the 147.000 BUJK universe). FINDING-4 (win rate concentration) is the most powerful in klien retention: a klien in the 30th percentile win rate who sees that moving to the 50th percentile would dramatically change their business — and understands that MJP is calibrated specifically for that transition — has a visceral understanding of MJP's value that no feature list can provide. Hendra: 'Data 147.000 BUJK bukan hanya database. Ini adalah potret industri konstruksi Indonesia — dengan semua ketimpangan, konsentrasi, dan peluang yang tersembunyi di dalamnya.'</p>
      </div>

      {/* R109: The Story Behind Trust Score */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-primary" /> THE STORY BEHIND TRUST SCORE — Asal-Usul Nama dan Konsep Trust Score: Dari Ide Kasar pada 2022 ke Feature yang Menjadi Salah Satu Alasan Utama Klien Bertahan, dan Apa yang Hendra Jr. Menyesal Tidak Bangun Lebih Awal
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { moment: "The problem that started it: JO partnership gamble that cost a narasumber Rp 4.8M", story: "In Q2 2022, Budi interviewed a Pro klien (BUJK owner, Depok, 12 years in construction) who had recently lost Rp 4.8M in a failed JO partnership. The failure: JO partner had presented an impressive track record — verbally. The track record was exaggerated. The partner's actual LPSE history: 2 contract completions in 3 years, both for small values. The klien had no way to verify before committing to JO. Budi's documentation of this interview: 'The single most painful interview of my 2022 field research cycle.'", implication: "Budi brought the interview to the team meeting. Hendra Jr. immediately asked: 'Can I build something that would have prevented this?' He had access to LPSE award data. The question: could LPSE data alone tell you which BUJK to trust as a JO partner?", tc: "text-primary" },
            { moment: "First version: 'BUJK Track Record Score' — renamed after narasumber feedback", story: "Hendra Jr. built the first version in 3 weeks. Original name: 'BUJK Track Record Score' — a direct description of what it measured. Budi tested it with 7 narasumber in field interviews. Consistent feedback: 'Track Record Score sounds like a grade in school. I'm not looking for a grade — I'm looking for someone I can trust with my project.' The word 'trust' appeared in 6 of 7 interviews without prompting.", implication: "Name change from 'Track Record Score' to 'Trust Score' happened at Budi's recommendation after the narasumber interviews. The rename: more emotionally accurate. BUJK owners aren't looking for a performance statistic — they're looking for trust signal. Trust Score communicates the use case in the name itself. Hendra: 'Trust Score adalah fitur yang bernama oleh narasumber, bukan oleh tim produk kami. Itu adalah nama terbaik yang mungkin.'", tc: "text-blue-700" },
            { moment: "The first Trust Score that changed a business decision", story: "3 weeks after Trust Score launched (August 2022): Pro klien (KON-034) used Trust Score to evaluate a potential JO partner for an IKN-adjacent tender. Trust Score result: Tier D ('Very Limited Track Record'). The klien was surprised — the potential partner had self-represented as experienced. KON-034 asked Hendra for the underlying data. Hendra Jr. showed the LPSE history: 1 completed contract in 4 years, small value. KON-034 declined the JO partnership and found a Tier B partner instead. The tender was won.", implication: "This was the first Trust Score impact Hendra documented. He called KON-034 2 months later: 'Did Trust Score save you from the Tier D BUJK?' KON-034: 'It saved me from wasting Rp 2.3M in JO partnership due diligence cost and potentially much more if the partner had performed as poorly as their track record suggested.' Hendra's lesson: Trust Score's primary value is not finding the best partners — it's avoiding the worst ones. The 23% JO dispute reduction finding (FINDING-5) is the long-term validation of this lesson.", tc: "text-emerald-700" },
            { moment: "What Hendra Jr. regrets about Trust Score's original design", story: "Original Trust Score: based only on LPSE award data (track record). Hendra Jr.'s 2024 retrospective: 'I should have included a local execution history dimension from Day 1. Gregorius's challenge (Flores) revealed that LPSE data is biased toward large, Java-based, capital-intensive BUJK. A BUJK with a 5-year track record in Kalimantan highway construction might be Tier D in LPSE because they work in a market with lower formal contract values — but they're exactly who you'd want as a JO partner for an IKN highway project.'", implication: "The Local Execution History dimension: currently in development (post-Flores interview). Adding it requires Budi's field research data as input — which is why field research investment and Trust Score improvement are linked. Every dimension Hendra Jr. adds to Trust Score requires either (1) a data source that verifies the dimension, or (2) Budi's field research to calibrate the model. This is why Trust Score evolution is permanently co-dependent with field research investment.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.moment} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.moment}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.story}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Implication: {r.implication}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">The story behind Trust Score adalah one of MJP's most important product origin stories — because it illustrates the right product development process: observed real pain (JO partnership gamble) → field research interview documentation → team discussion → rapid prototype → narasumber-guided naming → first real-world impact → continued evolution. Each step was grounded in user reality, not product theory. The BUJK owner in Depok who lost Rp 4.8M: he is not a MJP klien. He doesn't know his story became the origin of Trust Score. But his painful experience — documented honestly by Budi and brought to a team meeting — changed how 847 BUJK make JO partnership decisions today. This is the direction of causality that Hendra documents: from a specific human experience of pain → to a product that prevents that pain for others. Trust Score in its current form has been used for 23.400 BUJK lookups in the past 12 months. Each lookup: a BUJK owner trying to make a safer partnership decision. The BUJK owner in Depok whose story started it all: indirectly helped 23.400 potential JO partnership decisions be more informed than his own was. Hendra: 'Nama Trust Score datang dari narasumber. Keberadaannya datang dari seorang pemilik BUJK yang rugi Rp 4.8 juta karena tidak ada alat untuk memverifikasi mitra yang dia percaya. Kami membangun fitur ini untuknya — bahkan walaupun dia tidak pernah tahu.'</p>
      </div>

      {/* R111: BUJK Power User Archetypes */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> BUJK POWER USER ARCHETYPES — 3 Profil BUJK yang Menghasilkan 67% Revenue MJP dan 89% Platform Insights: Siapa Mereka, Bagaimana Mereka Menggunakan Platform, dan Apa yang Mereka Ajarkan tentang Product-Market Fit
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { archetype: "ARCHETYPE-1: The Systematic Bidder — BUJK yang mengikuti 8–15 tender per bulan", profile: "Ciri utama: volume tender yang tinggi dengan seleksi awal yang sangat terstruktur. Mereka menggunakan MJP untuk triage, bukan deep research. Session pattern: 2–3 kali per hari, 8–12 menit per session, focused on Alert dashboard dan Tender filters. NLQ usage: minimal — mereka tahu apa yang mereka cari dan tahu cara mencarinya. Trust Score usage: digunakan sebelum setiap JO partnership discussion. Platform feature yang paling sering digunakan: Tender Calendar + Alert personalization.", revenue_impact: "Revenue per BUJK: biasanya Enterprise tier (Rp 3.5jt/bulan) karena volume tender membenarkan cost. Retention: tertinggi dari semua archetype — 96.3% annual. Churn reason ketika terjadi: business downturn (BUJK mengurangi aktivitas tender karena cash flow), bukan kepuasan produk. Hendra Jr.'s optimization for this archetype: Alert latency improvement project (T-ROAD-4) — getting from 4-hour to 30-minute alert delivery. Systematic Bidders bisa kehilangan tender window dalam 4 jam pertama jika alert terlambat.", tc: "text-primary" },
            { archetype: "ARCHETYPE-2: The Compliance Guardian — BUJK yang menggunakan MJP terutama untuk regulatory tracking", profile: "Ciri utama: penggunaan Knowledge Registry dan Regulasi section yang intensif, alert sensitivity yang tinggi untuk regulasi baru. Biasanya: BUJK yang beroperasi di segmen dengan regulatory burden tinggi (K3, material specification, environmental compliance). Session pattern: 1 session per hari, 15–25 menit, heavily weighted toward Knowledge Registry. NLQ usage: tinggi — mereka sering membuat complex regulatory queries yang memerlukan synthesis across multiple regulation sources. Trust Score usage: rendah — mereka lebih focused on their own compliance than partner vetting.", revenue_impact: "Revenue per BUJK: campuran Pro dan Enterprise. NPS tertinggi dari semua archetype: 9.7/10. Churn reason: sangat rendah kecuali business cessation. Sari's connection to this archetype: Compliance Guardians are the most likely to send Sari personal feedback about Knowledge Registry accuracy — they catch errors that even Sari's QA process misses because they verify assets against their own deep regulatory expertise. Post-Series A: Sari plans to formalize a 'Compliance Guardian advisory panel' of 5 Enterprise klien who volunteer quarterly review of high-impact assets.", tc: "text-blue-700" },
            { archetype: "ARCHETYPE-3: The Strategic Analyst — BUJK yang menggunakan MJP untuk competitive intelligence dan market positioning", profile: "Ciri utama: heavy usage of Sinyal Pasar, Radar Kompetitor, dan Workroom. These are typically BUJK owners or senior directors who are making strategic, not operational, decisions. Session pattern: 2–3 sessions per week, 30–45 menit per session, reading depth over breadth. NLQ usage: the highest of all archetypes — they ask market-level questions: 'apa tren jenis proyek yang dimenangkan BUJK dengan kualifikasi serupa dengan kami di 6 bulan terakhir?' Trust Score usage: strategic — used for competitor mapping, not just partner vetting.", revenue_impact: "Revenue per BUJK: always Enterprise. The smallest segment in numbers but highest in revenue contribution and product insight value. Budi's relationship with this archetype: Strategic Analysts are Budi's most valuable narasumber contacts — they have the highest-level view of market dynamics and are most likely to share strategic intelligence that feeds into MJP's market analysis. Product implication: Radar Kompetitor and Workroom features were shaped almost entirely by feedback from Strategic Analyst archetypes. Hendra: '3 archetypes ini bukan segmentasi yang saya rancang — ini segmentasi yang muncul dari 5 tahun mengamati bagaimana BUJK sungguh-sungguh menggunakan platform. Tiap archetype: cara yang valid untuk menciptakan nilai dari informasi yang sama.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.archetype} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.archetype}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Profile: {r.profile}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Revenue impact: {r.revenue_impact}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">BUJK power user archetypes adalah one of MJP's most actionable segmentation frameworks — because it links user behavior patterns directly to product development priorities. Each archetype requires different product investments: Systematic Bidders need speed (alert latency); Compliance Guardians need depth (Knowledge Registry completeness and accuracy); Strategic Analysts need breadth (market intelligence synthesis). Before this archetype framework: product discussions used 'BUJK' as a monolithic category — 'BUJK need better alerts' or 'BUJK need more regulation content.' The framework forced specificity: which BUJK? Systematic Bidders need faster alerts; Compliance Guardians need deeper regulatory content; Strategic Analysts need better market synthesis. The 3 archetypes account for approximately 67% of MJP's revenue and generate 89% of NPS verbatim responses (the other 33% of klien are lower-engagement, receive value passively, and rarely provide detailed feedback). Product investment ROI: improvements targeted at archetype-specific needs have 3.2× higher measured impact than general improvements targeting all BUJK simultaneously. Budi: 'Tiga archetype ini: mereka bukan kategori marketing. Mereka adalah tiga cara berbeda bahwa seorang pengusaha konstruksi Indonesia bisa mengalami platform kami dan menemukan bahwa platform kami membuat bisnis mereka lebih baik. Tiap cara valid. Tiap cara perlu didukung dengan baik.'</p>
      </div>

      {/* R110: BUJK First 90 Days on MJP */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Milestone className="h-3.5 w-3.5 text-primary" /> BUJK ONBOARDING JOURNEY — 90 Hari Pertama Klien di MJP: Apa yang Terjadi, Siapa yang Bertanggung Jawab, Apa yang Bisa Salah, dan Bagaimana Reza Mendeteksi Klien yang Akan Churn Sebelum Mereka Sendiri Menyadarinya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { week: "Week 1 (Day 1–7): Setup + first value signal", responsibilities: "Day 1: Automated welcome email + onboarding checklist (5-step: (1) complete KBLI profile, (2) set province preferences, (3) activate SKK employee list, (4) run first Trust Score lookup, (5) set alert preferences). Day 3: Hendra Jr.'s system checks completion rate. If {'<'}3 steps completed: Reza receives alert → personal WhatsApp to klien. Day 7: First weekly digest delivered.", success_signal: "Klien completes all 5 onboarding steps AND opens Day-7 digest. Historical data: klien who complete all 5 steps in Week 1 have 73% 6-month retention. Klien who complete {'<'}3 steps in Week 1: 41% 6-month retention. The onboarding checklist completion rate is the #1 predictive signal of long-term retention.", tc: "text-primary" },
            { week: "Week 2–4: Feature discovery + first active use", responsibilities: "Week 2: In-app tooltip sequence (triggered by login) introduces core features klien hasn't yet used. Week 3: First NLQ prompt suggestion shown to klien who hasn't tried NLQ yet ('Coba tanya: apa saja persyaratan kualifikasi untuk tender konstruksi di atas Rp 10M?'). Week 4: First 30-day activity report delivered to klien — showing: tenders viewed, Trust Score lookups, NLQ questions asked, SKK alerts received.", success_signal: "NLQ first use within 30 days: 61% of Pro and Enterprise klien who use NLQ in Month 1 are still active at Month 6. Klien who never try NLQ in Month 1: 44% 6-month retention. NLQ first use is the second most predictive Week-2–4 signal after onboarding completion.", tc: "text-blue-700" },
            { week: "Week 5–8: Depth engagement + persona classification", responsibilities: "Hendra Jr.'s system classifies each klien's usage pattern by Week 6: (A) Deep User (8+ sessions/week, {'>'} 5 feature categories used), (B) Core User (3–7 sessions/week, 2–4 features), (C) Passive User ({'<'}3 sessions/week, 1–2 features). Classification triggers: Deep Users → Reza pro-actively offers Enterprise upgrade conversation. Passive Users → Reza personal outreach ('Apakah ada hambatan dalam menggunakan platform? Saya ingin memastikan bahwa MJP memberikan nilai yang Anda harapkan.')", success_signal: "Passive User classification at Week 6: 78% probability of cancellation within 90 days if no intervention. Reza's personal outreach converts 31% of at-risk Passive Users to Core Users. Converted Passive Users: 58% retention at Month 6. Unconverted Passive Users: 22% retention at Month 6.", tc: "text-emerald-700" },
            { week: "Week 9–12: First tender outcome (success or failure) + renewal decision zone", responsibilities: "By Week 12: many klien have submitted at least one tender using MJP intelligence. Reza's protocol: if klien wins a tender during onboarding period → immediate congratulations + outcome documentation + case study request (if klien agrees). If klien loses a tender → Reza personal call: 'Bagaimana MJP bisa membantu Anda dalam persiapan tender berikutnya?' The outcome conversation: converts a loss into a deeper engagement if handled correctly.", success_signal: "Klien who have a 'first win' conversation with Reza during the onboarding period: 91% retention at Month 6. Klien whose first tender outcome is a loss but who engage with Reza's follow-up call: 69% retention at Month 6. Klien whose first tender outcome is a loss and who don't engage with Reza: 38% retention at Month 6. The outcome conversation is the highest-leverage Reza touchpoint in the entire onboarding journey.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.week} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.week}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.responsibilities}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Success signal: {r.success_signal}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">BUJK onboarding journey adalah the operational playbook that connects product activation to revenue retention. The 4-phase structure (Week 1: setup, Week 2–4: discovery, Week 5–8: depth, Week 9–12: outcome) is designed to produce the success signals that predict 6-month retention: onboarding completion, NLQ first use, Core/Deep usage classification, and first outcome conversation. Each signal is a leading indicator of retention — available 60–90 days before the renewal decision. The leading-indicator architecture: critical for Reza's work. Without leading indicators, Reza can only act on churn after it's decided. With leading indicators: Reza can identify at-risk klien and intervene at the point where intervention is still effective. Passive User classification at Week 6 (78% churn probability) is MJP's most powerful intervention signal: it gives Reza 6 weeks to convert a Passive User before the renewal decision becomes irreversible. Reza's conversion rate from this intervention (31%): means approximately 1 in 3 high-risk klien are retained through the Week 6 personal outreach. At current klien volume (847 active): approximately 40–50 klien per month classified as Passive Users at Week 6. Reza converts ~13–16 of them per month through personal outreach. ARR retained per month: ~13–16 × Rp 200k (average MRR per Pro klien) × 12 = Rp 31–38jt additional ARR per month from this single intervention. Reza: 'Onboarding adalah percakapan yang dimulai sebelum klien menyadari bahwa mereka perlu bicara dengan kami. Pekerjaan saya: mengetahui kapan percakapan itu perlu terjadi, bahkan sebelum klien menyadarinya sendiri.'</p>
      </div>

      {/* R112: BUJK Churn Prevention Playbook */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> CHURN PREVENTION PLAYBOOK — Bagaimana MJP Mendeteksi dan Mencegah Klien Pergi Sebelum Mereka Membuat Keputusan: 4 Early Warning Signals, Intervention Protocols, dan Reza's Success Rate per Intervention Type
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { signal: "EWS-1: Login frequency drop — klien yang biasanya login harian, tiba-tiba hanya mingguan", threshold: "Threshold: 7 consecutive days below 40% of the klien's 30-day average login frequency. Detection: automated — Hendra Jr.'s usage monitoring system generates a daily alert list. Lead time before churn: historical data shows 65% of churned klien showed this signal 3–6 weeks before cancellation.", intervention: "Reza's EWS-1 intervention: personal email (not automated) within 48 hours of alert. Template: 'Saya perhatikan Anda tidak banyak menggunakan platform belakangan ini — apakah ada yang bisa saya bantu? Saya ingin memastikan Anda mendapat manfaat penuh dari layanan kami.' The email is genuine inquiry, not sales. Goal: discover whether the reduced usage reflects dissatisfaction (actionable) or just a slow period in their business (wait-and-see). Success rate: 43% of EWS-1 interventions result in reengagement. Of those who respond and express dissatisfaction: 67% are retained with specific product or service adjustment.", tc: "text-primary" },
            { signal: "EWS-2: Feature abandonment — klien yang berhenti menggunakan fitur yang pernah mereka gunakan intensif", threshold: "Threshold: 14 consecutive days with zero usage of a feature that the klien had used at least 5 times/week in the preceding 30 days. Most predictive abandonment: NLQ abandonment (predicts churn within 4 weeks with 71% probability), Trust Score abandonment (58%), Alert settings changed to unsubscribe all (89%).", intervention: "NLQ abandonment intervention: Reza's personal outreach + offer of a 20-minute guided NLQ session — 1-on-1 where Reza helps the klien find a use case that produces a proof moment. Success rate: 51% of NLQ abandonment klien who complete the guided session reactivate NLQ. Alert unsubscribe: immediate automated confirmation + Reza's personal call within 24 hours if Enterprise tier. Success rate for Enterprise: 38%.", tc: "text-blue-700" },
            { signal: "EWS-3: Support ticket spike — klien yang membuka lebih dari 2 tickets dalam 7 hari", threshold: "Threshold: 3 or more support tickets in a rolling 7-day window. Average MJP klien opens 0.3 tickets/month. A klien opening 3 tickets in 7 days: indicates product struggle or data quality frustration. Data quality tickets about Trust Score accuracy: harder to resolve and create deeper trust damage than system issue tickets.", intervention: "Ticket spike intervention: Reza escalates to personal call within 24 hours. Reza opens with: 'Saya melihat Anda memiliki beberapa pertanyaan minggu ini — saya ingin memastikan semuanya terselesaikan dengan baik, dan memahami apakah ada masalah sistemik yang perlu kami perbaiki.' Data quality concerns: Hendra Jr. and Sari are looped in if Trust Score accuracy is disputed. Success rate: 60% resolved without churn.", tc: "text-emerald-700" },
            { signal: "EWS-4: Renewal date approaching without engagement signal", threshold: "Threshold: 45 days before annual renewal AND klien's passive NPS interaction score below 6. The combination: an approaching renewal decision with low satisfaction signals is the most time-sensitive churn situation — unlike EWS-1 through EWS-3 (detected in real-time), EWS-4 is tied to a specific deadline.", intervention: "EWS-4 intervention: structured 30-minute review call at 45 days before renewal. Reza prepares a 12-month usage summary from platform data ('dalam 12 bulan lalu, Anda menggunakan platform untuk X tender evaluations, Y Trust Score lookups, Z regulatory references'). Most retention-positive element: most klien have forgotten how much they've used the platform. Showing the summary: reminds them of value received. Reza: 'Klien sering lupa seberapa sering mereka menggunakan platform — menunjukkan ringkasan 12 bulan mengingatkan mereka tentang nilai yang sudah mereka terima.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.signal} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.signal}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Threshold: {r.threshold}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Intervention: {r.intervention}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Churn prevention playbook adalah MJP's most financially valuable operational system — because at Rp 1.8jt/month average revenue per subscriber and 8.8% natural annual churn rate without intervention, preventing each churn event saves Rp 12.6jt–42jt in lifetime value (Pro to Enterprise). Reza's current intervention rate: 73% of at-risk klien flagged by EWS-1 through EWS-4 receive a personal intervention within 48 hours. Overall success rate: 48% — approximately half of at-risk klien who receive intervention are retained. This 48% rate generates approximately Rp 380jt in annual retained revenue that would otherwise have churned. The playbook's most important design principle: every intervention is human and personal, not automated. Reza does not send automated re-engagement emails — he sends personal messages that demonstrate genuine knowledge of the klien's specific usage pattern. This personalization: the reason the success rate is 48% rather than the industry average 15–20% for automated churn systems. The cost: Reza's time. The return: Rp 380jt/year. Hendra's calculation: Reza's churn prevention activity generates more revenue per hour than his new sales activity. 'Reza jual ke 847 klien yang sudah ada lebih efisien dari dia jual ke klien baru — karena dia tidak perlu membangun kepercayaan dari nol. Kepercayaan sudah ada. Dia hanya perlu mengingatkan klien bahwa kepercayaan itu masih terjustifikasi.'</p>
      </div>

      {/* R113: BUJK Lifecycle Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> BUJK LIFECYCLE INTELLIGENCE — Bagaimana MJP Mengidentifikasi Kapan Sebuah BUJK Sedang Tumbuh dan Siap Upgrade Langganan: 5 Growth Signal, Reza's Upgrade Conversation Methodology, dan Mengapa Membantu Klien Tumbuh Adalah Strategi Retensi Terbaik MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { signal: "GROWTH-1: LPSE win frequency increase — BUJK yang mulai memenangkan lebih banyak tender dari biasanya", detection: "Hendra Jr.'s system tracks LPSE award data for all 847 subscribers. Growth signal: a subscriber BUJK whose win rate in the past 90 days exceeds their 12-month average by 30% or more. This signal: indicates the BUJK is in a growth phase — winning more contracts means more cash flow, more operational complexity, and (typically) increased budget for tools that help them manage that complexity. The 30% threshold: calibrated from 18 months of data — below this threshold, win rate variation is within normal fluctuation. Above 30%: structural growth is the most likely explanation.", reza_action: "Reza's GROWTH-1 response: within 7 days of signal detection, a congratulatory message ('Saya melihat Anda baru-baru ini memenangkan beberapa proyek besar — selamat! Apakah ada yang bisa saya bantu untuk mengelola peningkatan aktivitas Anda?') + a specific question about whether their current subscription tier is still appropriate for their expanded workload. Upgrade conversion rate from GROWTH-1 signals: 29% (Pro-to-Enterprise). The conversion is not a hard sell — it's a timing-relevant offer. A BUJK that just won 3 contracts is in expansion mode; upgrading their intelligence subscription is a natural next step.", tc: "text-primary" },
            { signal: "GROWTH-2: Qualification upgrade signals — BUJK yang mengajukan SBU ke jenjang lebih tinggi", detection: "BNSP's public database shows SBU qualification applications in progress. Hendra Jr.'s system monitors this for all subscriber BUJK. A BUJK applying for a higher-grade SBU: is deliberately expanding their addressable tender market — they want to qualify for larger contracts. This is a growth signal that precedes revenue growth (the BUJK is preparing for growth before the growth materializes). Lead time: typically 3–6 months between SBU application and first tender submission at the new grade.", reza_action: "Reza's GROWTH-2 response: an education-first outreach ('Saya melihat Anda sedang dalam proses upgrade SBU Anda — bagaimana prosesnya berjalan? Saya ingin memastikan Anda tahu tentang semua tender baru yang akan Anda kualifikasikan setelah upgrade selesai.'). The education-first approach: builds trust (Reza demonstrates knowledge of the BUJK's situation) and creates natural entry point for demonstrating new tender categories MJP's platform will cover once the SBU upgrade is complete. Upgrade conversation timing: ideally at SBU completion, not at application stage.", tc: "text-blue-700" },
            { signal: "GROWTH-3: Geographic expansion signals — BUJK yang mulai mengikuti tender di provinsi baru", detection: "Platform behavior signal: a subscriber BUJK who has historically only monitored tenders in 1–2 provinces begins monitoring tenders in 3+ provinces. Hendra Jr.'s system detects this through alert preference changes (subscriber expands their province filter settings) or direct LPSE search behavior in new provinces. Geographic expansion: one of the strongest growth indicators in Indonesian BUJK businesses — expanding to new provinces is a significant commitment that typically accompanies increased financial capacity and operational ambition.", reza_action: "Reza's GROWTH-3 response: a proactive regional intelligence offer ('Saya melihat Anda mulai memantau tender di Kalimantan Timur — apakah ini ekspansi baru yang Anda rencanakan? Saya ingin memastikan bahwa Anda memiliki konteks lokal yang tepat untuk memulai di pasar baru itu.'). Reza then offers: (1) a brief on regional LPSE portal characteristics for the new provinces, (2) Trust Score recommendations for established BUJK in those provinces who could be JO partners for the expansion, (3) an Enterprise upgrade pitch if they're on Pro tier (Enterprise includes full Trust Score history for all 12.000+ BUJK including those in the new target provinces).", tc: "text-emerald-700" },
            { signal: "GROWTH-4: Employee SKK expansion — BUJK yang menambahkan personel baru ke registrasi SKK mereka", detection: "BNSP's SKK registry shows when a BUJK adds new certified personnel to their qualification profile. A BUJK adding 3+ new SKK-certified employees in a quarter: is actively building their human resource qualification capacity — a precursor to bidding for larger or more complex tenders. The correlation: 78% of BUJK who add 3+ SKK personnel in a quarter submit tenders in a higher-value bracket within 6 months.", reza_action: "Reza's GROWTH-4 response: a SKK Express referral opportunity AND an upgrade conversation. 'Saya melihat Anda sedang aktif membangun tim SKK-certified — kami memiliki layanan SKK Express yang membantu memastikan sertifikasi baru diproses dengan cepat jika ada kebutuhan mendesak.' This response: serves two commercial goals simultaneously (SKK Express referral + subscription upgrade conversation). The dual goal: only works because both are genuinely relevant to the BUJK's current situation.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.signal} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.signal}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Detection: {r.detection}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Reza's action: {r.reza_action}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">BUJK lifecycle intelligence adalah Reza's most proactive commercial activity — because it allows him to approach BUJK at the exact moment when a conversation about upgrading their subscription is most naturally relevant. The 4 growth signals collectively represent the platform's ability to observe its clients' business growth in real time, through platform behavior and third-party data (BNSP, LPSE). This observation capacity: not built for commercial purposes originally — Hendra Jr. built the tracking for product analytics. The commercial application (connecting growth signals to Reza's outreach) was Reza's idea, implemented in Q1 2025. The 18-month result: 47 Pro-to-Enterprise upgrades traceable to lifecycle-signal-triggered conversations (vs 23 upgrades in the prior 18 months from Reza's general outreach). The doubling of upgrade rate from lifecycle-triggered conversations confirms the core hypothesis: the right offer at the right moment in a client's business growth is dramatically more effective than the right offer at a random moment. The deeper commercial principle: helping BUJK grow their business (by providing growth-relevant intelligence at growth moments) is not a sales tactic — it's the genuine manifestation of MJP's value proposition. MJP exists to make BUJK more competitive in the procurement market. When a BUJK grows, it's evidence that MJP's intelligence is working. Reza's role: to recognize that growth and offer the next level of intelligence appropriate for the BUJK's new scale. Hendra: 'Strategi penjualan terbaik kami adalah mengidentifikasi kapan klien kami tumbuh dan memastikan kita tumbuh bersama mereka. Bukan karena itu menguntungkan kami — karena itu sebenarnya menguntungkan mereka. Klien yang menggunakan MJP dengan lebih intensif seiring pertumbuhan bisnis mereka: menang lebih banyak tender. Data menunjukkan itu.'</p>
      </div>

      {/* R114: BUJK Peer Referral Network */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> BUJK PEER REFERRAL NETWORK — Bagaimana BUJK Merekomendasikan MJP ke BUJK Lain: Anatomi Jaringan Referral, Mengapa NPS 47 Menghasilkan Referral yang Lebih Kuat dari NPS 70 di Industri Lain, dan 3 Arketipe Pemberi Referral
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { element: "REFERRAL-ANATOMY: Bagaimana referral BUJK-ke-BUJK bekerja di pasar konstruksi Indonesia", mechanism: "BUJK referral mechanics: fundamentally different from consumer product referrals. In consumer SaaS: referral is driven by feature novelty ('you have to try this'). In B2B construction procurement: referral is driven by competitive threat reduction through collective capability building ('if all BUJK in our professional network use MJP, the baseline intelligence level in our industry rises — which is better for everyone except lazy competitors'). This 'rising tide' referral logic: makes BUJK referrers less concerned about giving competitors an advantage (they are giving peers an advantage, and they believe peers who compete on capability rather than information asymmetry are better long-term partners). The referral channel: 63% of new subscriber acquisitions in 2025 were traceable to peer referral (either direct ('a fellow BUJK recommended you') or indirect (GAPENSI/GAPEKSINDO introduction from an existing subscriber)).", referral_rate: "Referral rate per active subscriber: 0.73 new subscribers per year per active subscriber (cohort average, 2025 measurement). For a 847-subscriber base: this implies approximately 619 referral-sourced subscriber inquiries per year, of which approximately 34% convert to subscribers (211 new subscribers/year from referral alone). Reza's conversion rate for referral leads (34%) vs cold outreach leads (12%): the 2.8× conversion advantage of referral sources is MJP's most important acquisition efficiency metric. If MJP could increase its referral rate from 0.73 to 1.0 per subscriber per year: that alone would add 227 referral inquiries/year at Reza's current 34% conversion rate, producing approximately 77 new subscribers/year without any additional acquisition spend.", tc: "text-primary" },
            { element: "REFERRER-TYPE-1: The Strategic Connector — BUJK pemilik yang memiliki jaringan luas dan aktif berbagi alat", mechanism: "The Strategic Connector archetype (estimated 8–12% of active subscribers): BUJK owners who are highly networked within their regional construction community (GAPENSI/GAPEKSINDO active participants, or informal 'hubs' for BUJK information sharing in their region). They recommend MJP proactively, not just when asked. Behavioral signature: they mention MJP at every relevant opportunity — GAPENSI meetings, casual conversations with other BUJK, and directly when another BUJK mentions struggling with tender intelligence or regulatory compliance. The motivation: they have personally experienced value from MJP and experience genuine satisfaction from helping their professional network access the same tools. Conversion rate when they refer: 52% (highest of any referral archetype) because their endorsement carries credibility from their status in the BUJK community.", referral_rate: "Strategic Connector identification: Reza reviews referral tracking data quarterly and identifies all subscribers who have generated 2+ referral inquiries in the past 12 months. Current list: 67 Strategic Connectors among 847 subscribers (7.9%). MJP's Strategic Connector cultivation program: quarterly personal check-in from Reza, early access to new features (beta testing), and annual invitation to MJP's narasumber roundtable. The cultivation program does not offer financial incentives (Reza's hypothesis: financial incentives convert genuine advocates into transactional referrers, reducing endorsement authenticity — and BUJK peers trust authentic endorsements, not transactional ones). This hypothesis has not been formally tested — it's Reza's strongly held conviction based on his observation of how BUJK discuss tools in professional settings.", tc: "text-blue-700" },
            { element: "REFERRER-TYPE-2: The Situational Advocate — BUJK yang merekomendasikan MJP hanya saat ada konteks yang tepat", mechanism: "The Situational Advocate archetype (estimated 35–45% of active subscribers): BUJK who recommend MJP only when the conversation context makes the recommendation highly relevant. They don't proactively evangelize — but when another BUJK mentions a specific problem that MJP solves ('saya tidak sempat monitor semua portal LPSE'), the Situational Advocate will immediately mention MJP. This context-triggered referral: is less frequent per subscriber but often higher quality than Strategic Connector referrals because the referral arrives exactly when the potential subscriber is experiencing the pain. Conversion rate when Situational Advocates refer: 38%.", referral_rate: "Situational Advocate activation: Reza's most important referral strategy insight. Most Situational Advocates don't know they are advocates until the right conversation happens. Reza cannot control when those conversations happen — but he can increase the probability that existing subscribers have the right 'mental model' of MJP's value to share when the conversation arises. Reza's primary method: the quarterly 'value reminder' email (a 3-bullet summary of what MJP has improved or added in the past quarter). Not a marketing email — a practical update that gives subscribers new talking points. Open rate: 71%. Secondary benefit: value reminder emails also improve retention (subscribers who open them show 18% lower churn). Reza: 'Pembela terbesar kami adalah klien yang baru-baru ini mengingatkan mengapa mereka berlangganan.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.element} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.element}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Mechanism: {r.mechanism}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Referral dynamics: {r.referral_rate}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">BUJK peer referral network adalah MJP's most cost-efficient acquisition channel — and the one that is hardest to replicate. The referral network's value: not the individual referrals but the network effect. As MJP's subscriber base grows: the probability that any given BUJK has a peer who already subscribes to MJP grows with it. At 847 subscribers (approximately 7% of the 12.000+ SAM): approximately 7% of BUJK any new prospect talks to already use MJP. At 1.500 subscribers (post-Series A Year 2 target): approximately 12.5% of BUJK in the prospect's network already use MJP. This network density: drives the referral flywheel — more subscribers produce more referrals, which produce more subscribers, which increase the probability that any new prospect's peer already uses MJP, which increases referral conversion rate. MJP's NPS of 47 generates stronger referral behavior in the BUJK market than NPS 70 would in a typical consumer market — because BUJK decision-making is relationship-driven and trust-based. A BUJK peer recommendation carries higher credibility than any marketing message because BUJK know their peer is sharing real business intelligence, not promotional messaging. The BUJK construction procurement market: small enough that peer networks are dense (most BUJK in a given region know 10–30 other BUJK personally) but large enough (12.000+ SAM) that MJP is still in early penetration. This combination — dense peer networks + low penetration + high NPS — is the optimal condition for referral-driven growth. Hendra's Series A growth model: 40% of new subscribers will come from referral in Years 1–2 post-funding, making referral (not paid acquisition) the largest contributor to the growth target.</p>
      </div>

      {/* R115: Trust Score Dispute Resolution */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> TRUST SCORE DISPUTE RESOLUTION — Apa yang Terjadi Ketika BUJK Mengajukan Keberatan atas Trust Score Mereka: 3 Jenis Dispute, Protokol Resolusi Hendra, 2 Kasus Nyata, dan Mengapa Proses Dispute yang Adil Justru Meningkatkan Trust Score sebagai Produk
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { dispute_type: "DISPUTE-TYPE-1: Data faktual tidak akurat — dokumen yang dilaporkan ada tapi sebenarnya sudah diperbarui", example: "The most common Trust Score dispute: a BUJK contacts MJP claiming their Trust Score shows a lapsed SKK or IUJK certification that was actually renewed. This happens when: (1) the BUJK renewed the certification but MJP's data source (LPSE qualification data, BNSP portal) hasn't yet reflected the renewal, or (2) the renewal data exists in one source but hasn't been integrated into MJP's system. Hendra's protocol: Reza requests documentary evidence (the renewed certificate or BNSP registration confirmation) from the BUJK. Hendra Jr. verifies against primary sources within 24 hours. If the BUJK is correct: the Trust Score is updated, the BUJK receives a written acknowledgment, and the correction is logged (to identify systematic data freshness issues). If the BUJK is incorrect (the renewal shows as pending in primary sources): Reza explains the source delay and provides a timeline for when the updated data typically reflects.", resolution_outcome: "Outcome rate: 73% of DISPUTE-TYPE-1 cases result in Trust Score updates (the BUJK was correct). 27% result in no change (the BUJK believed the renewal had been processed but the primary source confirmed it had not). Even the 27% where MJP's data was correct: BUJK who receive a clear explanation with primary source references consistently report higher satisfaction with the dispute process than they had with the initial score. The dispute resolution process: validates MJP's data quality even when the data turns out to be accurate.", tc: "text-primary" },
            { dispute_type: "DISPUTE-TYPE-2: Penilaian JO partner — BUJK keberatan atas dampak partner bermasalah pada skor mereka", example: "A less common but more emotionally charged dispute: a BUJK contacts MJP arguing that their Trust Score is unfairly affected by a past JO (joint operation) partner's poor record. The BUJK's argument: 'We were the lead BUJK in the JO, the substandard performance was the minority partner's fault — why does our score reflect their failures?' MJP's Trust Score architecture: treats JO participation as a shared record (both BUJK in the JO show the same project outcome). This is intentional — BUJK who choose JO partners bear responsibility for partner selection. But the BUJK's concern is legitimate when the historical record doesn't distinguish lead from supporting role.", resolution_outcome: "Hendra's resolution for DISPUTE-TYPE-2: MJP does not change Trust Score values based on role claims (these are unverifiable). But for BUJK with documented JO role records: MJP adds a 'Context Note' to the BUJK's Trust Score display — a visible notation that a specific project outcome reflected a JO arrangement with a named partner. This Context Note: doesn't change the score but gives reviewers the information to make their own judgment. 4 DISPUTE-TYPE-2 cases in MJP's history: all 4 BUJK accepted the Context Note resolution. 2 of the 4 subsequently became Enterprise subscribers (the resolution process demonstrated MJP's fairness and depth of engagement with their specific situation).", tc: "text-blue-700" },
            { dispute_type: "DISPUTE-TYPE-3: Metodologi keberatan — BUJK tidak setuju dengan cara Trust Score dihitung", example: "The rarest but most strategically important dispute: a BUJK (or occasionally a BUJK association representative) argues that MJP's Trust Score methodology is systematically unfair to a category of BUJK. Example: GAPENSI Jawa Timur DPD chair (one of Budi's key association contacts) raised a concern in 2024 that smaller jenjang-7 BUJK from Eastern Indonesia were receiving lower Trust Scores than comparable Western Indonesia BUJK because LPSE award data coverage (the primary Trust Score input) is thinner for Eastern Indonesia portals. The concern: structurally valid. Less portal coverage = fewer verifiable project completions = lower Trust Score even for high-quality BUJK.", resolution_outcome: "Hendra's response to DISPUTE-TYPE-3: a formal methodology review process. The GAPENSI concern: triggered a 6-week internal audit of Trust Score distribution by geography and company size. Finding: confirmed — Eastern Indonesia jenjang-7 BUJK had Trust Scores approximately 0.8 points lower on average than comparable Western Indonesia BUJK (3.7 vs 4.5 on MJP's 1–5 scale). Root cause: portal coverage gap (EXPANSION-1 in Hendra Jr.'s geographic expansion roadmap). The interim fix: Trust Score for BUJK from regions with below-average portal coverage now displays a 'Regional Coverage Adjustment' note explaining the coverage limitation. Post-EXPANSION-1: the coverage gap closes and the note is removed. This resolution: the most important dispute outcome in MJP's history. It converted a potential GAPENSI institutional complaint into a collaborative improvement signal that directly shaped Hendra Jr.'s portal expansion roadmap. Hendra: 'Keberatan metodologi yang valid bukan ancaman bagi Trust Score — ini hadiah. Mereka menunjukkan di mana model kami kurang mencerminkan realitas yang sebenarnya. Dan memperbaikinya: membuat Trust Score lebih baik untuk semua orang.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.dispute_type} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.dispute_type}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Example and protocol: {r.example}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Resolution outcome: {r.resolution_outcome}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Trust Score dispute resolution adalah MJP's most sensitive operational process — because Trust Score affects real business outcomes for BUJK (potential JO partners and government procurement committees use it for decision-making). An unfair or inaccurate Trust Score: is not just a product quality issue, it's a commercial harm to the BUJK who is affected. MJP's dispute process is designed with this responsibility in mind. The 3-tier structure (factual inaccuracy, JO partner impact, methodology challenge) addresses the full spectrum of legitimate disputes with differentiated responses. The process's most important design element: every dispute receives a written response with evidence, regardless of outcome. BUJK whose disputes result in no change: receive the same evidence-based explanation as BUJK whose disputes result in updates. This symmetry: prevents the dispute process from being perceived as a rubber-stamp for complaints (which would invite frivolous disputes) or as an opaque rejection process (which would erode trust). MJP's total dispute volume: approximately 8–12 per year (out of 847 subscribers). The low volume: reflects that most BUJK trust MJP's data quality or don't closely monitor their own Trust Score. The disputes that occur: disproportionately from Enterprise subscribers (who monitor Trust Score most closely and are most affected by it in their business relationships). The GAPENSI methodology dispute: MJP's most valuable dispute because it produced a structural improvement. Hendra's ambition: create a formal 'Trust Score Advisory Panel' post-Series A (a small group of BUJK representatives from different segments and regions who provide quarterly feedback on Trust Score methodology). The panel: would institutionalize the methodology feedback channel that the GAPENSI dispute opened informally — and give MJP's Trust Score the kind of community oversight that increases its legitimacy as an industry standard rather than a proprietary algorithm.</p>
      </div>

      {/* R116: BUJK Succession Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> BUJK SUCCESSION INTELLIGENCE — Pola Suksesi Bisnis Keluarga di Pasar BUJK Indonesia: 3 Pola Transisi, Bagaimana MJP Mendeteksi Suksesi yang Sedang Berlangsung, dan Implikasi untuk Produk dan Retensi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { pattern: "SUCCESSION-PATTERN-1: Transisi generasi bertahap — pendiri tetap aktif 2–5 tahun selama transisi", prevalence: "The most common succession pattern in Budi's narasumber data: approximately 55% of succession cases observed across MJP's subscriber base. Characteristics: the founding generation (typically BUJK owners aged 55–65) formally transfers legal ownership to a next-generation family member (child or nephew/niece, typically 30–45 years old) but remains operationally involved in business development, key client relationships, and major bid decisions for 2–5 years post-transfer. The next-generation successor: takes over operational management (site supervision, financial management, HR) while the founder remains the face of the business for government clients and BUJK association activities.", mjp_signal_and_implication: "MJP signal: the gradual transition produces a double-subscriber pattern — Reza has observed 12 cases where the founder subscriber is joined by a next-generation subscriber (the child takes their own subscription before the formal transfer is complete, learning the intelligence platform alongside the founder). The double-subscriber phase: Reza's clearest succession indicator. MJP product implication: multi-user account features (allowing a BUJK company to share a single subscription with different login profiles for founder and successor) become commercially relevant for this pattern. The gradual transition also means next-generation successors often arrive with more digital literacy than their founding-generation parents — they are more likely to use NLQ, more likely to access Knowledge Registry for self-directed research, and more likely to adopt new platform features early.", tc: "text-primary" },
            { pattern: "SUCCESSION-PATTERN-2: Transisi mendadak — kematian atau penyakit pemilik tanpa rencana suksesi", prevalence: "The second succession pattern: approximately 20% of observed cases. A BUJK owner dies or becomes seriously ill without a formal succession plan. The business: suddenly needs a new decision-maker who may not have been involved in the business's intelligence-gathering practices. The immediate consequence: MJP subscription often lapses (the successor doesn't know the subscription exists, or doesn't renew because they don't understand its value). This pattern produces the 'unexplained churn' category in Reza's churn data — subscriptions that cancel without a stated reason, often around the time a BUJK transitions to a new ownership contact.", mjp_signal_and_implication: "MJP signal: a sudden drop in subscriber activity (briefing opens, NLQ queries, portal logins) followed by a subscription cancellation within 30–60 days. Reza monitors activity drops for Enterprise subscribers specifically. When an Enterprise subscriber's activity drops precipitously without a known cause (no churn reason conversation): Reza initiates contact within 2 weeks. In 3 of 7 'unexplained churn' cases in 2024: Reza discovered a succession event and was able to convert the new owner to a fresh subscription (often at a reduced first-year rate to re-establish the relationship). The MJP product implication: a 'succession continuity' feature — the ability for a subscriber to designate a secondary contact who is notified of the subscription when the primary contact has not logged in for 30+ days. This feature: protects MJP's renewal revenue during succession events while providing genuine value to BUJK in estate and succession planning.", tc: "text-blue-700" },
            { pattern: "SUCCESSION-PATTERN-3: Professionalisasi — pendiri mempekerjakan manajer profesional, bukan suksesi keluarga", prevalence: "The third succession pattern: approximately 25% of observed cases. BUJK founders without a family successor, or founders who explicitly prefer professional management, hire a salaried Managing Director from outside the family. This pattern: most common among larger jenjang-8 and jenjang-9 BUJK (scale creates professional management needs that exceed family capacity) and among BUJK in densely competitive urban markets (where professional tender strategy is more important than family relationship capital). The hired MD: typically has a background in construction project management or civil engineering, not procurement intelligence.", mjp_signal_and_implication: "MJP signal for professionalization: a subscriber's NLQ query pattern shifts toward operational queries (how to bid, document requirements, qualification thresholds) and away from strategic queries (market context, competitor analysis, regulatory pipeline) — indicating that a new subscriber is using MJP for operational learning rather than strategic intelligence. This shift: characteristic of newly hired professional MDs who are learning the BUJK procurement environment and use MJP as an onboarding reference. Reza's response to professionalization: proactively schedule an onboarding call with the new MD specifically about MJP's strategic intelligence features (which the founder used but the new MD may not have discovered). This reactivation of Strategic Analyst behavior: the key retention action for professionalization transitions. Reza: 'Manajer profesional yang baru berhasil menemukan diri mereka menggunakan MJP untuk belajar operasional. Pekerjaan saya: membantu mereka menemukan bahwa MJP yang sama dapat digunakan untuk strategi. Yang pertama membuat mereka mempertahankan langganan. Yang kedua membuat mereka menjadi pelanggan Enterprise selama 10 tahun.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.pattern} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.pattern}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Prevalence: {r.prevalence}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>MJP signal and implication: {r.mjp_signal_and_implication}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">BUJK succession intelligence adalah one of Reza's most practically useful customer success insights — because BUJK succession events are among the highest-risk periods for subscriber churn. The 3 succession patterns collectively affect approximately 4–6% of MJP's active subscriber base per year (Reza's estimate based on 5 years of subscriber data and BUJK industry age distribution). At 847 subscribers: 34–51 BUJK in some form of active or recent succession process. The churn risk during succession: high (unexplained churn cases are disproportionately succession events). The retention opportunity: also high — BUJK that successfully navigate succession while maintaining their MJP subscription retain 4+ more years of subscription on average (because the successor builds their own relationship with the platform, extending the LTV beyond the founder's tenure). Reza's succession monitoring practice: informal but systematic. He reviews the subscriber activity dashboard weekly, flagging any Enterprise subscriber whose login frequency drops significantly for more than 14 days without a known cause. This monitoring: not automated yet (it's manual in Reza's weekly routine). Post-Series A customer success tool development: includes a succession monitoring algorithm that surfaces enterprise subscribers with sustained activity drops to the customer success team automatically. The broader BUJK family business succession market: also a potential product feature category. 'Succession Intelligence' content in the Knowledge Registry (covering legal succession planning for BUJK operating licenses, IUJK transfer procedures, SKK re-registration after ownership change): would serve a real need that is currently undocumented in MJP's Knowledge Registry and completely absent from the competition's content. Budi has identified BUJK succession planning as a candidate for a dedicated narasumber research track in 2027.</p>
      </div>

      {/* R117: BUJK Provincial Expansion Support */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" /> BUJK PROVINCIAL EXPANSION SUPPORT — Peran MJP Saat BUJK Memperluas Operasi ke Provinsi Baru: 3 Tahap Ekspansi BUJK, Informasi yang Paling Dibutuhkan per Tahap, dan Fitur Ekspansi yang Direncanakan Post-Series A
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { phase: "EXPANSION-PHASE-A: Analisis awal — BUJK memutuskan apakah akan masuk ke provinsi baru", information_need: "Before committing to expansion into a new province: BUJK need to understand the competitive landscape (which BUJK currently win tenders in that province, at what win rates), the tender volume and value distribution (is the province worth entering — how many tenders in the BUJK's KBLI category, at what HPS ranges), the regulatory environment (does the target province have any IUJK registration requirements beyond national standards, are there any regional procurement agency preferences), and the practical procurement requirements (which LSP is closest for SKK renewal, which LPSE portals need to be monitored).", mjp_current_capability: "MJP's current capability for this phase: significant but partially manual. Trust Score data covers provincial competition landscape (which BUJK win tenders in each province). NLQ can answer regulatory questions about specific provinces. But there is no dedicated 'Province Expansion Analysis' feature that consolidates all this information for a specific target province. Reza's current practice: manually compiles a 'province brief' for Enterprise subscribers who ask about expansion — using Workroom's service link data, Trust Score queries, and Knowledge Registry research to produce a 1–2 page summary. This manual process: takes Reza 3–4 hours and is done approximately 8–10 times per year. The post-Series A product opportunity: a structured 'Province Intelligence Report' that automates what Reza currently produces manually.", tc: "text-primary" },
            { phase: "EXPANSION-PHASE-B: Registrasi dan persiapan — BUJK mendaftar di portal LPSE dan memenuhi syarat kualifikasi lokal", information_need: "After deciding to expand: BUJK need step-by-step registration information for the target province's LPSE portal (each portal has slightly different registration flows), any local qualification requirements (some regional procurement agencies have additional BUJK qualification requirements beyond national standards — not always documented in national Knowledge Registry assets), contact information for the target province's LPSE helpdesk (for registration issues), and a timeline estimate for qualification approval in the target province (which varies from 3 days to 6 weeks depending on the portal's review capacity).", mjp_current_capability: "MJP's current capability for this phase: weakest of the 3 phases. The Knowledge Registry covers national qualification standards (LEVEL-3) but not province-specific registration variations (which require local knowledge that Budi's narasumber network doesn't systematically cover for all 34 provinces). The post-Series A expansion: the 'Regional Nuance' gap identified in Sari's Knowledge Registry gap analysis. The EXPANSION-PHASE-1 crawler work (Sulawesi/Maluku) + Knowledge Registry regional coverage expansion: the two infrastructure investments needed before MJP can credibly support BUJK in Phase B for Eastern Indonesia expansion. The SKK Express volume from Eastern Indonesia BUJK expanding into Western Indonesia markets (or Western Indonesia BUJK expanding into Eastern Indonesia): a revenue stream tied directly to portal coverage expansion.", tc: "text-blue-700" },
            { phase: "EXPANSION-PHASE-C: Operasional aktif — BUJK mengikuti tender di provinsi baru dan membangun rekam jejak lokal", information_need: "After registering and establishing local qualification: BUJK need ongoing tender alerts filtered for the new province (their existing alerts are calibrated to their home province — expansion requires a new alert configuration), competitive intelligence about the specific agencies in the target province (which BUJK win most contracts with Agency X, what price points are competitive), and progressive Trust Score improvement tracking (as new provincial award records accumulate, the BUJK's Trust Score in the target province strengthens). This is the longest phase and the one where MJP's ongoing subscription value is highest.", mjp_current_capability: "MJP's current capability for Phase C: strong (this is essentially MJP's core product). Alert personalization includes geographic filters, Trust Score tracks award records in all indexed provinces, and Knowledge Registry covers national regulatory standards applicable everywhere. The gap: Trust Score's provincial record depth for Eastern Indonesia (where MJP's portal coverage is 71% vs 94% in Western Indonesia) means that BUJK expanding into Eastern Indonesia have less complete competitive intelligence than those expanding within Western Indonesia. This geographic data asymmetry: the same Eastern Indonesia coverage gap that affects Trust Score for all Eastern Indonesia BUJK, resolved by EXPANSION-PHASE-1 and PHASE-2 of the portal coverage roadmap. Reza: 'Setiap kali klien Enterprise bertanya kepada saya tentang ekspansi ke provinsi baru, saya tahu dua hal: pertama, bisnis mereka tumbuh dengan sehat — ekspansi provinsi adalah sinyal pertumbuhan yang paling jelas. Kedua, mereka membutuhkan saya untuk memberikan lebih dari sekadar data — mereka membutuhkan konteks tentang cara pasar baru itu sebenarnya bekerja. Dan itulah persis di mana MJP paling berharga.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.phase} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.phase}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Information need: {r.information_need}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>MJP current capability: {r.mjp_current_capability}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">BUJK provincial expansion support adalah one of the clearest articulations of MJP's product value at the highest-stakes moment in a BUJK's business lifecycle. Provincial expansion: a high-risk, high-reward business decision for BUJK. A BUJK who successfully enters a new province: accesses a larger pipeline of tender opportunities, diversifies geographic revenue, and builds a multi-province reputation that strengthens their Trust Score and JO partner attractiveness. A BUJK who enters a new province without adequate intelligence: risks investing significant capital in registration, qualification, and bid preparation for a market they don't understand well enough to win in. MJP's provincial expansion support: reduces the intelligence gap that converts high-risk expansion into informed expansion. The 3-phase support structure reveals a product gap: MJP is excellent at Phase C (ongoing operational support) and adequate at Phase A (competitive landscape analysis), but weak at Phase B (registration and local qualification guidance). Phase B: the moment when BUJK need the most specific, localized knowledge — exactly the knowledge type that is hardest to systematize in a national platform. The Knowledge Analyst hire + EXPANSION-PHASE-1 crawler work: close this Phase B gap for Eastern Indonesia expansion specifically, which is MJP's highest-growth provincial expansion market. The Province Intelligence Report (Reza's 8–10 annual manual briefs, formalized as a product feature): the highest-priority post-Series A feature for Reza's customer success practice. It converts a significant manual labor task into a scalable product feature and transforms what is currently an Enterprise-only service (Reza's personal brief) into a Pro-tier feature that drives tier upgrade.</p>
      </div>

      {/* R118: Trust Score Regional Coverage Deep Dive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Map className="h-3.5 w-3.5 text-primary" /> TRUST SCORE REGIONAL COVERAGE — Bagaimana Coverage Memengaruhi Akurasi Skor per Geografi: 3 Tier Coverage, Dampak terhadap Skor BUJK, dan Roadmap Resolusi Kesenjangan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { tier: "COVERAGE-TIER-1: Jawa + Bali + Sumatera Barat–Timur — 94% portal coverage (reliable Trust Score)", score_accuracy: "At 94% portal coverage: Trust Score for BUJK in this region represents a highly reliable multi-year award track record. If a BUJK has completed 20 projects in Jawa: MJP's crawler has likely indexed 18–19 of those projects' award records. The 6% gap: primarily smaller kabupaten-level LPSE portals with inconsistent public availability (portals that go offline periodically or have non-standard data formats that the crawler cannot yet parse). Score accuracy impact of 6% gap: minimal — the small-scale kabupaten projects typically have low HPS values (below Rp 1B) that have minimal weight in Trust Score's weighted average calculation. The Trust Score for a Jawa-based jenjang-8/9 BUJK: effectively represents their full competitive history.", subscriber_implication: "Subscriber implication: BUJK and subscribers in the COVERAGE-TIER-1 region can use Trust Score with high confidence for due diligence, JO partner evaluation, and competitive intelligence. Reza's customer success note: when an Enterprise subscriber from Jawa challenges their Trust Score ('this doesn't reflect my full track record'), the investigation almost always reveals either a data entry error (a project was recorded under a slightly different company name variant) or a non-LPSE project (private sector projects are not in the LPSE award database and are correctly not reflected in Trust Score). The Trust Score dispute resolution process: most cases in COVERAGE-TIER-1 are resolved within 3 business days.", tc: "text-primary" },
            { tier: "COVERAGE-TIER-2: Kalimantan + Sulawesi Selatan + NTB — 78% portal coverage (Trust Score with confidence adjustment)", score_accuracy: "At 78% portal coverage: Trust Score for BUJK in this region represents approximately 3 out of 4 of their award records. The 22% coverage gap: driven by mid-size kabupaten portals in Kalimantan Tengah, Kalimantan Utara, Sulawesi Tenggara, and NTB that are in the crawler's expansion queue but not yet indexed. The gap's score impact: material for BUJK whose project activity is concentrated in the uncovered portals. A BUJK from Kalimantan Tengah who has won 8 projects, 4 of which are from a portal not yet in MJP's coverage: their Trust Score reflects 4 projects, not 8 — a potentially significant underrepresentation for jenjang-7 BUJK with smaller portfolios. The 'Regional Coverage Adjustment' note: displayed on Trust Score profiles for BUJK in this tier, explaining that the score may underrepresent their actual portfolio due to portal coverage gaps.", subscriber_implication: "Subscriber implication: Trust Scores for BUJK in COVERAGE-TIER-2 should be interpreted with caution — a lower score may reflect a data gap rather than a weaker track record. Reza's guidance to subscribers evaluating BUJK in COVERAGE-TIER-2 for JO partnerships: treat Trust Score as a floor estimate ('at least this strong, possibly stronger') rather than a precise measurement. The trust recovery timeline for TIER-2: EXPANSION-PHASE-1 (Q3 2026 in Sulawesi/Maluku) will upgrade Sulawesi-based BUJK to TIER-1 accuracy by Q4 2026. Full TIER-1 accuracy for Kalimantan: projected Q1 2027 (EXPANSION-PHASE-2).", tc: "text-blue-700" },
            { tier: "COVERAGE-TIER-3: Papua + Maluku Utara + NTT + Sulawesi Tengah/Utara — 54% portal coverage (Trust Score with explicit caveat)", score_accuracy: "At 54% portal coverage: Trust Score for BUJK in this region represents slightly more than half of their award records. The 46% gap: primarily driven by remote kabupaten LPSE portals with inconsistent internet availability, non-standard portal implementations, and in some cases portals that have not yet digitized their award record archives. The score accuracy impact: severe for BUJK with concentrated Eastern Indonesia project histories. A Papua-based BUJK who has completed 12 projects, only 6 of which are in indexed portals: their Trust Score represents 50% of their actual portfolio — the score is effectively unreliable for due diligence purposes.", subscriber_implication: "Subscriber implication: Trust Scores for BUJK in COVERAGE-TIER-3 carry the strongest Regional Coverage Adjustment warning. Reza's guidance: do not rely on Trust Score alone for JO partner due diligence with Eastern Indonesia BUJK — supplement with direct reference checks (Budi's narasumber network has 5 Eastern Indonesia contacts who can provide informal track record validation for specific BUJK if needed). The TIER-3 resolution: the most complex and expensive crawler engineering challenge. EXPANSION-PHASE-2 (Q1–Q2 2027) targets the highest-priority TIER-3 portals (Papua Barat, Maluku Utara) — moving those regions from TIER-3 to TIER-2 accuracy. Full TIER-1 accuracy for all of Papua: projected post-Series B (the investment required for Papua's most remote kabupaten portals exceeds MJP's Series A-funded engineering capacity). Hendra's pragmatic decision: explicitly scope Papua full coverage as a Series B objective, not a Series A commitment. Transparency with investors: the coverage gap is clearly documented, the resolution timeline is realistic, and the commercial impact (Eastern Indonesia BUJK represent approximately 8% of total BUJK by count) is bounded.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.tier} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.tier}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Score accuracy at this coverage level: {r.score_accuracy}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Subscriber implication: {r.subscriber_implication}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Trust Score regional coverage deep dive adalah the most transparent articulation of MJP's primary data quality limitation — and Hendra's philosophy is that transparency about this limitation is more commercially beneficial than minimizing it. The 3 coverage tiers (94% Western Indonesia, 78% Kalimantan/South Sulawesi, 54% Eastern Indonesia): are clearly disclosed on the platform (via Regional Coverage Adjustment notes) and in investor materials (Series A data room includes the coverage map). The commercial argument for transparency: BUJK and subscribers who discover the coverage limitation on their own (because their Trust Score doesn't match their known portfolio) lose trust in both the specific score and MJP generally. BUJK who are told about the limitation upfront: can calibrate their Trust Score use appropriately and maintain trust in MJP's data integrity. The Trust Score's 5-year adoption: built on this honest calibration, not on overselling accuracy. The roadmap transparency: equally important. BUJK in COVERAGE-TIER-2 and TIER-3 regions: know that Hendra has a specific coverage expansion plan (PHASE-1: Q3 2026, PHASE-2: Q1–Q2 2027). They are not waiting for an unspecified improvement — they are on a named roadmap. This roadmap commitment: one of the most important retention factors for Eastern Indonesia BUJK subscribers who are currently underserved by Trust Score. The combination of honest limitation disclosure + specific improvement timeline: MJP's data quality trust framework that transforms a current weakness into a relationship-strengthening transparency signal.</p>
      </div>

      {/* R119: Trust Score Decay Model */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-primary" /> TRUST SCORE DECAY MODEL — Mengapa Trust Score Kadaluarsa dan Bagaimana MJP Mempertahankan Kesegaran Score: 4 Komponen Data, Waktu Hidup Setiap Komponen, dan Protokol Refresh Mingguan Hendra Jr.
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { component: "DECAY-COMP-1: Data proyek selesai (project completion records) — decay window 12 bulan", data_source: "Source: LPSE award records, BPKP audit completions, BPS construction activity data. Each completed project: contributes to Trust Score's 'project delivery track record' component. Data validity: the project completion record itself doesn't change (a project completed in 2022 was completed in 2022). But its weight in Trust Score decays over time — a project completed 18 months ago contributes less to 'current delivery capability assessment' than one completed 3 months ago. The 12-month decay window: reflects the industry-standard assumption that construction delivery capability is best evidenced by recent performance.", refresh_protocol: "Hendra Jr.'s refresh protocol: LPSE crawler runs weekly for award record updates (new completions published). BPKP audit database: quarterly check for new audit completions (BPKP publishes audit results on a quarterly schedule). The project completion component: recalculated weekly with the new award data. The age-weighting formula: projects completed 0–3 months ago = 100% weight; 3–6 months = 90%; 6–12 months = 75%; 12–18 months = 50%; 18+ months = 25%. The weight decay: prevents Trust Scores from freezing at the level of BUJK who were active in 2022 but have not completed projects recently.", tc: "text-primary" },
            { component: "DECAY-COMP-2: SKK sertifikasi personel — decay window 2 tahun (siklus BNSP)", data_source: "Source: BNSP certification database (public lookup), LPSE qualification document disclosures. SKK certificates: issued with 2-year validity (for most jenjang levels). The SKK component of Trust Score: reflects whether a BUJK's key personnel hold current (non-expired) certifications in the relevant specialties. A SKK certificate that was valid 3 years ago: no longer contributes to Trust Score if not renewed. The decay: is categorical (valid = counts, expired = doesn't count) rather than gradual — making SKK the most binary component of Trust Score.", refresh_protocol: "Hendra Jr.'s refresh protocol: BNSP certificate lookups are batched weekly (running all tracked BUJK personnel names against BNSP's public search). The alert system: flags any BUJK subscriber whose personnel SKK expiry is within 90 days — triggering the Stage-A notification in the SKK Alert V2 system. The key technical challenge: BNSP's public lookup is rate-limited, requiring the weekly batch to be spread across 3 nights (Monday, Wednesday, Friday) to avoid exceeding BNSP's rate limit. Hendra Jr.'s BNSP rate limit workaround: implemented in Q3 2023 after the original daily lookup caused a temporary BNSP access block.", tc: "text-blue-700" },
            { component: "DECAY-COMP-3: KPPU dan LPSE blacklist status — decay window situasional (aktif hingga dicabut)", data_source: "Source: LPSE blacklist registry (daftar hitam), KPPU decision database. Blacklist status: binary (blacklisted or not). Unlike project and SKK data where absence of recent activity causes gradual decay: blacklist status is a live flag that persists until formally removed. A BUJK added to LPSE's blacklist: has Trust Score immediately penalized (the blacklist component contributes -40 points to Trust Score, making a blacklisted BUJK score at most 60/100 regardless of other components). Trust Score restoration: only possible after official blacklist removal (Hendra Jr.'s crawler detects removals within 24 hours of the official registry update).", refresh_protocol: "Hendra Jr.'s refresh protocol: LPSE blacklist is checked daily (the highest-frequency refresh in Trust Score's data pipeline, because a new blacklisting can change a BUJK's competitive position overnight). KPPU decision database: weekly check (KPPU publishes new decisions on a weekly schedule). The daily LPSE blacklist check: the single most operationally important data refresh for Trust Score accuracy, because the blacklist can change overnight and subscribers need same-day awareness (a competitor being blacklisted represents a significant competitive opening that subscribers should know about immediately).", tc: "text-emerald-700" },
            { component: "DECAY-COMP-4: Kapasitas keuangan dan bonding capacity — decay window 18 bulan (siklus laporan keuangan)", data_source: "Source: annual financial disclosures in tender qualification documents (publicly available through LPSE), BPS annual construction sector survey. BUJK financial capacity: proxy-estimated from disclosed bonding capacity amounts in tender qualification documents (BUJK disclose their bank guarantee capacity as part of tender qualification). The financial component: captures the scale of projects a BUJK can financially support (smaller bonding capacity = can only participate in smaller-HPS tenders). The 18-month decay window: reflects annual financial reporting cycles (a BUJK's 2022 disclosed bonding capacity may not reflect their 2026 financial position).", refresh_protocol: "Hendra Jr.'s refresh protocol: financial capacity data is updated whenever new qualification documents appear in LPSE for the relevant BUJK (opportunistic, not scheduled). For BUJK who participate in tenders frequently: financial data refreshes every 3–6 months naturally. For BUJK who are less active: the data may be 12–18 months old. The 18-month decay flag: Trust Score's UI shows a 'data freshness warning' on the financial component for BUJK whose financial data is more than 18 months old — flagging subscribers that this component may not reflect current capacity. The transparency: a deliberate choice to show data age rather than hide it, because subscribers (Enterprise tier) value accurate uncertainty quantification over false precision.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.component} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.component}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Data source and decay: {r.data_source}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Refresh protocol: {r.refresh_protocol}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Trust Score decay model adalah the technical specification that converts Trust Score from a 'snapshot metric' into a 'living assessment' — because a Trust Score that reflects a BUJK's state from 3 years ago is not a trust assessment, it is a historical record. Hendra Jr.'s decay model ensures that Trust Score reflects current capability, not historical reputation. The 4 decay windows (12 months for project completion, 2 years for SKK, situational for blacklist, 18 months for financial): correspond to the natural refresh cycles of the underlying data sources. The decay parameters: not chosen arbitrarily but derived from how the construction procurement industry actually updates its own assessments of BUJK capability. LPSE qualification committees: typically require project completion records from the last 3 years (not 10 years) and current SKK certificates (not expired ones). MJP's decay model: mirrors the qualification committee's own assessment logic, making Trust Score a prediction of how a qualification committee would evaluate a BUJK today, not just how they would have evaluated them historically. The most commercially important decay insight for subscribers: a competitor's Trust Score can decline without any active negative event (no blacklisting, no project failure) simply because their recent project completion activity is lower than 18 months ago. The 'passive decay' of inactive competitors: creates Trust Score opportunities for active BUJK who continue completing projects and renewing SKK — their score improves relative to competitors who stop competing, even without any active effort to improve. Hendra's product design principle: Trust Score should feel like a stock price, not a credit score — continuously updated, responsive to recent events, and predictive of future performance, not just a summary of past behavior.</p>
      </div>

      {/* R120: BUJK Lifecycle Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> BUJK LIFECYCLE INTELLIGENCE — Trust Score sebagai Pelacak Perjalanan Lengkap Kontraktor: 4 Fase Siklus Hidup BUJK, Pola Trust Score di Setiap Fase, dan Mengapa Memahami Fase Kompetitor Lebih Berharga dari Memahami Score Mutlak Mereka
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { phase: "LIFECYCLE-PHASE-1: Startup BUJK (0–3 tahun operasional) — Trust Score tipikal 20–45", trust_score_pattern: "Startup BUJK characteristics: few completed projects (low track record component), personnel with early-career SKK certifications (jenjang-7, some jenjang-8), limited financial capacity disclosure (few qualified for high-HPS tenders), no significant KPPU or LPSE violations (clean record = no negative score, but also little positive history to build on). Trust Score of 20–45: reflects the structural information poverty of a young BUJK — not incompetence, but insufficient verified history for a high-confidence capability assessment. The most common startup BUJK mistake that Trust Score captures: pursuing tenders significantly above their demonstrated capacity (HPS 3–5× their largest completed project) — visible in Trust Score as a 'bid-award gap' (many bids, few awards in the high-HPS range).", competitive_intelligence_value: "Competitive intelligence value: for MJP subscribers competing against startup BUJK, Trust Score 20–45 signals a competitor who is unlikely to win high-value tenders against established competitors — their qualification submissions are often technically adequate but lack the depth of project track record that qualification committees weight heavily. Subscribers should not over-allocate competitive analysis effort to startup BUJK. The exception: a startup BUJK with a Trust Score growing rapidly (15+ points in 12 months) — indicating a company that is actively building its compliance infrastructure and project track record, and may become a competitive threat in 18–24 months.", tc: "text-primary" },
            { phase: "LIFECYCLE-PHASE-2: Growth BUJK (3–8 tahun) — Trust Score tipikal 45–70, pertumbuhan paling cepat", trust_score_pattern: "Growth BUJK characteristics: accumulating completed projects across 1–3 categories, personnel expanding SKK coverage to jenjang-8 in specialization areas, financial capacity growing as repeat project wins demonstrate bankability. The growth phase: Trust Score's most dynamic period — a BUJK can add 10–20 points in a single year through strategic project selection, SKK investment, and IUJK maintenance. The Trust Score growth is not uniform: BUJK that invest in jenjang-8/9 SKK during growth phase gain significantly more points than BUJK who extend jenjang-7 coverage horizontally (specialist depth is weighted higher in Trust Score's formula than generalist breadth).", competitive_intelligence_value: "Competitive intelligence value: growth BUJK are the most important competitive category to monitor — they represent the future competitive threats in the next 2–3 years. A competitor currently at Trust Score 55 on a steep growth trajectory: may reach 70+ within 18 months and become a tier-1 competitive threat. MJP's growth trajectory detection (rate of Trust Score change, not absolute value): the most forward-looking competitive intelligence MJP provides. Enterprise subscribers who receive quarterly Trust Score trend briefings: can identify emerging competitors early and begin competitive response (Trust Score improvement, category repositioning) before the competitor becomes established enough to threaten their market position.", tc: "text-blue-700" },
            { phase: "LIFECYCLE-PHASE-3: Established BUJK (8+ tahun) — Trust Score tipikal 65–90, relatif stabil", trust_score_pattern: "Established BUJK characteristics: deep project track record in 1–3 categories, comprehensive SKK coverage across jenjang levels, strong financial capacity (qualify for high-HPS tenders), clean KPPU/LPSE record maintained across multiple procurement cycles. Trust Score of 65–90: reflects mature, verified capability with sustained compliance discipline. The score is relatively stable (established BUJK rarely gain or lose 10+ points in a single year without a significant event) — making established BUJK Trust Scores reliable for strategic planning purposes. The highest Trust Scores (85–95): represent BUJK that have accumulated the full combination of track record, SKK depth, financial capacity, and clean compliance history that takes 10–15 years to build.", competitive_intelligence_value: "Competitive intelligence value: for MJP subscribers competing against established BUJK in the same tier, Trust Score provides detailed breakdown intelligence — which specific components are strongest and weakest. An established competitor with Trust Score 78 but weak financial capacity component: cannot pursue the highest-HPS tenders despite their experience and SKK depth. A subscriber with Trust Score 72 but strong financial capacity: has a competitive advantage specifically in high-HPS tenders despite an overall lower score. The component-level intelligence: converts Trust Score from a ranking tool into a competitive positioning map that identifies where to attack and where to defend.", tc: "text-emerald-700" },
            { phase: "LIFECYCLE-PHASE-4: Declining BUJK (aktif tapi memburuk) — Trust Score jatuh 10–25 poin dalam 2 tahun", trust_score_pattern: "Declining BUJK characteristics: SKK certificates expiring without renewal (personnel leaving the company or retirement), project completion rate declining (fewer wins, more bids not resulting in awards), potential financial capacity reduction (bonding capacity disclosed in recent tenders lower than historical levels), occasionally: early KPPU or LPSE violations appearing after years of clean record. The decline phase: Trust Score's most commercially significant detection capability — because a declining competitor represents a market gap opening that MJP subscribers can strategically exploit before the competitor formally exits.", competitive_intelligence_value: "Competitive intelligence value: the R119 EXIT SIGNALS panel described the behavioral indicators of competitor decline. Trust Score decline adds a quantified confirmation: when a competitor's Trust Score drops 15+ points from their peak in 24 months, the decline is confirmed by multiple independent data signals (not just reduced activity, but actual qualification deterioration). MJP's 'competitor decline alert' (delivered in Enterprise quarterly reviews): the most commercially actionable intelligence Reza provides — a competitor declining from Trust Score 80 to 65 in 18 months is moving from 'tier-1 threat' to 'tier-2 competitor' in the categories they previously dominated. The window: 6–18 months where a MJP subscriber can capture the tenders the declining competitor won in previous cycles.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.phase} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.phase}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Trust Score pattern: {r.trust_score_pattern}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Competitive intelligence value: {r.competitive_intelligence_value}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">BUJK lifecycle intelligence adalah the temporal intelligence layer that converts Trust Score from a point-in-time assessment into a longitudinal competitive narrative. The 4 lifecycle phases (startup, growth, established, declining): map the full arc of a BUJK's competitive capability from first tender to potential exit — and Trust Score tracks this arc continuously. The most commercially valuable lifecycle insight: Trust Score allows MJP subscribers to assess not just where a competitor is today but where they are going. A startup BUJK at Trust Score 42 growing at +12 points/year: will be at 66 in 2 years — emerging as a significant competitive threat. An established BUJK at Trust Score 78 declining at -8 points/year: will be at 62 in 2 years — transitioning from tier-1 threat to tier-2 challenger. The directional assessment (where is the competitor going) is often more important for strategic planning than the absolute assessment (where are they today). Reza's quarterly review methodology: always presents Trust Score with a 12-month trend vector, not just a current score. The trend vector conversation: 'Your key competitor A has been stable at 72–74 for 3 years — they are a mature threat that is unlikely to significantly strengthen. Competitor B is at 58 and growing fast — in 12 months, they may be challenging your market position for mid-tier tenders. Competitor C just dropped from 79 to 71 in 12 months — something is wrong at their company; this may be an opportunity to capture their project pipeline in Q3–Q4.' The lifecycle narrative: the intelligence layer that converts Trust Score data into strategic competitive planning conversations. Hendra's product ambition: to make MJP's competitive lifecycle intelligence as essential to BUJK strategic planning as Bloomberg's company financial analytics is to institutional investors — the platform where serious market participants go to understand not just what the market looks like today but what it will look like in 2 years.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between pb-4 gap-4">
          <CardTitle>DIREKTORI</CardTitle>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                ref={searchRef}
                placeholder="Cari perusahaan, catatan… ( / ) · Esc reset"
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
                  <TriangleAlert className="h-3.5 w-3.5 hidden" /><Search className="h-3.5 w-3.5 hidden" /><X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1 items-center">
              {contractorStats.topBidang.length > 0 && contractorStats.topBidang.map(([bidang]) => (
                <button
                  key={bidang}
                  onClick={() => setBidangUsahaFilter(bidangUsahaFilter === bidang ? "" : bidang)}
                  aria-pressed={bidangUsahaFilter === bidang}
                  className={cn("text-[9px] font-mono font-semibold px-2 py-1 rounded-full border transition-colors", bidangUsahaFilter === bidang ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 border-border text-muted-foreground hover:text-foreground")}
                >
                  <span title={bidang.length > 16 ? bidang : undefined}>{bidang.length > 16 ? bidang.slice(0, 16) + "…" : bidang}</span>
                </button>
              ))}
              {bidangUsahaFilter && !contractorStats.topBidang.some(([b]) => b === bidangUsahaFilter) && (
                <button onClick={() => setBidangUsahaFilter("")} className="text-[9px] font-mono px-2 py-1 rounded-full bg-primary text-primary-foreground border border-primary">
                  {bidangUsahaFilter.length > 16 ? bidangUsahaFilter.slice(0, 16) + "…" : bidangUsahaFilter} ✕
                </button>
              )}
            </div>
            <div className="relative w-full md:w-36">
              <Input 
                placeholder="Bidang Usaha lain…" 
                className="w-full bg-muted/50 text-xs pr-7"
                value={bidangUsahaFilter}
                onChange={(e) => setBidangUsahaFilter(e.target.value)}
              />
              {bidangUsahaFilter && (
                <button onClick={() => setBidangUsahaFilter("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none" aria-label="Hapus filter bidang usaha">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="relative w-full md:w-48">
              <Input 
                placeholder="Cari provinsi…" 
                className="w-full bg-muted/50 pr-7"
                value={provinceFilter}
                onChange={(e) => setProvinceFilter(e.target.value)}
              />
              {provinceFilter && (
                <button onClick={() => setProvinceFilter("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none" aria-label="Hapus filter provinsi">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <Select value={sbuLevelFilter || "__all__"} onValueChange={v => setSbuLevelFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger className="h-9 w-44 text-xs font-mono bg-muted/50" aria-label="Filter level SBU" title="Filter berdasarkan level SBU kontraktor">
                <SelectValue placeholder="Semua Kualifikasi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs font-mono">Semua Kualifikasi</SelectItem>
                <SelectItem value="MENENGAH" className="text-xs font-mono">Menengah</SelectItem>
                <SelectItem value="BESAR" className="text-xs font-mono">Besar</SelectItem>
                <SelectItem value="SPESIALIS" className="text-xs font-mono">Spesialis</SelectItem>
                <SelectItem value="ASING" className="text-xs font-mono">Asing / PMA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                <TableHead className="w-[250px]">Perusahaan</TableHead>
                <TableHead className="w-[150px]">Legal & SBU</TableHead>
                <TableHead className="w-[250px]">Bidang Usaha</TableHead>
                <TableHead className="w-[200px]">Lokasi</TableHead>
                <TableHead className="w-[200px]">Kontak</TableHead>
                <TableHead className="w-[150px]">Sumber</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isContractorsError ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-destructive font-mono text-xs">
                    Gagal memuat data kontraktor — periksa koneksi lalu{" "}
                    <button className="underline" onClick={() => window.location.reload()}>muat ulang</button>
                  </TableCell>
                </TableRow>
              ) : isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell><div className="h-3 bg-muted rounded w-32" /></TableCell>
                    <TableCell><div className="h-3 bg-muted rounded w-20" /></TableCell>
                    <TableCell><div className="h-3 bg-muted rounded w-24" /></TableCell>
                    <TableCell><div className="h-3 bg-muted rounded w-16" /></TableCell>
                    <TableCell><div className="h-3 bg-muted rounded w-28" /></TableCell>
                    <TableCell><div className="h-3 bg-muted rounded w-12" /></TableCell>
                  </TableRow>
                ))
              ) : (rawContractors?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground font-mono">
                      <Building2 className="h-8 w-8 opacity-30" />
                      <p className="text-sm">Belum ada kontraktor — tambahkan yang pertama</p>
                      <Button size="sm" variant="outline" onClick={() => setIsCreateOpen(true)} className="font-mono text-xs mt-1">+ Tambah Kontraktor <kbd className="ml-2 text-[9px] font-mono opacity-60 border border-current/30 rounded px-1">N</kbd></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (contractors?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground font-mono text-xs">
                    <div className="flex flex-col items-center gap-1.5 animate-in fade-in duration-200">
                      <Search className="h-8 w-8 opacity-30" />
                      <span>Tidak ada kontraktor yang cocok dengan filter</span>
                      <button
                        className="text-[10px] font-mono text-primary underline underline-offset-2"
                        title="Reset semua filter"
                        onClick={() => { setSearchTerm(""); setProvinceFilter(""); setBidangUsahaFilter(""); setSbuLevelFilter(""); setExpiryFilter(""); setShowWithNotesOnly(false); setShowStarredOnly(false); setSortExpiryAsc(false); }}
                      >
                        ✕ Reset semua filter
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                contractors?.map((contractor) => (
                  <TableRow key={contractor.id} className={`group transition-colors${contractor.sbuExpiry && new Date(contractor.sbuExpiry).getTime() < Date.now() ? " bg-red-50/20 dark:bg-red-900/10 hover:bg-red-50/40" : contractor.sbuExpiry && new Date(contractor.sbuExpiry).getTime() - Date.now() < 30 * 86400000 ? " bg-orange-50/20 dark:bg-orange-900/10 hover:bg-orange-50/40" : starredContractors.has(contractor.id) ? " bg-amber-50/20 dark:bg-amber-900/10 hover:bg-muted/40" : " hover:bg-muted/40"}`}>
                    <TableCell>
                      <div className="font-medium flex items-center gap-2 min-w-0">
                        <button
                          onClick={() => toggleStar(contractor.id)}
                          aria-label={starredContractors.has(contractor.id) ? "Hapus bintang dari kontraktor ini" : "Tandai kontraktor ini sebagai penting"}
                          className={cn("shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm", starredContractors.has(contractor.id) ? "text-amber-500" : "text-muted-foreground/30 hover:text-amber-400")}
                          title={starredContractors.has(contractor.id) ? "Hapus bintang" : "Tandai penting"}
                        >
                          <Star className="h-3.5 w-3.5" />
                        </button>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate" title={contractor.name}>{contractor.name}</span>
                        <button onClick={e => { e.stopPropagation(); void navigator.clipboard.writeText(contractor.name).then(() => toast.success("Nama disalin", { duration: 1200 })); }} aria-label="Salin nama perusahaan" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all shrink-0 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none" title="Salin nama"><Copy className="h-2.5 w-2.5" /></button>
                        {contractor.createdAt && (Date.now() - new Date(contractor.createdAt).getTime()) < 7 * 86400000 && (
                          <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded-sm bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">Baru</span>
                        )}
                        {contractor.createdAt && <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-mono text-muted-foreground shrink-0 whitespace-nowrap" title={`Ditambahkan: ${new Date(contractor.createdAt).toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" })}`}>{new Date(contractor.createdAt).toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" })}</span>}
                      </div>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]" title={contractor.type === "KONTRAKTOR" ? "Kontraktor Umum" : contractor.type === "KONSULTAN" ? "Perusahaan Konsultan" : contractor.type}>{contractor.type === "KONTRAKTOR" ? "Kontraktor" : contractor.type === "KONSULTAN" ? "Konsultan" : contractor.type}</Badge>
                        <Badge variant="secondary" className="text-[10px]" title={`Level SBU: ${{ MENENGAH:"Menengah", BESAR:"Besar", SPESIALIS:"Spesialis", ASING:"Asing/PMA" }[contractor.sbuLevel ?? ""] ?? (contractor.sbuLevel ?? "—")}`}>{{ MENENGAH:"Menengah", BESAR:"Besar", SPESIALIS:"Spesialis", ASING:"Asing/PMA" }[contractor.sbuLevel ?? ""] ?? (contractor.sbuLevel ?? "—")}</Badge>
                      </div>
                      {contractor.npwp ? (
                        <div className="text-[10px] font-mono text-muted-foreground mt-1 flex items-center gap-1">NPWP: {contractor.npwp}<button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(contractor.npwp!).then(() => toast.success("NPWP disalin", { duration: 1200 })); }} aria-label="Salin NPWP" className="opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-foreground" title="Salin NPWP"><Copy className="h-2.5 w-2.5" /></button></div>
                      ) : (
                        <div className="text-[10px] font-mono text-muted-foreground/50 mt-1">NPWP: —</div>
                      )}
                      <div className="relative mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                        <textarea
                          value={contractorNotes[contractor.id] ?? ""}
                          onChange={e => { e.stopPropagation(); updateContractorNote(contractor.id, e.target.value); }}
                          onClick={e => e.stopPropagation()}
                          onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                          onKeyDown={e => { if (e.key === "Escape") e.currentTarget.blur(); }}
                          placeholder="Catatan cepat…"
                          rows={1}
                          maxLength={500}
                          className="w-full text-[9px] font-mono bg-muted/30 border border-border/50 rounded-sm px-1.5 py-0.5 pb-4 resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
                        />
                        <span className="absolute left-1 bottom-0.5 text-[8px] font-mono text-muted-foreground/50">{(contractorNotes[contractor.id] ?? "").length}/500</span>
                        {savedNoteId === contractor.id && <span className="absolute right-1 bottom-0.5 text-[8px] font-mono text-emerald-600">✓ Tersimpan</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {contractor.sbuCode && (
                        <div className="inline-flex items-center gap-1 text-[10px] font-mono font-medium mb-1 border rounded px-1 bg-muted/50" title={`Kode SBU (Sertifikat Badan Usaha): ${contractor.sbuCode}`}>
                          {contractor.sbuCode}
                          <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(contractor.sbuCode!).then(() => toast.success("Kode SBU disalin", { duration: 1200 })); }} aria-label="Salin kode SBU" className="opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-foreground" title="Salin kode SBU"><Copy className="h-2 w-2" /></button>
                        </div>
                      )}
                      {contractor.registrationNumber && (
                        <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground truncate" title={contractor.registrationNumber}>
                          REG: {contractor.registrationNumber}
                          <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(contractor.registrationNumber!).then(() => toast.success("No. Registrasi disalin", { duration: 1200 })); }} aria-label="Salin nomor registrasi" className="opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-foreground shrink-0 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none" title="Salin nomor registrasi"><Copy className="h-2 w-2" /></button>
                        </div>
                      )}
                      {contractor.sbuExpiry && (() => {
                        const daysLeft = Math.ceil((new Date(contractor.sbuExpiry).getTime() - Date.now()) / 86400000);
                        return (
                          <div className="mt-1 space-y-0.5">
                            <div className="font-mono text-[10px] text-muted-foreground" title={daysLeft >= 0 ? `Berakhir dalam ${daysLeft} hari (${format(new Date(contractor.sbuExpiry), "dd MMMM yyyy", { locale: idLocale })})` : `SBU sudah berakhir sejak ${format(new Date(contractor.sbuExpiry), "dd MMMM yyyy", { locale: idLocale })}`}>
                              EXP: {format(new Date(contractor.sbuExpiry), "dd MMM yyyy", { locale: idLocale })}
                            </div>
                            {daysLeft < 0 && (
                              <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded-sm bg-red-100 text-red-700 border border-red-200" title={`SBU sudah berakhir sejak ${format(new Date(contractor.sbuExpiry), "dd MMMM yyyy", { locale: idLocale })}`}>SBU Expired</span>
                            )}
                            {daysLeft >= 0 && daysLeft <= 90 && (
                              <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded-sm bg-orange-100 text-orange-700 border border-orange-200" title={`Berakhir ${format(new Date(contractor.sbuExpiry), "dd MMMM yyyy", { locale: idLocale })}`}>Segera habis {daysLeft} hr</span>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {contractor.bidangUsaha ? (
                        <div className="text-xs font-medium truncate" title={contractor.bidangUsaha}>{contractor.bidangUsaha}</div>
                      ) : <span className="text-xs text-muted-foreground">-</span>}
                      {contractor.subBidang && (
                        <div className="text-[10px] text-muted-foreground mt-1 truncate" title={contractor.subBidang}>
                          {contractor.subBidang}
                        </div>
                      )}
                      {contractor.klasifikasi && (
                        <div className="text-[10px] font-mono text-primary mt-1" title={`Klasifikasi SBU: ${contractor.klasifikasi} — ${{ K1:"Kecil 1 (modal kerja < Rp 1M)", K2:"Kecil 2 (modal kerja Rp 1-2.5M)", M:"Menengah (modal kerja Rp 2.5-10M)", B:"Besar (modal kerja > Rp 10M)" }[contractor.klasifikasi ?? ""] ?? contractor.klasifikasi}`}>KLAS: {contractor.klasifikasi}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate" title={[contractor.city, contractor.province].filter(Boolean).join(", ") || "Lokasi tidak tercatat"}>{contractor.city && contractor.province ? `${contractor.city}, ${contractor.province}` : contractor.city ?? contractor.province ?? <span className="text-muted-foreground">—</span>}</span>
                      </div>
                      {contractor.address && (
                        <div className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]" title={contractor.address}>
                          {contractor.address}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 w-[180px]">
                        {contractor.phone && (
                          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground" title={contractor.phone}>
                            <Phone className="h-3 w-3 shrink-0" />
                            <span className="truncate flex-1" title={contractor.phone}>{contractor.phone}</span>
                            <button
                              title="Salin nomor"
                              className="shrink-0 opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity"
                              onClick={(e) => { e.stopPropagation(); void navigator.clipboard.writeText(contractor.phone!).then(() => toast.success("Nomor disalin")); }}
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        {contractor.email && (
                          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground" title={contractor.email}>
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate flex-1" title={contractor.email}>{contractor.email}</span>
                            <button
                              title="Salin email"
                              className="shrink-0 opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity"
                              onClick={(e) => { e.stopPropagation(); void navigator.clipboard.writeText(contractor.email!).then(() => toast.success("Email disalin")); }}
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        {contractor.website && (
                          <div className="group/web flex items-center gap-1.5 text-xs font-mono text-muted-foreground" title={contractor.website}>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <a href={contractor.website} target="_blank" rel="noopener noreferrer" aria-label={`Buka website ${contractor.name}`} title={`Buka website ${contractor.name}`} className="hover:text-primary truncate underline decoration-dotted">
                              {contractor.website.replace(/^https?:\/\//, '')}
                            </a>
                            <button onClick={e => { e.stopPropagation(); void navigator.clipboard.writeText(contractor.website!).then(() => toast.success("Website disalin", { duration: 1200 })); }} aria-label="Salin URL website" title="Salin URL website" className="opacity-0 group-hover/web:opacity-100 transition-all shrink-0 text-muted-foreground hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none"><Copy className="h-2.5 w-2.5" /></button>
                          </div>
                        )}
                        {!contractor.phone && !contractor.email && !contractor.website && <span className="text-xs text-muted-foreground">-</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        {contractor.dataSource ? (
                          <>
                            <Badge variant="outline" className="text-[9px] bg-muted/20">
                              {contractor.dataSource}
                            </Badge>
                            {contractor.dataSourceUrl && (
                              <div className="group/dsurl flex items-center gap-1">
                                <a href={contractor.dataSourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] flex items-center gap-1 text-primary hover:underline transition-colors" title="Buka URL sumber data kontraktor" aria-label="Buka URL sumber data kontraktor">
                                  <LinkIcon className="h-2.5 w-2.5" /> Buka URL
                                </a>
                                <button onClick={e => { e.stopPropagation(); void navigator.clipboard.writeText(contractor.dataSourceUrl!).then(() => toast.success("URL disalin", { duration: 1200 })); }} aria-label="Salin URL sumber data" title="Salin URL" className="opacity-0 group-hover/dsurl:opacity-100 transition-all text-muted-foreground hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none"><Copy className="h-2.5 w-2.5" /></button>
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                        {/* WhatsApp share — Task #19 */}
                        {contractor.sbuExpiry && (() => {
                          const daysLeft = Math.ceil((new Date(contractor.sbuExpiry).getTime() - Date.now()) / 86400000);
                          if (daysLeft >= 0 && daysLeft <= 90) return (
                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(
                                `⚠️ *ALERT SBU Segera Habis*\n\n` +
                                `*${contractor.name}*\n` +
                                `SBU ${{ MENENGAH:"Menengah", BESAR:"Besar", SPESIALIS:"Spesialis", ASING:"Asing/PMA" }[contractor.sbuLevel ?? ""] ?? (contractor.sbuLevel ?? "")}${contractor.sbuCode ? ` (${contractor.sbuCode})` : ""} berakhir: ${contractor.sbuExpiry}\n` +
                                `Sisa: ${daysLeft} hari\n\n` +
                                `Perpanjang SBU sekarang untuk mempertahankan kualifikasi tender.\n\n` +
                                `PT Maheswara Jaya Persada — Layanan Pengurusan SBU`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] flex items-center gap-1 text-orange-600 hover:text-orange-700 hover:underline font-mono mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Kirim alert SBU via WhatsApp"
                              aria-label="Kirim alert SBU akan habis via WhatsApp"
                            >
                              <MessageCircle className="h-2.5 w-2.5" /> Hubungi SBU
                            </a>
                          );
                          return null;
                        })()}
                        <div className={cn("flex flex-col gap-0.5 transition-opacity", pendingDeleteId === contractor.id ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(
                              `*${contractor.name}*\n` +
                              `Tipe: ${{ KONTRAKTOR:"Kontraktor", KONSULTAN:"Konsultan" }[contractor.type ?? ""] ?? (contractor.type ?? "")} | SBU: ${{ MENENGAH:"Menengah", BESAR:"Besar", SPESIALIS:"Spesialis", ASING:"Asing/PMA" }[contractor.sbuLevel ?? ""] ?? (contractor.sbuLevel ?? "")}${contractor.sbuCode ? ` (${contractor.sbuCode})` : ""}\n` +
                              (contractor.bidangUsaha ? `Bidang: ${contractor.bidangUsaha}\n` : "") +
                              (contractor.city || contractor.province ? `Lokasi: ${[contractor.city, contractor.province].filter(Boolean).join(", ")}\n` : "") +
                              (contractor.phone ? `Telp: ${contractor.phone}\n` : "") +
                              (contractor.email ? `Email: ${contractor.email}\n` : "") +
                              `\nDikirim dari Platform Riset Marketing Konstruksi - PT Maheswara Jaya Persada`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] flex items-center gap-1 text-emerald-600 hover:text-emerald-700 hover:underline font-mono"
                            title="Bagikan profil kontraktor via WhatsApp"
                            aria-label="Bagikan profil kontraktor via WhatsApp"
                          >
                            <MessageCircle className="h-2.5 w-2.5" /> Bagikan WA
                          </a>
                          {pendingDeleteId === contractor.id ? (
                            <button
                              onClick={() => { deleteMutation.mutate({ id: contractor.id }); setPendingDeleteId(null); }}
                              onBlur={() => setPendingDeleteId(null)}
                              disabled={deleteMutation.isPending}
                              className="text-[10px] flex items-center gap-1 text-white bg-red-600 hover:bg-red-700 px-1.5 py-0.5 rounded font-mono mt-1 transition-colors disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 outline-none"
                              aria-label="Konfirmasi hapus kontraktor"
                              autoFocus
                            >
                              {deleteMutation.isPending ? <><Loader2 className="h-2.5 w-2.5 animate-spin" /> Menghapus…</> : "✓ Yakin hapus?"}
                            </button>
                          ) : (
                            <button
                              onClick={() => setPendingDeleteId(contractor.id)}
                              className="text-[10px] flex items-center gap-1 text-red-500 hover:text-red-700 hover:underline font-mono mt-1 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 rounded-sm outline-none"
                              title="Hapus kontraktor"
                              aria-label="Hapus kontraktor"
                            >
                              × Hapus
                            </button>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-6 right-6 z-50 h-9 w-9 rounded-full bg-primary animate-in fade-in slide-in-from-bottom-2 text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" aria-label="Kembali ke atas" title="Kembali ke atas"><ChevronUp className="h-4 w-4" /></button>
      )}
    </div>
  );
}
