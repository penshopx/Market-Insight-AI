import { useState, useMemo, useEffect, useRef, useDeferredValue } from "react";
import { toast } from "sonner";
import {
  useListEnvironmentProjects,
  useCreateEnvironmentProject,
  getListEnvironmentProjectsQueryKey,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shell } from "@/components/layout/shell";
import {
  Leaf, Search, Plus, MapPin, ExternalLink, AlertCircle, ChevronUp, Loader2,
  Building2, Calendar, TrendingUp, TreePine, Flame, Wind, X, Copy,
} from "lucide-react";

// ─── helpers ─────────────────────────────────────────────────────────────────

const JENIS_LIST = ["AMDAL", "UKL_UPL", "SPPL", "CARBON_PROJECT", "GREEN_BOND", "PROPER"];
const SEKTOR_LIST = ["EBT", "TAMBANG", "INDUSTRI", "INFRASTRUKTUR", "PERTANIAN", "KEHUTANAN", "MIGAS", "PROPERTI"];
const STATUS_AMDAL = ["PENGAJUAN", "PROSES", "DISETUJUI", "DITOLAK"];
const PERINGKAT_PROPER = ["EMAS", "HIJAU", "BIRU", "MERAH", "HITAM"];
const PERINGKAT_PROPER_LABEL: Record<string, string> = { "EMAS": "Emas", "HIJAU": "Hijau", "BIRU": "Biru", "MERAH": "Merah", "HITAM": "Hitam" };

const jenisColor: Record<string, string> = {
  AMDAL: "bg-blue-100 text-blue-800 border-blue-200",
  UKL_UPL: "bg-cyan-100 text-cyan-800 border-cyan-200",
  SPPL: "bg-teal-100 text-teal-800 border-teal-200",
  CARBON_PROJECT: "bg-green-100 text-green-800 border-green-200",
  GREEN_BOND: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PROPER: "bg-purple-100 text-purple-800 border-purple-200",
};

const properColor: Record<string, string> = {
  EMAS: "bg-yellow-100 text-yellow-800",
  HIJAU: "bg-green-100 text-green-800",
  BIRU: "bg-blue-100 text-blue-800",
  MERAH: "bg-red-100 text-red-800",
  HITAM: "bg-gray-900 text-gray-100",
};

const amdalColor: Record<string, string> = {
  DISETUJUI: "bg-green-100 text-green-800",
  PROSES: "bg-yellow-100 text-yellow-800",
  PENGAJUAN: "bg-blue-100 text-blue-800",
  DITOLAK: "bg-red-100 text-red-800",
};

function JenisBadge({ jenis }: { jenis: string }) {
  return (
    <span title={jenis.replace(/_/g, " ")} className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-mono font-semibold border ${jenisColor[jenis] ?? "bg-gray-100 text-gray-800 border-gray-200"}`}>
      {jenis.replace("_", " ")}
    </span>
  );
}

// ─── Add Environment Dialog ────────────────────────────────────────────────────

function AddEnvDialog({ onSuccess, open: controlledOpen, onOpenChange }: { onSuccess: () => void; open?: boolean; onOpenChange?: (v: boolean) => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [form, setForm] = useState({
    judul: "", jenis: "AMDAL", pemrakarsa: "", sektor: "TAMBANG", statusAmdal: "",
    peringkatProper: "", provinsi: "", nilaiKarbon: "", nilaiProyek: "", tahun: "",
    sumber: "", sourceUrl: "", catatan: ""
  });
  const createMut = useCreateEnvironmentProject();
  const [touched, setTouched] = useState(false);
  const handleOpenChange = (v: boolean) => { setOpen(v); if (!v) setTouched(false); };

  const handleSubmit = () => {
    if (!form.judul.trim()) { setTouched(true); return; }
    createMut.mutate(
      {
        data: {
          ...form,
          nilaiKarbon: form.nilaiKarbon ? parseFloat(form.nilaiKarbon) : undefined,
          nilaiProyek: form.nilaiProyek ? parseFloat(form.nilaiProyek) : undefined,
        }
      },
      {
        onSuccess: (data) => {
          setOpen(false);
          setForm({ judul: "", jenis: "AMDAL", pemrakarsa: "", sektor: "TAMBANG", statusAmdal: "", peringkatProper: "", provinsi: "", nilaiKarbon: "", nilaiProyek: "", tahun: "", sumber: "", sourceUrl: "", catatan: "" });
          onSuccess();
          toast.success("Proyek lingkungan ditambahkan", { description: data.judul, duration: 2500 });
        },
        onError: (err: unknown) => toast.error("Gagal menyimpan proyek lingkungan", { description: err instanceof Error ? err.message : "Coba lagi" }),
      }
    );
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));
  const s = (k: string) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-mono text-xs gap-1.5"><Plus className="h-3.5 w-3.5" /> Tambah Entri <kbd className="pointer-events-none ml-1 hidden h-4 items-center gap-0.5 rounded border bg-muted px-1 font-mono text-[10px] opacity-70 sm:flex">N</kbd></Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-mono">Tambah Proyek Lingkungan</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-mono">Judul / Nama Proyek *</Label>
            <Input value={form.judul} onChange={f("judul")} onBlur={() => setTouched(true)} maxLength={255} placeholder="Contoh: AMDAL Tambang Nikel Morowali" className={`font-mono text-sm${touched && !form.judul.trim() ? " border-destructive focus-visible:ring-destructive" : ""}`} autoFocus />
            {touched && !form.judul.trim() && <p className="text-xs text-red-500 font-mono">Judul wajib diisi</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Jenis Dokumen</Label>
              <Select value={form.jenis} onValueChange={s("jenis")}>
                <SelectTrigger className="font-mono text-xs" aria-label="Pilih jenis dokumen lingkungan"><SelectValue /></SelectTrigger>
                <SelectContent>{JENIS_LIST.map(j => <SelectItem key={j} value={j} className="font-mono text-xs">{{ AMDAL:"AMDAL", UKL_UPL:"UKL/UPL", SPPL:"SPPL", CARBON_PROJECT:"Carbon Project", GREEN_BOND:"Green Bond", PROPER:"PROPER" }[j] ?? j.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Sektor</Label>
              <Select value={form.sektor} onValueChange={s("sektor")}>
                <SelectTrigger className="font-mono text-xs" aria-label="Pilih sektor lingkungan"><SelectValue /></SelectTrigger>
                <SelectContent>{SEKTOR_LIST.map(s => <SelectItem key={s} value={s} className="font-mono text-xs">{{ EBT:"EBT", TAMBANG:"Pertambangan", INDUSTRI:"Industri", INFRASTRUKTUR:"Infrastruktur", PERTANIAN:"Pertanian", KEHUTANAN:"Kehutanan", MIGAS:"Migas", PROPERTI:"Properti" }[s] ?? s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Status AMDAL</Label>
              <Select value={form.statusAmdal} onValueChange={s("statusAmdal")}>
                <SelectTrigger className="font-mono text-xs" aria-label="Pilih status AMDAL"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="" className="font-mono text-xs">Tidak Relevan</SelectItem>
                  {STATUS_AMDAL.map(s => <SelectItem key={s} value={s} className="font-mono text-xs">{{ PENGAJUAN:"Pengajuan", PROSES:"Dalam Proses", DISETUJUI:"Disetujui", DITOLAK:"Ditolak" }[s] ?? s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Peringkat PROPER</Label>
              <Select value={form.peringkatProper} onValueChange={s("peringkatProper")}>
                <SelectTrigger className="font-mono text-xs" aria-label="Pilih peringkat PROPER"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="" className="font-mono text-xs">Tidak Relevan</SelectItem>
                  {PERINGKAT_PROPER.map(p => <SelectItem key={p} value={p} className="font-mono text-xs">{PERINGKAT_PROPER_LABEL[p] ?? p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-mono">Pemrakarsa</Label>
            <Input value={form.pemrakarsa} onChange={f("pemrakarsa")} maxLength={255} placeholder="PT Pemrakarsa Proyek" className="font-mono text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Provinsi</Label>
              <Input value={form.provinsi} onChange={f("provinsi")} maxLength={100} placeholder="Sulawesi Tengah" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Tahun</Label>
              <Input value={form.tahun} onChange={f("tahun")} maxLength={4} placeholder="2024" className="font-mono text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Nilai Karbon (tCO₂e)</Label>
              <Input value={form.nilaiKarbon} onChange={f("nilaiKarbon")} type="number" onWheel={(e) => e.currentTarget.blur()} min="0" placeholder="50000" maxLength={20} className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Nilai Proyek (Juta Rp)</Label>
              <Input value={form.nilaiProyek} onChange={f("nilaiProyek")} type="number" onWheel={(e) => e.currentTarget.blur()} min="0" placeholder="100000" maxLength={20} className="font-mono text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-mono">URL Sumber</Label>
            <Input value={form.sourceUrl} onChange={f("sourceUrl")} maxLength={500} placeholder="https://amdalnet.menlhk.go.id/…" className="font-mono text-sm" onFocus={(e) => e.target.select()} />
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

export default function ModulLingkungan() {
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
  const [filterJenis, setFilterJenis] = useState("__all__");
  const [filterSektor, setFilterSektor] = useState("__all__");
  const qc = useQueryClient();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "amdal" | "carbon" | "proper">("all");

  const { data: projects = [], isLoading, isError } = useListEnvironmentProjects();

  const invalidate = () => void qc.invalidateQueries({ queryKey: getListEnvironmentProjectsQueryKey() });

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (deferredSearch && !p.judul.toLowerCase().includes(deferredSearch.toLowerCase()) && !(p.pemrakarsa ?? "").toLowerCase().includes(deferredSearch.toLowerCase()) && !(p.provinsi ?? "").toLowerCase().includes(deferredSearch.toLowerCase())) return false;
      if (filterJenis !== "__all__" && p.jenis !== filterJenis) return false;
      if (filterSektor !== "__all__" && p.sektor !== filterSektor) return false;
      return true;
    });
  }, [projects, search, filterJenis, filterSektor]);

  // Stats
  const totalAmdal = projects.filter(p => p.jenis === "AMDAL").length;
  const amdalDisetujui = projects.filter(p => p.jenis === "AMDAL" && p.statusAmdal === "DISETUJUI").length;
  const carbonProjects = projects.filter(p => p.jenis === "CARBON_PROJECT").length;
  const totalKarbon = projects.filter(p => p.nilaiKarbon != null).reduce((s, p) => s + (p.nilaiKarbon ?? 0), 0);
  const properEmasHijau = projects.filter(p => ["EMAS", "HIJAU"].includes(p.peringkatProper ?? "")).length;

  // AMDAL tab items
  const amdalItems = filtered.filter(p => ["AMDAL", "UKL_UPL", "SPPL"].includes(p.jenis));
  const carbonItems = filtered.filter(p => ["CARBON_PROJECT", "GREEN_BOND"].includes(p.jenis));
  const properItems = filtered.filter(p => p.jenis === "PROPER");
  const allItems = filtered;

  return (
    <Shell>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Cluster Industri</span>
            <span className="text-xs font-mono text-muted-foreground">/</span>
            <span className="text-xs font-mono text-primary font-semibold">LINGKUNGAN</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Leaf className="h-6 w-6 text-green-600" />
            Modul Lingkungan & Transisi Energi
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            AMDAL Pipeline · Bursa Karbon Indonesia · PROPER · Green Bond
          </p>
          <p className="text-xs text-muted-foreground/70 font-mono mt-0.5">{projects.length} entri · {[...new Set(projects.map(p => p.provinsi).filter(Boolean))].length} provinsi</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs font-mono text-muted-foreground mb-1">TOTAL AMDAL</div>
              <div className="text-2xl font-bold font-mono">{totalAmdal}</div>
              <div className="text-xs text-muted-foreground mt-0.5"><span className="text-green-600 font-semibold">{amdalDisetujui}</span> disetujui</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 hover:shadow-sm transition-shadow">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs font-mono text-muted-foreground mb-1">PROYEK KARBON</div>
              <div className="text-2xl font-bold font-mono text-green-600">{carbonProjects}</div>
              <div className="text-xs text-muted-foreground mt-0.5">kredit karbon & green bond</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500 hover:shadow-sm transition-shadow">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs font-mono text-muted-foreground mb-1">TOTAL KARBON</div>
              <div className="text-2xl font-bold font-mono">
                {totalKarbon >= 1000000
                  ? `${(totalKarbon / 1000000).toFixed(1)}M`
                  : totalKarbon >= 1000 ? `${(totalKarbon / 1000).toFixed(0)}K`
                  : totalKarbon.toFixed(0)}
                <span className="text-xs font-normal text-muted-foreground ml-1">tCO₂e</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">nilai karbon terdata</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-yellow-500 hover:shadow-sm transition-shadow">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs font-mono text-muted-foreground mb-1">PROPER HIJAU+</div>
              <div className="text-2xl font-bold font-mono text-yellow-600">{properEmasHijau}</div>
              <div className="text-xs text-muted-foreground mt-0.5">peringkat Emas &amp; Hijau</div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input ref={searchRef} placeholder="Cari proyek, pemrakarsa… · Esc reset" title="Tekan / untuk fokus ke pencarian" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { setSearch(""); e.currentTarget.blur(); } }} className="pl-8 pr-10 font-mono text-xs h-8" />
            {search ? (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Hapus pencarian">
                <X className="h-3 w-3" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-70 sm:flex">/</kbd>
            )}
          </div>
          <Select value={filterJenis} onValueChange={setFilterJenis}>
            <SelectTrigger className="w-36 font-mono text-xs h-8" aria-label="Filter jenis dokumen lingkungan"><SelectValue placeholder="Jenis" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" className="font-mono text-xs">Semua Jenis</SelectItem>
              {JENIS_LIST.map(j => <SelectItem key={j} value={j} className="font-mono text-xs">{{ AMDAL:"AMDAL", UKL_UPL:"UKL/UPL", SPPL:"SPPL", CARBON_PROJECT:"Carbon Project", GREEN_BOND:"Green Bond", PROPER:"PROPER" }[j] ?? j.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSektor} onValueChange={setFilterSektor}>
            <SelectTrigger className="w-36 font-mono text-xs h-8" aria-label="Filter sektor lingkungan"><SelectValue placeholder="Sektor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" className="font-mono text-xs">Semua Sektor</SelectItem>
              {SEKTOR_LIST.map(s => <SelectItem key={s} value={s} className="font-mono text-xs">{{ EBT:"EBT", TAMBANG:"Pertambangan", INDUSTRI:"Industri", INFRASTRUKTUR:"Infrastruktur", PERTANIAN:"Pertanian", KEHUTANAN:"Kehutanan", MIGAS:"Migas", PROPERTI:"Properti" }[s] ?? s}</SelectItem>)}
            </SelectContent>
          </Select>
          {(search || filterJenis !== "__all__" || filterSektor !== "__all__") && (
            <button
              onClick={() => { setSearch(""); setFilterJenis("__all__"); setFilterSektor("__all__"); }}
              className="h-8 px-2.5 text-[10px] font-mono font-bold rounded-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors shrink-0"
              title="Reset filter"
            >✕ Reset</button>
          )}
          <p className="text-[10px] font-mono text-muted-foreground ml-auto">{filtered.length} dari {projects.length} entri</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="font-mono text-xs">
            <TabsTrigger value="all">Semua ({allItems.length})</TabsTrigger>
            <TabsTrigger value="amdal">AMDAL/UKL ({amdalItems.length})</TabsTrigger>
            <TabsTrigger value="carbon">Karbon &amp; Bond ({carbonItems.length})</TabsTrigger>
            <TabsTrigger value="proper">PROPER ({properItems.length})</TabsTrigger>
          </TabsList>

          {(["all", "amdal", "carbon", "proper"] as const).map((tab) => {
            const rows = tab === "all" ? allItems : tab === "amdal" ? amdalItems : tab === "carbon" ? carbonItems : properItems;
            return (
              <TabsContent key={tab} value={tab} className="mt-4">
                <Card>
                  <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-mono">
                      {tab === "all" ? "Semua Proyek Lingkungan" : tab === "amdal" ? "Pipeline AMDAL & UKL-UPL" : tab === "carbon" ? "Proyek Karbon & Green Bond" : "Peringkat PROPER"}
                      <span className="ml-2 text-xs text-muted-foreground font-normal">({rows.length} entri)</span>
                    </CardTitle>
                    {tab === "all" && <AddEnvDialog onSuccess={invalidate} open={isAddOpen} onOpenChange={setIsAddOpen} />}
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLoading ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader><TableRow className="font-mono text-xs sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]"><TableHead>Judul Proyek</TableHead><TableHead>Jenis</TableHead><TableHead>Sektor</TableHead><TableHead>Pemrakarsa</TableHead><TableHead>Status/Peringkat</TableHead><TableHead>Provinsi</TableHead><TableHead className="text-right">Karbon</TableHead><TableHead>Tahun</TableHead><TableHead /></TableRow></TableHeader>
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
                    ) : rows.length === 0 ? (
                      <div className="animate-in fade-in duration-200 flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                        <Search className="h-8 w-8 opacity-30" />
                        <div className="text-center">
                          <p className="font-mono text-sm">{projects.length === 0 ? "Belum ada data lingkungan" : "Tidak ada proyek yang cocok dengan filter"}</p>
                          <p className="text-xs mt-1">{projects.length === 0 ? "Tambahkan data dari AMDAL Net, IDX Carbon, atau KLHK PROPER" : "Coba ubah kata kunci atau filter jenis/sektor"}</p>
                        </div>
                        {projects.length > 0 && (
                          <button onClick={() => { setSearch(""); setFilterJenis("__all__"); setFilterSektor("__all__"); setActiveTab("all"); }} className="text-xs font-mono text-primary hover:underline mt-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none">✕ Reset semua filter</button>
                        )}
                        {projects.length === 0 && tab === "all" ? (
                          <Button size="sm" variant="outline" onClick={() => setIsAddOpen(true)} className="font-mono text-xs gap-1.5 mt-1">
                            <Plus className="h-3.5 w-3.5" /> Tambah Entri <kbd className="text-[9px] font-mono opacity-60 border border-current/30 rounded px-1">N</kbd>
                          </Button>
                        ) : projects.length > 0 && (
                          <Button size="sm" variant="ghost" onClick={() => setActiveTab("all")} className="font-mono text-xs gap-1 mt-1 text-muted-foreground">
                            Lihat semua tab
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="font-mono text-xs sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                              <TableHead>Judul Proyek</TableHead>
                              <TableHead>Jenis</TableHead>
                              <TableHead>Sektor</TableHead>
                              <TableHead>Pemrakarsa</TableHead>
                              <TableHead>Status/Peringkat</TableHead>
                              <TableHead>Provinsi</TableHead>
                              <TableHead className="text-right">Karbon (tCO₂e)</TableHead>
                              <TableHead>Tahun</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((p) => (
                              <TableRow key={p.id} className={`font-mono text-xs group transition-colors${p.statusAmdal === "DITOLAK" ? " bg-red-50/20 hover:bg-red-50/40" : p.statusAmdal === "APPROVED" ? " bg-emerald-50/10 hover:bg-emerald-50/20" : " hover:bg-muted/40"}`}>
                                <TableCell className="font-medium max-w-xs">
                                  <div className="flex items-center gap-1.5">
                                    <span className="truncate" title={p.judul}>{p.judul}</span>
                                    <button onClick={e => { e.stopPropagation(); void navigator.clipboard.writeText(p.judul).then(() => toast.success("Judul disalin", { duration: 1200 })); }} aria-label="Salin judul proyek" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all shrink-0 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none" title="Salin judul"><Copy className="h-2.5 w-2.5" /></button>
                                    {p.createdAt && (Date.now() - new Date(p.createdAt).getTime()) < 7 * 86400000 && (
                                      <span className="text-[8px] font-mono bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded-sm border border-emerald-200 shrink-0">Baru</span>
                                    )}
                                    {p.createdAt && <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-mono text-muted-foreground shrink-0 whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" })}</span>}
                                  </div>
                                  {p.catatan && <div className="text-muted-foreground text-xs truncate" title={p.catatan}>{p.catatan}</div>}
                                </TableCell>
                                <TableCell><JenisBadge jenis={p.jenis} /></TableCell>
                                <TableCell>
                                  {p.sektor ? <Badge variant="outline" className="text-xs font-mono">{p.sektor}</Badge> : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell>
                                  {p.pemrakarsa ? (
                                    <span className="flex items-center gap-1"><Building2 className="h-3 w-3 text-muted-foreground shrink-0" /><span className="truncate max-w-24" title={p.pemrakarsa}>{p.pemrakarsa}</span></span>
                                  ) : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell>
                                  {p.statusAmdal ? (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-mono font-semibold ${amdalColor[p.statusAmdal] ?? "bg-gray-100 text-gray-800"}`}>
                                      {{ SUDAH_AMDAL:"Sudah AMDAL", UKL_UPL:"UKL/UPL", PROSES:"Dalam Proses", BELUM:"Belum", SPPL:"SPPL" }[p.statusAmdal] ?? (p.statusAmdal ?? "—")}
                                    </span>
                                  ) : p.peringkatProper ? (
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-mono font-semibold ${properColor[p.peringkatProper] ?? "bg-gray-100 text-gray-800"}`}>
                                      <Leaf className="h-3 w-3" />{p.peringkatProper}
                                    </span>
                                  ) : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell>
                                  {p.provinsi ? (
                                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-muted-foreground" />{p.provinsi}</span>
                                  ) : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell className="text-right whitespace-nowrap">
                                  {p.nilaiKarbon != null ? (
                                    <span className="font-semibold font-mono text-green-700" title={`${p.nilaiKarbon.toLocaleString("id-ID")} tCO2e (ton CO₂ ekuivalen)`}>{p.nilaiKarbon.toLocaleString("id-ID")}</span>
                                  ) : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {p.tahun ? (
                                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-muted-foreground" />{p.tahun}</span>
                                  ) : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell>
                                  {p.sourceUrl && (
                                    <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label="Buka sumber proyek lingkungan" title="Buka sumber proyek lingkungan" className="opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm">
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
              </TabsContent>
            );
          })}
        </Tabs>

        {/* Info Footer */}
        <div className="rounded-sm border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900/30 p-4">
          <div className="flex gap-3">
            <TreePine className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
            <div className="text-xs font-mono text-green-800 dark:text-green-200 space-y-1">
              <p className="font-semibold">Sumber Data Utama Cluster Lingkungan:</p>
              <p>KLHK AMDAL Net (amdalnet.menlhk.go.id) · IDX Carbon (idxcarbon.co.id) · KLHK PROPER · Green Network Indonesia · Mongabay Indonesia</p>
              <p className="text-green-600 dark:text-green-400">Modul ini tracking pipeline izin lingkungan, kredit karbon, dan compliance ESG perusahaan Indonesia.</p>
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
