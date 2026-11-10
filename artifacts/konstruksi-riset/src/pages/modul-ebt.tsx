import { useState, useMemo, useRef, useEffect, useDeferredValue } from "react";
import { toast } from "sonner";
import {
  useListEbtProjects,
  useListEbtTenders,
  useCreateEbtProject,
  useCreateEbtTender,
  getListEbtProjectsQueryKey,
  getListEbtTendersQueryKey,
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
  Zap, BarChart3, TrendingUp, Building2, MapPin, Calendar, Plus, Search,
  ExternalLink, AlertCircle, ChevronUp, Loader2, Wind, Sun, Droplets, Flame, Leaf, X, Copy,
} from "lucide-react";

// ─── helpers ─────────────────────────────────────────────────────────────────

const TEKNOLOGI_LIST = ["PLTS", "PLTB", "PLTA", "PLTM", "PLTBG", "PLTBm", "PLTMH", "HYBRID", "STORAGE", "TRANSMISI"];
const STATUS_PROYEK = ["PLANNING", "CONSTRUCTION", "OPERATIONAL", "CANCELLED"];
const STATUS_TENDER = ["OPEN", "CLOSED", "AWARDED", "CANCELLED"];

const teknologiColor: Record<string, string> = {
  PLTS: "bg-yellow-100 text-yellow-800 border-yellow-200",
  PLTB: "bg-sky-100 text-sky-800 border-sky-200",
  PLTA: "bg-blue-100 text-blue-800 border-blue-200",
  PLTM: "bg-indigo-100 text-indigo-800 border-indigo-200",
  PLTBG: "bg-green-100 text-green-800 border-green-200",
  PLTBm: "bg-lime-100 text-lime-800 border-lime-200",
  PLTMH: "bg-teal-100 text-teal-800 border-teal-200",
  HYBRID: "bg-purple-100 text-purple-800 border-purple-200",
  STORAGE: "bg-orange-100 text-orange-800 border-orange-200",
  TRANSMISI: "bg-gray-100 text-gray-800 border-gray-200",
};

const statusColor: Record<string, string> = {
  PLANNING: "bg-yellow-100 text-yellow-800",
  CONSTRUCTION: "bg-blue-100 text-blue-800",
  OPERATIONAL: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  OPEN: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-gray-100 text-gray-800",
  AWARDED: "bg-purple-100 text-purple-800",
};

const teknologiIcon: Record<string, React.ReactNode> = {
  PLTS: <Sun className="h-3.5 w-3.5" />,
  PLTB: <Wind className="h-3.5 w-3.5" />,
  PLTA: <Droplets className="h-3.5 w-3.5" />,
  PLTM: <Droplets className="h-3.5 w-3.5" />,
  PLTBG: <Flame className="h-3.5 w-3.5" />,
  PLTBm: <Leaf className="h-3.5 w-3.5" />,
};

function TekBadge({ tek }: { tek: string }) {
  return (
    <span title={tek} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-mono font-semibold border ${teknologiColor[tek] ?? "bg-gray-100 text-gray-800 border-gray-200"}`}>
      {teknologiIcon[tek] ?? <Zap className="h-3.5 w-3.5" />}
      {tek}
    </span>
  );
}

const STATUS_LABELS: Record<string, string> = {
  PLANNING: "Perencanaan", CONSTRUCTION: "Konstruksi", OPERATIONAL: "Operasional",
  SUSPENDED: "Ditangguhkan", CANCELLED: "Dibatalkan", COMPLETED: "Selesai",
  OPEN: "Terbuka", CLOSED: "Tertutup", ACTIVE: "Aktif", INACTIVE: "Tidak Aktif",
};
function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-mono font-semibold ${statusColor[status] ?? "bg-gray-100 text-gray-800"}`} title={STATUS_LABELS[status] ? `${STATUS_LABELS[status]} (${status})` : status}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Add Proyek Dialog ────────────────────────────────────────────────────────

function AddProyekDialog({ onSuccess, open: controlledOpen, onOpenChange }: { onSuccess: () => void; open?: boolean; onOpenChange?: (v: boolean) => void; }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [form, setForm] = useState({ judul: "", teknologi: "PLTS", kapasitasMw: "", status: "PLANNING", provinsi: "", lokasi: "", tahunTarget: "", pemrakarsa: "", jenisPemrakarsa: "IPP", sumber: "", sourceUrl: "", catatan: "" });
  const createMut = useCreateEbtProject();
  const [touched, setTouched] = useState(false);
  const handleOpenChange = (v: boolean) => { setOpen(v); if (!v) setTouched(false); };

  const handleSubmit = () => {
    if (!form.judul.trim()) { setTouched(true); return; }
    createMut.mutate(
      { data: { ...form, kapasitasMw: form.kapasitasMw ? parseFloat(form.kapasitasMw) : undefined } },
      {
        onSuccess: (data) => { setOpen(false); onSuccess(); setForm({ judul: "", teknologi: "PLTS", kapasitasMw: "", status: "PLANNING", provinsi: "", lokasi: "", tahunTarget: "", pemrakarsa: "", jenisPemrakarsa: "IPP", sumber: "", sourceUrl: "", catatan: "" }); toast.success("Proyek EBT ditambahkan", { description: data.judul, duration: 2500 }); },
        onError: (err: unknown) => toast.error("Gagal menyimpan proyek EBT", { description: err instanceof Error ? err.message : "Coba lagi" }),
      }
    );
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));
  const s = (k: string) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-mono text-xs gap-1.5"><Plus className="h-3.5 w-3.5" /> Tambah Proyek <kbd className="pointer-events-none ml-1 hidden h-4 items-center gap-0.5 rounded border bg-muted px-1 font-mono text-[10px] opacity-70 sm:flex">N</kbd></Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-mono">Tambah Proyek EBT</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-mono">Judul Proyek *</Label>
            <Input value={form.judul} onChange={f("judul")} onBlur={() => setTouched(true)} maxLength={255} placeholder="Contoh: PLTS Saguling 50 MW" className={`font-mono text-sm${touched && !form.judul.trim() ? " border-destructive focus-visible:ring-destructive" : ""}`} autoFocus />
            {touched && !form.judul.trim() && <p className="text-xs text-red-500 font-mono">Judul wajib diisi</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Teknologi</Label>
              <Select value={form.teknologi} onValueChange={s("teknologi")}>
                <SelectTrigger className="font-mono text-xs" aria-label="Pilih teknologi EBT"><SelectValue /></SelectTrigger>
                <SelectContent>{TEKNOLOGI_LIST.map(t => <SelectItem key={t} value={t} className="font-mono text-xs">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Kapasitas (MW)</Label>
              <Input value={form.kapasitasMw} onChange={f("kapasitasMw")} type="number" onWheel={(e) => e.currentTarget.blur()} min="0" placeholder="50" maxLength={20} className="font-mono text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Status</Label>
              <Select value={form.status} onValueChange={s("status")}>
                <SelectTrigger className="font-mono text-xs" aria-label="Pilih status proyek"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_PROYEK.map(s => <SelectItem key={s} value={s} className="font-mono text-xs">{STATUS_LABELS[s] ?? s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Jenis Pemrakarsa</Label>
              <Select value={form.jenisPemrakarsa} onValueChange={s("jenisPemrakarsa")}>
                <SelectTrigger className="font-mono text-xs" aria-label="Pilih jenis pemrakarsa"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["IPP", "PLN", "PEMERINTAH", "SWASTA"].map(j => <SelectItem key={j} value={j} className="font-mono text-xs">{j}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Provinsi</Label>
              <Input value={form.provinsi} onChange={f("provinsi")} maxLength={100} placeholder="Jawa Barat" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Tahun Target</Label>
              <Input value={form.tahunTarget} onChange={f("tahunTarget")} maxLength={4} placeholder="2026" className="font-mono text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-mono">Pemrakarsa</Label>
            <Input value={form.pemrakarsa} onChange={f("pemrakarsa")} maxLength={255} placeholder="PT ABC Energy" className="font-mono text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-mono">URL Sumber</Label>
            <Input value={form.sourceUrl} onChange={f("sourceUrl")} maxLength={500} placeholder="https://…" className="font-mono text-sm" onFocus={(e) => e.target.select()} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-mono">Catatan</Label>
            <Textarea value={form.catatan} onChange={f("catatan")} onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); }} onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }} rows={2} className="font-mono text-xs resize-none" maxLength={300} />
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

// ─── Add Tender Dialog ────────────────────────────────────────────────────────

function AddTenderDialog({ onSuccess, open: controlledOpen, onOpenChange }: { onSuccess: () => void; open?: boolean; onOpenChange?: (v: boolean) => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [form, setForm] = useState({ judul: "", klien: "PLN", teknologi: "PLTS", nilaiEstimasi: "", provinsi: "", deadline: "", status: "OPEN", sumber: "", sourceUrl: "", catatan: "" });
  const createMut = useCreateEbtTender();
  const [touched, setTouched] = useState(false);
  const handleOpenChange = (v: boolean) => { setOpen(v); if (!v) setTouched(false); };

  const handleSubmit = () => {
    if (!form.judul.trim()) { setTouched(true); return; }
    createMut.mutate(
      { data: { ...form, nilaiEstimasi: form.nilaiEstimasi ? parseFloat(form.nilaiEstimasi) : undefined } },
      {
        onSuccess: (data) => { setOpen(false); onSuccess(); setForm({ judul: "", klien: "PLN", teknologi: "PLTS", nilaiEstimasi: "", provinsi: "", deadline: "", status: "OPEN", sumber: "", sourceUrl: "", catatan: "" }); toast.success("Tender EBT ditambahkan", { description: data.judul, duration: 2500 }); },
        onError: (err: unknown) => toast.error("Gagal menyimpan tender EBT", { description: err instanceof Error ? err.message : "Coba lagi" }),
      }
    );
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));
  const s = (k: string) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-mono text-xs gap-1.5"><Plus className="h-3.5 w-3.5" /> Tambah Tender <kbd className="pointer-events-none ml-1 hidden h-4 items-center gap-0.5 rounded border bg-muted px-1 font-mono text-[10px] opacity-70 sm:flex">N</kbd></Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-mono">Tambah Tender PLN EBT</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-mono">Judul Tender *</Label>
            <Input value={form.judul} onChange={f("judul")} onBlur={() => setTouched(true)} maxLength={255} placeholder="Contoh: Pengadaan Jasa EPC PLTS Ibu Kota Nusantara" className={`font-mono text-sm${touched && !form.judul.trim() ? " border-destructive focus-visible:ring-destructive" : ""}`} autoFocus />
            {touched && !form.judul.trim() && <p className="text-xs text-red-500 font-mono">Judul wajib diisi</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Klien</Label>
              <Input value={form.klien} onChange={f("klien")} maxLength={255} placeholder="PLN" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Teknologi</Label>
              <Select value={form.teknologi} onValueChange={s("teknologi")}>
                <SelectTrigger className="font-mono text-xs" aria-label="Pilih teknologi tender EBT"><SelectValue /></SelectTrigger>
                <SelectContent>{TEKNOLOGI_LIST.map(t => <SelectItem key={t} value={t} className="font-mono text-xs">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Nilai Estimasi (Juta Rp)</Label>
              <Input value={form.nilaiEstimasi} onChange={f("nilaiEstimasi")} type="number" onWheel={(e) => e.currentTarget.blur()} min="0" placeholder="50000" maxLength={20} className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Status</Label>
              <Select value={form.status} onValueChange={s("status")}>
                <SelectTrigger className="font-mono text-xs" aria-label="Pilih status tender EBT"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_TENDER.map(s => <SelectItem key={s} value={s} className="font-mono text-xs">{STATUS_LABELS[s] ?? s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Provinsi</Label>
              <Input value={form.provinsi} onChange={f("provinsi")} maxLength={100} placeholder="Kalimantan Timur" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Deadline</Label>
              <Input value={form.deadline} onChange={f("deadline")} type="date" className="font-mono text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-mono">URL Sumber</Label>
            <Input value={form.sourceUrl} onChange={f("sourceUrl")} maxLength={500} placeholder="https://eproc.pln.co.id/…" className="font-mono text-sm" onFocus={(e) => e.target.select()} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-mono">Catatan</Label>
            <Textarea value={form.catatan} onChange={f("catatan")} onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); }} onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }} rows={2} className="font-mono text-xs resize-none" maxLength={300} />
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

export default function ModulEbt() {
  const [isAddProyekOpen, setIsAddProyekOpen] = useState(false);
  const [isAddTenderOpen, setIsAddTenderOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "n" && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setIsAddProyekOpen(true); setIsAddTenderOpen(false); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [filterTek, setFilterTek] = useState("__all__");
  const [filterStatus, setFilterStatus] = useState("__all__");
  const qc = useQueryClient();

  const { data: projects = [], isLoading: loadingProjects, isError: errorProjects } = useListEbtProjects();
  const { data: tenders = [], isLoading: loadingTenders, isError: errorTenders } = useListEbtTenders();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: getListEbtProjectsQueryKey() });
    void qc.invalidateQueries({ queryKey: getListEbtTendersQueryKey() });
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (deferredSearch && !p.judul.toLowerCase().includes(deferredSearch.toLowerCase()) && !(p.pemrakarsa ?? "").toLowerCase().includes(deferredSearch.toLowerCase()) && !(p.provinsi ?? "").toLowerCase().includes(deferredSearch.toLowerCase())) return false;
      if (filterTek !== "__all__" && p.teknologi !== filterTek) return false;
      if (filterStatus !== "__all__" && p.status !== filterStatus) return false;
      return true;
    });
  }, [projects, search, filterTek, filterStatus]);

  const filteredTenders = useMemo(() => {
    return tenders.filter((t) => {
      if (deferredSearch && !t.judul.toLowerCase().includes(deferredSearch.toLowerCase()) && !(t.klien ?? "").toLowerCase().includes(deferredSearch.toLowerCase())) return false;
      if (filterTek !== "__all__" && t.teknologi !== filterTek) return false;
      if (filterStatus !== "__all__" && t.status !== filterStatus) return false;
      return true;
    });
  }, [tenders, search, filterTek, filterStatus]);

  // Summary stats
  const totalMw = projects.filter(p => p.status !== "CANCELLED").reduce((s, p) => s + (p.kapasitasMw ?? 0), 0);
  const operasional = projects.filter(p => p.status === "OPERATIONAL").length;
  const konstruksi = projects.filter(p => p.status === "CONSTRUCTION").length;
  const tenderOpen = tenders.filter(t => t.status === "OPEN").length;

  return (
    <Shell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Cluster Industri</span>
              <span className="text-xs font-mono text-muted-foreground">/</span>
              <span className="text-xs font-mono text-primary font-semibold">EBT</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Zap className="h-6 w-6 text-yellow-500" />
              Modul EBT — Energi Baru Terbarukan
            </h1>
            <p className="text-sm text-muted-foreground mt-1 font-mono">
              Pipeline RUPTL · Tender PLN · IPP Registry · Sinyal Sektor
            </p>
            <p className="text-xs text-muted-foreground/70 font-mono mt-0.5">{projects.length} proyek · {tenders.length} tender · {[...new Set(projects.map(p => p.provinsi).filter(Boolean))].length} provinsi</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="border-l-4 border-l-yellow-500 hover:shadow-sm transition-shadow">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs font-mono text-muted-foreground mb-1">TOTAL KAPASITAS</div>
              <div className="text-2xl font-bold font-mono">{totalMw.toLocaleString("id-ID", { maximumFractionDigits: 0 })} <span className="text-sm font-normal text-muted-foreground">MW</span></div>
              <div className="text-xs text-muted-foreground mt-0.5">di pipeline aktif</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 hover:shadow-sm transition-shadow">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs font-mono text-muted-foreground mb-1">OPERASIONAL</div>
              <div className="text-2xl font-bold font-mono text-green-600">{operasional}</div>
              <div className="text-xs text-muted-foreground mt-0.5">proyek aktif beroperasi</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500 hover:shadow-sm transition-shadow">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs font-mono text-muted-foreground mb-1">KONSTRUKSI</div>
              <div className="text-2xl font-bold font-mono text-blue-600">{konstruksi}</div>
              <div className="text-xs text-muted-foreground mt-0.5">sedang dibangun</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500 hover:shadow-sm transition-shadow">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs font-mono text-muted-foreground mb-1">TENDER TERBUKA</div>
              <div className="text-2xl font-bold font-mono text-emerald-600">{tenderOpen}</div>
              <div className="text-xs text-muted-foreground mt-0.5">peluang aktif PLN</div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Cari proyek, pemrakarsa, provinsi… · Esc reset"
              title="Tekan / untuk fokus ke pencarian"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearch(""); e.currentTarget.blur(); } }}
              className="pl-8 pr-10 font-mono text-xs h-8"
            />
            {search ? (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none" aria-label="Hapus pencarian" title="Hapus pencarian">
                <X className="h-3 w-3" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-70 sm:flex">/</kbd>
            )}
          </div>
          <Select value={filterTek} onValueChange={setFilterTek}>
            <SelectTrigger className="w-36 font-mono text-xs h-8" aria-label="Filter teknologi EBT">
              <SelectValue placeholder="Teknologi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" className="font-mono text-xs">Semua Teknologi</SelectItem>
              {TEKNOLOGI_LIST.map(t => <SelectItem key={t} value={t} className="font-mono text-xs">{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 font-mono text-xs h-8" aria-label="Filter status proyek EBT">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" className="font-mono text-xs">Semua Status</SelectItem>
              {[...STATUS_PROYEK, ...STATUS_TENDER.filter(s => !STATUS_PROYEK.includes(s))].map(s => <SelectItem key={s} value={s} className="font-mono text-xs">{STATUS_LABELS[s] ?? s}</SelectItem>)}
            </SelectContent>
          </Select>
          {(search || filterTek !== "__all__" || filterStatus !== "__all__") && (
            <button
              onClick={() => { setSearch(""); setFilterTek("__all__"); setFilterStatus("__all__"); }}
              className="h-8 px-2.5 text-[10px] font-mono font-bold rounded-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 outline-none"
              title="Reset filter"
            >✕ Reset</button>
          )}
          <p className="text-[10px] font-mono text-muted-foreground ml-auto">{filteredProjects.length + filteredTenders.length} dari {projects.length + tenders.length} item</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="projects">
          <TabsList className="font-mono text-xs">
            <TabsTrigger value="projects">Pipeline RUPTL / IPP ({filteredProjects.length !== projects.length ? `${filteredProjects.length} / ${projects.length}` : projects.length})</TabsTrigger>
            <TabsTrigger value="tenders">Tender PLN ({filteredTenders.length !== tenders.length ? `${filteredTenders.length} / ${tenders.length}` : tenders.length})</TabsTrigger>
          </TabsList>

          {/* Projects Tab */}
          <TabsContent value="projects" className="mt-4">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-mono">
                  Proyek RUPTL & IPP Registry
                  <span className="ml-2 text-xs text-muted-foreground font-normal">({filteredProjects.length} entri)</span>
                </CardTitle>
                <AddProyekDialog onSuccess={invalidate} open={isAddProyekOpen} onOpenChange={setIsAddProyekOpen} />
              </CardHeader>
              <CardContent className="p-0">
                {loadingProjects ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow className="font-mono text-xs sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]"><TableHead>Judul Proyek</TableHead><TableHead>Teknologi</TableHead><TableHead className="text-right">Kapasitas</TableHead><TableHead>Status</TableHead><TableHead>Provinsi</TableHead><TableHead>Tahun</TableHead><TableHead>Pemrakarsa</TableHead><TableHead /></TableRow></TableHeader>
                      <TableBody>{Array.from({ length: 5 }).map((_, i) => (<TableRow key={i} className="animate-pulse">{Array.from({ length: 8 }).map((__, j) => (<TableCell key={j}><div className="h-3 bg-muted rounded w-20" /></TableCell>))}</TableRow>))}</TableBody>
                    </Table>
                  </div>
                ) : errorProjects ? (
                  <div className="flex items-center justify-center py-16 gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" /><span className="font-mono text-sm">Gagal memuat data</span>
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <div className="animate-in fade-in duration-200 flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                    <Search className="h-8 w-8 opacity-30" />
                    <div className="text-center">
                      <p className="font-mono text-sm">{projects.length === 0 ? "Belum ada data proyek EBT" : "Tidak ada proyek yang cocok dengan filter"}</p>
                      <p className="text-xs mt-1">{projects.length === 0 ? "Tambahkan proyek RUPTL atau IPP untuk memulai tracking" : "Coba ubah kata kunci atau filter teknologi"}</p>
                    </div>
                    {projects.length > 0 && (
                      <button onClick={() => { setSearch(""); setFilterTek("__all__"); setFilterStatus("__all__"); }} className="text-xs font-mono text-primary hover:underline mt-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none">✕ Reset semua filter</button>
                    )}
                    {projects.length === 0 && (
                      <Button size="sm" variant="outline" onClick={() => setIsAddProyekOpen(true)} className="font-mono text-xs gap-1.5 mt-1">
                        <Plus className="h-3.5 w-3.5" /> Tambah Proyek EBT <kbd className="text-[9px] font-mono opacity-60 border border-current/30 rounded px-1">N</kbd>
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="font-mono text-xs sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                          <TableHead>Judul Proyek</TableHead>
                          <TableHead>Teknologi</TableHead>
                          <TableHead className="text-right">Kapasitas</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Pemrakarsa</TableHead>
                          <TableHead>Provinsi</TableHead>
                          <TableHead>Target</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProjects.map((p) => (
                          <TableRow key={p.id} className="font-mono text-xs group hover:bg-muted/40 transition-colors">
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
                            <TableCell><TekBadge tek={p.teknologi} /></TableCell>
                            <TableCell className="text-right">
                              {p.kapasitasMw != null ? (
                                <span className="font-semibold font-mono" title={`${p.kapasitasMw.toFixed(1)} Megawatt (MW)`}>{p.kapasitasMw.toFixed(1)} <span className="text-muted-foreground font-normal">MW</span></span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell><StatusBadge status={p.status} /></TableCell>
                            <TableCell>
                              <div title={p.pemrakarsa ?? undefined}>{p.pemrakarsa ?? <span className="text-muted-foreground">—</span>}</div>
                              {p.jenisPemrakarsa && <Badge variant="outline" className="text-xs font-mono mt-0.5">{p.jenisPemrakarsa}</Badge>}
                            </TableCell>
                            <TableCell>
                              {p.provinsi ? (
                                <span className="flex items-center gap-1" title={p.provinsi ?? undefined}><MapPin className="h-3 w-3 text-muted-foreground" />{p.provinsi}</span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {p.tahunTarget ? (
                                <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-muted-foreground" />{p.tahunTarget}</span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              {p.sourceUrl && (
                                <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label="Buka sumber proyek" title="Buka sumber proyek" className="opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm">
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

          {/* Tenders Tab */}
          <TabsContent value="tenders" className="mt-4">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-mono">
                  Tender PLN — EBT & Infrastruktur Listrik
                  <span className="ml-2 text-xs text-muted-foreground font-normal">({filteredTenders.length} entri)</span>
                </CardTitle>
                <AddTenderDialog onSuccess={invalidate} open={isAddTenderOpen} onOpenChange={setIsAddTenderOpen} />
              </CardHeader>
              <CardContent className="p-0">
                {loadingTenders ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow className="font-mono text-xs sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]"><TableHead>Judul Tender</TableHead><TableHead>Klien</TableHead><TableHead>Teknologi</TableHead><TableHead className="text-right">Nilai Estimasi</TableHead><TableHead>Status</TableHead><TableHead>Provinsi</TableHead><TableHead>Deadline</TableHead><TableHead /></TableRow></TableHeader>
                      <TableBody>{Array.from({ length: 5 }).map((_, i) => (<TableRow key={i} className="animate-pulse">{Array.from({ length: 8 }).map((__, j) => (<TableCell key={j}><div className="h-3 bg-muted rounded w-20" /></TableCell>))}</TableRow>))}</TableBody>
                    </Table>
                  </div>
                ) : errorTenders ? (
                  <div className="flex items-center justify-center py-16 gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" /><span className="font-mono text-sm">Gagal memuat data</span>
                  </div>
                ) : filteredTenders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                    <Search className="h-8 w-8 opacity-30" />
                    <div className="text-center">
                      <p className="font-mono text-sm">{tenders.length === 0 ? "Belum ada data tender PLN EBT" : "Tidak ada tender yang cocok dengan filter"}</p>
                      <p className="text-xs mt-1">{tenders.length === 0 ? "Tambahkan tender dari PLN e-Procurement" : "Coba ubah kata kunci atau filter teknologi"}</p>
                    </div>
                    {tenders.length > 0 && (
                      <button onClick={() => { setSearch(""); setFilterTek("__all__"); setFilterStatus("__all__"); }} className="text-xs font-mono text-primary hover:underline mt-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none">✕ Reset semua filter</button>
                    )}
                    {tenders.length === 0 && (
                      <Button size="sm" variant="outline" onClick={() => setIsAddTenderOpen(true)} className="font-mono text-xs gap-1.5 mt-1">
                        <Plus className="h-3.5 w-3.5" /> Tambah Tender EBT <kbd className="text-[8px] font-mono bg-muted px-1 rounded border ml-1">N</kbd>
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="font-mono text-xs sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                          <TableHead>Judul Tender</TableHead>
                          <TableHead>Klien</TableHead>
                          <TableHead>Teknologi</TableHead>
                          <TableHead className="text-right">Nilai Estimasi</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Provinsi</TableHead>
                          <TableHead>Deadline</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTenders.map((t) => (
                          <TableRow key={t.id} className={`font-mono text-xs group transition-colors${t.deadline && (new Date(t.deadline).getTime() - Date.now()) / 86400000 < 7 ? " bg-red-50/20 hover:bg-red-50/40" : t.deadline && (new Date(t.deadline).getTime() - Date.now()) / 86400000 < 21 ? " bg-amber-50/20 hover:bg-amber-50/40" : " hover:bg-muted/40"}`}>
                            <TableCell className="font-medium max-w-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate" title={t.judul}>{t.judul}</span>
                                <button onClick={e => { e.stopPropagation(); void navigator.clipboard.writeText(t.judul).then(() => toast.success("Judul disalin", { duration: 1200 })); }} aria-label="Salin judul tender" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all shrink-0 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none" title="Salin judul"><Copy className="h-2.5 w-2.5" /></button>
                                {t.createdAt && (Date.now() - new Date(t.createdAt).getTime()) < 7 * 86400000 && (
                                  <span className="text-[8px] font-mono bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded-sm border border-emerald-200 shrink-0">Baru</span>
                                )}
                                {t.createdAt && <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-mono text-muted-foreground shrink-0 whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" })}</span>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1" title={t.klien ?? undefined}><Building2 className="h-3 w-3 text-muted-foreground shrink-0" /><span className="truncate max-w-[120px]">{t.klien ?? <span className="text-muted-foreground">—</span>}</span></span>
                            </TableCell>
                            <TableCell>
                              {t.teknologi ? <TekBadge tek={t.teknologi} /> : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              {t.nilaiEstimasi != null ? (
                                <span className="font-semibold">
                                  {t.nilaiEstimasi >= 1000
                                    ? <span title={`Nilai estimasi: Rp ${t.nilaiEstimasi.toLocaleString("id-ID")} juta`}>{`Rp ${(t.nilaiEstimasi / 1000).toFixed(1)} M`}</span>
                                    : <span title={`Nilai estimasi: Rp ${t.nilaiEstimasi.toLocaleString("id-ID")} juta`}>{`Rp ${t.nilaiEstimasi.toFixed(0)} Jt`}</span>}
                                </span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell><StatusBadge status={t.status} /></TableCell>
                            <TableCell>
                              {t.provinsi ? (
                                <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-muted-foreground" />{t.provinsi}</span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {t.deadline ? (
                                <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-muted-foreground" />{new Date(t.deadline).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              {t.sourceUrl && (
                                <a href={t.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label="Buka sumber tender" title="Buka sumber tender" className="opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm">
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
        </Tabs>

        {/* Info Footer */}
        <div className="rounded-sm border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-900/30 p-4">
          <div className="flex gap-3">
            <Zap className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
            <div className="text-xs font-mono text-yellow-800 dark:text-yellow-200 space-y-1">
              <p className="font-semibold">Sumber Data Utama Cluster EBT:</p>
              <p>PLN e-Procurement (eproc.pln.co.id) · RUPTL PLN · Ditjen EBTKE ESDM (ebtke.esdm.go.id) · IESR · CNBC Indonesia — Energi</p>
              <p className="text-yellow-600 dark:text-yellow-400">Data dikumpulkan otomatis oleh Intel Crawler. Entri manual dapat ditambahkan via tombol Tambah di atas.</p>
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
