import React, { useState, useMemo, useEffect } from "react";
import {
  useCreateResearchItem,
  useUpdateResearchItem,
  useDeleteResearchItem,
  getListResearchItemsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Award,
  CircleCheck,
  Clock,
  Cpu,
  DollarSign,
  ExternalLink,
  Factory,
  HardHat,
  Lightbulb,
  Network,
  Plus,
  Receipt,
  Search,
  Target,
  Trash2,
  TrendingUp,
  TriangleAlert,
  Users,
  ShieldCheck,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// ─── Category definitions ─────────────────────────────────────────────────────

export const MFG_CATEGORIES = [
  {
    id: "MFG_ISO",
    label: "Sertifikasi ISO",
    desc: "ISO 9001, 14001, 45001, 50001",
    icon: ShieldCheck,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  {
    id: "MFG_K3",
    label: "K3 & Keselamatan",
    desc: "SMK3, OHSAS, pelatihan K3 umum",
    icon: HardHat,
    color: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200 dark:border-orange-800",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
  {
    id: "MFG_MANAJEMEN",
    label: "Pelatihan Manajemen",
    desc: "Lean, Six Sigma, TQM, Kaizen",
    icon: Target,
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    border: "border-violet-200 dark:border-violet-800",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
  {
    id: "MFG_KEUANGAN",
    label: "Keuangan & Costing",
    desc: "Cost accounting, budgeting, COGS",
    icon: DollarSign,
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  {
    id: "MFG_BNSP",
    label: "Kompetensi BNSP",
    desc: "Sertifikasi LSP, KKNI, profesi",
    icon: Award,
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  {
    id: "MFG_IOT_AI",
    label: "IoT & AI Manufaktur",
    desc: "Industri 4.0, smart factory, otomasi",
    icon: Cpu,
    color: "text-cyan-600",
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
    border: "border-cyan-200 dark:border-cyan-800",
    badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  },
  {
    id: "MFG_PERPAJAKAN",
    label: "Perpajakan",
    desc: "PPh, PPN, brevet A/B/C, TP",
    icon: Receipt,
    color: "text-red-600",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  {
    id: "MFG_HRD",
    label: "HRD & Personalia",
    desc: "Rekrutmen, HRIS, payroll, kompetensi",
    icon: Users,
    color: "text-pink-600",
    bg: "bg-pink-50 dark:bg-pink-950/30",
    border: "border-pink-200 dark:border-pink-800",
    badge: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  },
] as const;

// ─── Heatmap rows ─────────────────────────────────────────────────────────────

const HEATMAP_ROWS = [
  {
    cat: "MFG_ISO",
    urgensi: "KRITIS",
    rev: "Rp 8–30jt/klien",
    target: "Pabrik, produsen consumer goods",
    aksi: "Tawarkan gap analysis ISO 9001 + 14001 bundle",
  },
  {
    cat: "MFG_K3",
    urgensi: "KRITIS",
    rev: "Rp 5–20jt/klien",
    target: "Manufaktur dengan >50 karyawan",
    aksi: "Program SMK3 + pelatihan Ahli K3 Umum",
  },
  {
    cat: "MFG_PERPAJAKAN",
    urgensi: "TINGGI",
    rev: "Rp 4–15jt/klien",
    target: "CFO, tax manager pabrik",
    aksi: "Workshop brevet pajak + transfer pricing",
  },
  {
    cat: "MFG_KEUANGAN",
    urgensi: "TINGGI",
    rev: "Rp 3–12jt/klien",
    target: "Manajer keuangan & produksi",
    aksi: "Pelatihan cost accounting & budgeting pabrik",
  },
  {
    cat: "MFG_BNSP",
    urgensi: "SEDANG",
    rev: "Rp 2–8jt/sertifikat",
    target: "Operator, teknisi, supervisor",
    aksi: "Sertifikasi kompetensi via LSP mitra BNSP",
  },
  {
    cat: "MFG_MANAJEMEN",
    urgensi: "SEDANG",
    rev: "Rp 5–18jt/program",
    target: "Manajer menengah & supervisor",
    aksi: "In-house training Lean Six Sigma Green Belt",
  },
  {
    cat: "MFG_HRD",
    urgensi: "SEDANG",
    rev: "Rp 3–10jt/klien",
    target: "HR manager, direktur SDM",
    aksi: "Sistem HRIS + payroll consulting paket",
  },
  {
    cat: "MFG_IOT_AI",
    urgensi: "RENDAH",
    rev: "Rp 10–50jt/proyek",
    target: "Direktur operasional, IT manager",
    aksi: "Roadmap smart factory + pilot IoT 1 lini produksi",
  },
];

// ─── Helper badges ────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority?: string | null }) {
  const map: Record<string, string> = {
    CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900/30",
    HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/30",
    MEDIUM: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30",
    LOW: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  };
  if (!priority) return null;
  return (
    <span
      className={cn(
        "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm",
        map[priority] ?? "bg-muted text-muted-foreground"
      )}
    >
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-700",
    REVIEWED: "bg-emerald-100 text-emerald-700",
    ARCHIVED: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "text-[9px] font-mono px-1.5 py-0.5 rounded-sm cursor-pointer hover:opacity-80",
        map[status ?? "PENDING"] ?? "bg-muted text-muted-foreground"
      )}
    >
      {status ?? "PENDING"}
    </span>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResearchItem {
  id: number;
  category: string;
  title: string;
  summary?: string | null;
  source: string;
  sourceUrl?: string | null;
  status: string;
  priority?: string | null;
  tags?: string | null;
  createdAt: string;
}

interface Props {
  allItems: ResearchItem[];
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ManufakturSection({ allItems }: Props) {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createCategory, setCreateCategory] = useState<string>(MFG_CATEGORIES[0]?.id ?? "MFG_PROYEK");
  const [createPriority, setCreatePriority] = useState("LOW");
  useEffect(() => { if (!isCreateOpen) { setCreateCategory(MFG_CATEGORIES[0]?.id ?? "MFG_PROYEK"); setCreatePriority("LOW"); } }, [isCreateOpen]);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const createMutation = useCreateResearchItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListResearchItemsQueryKey() });
        setIsCreateOpen(false);
      },
      onError: (err: unknown) => toast.error("Gagal menyimpan data manufaktur", { description: err instanceof Error ? err.message : "Coba lagi" }),
    },
  });

  const updateMutation = useUpdateResearchItem({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: getListResearchItemsQueryKey() }),
      onError: () => toast.error("Gagal memperbarui data manufaktur"),
    },
  });

  const deleteMutation = useDeleteResearchItem({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: getListResearchItemsQueryKey() }),
      onError: () => toast.error("Gagal menghapus data manufaktur"),
    },
  });

  // Only MFG_ items
  const mfgItems = useMemo(
    () => allItems.filter((i) => i.category.startsWith("MFG_")),
    [allItems]
  );

  const stats = useMemo(() => {
    const total = mfgItems.length;
    const pending = mfgItems.filter((i) => i.status === "PENDING").length;
    const reviewed = mfgItems.filter((i) => i.status === "REVIEWED").length;
    const now = Date.now();
    const thisWeek = mfgItems.filter(
      (i) => now - new Date(i.createdAt).getTime() < 7 * 86_400_000
    ).length;
    const byCat: Record<string, number> = {};
    for (const item of mfgItems) {
      byCat[item.category] = (byCat[item.category] ?? 0) + 1;
    }
    return { total, pending, reviewed, thisWeek, byCat };
  }, [mfgItems]);

  const filtered = useMemo(() => {
    return mfgItems.filter((item) => {
      if (catFilter && item.category !== catFilter) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return (
          item.title.toLowerCase().includes(s) ||
          item.source.toLowerCase().includes(s) ||
          (item.summary ?? "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [mfgItems, catFilter, searchTerm]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      data: {
        title: fd.get("title") as string,
        category: fd.get("category") as string,
        source: fd.get("source") as string,
        summary: (fd.get("summary") as string) || undefined,
        priority: fd.get("priority") as string,
        sourceUrl: (fd.get("sourceUrl") as string) || undefined,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-sm bg-indigo-100 dark:bg-indigo-900/40">
            <Factory className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
              Industri Manufaktur
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Peluang pelatihan, sertifikasi, dan informasi pasar manufaktur Indonesia
            </p>
          </div>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0">
              <Plus className="mr-2 h-4 w-4" />
              TAMBAH PELUANG
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Tambah Peluang Manufaktur</DialogTitle>
              <DialogDescription>
                Input peluang pelatihan, sertifikasi, atau informasi pasar manufaktur baru.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="mfg-title">Judul / Nama Peluang</Label>
                <Input
                  id="mfg-title"
                  name="title"
                  required
                  placeholder="Cth: Pelatihan ISO 9001:2015 Batch Q3 — PT ABC…"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <input type="hidden" name="category" value={createCategory} />
                  <Select value={createCategory} onValueChange={setCreateCategory} required>
                    <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MFG_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prioritas</Label>
                  <input type="hidden" name="priority" value={createPriority} />
                  <Select value={createPriority} onValueChange={setCreatePriority} required>
                    <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Rendah (LOW)</SelectItem>
                      <SelectItem value="MEDIUM">Sedang (MEDIUM)</SelectItem>
                      <SelectItem value="HIGH">Tinggi (HIGH)</SelectItem>
                      <SelectItem value="CRITICAL">Kritis (CRITICAL)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mfg-source">Sumber / Penyelenggara</Label>
                  <Input
                    id="mfg-source"
                    name="source"
                    required
                    placeholder="Cth: BNSP, Kemnaker, BSN…"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mfg-sourceUrl">URL (Opsional)</Label>
                  <Input
                    id="mfg-sourceUrl"
                    name="sourceUrl"
                    placeholder="https://…"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mfg-summary">Deskripsi / Analisa</Label>
                <Textarea
                  id="mfg-summary"
                  name="summary"
                  rows={3}
                  className="resize-none"
                  placeholder="Detail peluang, target peserta, estimasi nilai bisnis, jadwal…"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> MENYIMPAN...</> : "SIMPAN"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Total Peluang",
            value: stats.total,
            icon: Lightbulb,
            color: "text-indigo-600",
          },
          {
            label: "Minggu Ini",
            value: stats.thisWeek,
            icon: TrendingUp,
            color: "text-emerald-600",
          },
          {
            label: "Belum Direviu",
            value: stats.pending,
            icon: Clock,
            color: "text-amber-600",
          },
          {
            label: "Sudah Direviu",
            value: stats.reviewed,
            icon: CircleCheck,
            color: "text-blue-600",
          },
        ].map((s) => (
          <Card key={s.label} className="rounded-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={cn("h-5 w-5 shrink-0", s.color)} />
              <div>
                <p className="text-2xl font-bold font-mono">{s.value}</p>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">
                  {s.label}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category grid — click to filter */}
      <div>
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-indigo-500" />
          KATEGORI MANUFAKTUR — Klik untuk filter
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MFG_CATEGORIES.map((cat) => {
            const count = stats.byCat[cat.id] ?? 0;
            const active = catFilter === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setCatFilter(active ? "" : cat.id);
                  setPage(1);
                }}
                className={cn(
                  "text-left p-3 rounded-sm border transition-all",
                  active
                    ? cn(cat.bg, cat.border, "ring-1 ring-inset")
                    : "bg-card border-border hover:bg-muted/40"
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <cat.icon
                    className={cn(
                      "h-4 w-4",
                      active ? cat.color : "text-muted-foreground"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full",
                      active ? cat.badge : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                </div>
                <p
                  className={cn(
                    "text-xs font-semibold leading-tight",
                    active ? cat.color : ""
                  )}
                >
                  {cat.label}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                  {cat.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Intelligence Heatmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-indigo-500" />
          MANUFAKTUR INTELLIGENCE HEATMAP — Nilai Strategis per Kategori
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[600px]">
            <thead>
              <tr className="border-b bg-muted/20 text-[9px] font-mono text-muted-foreground uppercase">
                <th className="text-left px-3 py-2">Kategori</th>
                <th className="text-center px-3 py-2">Urgensi</th>
                <th className="text-center px-3 py-2">Est. Revenue</th>
                <th className="text-left px-3 py-2">Target Klien</th>
                <th className="text-left px-3 py-2">Aksi Rekomendasi</th>
              </tr>
            </thead>
            <tbody>
              {HEATMAP_ROWS.map((row) => {
                const cat = MFG_CATEGORIES.find((c) => c.id === row.cat);
                return (
                  <tr
                    key={row.cat}
                    className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-3 py-2">
                      <span className="text-[9px] font-mono font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 px-1.5 py-0.5 rounded-sm">
                        {cat?.label ?? row.cat}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={cn(
                          "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm",
                          row.urgensi === "KRITIS"
                            ? "bg-red-100 text-red-700"
                            : row.urgensi === "TINGGI"
                            ? "bg-orange-100 text-orange-700"
                            : row.urgensi === "SEDANG"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {row.urgensi}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-emerald-600 font-semibold text-[11px]">
                      {row.rev}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-[11px]">
                      {row.target}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground leading-snug text-[11px]">
                      {row.aksi}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending review banner */}
      {stats.pending > 0 && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-sm px-4 py-2.5">
          <Clock className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-xs font-mono text-amber-700">
            {stats.pending} peluang manufaktur belum direviu
          </span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto h-7 text-[10px] font-mono border-amber-500/50 text-amber-700 hover:bg-amber-50"
            disabled={updateMutation.isPending}
            onClick={() => {
              mfgItems
                .filter((i) => i.status === "PENDING")
                .forEach((i) =>
                  updateMutation.mutate({ id: i.id, data: { status: "REVIEWED" } })
                );
            }}
          >
            Tandai Semua Direviu
          </Button>
        </div>
      )}

      {/* Data table */}
      <Card className="rounded-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-mono tracking-wider">
              DATABASE PELUANG MANUFAKTUR
              <span className="ml-2 text-muted-foreground text-xs font-normal">
                ({filtered.length} item
                {catFilter
                  ? ` · ${MFG_CATEGORIES.find((c) => c.id === catFilter)?.label}`
                  : ""}
                )
              </span>
            </CardTitle>
            <div className="flex gap-2">
              {catFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] font-mono"
                  onClick={() => {
                    setCatFilter("");
                    setPage(1);
                  }}
                >
                  ✕ {MFG_CATEGORIES.find((c) => c.id === catFilter)?.label}
                </Button>
              )}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Cari peluang…"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="pl-7 h-7 text-xs w-48 font-mono"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Factory className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-mono text-muted-foreground">
                {mfgItems.length === 0
                  ? "Belum ada data peluang manufaktur"
                  : "Tidak ada data yang cocok dengan filter"}
              </p>
              {mfgItems.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Klik "TAMBAH PELUANG" untuk input data pertama
                </p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-[10px] font-mono uppercase bg-muted/30">
                  <TableHead className="w-28">Tanggal</TableHead>
                  <TableHead>Judul / Deskripsi</TableHead>
                  <TableHead className="w-36">Kategori</TableHead>
                  <TableHead className="w-24 text-center">Prioritas</TableHead>
                  <TableHead className="w-24 text-center">Status</TableHead>
                  <TableHead className="w-16 text-center">Hapus</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((item) => {
                  const cat = MFG_CATEGORIES.find((c) => c.id === item.category);
                  return (
                    <TableRow
                      key={item.id}
                      className="text-xs hover:bg-muted/20"
                    >
                      <TableCell className="font-mono text-[10px] text-muted-foreground align-top pt-3">
                        {format(new Date(item.createdAt), "dd MMM yy")}
                      </TableCell>
                      <TableCell className="align-top pt-3">
                        <p className="font-medium leading-snug">{item.title}</p>
                        {item.summary && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2" title={item.summary}>
                            {item.summary}
                          </p>
                        )}
                        {item.sourceUrl ? (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5 mt-0.5"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                            {item.source}
                          </a>
                        ) : (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {item.source}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="align-top pt-3">
                        {cat ? (
                          <span
                            className={cn(
                              "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm",
                              cat.badge
                            )}
                          >
                            {cat.label}
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono bg-muted px-1.5 py-0.5 rounded-sm">
                            {item.category}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center align-top pt-3">
                        <PriorityBadge priority={item.priority} />
                      </TableCell>
                      <TableCell className="text-center align-top pt-3">
                        <button
                          onClick={() =>
                            updateMutation.mutate({
                              id: item.id,
                              data: {
                                status:
                                  item.status === "PENDING"
                                    ? "REVIEWED"
                                    : "PENDING",
                              },
                            })
                          }
                        >
                          <StatusBadge status={item.status} />
                        </button>
                      </TableCell>
                      <TableCell className="text-center align-top pt-2.5">
                        {pendingDeleteId === item.id ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-6 px-1.5 text-[9px] font-mono"
                            disabled={deleteMutation.isPending}
                            onClick={() => { deleteMutation.mutate({ id: item.id }); setPendingDeleteId(null); }}
                            onBlur={() => setPendingDeleteId(null)}
                            autoFocus
                          >
                            {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "✓ Yakin?"}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => setPendingDeleteId(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-[10px] font-mono text-muted-foreground">
              {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, filtered.length)} dari {filtered.length}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs font-mono"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs font-mono"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
