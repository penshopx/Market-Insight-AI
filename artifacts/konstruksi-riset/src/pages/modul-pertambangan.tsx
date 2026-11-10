import { useState, useMemo, useEffect, useRef, useDeferredValue } from "react";
import { toast } from "sonner";
import {
  useListMiningProjects,
  useCreateMiningProject,
  getListMiningProjectsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shell } from "@/components/layout/shell";
import {
  Mountain, Search, Plus, MapPin, ExternalLink, AlertCircle, ChevronUp, Loader2,
  Building2, Calendar, BarChart3, TrendingUp, Shield, Pickaxe, X, Copy,
} from "lucide-react";

// ─── helpers ─────────────────────────────────────────────────────────────────

const KOMODITAS_LIST = ["NIKEL", "BATUBARA", "BAUKSIT", "TEMBAGA", "EMAS", "TIMAH", "MANGAN", "BIJIH_BESI", "SENG", "GRANIT"];
const STATUS_IUP = ["AKTIF", "CNC", "DICABUT", "HABIS", "PROSES"];
const JENIS_IUP = ["EKSPLORASI", "OPERASI_PRODUKSI"];
const STATUS_RKAB = ["DISETUJUI", "PROSES", "BELUM_AJUKAN"];

const komoditasColor: Record<string, string> = {
  NIKEL: "bg-emerald-100 text-emerald-800 border-emerald-200",
  BATUBARA: "bg-gray-100 text-gray-800 border-gray-200",
  BAUKSIT: "bg-red-100 text-red-800 border-red-200",
  TEMBAGA: "bg-orange-100 text-orange-800 border-orange-200",
  EMAS: "bg-yellow-100 text-yellow-800 border-yellow-200",
  TIMAH: "bg-slate-100 text-slate-800 border-slate-200",
};

const statusIupColor: Record<string, string> = {
  AKTIF: "bg-green-100 text-green-800",
  CNC: "bg-blue-100 text-blue-800",
  DICABUT: "bg-red-100 text-red-800",
  HABIS: "bg-gray-100 text-gray-800",
  PROSES: "bg-yellow-100 text-yellow-800",
};

const rkabColor: Record<string, string> = {
  DISETUJUI: "bg-green-100 text-green-800",
  PROSES: "bg-yellow-100 text-yellow-800",
  BELUM_AJUKAN: "bg-red-100 text-red-800",
};

// ─── Add Mining Dialog ────────────────────────────────────────────────────────

function AddMiningDialog({ onSuccess, open: controlledOpen, onOpenChange }: { onSuccess: () => void; open?: boolean; onOpenChange?: (v: boolean) => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [form, setForm] = useState({
    nomorIup: "", pemegang: "", komoditas: "NIKEL", statusIup: "AKTIF", jenisIup: "OPERASI_PRODUKSI",
    provinsi: "", kabupaten: "", luasHa: "", tahunTerbit: "", tahunBerakhir: "",
    statusRkab: "", sumber: "", sourceUrl: "", catatan: ""
  });
  const createMut = useCreateMiningProject();
  const [touched, setTouched] = useState(false);
  const handleOpenChange = (v: boolean) => { setOpen(v); if (!v) setTouched(false); };

  const handleSubmit = () => {
    if (!form.pemegang.trim()) { setTouched(true); return; }
    createMut.mutate(
      { data: { ...form, luasHa: form.luasHa ? parseFloat(form.luasHa) : undefined } },
      {
        onSuccess: (data) => {
          setOpen(false);
          setForm({ nomorIup: "", pemegang: "", komoditas: "NIKEL", statusIup: "AKTIF", jenisIup: "OPERASI_PRODUKSI", provinsi: "", kabupaten: "", luasHa: "", tahunTerbit: "", tahunBerakhir: "", statusRkab: "", sumber: "", sourceUrl: "", catatan: "" });
          onSuccess();
          toast.success("Proyek tambang ditambahkan", { description: data.pemegang ?? undefined, duration: 2500 });
        },
        onError: (err: unknown) => toast.error("Gagal menyimpan proyek tambang", { description: err instanceof Error ? err.message : "Coba lagi" }),
      }
    );
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));
  const s = (k: string) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-mono text-xs gap-1.5"><Plus className="h-3.5 w-3.5" /> Tambah IUP <kbd className="pointer-events-none ml-1 hidden h-4 items-center gap-0.5 rounded border bg-muted px-1 font-mono text-[10px] opacity-70 sm:flex">N</kbd></Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-mono">Tambah Data IUP Tambang</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-mono">Nama Pemegang IUP *</Label>
            <Input value={form.pemegang} onChange={f("pemegang")} onBlur={() => setTouched(true)} maxLength={255} placeholder="PT Tambang Nusantara" className={`font-mono text-sm${touched && !form.pemegang.trim() ? " border-destructive focus-visible:ring-destructive" : ""}`} autoFocus />
            {touched && !form.pemegang.trim() && <p className="text-xs text-red-500 font-mono">Nama pemegang wajib diisi</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Komoditas</Label>
              <Select value={form.komoditas} onValueChange={s("komoditas")}>
                <SelectTrigger className="font-mono text-xs" aria-label="Pilih komoditas tambang"><SelectValue /></SelectTrigger>
                <SelectContent>{KOMODITAS_LIST.map(k => <SelectItem key={k} value={k} className="font-mono text-xs">{k.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Jenis IUP</Label>
              <Select value={form.jenisIup} onValueChange={s("jenisIup")}>
                <SelectTrigger className="font-mono text-xs" aria-label="Pilih jenis IUP"><SelectValue /></SelectTrigger>
                <SelectContent>{JENIS_IUP.map(j => <SelectItem key={j} value={j} className="font-mono text-xs">{{ EKSPLORASI:"Eksplorasi", OPERASI_PRODUKSI:"Operasi Produksi" }[j] ?? j}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Status IUP</Label>
              <Select value={form.statusIup} onValueChange={s("statusIup")}>
                <SelectTrigger className="font-mono text-xs" aria-label="Pilih status IUP"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_IUP.map(s => <SelectItem key={s} value={s} className="font-mono text-xs">{{ AKTIF:"Aktif", CNC:"CNC", DICABUT:"Dicabut", HABIS:"Habis", PROSES:"Dalam Proses" }[s] ?? s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Status RKAB</Label>
              <Select value={form.statusRkab} onValueChange={s("statusRkab")}>
                <SelectTrigger className="font-mono text-xs" aria-label="Pilih status RKAB"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="" className="font-mono text-xs">Tidak Diketahui</SelectItem>
                  {STATUS_RKAB.map(r => <SelectItem key={r} value={r} className="font-mono text-xs">{{ DISETUJUI:"Disetujui", PROSES:"Dalam Proses", BELUM_AJUKAN:"Belum Diajukan" }[r] ?? r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Provinsi</Label>
              <Input value={form.provinsi} onChange={f("provinsi")} maxLength={100} placeholder="Sulawesi Tengah" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Kabupaten</Label>
              <Input value={form.kabupaten} onChange={f("kabupaten")} maxLength={100} placeholder="Morowali" className="font-mono text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Luas (Ha)</Label>
              <Input value={form.luasHa} onChange={f("luasHa")} type="number" onWheel={(e) => e.currentTarget.blur()} min="0" placeholder="5000" maxLength={20} className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Nomor IUP</Label>
              <Input value={form.nomorIup} onChange={f("nomorIup")} maxLength={100} placeholder="IUP-2024-001" className="font-mono text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Tahun Terbit</Label>
              <Input value={form.tahunTerbit} onChange={f("tahunTerbit")} maxLength={4} placeholder="2020" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Tahun Berakhir</Label>
              <Input value={form.tahunBerakhir} onChange={f("tahunBerakhir")} maxLength={4} placeholder="2040" className="font-mono text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-mono">URL Sumber</Label>
            <Input value={form.sourceUrl} onChange={f("sourceUrl")} maxLength={500} placeholder="https://modi.esdm.go.id/…" className="font-mono text-sm" onFocus={(e) => e.target.select()} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-mono">Catatan</Label>
            <Textarea value={form.catatan} onChange={f("catatan")} onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); }} onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }} rows={2} className="font-mono text-xs" maxLength={300} />
            <p className="text-[10px] font-mono text-muted-foreground text-right">{(form.catatan ?? "").length} / 300</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Batal</Button>
          <Button size="sm" onClick={handleSubmit} disabled={createMut.isPending} className="font-mono text-xs">
            {createMut.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Menyimpan...</> : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ModulPertambangan() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) return;
      const _t = (e.target as HTMLElement);
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && _t.tagName !== "INPUT" && _t.tagName !== "TEXTAREA" && _t.tagName !== "SELECT" && !_t.isContentEditable) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "n" && !e.ctrlKey && !e.metaKey && !e.altKey && _t.tagName !== "INPUT" && _t.tagName !== "TEXTAREA" && _t.tagName !== "SELECT" && !_t.isContentEditable) { e.preventDefault(); setIsAddOpen(true); }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);
  const [filterKomoditas, setFilterKomoditas] = useState("__all__");
  const [filterStatus, setFilterStatus] = useState("__all__");
  const qc = useQueryClient();

  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: projects = [], isLoading, isError } = useListMiningProjects();

  const invalidate = () => void qc.invalidateQueries({ queryKey: getListMiningProjectsQueryKey() });

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (deferredSearch && !p.pemegang.toLowerCase().includes(deferredSearch.toLowerCase()) && !(p.provinsi ?? "").toLowerCase().includes(deferredSearch.toLowerCase()) && !(p.kabupaten ?? "").toLowerCase().includes(deferredSearch.toLowerCase()) && !(p.nomorIup ?? "").toLowerCase().includes(deferredSearch.toLowerCase())) return false;
      if (filterKomoditas !== "__all__" && p.komoditas !== filterKomoditas) return false;
      if (filterStatus !== "__all__" && p.statusIup !== filterStatus) return false;
      return true;
    });
  }, [projects, search, filterKomoditas, filterStatus]);

  const aktif = projects.filter(p => p.statusIup === "AKTIF").length;
  const cnc = projects.filter(p => p.statusIup === "CNC").length;
  const rkabDisetujui = projects.filter(p => p.statusRkab === "DISETUJUI").length;
  const totalLuas = projects.filter(p => p.statusIup === "AKTIF").reduce((s, p) => s + (p.luasHa ?? 0), 0);

  const komoditasStats = KOMODITAS_LIST.map(k => ({ komoditas: k, count: projects.filter(p => p.komoditas === k && p.statusIup === "AKTIF").length })).filter(x => x.count > 0).sort((a, b) => b.count - a.count);

  return (
    <Shell>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Cluster Industri</span>
            <span className="text-xs font-mono text-muted-foreground">/</span>
            <span className="text-xs font-mono text-primary font-semibold">PERTAMBANGAN</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Mountain className="h-6 w-6 text-stone-600" />
            Modul Pertambangan
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            IUP Database · RKAB Pipeline · Kontraktor Tambang · Sinyal Sektor Minerba
          </p>
          <p className="text-xs text-muted-foreground/70 font-mono mt-0.5">{projects.length} IUP tercatat · {[...new Set(projects.map(p => p.provinsi).filter(Boolean))].length} provinsi</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="border-l-4 border-l-stone-500 hover:shadow-sm transition-shadow">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs font-mono text-muted-foreground mb-1">IUP Aktif</div>
              <div className="text-2xl font-bold font-mono text-stone-700">{aktif}</div>
              <div className="text-xs text-muted-foreground mt-0.5">izin aktif terdata</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500 hover:shadow-sm transition-shadow">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs font-mono text-muted-foreground mb-1">Status CNC</div>
              <div className="text-2xl font-bold font-mono text-blue-600">{cnc}</div>
              <div className="text-xs text-muted-foreground mt-0.5">clear &amp; clean</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 hover:shadow-sm transition-shadow">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs font-mono text-muted-foreground mb-1">RKAB Disetujui</div>
              <div className="text-2xl font-bold font-mono text-green-600">{rkabDisetujui}</div>
              <div className="text-xs text-muted-foreground mt-0.5">siap produksi</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500 hover:shadow-sm transition-shadow">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs font-mono text-muted-foreground mb-1">Total Luas Aktif</div>
              <div className="text-2xl font-bold font-mono">
                {totalLuas >= 1000 ? `${(totalLuas / 1000).toFixed(0)}K` : totalLuas.toFixed(0)}
                <span className="text-sm font-normal text-muted-foreground ml-1">Ha</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">wilayah IUP aktif</div>
            </CardContent>
          </Card>
        </div>

        {/* Komoditas breakdown */}
        {komoditasStats.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {komoditasStats.map(({ komoditas, count }) => (
              <button
                key={komoditas}
                type="button"
                title={`Filter komoditas: ${komoditas.replace(/_/g, " ")} (${count} IUP)`}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-mono font-semibold border cursor-pointer hover:opacity-80 transition-opacity ${komoditasColor[komoditas] ?? "bg-gray-100 text-gray-800 border-gray-200"}`}
                onClick={() => setFilterKomoditas(filterKomoditas === komoditas ? "__all__" : komoditas)}
              >
                <Pickaxe className="h-3 w-3" />
                {komoditas} <span className="opacity-70">({count})</span>
              </button>
            ))}
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input ref={searchRef} placeholder="Cari pemegang, provinsi… · Esc reset" title="Tekan / untuk fokus ke pencarian" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { setSearch(""); e.currentTarget.blur(); } }} className="pl-8 pr-10 font-mono text-xs h-8" />
            {search ? (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none" aria-label="Hapus pencarian">
                <X className="h-3 w-3" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-70 sm:flex">/</kbd>
            )}
          </div>
          <Select value={filterKomoditas} onValueChange={setFilterKomoditas}>
            <SelectTrigger className="w-36 font-mono text-xs h-8" aria-label="Filter komoditas tambang"><SelectValue placeholder="Komoditas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" className="font-mono text-xs">Semua Komoditas</SelectItem>
              {KOMODITAS_LIST.map(k => <SelectItem key={k} value={k} className="font-mono text-xs">{k.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 font-mono text-xs h-8" aria-label="Filter status IUP"><SelectValue placeholder="Status IUP" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" className="font-mono text-xs">Semua Status</SelectItem>
              {STATUS_IUP.map(s => <SelectItem key={s} value={s} className="font-mono text-xs">{{ AKTIF:"Aktif", CNC:"CNC", DICABUT:"Dicabut", HABIS:"Habis", PROSES:"Dalam Proses" }[s] ?? s}</SelectItem>)}
            </SelectContent>
          </Select>
          {(search || filterKomoditas !== "__all__" || filterStatus !== "__all__") && (
            <button
              onClick={() => { setSearch(""); setFilterKomoditas("__all__"); setFilterStatus("__all__"); }}
              className="h-8 px-2.5 text-[10px] font-mono font-bold rounded-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 outline-none"
              title="Reset filter"
            >✕ Reset</button>
          )}
          <p className="text-[10px] font-mono text-muted-foreground ml-auto">{filtered.length} dari {projects.length} IUP</p>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-mono">
              Database IUP Pertambangan
              <span className="ml-2 text-xs text-muted-foreground font-normal">({filtered.length} entri)</span>
            </CardTitle>
            <AddMiningDialog onSuccess={invalidate} open={isAddOpen} onOpenChange={setIsAddOpen} />
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow className="font-mono text-xs sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]"><TableHead>Pemegang IUP</TableHead><TableHead>Komoditas</TableHead><TableHead>Jenis</TableHead><TableHead>Status IUP</TableHead><TableHead>RKAB</TableHead><TableHead>Wilayah</TableHead><TableHead className="text-right">Luas (Ha)</TableHead><TableHead>Masa Berlaku</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="animate-pulse">
                        {Array.from({ length: 9 }).map((__, j) => (
                          <TableCell key={j}><div className="h-3 bg-muted rounded w-20" /></TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : isError ? (
              <div className="flex items-center justify-center py-16 gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" /><span className="font-mono text-sm">Gagal memuat data</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="animate-in fade-in duration-200 flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <Search className="h-8 w-8 opacity-30" />
                <div className="text-center">
                  <p className="font-mono text-sm">{projects.length === 0 ? "Belum ada data IUP tambang" : "Tidak ada IUP yang cocok dengan filter"}</p>
                  <p className="text-xs mt-1">{projects.length === 0 ? "Tambahkan data IUP dari MODI ESDM untuk memulai tracking" : "Coba ubah kata kunci atau filter komoditas"}</p>
                </div>
                {projects.length > 0 && (
                  <button onClick={() => { setSearch(""); setFilterKomoditas("__all__"); setFilterStatus("__all__"); }} className="text-xs font-mono text-primary hover:underline mt-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none">✕ Reset semua filter</button>
                )}
                {projects.length === 0 && (
                  <Button size="sm" variant="outline" onClick={() => setIsAddOpen(true)} className="font-mono text-xs gap-1.5 mt-1">
                    <Plus className="h-3.5 w-3.5" /> Tambah IUP <kbd className="text-[9px] font-mono opacity-60 border border-current/30 rounded px-1">N</kbd>
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="font-mono text-xs sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                      <TableHead>Pemegang IUP</TableHead>
                      <TableHead>Komoditas</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead>Status IUP</TableHead>
                      <TableHead>RKAB</TableHead>
                      <TableHead>Wilayah</TableHead>
                      <TableHead className="text-right">Luas (Ha)</TableHead>
                      <TableHead>Masa Berlaku</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => (
                      <TableRow key={p.id} className={`font-mono text-xs group transition-colors${p.statusIup === "DICABUT" || p.statusIup === "BERAKHIR" ? " bg-red-50/20 hover:bg-red-50/40" : " hover:bg-muted/40"}`}>
                        <TableCell className="font-medium max-w-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate" title={p.pemegang}>{p.pemegang}</span>
                            <button onClick={e => { e.stopPropagation(); void navigator.clipboard.writeText(p.pemegang).then(() => toast.success("Nama disalin", { duration: 1200 })); }} aria-label="Salin nama pemegang" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all shrink-0 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none" title="Salin nama"><Copy className="h-2.5 w-2.5" /></button>
                            {p.createdAt && (Date.now() - new Date(p.createdAt).getTime()) < 7 * 86400000 && (
                              <span className="text-[8px] font-mono bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded-sm border border-emerald-200 shrink-0">Baru</span>
                            )}
                            {p.createdAt && <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-mono text-muted-foreground shrink-0 whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" })}</span>}
                          </div>
                          {p.nomorIup && (
                            <div className="flex items-center gap-1 text-muted-foreground text-xs font-mono group/iup">
                              <span>{p.nomorIup}</span>
                              <button
                                onClick={() => navigator.clipboard.writeText(p.nomorIup!).then(() => toast.success("Nomor IUP disalin", { duration: 1200 })).catch(() => {})}
                                aria-label="Salin nomor IUP" title="Salin nomor IUP"
                                className="opacity-0 group-hover/iup:opacity-100 transition-all text-muted-foreground hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm"
                              ><Copy className="h-3 w-3" /></button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span title={p.komoditas?.replace(/_/g, " ") ?? undefined} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-mono font-semibold border ${komoditasColor[p.komoditas] ?? "bg-gray-100 text-gray-800 border-gray-200"}`}>
                            <Pickaxe className="h-3 w-3" />{p.komoditas?.replace(/_/g, " ") ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell>{p.jenisIup ? <Badge variant="outline" className="text-xs font-mono" title={{ EKSPLORASI:"Izin Usaha Pertambangan Eksplorasi", OPERASI_PRODUKSI:"Izin Usaha Pertambangan Operasi Produksi" }[p.jenisIup] ?? p.jenisIup.replace("_", " ")}>{{ EKSPLORASI:"Eksplorasi", OPERASI_PRODUKSI:"Operasi Produksi" }[p.jenisIup] ?? p.jenisIup.replace("_", " ")}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          <span
                            title={{ AKTIF:"IUP Aktif", CNC:"Clear and Clean — tidak ada sengketa lahan", PRODUKSI:"Tahap Operasi Produksi", EKSPLORASI:"Tahap Eksplorasi", DICABUT:"IUP telah dicabut", BERAKHIR:"Masa berlaku IUP telah berakhir" }[p.statusIup] ?? p.statusIup}
                            className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-mono font-semibold ${statusIupColor[p.statusIup] ?? "bg-gray-100 text-gray-800"}`}
                          >
                            {{ AKTIF:"Aktif", CNC:"CNC", PRODUKSI:"Produksi", EKSPLORASI:"Eksplorasi", DICABUT:"Dicabut", BERAKHIR:"Berakhir" }[p.statusIup] ?? (p.statusIup ?? "—")}
                          </span>
                        </TableCell>
                        <TableCell>
                          {p.statusRkab ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-mono ${rkabColor[p.statusRkab] ?? "bg-gray-100 text-gray-800"}`} title={{ DISETUJUI:"Rencana Kerja dan Anggaran Biaya telah disetujui ESDM", DITOLAK:"RKAB ditolak dan harus direvisi", REVISI:"RKAB memerlukan revisi sebelum persetujuan", PENDING:"Sedang menunggu review ESDM", BELUM_DIAJUKAN:"RKAB belum diajukan ke ESDM" }[p.statusRkab] ?? p.statusRkab.replace("_", " ")}>
                              {{ DISETUJUI:"Disetujui", DITOLAK:"Ditolak", REVISI:"Revisi", PENDING:"Menunggu", BELUM_DIAJUKAN:"Belum Diajukan" }[p.statusRkab] ?? p.statusRkab.replace("_", " ")}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            {p.provinsi ? <span className="flex items-center gap-1" title={p.provinsi}><MapPin className="h-3 w-3 text-muted-foreground" />{p.provinsi}</span> : <span className="text-muted-foreground">—</span>}
                            {p.kabupaten && <span className="text-muted-foreground" title={p.kabupaten}>{p.kabupaten}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {p.luasHa != null ? <span className="font-mono" title={`${p.luasHa.toLocaleString("id-ID")} Ha (Hektar)`}>{p.luasHa.toLocaleString("id-ID")}</span> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex flex-col gap-0.5 text-muted-foreground font-mono">
                            {p.tahunTerbit && <span>{p.tahunTerbit}</span>}
                            {p.tahunBerakhir && <span>s/d {p.tahunBerakhir}</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {p.sourceUrl && (
                            <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label="Buka sumber IUP" title="Buka sumber IUP" className="opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Footer */}
        <div className="rounded-sm border border-stone-200 bg-stone-50 dark:bg-stone-950/20 dark:border-stone-900/30 p-4">
          <div className="flex gap-3">
            <Mountain className="h-4 w-4 text-stone-600 shrink-0 mt-0.5" />
            <div className="text-xs font-mono text-stone-800 dark:text-stone-200 space-y-1">
              <p className="font-semibold">Sumber Data Utama Cluster Pertambangan:</p>
              <p>MODI ESDM (modi.esdm.go.id) · Ditjen Minerba ESDM · Tambang.co.id · Mining.co.id · APBI-ICMA</p>
              <p className="text-stone-600 dark:text-stone-400">Data IUP bersumber dari MODI (Minerba One Data Indonesia). Tambah manual via tombol Tambah IUP.</p>
            </div>
          </div>
        </div>
      </div>
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-6 right-6 z-50 h-9 w-9 rounded-full bg-primary animate-in fade-in slide-in-from-bottom-2 text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" aria-label="Kembali ke atas" title="Kembali ke atas"><ChevronUp className="h-4 w-4" /></button>
      )}
    </Shell>
  );
}
