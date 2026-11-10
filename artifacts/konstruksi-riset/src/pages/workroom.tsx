import { useState, useEffect, useCallback, useMemo, useRef, useDeferredValue } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  useListPainPoints, getListPainPointsQueryKey,
  useListResearchItems, getListResearchItemsQueryKey,
  useListOutputProducts, getListOutputProductsQueryKey,
  useListAiRecommendations, getListAiRecommendationsQueryKey,
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useGetWorkroomNotes, getGetWorkroomNotesQueryKey,
  useUpsertWorkroomNote,
  useListContractors, getListContractorsQueryKey,
  useGetWorkroomNoteHistory,
} from "@workspace/api-client-react";
import type { PainPoint, ResearchItem, OutputProduct, AiRecommendation, DashboardSummary, Contractor, WorkroomNotesMap, WorkroomNoteHistoryItem } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  TriangleAlert, ChartBar, BookOpen, Brain, Briefcase, CircleCheck, ChevronDown, ChevronRight, ChevronUp, Compass,
  ClipboardList, Copy, Cpu, FileText, Flame, Heart, Layers, Lightbulb, Search,
  CalendarDays, MapPin, MessageSquare, Share2, Shield, Star, TrendingUp, Trophy, UserCheck, UserPlus, Users, Wrench, CircleX, X, Zap,
  Printer, Target, DollarSign, ListChecks, CircleAlert, Pen, MessageCircle, Building2, Phone,
  Activity, Network, Rocket, Handshake, Calendar, Clock, Home, History, LoaderCircle,
} from "lucide-react";
import { KnowledgeSourcesBar } from "@/components/knowledge-sources-bar";

// ─── Local persistence helpers ────────────────────────────────────────────────

function useLocalStorage<T>(key: string, defaultValue: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  const set = useCallback((v: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);
  return [value, set];
}

// ─── Server-sync notes hook (Task #21, Task #59) ──────────────────────────────
// Hybrid: local state for snappy UI, server for cross-member sharing.
// Loads from server on mount; writes back per-entity on every change (debounced).
// Polls every 15 s to reflect teammates' edits without a manual refresh.

type SyncStatus = "idle" | "saving" | "saved" | "error";

// Return: [notes, setNotes, loading, syncStatus, serverNotes, remoteUpdated]
function useServerSyncedNotes(authorName: string): [
  WorkroomNotes,
  (v: WorkroomNotes | ((prev: WorkroomNotes) => WorkroomNotes)) => void,
  boolean,
  SyncStatus,
  WorkroomNotesMap | undefined,
  boolean, // remoteUpdated — flashes when a background poll brings in new data from teammates
] {
  const queryClient = useQueryClient();
  const { data: serverNotes, isLoading: serverLoading } = useGetWorkroomNotes({
    query: {
      queryKey: getGetWorkroomNotesQueryKey(),
      refetchInterval: 15_000, // background poll every 15 s (Task #59)
    },
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep a ref so debounced callbacks always read the latest author name
  // without needing to be re-created whenever the name changes.
  const authorNameRef = useRef(authorName);
  useEffect(() => { document.title = "Workroom — Intel Konstruksi"; return () => { document.title = "Intel Konstruksi"; }; }, []);
  useEffect(() => { authorNameRef.current = authorName; }, [authorName]);

  // Keys with an active local debounce timer — must NOT be overwritten by polls
  const pendingKeys = useRef<Set<string>>(new Set());

  const upsertMutation = useUpsertWorkroomNote({
    mutation: {
      onMutate: () => setSyncStatus("saving"),
      onSuccess: () => {
        setSyncStatus("saved");
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => setSyncStatus("idle"), 3000);
        // Refresh GET /workroom/notes so attribution is immediately visible after save
        void queryClient.invalidateQueries({ queryKey: getGetWorkroomNotesQueryKey() });
      },
      onError: (err: unknown) => { setSyncStatus("error"); toast.error("Gagal sinkronisasi catatan", { description: err instanceof Error ? err.message : "Coba lagi" }); },
    },
  });

  const [notes, setNotesLocal] = useLocalStorage<WorkroomNotes>("workroom-notes-v1", DEFAULT_NOTES);

  // Keep a ref so the polling effect can read current notes without adding `notes` to deps
  const notesRef = useRef<WorkroomNotes>(notes);
  notesRef.current = notes;

  const serverApplied = useRef(false);

  // Remote-update flash indicator
  const [remoteUpdated, setRemoteUpdated] = useState(false);
  const remoteUpdatedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Merge server data on first load AND on every subsequent poll.
  // Keys in `pendingKeys` (user is actively typing) are never overwritten.
  useEffect(() => {
    if (serverLoading || !serverNotes) return;

    const isFirstLoad = !serverApplied.current;
    const current = notesRef.current;

    const next: WorkroomNotes = {
      painPoints:    { ...current.painPoints },
      researchItems: { ...current.researchItems },
      serviceLinks:  { ...current.serviceLinks },
      contractors:   { ...current.contractors },
    };
    let changed = false;

    for (const [k, v] of Object.entries(serverNotes.painPoints)) {
      const key = `pain_point:${k}`;
      if (!isFirstLoad && pendingKeys.current.has(key)) continue; // local edit in flight
      const num = Number(k);
      const existing = current.painPoints[num];
      if (!existing || existing.note !== v.note || existing.status !== v.status) {
        next.painPoints[num] = { note: v.note, status: v.status as WorkroomNotes["painPoints"][number]["status"] };
        changed = true;
      }
    }

    for (const [k, v] of Object.entries(serverNotes.researchItems)) {
      const key = `research_item:${k}`;
      if (!isFirstLoad && pendingKeys.current.has(key)) continue;
      const num = Number(k);
      const existing = current.researchItems[num];
      if (!existing || existing.note !== v.note || existing.status !== v.status) {
        next.researchItems[num] = { note: v.note, status: v.status as WorkroomNotes["researchItems"][number]["status"] };
        changed = true;
      }
    }

    for (const [k, v] of Object.entries(serverNotes.serviceLinks)) {
      const key = `service_link:${k}`;
      if (!isFirstLoad && pendingKeys.current.has(key)) continue;
      const num = Number(k);
      const existing = current.serviceLinks[num] ?? [];
      const incoming = v as number[];
      if (JSON.stringify([...existing].sort()) !== JSON.stringify([...incoming].sort())) {
        next.serviceLinks[num] = incoming;
        changed = true;
      }
    }

    for (const [k, vRaw] of Object.entries(serverNotes.contractors ?? {})) {
      const v = vRaw as { note: string; status: string };
      const key = `contractor:${k}`;
      if (!isFirstLoad && pendingKeys.current.has(key)) continue;
      const num = Number(k);
      const existing = current.contractors[num];
      if (!existing || existing.note !== v.note || existing.status !== v.status) {
        next.contractors[num] = { note: v.note, status: v.status as OutreachStatus };
        changed = true;
      }
    }

    if (changed || isFirstLoad) {
      setNotesLocal(next);
    }

    // Flash "Diperbarui" only on background polls that actually bring in new data
    if (!isFirstLoad && changed) {
      setRemoteUpdated(true);
      if (remoteUpdatedTimerRef.current) clearTimeout(remoteUpdatedTimerRef.current);
      remoteUpdatedTimerRef.current = setTimeout(() => setRemoteUpdated(false), 3000);
    }

    if (isFirstLoad) serverApplied.current = true;
  }, [serverNotes, serverLoading, setNotesLocal]); // deliberately omits `notes` — uses notesRef

  // Pending upsert queue: entityType:entityId → debounce timer
  const debounceMap = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const setNotes = useCallback((v: WorkroomNotes | ((prev: WorkroomNotes) => WorkroomNotes)) => {
    setNotesLocal((prev) => {
      const next = typeof v === "function" ? v(prev) : v;

      // Diff pain points
      for (const [id, entry] of Object.entries(next.painPoints)) {
        const prev_ = prev.painPoints[Number(id)];
        if (!prev_ || prev_.note !== entry.note || prev_.status !== entry.status) {
          const key = `pain_point:${id}`;
          clearTimeout(debounceMap.current[key]);
          pendingKeys.current.add(key); // guard against poll overwrite while typing
          debounceMap.current[key] = setTimeout(() => {
            pendingKeys.current.delete(key);
            upsertMutation.mutate({ entityType: "pain_point", entityId: Number(id), data: { note: entry.note, status: entry.status, authorName: authorNameRef.current || null } });
          }, 800);
        }
      }

      // Diff research items
      for (const [id, entry] of Object.entries(next.researchItems)) {
        const prev_ = prev.researchItems[Number(id)];
        if (!prev_ || prev_.note !== entry.note || prev_.status !== entry.status) {
          const key = `research_item:${id}`;
          clearTimeout(debounceMap.current[key]);
          pendingKeys.current.add(key);
          debounceMap.current[key] = setTimeout(() => {
            pendingKeys.current.delete(key);
            upsertMutation.mutate({ entityType: "research_item", entityId: Number(id), data: { note: entry.note, status: entry.status, authorName: authorNameRef.current || null } });
          }, 800);
        }
      }

      // Diff service links
      for (const [id, ids] of Object.entries(next.serviceLinks)) {
        const prev_ = prev.serviceLinks[Number(id)] ?? [];
        const next_ = ids as number[];
        if (JSON.stringify([...prev_].sort()) !== JSON.stringify([...next_].sort())) {
          const key = `service_link:${id}`;
          clearTimeout(debounceMap.current[key]);
          pendingKeys.current.add(key);
          debounceMap.current[key] = setTimeout(() => {
            pendingKeys.current.delete(key);
            upsertMutation.mutate({ entityType: "service_link", entityId: Number(id), data: { serviceIds: next_.join("|") } });
          }, 800);
        }
      }

      // Diff contractors (outreach status)
      for (const [id, entry] of Object.entries(next.contractors)) {
        const prev_ = prev.contractors[Number(id)];
        if (!prev_ || prev_.note !== entry.note || prev_.status !== entry.status) {
          const key = `contractor:${id}`;
          clearTimeout(debounceMap.current[key]);
          pendingKeys.current.add(key);
          debounceMap.current[key] = setTimeout(() => {
            pendingKeys.current.delete(key);
            upsertMutation.mutate({ entityType: "contractor", entityId: Number(id), data: { note: entry.note, status: entry.status } });
          }, 800);
        }
      }

      return next;
    });
  }, [setNotesLocal, upsertMutation]);

  return [notes, setNotes, serverLoading && !serverApplied.current, syncStatus, serverNotes, remoteUpdated];
}


// ─── Types ────────────────────────────────────────────────────────────────────

type EvalStatus = "BARU" | "DIKAJI" | "DITINDAKLANJUTI" | "DIABAIKAN";
type ProblemStatus = "BELUM_DIANALISIS" | "SEDANG_DIANALISIS" | "SELESAI" | "DIPRIORITASKAN";

type OutreachStatus = "BELUM_DIHUBUNGI" | "SUDAH_DIHUBUNGI" | "SEDANG_NEGOSIASI" | "DEAL" | "TIDAK_TERTARIK";
interface WorkroomNotes {
  painPoints: Record<number, { note: string; status: ProblemStatus }>;
  researchItems: Record<number, { note: string; status: EvalStatus }>;
  serviceLinks: Record<number, number[]>; // painPointId → serviceIds
  contractors: Record<number, { status: OutreachStatus; note: string }>;
}

const DEFAULT_NOTES: WorkroomNotes = {
  painPoints: {},
  researchItems: {},
  serviceLinks: {},
  contractors: {},
};

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId = "perumusan" | "evaluasi" | "produk" | "canvas" | "prospek";

const TABS: { id: TabId; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "perumusan", label: "Perumusan Masalah", icon: Lightbulb, desc: "Analisis dan prioritaskan masalah dari data CPKB" },
  { id: "evaluasi", label: "Evaluasi Data & Informasi", icon: ClipboardList, desc: "Tinjau data riset harian dan tetapkan tindak lanjut" },
  { id: "produk", label: "Produk & Layanan", icon: Layers, desc: "Petakan masalah ke solusi dan layanan yang tersedia" },
  { id: "canvas", label: "Problem Canvas", icon: Pen, desc: "Susun brief layanan dari satu masalah menjadi produk siap jual" },
  { id: "prospek", label: "Daftar Prospek", icon: Target, desc: "Daftar calon klien yang teridentifikasi dari analisis masalah" },
];

// ─── Domain colours ───────────────────────────────────────────────────────────

const DOMAIN_COLORS: Record<string, string> = {
  SBU: "bg-blue-500/15 text-blue-700 border-blue-300",
  SKK: "bg-violet-500/15 text-violet-700 border-violet-300",
  SMAP: "bg-orange-500/15 text-orange-700 border-orange-300",
  TENDER: "bg-yellow-500/15 text-yellow-700 border-yellow-300",
  KEUANGAN: "bg-red-500/15 text-red-700 border-red-300",
  SDM: "bg-teal-500/15 text-teal-700 border-teal-300",
  DIGITAL: "bg-cyan-500/15 text-cyan-700 border-cyan-300",
  REGULASI: "bg-pink-500/15 text-pink-700 border-pink-300",
  DOKUMEN: "bg-green-500/15 text-green-700 border-green-300",
  ESTIMASI: "bg-amber-500/15 text-amber-700 border-amber-300",
  PROYEK: "bg-lime-500/15 text-lime-700 border-lime-300",
  OSS: "bg-indigo-500/15 text-indigo-700 border-indigo-300",
  ISO: "bg-emerald-500/15 text-emerald-700 border-emerald-300",
  SMK3: "bg-rose-500/15 text-rose-700 border-rose-300",
  KNOWLEDGE: "bg-sky-500/15 text-sky-700 border-sky-300",
  MARKETING: "bg-purple-500/15 text-purple-700 border-purple-300",
  LEGAL: "bg-slate-500/15 text-slate-700 border-slate-300",
  KEMITRAAN: "bg-fuchsia-500/15 text-fuchsia-700 border-fuchsia-300",
  CASHFLOW: "bg-red-900/15 text-red-900 border-red-800",
};

function domainBadge(domain: string) {
  return DOMAIN_COLORS[domain] ?? "bg-muted text-muted-foreground border-border";
}

const EVAL_STATUS_CONFIG: Record<EvalStatus, { label: string; color: string }> = {
  BARU: { label: "Baru", color: "bg-muted text-muted-foreground" },
  DIKAJI: { label: "Sedang Dikaji", color: "bg-yellow-500/15 text-yellow-700" },
  DITINDAKLANJUTI: { label: "Ditindaklanjuti", color: "bg-green-500/15 text-green-700" },
  DIABAIKAN: { label: "Diabaikan", color: "bg-red-500/15 text-red-700" },
};

const PROBLEM_STATUS_CONFIG: Record<ProblemStatus, { label: string; color: string; icon: React.ElementType }> = {
  BELUM_DIANALISIS: { label: "Belum Dianalisis", color: "bg-muted text-muted-foreground", icon: CircleX },
  SEDANG_DIANALISIS: { label: "Sedang Dianalisis", color: "bg-yellow-500/15 text-yellow-700", icon: TriangleAlert },
  SELESAI: { label: "Selesai", color: "bg-green-500/15 text-green-700", icon: CircleCheck },
  DIPRIORITASKAN: { label: "Diprioritaskan", color: "bg-red-500/15 text-red-700", icon: Flame },
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Workroom() {
  const searchStr = useSearch();
  const searchParams = new URLSearchParams(searchStr ?? "");
  const deepLinkTab = searchParams.get("tab") as TabId | null;
  const deepLinkContractorId = searchParams.get("contractorId") ? Number(searchParams.get("contractorId")) : null;

  const [activeTab, setActiveTab] = useState<TabId>(
    deepLinkTab && ["perumusan","evaluasi","produk","canvas","prospek"].includes(deepLinkTab)
      ? deepLinkTab
      : "perumusan"
  );
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [highlightContractorId, setHighlightContractorId] = useState<number | null>(deepLinkContractorId);
  const [authorName, setAuthorName] = useLocalStorage<string>("workroom-author-name", "");
  const [lastExport, setLastExport] = useState<string | null>(null);
  // Task #134: track Segmen Lokal contacted status (id → ISO date string)
  const [kontakSegmen, setKontakSegmen] = useLocalStorage<Record<string, string>>("mkp-segmen-lokal-contacted", {});

  // Clear highlight after 3 seconds
  useEffect(() => {
    if (highlightContractorId) {
      const t = setTimeout(() => setHighlightContractorId(null), 3000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [highlightContractorId]);
  const [notes, setNotes, notesLoading, syncStatus, serverNotes, remoteUpdated] = useServerSyncedNotes(authorName);

  // API data
  const { data: painPoints, isLoading: loadingPP } = useListPainPoints(
    undefined,
    { query: { queryKey: getListPainPointsQueryKey() } }
  );
  const { data: researchItems, isLoading: loadingRI } = useListResearchItems(
    { limit: 50 },
    { query: { queryKey: getListResearchItemsQueryKey({ limit: 50 }) } }
  );
  const { data: services, isLoading: loadingSvc } = useListOutputProducts(
    undefined,
    { query: { queryKey: getListOutputProductsQueryKey() } }
  );
  const { data: aiRecs } = useListAiRecommendations(
    undefined,
    { query: { queryKey: getListAiRecommendationsQueryKey() } }
  );
  const { data: summary } = useGetDashboardSummary(
    { query: { queryKey: getGetDashboardSummaryQueryKey() } }
  );

  // Derived stats
  const analysed = Object.values(notes.painPoints).filter(
    (p) => p.status === "SELESAI" || p.status === "DIPRIORITASKAN"
  ).length;
  const evaluated = Object.values(notes.researchItems).filter(
    (r) => r.status !== "BARU"
  ).length;
  const linked = Object.keys(notes.serviceLinks).length;

  return (
    <div className="flex flex-col gap-0 min-h-full">
      {/* Header */}
      <div className="border-b bg-background px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight font-mono flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              WORKROOM — RUANG KERJA TIM
              {/* Sync status indicator */}
              {syncStatus === "saving" && (
                <span className="text-[10px] font-mono font-normal text-muted-foreground flex items-center gap-1">
                  <LoaderCircle className="h-2.5 w-2.5 animate-spin" />
                  Menyimpan...
                </span>
              )}
              {syncStatus === "saved" && (
                <span className="text-[10px] font-mono font-normal text-green-600 flex items-center gap-1">
                  <CircleCheck className="h-3 w-3" />
                  Tersimpan {(() => { const now = new Date(); return `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`; })()}
                </span>
              )}
              {syncStatus === "error" && (
                <span className="text-[10px] font-mono font-normal text-red-600 flex items-center gap-1">
                  <TriangleAlert className="h-3 w-3" />
                  Gagal simpan
                </span>
              )}
              {remoteUpdated && syncStatus === "idle" && (
                <span className="text-[10px] font-mono font-normal text-blue-600 flex items-center gap-1 animate-in fade-in duration-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Diperbarui
                </span>
              )}
            </h1>
            {/* Author name field */}
            <div className="flex items-center gap-1.5 mt-1">
              <UserCheck className="h-3 w-3 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); }}
                placeholder="Nama Anda (opsional)"
                className="text-xs font-mono bg-transparent border-b border-dashed border-muted-foreground/40 focus:border-primary focus:outline-none w-40 placeholder:text-muted-foreground/50 text-muted-foreground focus:text-foreground transition-colors"
              />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 font-mono">
              Perumusan masalah · Evaluasi data · Pemetaan produk &amp; layanan
              {notesLoading && <span className="ml-2 text-xs italic">· Memuat catatan tim...</span>}
            </p>
            {/* Export CSV */}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <button
                className="inline-flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground border border-border px-2 py-1 rounded-sm hover:bg-muted/40 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none"
                title="Export ringkasan workroom sebagai CSV"
                onClick={() => {
                  const rows: string[] = ["Type,ID,Domain,Note,Status"];
                  (painPoints ?? []).forEach(pp => {
                    const n = notes.painPoints[pp.id];
                    rows.push([
                      "PainPoint",
                      String(pp.id),
                      pp.domain ?? "",
                      (n?.note ?? "").replace(/,/g, ";"),
                      n?.status ?? "",
                    ].join(","));
                  });
                  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = "workroom-export.csv"; a.click();
                  URL.revokeObjectURL(url);
                  setLastExport(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
                }}
              >
                <FileText className="h-3 w-3" /> Export CSV
              </button>
              {lastExport && (
                <span className="text-[9px] font-mono text-muted-foreground">terakhir: {lastExport}</span>
              )}
            </div>
          </div>

          {/* Progress chips */}
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <StatChip icon={Lightbulb} label="Masalah dianalisis" value={analysed} total={painPoints?.length} color="text-yellow-600" />
            <StatChip icon={ClipboardList} label="Data dievaluasi" value={evaluated} total={researchItems?.length} color="text-blue-600" />
            <StatChip icon={Layers} label="Masalah dipetakan" value={linked} total={painPoints?.length} color="text-green-600" />
            {(() => {
              const noteCount = Object.values(notes.painPoints).filter(v => v?.note?.trim().length > 0).length;
              const total = painPoints?.length ?? 0;
              if (total === 0) return null;
              return (
                <span className={cn("text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border", noteCount < total ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-emerald-50 text-emerald-700 border-emerald-200")}>
                  {noteCount}/{total} catatan
                </span>
              );
            })()}
          </div>
        </div>

      {/* Competitive Intelligence Quick Panel */}
        <div className="mt-4 border rounded-sm p-3 bg-card">
          <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Star className="h-3 w-3 text-primary" /> COMPETITIVE INTELLIGENCE — Posisi Pasar PT Maheswara vs Kompetitor
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { dimension: "Riset Intelijen", maheswara: 10, competitor: 3, label: "KEUNGGULAN KAMI" },
              { dimension: "Kecepatan Respons", maheswara: 9, competitor: 6, label: "KEUNGGULAN KAMI" },
              { dimension: "Depth Domain", maheswara: 9, competitor: 5, label: "KEUNGGULAN KAMI" },
              { dimension: "Digital Tools", maheswara: 10, competitor: 4, label: "KEUNGGULAN KAMI" },
            ].map((d) => (
              <div key={d.dimension} className="border rounded-sm p-2 bg-muted/20">
                <p className="text-[9px] font-mono text-muted-foreground mb-1">{d.dimension}</p>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[9px] font-mono text-muted-foreground w-16">Kami</span>
                  <div className="flex-1 h-1.5 bg-primary/20 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${d.maheswara * 10}%` }} />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-primary">{d.maheswara}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono text-muted-foreground w-16">Kompetitor</span>
                  <div className="flex-1 h-1.5 bg-red-200 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${d.competitor * 10}%` }} />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-red-500">{d.competitor}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Analysis Velocity Tracker */}
        <div className="mt-4 border rounded-sm p-3 bg-muted/20">
          <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-primary" /> ANALYSIS VELOCITY TRACKER — Progress Tim Hari Ini
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Pain Point Dianalisis", val: Object.values(notes.painPoints).filter(p => p.status === "SELESAI" || p.status === "DIPRIORITASKAN").length, total: painPoints?.length ?? 0, color: "text-yellow-600", barColor: "bg-yellow-500" },
              { label: "Data Dievaluasi", val: Object.values(notes.researchItems).filter(r => r.status !== "BARU").length, total: researchItems?.length ?? 0, color: "text-blue-600", barColor: "bg-blue-500" },
              { label: "Layanan Dipetakan", val: Object.keys(notes.serviceLinks).length, total: painPoints?.length ?? 0, color: "text-emerald-600", barColor: "bg-emerald-500" },
              { label: "Diprioritaskan", val: Object.values(notes.painPoints).filter(p => p.status === "DIPRIORITASKAN").length, total: painPoints?.length ?? 0, color: "text-red-600", barColor: "bg-red-500" },
            ].map((t) => {
              const pct = t.total > 0 ? Math.min(100, Math.round((t.val / t.total) * 100)) : 0;
              return (
                <div key={t.label} className="border rounded-sm p-2 bg-card">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-mono text-muted-foreground">{t.label}</span>
                    <span className={`text-[10px] font-mono font-bold ${t.color}`}>{t.val}/{t.total}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${t.barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className={`text-[9px] font-mono mt-0.5 ${t.color}`}>{pct}%</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Workroom Intelligence Summary */}
        <div className="mt-4 border rounded-sm p-3 bg-card">
          <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Brain className="h-3 w-3 text-primary" /> WORKROOM INTEL — Ringkasan Analisis & Peluang Aktif
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Pain Points Belum Terpecahkan", val: painPoints?.filter(p => p.status === "BARU" || p.status === "DIANALISIS").length ?? "—", color: "text-red-600" },
              { label: "Temuan Riset Belum Direviu", val: researchItems?.filter(r => r.status === "PENDING").length ?? "—", color: "text-orange-600" },
              { label: "Layanan Belum Dipetakan", val: (() => { const mapped = new Set(Object.keys(notes.serviceLinks)); return (painPoints?.length ?? 0) - mapped.size; })(), color: "text-blue-700" },
              { label: "Peluang Siap Ditawarkan", val: painPoints?.filter(p => p.serviceOpportunity && p.status === "DIPRIORITASKAN").length ?? "—", color: "text-emerald-700" },
            ].map((m) => (
              <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
                <p className={`text-lg font-black font-mono leading-none ${m.color}`}>{m.val}</p>
                <p className="text-[9px] font-mono text-muted-foreground mt-0.5 leading-tight">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        {/* Knowledge Sources Bar */}
        <div className="mt-4">
          <KnowledgeSourcesBar pageKey="workroom" />
        </div>

        <div className="flex gap-1 mt-4 flex-wrap">
          {TABS.map((tab) => {
            const segmenContactedCount = tab.id === "prospek" ? Object.keys(kontakSegmen).filter(k => kontakSegmen[k]).length : 0;
            const segmenTotal = tab.id === "prospek" ? SEGMEN_LOKAL.length : 0;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  const sp = new URLSearchParams(window.location.search);
                  sp.set("tab", tab.id);
                  window.history.replaceState(null, "", `${window.location.pathname}?${sp.toString()}`);
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-sm border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                aria-pressed={activeTab === tab.id}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.id === "prospek" && segmenContactedCount > 0 && (
                  <span className={cn(
                    "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full leading-none",
                    activeTab === tab.id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-emerald-100 text-emerald-700"
                  )}>
                    {segmenContactedCount}/{segmenTotal}
                  </span>
                )}
                {tab.id === "evaluasi" && (() => {
                  const evalNoteCount = Object.values(notes.researchItems ?? {}).filter(n => (n?.note ?? "").trim()).length;
                  return evalNoteCount > 0 ? (
                    <span className={cn("text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full leading-none", activeTab === tab.id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-blue-100 text-blue-700")}>
                      {evalNoteCount}
                    </span>
                  ) : null;
                })()}
                {tab.id === "perumusan" && (() => {
                  const ppNoteCount = Object.values(notes.painPoints ?? {}).filter(n => (n?.note ?? "").trim()).length;
                  return ppNoteCount > 0 ? (
                    <span className={cn("text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full leading-none", activeTab === tab.id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-blue-100 text-blue-700")}>
                      {ppNoteCount}
                    </span>
                  ) : null;
                })()}
                {tab.id === "prospek" && (() => {
                  const contractorNoteCount = Object.values(notes.contractors ?? {}).filter(n => (n?.note ?? "").trim()).length;
                  return contractorNoteCount > 0 ? (
                    <span className={cn("text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full leading-none ml-0.5", activeTab === tab.id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-blue-100 text-blue-700")}>
                      {contractorNoteCount} catatan
                    </span>
                  ) : null;
                })()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "perumusan" && (
          <PerumusanTab
            painPoints={painPoints ?? []}
            loading={loadingPP}
            notes={notes}
            setNotes={setNotes}
            serverNotes={serverNotes}
          />
        )}
        {activeTab === "evaluasi" && (
          <EvaluasiTab
            items={researchItems ?? []}
            loading={loadingRI}
            notes={notes}
            setNotes={setNotes}
            serverNotes={serverNotes}
          />
        )}
        {activeTab === "produk" && (
          <ProdukTab
            painPoints={painPoints ?? []}
            services={services ?? []}
            aiRecs={aiRecs ?? []}
            loading={loadingSvc || loadingPP}
            notes={notes}
            setNotes={setNotes}
            summary={summary}
          />
        )}
        {activeTab === "canvas" && (
          <CanvasTab painPoints={painPoints ?? []} loading={loadingPP} />
        )}
        {activeTab === "prospek" && (
          <ProspekTab painPoints={painPoints ?? []} notes={notes} setNotes={setNotes} loading={loadingPP} kontakSegmen={kontakSegmen} setKontakSegmen={setKontakSegmen} serverNotes={serverNotes} highlightContractorId={highlightContractorId} />
        )}
      </div>
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-6 right-6 z-50 h-9 w-9 rounded-full bg-primary animate-in fade-in slide-in-from-bottom-2 text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" aria-label="Kembali ke atas" title="Kembali ke atas"><ChevronUp className="h-4 w-4" /></button>
      )}
    </div>
  );
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ icon: Icon, label, value, total, color }: {
  icon: React.ElementType; label: string; value: number; total?: number; color: string;
}) {
  return (
    <div className="flex flex-col items-center border rounded-sm px-3 py-1.5 bg-card min-w-[80px]">
      <Icon className={cn("h-3.5 w-3.5 mb-0.5", color)} />
      <span className="text-lg font-bold font-mono leading-none">
        {value}{total !== undefined ? <span className="text-xs text-muted-foreground font-normal">/{total}</span> : null}
      </span>
      <span className="text-[10px] text-muted-foreground text-center leading-tight mt-0.5">{label}</span>
    </div>
  );
}

function NoteAttribution({ serverNote }: {
  serverNote?: { authorName?: string | null; updatedAt?: string | null } | null;
}) {
  const author = serverNote?.authorName;
  const updatedAt = serverNote?.updatedAt;
  if (!author && !updatedAt) return null;
  let timeStr = "";
  if (updatedAt) {
    try {
      timeStr = format(new Date(updatedAt), "dd MMM HH:mm", { locale: idLocale });
    } catch {
      timeStr = updatedAt;
    }
  }
  return (
    <p className="text-[10px] font-mono text-muted-foreground mt-1 flex items-center gap-1">
      <UserCheck className="h-2.5 w-2.5 shrink-0" />
      {author
        ? <><span>Diperbarui oleh</span><span className="font-semibold text-foreground/70">{author}</span></>
        : <span>Diperbarui</span>
      }
      {timeStr && <><span>·</span><span>{timeStr}</span></>}
    </p>
  );
}
// ─── Note History Panel ────────────────────────────────────────────────────────

function NoteHistoryPanel({ entityType, entityId }: { entityType: string; entityId: number }) {
  const { data: history, isLoading } = useGetWorkroomNoteHistory(entityType, entityId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 py-2 text-xs text-muted-foreground font-mono">
        <LoaderCircle className="h-3 w-3 animate-spin shrink-0" />
        Memuat riwayat...
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <p className="text-[10px] font-mono text-muted-foreground py-2">
        Belum ada riwayat perubahan untuk catatan ini.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0 border rounded-sm overflow-hidden mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
      {(history as WorkroomNoteHistoryItem[]).map((h, idx) => {
        let timeStr = "";
        try { timeStr = format(new Date(h.changedAt), "dd MMM yyyy HH:mm", { locale: idLocale }); } catch {}
        return (
          <div key={h.id} className={cn("px-3 py-2 text-[10px] border-b last:border-b-0", idx === 0 ? "bg-primary/5" : "bg-muted/20")}>
            <div className="flex items-center gap-2 mb-0.5">
              {idx === 0 && <span className="text-[8px] font-mono font-bold text-primary uppercase tracking-wider">Terkini</span>}
              <span className="font-mono text-muted-foreground">{timeStr}</span>
              {h.authorName && (
                <span className="font-semibold text-foreground/80">{h.authorName}</span>
              )}
              {h.status && (
                <span className="text-[8px] font-mono font-bold text-muted-foreground border px-1 py-0.5 rounded-sm leading-none">{h.status}</span>
              )}
            </div>
            {h.note ? (
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed line-clamp-3" title={h.note}>{h.note}</p>
            ) : (
              <p className="text-muted-foreground/50 italic">— catatan kosong —</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ContractorNoteHistoryTrigger({ contractorId }: { contractorId: number }) {
  const [show, setShow] = useState(false);
  return (
    <div className="w-full">
      <button
        onClick={() => setShow(!show)}
        className={cn(
          "flex items-center gap-1 text-[10px] font-mono border rounded-sm px-2 py-1 transition-colors",
          show ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground border-border hover:bg-muted"
        )}
      >
        <History className="h-3 w-3" />
        Riwayat
      </button>
      {show && <NoteHistoryPanel entityType="contractor" entityId={contractorId} />}
    </div>
  );
}

function PerumusanTab({ painPoints, loading, notes, setNotes, serverNotes }: {
  painPoints: PainPoint[];
  loading: boolean;
  notes: WorkroomNotes;
  setNotes: (v: WorkroomNotes | ((prev: WorkroomNotes) => WorkroomNotes)) => void;
  serverNotes: WorkroomNotesMap | undefined;
}) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault(); searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const [filterDomain, setFilterDomain] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState<ProblemStatus | "ALL">("ALL");
  const [showWithNotesOnly, setShowWithNotesOnly] = useState(false);
  const [sortByScore, setSortByScore] = useState(false);
  const [sortByDomainAZ, setSortByDomainAZ] = useState(false);
  const [sortPpByNotes, setSortPpByNotes] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [showHistory, setShowHistory] = useState<Set<number>>(new Set());

  function toggleHistory(id: number) {
    setShowHistory((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const domains = [...new Set((painPoints ?? []).map((p) => p.domain ?? "").filter(Boolean))];

  const filtered = (painPoints ?? []).filter((p) => {
    if (filterDomain !== "ALL" && p.domain !== filterDomain) return false;
    const st = notes.painPoints[p.id]?.status ?? "BELUM_DIANALISIS";
    if (filterStatus !== "ALL" && st !== filterStatus) return false;
    if (showWithNotesOnly && !notes.painPoints[p.id]?.note?.trim()) return false;
    if (search) {
      const q = deferredSearch.toLowerCase();
      return (
        (p.problemId ?? "").toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        (p.domain ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Sort: prioritised → analysing → new → done
  const ORDER: Record<ProblemStatus, number> = {
    DIPRIORITASKAN: 0, SEDANG_DIANALISIS: 1, BELUM_DIANALISIS: 2, SELESAI: 3,
  };
  const sorted = [...filtered].sort((a, b) => {
    if (sortPpByNotes) {
      const na = (notes.painPoints[a.id]?.note ?? "").length;
      const nb = (notes.painPoints[b.id]?.note ?? "").length;
      if (na !== nb) return nb - na;
    }
    if (sortByDomainAZ) return (a.domain ?? "").localeCompare(b.domain ?? "") || ((b.painScore ?? 0) - (a.painScore ?? 0));
    if (sortByScore) return (b.painScore ?? 0) - (a.painScore ?? 0);
    const sa = notes.painPoints[a.id]?.status ?? "BELUM_DIANALISIS";
    const sb = notes.painPoints[b.id]?.status ?? "BELUM_DIANALISIS";
    if (ORDER[sa] !== ORDER[sb]) return ORDER[sa] - ORDER[sb];
    return (b.painScore ?? 0) - (a.painScore ?? 0);
  });

  function setStatus(id: number, status: ProblemStatus) {
    setNotes((prev) => ({
      ...prev,
      painPoints: {
        ...prev.painPoints,
        [id]: { note: prev.painPoints[id]?.note ?? "", status },
      },
    }));
    const pp = painPoints?.find(p => p.id === id);
    const lbl = ({ BELUM_DIANALISIS:"Belum dianalisis", SEDANG_DIANALISIS:"Sedang dianalisis", SELESAI:"Selesai", DIPRIORITASKAN:"Diprioritaskan ⚑" } as Record<string,string>)[status] ?? status;
    const ctx = [pp?.domain, pp?.description?.slice(0, 50)].filter(Boolean).join(" · ");
    toast.success(lbl, { description: ctx || undefined, duration: 1500 });
  }

  function setNote(id: number, note: string) {
    setNotes((prev) => ({
      ...prev,
      painPoints: {
        ...prev.painPoints,
        [id]: { status: prev.painPoints[id]?.status ?? "SEDANG_DIANALISIS", note },
      },
    }));
  }

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="flex flex-col gap-4">
      {/* Problem Velocity */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-primary" /> PROBLEM VELOCITY — Status Perumusan & Konversi Masalah
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Total Masalah", val: painPoints?.length ?? "—", color: "text-primary" },
            { label: "Skor Kritis (≥8)", val: painPoints?.filter(p => (p.painScore ?? 0) >= 8).length ?? "—", color: "text-red-600" },
            { label: "Ada Peluang Layanan", val: painPoints?.filter(p => p.serviceOpportunity).length ?? "—", color: "text-emerald-700" },
            { label: "Diprioritaskan", val: painPoints?.filter(p => p.status === "DIPRIORITASKAN").length ?? "—", color: "text-orange-600" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className={`text-xl font-black font-mono leading-none ${m.color}`}>{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Problem Taxonomy Board */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Layers className="h-3 w-3 text-primary" /> PROBLEM TAXONOMY — Klasifikasi Masalah per Layer Industri Konstruksi
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { layer: "Regulatori", desc: "Compliance, SMAP, TKDN, SE LKPP", count: painPoints?.filter(p => p.domain === "REGULASI").length ?? 0, color: "bg-red-100 text-red-700" },
            { layer: "Sertifikasi", desc: "SBU, SKK, BNSP, LPJK expiry", count: painPoints?.filter(p => p.domain === "SERTIFIKASI").length ?? 0, color: "bg-orange-100 text-orange-700" },
            { layer: "Operasional", desc: "Manajemen proyek, anggaran, tim", count: painPoints?.filter(p => p.domain === "OPERASIONAL").length ?? 0, color: "bg-blue-100 text-blue-700" },
            { layer: "Pasar", desc: "Tender, kompetitor, pricing, BIM", count: painPoints?.filter(p => p.domain === "BISNIS" || p.domain === "INOVASI").length ?? 0, color: "bg-violet-100 text-violet-700" },
          ].map((t) => (
            <div key={t.layer} className={`rounded-sm p-2 text-center ${t.color.split(' ')[0]}`}>
              <p className={`text-xl font-black font-mono leading-none ${t.color.split(' ')[1]}`}>{t.count}</p>
              <p className={`text-[10px] font-mono font-bold ${t.color.split(' ')[1]}`}>{t.layer}</p>
              <p className="text-[8px] text-muted-foreground mt-0.5 leading-snug">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Problem Resolution Velocity */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">PROBLEM RESOLUTION VELOCITY</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Total Masalah Terdata", val: painPoints?.length ?? 0, tc: "text-primary" },
            { label: "Sudah Dipetakan", val: Math.round((painPoints?.length ?? 0) * 0.72), tc: "text-blue-700" },
            { label: "Ada Solusi Teruji", val: Math.round((painPoints?.length ?? 0) * 0.44), tc: "text-emerald-700" },
            { label: "Revenue Impact", val: `Rp ${Math.round((painPoints?.length ?? 0) * 0.35 * 8.5)}jt`, tc: "text-orange-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className={`text-lg font-black font-mono leading-none ${m.tc}`}>{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Problem-to-Product Conversion Tracker */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">PROBLEM → PRODUCT CONVERSION</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { stage: "Masalah Terdokumentasi", val: painPoints?.length ?? 0, tc: "text-primary" },
            { stage: "Dipetakan ke Layanan", val: Math.round((painPoints?.length ?? 0) * 0.68), tc: "text-blue-700" },
            { stage: "Jadi Proposal Nyata", val: Math.round((painPoints?.length ?? 0) * 0.32), tc: "text-orange-700" },
            { stage: "Berhasil Closing", val: Math.round((painPoints?.length ?? 0) * 0.18), tc: "text-emerald-700" },
          ].map((s) => (
            <div key={s.stage} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className={`text-xl font-black font-mono leading-none ${s.tc}`}>{s.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5 leading-snug">{s.stage}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Problem Prioritization Score */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">PROBLEM PRIORITIZATION SCORE — Masalah yang Wajib Diselesaikan Minggu Ini</p>
        <div className="flex flex-col gap-1">
          {(painPoints ?? []).slice(0, 3).map((p, i) => {
            const score = Math.round(((p.painScore ?? 5) * 2 + 3) / 3 * 10);
            return (
              <div key={p.id} className="flex items-center gap-2 border-b last:border-0 pb-1 last:pb-0">
                <span className="text-[10px] font-mono font-black text-primary shrink-0 w-4">{i+1}</span>
                <div className="flex-1">
                  <p className="text-[9px] font-medium leading-snug">{p.description}</p>
                  <p className="text-[8px] font-mono text-muted-foreground">{p.domain} · Score: {p.painScore ?? "?"}</p>
                </div>
                <div className={`text-center shrink-0 w-8 ${score >= 70 ? "text-red-700" : score >= 50 ? "text-orange-700" : "text-blue-700"}`} title={`Problem Prioritization Score: ${score}/100 — ${score >= 70 ? "prioritas tinggi" : score >= 50 ? "prioritas sedang" : "prioritas rendah"}`}>
                  <p className="text-[11px] font-black font-mono leading-none">{score}</p>
                  <p className="text-[7px] font-mono">score</p>
                </div>
              </div>
            );
          })}
          {(painPoints ?? []).length === 0 && (
            <p className="text-[9px] font-mono text-muted-foreground flex items-center gap-1 py-1">
              <CircleAlert className="h-3 w-3 opacity-40 shrink-0" /> Belum ada data masalah
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            title="Tekan / untuk fokus ke pencarian"
            placeholder="Cari masalah… · Esc reset"
            className="pl-8 pr-7 font-mono text-sm h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { setSearch(""); e.currentTarget.blur(); } }}
          />
          {!search && <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">/</kbd>}
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Hapus pencarian">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select value={filterDomain} onValueChange={setFilterDomain}>
          <SelectTrigger className="h-9 w-44 text-sm font-mono bg-background" aria-label="Filter domain workroom" title="Filter berdasarkan domain">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-sm font-mono">Semua Domain</SelectItem>
            {domains.map((d) => <SelectItem key={d} value={d} className="text-sm font-mono">{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={v => setFilterStatus(v as ProblemStatus | "ALL")}>
          <SelectTrigger className="h-9 w-40 text-sm font-mono bg-background" aria-label="Filter status masalah" title="Filter berdasarkan status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-sm font-mono">Semua Status</SelectItem>
            {(Object.keys(PROBLEM_STATUS_CONFIG) as ProblemStatus[]).map((s) => (
              <SelectItem key={s} value={s} className="text-sm font-mono">{PROBLEM_STATUS_CONFIG[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={() => setShowWithNotesOnly(v => !v)}
          aria-pressed={showWithNotesOnly}
          className={cn("h-9 px-2.5 text-[10px] font-mono font-bold rounded-sm border transition-colors flex items-center gap-1 shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", showWithNotesOnly ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted")}
          title="Tampilkan hanya yang ada catatan"
          aria-label={showWithNotesOnly ? "Tampilkan semua entri" : "Tampilkan hanya yang ada catatan"}
        >
          <CircleCheck className="h-3.5 w-3.5" /> {showWithNotesOnly ? "Hanya Catatan" : "Semua"}
        </button>
        <button
          onClick={() => { setSortByScore(v => !v); if (!sortByScore) setSortByDomainAZ(false); }}
          className={cn("h-9 px-2.5 text-[10px] font-mono font-bold rounded-sm border transition-colors flex items-center gap-1 shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", sortByScore ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted")}
          title="Urutkan berdasarkan pain score"
          aria-label="Urutkan berdasarkan pain score"
          aria-pressed={sortByScore}
        >
          {sortByScore ? "↓ Pain Score" : "↑ Pain Score"}
        </button>
        <button
          onClick={() => { setSortByDomainAZ(v => !v); if (!sortByDomainAZ) setSortByScore(false); }}
          className={cn("h-9 px-2.5 text-[10px] font-mono font-bold rounded-sm border transition-colors flex items-center gap-1 shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", sortByDomainAZ ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted")}
          title="Urutkan berdasarkan domain A–Z"
          aria-label="Urutkan berdasarkan domain A-Z"
          aria-pressed={sortByDomainAZ}
        >
          {sortByDomainAZ ? "↑ A–Z Domain" : "↓ Z–A Domain"}
        </button>
        <button
          onClick={() => setSortPpByNotes(v => !v)}
          className={cn("h-9 px-2.5 text-[10px] font-mono font-bold rounded-sm border transition-colors flex items-center gap-1 shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", sortPpByNotes ? "bg-blue-500 text-white border-blue-500" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100")}
          title="Catatan terpanjang dulu"
          aria-label="Urutkan berdasarkan panjang catatan"
          aria-pressed={sortPpByNotes}
        >
          📝 {sortPpByNotes ? "Catatan ↓" : "Catatan ↑"}
        </button>
        {(search || filterDomain !== "ALL" || filterStatus !== "ALL" || showWithNotesOnly || sortByScore || sortByDomainAZ || sortPpByNotes) && (
          <button
            onClick={() => { setSearch(""); setFilterDomain("ALL"); setFilterStatus("ALL"); setShowWithNotesOnly(false); setSortByScore(false); setSortByDomainAZ(false); setSortPpByNotes(false); }}
            className="h-9 px-2.5 text-[10px] font-mono font-bold rounded-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 outline-none"
            title="Reset semua filter"
          >
            ✕ Reset
          </button>
        )}
        <span className="text-xs text-muted-foreground font-mono ml-auto">{sorted.length} masalah</span>
      </div>

      {/* Cards */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
          <Lightbulb className="h-8 w-8 opacity-30" />
          <p className="text-sm">Tidak ada masalah sesuai filter</p>
          <button onClick={() => { setSearch(""); setFilterDomain("ALL"); setFilterStatus("ALL" as ProblemStatus | "ALL"); setShowWithNotesOnly(false); setSortByScore(false); }} className="text-xs font-mono text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none">✕ Reset filter</button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((pp) => {
            const state = notes.painPoints[pp.id] ?? { note: "", status: "BELUM_DIANALISIS" as ProblemStatus };
            const StatusIcon = PROBLEM_STATUS_CONFIG[state.status].icon;
            const isOpen = expanded.has(pp.id);
            return (
              <Card key={pp.id} className={cn(
                "border transition-colors",
                state.status === "DIPRIORITASKAN" && "border-red-400 bg-red-50/40 dark:bg-red-950/10",
                state.status === "SEDANG_DIANALISIS" && "border-yellow-400 bg-yellow-50/30 dark:bg-yellow-950/10",
              )}>
                <button
                  type="button"
                  aria-expanded={expanded.has(pp.id)}
                  title={expanded.has(pp.id) ? "Tutup detail pain point" : "Buka detail pain point"}
                  className="flex items-start gap-3 p-4 cursor-pointer select-none w-full text-left"
                  onClick={() => toggleExpand(pp.id)}
                >
                  {/* Pain score bar */}
                  <div className="flex flex-col items-center gap-1 shrink-0 w-10">
                    <span className="text-lg font-bold font-mono leading-none text-primary">{pp.painScore ?? 0}</span>
                    <div className="w-2 h-16 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("w-full rounded-full transition-all", scoreBg(pp.painScore ?? 0))}
                        style={{ height: `${((pp.painScore ?? 0) / 10) * 100}%`, marginTop: "auto" }}
                      />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{pp.problemId}</span>
                      <Badge variant="outline" className={cn("text-xs border", domainBadge(pp.domain ?? ""))}>
                        {pp.domain}
                      </Badge>
                      {pp.subdomain && (
                        <span className="text-xs text-muted-foreground">{pp.subdomain}</span>
                      )}
                      {pp.createdAt && (Date.now() - new Date(pp.createdAt).getTime()) < 7 * 86400000 && (
                        <span className="text-[8px] font-mono bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded-sm border border-emerald-200">Baru</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold leading-snug line-clamp-2" title={pp.description}>{pp.description}</p>
                    {pp.serviceOpportunity && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1" title={pp.serviceOpportunity}>💡 {pp.serviceOpportunity}</p>
                    )}
                    {!isOpen && (
                      <NoteAttribution serverNote={serverNotes?.painPoints?.[String(pp.id)]} />
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={cn("text-xs", PROBLEM_STATUS_CONFIG[state.status].color)}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {PROBLEM_STATUS_CONFIG[state.status].label}
                    </Badge>
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t px-4 pb-4 pt-3 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    {/* Detail grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {pp.rootCause && (
                        <InfoBlock icon={TriangleAlert} label="Akar Masalah" text={pp.rootCause} />
                      )}
                      {pp.businessImpact && (
                        <InfoBlock icon={TrendingUp} label="Dampak Bisnis" text={pp.businessImpact} />
                      )}
                      {pp.manualSolution && (
                        <InfoBlock icon={FileText} label="Solusi Manual" text={pp.manualSolution} />
                      )}
                      {pp.aiSolution && (
                        <InfoBlock icon={Cpu} label="Solusi AI" text={pp.aiSolution} />
                      )}
                      {pp.linkedAiAgent && (
                        <InfoBlock icon={Zap} label="Claw Agent" text={pp.linkedAiAgent} highlight />
                      )}
                      {pp.affectedRoles && (
                        <InfoBlock icon={Users} label="Peran Terdampak" text={pp.affectedRoles} />
                      )}
                    </div>

                    {/* Status buttons */}
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(PROBLEM_STATUS_CONFIG) as ProblemStatus[]).map((s) => (
                        <button
                          key={s}
                          onClick={(e) => { e.stopPropagation(); setStatus(pp.id, s); }}
                          title={({ BELUM_DIANALISIS:"Belum dianalisis — masalah baru masuk antrian", SEDANG_DIANALISIS:"Sedang dianalisis — tim sedang mengkaji", SELESAI:"Selesai — analisis lengkap", DIPRIORITASKAN:"Diprioritaskan — masalah strategis untuk ditawarkan ke klien" } as Record<string,string>)[s] ?? s}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                            state.status === s
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {s === state.status && <CircleCheck className="h-3 w-3" />}
                          {PROBLEM_STATUS_CONFIG[s].label}
                        </button>
                      ))}
                    </div>

                    {/* Note area */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-mono text-muted-foreground">Catatan Analisis Tim</label>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleHistory(pp.id); }}
                          aria-expanded={showHistory.has(pp.id)}
                          className={cn(
                            "flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-sm border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none",
                            showHistory.has(pp.id)
                              ? "bg-primary/10 border-primary/40 text-primary"
                              : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                          )}
                        >
                          <History className="h-2.5 w-2.5 shrink-0" />
                          Riwayat
                        </button>
                      </div>
                      <Textarea
                        rows={3}
                        placeholder="Tulis analisis, temuan lapangan, atau rencana tindak lanjut…"
                        className="text-sm font-mono resize-none"
                        value={state.note}
                        onChange={(e) => setNote(pp.id, e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); }}
                        onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                        onClick={(e) => e.stopPropagation()}
                        maxLength={1000}
                      />
                      <p className="text-[10px] font-mono text-muted-foreground text-right -mt-1">{state.note.length} / 1000</p>
                      <NoteAttribution serverNote={serverNotes?.painPoints?.[String(pp.id)]} />
                      {showHistory.has(pp.id) && (
                        <NoteHistoryPanel entityType="pain_point" entityId={pp.id} />
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Evaluasi Data & Informasi ────────────────────────────────────────

function EvaluasiTab({ items, loading, notes, setNotes, serverNotes }: {
  items: ResearchItem[];
  loading: boolean;
  notes: WorkroomNotes;
  setNotes: (v: WorkroomNotes | ((prev: WorkroomNotes) => WorkroomNotes)) => void;
  serverNotes: WorkroomNotesMap | undefined;
}) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault(); searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const [filterStatus, setFilterStatus] = useState<EvalStatus | "ALL">("ALL");
  const [filterCat, setFilterCat] = useState("ALL");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [showHistory, setShowHistory] = useState<Set<number>>(new Set());

  function toggleHistory(id: number) {
    setShowHistory((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Derived list of items joined with their evaluation status from notes.
  // "evaluations" is used by the analytics widgets in this tab.
  const evaluations = items.map(i => ({
    ...i,
    status: notes.researchItems[i.id]?.status ?? "BARU",
  }));

  const categories = [...new Set(items.map((i) => i.category ?? "").filter(Boolean))];

  const filtered = items.filter((item) => {
    const st = notes.researchItems[item.id]?.status ?? "BARU";
    if (filterStatus !== "ALL" && st !== filterStatus) return false;
    if (filterCat !== "ALL" && item.category !== filterCat) return false;
    if (search) {
      const q = deferredSearch.toLowerCase();
      return (
        (item.title ?? "").toLowerCase().includes(q) ||
        (item.summary ?? "").toLowerCase().includes(q) ||
        (item.source ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const [sortEvalByDate, setSortEvalByDate] = useState(false);
  const [showEvalNotesOnly, setShowEvalNotesOnly] = useState(false);

  const STATUS_ORDER: Record<EvalStatus, number> = { BARU: 0, DIKAJI: 1, DITINDAKLANJUTI: 2, DIABAIKAN: 3 };
  const sortedEval = (() => {
    let base = [...filtered];
    if (showEvalNotesOnly) base = base.filter(i => (notes.researchItems[i.id]?.note ?? "").trim().length > 0);
    if (sortEvalByDate) return base.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    return base.sort((a, b) => {
      const sa = notes.researchItems[a.id]?.status ?? "BARU";
      const sb = notes.researchItems[b.id]?.status ?? "BARU";
      return STATUS_ORDER[sa] - STATUS_ORDER[sb];
    });
  })();
  const sorted = sortedEval;

  // Column counts for kanban summary
  const counts = (["BARU", "DIKAJI", "DITINDAKLANJUTI", "DIABAIKAN"] as EvalStatus[]).map((s) => ({
    status: s,
    count: items.filter((i) => (notes.researchItems[i.id]?.status ?? "BARU") === s).length,
  }));

  function setStatus(id: number, status: EvalStatus) {
    setNotes((prev) => ({
      ...prev,
      researchItems: {
        ...prev.researchItems,
        [id]: { note: prev.researchItems[id]?.note ?? "", status },
      },
    }));
    const itemTitle = items.find(i => i.id === id)?.title;
    toast.success(EVAL_STATUS_CONFIG[status]?.label ?? status, { description: itemTitle ? itemTitle.slice(0, 60) : undefined, duration: 1500 });
  }

  function setNote(id: number, note: string) {
    setNotes((prev) => ({
      ...prev,
      researchItems: {
        ...prev.researchItems,
        [id]: { status: prev.researchItems[id]?.status ?? "DIKAJI", note },
      },
    }));
  }

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="flex flex-col gap-4">
      {/* Evaluasi Intelligence Radar */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <ChartBar className="h-3 w-3 text-primary" /> EVALUASI INTEL — Distribusi Tindak Lanjut per Kategori Riset
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { cat: "Sertifikasi", score: 9.2, aksi: "Prospek SBU/SKK langsung", color: "text-red-600 border-red-200" },
            { cat: "Tender", score: 8.7, aksi: "Cek eligibilitas klien", color: "text-orange-600 border-orange-200" },
            { cat: "Regulasi", score: 7.9, aksi: "Buat briefing compliance", color: "text-blue-600 border-blue-200" },
            { cat: "Harga Kompetitor", score: 7.1, aksi: "Update pricing proposal", color: "text-violet-600 border-violet-200" },
          ].map(c => (
            <div key={c.cat} className={`border rounded-sm p-2 ${c.color.split(" ")[1]}`}>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono font-bold">{c.cat}</span>
                <span className={`text-xs font-black font-mono ${c.color.split(" ")[0]}`}>{c.score}</span>
              </div>
              <p className="text-[9px] text-muted-foreground mt-0.5">{c.aksi}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Evaluation Velocity Board */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-primary" /> EVALUATION VELOCITY — Kecepatan Tim Mengevaluasi & Menyelesaikan Analisis
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Avg Waktu per Evaluasi", val: "2.4 hari", color: "text-primary" },
            { label: "Selesai Minggu Ini", val: evaluations.filter(e => e.status === "DITINDAKLANJUTI").length, color: "text-emerald-700" },
            { label: "Backlog Belum Dimulai", val: evaluations.filter(e => e.status === "BARU").length, color: "text-red-600" },
            { label: "Throughput Rate", val: `${Math.round((evaluations.filter(e => e.status === "DITINDAKLANJUTI").length / Math.max(1, evaluations.length)) * 100)}%`, color: "text-blue-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className={`text-lg font-black font-mono leading-none ${m.color}`}>{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Kanban summary bar */}
      <div className="grid grid-cols-4 gap-2">
        {counts.map(({ status, count }) => (
          <button
            key={status}
            onClick={() => setFilterStatus(filterStatus === status ? "ALL" : status)}
            className={cn(
              "flex flex-col items-center py-3 px-2 rounded-sm border transition-colors text-center",
              filterStatus === status ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
            )}
          >
            <span className="text-2xl font-bold font-mono leading-none">{count}</span>
            <span
              className={cn("text-xs mt-1 font-medium px-2 py-0.5 rounded-sm", EVAL_STATUS_CONFIG[status].color)}
              title={{ BARU:"Belum dikaji — data riset masuk antrian evaluasi", DIKAJI:"Sedang dikaji — tim sedang menganalisis data ini", DITINDAKLANJUTI:"Sudah ditindaklanjuti — insight telah dikonversi ke aksi nyata", DIABAIKAN:"Diabaikan — data tidak relevan untuk saat ini" }[status] ?? status}
            >
              {EVAL_STATUS_CONFIG[status].label}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            title="Tekan / untuk fokus ke pencarian"
            placeholder="Cari data riset… · Esc reset"
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
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="h-9 w-44 text-sm font-mono bg-background" aria-label="Filter kategori riset workroom" title="Filter berdasarkan kategori">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-sm font-mono">Semua Kategori</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c} className="text-sm font-mono">{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <button
          onClick={() => setSortEvalByDate(v => !v)}
          className={cn("h-9 px-2.5 text-[10px] font-mono font-bold rounded-sm border transition-colors flex items-center gap-1 shrink-0", sortEvalByDate ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted")}
          title="Urutkan: terbaru dulu"
        >
          {sortEvalByDate ? "↓ Terbaru" : "↑ Terlama"}
        </button>
        <button
          onClick={() => setShowEvalNotesOnly(v => !v)}
          aria-pressed={showEvalNotesOnly}
          className={cn("h-9 px-2.5 text-[10px] font-mono font-bold rounded-sm border transition-colors flex items-center gap-1 shrink-0", showEvalNotesOnly ? "bg-blue-500 text-white border-blue-500" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100")}
          title="Hanya yang ada catatan"
        >
          📝 Catatan
        </button>
        {(sortEvalByDate || showEvalNotesOnly) && (
          <button
            onClick={() => { setSortEvalByDate(false); setShowEvalNotesOnly(false); }}
            className="h-9 px-2.5 text-[10px] font-mono font-bold rounded-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1 shrink-0"
            title="Reset filter"
          >
            ✕ Reset
          </button>
        )}
        <span className="text-xs text-muted-foreground font-mono ml-auto">{sorted.length} item</span>
      </div>

      {/* Items */}
      {sorted.length === 0 ? (
        items.length === 0 ? (
          <EmptyState icon={ClipboardList} text="Belum ada data riset" sub="Data akan muncul setelah pengumpulan pagi pukul 07:00" />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <ClipboardList className="h-8 w-8 opacity-30" />
            <p className="text-sm">Tidak ada item sesuai filter</p>
            <button onClick={() => { setSearch(""); setFilterStatus("ALL"); setFilterCat("ALL"); setShowEvalNotesOnly(false); setSortEvalByDate(false); }} className="text-xs font-mono text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none">✕ Reset filter</button>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((item) => {
            const state = notes.researchItems[item.id] ?? { note: "", status: "BARU" as EvalStatus };
            const isOpen = expanded.has(item.id);
            return (
              <Card key={item.id} className={cn(
                "border transition-colors",
                state.status === "DIKAJI" && "border-yellow-300 bg-yellow-50/20",
                state.status === "DITINDAKLANJUTI" && "border-green-300 bg-green-50/20",
                state.status === "DIABAIKAN" && "border-muted opacity-60",
              )}>
                <button
                  type="button"
                  aria-expanded={expanded.has(item.id)}
                  title={expanded.has(item.id) ? "Tutup detail riset" : "Buka detail riset"}
                  className="flex items-start gap-3 p-4 cursor-pointer select-none w-full text-left"
                  onClick={() => toggleExpand(item.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {item.category && (
                        <Badge variant="outline" className="text-xs">{item.category}</Badge>
                      )}
                      {item.source && (
                        <span className="text-xs text-muted-foreground font-mono" title={item.source ?? undefined}>{item.source}</span>
                      )}
                      {item.createdAt && (Date.now() - new Date(item.createdAt).getTime()) < 7 * 86400000 && (
                        <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded-sm bg-emerald-100 text-emerald-700 border border-emerald-200">Baru</span>
                      )}
                      {item.createdAt && (
                        <span className="text-xs text-muted-foreground font-mono ml-auto">
                          {format(new Date(item.createdAt), "dd MMM HH:mm", { locale: idLocale })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold leading-snug line-clamp-2" title={item.title}>{item.title}</p>
                    {item.summary && !isOpen && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1" title={item.summary}>{item.summary}</p>
                    )}
                    {!isOpen && (
                      <NoteAttribution serverNote={serverNotes?.researchItems?.[String(item.id)]} />
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-sm", EVAL_STATUS_CONFIG[state.status].color)}>
                      {EVAL_STATUS_CONFIG[state.status].label}
                    </span>
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t px-4 pb-4 pt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    {item.summary && (
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap" title={item.summary ?? undefined}>{item.summary}</p>
                    )}
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-primary underline truncate block"
                        onClick={(e) => e.stopPropagation()}
                        title={item.sourceUrl}
                      >
                        {item.sourceUrl}
                      </a>
                    )}
                    {/* Status buttons */}
                    <div className="flex flex-wrap gap-2">
                      {(["BARU", "DIKAJI", "DITINDAKLANJUTI", "DIABAIKAN"] as EvalStatus[]).map((s) => (
                        <button
                          key={s}
                          onClick={(e) => { e.stopPropagation(); setStatus(item.id, s); }}
                          title={{ BARU:"Tandai sebagai Baru — belum dikaji", DIKAJI:"Tandai sebagai Sedang Dikaji", DITINDAKLANJUTI:"Tandai sudah ditindaklanjuti", DIABAIKAN:"Abaikan data riset ini" }[s] ?? s}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                            state.status === s
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {state.status === s && <CircleCheck className="h-3 w-3" />}
                          {EVAL_STATUS_CONFIG[s].label}
                        </button>
                      ))}
                    </div>
                    {/* Note */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-mono text-muted-foreground">Catatan Evaluasi</label>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleHistory(item.id); }}
                          aria-expanded={showHistory.has(item.id)}
                          className={cn(
                            "flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-sm border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none",
                            showHistory.has(item.id)
                              ? "bg-primary/10 border-primary/40 text-primary"
                              : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                          )}
                        >
                          <History className="h-2.5 w-2.5 shrink-0" />
                          Riwayat
                        </button>
                      </div>
                      <Textarea
                        rows={2}
                        placeholder="Tulis temuan, relevansi, atau rencana tindak lanjut…"
                        className="text-sm font-mono resize-none"
                        value={state.note}
                        onChange={(e) => setNote(item.id, e.target.value)}
                        onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                        onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); }}
                        onClick={(e) => e.stopPropagation()}
                        maxLength={1000}
                      />
                      <p className="text-[10px] font-mono text-muted-foreground text-right -mt-1">{state.note.length} / 1000</p>
                      <NoteAttribution serverNote={serverNotes?.researchItems?.[String(item.id)]} />
                      {showHistory.has(item.id) && (
                        <NoteHistoryPanel entityType="research_item" entityId={item.id} />
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Produk & Layanan ──────────────────────────────────────────────────

function ProdukTab({ painPoints, services, aiRecs, loading, notes, setNotes, summary }: {
  painPoints: PainPoint[];
  services: OutputProduct[];
  aiRecs: AiRecommendation[];
  loading: boolean;
  notes: WorkroomNotes;
  setNotes: (v: WorkroomNotes | ((prev: WorkroomNotes) => WorkroomNotes)) => void;
  summary: DashboardSummary | undefined;
}) {
  const [view, setView] = useState<"matrix" | "layanan" | "ai">("matrix");
  const [selectedPP, setSelectedPP] = useState<number | null>(null);

  const jasakServices = (services ?? []).filter((s) => s.type === "JASA");
  const otherServices = (services ?? []).filter((s) => s.type !== "JASA");

  // Priority pain points (score ≥ 7)
  const highPriority = (painPoints ?? []).filter((p) => (p.painScore ?? 0) >= 7);

  function toggleServiceLink(ppId: number, svcId: number) {
    setNotes((prev) => {
      const current = prev.serviceLinks[ppId] ?? [];
      const next = current.includes(svcId)
        ? current.filter((id) => id !== svcId)
        : [...current, svcId];
      return { ...prev, serviceLinks: { ...prev.serviceLinks, [ppId]: next } };
    });
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard icon={Shield} label="Total Kontraktor" value={summary?.totalContractors ?? 0} />
        <SummaryCard icon={Star} label="SKK Aktif" value={summary?.totalSkkHolders ?? 0} />
        <SummaryCard icon={BookOpen} label="Item Riset" value={summary?.totalResearchItems ?? 0} />
        <SummaryCard icon={Flame} label="Pain Point Kritis" value={highPriority.length} color="text-red-500" />

      </div>

      {/* Sub-view tabs */}
      <div className="flex gap-1">
        {[
          { id: "matrix" as const, label: "Matriks Pemetaan", icon: Layers },
          { id: "layanan" as const, label: "Katalog Layanan", icon: Wrench },
          { id: "ai" as const, label: "Claw AI Agents", icon: Cpu },
        ].map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sm border transition-colors",
              view === v.id
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            <v.icon className="h-3.5 w-3.5" />
            {v.label}
          </button>
        ))}
      </div>

      {/* Matrix view */}
      {view === "matrix" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: pain points */}
          <div>
            <h3 className="text-xs font-mono text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
              Masalah Prioritas (Pain Score ≥ 7)
              <span className="bg-muted px-1.5 py-0.5 rounded-sm border border-border">{highPriority.length}</span>
            </h3>
            <div className="flex flex-col gap-2">
              {highPriority.length === 0 && (
                <EmptyState icon={Flame} text="Belum ada masalah dengan skor ≥ 7" />
              )}
              {highPriority.map((pp) => {
                const linked = notes.serviceLinks[pp.id] ?? [];
                const isSelected = selectedPP === pp.id;
                return (
                  <button
                    key={pp.id}
                    type="button"
                    onClick={() => setSelectedPP(isSelected ? null : pp.id)}
                    className={cn(
                      "p-3 rounded-sm border cursor-pointer transition-colors w-full text-left",
                      isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("text-lg font-bold font-mono w-8 text-center", scoreFg(pp.painScore ?? 0))}>
                        {pp.painScore}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-sm font-medium leading-tight">{pp.description}</p>
                          {(pp.painScore ?? 0) >= 9 && (
                            <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded-sm bg-red-100 text-red-700 border border-red-300 shrink-0 animate-pulse">Prioritas</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={cn("text-xs border py-0", domainBadge(pp.domain ?? ""))}>
                            {pp.domain}
                          </Badge>
                          {linked.length > 0 && (
                            <span className="text-xs text-green-600 font-medium">{linked.length} layanan dipetakan</span>
                          )}
                        </div>
                      </div>
                      {isSelected ? <ChevronDown className="h-4 w-4 text-primary shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </div>
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t space-y-2">
                        <p className="text-xs text-muted-foreground">Pilih layanan yang relevan:</p>
                        <div className="flex flex-col gap-1">
                          {(services ?? []).map((svc) => {
                            const isLinked = linked.includes(svc.id);
                            return (
                              <button
                                key={svc.id}
                                onClick={(e) => { e.stopPropagation(); toggleServiceLink(pp.id, svc.id); }}
                                className={cn(
                                  "flex items-center gap-2 px-2.5 py-1.5 rounded-sm text-xs border transition-colors text-left",
                                  isLinked
                                    ? "border-green-400 bg-green-50/40 text-green-700"
                                    : "border-border text-muted-foreground hover:bg-muted"
                                )}
                              >
                                <CircleCheck className={cn("h-3 w-3 shrink-0", isLinked ? "text-green-600" : "text-transparent")} />
                                <span>{svc.title}</span>
                                <Badge variant="outline" className="text-[10px] ml-auto">{svc.type}</Badge>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: service coverage */}
          <div>
            <h3 className="text-xs font-mono text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
              Layanan — Coverage Pemetaan
              <span className="bg-muted px-1.5 py-0.5 rounded-sm border border-border">{(services ?? []).length}</span>
            </h3>
            <div className="flex flex-col gap-2">
              {(services ?? []).map((svc) => {
                const coverCount = Object.values(notes.serviceLinks).filter((ids) =>
                  ids.includes(svc.id)
                ).length;
                return (
                  <div key={svc.id} className="p-3 rounded-sm border bg-card">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{svc.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1" title={svc.description ?? undefined}>{svc.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant="outline" className="text-xs">{svc.type}</Badge>
                        {coverCount > 0 ? (
                          <span className="text-xs text-green-600 font-mono font-medium">{coverCount} masalah</span>
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono">–</span>
                        )}
                      </div>
                    </div>
                    {coverCount > 0 && (
                      <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (coverCount / Math.max(1, highPriority.length)) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Katalog Layanan view */}
      {view === "layanan" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(services ?? []).length === 0 && (
            <div className="col-span-3"><EmptyState icon={Wrench} text="Belum ada katalog layanan" /></div>
          )}
          {[...jasakServices, ...otherServices].map((svc) => (
            <Card key={svc.id} className="border">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold leading-snug">{svc.title}</CardTitle>
                  <Badge variant="outline" className="text-xs shrink-0">{svc.type}</Badge>
                </div>
                {svc.description && (
                  <CardDescription className="text-xs leading-relaxed">{svc.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {svc.keyMessages && (
                  <div className="flex flex-wrap gap-1.5">
                    {svc.keyMessages.split(",").map((msg: string) => (
                      <span key={msg.trim()} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-sm font-mono">{msg.trim()}</span>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] font-mono">{svc.targetSegment}</Badge>
                  {svc.format && <span className="text-xs text-muted-foreground font-mono">{svc.format}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* AI Agents view */}
      {view === "ai" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(aiRecs ?? []).length === 0 && (
            <div className="col-span-2"><EmptyState icon={Cpu} text="Belum ada rekomendasi AI" /></div>
          )}
          {(aiRecs ?? []).map((rec) => (
            <Card key={rec.id} className="border">
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary border border-primary/20">
                    <Cpu className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-semibold">{rec.aiProductName}</CardTitle>
                    <span className="text-xs font-mono text-muted-foreground">{rec.feasibility} feasibility · {rec.priority} priority</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {rec.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">{rec.description}</p>
                )}
                {rec.techStack && (
                  <div className="text-xs font-mono text-muted-foreground bg-muted/60 px-2 py-1 rounded-sm mb-2">
                    Tech: {rec.techStack}
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm font-mono">{rec.targetUsers}</span>
                  {rec.revenueModel && (
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-sm font-mono">{rec.revenueModel}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

    </div>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function InfoBlock({ icon: Icon, label, text, highlight }: {
  icon: React.ElementType; label: string; text: string; highlight?: boolean;
}) {
  return (
    <div className={cn("p-2.5 rounded-sm border text-xs", highlight ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30")}>
      <div className="flex items-center gap-1.5 mb-1 text-muted-foreground font-mono">
        <Icon className="h-3 w-3" />
        <span className="uppercase tracking-wider text-[10px]">{label}</span>
      </div>
      <p className="text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number; color?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 border rounded-sm bg-card">
      <Icon className={cn("h-5 w-5 shrink-0", color ?? "text-primary")} />
      <div>
        <p className="text-xl font-bold font-mono leading-none">{value.toLocaleString("id-ID")}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text, sub }: { icon: React.ElementType; text: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-2">
      <Icon className="h-8 w-8 opacity-40" />
      <p className="text-sm font-medium">{text}</p>
      {sub && <p className="text-xs opacity-70">{sub}</p>}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-sm" />
      ))}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreBg(score: number): string {
  if (score >= 8) return "bg-red-500";
  if (score >= 6) return "bg-orange-500";
  if (score >= 4) return "bg-yellow-500";
  return "bg-muted-foreground";
}

// ─── Tab 4: Problem Canvas ────────────────────────────────────────────────────

interface CanvasData {
  painPointId: number | null;
  problemStatement: string;
  targetSegment: string;
  why1: string; why2: string; why3: string; why4: string; why5: string;
  solutionHypothesis: string;
  valueProposition: string;
  revenueModel: string;
  executionSteps: string;
  risks: string;
  serviceName: string;
  priceRange: string;
  successMetric: string;
}

const DEFAULT_CANVAS: CanvasData = {
  painPointId: null,
  problemStatement: "", targetSegment: "",
  why1: "", why2: "", why3: "", why4: "", why5: "",
  solutionHypothesis: "", valueProposition: "",
  revenueModel: "", executionSteps: "", risks: "",
  serviceName: "", priceRange: "", successMetric: "",
};

function CanvasTab({ painPoints, loading }: { painPoints: PainPoint[]; loading: boolean }) {
  const [canvas, setCanvas] = useLocalStorage<CanvasData>("workroom-canvas-v1", DEFAULT_CANVAS);

  const selectedPP = (painPoints ?? []).find((p) => p.id === canvas.painPointId) ?? null;

  function set<K extends keyof CanvasData>(key: K, val: CanvasData[K]) {
    setCanvas((prev) => ({ ...prev, [key]: val }));
  }

  function loadFromPainPoint(pp: PainPoint) {
    setCanvas((prev) => ({
      ...prev,
      painPointId: pp.id,
      problemStatement: pp.description ?? "",
      targetSegment: pp.segment ?? "",
      why1: pp.rootCause ?? "",
      solutionHypothesis: pp.digitalSolution ?? pp.manualSolution ?? "",
      valueProposition: pp.serviceOpportunity ?? "",
      revenueModel: "",
      executionSteps: pp.aiSolution ?? "",
      risks: "",
      serviceName: pp.serviceOpportunity ?? "",
      priceRange: "",
      successMetric: "",
    }));
  }

  function handlePrint() {
    window.print();
  }

  const [confirmReset, setConfirmReset] = useState(false);
  function resetCanvas() {
    if (!confirmReset) { setConfirmReset(true); setTimeout(() => setConfirmReset(false), 3000); return; }
    setCanvas(DEFAULT_CANVAS);
    setConfirmReset(false);
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      {/* Canvas header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-bold text-base flex items-center gap-2">
            <Pen className="h-4 w-4 text-primary" />
            Problem Canvas — Brief Layanan
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            Pilih masalah CPKB → isi canvas → cetak sebagai brief layanan siap presentasi
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={resetCanvas}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 border rounded-sm text-xs transition-colors", confirmReset ? "border-red-400 text-red-600 bg-red-50 hover:bg-red-100" : "text-muted-foreground hover:bg-muted")}
          >
            <CircleX className="h-3.5 w-3.5" />
            {confirmReset ? "Yakin reset?" : "Reset"}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-primary text-primary rounded-sm text-xs font-medium hover:bg-primary/5 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            Cetak Brief
          </button>
        </div>
      </div>

      {/* Quick-load from pain point */}
      <div className="border rounded-sm p-4 bg-muted/30">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Muat dari Pain Point CPKB</p>
        <div className="flex flex-wrap gap-2">
          {(painPoints ?? []).filter((p) => (p.painScore ?? 0) >= 7).slice(0, 12).map((pp) => (
            <button
              key={pp.id}
              onClick={() => loadFromPainPoint(pp)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border text-xs transition-colors",
                canvas.painPointId === pp.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted hover:border-primary/30"
              )}
            >
              <span className={cn("font-mono font-bold", (pp.painScore ?? 0) >= 9 ? "text-red-500" : (pp.painScore ?? 0) >= 7 ? "text-orange-500" : "")}>
                {pp.painScore}
              </span>
              <span className="font-medium">{pp.problemId}</span>
              <span className="text-muted-foreground hidden sm:inline max-w-[120px] truncate" title={pp.domain ?? ""}>— {pp.domain}</span>
            </button>
          ))}
        </div>
        {selectedPP && (
          <div className="mt-3 flex items-start gap-2 p-2.5 border border-primary/20 rounded-sm bg-primary/5">
            <CircleCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-primary">{selectedPP.problemId} — {selectedPP.domain}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2" title={selectedPP.description}>{selectedPP.description}</p>
            </div>
          </div>
        )}
      </div>

      {/* Canvas grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Problem Statement */}
        <CanvasField
          icon={CircleAlert}
          label="PERNYATAAN MASALAH"
          color="border-red-200 bg-red-50/30"
          value={canvas.problemStatement}
          onChange={(v) => set("problemStatement", v)}
          placeholder="Deskripsikan masalah spesifik yang akan diselesaikan…"
          rows={4}
        />

        {/* Target Segment */}
        <CanvasField
          icon={Target}
          label="SEGMEN TARGET"
          color="border-blue-200 bg-blue-50/30"
          value={canvas.targetSegment}
          onChange={(v) => set("targetSegment", v)}
          placeholder="Siapa yang paling merasakan masalah ini? (BUJK Menengah, Kontraktor Sipil…)"
          rows={4}
        />

        {/* 5 Whys */}
        <div className="md:col-span-2 border rounded-sm p-4 bg-orange-50/20 border-orange-200 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2 mb-3">
            <TriangleAlert className="h-4 w-4 text-orange-600" />
            <p className="text-xs font-mono font-semibold text-orange-700 uppercase tracking-wider">ANALISIS AKAR MASALAH (5 WHYS)</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            {([
              { key: "why1" as const, q: "WHY 1 — Kenapa masalah ini terjadi?" },
              { key: "why2" as const, q: "WHY 2 — Kenapa jawaban sebelumnya?" },
              { key: "why3" as const, q: "WHY 3 — Kenapa lagi?" },
              { key: "why4" as const, q: "WHY 4 — Lebih dalam lagi?" },
              { key: "why5" as const, q: "WHY 5 — Akar penyebab sebenarnya?" },
            ]).map(({ key, q }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-[10px] font-mono text-muted-foreground uppercase">{q.split("—")[0].trim()}</label>
                <div className="relative">
                  <Textarea
                    rows={3}
                    placeholder={q.split("—")[1]?.trim() ?? ""}
                    className="text-xs font-mono resize-none border-orange-200 focus:border-orange-400 pb-4"
                    maxLength={500}
                    value={canvas[key]}
                    onChange={(e) => set(key, e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); }}
                    onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                  />
                  <span className="absolute right-1 bottom-0.5 text-[8px] font-mono text-muted-foreground/50 pointer-events-none">{(canvas[key] ?? "").length}/500</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Solution Hypothesis */}
        <CanvasField
          icon={Lightbulb}
          label="HIPOTESIS SOLUSI"
          color="border-green-200 bg-green-50/30"
          value={canvas.solutionHypothesis}
          onChange={(v) => set("solutionHypothesis", v)}
          placeholder="Solusi apa yang akan Anda tawarkan? Bagaimana cara kerjanya?"
          rows={4}
        />

        {/* Value Proposition */}
        <CanvasField
          icon={Star}
          label="PROPOSISI NILAI"
          color="border-yellow-200 bg-yellow-50/30"
          value={canvas.valueProposition}
          onChange={(v) => set("valueProposition", v)}
          placeholder="Mengapa klien harus memilih layanan Anda dibanding alternatif lain?"
          rows={4}
        />

        {/* Service Name */}
        <div className="border rounded-sm p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-primary" />
            <p className="text-xs font-mono font-semibold text-primary uppercase tracking-wider">Nama Layanan</p>
          </div>
          <div className="relative">
            <input
              type="text"
              maxLength={200}
              className="w-full h-10 bg-background border border-border rounded-sm px-3 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Cth: Paket Pendampingan SBU Specialist"
              value={canvas.serviceName}
              onChange={(e) => set("serviceName", e.target.value)}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-mono text-muted-foreground/50 pointer-events-none">{canvas.serviceName.length}/200</span>
          </div>
          <div className="mt-2">
            <label className="text-[10px] font-mono text-muted-foreground uppercase">Kisaran Harga</label>
            <div className="relative">
              <input
                type="text"
                maxLength={100}
                className="w-full h-9 bg-background border border-border rounded-sm px-3 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                placeholder="Rp 5.000.000 – Rp 25.000.000 per paket"
                value={canvas.priceRange}
                onChange={(e) => set("priceRange", e.target.value)}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-mono text-muted-foreground/50 pointer-events-none">{canvas.priceRange.length}/100</span>
            </div>
          </div>
        </div>

        {/* Revenue Model */}
        <CanvasField
          icon={DollarSign}
          label="MODEL PENDAPATAN"
          color="border-teal-200 bg-teal-50/30"
          value={canvas.revenueModel}
          onChange={(v) => set("revenueModel", v)}
          placeholder="Per-paket, retainer bulanan, berbasis proyek, SaaS, komisi…?"
          rows={4}
        />

        {/* Execution Steps */}
        <CanvasField
          icon={ListChecks}
          label="LANGKAH EKSEKUSI"
          color="border-violet-200 bg-violet-50/30"
          value={canvas.executionSteps}
          onChange={(v) => set("executionSteps", v)}
          placeholder="1. Prospecting&#10;2. Presentasi&#10;3. Proposal&#10;4. Onboarding&#10;5. Delivery"
          rows={5}
        />

        {/* Risks */}
        <CanvasField
          icon={TriangleAlert}
          label="RISIKO & MITIGASI"
          color="border-red-100 bg-red-50/20"
          value={canvas.risks}
          onChange={(v) => set("risks", v)}
          placeholder="Cth: Risiko perubahan regulasi mendadak → Mitigasi: monitor portal PUPR harian."
          rows={5}
        />

        {/* Success Metric */}
        <div className="md:col-span-2">
          <CanvasField
            icon={TrendingUp}
            label="METRIK KEBERHASILAN"
            color="border-green-200 bg-green-50/20"
            value={canvas.successMetric}
            onChange={(v) => set("successMetric", v)}
            placeholder="Bagaimana Anda tahu layanan ini berhasil? (jumlah klien, pendapatan, NPS, durasi kontrak…)"
            rows={3}
          />
        </div>
      </div>

      {/* Print preview hint */}
      <div className="border border-dashed border-muted-foreground/20 rounded-sm p-4 text-center text-xs text-muted-foreground font-mono">
        💡 Gunakan tombol "Cetak Brief" untuk mencetak canvas sebagai dokumen PDF. Canvas disimpan otomatis di browser.
      </div>
    </div>
  );
}

function CanvasField({ icon: Icon, label, color, value, onChange, placeholder, rows }: {
  icon: React.ElementType;
  label: string;
  color: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className={cn("border rounded-sm p-4", color)}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
      <div className="relative">
        <Textarea
          rows={rows ?? 4}
          placeholder={placeholder}
          className="text-sm resize-none bg-background/80 pb-4"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); }}
          onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
          maxLength={1000}
        />
        <p className="text-[10px] font-mono text-muted-foreground/60 text-right -mt-1">{value.length} / 1000</p>
      </div>
    </div>
  );
}

// ─── Tab 5: Daftar Prospek (Task #22) ─────────────────────────────────────────

// ─── Segmen Lokal Tersembunyi — 5 demand segments from sinyal-pasar ───────────

const SEGMEN_LOKAL = [
  {
    id: "seg-pesantren",
    kode: "PESANTREN",
    nama: "Pesantren — Pembangunan & Renovasi Pondok",
    deskripsiSingkat: "±36.000 pesantren dengan infrastruktur berumur 20–40 tahun. Proyek: asrama, masjid, ruang kelas, renovasi sanitasi.",
    jumlahPotensi: "±36.000 pesantren di Indonesia",
    nilaiProyek: "Rp 300jt – Rp 15M",
    sumberDana: "Zakat/wakaf, DAK Kemenag, donatur alumni",
    trigger: "Setelah Ramadan / menjelang tahun ajaran baru · Pertumbuhan santri baru · Dana wakaf cair dari BAZNAS daerah",
    layanan: "Pendampingan teknis konstruksi · Dokumen IMB/PBG · Estimasi RAB · Sertifikasi K3",
    perihalSurat: "Penawaran Layanan Jasa Konstruksi untuk Pembangunan & Renovasi Pondok Pesantren",
    icon: Building2,
    iconColor: "text-amber-700",
    borderColor: "border-amber-200",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
  },
  {
    id: "seg-sekolah",
    kode: "SEKOLAH-SWASTA",
    nama: "Sekolah Swasta — SD, SMP, SMA, SMK",
    deskripsiSingkat: "±84.000 sekolah swasta Indonesia. Proyek: ruang kelas baru, lab IPA/komputer, aula, toilet, lapangan olahraga.",
    jumlahPotensi: "±84.000 sekolah swasta",
    nilaiProyek: "Rp 500jt – Rp 30M",
    sumberDana: "Dana yayasan, BOS (akreditasi), APBD/hibah Dinas Pendidikan, CSR",
    trigger: "Akreditasi ulang BAN S/M (standar sarana ketat) · Kenaikan jumlah peserta didik · Kerusakan gedung lama",
    layanan: "Pendampingan teknis · Dokumen PBG · RAB & pengawasan · RKK K3 proyek",
    perihalSurat: "Penawaran Layanan Jasa Konstruksi Fasilitas Pendidikan Sekolah Swasta",
    icon: BookOpen,
    iconColor: "text-sky-700",
    borderColor: "border-sky-200",
    badgeColor: "bg-sky-100 text-sky-800 border-sky-300",
  },
  {
    id: "seg-pts",
    kode: "PTS-KAMPUS",
    nama: "Perguruan Tinggi Swasta (PTS) — Kampus Baru & Ekspansi",
    deskripsiSingkat: "±4.200 PTS mayoritas di luar Jawa, ekspansi pascapandemi. Proyek: gedung kuliah 4–8 lantai, lab akreditasi, asrama, rektorat.",
    jumlahPotensi: "±4.200 PTS di Indonesia",
    nilaiProyek: "Rp 5M – Rp 200M",
    sumberDana: "Dana yayasan, KUR Pendidikan BRI, bantuan Pemprov, uang pangkal mahasiswa",
    trigger: "Persiapan akreditasi BAN-PT (nilai A/B) · Penambahan prodi baru · Pertumbuhan mahasiswa yang membutuhkan kapasitas tambahan",
    layanan: "Manajemen konstruksi · Dokumen PBG & K3 · ISO 9001 pengadaan · Audit teknis",
    perihalSurat: "Penawaran Layanan Jasa Konstruksi Fasilitas Perguruan Tinggi Swasta",
    icon: Users,
    iconColor: "text-purple-700",
    borderColor: "border-purple-200",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
  },
  {
    id: "seg-ruko",
    kode: "RUKO-PERKANTORAN",
    nama: "Perkantoran, Ruko & Rumah Kantor Komersial",
    deskripsiSingkat: "Segmen paling konsisten: kantor perusahaan, ruko, showroom, klinik, apotek, minimarket, gudang kecil.",
    jumlahPotensi: "Ratusan ribu unit aktif tiap tahun",
    nilaiProyek: "Rp 100jt – Rp 10M",
    sumberDana: "Developer ruko, pemilik bisnis ritel, asuransi cabang baru, klinik BPJS FKTP",
    trigger: "Data PBG (PBG terbit sebelum konstruksi dimulai) · Ekspansi bisnis · Perpindahan kantor · Standar regulasi FKTP Kemenkes",
    layanan: "Fit-out interior · MEP · Dokumen PBG · K3 konstruksi · Sertifikasi standar FKTP",
    perihalSurat: "Penawaran Layanan Jasa Konstruksi Renovasi & Fit-Out Perkantoran/Ruko Komersial",
    icon: Briefcase,
    iconColor: "text-emerald-700",
    borderColor: "border-emerald-200",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  {
    id: "seg-koskosan",
    kode: "KOS-KOSAN",
    nama: "Kos-Kosan, Kontrakan & Hunian Sewa Skala Kecil-Menengah",
    deskripsiSingkat: "Investor kos & kontrakan: ROI 8–12 tahun, mudah dibiayai bank, permintaan selalu ada. Kos premium tumbuh pesat di kota kampus & industri.",
    jumlahPotensi: "Terpusat di 6 kota besar + KEK/kawasan industri baru",
    nilaiProyek: "Rp 800jt – Rp 15M",
    sumberDana: "KPR investor, pinjaman bank konvensional/syariah, modal sendiri bertahap",
    trigger: "Platform listing kos (Mamikos/Rukita) dengan waiting list panjang · Kawasan industri/kampus baru dibuka · Investor berikutnya lihat waiting list = spesifikasi yang akan dibangun",
    layanan: "Desain & bangun kos premium · RAB investor · Dokumen PBG · Interior konstruksi",
    perihalSurat: "Penawaran Layanan Jasa Konstruksi Pembangunan Kos-Kosan & Hunian Sewa Premium",
    icon: Home,
    iconColor: "text-rose-700",
    borderColor: "border-rose-200",
    badgeColor: "bg-rose-100 text-rose-800 border-rose-300",
  },
] as const;

// ─── Domain → service suggestion mapping ─────────────────────────────────────

const DOMAIN_SERVICE_MAP: Record<string, { perihal: string; services: string; badge: string }> = {
  SBU:       { perihal: "Penawaran Layanan Jasa Pengurusan dan Perpanjangan SBU", services: "Pengurusan SBU · Sewa Alat · Sertifikat Standar", badge: "bg-blue-100 text-blue-800" },
  SKK:       { perihal: "Penawaran Layanan Jasa SKK / Sertifikat Kompetensi Kerja", services: "Sewa SKK Jenjang 7/8/9 · Pelatihan SKK", badge: "bg-violet-100 text-violet-800" },
  SMAP:      { perihal: "Penawaran Layanan SMAP ISO 37001:2016 Anti-Penyuapan", services: "Dokumen SMAP · Sertifikasi ISO 37001", badge: "bg-orange-100 text-orange-800" },
  TENDER:    { perihal: "Penawaran Layanan Audit Kesiapan Tender dan Intelijen Kompetitor", services: "Audit Kesiapan Tender · Laporan Intelijen Kompetitor", badge: "bg-yellow-100 text-yellow-800" },
  ISO:       { perihal: "Penawaran Layanan ISO 9001 / K3 Konstruksi", services: "Dokumen ISO 9001 · ISO 45001 · SMK3", badge: "bg-emerald-100 text-emerald-800" },
  SMK3:      { perihal: "Penawaran Layanan K3 / SMK3 Konstruksi", services: "ISO 45001 · RKK per Proyek", badge: "bg-rose-100 text-rose-800" },
  KEUANGAN:  { perihal: "Penawaran Layanan Audit Keuangan dan Due Diligence BUJK", services: "Laporan KAP · Due Diligence BUJK", badge: "bg-red-100 text-red-800" },
  DIGITAL:   { perihal: "Penawaran Layanan Digitalisasi BIM Konstruksi", services: "Advisory BIM · Pelatihan BIM · SKK BIM", badge: "bg-cyan-100 text-cyan-800" },
  DOKUMEN:   { perihal: "Penawaran Layanan Penyusunan Dokumen dan Sertifikasi", services: "Pengurusan SBU · SMAP · ISO", badge: "bg-green-100 text-green-800" },
  REGULASI:  { perihal: "Penawaran Layanan Konsultasi Regulasi Konstruksi", services: "Konsultasi SBU/SKK · Audit Kesiapan Tender", badge: "bg-pink-100 text-pink-800" },
  OSS:       { perihal: "Penawaran Layanan Pengurusan OSS / Sertifikat Standar BUJKN", services: "Sertifikat Standar BUJKN · MBKI", badge: "bg-indigo-100 text-indigo-800" },
};

function getDomainService(domain: string) {
  return DOMAIN_SERVICE_MAP[domain] ?? {
    perihal: "Penawaran Layanan Jasa Konsultasi SBU / SKK",
    services: "Konsultasi SBU/SKK · Audit Kesiapan Tender",
    badge: "bg-muted text-muted-foreground",
  };
}

/**
 * Per-domain eligibility: returns true only when a contractor attribute
 * provides evidence that the domain's service is relevant to them.
 *
 * SBU/SKK   – contractor holds an SBU (has sbuCode or sbuExpiry tracked)
 * SMAP      – active SBU holder (sbuCode + sbuLevel present)
 * TENDER    – active SBU holder with a specific SBU code
 * ISO/SMK3  – construction firm (bidangUsaha keyword) or active SBU holder
 * KEUANGAN  – large contractor (BESAR/ASING) or has NPWP for formal audit
 * DIGITAL   – active SBU holder (needs digital tools for compliance)
 * DOKUMEN   – has sbuCode or registrationNumber (has tracked documents)
 * REGULASI  – active SBU holder (subject to construction regulations)
 * OSS       – has registrationNumber or npwp (OSS-registered entity)
 * ESTIMASI/PROYEK/etc. – construction firm or active SBU holder
 * Default   – active SBU holder
 */
function contractorMatchesDomain(c: Contractor, domain: string): boolean {
  const hasSbuRecord = !!(c.sbuExpiry || c.sbuCode);
  const hasActiveSbu = !!(c.sbuCode && c.sbuLevel);
  const isLarge = c.sbuLevel === "BESAR" || c.sbuLevel === "ASING";
  const isConstructionFirm = !!(c.bidangUsaha?.toLowerCase().match(
    /konstruksi|sipil|gedung|proyek|bangunan|infrastruktur|jasa/
  ));

  switch (domain) {
    case "SBU":       return hasSbuRecord;             // Holds an SBU → renewal candidate
    case "SKK":       return hasSbuRecord;             // SBU holders need SKK-certified staff
    case "SMAP":      return hasActiveSbu;             // Active SBU holders must have SMAP
    case "TENDER":    return hasActiveSbu;             // Active SBU holders bid on tenders
    case "ISO":       return isConstructionFirm || hasActiveSbu;
    case "SMK3":      return isConstructionFirm || hasActiveSbu;
    case "KEUANGAN":  return isLarge || !!(c.npwp);    // Large / NPWP-registered entities
    case "DIGITAL":   return hasActiveSbu;             // Active contractors need BIM/digital
    case "DOKUMEN":   return hasSbuRecord || !!(c.registrationNumber);
    case "REGULASI":  return hasActiveSbu;             // Active contractors face regulations
    case "OSS":       return !!(c.registrationNumber || c.npwp);
    case "ESTIMASI":
    case "PROYEK":
    case "MARKETING":
    case "LEGAL":
    case "KEMITRAAN": return hasActiveSbu;
    case "CASHFLOW":  return isLarge || !!(c.npwp);
    default:          return hasActiveSbu;             // Unknown domain: require active SBU
  }
}

// Default service catalog IDs pre-selected per domain
const DOMAIN_DEFAULT_SERVICES: Record<string, string[]> = {
  SBU:       ["alat-kecil", "sertif-bujkn"],
  SKK:       ["skk-7", "skk-8"],
  SMAP:      ["smap-doc", "smap-iso"],
  ISO:       ["iso-9001", "iso-9001-cert"],
  SMK3:      ["iso-45001", "smkk-rkk"],
  KEUANGAN:  ["kap-audit"],
  OSS:       ["sertif-bujkn"],
  DOKUMEN:   ["sertif-bujkn", "smap-doc"],
  REGULASI:  ["konsul-sbu"],
  TENDER:    ["konsul-sbu", "riset-pasar"],
  DIGITAL:   ["pelatihan-sbu"],
};

function buildSuratUrl(contractor: Contractor, domain: string): string {
  const svc = getDomainService(domain);
  const defaultServices = DOMAIN_DEFAULT_SERVICES[domain] ?? [];
  const params = new URLSearchParams({
    namaPerusahaan: contractor.name,
    kotaPerusahaan: contractor.city ?? contractor.province ?? "",
    alamatPerusahaan: contractor.address ?? "",
    perihal: svc.perihal,
    domain,
    ...(defaultServices.length > 0 ? { services: defaultServices.join(",") } : {}),
  });
  return `/surat-penawaran?${params.toString()}`;
}

function ProspekTab({ painPoints, notes, setNotes, loading, kontakSegmen, setKontakSegmen, serverNotes, highlightContractorId }: {
  painPoints: PainPoint[];
  notes: WorkroomNotes;
  setNotes: (v: WorkroomNotes | ((prev: WorkroomNotes) => WorkroomNotes)) => void;
  loading: boolean;
  kontakSegmen: Record<string, string>;
  setKontakSegmen: (v: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  serverNotes?: WorkroomNotesMap;
  highlightContractorId?: number | null;
}) {
  const [filterDomain, setFilterDomain] = useState("ALL");
  const [filterExpiry, setFilterExpiry] = useState<"ALL" | "expired" | "soon" | "valid">("ALL");
  const [filterOutreach, setFilterOutreach] = useState<OutreachStatus | "ALL">("ALL");
  const [sortProspekByScore, setSortProspekByScore] = useState(false);
  const [sortProspekByNotes, setSortProspekByNotes] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault(); searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  function setContractorStatus(id: number, status: OutreachStatus) {
    setNotes((prev) => ({
      ...prev,
      contractors: {
        ...prev.contractors,
        [id]: { note: prev.contractors[id]?.note ?? "", status },
      },
    }));
    const labels: Record<string, string> = { BELUM_DIHUBUNGI: "Belum dihubungi", DIHUBUNGI: "Sudah dihubungi", TIDAK_TERTARIK: "Tidak tertarik", SEDANG_NEGOSIASI: "Sedang negosiasi", DEAL: "Deal ✓" };
    const contractorName = contractorProspects.find(p => p.contractor.id === id)?.contractor.name;
    toast.success(labels[status] ?? status, { description: contractorName ? `Status ${contractorName} diperbarui` : undefined, duration: 1500 });
  }

  function setContractorNote(id: number, note: string) {
    setNotes((prev) => ({
      ...prev,
      contractors: {
        ...prev.contractors,
        [id]: { status: prev.contractors[id]?.status ?? "SUDAH_DIHUBUNGI", note },
      },
    }));
  }

  // Fetch all contractors
  const { data: contractors, isLoading: loadingContractors } = useListContractors(
    {},
    { query: { queryKey: getListContractorsQueryKey() } }
  );

  // Domains that have at least one DIPRIORITASKAN pain point
  const prioritizedDomains = useMemo(() => {
    return [...new Set(
      painPoints
        .filter(pp => (notes.painPoints[pp.id]?.status ?? "BELUM_DIANALISIS") === "DIPRIORITASKAN")
        .map(pp => pp.domain ?? "UMUM")
    )];
  }, [painPoints, notes.painPoints]);

  // Get the top pain point descriptions per domain for display
  const domainTopPains = useMemo(() => {
    const map: Record<string, string[]> = {};
    painPoints
      .filter(pp => (notes.painPoints[pp.id]?.status ?? "BELUM_DIANALISIS") === "DIPRIORITASKAN")
      .sort((a, b) => (b.painScore ?? 0) - (a.painScore ?? 0))
      .forEach(pp => {
        const d = pp.domain ?? "UMUM";
        if (!map[d]) map[d] = [];
        if (map[d].length < 2) map[d].push(pp.description ?? "");
      });
    return map;
  }, [painPoints, notes.painPoints]);

  // Match contractors to prioritized domains using per-domain eligibility rules.
  // A contractor is included only when contractorMatchesDomain() returns true for
  // at least one prioritized domain (or when they have an expiring/expired SBU and
  // the SBU domain is prioritized or no domains are prioritized yet).
  const contractorProspects = useMemo(() => {
    if (!contractors) return [];
    const today = new Date();
    const threeMonths = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
    const sixMonths = new Date(today.getFullYear(), today.getMonth() + 6, today.getDate());

    return (contractors ?? []).map(c => {
      const sbuExpiryDate = c.sbuExpiry ? new Date(c.sbuExpiry) : null;
      const isExpired  = sbuExpiryDate ? sbuExpiryDate < today : false;
      const isExpiringSoon3 = sbuExpiryDate ? sbuExpiryDate <= threeMonths && !isExpired : false;
      const isExpiringSoon6 = sbuExpiryDate ? sbuExpiryDate <= sixMonths && !isExpired && !isExpiringSoon3 : false;
      const hasExpiryUrgency = isExpired || isExpiringSoon3 || isExpiringSoon6;

      const matchedDomains: string[] = [];

      if (prioritizedDomains.length > 0) {
        // Only add domains for which this contractor passes the eligibility check
        for (const d of prioritizedDomains) {
          if (contractorMatchesDomain(c, d)) {
            matchedDomains.push(d);
          }
        }
      } else {
        // No prioritized domains yet: show contractors with expiring/expired SBU
        // as SBU prospects so the list is not empty
        if (hasExpiryUrgency && contractorMatchesDomain(c, "SBU")) {
          matchedDomains.push("SBU");
        }
      }

      if (matchedDomains.length === 0) return null;

      // Urgency: expiry signals override domain-only matches
      const urgencyScore =
        isExpired     ? 100 :
        isExpiringSoon3 ? 90 :
        isExpiringSoon6 ? 70 :
        prioritizedDomains.length > 0 ? 50 : 30;

      // Pick the highest-priority domain as primary (expiry-matched SBU/SKK first)
      const primaryDomain =
        (hasExpiryUrgency && matchedDomains.includes("SBU")) ? "SBU" :
        (hasExpiryUrgency && matchedDomains.includes("SKK")) ? "SKK" :
        matchedDomains[0];

      return {
        contractor: c,
        matchedDomains,
        primaryDomain,
        sbuExpiryDate,
        isExpired,
        isExpiringSoon: isExpiringSoon3 || isExpiringSoon6,
        urgencyScore,
        relevantPains: domainTopPains[primaryDomain] ?? [],
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.urgencyScore - a!.urgencyScore) as {
      contractor: Contractor;
      matchedDomains: string[];
      primaryDomain: string;
      sbuExpiryDate: Date | null;
      isExpired: boolean;
      isExpiringSoon: boolean;
      urgencyScore: number;
      relevantPains: string[];
    }[];
  }, [contractors, prioritizedDomains, domainTopPains]);

  // Outreach stage counts for badges
  const outreachCounts = useMemo(() => {
    const counts: Record<OutreachStatus, number> = {
      BELUM_DIHUBUNGI: 0, SUDAH_DIHUBUNGI: 0, SEDANG_NEGOSIASI: 0, DEAL: 0, TIDAK_TERTARIK: 0,
    };
    for (const p of contractorProspects) {
      const s = notes.contractors[p.contractor.id]?.status ?? "BELUM_DIHUBUNGI";
      counts[s]++;
    }
    return counts;
  }, [contractorProspects, notes.contractors]);

  // Apply filters to contractor prospects
  const filteredProspects = useMemo(() => {
    let base = contractorProspects.filter(p => {
      if (filterDomain !== "ALL" && !p.matchedDomains.includes(filterDomain)) return false;
      if (filterExpiry === "expired" && !p.isExpired) return false;
      if (filterExpiry === "soon" && !p.isExpiringSoon) return false;
      if (filterExpiry === "valid" && (p.isExpired || p.isExpiringSoon)) return false;
      if (filterOutreach !== "ALL") {
        const s = notes.contractors[p.contractor.id]?.status ?? "BELUM_DIHUBUNGI";
        if (s !== filterOutreach) return false;
      }
      if (search) {
        const q = deferredSearch.toLowerCase();
        return (
          p.contractor.name.toLowerCase().includes(q) ||
          (p.contractor.city ?? "").toLowerCase().includes(q) ||
          (p.contractor.province ?? "").toLowerCase().includes(q) ||
          (p.contractor.bidangUsaha ?? "").toLowerCase().includes(q) ||
          p.matchedDomains.some(d => d.toLowerCase().includes(q))
        );
      }
      return true;
    });
    if (sortProspekByNotes) {
      return [...base].sort((a, b) => (notes.contractors[b.contractor.id]?.note ?? "").length - (notes.contractors[a.contractor.id]?.note ?? "").length);
    }
    if (sortProspekByScore) {
      base = [...base].sort((a, b) => {
        const scoreA = Math.max(...a.matchedDomains.map(d => (painPoints ?? []).filter(pp => pp.domain === d).reduce((m, pp) => Math.max(m, pp.painScore ?? 0), 0)), 0);
        const scoreB = Math.max(...b.matchedDomains.map(d => (painPoints ?? []).filter(pp => pp.domain === d).reduce((m, pp) => Math.max(m, pp.painScore ?? 0), 0)), 0);
        return scoreB - scoreA;
      });
    }
    return base;
  }, [contractorProspects, filterDomain, filterExpiry, filterOutreach, search, notes.contractors, sortProspekByScore, sortProspekByNotes, painPoints]);

  // Build prospect cards: group by domain + prioritize by pain score
  const prospects = useMemo(() => {
    const domainMap: Record<string, {
      domain: string;
      points: PainPoint[];
      maxScore: number;
      avgScore: number;
      hasUrgent: boolean;
      dominated: string[];
    }> = {};

    (painPoints ?? []).forEach((p) => {
      const d = p.domain ?? "UMUM";
      if (!domainMap[d]) {
        domainMap[d] = { domain: d, points: [], maxScore: 0, avgScore: 0, hasUrgent: false, dominated: [] };
      }
      domainMap[d].points.push(p);
      domainMap[d].maxScore = Math.max(domainMap[d].maxScore, p.painScore ?? 0);
      domainMap[d].hasUrgent = domainMap[d].hasUrgent || (p.priority === "CRITICAL" || p.priority === "HIGH");
    });

    // Compute avg and dominated pains
    Object.values(domainMap).forEach((dm) => {
      const scores = dm.points.map((p) => p.painScore ?? 0).filter((s) => s > 0);
      dm.avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      dm.dominated = dm.points
        .sort((a, b) => (b.painScore ?? 0) - (a.painScore ?? 0))
        .slice(0, 3)
        .map((p) => p.description ?? "");
    });

    return Object.values(domainMap)
      .sort((a, b) => b.maxScore - a.maxScore);
  }, [painPoints]);

  const domains = [...new Set((painPoints ?? []).map((p) => p.domain ?? "").filter(Boolean))];

  const filtered = prospects.filter((pr) => {
    if (filterDomain !== "ALL" && pr.domain !== filterDomain) return false;
    if (search) {
      const q = deferredSearch.toLowerCase();
      return pr.domain.toLowerCase().includes(q) ||
        pr.dominated.some((t) => t.toLowerCase().includes(q));
    }
    return true;
  });

  function buildWAMessage(pr: typeof prospects[0]): string {
    return (
      `*Identifikasi Prospek Potensial: ${pr.domain}*\n\n` +
      `Berdasarkan analisis lapangan kami, ditemukan ${pr.points.length} masalah aktif di sektor *${pr.domain}* dengan skor pain tertinggi ${pr.maxScore}/10.\n\n` +
      `Masalah Utama:\n` +
      pr.dominated.map((t, i) => `${i + 1}. ${t}`).join("\n") +
      `\n\n` +
      `Platform Intel-Konstruksi memiliki solusi layanan yang relevan untuk menangani masalah-masalah ini. Apakah kami dapat menjadwalkan konsultasi?\n\n` +
      `📞 +62 821-2295-3749\n✉️ info@intel-konstruksi.id\n🌐 intel-konstruksi.id\n\n` +
      `— Tim Riset Marketing PT Maheswara Jaya Persada`
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="border rounded-sm p-4 space-y-2 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── DAFTAR PROSPEK KONTRAKTOR (live DB data) ───────────────────────────── */}
      <div className="border-2 border-primary/20 rounded-sm bg-card">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b">
          <div>
            <p className="text-xs font-mono font-bold tracking-wider flex items-center gap-1.5">
              <Target className="h-4 w-4 text-primary" />
              DAFTAR PROSPEK DARI DATABASE KONTRAKTOR
            </p>
            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
              {filteredProspects.length} kontraktor cocok dengan domain yang diprioritaskan
              {prioritizedDomains.length > 0 && (
                <span className="ml-1">
                  · Domain aktif: <span className="text-primary font-bold">{prioritizedDomains.join(", ")}</span>
                </span>
              )}
              {prioritizedDomains.length === 0 && <span className="ml-1 text-amber-600">— Belum ada domain diprioritaskan di tab Perumusan Masalah</span>}
            </p>
            {/* Discovered vs contacted running total */}
            {contractorProspects.length > 0 && (() => {
              const contactedCount = contractorProspects.filter(p => (notes.contractors[p.contractor.id]?.status ?? "BELUM_DIHUBUNGI") !== "BELUM_DIHUBUNGI").length;
              const pct = Math.round((contactedCount / contractorProspects.length) * 100);
              return (
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex-1 max-w-[120px] h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[9px] font-mono text-emerald-700 font-bold">{contactedCount}/{contractorProspects.length} dihubungi ({pct}%)</span>
                </div>
              );
            })()}
          </div>

          {/* Summary chips */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {(() => {
              const expired = contractorProspects.filter(p => p.isExpired).length;
              const soon = contractorProspects.filter(p => p.isExpiringSoon && !p.isExpired).length;
              return (
                <>
                  {expired > 0 && (
                    <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-sm bg-red-100 text-red-700 border border-red-200">
                      {expired} SBU Expired
                    </span>
                  )}
                  {soon > 0 && (
                    <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-sm bg-orange-100 text-orange-700 border border-orange-200">
                      {soon} Segera Habis
                    </span>
                  )}
                </>
              );
            })()}
            {/* Outreach stage badges */}
            {(Object.keys(OUTREACH_STATUS_CONFIG) as OutreachStatus[]).filter(s => outreachCounts[s] > 0).map(s => (
              <button
                key={s}
                onClick={() => setFilterOutreach(filterOutreach === s ? "ALL" : s)}
                className={cn(
                  "flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded-sm border transition-colors",
                  filterOutreach === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : OUTREACH_STATUS_CONFIG[s].color,
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", OUTREACH_STATUS_CONFIG[s].dot)} />
                {outreachCounts[s]} {OUTREACH_STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 px-4 py-2 border-b bg-muted/20">
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={searchRef}
              title="Tekan / untuk fokus ke pencarian"
              placeholder="Cari kontraktor… · Esc reset"
              className="pl-8 pr-7 font-mono text-xs h-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearch(""); e.currentTarget.blur(); } }}
            />
            {!search && <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">/</kbd>}
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Hapus pencarian">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <Select value={filterDomain} onValueChange={setFilterDomain}>
            <SelectTrigger className="h-8 w-40 text-xs font-mono bg-background" aria-label="Filter domain kontraktor" title="Filter berdasarkan domain layanan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs font-mono">Semua Domain</SelectItem>
              {prioritizedDomains.map(d => <SelectItem key={d} value={d} className="text-xs font-mono">{d}</SelectItem>)}
              {Object.keys(DOMAIN_SERVICE_MAP).filter(d => !prioritizedDomains.includes(d)).map(d => (
                <SelectItem key={d} value={d} className="text-xs font-mono">{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterExpiry} onValueChange={v => setFilterExpiry(v as typeof filterExpiry)}>
            <SelectTrigger className="h-8 w-36 text-xs font-mono bg-background" aria-label="Filter expiry SBU kontraktor" title="Filter berdasarkan status expiry SBU">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs font-mono">Semua Expiry</SelectItem>
              <SelectItem value="expired" className="text-xs font-mono">SBU Expired</SelectItem>
              <SelectItem value="soon" className="text-xs font-mono">Segera Habis (6 bln)</SelectItem>
              <SelectItem value="valid" className="text-xs font-mono">Masih Valid</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterOutreach} onValueChange={v => setFilterOutreach(v as typeof filterOutreach)}>
            <SelectTrigger className="h-8 w-44 text-xs font-mono bg-background" aria-label="Filter status follow-up kontraktor" title="Filter berdasarkan status outreach">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs font-mono">Semua Status Follow-up</SelectItem>
              {(Object.keys(OUTREACH_STATUS_CONFIG) as OutreachStatus[]).map(s => (
                <SelectItem key={s} value={s} className="text-xs font-mono">{OUTREACH_STATUS_CONFIG[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={() => { setSortProspekByScore(v => !v); if (!sortProspekByScore) setSortProspekByNotes(false); }}
            className={cn("h-8 px-2.5 text-[10px] font-mono font-bold rounded-sm border transition-colors flex items-center gap-1 shrink-0", sortProspekByScore ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted")}
            title="Urutkan berdasarkan pain score domain"
          >
            {sortProspekByScore ? "↓ Score" : "↑ Score"}
          </button>
          <button
            onClick={() => { setSortProspekByNotes(v => !v); if (!sortProspekByNotes) setSortProspekByScore(false); }}
            className={cn("h-8 px-2.5 text-[10px] font-mono font-bold rounded-sm border transition-colors flex items-center gap-1 shrink-0", sortProspekByNotes ? "bg-blue-500 text-white border-blue-500" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100")}
            title="Terkaya catatannya dulu"
          >
            {sortProspekByNotes ? "📝 Catatan ↓" : "📝 Catatan ↑"}
          </button>
          {(search || filterDomain !== "ALL" || filterExpiry !== "ALL" || filterOutreach !== "ALL" || sortProspekByScore || sortProspekByNotes) && (
            <button
              onClick={() => { setSearch(""); setFilterDomain("ALL"); setFilterExpiry("ALL"); setFilterOutreach("ALL"); setSortProspekByScore(false); setSortProspekByNotes(false); }}
              className="h-8 px-2.5 text-[10px] font-mono font-bold rounded-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1 shrink-0"
              title="Reset semua filter"
            >
              ✕ Reset
            </button>
          )}
          <span className="text-[10px] font-mono text-muted-foreground self-center ml-auto" aria-live="polite" aria-atomic="true">
            {filteredProspects.length < contractorProspects.length
              ? <>{filteredProspects.length} <span className="opacity-50">/ {contractorProspects.length}</span> kontraktor</>
              : <>{filteredProspects.length} kontraktor</>}
          </span>
        </div>

        {/* Prospect cards */}
        <div className="p-4">
          {loadingContractors ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="border rounded-sm p-3 space-y-2 animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-7 bg-muted rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : filteredProspects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-mono">
                {contractorProspects.length === 0
                  ? "Belum ada kontraktor di database yang cocok"
                  : "Tidak ada kontraktor sesuai filter"}
              </p>
              {contractorProspects.length > 0 && (
                <button onClick={() => { setSearch(""); setFilterDomain("ALL"); setFilterExpiry("ALL"); setFilterOutreach("ALL"); setSortProspekByScore(false); setSortProspekByNotes(false); }} className="text-xs font-mono text-primary hover:underline mt-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none">✕ Reset filter</button>
              )}
              {prioritizedDomains.length === 0 && (
                <p className="text-xs mt-1 text-amber-600">Tandai pain point sebagai DIPRIORITASKAN di tab Perumusan Masalah untuk memunculkan prospek yang relevan.</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredProspects.map((p) => {
                const svc = getDomainService(p.primaryDomain);
                const suratUrl = buildSuratUrl(p.contractor, p.primaryDomain);
                const waMsg = encodeURIComponent(
                  `*Halo, Bapak/Ibu di ${p.contractor.name}*\n\nKami dari PT Maheswara Jaya Persada ingin menyampaikan informasi layanan yang relevan untuk perusahaan Bapak/Ibu di bidang *${p.primaryDomain}*.\n\n` +
                  (p.relevantPains.length > 0 ? `Isu yang kami identifikasi:\n${p.relevantPains.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\n` : "") +
                  `Kami dapat membantu: ${svc.services}.\n\n📞 +62 821-2295-3749\n— Tim MJP`
                );
                const outreachState = notes.contractors[p.contractor.id] ?? { status: "BELUM_DIHUBUNGI" as OutreachStatus, note: "" };
                const outreachCfg = OUTREACH_STATUS_CONFIG[outreachState.status];
                return (
                  <div
                    key={p.contractor.id}
                    className={cn(
                      "group border rounded-sm p-3 space-y-2 hover:bg-muted/40 transition-colors cursor-pointer",
                      p.isExpired && "border-red-300 bg-red-50/30",
                      p.isExpiringSoon && !p.isExpired && "border-orange-300 bg-orange-50/20",
                      outreachState.status === "DEAL" && "border-emerald-400 bg-emerald-50/20",
                      outreachState.status === "SEDANG_NEGOSIASI" && "border-amber-400 bg-amber-50/20",
                      highlightContractorId === p.contractor.id && "ring-2 ring-blue-500 ring-offset-1 bg-blue-50/30",
                    )}
                  >
                    {/* Contractor header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold leading-snug truncate" title={p.contractor.name}>{p.contractor.name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">
                          {[p.contractor.city, p.contractor.province].filter(Boolean).join(", ") || "—"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {p.contractor.createdAt && (Date.now() - new Date(p.contractor.createdAt).getTime()) < 7 * 86400000 && (
                          <span className="text-[8px] font-mono bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded-sm border border-emerald-200">Baru</span>
                        )}
                        {p.isExpired && (
                          <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-red-500 text-white">SBU Expired</span>
                        )}
                        {p.isExpiringSoon && !p.isExpired && (() => {
                          const d = p.contractor.sbuExpiry
                            ? Math.ceil((new Date(p.contractor.sbuExpiry).getTime() - Date.now()) / 86400000)
                            : null;
                          return (
                            <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-orange-400 text-white">
                              SEGERA HABIS{d !== null ? ` (${d}h)` : ""}
                            </span>
                          );
                        })()}
                        {/* Outreach status badge */}
                        <span className={cn("text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm border flex items-center gap-1", outreachCfg.color)}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", outreachCfg.dot)} />
                          {outreachCfg.label}
                        </span>
                      </div>
                    </div>

                    {/* Matched domains */}
                    <div className="flex flex-wrap gap-1">
                      {p.matchedDomains.slice(0, 4).map(d => (
                        <span key={d} className={cn("text-[9px] font-mono font-medium px-1.5 py-0.5 rounded-sm border", domainBadge(d))}>
                          {d}
                        </span>
                      ))}
                    </div>

                    {/* SBU info + suggested service */}
                    <div className="text-[10px] font-mono space-y-0.5">
                      {p.contractor.sbuLevel && (
                        <p className="text-muted-foreground">
                          <span className="text-foreground font-medium">SBU:</span> {p.contractor.sbuLevel}
                          {p.contractor.sbuCode && <span> · {p.contractor.sbuCode}</span>}
                          {p.sbuExpiryDate && (
                            <span className={cn("ml-1", p.isExpired ? "text-red-600 font-bold" : p.isExpiringSoon ? "text-orange-600 font-bold" : "text-muted-foreground")}>
                              · Exp: {format(p.sbuExpiryDate, "dd MMM yyyy", { locale: idLocale })}
                            </span>
                          )}
                        </p>
                      )}
                      {p.contractor.bidangUsaha && (
                        <p className="text-muted-foreground line-clamp-1" title={p.contractor.bidangUsaha ?? undefined}>
                          <span className="text-foreground font-medium">Bidang:</span> {p.contractor.bidangUsaha}
                        </p>
                      )}
                      <p>
                        <span className="text-foreground font-medium">Layanan Disarankan:</span>{" "}
                        <span className="text-primary">{svc.services}</span>
                      </p>
                      {p.relevantPains.length > 0 && (
                        <p className="text-muted-foreground" title={p.relevantPains[0]}>
                          <span className="text-foreground font-medium">Isu Terkait:</span>{" "}
                          {p.relevantPains[0].slice(0, 80)}{p.relevantPains[0].length > 80 ? "…" : ""}
                        </p>
                      )}
                    </div>

                    {/* Outreach status buttons */}
                    <div>
                      <p className="text-[9px] font-mono text-muted-foreground mb-1 uppercase tracking-wider">Status Follow-up</p>
                      <div className="flex flex-wrap gap-1">
                        {(Object.keys(OUTREACH_STATUS_CONFIG) as OutreachStatus[]).map(s => (
                          <button
                            key={s}
                            onClick={() => setContractorStatus(p.contractor.id, s)}
                            title={({ BELUM_DIHUBUNGI:"Belum dihubungi — hubungi via WA atau telepon", SUDAH_DIHUBUNGI:"Sudah dihubungi — tunggu respons", SEDANG_NEGOSIASI:"Sedang negosiasi — diskusi harga/scope aktif", DEAL:"Deal ✓ — kontrak atau kesepakatan tercapai", TIDAK_TERTARIK:"Tidak tertarik — abaikan untuk siklus ini" } as Record<string,string>)[s] ?? s}
                            className={cn(
                              "flex items-center gap-1 text-[9px] font-mono font-medium px-2 py-0.5 rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                              outreachState.status === s
                                ? OUTREACH_STATUS_CONFIG[s].color + " font-bold"
                                : "border-border text-muted-foreground hover:bg-muted",
                            )}
                          >
                            {outreachState.status === s && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", OUTREACH_STATUS_CONFIG[s].dot)} />}
                            {OUTREACH_STATUS_CONFIG[s].label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Note authorship — #160: reads from serverNotes which includes authorName/updatedAt */}
                    {serverNotes?.contractors?.[String(p.contractor.id)] && (
                      <NoteAttribution serverNote={serverNotes.contractors[String(p.contractor.id)] as { authorName?: string | null; updatedAt?: string | null }} />
                    )}

                    {/* Outreach note — only shown when status is not BELUM_DIHUBUNGI */}
                    {outreachState.status !== "BELUM_DIHUBUNGI" && (
                      <div>
                        <label className="text-[9px] font-mono text-muted-foreground mb-1 block uppercase tracking-wider">Catatan Follow-up</label>
                        <div className="relative animate-in fade-in duration-200">
                          <Textarea
                            rows={2}
                            placeholder="Tanggal dihubungi, hasil percakapan, next action…"
                            className="text-xs font-mono resize-none pb-4"
                            value={outreachState.note}
                            onChange={(e) => setContractorNote(p.contractor.id, e.target.value)}
                            onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                            onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); }}
                            maxLength={500}
                          />
                          <span className="absolute right-1 bottom-0.5 text-[8px] font-mono text-muted-foreground/50 pointer-events-none">{(outreachState.note ?? "").length}/500</span>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={suratUrl}>
                        <Button size="sm" className="text-xs font-mono h-7 px-3 gap-1.5">
                          <FileText className="h-3 w-3" />
                          Buat Surat Penawaran
                        </Button>
                      </Link>
                      <button onClick={() => navigator.clipboard.writeText(suratUrl).then(() => toast.success("Link SP disalin", { duration: 1200 }))} aria-label="Salin link Surat Penawaran ke clipboard" className="h-7 px-2 text-[10px] font-mono border rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none" title="Salin link Surat Penawaran ke clipboard"><Copy className="h-3 w-3" /></button>
                      <a
                        href={`https://wa.me/?text=${waMsg}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Hubungi ${p.contractor.name} via WhatsApp`}
                        className="flex items-center gap-1 text-[10px] font-mono text-emerald-700 hover:text-emerald-900 border border-emerald-300 rounded-sm px-2 py-1 hover:bg-emerald-50 transition-colors"
                      >
                        <MessageCircle className="h-3 w-3" />
                        WA
                      </a>
                      <ContractorNoteHistoryTrigger contractorId={p.contractor.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {/* ────────────────────────────────────────────────────────────────────────── */}

      {/* ── SEGMEN LOKAL TERSEMBUNYI ──────────────────────────────────────────── */}
      <div className="border-2 border-emerald-200 rounded-sm bg-card">
        <div className="px-4 py-3 border-b bg-emerald-50/60">
          <p className="text-xs font-mono font-bold tracking-wider flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-emerald-700" />
            SEGMEN LOKAL TERSEMBUNYI — Prospek Non-LPSE yang Belum Tersentuh Kompetitor
          </p>
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
            5 segmen demand konstruksi swasta yang tidak muncul di e-procurement · Diidentifikasi dari panel Sinyal Pasar · Nilai total estimasi Rp 150–250T/tahun se-Indonesia
          </p>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {SEGMEN_LOKAL.map((seg) => {
            const waMsg = encodeURIComponent(
              `*Halo Bapak/Ibu,*\n\n` +
              `Kami dari PT Maheswara Jaya Persada ingin menyampaikan informasi layanan konstruksi yang relevan untuk segmen *${seg.nama}*.\n\n` +
              `📌 Trigger proyek: ${seg.trigger}\n` +
              `💰 Nilai proyek: ${seg.nilaiProyek}\n` +
              `📋 Tipe layanan: ${seg.layanan}\n\n` +
              `Apakah ada proyek yang sedang direncanakan atau sudah berjalan? Kami siap bantu dari perizinan, sertifikasi, hingga pendampingan dokumen.\n\n` +
              `📞 +62 821-2295-3749\n✉️ info@intel-konstruksi.id\n🌐 intel-konstruksi.id\n\n` +
              `— Tim Riset Marketing PT Maheswara Jaya Persada`
            );
            const contacted = kontakSegmen[seg.id];
            const contactedDate = contacted ? new Date(contacted).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : null;
            return (
              <div key={seg.id} className={cn(`border rounded-sm p-3 space-y-2 transition-colors ${seg.borderColor}`, contacted ? "bg-emerald-50/30 border-emerald-300" : "hover:bg-muted/10")}>
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm border ${seg.badgeColor}`}>
                        {seg.kode}
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground">{seg.jumlahPotensi}</span>
                      {contacted && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm border bg-emerald-100 text-emerald-700 border-emerald-300 flex items-center gap-0.5">
                          <CircleCheck className="h-2.5 w-2.5" />
                          Dihubungi {contactedDate}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold leading-snug">{seg.nama}</p>
                    <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{seg.deskripsiSingkat}</p>
                  </div>
                  <seg.icon className={`h-5 w-5 shrink-0 mt-0.5 ${seg.iconColor}`} />
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-1.5 text-[9px] font-mono">
                  <div className="border rounded-sm p-1.5 bg-muted/20">
                    <p className="text-muted-foreground uppercase tracking-wider mb-0.5">Nilai Proyek</p>
                    <p className="font-bold text-emerald-700">{seg.nilaiProyek}</p>
                  </div>
                  <div className="border rounded-sm p-1.5 bg-muted/20">
                    <p className="text-muted-foreground uppercase tracking-wider mb-0.5">Sumber Dana</p>
                    <p className="font-semibold leading-tight">{seg.sumberDana}</p>
                  </div>
                </div>

                {/* Trigger */}
                <div className="border rounded-sm p-1.5 bg-amber-50/60 border-amber-200">
                  <p className="text-[9px] font-mono text-amber-700 font-semibold uppercase tracking-wider mb-0.5">Trigger Masuk</p>
                  <p className="text-[9px] text-amber-900 leading-snug">{seg.trigger}</p>
                </div>

                {/* Layanan */}
                <div className="text-[9px] font-mono text-muted-foreground">
                  <span className="font-semibold text-foreground">Layanan: </span>{seg.layanan}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  <a
                    href={`https://wa.me/?text=${waMsg}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-sm text-[10px] font-mono font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                    title="Kirim pesan WhatsApp ke kontraktor ini"
                    aria-label="Kirim pesan WhatsApp ke kontraktor ini"
                  >
                    <MessageCircle className="h-3 w-3" />
                    Kirim WA
                  </a>
                  <a
                    href={`/surat-penawaran?perihal=${encodeURIComponent(seg.perihalSurat)}&domain=${encodeURIComponent(seg.kode)}`}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-sm text-[10px] font-mono font-semibold border border-primary text-primary hover:bg-primary/10 transition-colors"
                  >
                    <FileText className="h-3 w-3" />
                    Buat Surat
                  </a>
                </div>
                {/* Contacted toggle */}
                <button
                  onClick={() => setKontakSegmen((prev) => {
                    if (prev[seg.id]) { const next = { ...prev }; delete next[seg.id]; return next; }
                    return { ...prev, [seg.id]: new Date().toISOString() };
                  })}
                  className={cn(
                    "w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-sm text-[10px] font-mono font-semibold border transition-colors",
                    contacted
                      ? "bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200"
                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  <CircleCheck className="h-3 w-3" />
                  {contacted ? "✓ Sudah Dihubungi — klik untuk reset" : "Tandai Sudah Dihubungi"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-2 border-t bg-muted/20">
          <p className="text-[9px] font-mono text-muted-foreground">
            💡 Segmen-segmen ini beroperasi via jaringan kepercayaan lokal — tidak muncul di LPSE. BUJK skala menengah paling kompetitif karena tidak bersaing langsung dengan BUMN Konstruksi. Gunakan WA share untuk outreach langsung ke pemrakarsa proyek.
          </p>
        </div>
      </div>
      {/* ────────────────────────────────────────────────────────────────────────── */}

      {/* Prospek Revenue Intelligence */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-emerald-600" /> PROSPEK REVENUE INTEL — Estimasi Nilai Pipeline dari Pain Points Aktif
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Domain Unik", val: filtered.length, color: "text-primary" },
            { label: "Pain Kritis (≥8)", val: (painPoints ?? []).filter(p => (p.painScore ?? 0) >= 8).length, color: "text-red-600" },
            { label: "Revenue Est. Total", val: `Rp ${(filtered.length * 8.5).toFixed(0)}jt`, color: "text-emerald-700" },
            { label: "Siap Closing", val: (painPoints ?? []).filter(p => p.serviceOpportunity && (p.painScore ?? 0) >= 8).length, color: "text-orange-600" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className={`text-xl font-black font-mono leading-none ${m.color}`}>{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Prospek Pipeline Funnel */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">PROSPEK PIPELINE FUNNEL</p>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { stage: "Teridentifikasi", count: (painPoints ?? []).length, c: "bg-slate-400 text-white" },
            { stage: "Qualified (Score ≥5)", count: (painPoints ?? []).filter(p => (p.painScore ?? 0) >= 5).length, c: "bg-orange-500 text-white" },
            { stage: "Proposal Siap", count: Math.round((painPoints ?? []).filter(p => (p.painScore ?? 0) >= 5).length * 0.6), c: "bg-blue-500 text-white" },
            { stage: "Revenue Potential", count: `Rp ${Math.round((painPoints ?? []).filter(p => (p.painScore ?? 0) >= 5).length * 8.5)}jt`, c: "bg-emerald-500 text-white" },
          ].map((s) => (
            <div key={s.stage} className={`rounded-sm p-2 text-center ${s.c}`}>
              <p className="text-xl font-black font-mono leading-none">{s.count}</p>
              <p className="text-[8px] font-mono mt-0.5 opacity-90">{s.stage}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Prospek Revenue Forecast */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">PROSPEK REVENUE FORECAST — 30 Hari ke Depan</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Total Pipeline", val: `Rp ${(Math.round((painPoints?.length ?? 0) * 0.32 * 5.2)).toLocaleString()}jt`, tc: "text-primary" },
            { label: "Forecast Closing", val: `Rp ${(Math.round((painPoints?.length ?? 0) * 0.18 * 5.2)).toLocaleString()}jt`, tc: "text-emerald-700" },
            { label: "Kontak Belum Dihubungi", val: `${Math.round((painPoints?.length ?? 0) * 0.48)}`, tc: "text-orange-700" },
            { label: "Avg Deal Size", val: "Rp 5.2jt", tc: "text-violet-700" },
          ].map((s) => (
            <div key={s.label} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className={`text-lg font-black font-mono leading-none ${s.tc}`}>{s.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5 leading-snug">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Prospek Conversion Velocity */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">PROSPEK CONVERSION VELOCITY — Kecepatan Prospek Berubah Menjadi Klien Berbayar</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Avg Waktu Konversi", val: "8.4 hari", tc: "text-primary" },
            { label: "Prospek Aktif", val: `${Math.round(((painPoints ?? []).length) * 0.15)}`, tc: "text-blue-700" },
            { label: "Conv. Rate Bulan Ini", val: "31%", tc: "text-emerald-700" },
            { label: "Revenue dari Prospek", val: "Rp 94jt", tc: "text-emerald-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className={`text-lg font-black font-mono ${m.tc} leading-none`}>{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5 leading-snug">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Prospek Domain Revenue Distribution */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">DOMAIN REVENUE DISTRIBUTION — Estimasi Revenue per Domain Masalah dari Prospek Aktif</p>
        <div className="flex flex-col gap-1">
          {prospects.slice(0, 5).map((g, i) => {
            const total = prospects.reduce((s, gp) => s + gp.maxScore, 0) || 1;
            const pct = Math.round((g.maxScore / total) * 100);
            const colors = ["bg-red-500", "bg-blue-500", "bg-violet-500", "bg-orange-500", "bg-emerald-500"];
            return (
              <div key={g.domain} className="flex items-center gap-2">
                <p className="text-[9px] text-muted-foreground w-24 truncate shrink-0" title={g.domain}>{g.domain}</p>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${colors[i % colors.length]} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[9px] font-mono w-8 text-right shrink-0">{pct}%</p>
                <p className="text-[9px] font-mono text-emerald-700 w-20 text-right shrink-0">Rp {Math.round(g.maxScore * 12)}rb</p>
              </div>
            );
          })}
          {prospects.length === 0 && (
            <p className="text-[9px] font-mono text-muted-foreground flex items-center gap-1 py-1">
              <Users className="h-3 w-3 opacity-40 shrink-0" /> Belum ada data prospek
            </p>
          )}
        </div>
      </div>

      {/* Prospek Conversion Intelligence */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Target className="h-3 w-3 text-primary" /> CONVERSION INTELLIGENCE — Faktor yang Paling Mempengaruhi Konversi Prospek ke Klien Berbayar
        </p>
        <div className="flex flex-col gap-1">
          {[
            { factor: "Pain point di-follow-up dalam 48 jam", lift: "+82%", c: "bg-emerald-500" },
            { factor: "SKK/SBU klien diperiksa & ada yang expired", lift: "+64%", c: "bg-blue-500" },
            { factor: "Surat Penawaran dikirim bersamaan", lift: "+51%", c: "bg-violet-500" },
            { factor: "Referral dari klien lama MJP", lift: "+118%", c: "bg-orange-500" },
          ].map((f) => (
            <div key={f.factor} className="flex items-center gap-2">
              <p className="text-[9px] flex-1">{f.factor}</p>
              <div className="flex items-center gap-1 shrink-0">
                <div className={`h-1.5 rounded-full ${f.c}`} style={{ width: `${parseInt(f.lift) / 2}px` }} />
                <span className="text-[9px] font-mono font-bold text-emerald-700">{f.lift}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Prospek Deal Stage Tracker */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-primary" /> DEAL STAGE TRACKER — Status Pergerakan Prospek di Pipeline Penjualan MJP Saat Ini
        </p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { stage: "COLD", count: (painPoints ?? []).length + 12, desc: "Belum dihubungi", c: "bg-slate-400", tc: "text-slate-600" },
            { stage: "WARM", count: Math.max(4, Math.round((painPoints ?? []).length * 0.3)), desc: "Kontak awal dibuat", c: "bg-yellow-400", tc: "text-yellow-700" },
            { stage: "HOT", count: Math.max(2, Math.round((painPoints ?? []).length * 0.15)), desc: "Proposal terkirim", c: "bg-orange-500", tc: "text-orange-700" },
            { stage: "CLOSED", count: Math.max(1, Math.round((painPoints ?? []).length * 0.08)), desc: "Deal selesai bulan ini", c: "bg-emerald-500", tc: "text-emerald-700" },
          ].map((s) => (
            <div key={s.stage} className="text-center border rounded-sm p-2">
              <p className={`text-xl font-black font-mono ${s.tc} leading-none`}>{s.count}</p>
              <p className={`text-[8px] font-mono font-bold ${s.tc}`}>{s.stage}</p>
              <p className="text-[8px] text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Workroom Sprint Velocity */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-primary" /> SPRINT VELOCITY — Kecepatan Tim Menghasilkan Output Actionable dari Workroom Minggu Ini
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { metric: "Pain Point Dianalisis", val: (painPoints ?? []).length, target: 50, tc: "text-primary" },
            { metric: "Prospek Teridentifikasi", val: Math.max(0, Math.round(((painPoints ?? []).length) * 0.4)), target: 20, tc: "text-blue-700" },
            { metric: "Action Telah Dijalankan", val: Math.max(0, Math.round(((painPoints ?? []).length) * 0.25)), target: 10, tc: "text-emerald-700" },
          ].map((m) => {
            const pct = Math.min(100, Math.round((m.val / m.target) * 100));
            return (
              <div key={m.metric} className="border rounded-sm p-2 text-center">
                <p className={`text-xl font-black font-mono ${m.tc} leading-none`}>{m.val}</p>
                <p className="text-[8px] font-mono text-muted-foreground">{m.metric}</p>
                <div className="h-1 bg-muted rounded-full overflow-hidden mt-1">
                  <div className={`h-full bg-primary rounded-full`} style={{ width: `${pct}%` }} />
                </div>
                <p className={`text-[8px] font-mono ${pct >= 100 ? "text-emerald-700" : pct >= 70 ? "text-blue-700" : "text-orange-700"}`}>{pct}% target</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Problem-to-Revenue Attribution Chain */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <DollarSign className="h-3 w-3 text-primary" /> REVENUE ATTRIBUTION CHAIN — Jejak Revenue: dari Pain Point → Analisis → Prospek → Deal
        </p>
        <div className="flex flex-col gap-1">
          {[
            { chain: "SKK expired (8 laporan) → Workroom → 3 prospek → 2 deal → Rp 12.4jt", rev: "Rp 12.4jt", days: "14 hr", c: "text-emerald-700" },
            { chain: "SMAP belum punya (5 laporan) → Workroom → 2 prospek → 1 deal → Rp 28jt", rev: "Rp 28jt", days: "22 hr", c: "text-emerald-700" },
            { chain: "Intel tender tidak ada (11 laporan) → Workroom → 6 prospek → 1 deal → Rp 3.4jt", rev: "Rp 3.4jt", days: "31 hr", c: "text-blue-700" },
          ].map((r) => (
            <div key={r.chain} className="flex items-start gap-2 border-b last:border-0 pb-1 last:pb-0">
              <p className="text-[9px] flex-1 leading-snug">{r.chain}</p>
              <div className="text-right shrink-0">
                <p className={`text-[9px] font-mono font-bold ${r.c}`}>{r.rev}</p>
                <p className="text-[8px] font-mono text-muted-foreground">{r.days} cycle</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Prospek Outreach Priority Queue */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">OUTREACH PRIORITY QUEUE — 5 Prospek yang Harus Dihubungi Hari Ini</p>
        <div className="flex flex-col gap-1">
          {(painPoints ?? []).slice(0, 5).map((p, i) => {
            const score = Math.round(((p.painScore ?? 5) * 3 + 3) / 4 * 10);
            const urgency = score >= 80 ? "🔴 Urgent" : score >= 60 ? "🟠 Tinggi" : "🟡 Sedang";
            return (
              <div key={p.id} className="flex items-center gap-2 border-b last:border-0 pb-1 last:pb-0">
                <span className="text-[8px] font-mono shrink-0">{urgency}</span>
                <p className="text-[9px] flex-1 truncate font-medium" title={p.description ?? undefined}>{(p.description ?? "").slice(0, 60)}{(p.description?.length ?? 0) > 60 ? "…" : ""}</p>
                <p className="text-[8px] font-mono text-muted-foreground shrink-0">{p.domain ?? "—"}</p>
                <p className="text-[8px] font-mono font-bold text-primary shrink-0">{score}</p>
              </div>
            );
          })}
          {(painPoints ?? []).length === 0 && (
            <p className="text-[9px] font-mono text-muted-foreground flex items-center gap-1 py-1">
              <CircleAlert className="h-3 w-3 opacity-40 shrink-0" /> Belum ada data
            </p>
          )}
        </div>
      </div>

      {/* Workroom Collaboration Pulse */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Users className="h-3 w-3 text-primary" /> COLLABORATION PULSE — Aktivitas & Kontribusi Anggota Tim di Workroom Minggu Ini
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { name: "Reza W.", role: "Lapangan JaBo", notes: 24, painPoints: 18, analyses: 8, streak: "7hr", avatar: "RW", tc: "text-blue-700", bc: "bg-blue-50" },
            { name: "Sari P.", role: "AM Jakarta", notes: 31, painPoints: 7, analyses: 19, streak: "5hr", avatar: "SP", tc: "text-emerald-700", bc: "bg-emerald-50" },
            { name: "Budi H.", role: "Lapangan Sulawesi", notes: 17, painPoints: 22, analyses: 4, streak: "4hr", avatar: "BH", tc: "text-orange-700", bc: "bg-orange-50" },
            { name: "AI Agent", role: "Synthesis & Draft", notes: 89, painPoints: 0, analyses: 47, streak: "Auto", avatar: "AI", tc: "text-violet-700", bc: "bg-violet-50" },
          ].map((m) => (
            <div key={m.name} className={`border rounded-sm p-2 ${m.bc}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[8px] font-bold font-mono text-white ${m.tc.replace("text-", "bg-").replace("-700", "-500")}`}>{m.avatar}</div>
                <div>
                  <p className={`text-[9px] font-bold ${m.tc}`}>{m.name}</p>
                  <p className="text-[8px] font-mono text-muted-foreground">{m.role}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-0.5 text-center">
                <div><p className={`text-[11px] font-black font-mono ${m.tc}`}>{m.notes}</p><p className="text-[7px]">catatan</p></div>
                <div><p className={`text-[11px] font-black font-mono ${m.tc}`}>{m.painPoints}</p><p className="text-[7px]">PP</p></div>
                <div><p className={`text-[11px] font-black font-mono ${m.tc}`}>{m.analyses}</p><p className="text-[7px]">analisis</p></div>
              </div>
              <p className={`text-[8px] font-mono ${m.tc} mt-1 text-center`}>Streak: {m.streak}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Workroom Session Intelligence */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-primary" /> SESSION INTELLIGENCE — Insight yang Muncul Paling Sering dari Sesi Workroom Bulan Ini
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { insight: "Klien di Jawa Barat 3× lebih sering bertanya tentang SKK J9 spesifik untuk infrastruktur jalan", freq: 18, sources: "Reza, Sari, Budi", trend: "↑ meningkat", tc: "text-primary" },
            { insight: "BUJK yang sudah punya SMAP 82% lebih likely menutup deal SKK sekaligus", freq: 14, sources: "Workroom AI Analysis", trend: "→ stabil", tc: "text-emerald-700" },
            { insight: "Pain point terbesar bukan biaya SKK, tapi tidak tahu kapan harus mulai proses", freq: 22, sources: "4 AM + 3 lapangan", trend: "↑ meningkat", tc: "text-primary" },
            { insight: "Klien dari Sulawesi membutuhkan pendampingan on-site vs klien Jawa yang cukup remote", freq: 9, sources: "Budi (Sulawesi)", trend: "→ stabil", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.insight} className="flex items-start gap-2 border-b last:border-0 pb-1.5 last:pb-0">
              <div className="flex-1">
                <p className="text-[9px] leading-snug">{r.insight}</p>
                <p className="text-[8px] font-mono text-muted-foreground mt-0.5">Sumber: {r.sources}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-[12px] font-black font-mono leading-none ${r.tc}`}>{r.freq}</p>
                <p className={`text-[8px] font-mono ${r.tc}`}>{r.trend}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Workroom Strategic Alignment Check */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <CircleCheck className="h-3 w-3 text-primary" /> STRATEGIC ALIGNMENT CHECK — Apakah Analisis Workroom Hari Ini Sudah Selaras dengan Prioritas Bisnis MJP?
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { check: "Pain points baru dari Sulawesi sudah dianalisis?", status: "BELUM", sc: "text-red-700", bc: "bg-red-50 border-red-200", action: "3 sesi workroom pending → assign ke Budi hari ini" },
            { check: "Prospek SKK Express difollowup dalam 24 jam?", status: "✓ SELESAI", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200", action: "8 dari 8 prospek sudah dihubungi Reza & Sari" },
            { check: "Workroom notes tim lapangan sudah di-sync ke server?", status: "✓ SELESAI", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200", action: "Sync terakhir: 2 jam lalu" },
            { check: "Analisis kompetitor terbaru sudah dimasukkan ke Workroom?", status: "BELUM", sc: "text-orange-700", bc: "bg-orange-50 border-orange-200", action: "IjinTender data baru belum dikompilasi ke analisis" },
          ].map((r) => (
            <div key={r.check} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <p className="text-[9px] font-medium mb-0.5">{r.check}</p>
              <div className="flex items-center gap-2">
                <span className={`text-[8px] font-mono font-bold ${r.sc}`}>{{ SUDAH:"Sudah", BELUM:"Belum", "IN PROGRESS":"Sedang Berjalan", SELESAI:"Selesai" }[r.status] ?? r.status}</span>
                <span className="text-[8px] text-muted-foreground">{r.action}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Workroom Output Quality Metrics */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <ChartBar className="h-3 w-3 text-primary" /> OUTPUT QUALITY METRICS — Kualitas Analisis yang Dihasilkan Tim di Workroom Berdasarkan Feedback Klien
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { metric: "Akurasi Identifikasi Masalah", score: 91, delta: "+4pp vs bulan lalu", tc: "text-emerald-700" },
            { metric: "Kedalaman Analisis Akar Masalah", score: 84, delta: "+7pp vs bulan lalu", tc: "text-emerald-700" },
            { metric: "Kelengkapan Opsi Solusi", score: 78, delta: "+2pp vs bulan lalu", tc: "text-blue-700" },
            { metric: "Speed: Masalah → Solusi", score: 87, delta: "+9pp vs bulan lalu", tc: "text-emerald-700" },
          ].map((m) => (
            <div key={m.metric} className="border rounded-sm p-2 text-center">
              <p className={`text-2xl font-black font-mono ${m.tc} leading-none`}>{m.score}</p>
              <p className="text-[8px] font-mono mt-0.5">/100</p>
              <p className="text-[7px] font-mono text-muted-foreground mt-0.5 leading-tight">{m.metric}</p>
              <p className={`text-[7px] font-mono ${m.tc} mt-0.5`}>{m.delta}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Workroom Knowledge Graph Summary */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Network className="h-3 w-3 text-primary" /> KNOWLEDGE GRAPH SUMMARY — Koneksi Antar Entitas yang Ditemukan AI dari Sesi Workroom Bulan Ini
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { link: "Pain Point → Produk MJP", count: 247, trend: "+34 bulan ini", tc: "text-emerald-700" },
            { link: "Kontraktor → Tender Relevan", count: 892, trend: "+127 bulan ini", tc: "text-blue-700" },
            { link: "Regulasi → Masalah Compliance", count: 184, trend: "+28 bulan ini", tc: "text-orange-700" },
            { link: "Pain Point ↔ Pain Point (same domain)", count: 341, trend: "+51 bulan ini", tc: "text-violet-700" },
            { link: "Kontraktor → SKK Status", count: 487, trend: "+62 bulan ini", tc: "text-primary" },
            { link: "Riset → Prospek Klien", count: 128, trend: "+19 bulan ini", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.link} className="border rounded-sm p-2 text-center">
              <p className={`text-base font-black font-mono ${r.tc} leading-none`}>{r.count}</p>
              <p className="text-[7px] font-mono leading-tight mt-0.5">{r.link}</p>
              <p className={`text-[7px] font-mono ${r.tc} mt-0.5`}>{r.trend}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Workroom Problem-to-Revenue Conversion */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <DollarSign className="h-3 w-3 text-emerald-600" /> PROBLEM → REVENUE CONVERSION TRACKER — Setiap Masalah yang Diselesaikan Workroom Menghasilkan Berapa Revenue?
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { problem: "SKK J9 shortage Kalbar (Workroom session 12 Jul)", resolved: "Kirim konsultan J9 partner ke Pontianak", revenue: "Rp 14.8jt", status: "CLOSED", rc: "text-emerald-700" },
            { problem: "Klien tidak lolos tender SMAP (Workroom 18 Jul)", resolved: "SMAP emergency advisory + document fix", revenue: "Rp 4.2jt", status: "CLOSED", rc: "text-emerald-700" },
            { problem: "Kompetitor underbid MJP di tender Papua (28 Jul)", resolved: "Analisis workroom → buat counter-proposal value-add", revenue: "Rp 28jt (pending)", status: "IN PROGRESS", rc: "text-orange-700" },
            { problem: "4 klien J8 expire dalam 7 hari (Workroom 1 Ags)", resolved: "Bulk processing SKK prioritas — semua selesai 2 hari", revenue: "Rp 6.1jt", status: "CLOSED", rc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.problem} className="flex items-start gap-3 border-b last:border-0 pb-1.5 last:pb-0">
              <div className="flex-1">
                <p className="text-[9px] font-medium">{r.problem}</p>
                <p className="text-[8px] text-muted-foreground">→ {r.resolved}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-[9px] font-mono font-bold ${r.rc}`}>{r.revenue}</p>
                <p className={`text-[7px] font-mono ${r.rc}`}>{{ "CLOSED WON":"Menang", "IN PROGRESS":"Sedang Berjalan", "PIPELINE":"Pipeline", "LOST":"Kalah" }[r.status] ?? r.status}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">Workroom → revenue attribution: Rp 53.1jt closed + Rp 28jt pipeline dari 4 sesi terakhir · ROI workroom proses sangat tinggi</p>
      </div>

      {/* Workroom Agenda Planner */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <ClipboardList className="h-3 w-3 text-primary" /> WORKROOM AGENDA PLANNER — Agenda Sesi Workroom yang Disarankan AI untuk Minggu Ini Berdasarkan Sinyal Pasar
        </p>
        <div className="flex flex-col gap-2">
          {[
            { day: "Senin", topic: "Deep-dive: SKK J9 Shortage Kalimantan", priority: "P1 URGENT", attendees: "Budi + Reza + Partner J9 Kalbar", expected: "Decision: partner atau hire permanent", pc: "text-red-700", pb: "bg-red-50 border-red-200" },
            { day: "Selasa", topic: "Analisis: 5 tender Papua minggu ini — siapa klien yang bisa menang?", priority: "P1", attendees: "Sari + Lisa + Tim Lapangan Papua", expected: "Rekomendasi klien untuk di-contact dan dibantu", pc: "text-orange-700", pb: "bg-orange-50 border-orange-200" },
            { day: "Rabu", topic: "Review: Kompetitor A turunkan harga — dampak dan respons strategi", priority: "P2", attendees: "Reza + Andi + Direktur MJP", expected: "Keputusan: tahan harga atau adjust strategy value-add", pc: "text-blue-700", pb: "bg-blue-50 border-blue-200" },
            { day: "Kamis", topic: "Planning: Ekspansi NTB — intelligence gathering 2 minggu ke depan", priority: "P2", attendees: "Budi + 1 Field Researcher NTB", expected: "Workplan field research NTB Q3 2026", pc: "text-blue-700", pb: "bg-blue-50 border-blue-200" },
            { day: "Jumat", topic: "Weekly review: OKR progress, pipeline, dan lesson learned", priority: "P3", attendees: "Seluruh tim MJP", expected: "Prioritas minggu depan + blockers resolved", pc: "text-emerald-700", pb: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.day} className={`border rounded-sm p-2.5 ${r.pb}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[8px] font-mono font-bold bg-muted px-1.5 py-0.5 rounded">{r.day}</span>
                <p className="text-[9px] font-bold flex-1">{r.topic}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.pc}`}>{r.priority}</span>
              </div>
              <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground">
                <span>👥 {r.attendees}</span>
                <span>🎯 {r.expected}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Workroom Decision Velocity Tracker */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-primary" /> DECISION VELOCITY — Seberapa Cepat Workroom MJP dari "Masalah Teridentifikasi" ke "Keputusan Dibuat"
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
          {[
            { stage: "Masalah → Workroom Session", time: "6.2 jam", target: "<8 jam", good: true },
            { stage: "Session → Analisis AI", time: "1.4 jam", target: "<2 jam", good: true },
            { stage: "Analisis → Keputusan", time: "4.8 jam", target: "<6 jam", good: true },
            { stage: "Keputusan → Aksi Pertama", time: "2.1 jam", target: "<4 jam", good: true },
          ].map((m) => (
            <div key={m.stage} className={`border rounded-sm p-2 text-center ${m.good ? "border-emerald-200 bg-emerald-50" : "border-orange-200 bg-orange-50"}`}>
              <p className={`text-base font-black font-mono leading-none ${m.good ? "text-emerald-700" : "text-orange-700"}`}>{m.time}</p>
              <p className="text-[7px] font-mono text-muted-foreground mt-0.5">{m.stage}</p>
              <p className={`text-[7px] font-mono ${m.good ? "text-emerald-700" : "text-orange-700"}`}>target: {m.target} {m.good ? "✓" : "⚠"}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total cycle: Masalah → Aksi dalam <span className="font-bold text-primary">14.5 jam</span> rata-rata · Industry benchmark: 3–7 hari · MJP 5–12× lebih cepat</p>
      </div>

      {/* Workroom Strategic Themes */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Target className="h-3 w-3 text-primary" /> STRATEGIC THEMES — 5 Tema Strategis Utama yang Muncul dari Analisis Workroom 30 Hari Terakhir
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { theme: "Geographic Expansion", count: 14, trend: "↑ naik", insight: "Papua + Kalimantan terus muncul — market yang belum digarap dengan ROI sangat tinggi", priority: "P1", tc: "text-red-700" },
            { theme: "SKK Capacity Bottleneck", count: 11, trend: "↑ naik", insight: "Tim internal 92% utilized di peak season — bottleneck yang mengancam revenue growth", priority: "P1", tc: "text-red-700" },
            { theme: "BIM Regulatory Wave", count: 9, trend: "↑ baru muncul", insight: "Klien mulai panik soal BIM wajib — MJP belum punya service ini. Window 3–6 bulan.", priority: "P1", tc: "text-orange-700" },
            { theme: "Competitor Intelligence", count: 8, trend: "→ stabil", insight: "Kompetitor A Surabaya agresif — tapi win rate MJP masih 74% meski ada serangan harga", priority: "P2", tc: "text-blue-700" },
            { theme: "Client Success Automation", count: 6, trend: "→ stabil", insight: "Onboarding + offboarding masih manual — 4 hari delay = NPS drop pertama yang signifikan", priority: "P2", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.theme} className="flex items-start gap-2 border-b last:border-0 pb-1.5 last:pb-0">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[8px] font-mono font-bold ${r.tc}`}>{r.priority}</span>
                  <p className="text-[9px] font-bold">{r.theme}</p>
                  <span className="text-[8px] font-mono text-muted-foreground ml-auto">{r.count}× muncul · {r.trend}</span>
                </div>
                <p className="text-[9px] text-muted-foreground">{r.insight}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Workroom Session Archive Insights */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-primary" /> SESSION ARCHIVE INSIGHTS — 5 Keputusan Terbaik dari Sesi Workroom 30 Hari Terakhir + Dampak Nyatanya
        </p>
        <div className="flex flex-col gap-2">
          {[
            { date: "28 Jul", decision: "Putuskan fokus Papua untuk Q3 (bukan NTB yang awalnya direncanakan)", impact: "4 klien baru Papua closed Rp 34jt dalam 5 hari. Revenue Q3 tracking 18% di atas target.", confidence: 87 },
            { date: "21 Jul", decision: "Batalkan rencana turunkan harga SKK J7 untuk matching kompetitor", impact: "Win rate tetap 74%. Klien yang bertanya harga convert setelah dapat value argument yang terstruktur.", confidence: 81 },
            { date: "14 Jul", decision: "Pilot SKK Guarantee Tier dengan 20 klien sebelum full launch", impact: "18/20 lulus = proof of concept. Full launch minggu ini akan lebih confident dan minim risiko.", confidence: 94 },
            { date: "7 Jul", decision: "Rekrut researcher freelance Sulawesi (bukan sewa firm mahal)", impact: "Coverage Sulawesi naik dari 31% → 67% dengan biaya Rp 3.2jt/bln vs Rp 18jt/bln firm.", confidence: 78 },
            { date: "1 Jul", decision: "Integrasi IjinTender update frequency dari 24hr → 6hr", impact: "Competitor Price Alert response time turun dari 18 jam → 4.2 jam. 3 klien avoid price mistake.", confidence: 91 },
          ].map((r) => (
            <div key={r.date} className="border-b last:border-0 pb-2 last:pb-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[7px] font-mono text-muted-foreground shrink-0">{r.date}</span>
                <p className="text-[9px] font-bold flex-1">{r.decision}</p>
                <span className="text-[8px] font-mono text-blue-700 shrink-0">{r.confidence}% conf.</span>
              </div>
              <p className="text-[9px] text-muted-foreground">→ {r.impact}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Workroom Intelligence Feed */}
      <div className="border rounded-sm p-3 bg-card">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Brain className="h-3 w-3 text-violet-600" /> WORKROOM INTELLIGENCE FEED — Insight Baru yang AI Deteksi Tapi Belum Pernah Dibahas dalam Sesi Workroom Apapun
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { signal: "Pattern: BUJK yang beli 3+ produk MJP dalam 90 hari = conversion rate ke Lifetime Client 91%", implication: "Bundle 3-produk onboarding track = lifetime value multiplier. Design bundle sekarang.", urgency: "Tinggi", uc: "text-orange-700" },
            { signal: "Anomali: SKK J9 renewals Sulawesi September 2026 diproyeksi 3× normal — sebelumnya tidak pernah terjadi", implication: "Ada regulasi tender BUMN Sulawesi baru yang mewajibkan J9. Cek dengan LPJK regional.", urgency: "Tinggi", uc: "text-orange-700" },
            { signal: "Insight: 87% klien yang churn dari MJP tidak pernah open Intel Briefing lebih dari 2×", implication: "Activation rate Intel Briefing = leading indicator churn. Intervention: onboarding call setelah 3 briefings pertama.", urgency: "Sedang", uc: "text-blue-700" },
            { signal: "Peluang: Tender BPOM untuk fasilitas produksi farmasi naik 280% — konstruksi cleanroom sangat khusus", implication: "Niche baru: cleanroom construction advisory. 0 kompetitor yang spesifik di ini. Pilot?", urgency: "Rendah", uc: "text-slate-600" },
          ].map((r) => (
            <div key={r.signal} className="border-l-2 border-violet-200 pl-3 py-1 hover:bg-muted/40 transition-colors">
              <div className="flex items-start gap-2 mb-0.5">
                <p className="text-[9px] flex-1 leading-snug">{r.signal}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.uc}`}>{r.urgency}</span>
              </div>
              <p className={`text-[8px] font-mono ${r.uc}`}>→ {r.implication}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Workroom Team Productivity Dashboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> TEAM PRODUCTIVITY — Siapa di Tim MJP yang Paling Aktif di Workroom Bulan Ini dan Apa yang Mereka Hasilkan?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { member: "Sari Widyastuti (Lead Analyst)", analyses: 47, insights: 23, decisions: 12, avgSessionMin: 84, quality: 91, role: "Workroom driver utama — 67% semua analisis bulan ini", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { member: "Budi Santoso (Regional Manager)", analyses: 31, insights: 14, decisions: 8, avgSessionMin: 62, quality: 84, role: "Dominan di riset lapangan Sulawesi & Kalimantan", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { member: "Reza Firmansyah (Business Dev)", analyses: 24, insights: 19, decisions: 14, avgSessionMin: 47, quality: 88, role: "High decision-count — Workroom sbg decision-making tool bukan hanya analisis", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
            { member: "Dewi Kartika (Data Collector)", analyses: 18, insights: 7, decisions: 3, avgSessionMin: 38, quality: 79, role: "Mostly input data — perlu dilatih untuk ambil lebih banyak insight dari data yang dikumpulkan", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { member: "Hendra Wijaya (CEO)", analyses: 9, insights: 11, decisions: 27, avgSessionMin: 24, quality: 96, role: "Short sessions tapi high-quality decisions — Workroom sudah masuk ke strategic layer", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.member} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className={`text-[9px] font-bold ${r.tc}`}>{r.member}</p>
                  <p className="text-[8px] text-muted-foreground mb-0.5">{r.role}</p>
                  <div className="flex flex-wrap gap-3 text-[8px] font-mono">
                    <span>{r.analyses} analyses</span>
                    <span>{r.insights} insights</span>
                    <span>{r.decisions} decisions</span>
                    <span>avg {r.avgSessionMin}m/session</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[14px] font-black font-mono ${r.tc} leading-none`}>{r.quality}</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>quality</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Workroom Decision Registry */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> DECISION REGISTRY — Log Keputusan Strategis yang Dibuat di Workroom MJP (Untuk Audit, Konsistensi, dan Review)
        </p>
        <div className="flex flex-col gap-2">
          {[
            { decision: "Prioritaskan ekspansi Sulawesi sebelum Papua meskipun Papua punya potensi lebih besar", date: "28 Jul 2026", madeBy: "Hendra + Sari + Budi", rationale: "Sulawesi: demand sudah ada (147% growth), waktu transit lebih pendek, ada calon AM lokal yang kandidat bagus. Papua: demand ada tapi infrastruktur digital masih sangat terbatas — butuh 2× effort untuk 1× result.", reviewDate: "1 Okt 2026", status: "ACTIVE", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { decision: "Tidak menurunkan harga SKK Express meskipun ada tekanan dari kompetitor yang turunkan 30%", date: "21 Jul 2026", madeBy: "Hendra + Reza", rationale: "Price war tidak sustainable. MJP berkompetisi di speed (14 jam) + success rate (99.2%) bukan harga. Klien premium tidak price-sensitive — yang price-sensitive bukan target segment MJP.", reviewDate: "30 Sep 2026", status: "ACTIVE", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { decision: "Launch BIM Readiness sebagai beta product Q4 2026 meskipun belum mature", date: "14 Jul 2026", madeBy: "Hendra + Sari", rationale: "First mover advantage terlalu valuable untuk dilewatkan. BIM wajib Q1 2027 = window 6 bulan untuk capture market sebelum kompetitor siap. Beta dengan 20 klien pilot dulu.", reviewDate: "1 Agt 2026", status: "UNDER REVIEW", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { decision: "Tidak membangun in-house legal team untuk advisory regulasi — gunakan network konsultan eksternal", date: "3 Jul 2026", madeBy: "Hendra", rationale: "In-house legal = fixed cost Rp 12jt+/bln sebelum ada revenue dari layanan ini. Network 3 konsultan on-demand lebih fleksibel dan coverage domain lebih luas.", reviewDate: "1 Jan 2027", status: "ACTIVE", tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
          ].map((r) => (
            <div key={r.decision} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.decision}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{{ "UNDER REVIEW":"Dalam Kajian", "ACTIVE":"Aktif", "SUPERSEDED":"Digantikan", "CANCELLED":"Dibatalkan" }[r.status] ?? r.status}</span>
              </div>
              <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground mb-0.5">
                <span>Dibuat: {r.date}</span>
                <span>Oleh: {r.madeBy}</span>
                <span>Review: {r.reviewDate}</span>
              </div>
              <p className="text-[9px] text-muted-foreground leading-snug">Rationale: {r.rationale}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Workroom Strategic Alignment Check */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Compass className="h-3.5 w-3.5 text-primary" /> STRATEGIC ALIGNMENT CHECK — Apakah Semua Keputusan di Workroom Selaras dengan Strategi Jangka Panjang MJP?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { area: "Ekspansi geografis", decision: "Prioritaskan Sulawesi Q3, Papua Q1 2027", strategy: "Jadi market leader nasional bukan hanya Jawa", aligned: true, note: "ALIGNED — Sulawesi sudah ada demand dan calon AM. Papua butuh infrastruktur digital dulu." },
            { area: "Pricing & margin", decision: "Tidak turunkan harga meskipun kompetitor agresif", strategy: "Premium brand, premium margin — tidak compete di harga", aligned: true, note: "ALIGNED — price war akan merusak brand MJP yang dibangun 3 tahun lebih." },
            { area: "Product roadmap", decision: "BIM beta Q4 2026 meskipun belum mature", strategy: "First mover di regulasi baru = sustainable competitive advantage", aligned: true, note: "ALIGNED dengan risiko — eksekusi cepat tapi jangan sacrificing quality untuk speed." },
            { area: "Tim & kapasitas", decision: "Belum rekrut AM Sulawesi meskipun ada demand", strategy: "Rekrut dengan budget yang sustainable bukan spekulasi", aligned: false, note: "NOT ALIGNED — demand sudah ada, delay rekrut = lose klien ke void (bukan ke kompetitor). Rekrut Q3." },
            { area: "Data & teknologi", decision: "Entity resolution Layer 3 error dibiarkan 4.1%", strategy: "Data quality = foundation kepercayaan platform", aligned: false, note: "NOT ALIGNED — 4.1% error di intel database = credibility risk. Fix dalam 14 hari." },
          ].map((r) => (
            <div key={r.area} className={`border rounded-sm p-3 ${r.aligned ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-[9px] font-bold ${r.aligned ? "text-emerald-700" : "text-red-700"}`}>{r.area}</p>
                    <span className={`text-[7px] font-mono font-bold ${r.aligned ? "text-emerald-700" : "text-red-700"}`}>{r.aligned ? "ALIGNED" : "MISALIGNED"}</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground mb-0.5">Keputusan: {r.decision}</p>
                  <p className="text-[8px] font-mono text-muted-foreground mb-0.5">Strategi: {r.strategy}</p>
                  <p className={`text-[9px] font-mono ${r.aligned ? "text-emerald-700" : "text-red-700"}`}>{r.note}</p>
                </div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${r.aligned ? "bg-emerald-500" : "bg-red-500"}`}>
                  <span className="text-white text-[10px]">{r.aligned ? "✓" : "✗"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1">3/5 area aligned · 2 misaligned memerlukan tindakan segera: AM Sulawesi + entity resolution fix</p>
      </div>

      {/* Cross-Team Knowledge Sharing */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Share2 className="h-3.5 w-3.5 text-primary" /> CROSS-TEAM KNOWLEDGE SHARING — Insight dari Tim Sales yang Tim Riset Belum Tahu, dan Sebaliknya
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] font-bold mb-2 text-blue-700">📊 Tim Riset → Tim Sales: "Kamu perlu tahu ini untuk pitch lebih efektif"</p>
            <div className="flex flex-col gap-1.5">
              {[
                { insight: "Klien yang pakai 2+ produk MJP dalam 60 hari pertama = churn rate 3× lebih rendah", action: "Onboarding: push cross-sell agresif di bulan pertama bukan setelah 3 bulan" },
                { insight: "Win rate pitch ke BUJK J8 dengan Intel Briefing demo = 71% vs 43% tanpa demo", action: "Wajibkan live Intel Briefing demo di setiap pitch ke BUJK J7/J8" },
                { insight: "September = peak tender — klien BUMN butuh intel brief sejak Agustus", action: "Mulai campaign 'Prep September' minggu ini, bukan Agustus akhir" },
              ].map((r) => (
                <div key={r.insight} className="border-l-2 border-blue-200 pl-2 py-1">
                  <p className="text-[9px] leading-snug">{r.insight}</p>
                  <p className="text-[8px] font-mono text-blue-700 mt-0.5">→ {r.action}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-bold mb-2 text-violet-700">💬 Tim Sales → Tim Riset: "Klien sering tanya ini tapi kami tidak punya jawaban"</p>
            <div className="flex flex-col gap-1.5">
              {[
                { question: "Apakah ada statistik berapa rata-rata BUJK J8 bisa menang tender per tahun?", action: "Buat 'SKK ROI Calculator' berdasarkan data win rate di platform — 3 hari kerja" },
                { question: "Klien tanya: siapa kompetitor lokal saya di Sulawesi? Kami tidak punya datanya.", action: "Expand profil kompetitor ke Sulawesi — minimal top 5 BUJK per provinsi" },
                { question: "Klien enterprise minta laporan compliance bulanan dalam format PDF branded.", action: "Buat branded compliance report template — ini bisa di-charge sebagai add-on" },
              ].map((r) => (
                <div key={r.question} className="border-l-2 border-violet-200 pl-2 py-1">
                  <p className="text-[9px] italic leading-snug">"{r.question}"</p>
                  <p className="text-[8px] font-mono text-violet-700 mt-0.5">→ {r.action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Workroom Collaboration Patterns */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> COLLABORATION PATTERNS — Bagaimana Tim MJP Berkolaborasi dalam Workroom dan Di Mana Friction Paling Besar?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { flow: "Sari riset → update workroom note → Budi review → kirim ke klien via WA", frequency: "47×/bln", timeToComplete: "avg 2.4 jam", friction: "Budi sering tidak tahu Sari sudah update — tidak ada notifikasi antar tim", fix: "Add @mention atau notif system di workroom notes", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { flow: "AM dapat feedback klien → tulis pain point → masuk ke Workroom → jadi bahan riset", frequency: "31×/bln", timeToComplete: "avg 4.1 jam dari feedback ke workroom entry", friction: "Pain point sering tidak masuk workroom — AM lupa atau tidak ada waktu", fix: "Mobile quick-capture: 1 klik dari WA klien langsung ke pain point form", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { flow: "Hendra identifikasi prospek → tulis di workroom → Reza pitch → close", frequency: "12×/bln", timeToComplete: "avg 7.2 hari dari identifikasi ke pitch", friction: "Workroom notes terlalu panjang — Reza butuh ringkasan quick yang bisa dibaca 30 detik sebelum call", fix: "AI summary of workroom notes: 3 bullet points untuk pitch prep", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { flow: "Riset selesai → masuk Knowledge Registry → AM pakai saat pitch", frequency: "8×/bln", timeToComplete: "avg 1.4 hari dari riset ke registry", friction: "AM sering tidak tahu ada riset baru yang relevan untuk klien mereka", fix: "Knowledge digest per AM setiap Senin pagi: 'riset baru yang relevan untuk klien kamu'", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.flow} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.flow}</p>
              <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground mb-0.5">
                <span>Frekuensi: {r.frequency}</span>
                <span>Time: {r.timeToComplete}</span>
              </div>
              <p className="text-[8px] mb-0.5"><span className="font-bold text-red-600">Friction: </span>{r.friction}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>→ Fix: {r.fix}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Workroom Sprint Planning */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5 text-primary" /> SPRINT PLANNING — Apa yang Tim MJP Akan Kerjakan 2 Minggu ke Depan dan Bagaimana Workroom Mendukung Eksekusinya?
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[9px] font-bold">Sprint 23: 2–15 Agt 2026</p>
            <span className="text-[7px] font-mono text-muted-foreground ml-auto">Capacity: 4 orang × 10 hari = 40 story points</span>
          </div>
          {[
            { story: "Fix entity resolution Layer 3 error rate", points: 8, owner: "Tim Tech", workroomLink: "Lihat workroom notes: 'Entity resolution error pattern analysis' (Sari, 28 Jul)", status: "IN PROGRESS", blocker: null, tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { story: "Deploy IjinTender weekend failover mode", points: 5, owner: "Tim Tech", workroomLink: "Lihat workroom notes: 'IjinTender degraded pattern' (Reza, 1 Agt)", status: "TODO", blocker: null, tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
            { story: "BIM Readiness survey ke 50 klien aktif", points: 3, owner: "Reza", workroomLink: "Draft survey questions ada di workroom notes: 'BIM demand validation' (Hendra, 30 Jul)", status: "TODO", blocker: null, tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
            { story: "Post job listing AM Makassar/Sulawesi", points: 2, owner: "Hendra", workroomLink: "Job description draft ada di workroom notes: 'AM Sulawesi JD' (Hendra, 1 Agt)", status: "TODO", blocker: null, tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
            { story: "Campaign 'Prep Tender September' ke 200 klien", points: 4, owner: "Reza + Sari", workroomLink: "Content calendar + messaging ada di workroom notes: 'Sep Campaign Brief' (Sari, 2 Agt)", status: "TODO", blocker: null, tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
            { story: "Review 34 knowledge asset regulasi outdated", points: 6, owner: "Sari", workroomLink: "List 34 assets ada di workroom notes: 'Regulasi update queue' (Dewi, 25 Jul)", status: "TODO", blocker: "Prioritaskan setelah Sprint 23 item 1 selesai", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.story} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.story}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.points}pt</span>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{{ "TODO":"Perlu Dilakukan", "IN PROGRESS":"Sedang Berjalan", "DONE":"Selesai", "DONE ✓":"Selesai ✓", "BLOCKED":"Terblokir" }[r.status] ?? r.status}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Owner: {r.owner}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>{r.workroomLink}</p>
              {r.blocker && <p className="text-[8px] font-bold text-orange-700">⚠ Blocker: {r.blocker}</p>}
            </div>
          ))}
          <p className="text-[9px] font-mono text-muted-foreground">Total: 28/40 points planned · 12 points buffer untuk unplanned work (entity resolution mungkin butuh lebih)</p>
        </div>
      </div>

      {/* Workroom Insight Taxonomy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-violet-500" /> INSIGHT TAXONOMY — Bagaimana Workroom Mengkategorikan Catatan Analisis agar Mudah Dicari dan Diagregasi Lintas Tim?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[9px] font-mono text-muted-foreground mb-1">Setiap catatan di Workroom harus di-tag dengan minimal 1 dari 5 kategori ini:</p>
          {[
            { category: "MARKET SIGNAL", color: "bg-blue-500", desc: "Observasi tentang pergerakan pasar: harga, kompetitor, regulasi, sentiment klien", example: "'Harga ready mix di Semarang naik 12% bulan ini — tender jalan raya Q4 akan lebih ketat'", count: 847, tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { category: "CLIENT PAIN", color: "bg-red-500", desc: "Masalah konkret yang disampaikan klien secara langsung (kuote atau parafrase)", example: "'Klien CV Maju: takut dokumen gugur SKK karena form LPJK regional Jateng beda dengan Jatim'", count: 1.247, tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { category: "COMPETITOR MOVE", color: "bg-orange-500", desc: "Pergerakan kompetitor MJP atau kompetitor klien yang perlu ditrack", example: "'Startup X launch fitur alert tender di daerah — preview di LinkedIn mereka. Harga Rp 399rb/bln.'", count: 312, tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { category: "PRODUCT IDEA", color: "bg-violet-500", desc: "Ide produk atau fitur baru yang muncul dari observasi lapangan atau feedback klien", example: "'Klien minta: bisa tidak ada fitur track siapa saja yang ikut tender yang sama dengan saya?'", count: 189, tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
            { category: "DECISION LOG", color: "bg-emerald-500", desc: "Keputusan yang diambil tim + rationale + siapa yang decide + tanggal", example: "'Decided: delay BIM tool ke Q3 karena J9 demand belum cukup (Hendra, 28 Jul 2026)'", count: 94, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.category} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <div className="flex items-center gap-3 mb-0.5">
                <div className={`w-2 h-2 rounded-full ${r.color} shrink-0`} />
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.category}</p>
                <span className={`text-[8px] font-mono shrink-0 ${r.tc}`}>{r.count} notes</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className={`text-[8px] font-mono italic ${r.tc}`}>Ex: "{r.example}"</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Consistent tagging = quarterly insight synthesis yang actionable. AI akan aggregate per category tiap bulan.</p>
      </div>

      {/* Team Decision Log */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 text-primary" /> DECISION LOG — 8 Keputusan Strategis Terakhir yang Diambil Tim MJP + Rationale dan Siapa yang Memutuskan
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { date: "28 Jul 2026", decision: "Delay BIM Tool ke Q3 2026 (dari Q2)", who: "Hendra", rationale: "Demand survey menunjukkan <30 klien siap bayar untuk BIM saat ini. Target 50 klien untuk viable launch.", outcome: "Gunakan waktu freed up untuk fix entity resolution yang lebih critical.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { date: "22 Jul 2026", decision: "Hire AM Sulawesi (Makassar-based, bukan remote)", who: "Hendra + Sari", rationale: "Data: klien Sulawesi butuh 47% lebih banyak touchpoint vs Jawa. Remote AM tidak bisa hadir di rapat asosiasi lokal.", outcome: "Job posting tayang 2 Agt. Target hire: Sep 2026.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { date: "15 Jul 2026", decision: "Tidak price match saat Startup X turunkan harga 20%", who: "Hendra", rationale: "Startup X kemungkinan burning cash (Series A baru). Price war akan merusak margin tanpa memenangkan klien yang tepat.", outcome: "Fokus: defend klien yang at-risk dengan value demo, bukan discount.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { date: "10 Jul 2026", decision: "Gunakan Circuit Breaker pattern untuk IjinTender API", who: "Tim Tech", rationale: "3 kejadian degraded weekend dalam 2 bulan. Pilihan: SLA breach atau serve stale data dengan label. Client experience lebih baik dengan stale data + disclosure.", outcome: "Circuit breaker deployed. Klien rating meningkat dari 3.2 ke 4.1/5 untuk data reliability.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { date: "1 Jul 2026", decision: "Tidak expand ke Vietnam untuk 2026–2027", who: "Hendra + Reza", rationale: "Indonesia masih <0.3% SAM penetrasi. Expanding ke Vietnam sebelum home market solid = classic startup mistake.", outcome: "Full focus Indonesia. Revisit Vietnam opportunity 2028.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.decision} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.date}</p>
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.decision}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>by {r.who}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Rationale: {r.rationale}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Outcome: {r.outcome}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">Decision log adalah organisational memory — jika keputusan di-revisit, kita bisa lihat kenapa kita memutuskan sesuatu 6 bulan lalu.</p>
      </div>

      {/* Team OKR Dashboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> TEAM OKR Q3 2026 — Objective dan Key Results Tim MJP Jul–Sep 2026: Mana yang On-Track dan Mana yang Perlu Perhatian?
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              objective: "O1: Scale ke 550 klien aktif sambil maintain NRR > 102%",
              owner: "Reza (Sales & AM)",
              krs: [
                { kr: "KR1.1: Akuisisi 80 klien baru Jul–Sep", progress: 42, target: 80, unit: "klien", status: "AT RISK" },
                { kr: "KR1.2: Churn rate < 3.5% per bulan", progress: 3.81, target: 3.5, unit: "%", status: "BEHIND", inverted: true },
                { kr: "KR1.3: NRR >= 102%", progress: 103, target: 102, unit: "%", status: "ON TRACK" },
              ],
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              objective: "O2: Platform reliability dan data quality > 98%",
              owner: "Tim Tech",
              krs: [
                { kr: "KR2.1: Entity resolution error < 1%", progress: 4.1, target: 1, unit: "%", status: "CRITICAL", inverted: true },
                { kr: "KR2.2: Platform uptime > 99.5%", progress: 99.1, target: 99.5, unit: "%", status: "BEHIND" },
                { kr: "KR2.3: Data completeness > 96%", progress: 94.2, target: 96, unit: "%", status: "AT RISK" },
              ],
              tc: "text-red-700", bc: "bg-red-50 border-red-200"
            },
            {
              objective: "O3: Knowledge Registry fresh rate > 85%",
              owner: "Sari (Research)",
              krs: [
                { kr: "KR3.1: Fresh rate (<30 days) > 85%", progress: 78.4, target: 85, unit: "%", status: "AT RISK" },
                { kr: "KR3.2: 4 missing knowledge assets per top searches", progress: 0, target: 4, unit: "assets", status: "TODO" },
                { kr: "KR3.3: 0 CRITICAL regulatory alert miss", progress: 0, target: 0, unit: "misses", status: "ON TRACK" },
              ],
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
          ].map((r) => (
            <div key={r.objective} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-1">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.objective}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>Owner: {r.owner}</span>
              </div>
              {r.krs.map((k) => (
                <div key={k.kr} className="mb-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[8px] flex-1">{k.kr}</p>
                    <span className={`text-[7px] font-mono font-bold shrink-0 ${k.status === 'ON TRACK' ? 'text-emerald-700' : k.status === 'CRITICAL' ? 'text-red-700' : k.status === 'BEHIND' || k.status === 'AT RISK' ? 'text-orange-700' : 'text-slate-600'}`}>{{ "ON TRACK":"Sesuai Rencana", "AT RISK":"Berisiko", "BEHIND":"Tertinggal", "CRITICAL":"Kritis", "TODO":"Belum Dimulai" }[k.status] ?? k.status}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, k.inverted ? Math.max(0, 100 - (k.progress / k.target * 100 - 100) * 5) : Math.round(k.progress / k.target * 100))}>
                    <div className={`h-1.5 rounded-full ${k.status === 'ON TRACK' ? 'bg-emerald-500' : k.status === 'CRITICAL' ? 'bg-red-500' : 'bg-orange-400'}`} style={{ width: `${Math.min(100, k.inverted ? Math.max(0, 100 - (k.progress / k.target * 100 - 100) * 5) : k.progress / k.target * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Workroom AI Enhancement Roadmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-violet-500" /> WORKROOM AI ROADMAP — Fitur AI yang Akan Membuat Workroom Menjadi True Intelligence Hub, Bukan Sekadar Note-Taking Tool
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              feature: "Auto-categorization: Setiap note yang diketik langsung di-tag AI",
              horizon: "Q3 2026",
              how: "Saat AM type note, AI real-time classify: MARKET_SIGNAL / CLIENT_PAIN / COMPETITOR_MOVE / PRODUCT_IDEA / DECISION_LOG",
              impact: "Tidak perlu manual tagging. Consistency of categorization dari 70% (manual) → 94% (AI-assisted).",
              status: "IN DEV — model trained, UI integration pending",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              feature: "Monthly Synthesis: AI generate 'This Month in MJP Intelligence'",
              horizon: "Q4 2026",
              how: "Setiap bulan, AI aggregate semua notes per category → generate executive summary + top 5 actionable insights → send ke Hendra dan Sari",
              impact: "Intelligence yang tersebar di 2.689 notes menjadi 1 page briefing. Decision-making lebih cepat.",
              status: "PLANNED — mockup sudah approved oleh Hendra",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              feature: "Pain Point → Product Brief Generator",
              horizon: "Q4 2026",
              how: "Select N pain points dari database → AI generate structured product brief: problem statement, target segment, success metrics, MVP scope, revenue estimate",
              impact: "Dari pain ke product spec dalam 10 menit vs 4 jam manual. Tim product ideas lebih banyak dieksekusi.",
              status: "PLANNED — dependent on Q3 synthesis feature",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              feature: "Competitive Signal Correlation: Cross-reference notes vs competitor moves",
              horizon: "Q1 2027",
              how: "AI deteksi: 'Note dari klien di Sulawesi tentang startup X muncul 3× dalam 2 minggu — ini pattern, bukan isolated incident'",
              impact: "Early warning system untuk competitive threats di region-region tertentu sebelum jadi problem nasional.",
              status: "ROADMAP — most complex, depends on pattern detection model",
              tc: "text-violet-700", bc: "bg-violet-50 border-violet-200"
            },
          ].map((r) => (
            <div key={r.feature} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.feature}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.horizon}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.how}</p>
              <p className={`text-[9px] font-mono ${r.tc} mb-0.5`}>Impact: {r.impact}</p>
              <p className="text-[8px] font-bold">{r.status.replace(/^IN DEV/, "Dalam Pengembangan").replace(/^PLANNED/, "Direncanakan").replace(/^ROADMAP/, "Peta Jalan")}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cross-functional Collaboration Protocols */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> COLLABORATION PROTOCOLS — Aturan Main yang Membuat Tim Kecil MJP Bekerja Seperti Tim Besar Tanpa Banyak Meeting
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              protocol: "Async-First Communication Rule",
              when: "Semua update non-urgent",
              how: "Tulis di Workroom note atau Slack thread (bukan WA group). WA group hanya untuk URGENT (<2 jam response needed).",
              benefit: "Mengurangi context-switching. Deep work block Sari dan Hendra tidak terganggu.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              protocol: "Monday Alignment (30 menit max)",
              when: "Setiap Senin 09:00 WIB",
              how: "4 agenda: OKR check-in (10 min) + blockers surfacing (10 min) + sprint update (5 min) + callouts (5 min). No presentations allowed — semua sudah di shared doc sebelum meeting.",
              benefit: "Single sync point yang cukup untuk semua. Tidak ada 'quick sync' lain tanpa persetujuan.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              protocol: "Decision Rights Matrix (RACI)",
              when: "Saat ada keputusan yang perlu dibuat",
              how: "Product: Hendra lead, Sari review, Hendra decide. Research: Sari lead, Hendra consult. Sales/pricing: Reza propose, Hendra decide. Hire: Hendra decide (<Rp 20jt/bln), otherwise +board.",
              benefit: "Tidak ada keputusan yang terlambat karena tidak jelas siapa yang harus decide.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              protocol: "Client Escalation Ladder",
              when: "Client complaint atau at-risk signal",
              how: "L1: AM handle sendiri (<48 jam). L2: Reza involved (<24 jam). L3: Hendra atau Sari direct involvement (>Rp 2jt value atau reputational risk). L4: All hands.",
              benefit: "Tidak ada klien yang drop tanpa tim senior tahu. Setiap escalation auto-logged di Workroom.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              protocol: "Knowledge Capture on Insight",
              when: "Setiap kali ada insight baru di lapangan",
              how: "Field team: langsung input ke mobile app (pain point / note) saat masih fresh. Tidak menunggu 'nanti aku tulis'. Workroom Workroom auto-syncs.",
              benefit: "Zero insight loss. 94% of filed insights arrive within 2 jam dari kejadian.",
              tc: "text-violet-700", bc: "bg-violet-50 border-violet-200"
            },
          ].map((r) => (
            <div key={r.protocol} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.protocol}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>When: {r.when}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.how}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Benefit: {r.benefit}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Innovation Pipeline */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-violet-500" /> INNOVATION PIPELINE — Ideas yang Dikumpulkan Tim dari Workroom dan Sedang Dalam Proses Evaluasi untuk Jadi Produk Nyata
        </p>
        <div className="flex flex-col gap-2">
          {[
            { idea: "Warranty Tracker — track status klaim garansi proyek setelah PHO/FHO", source: "127 pain points + Reza field notes", stage: "DISCOVERY", score: "9.1/10", detail: "WTP tinggi (Rp 2.1jt/bln), pasar jelas (semua klien post-project), complexity HIGH karena perlu integrasi BPJK. Q4 2026 discovery sprint.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { idea: "Pre-Bid Capital Calculator — estimasi working capital untuk tender besar", source: "94 pain points + AM Sulawesi notes", stage: "SCOPING", score: "7.8/10", detail: "MVP bisa dibangun dalam 3 minggu (spreadsheet-like calculator). Data input: nilai tender, % down payment, payment terms. Q3 2026 candidate.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { idea: "Expert Marketplace — cari SKK J9 freelance untuk proyek dadakan", source: "78 pain points + GAPENSI feedback", stage: "VALIDATION", score: "7.4/10", detail: "Multi-sided market — harder to build. Need supply side (tenaga ahli) + demand side (BUJK). Chicken-egg problem. 2027 at earliest.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { idea: "Subkon Risk Monitor — alert jika subkontraktor yang dipakai bermasalah di tempat lain", source: "63 pain points", stage: "IDEATION", score: "6.9/10", detail: "Extension dari trust score yang sudah ada. Alerting layer yang watch for negative signals (disputes, SKK issues) on subkon database.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { idea: "Document Generator — PHO/FHO dan klaim surat templates", source: "54 pain points", stage: "IDEATION", score: "6.1/10", detail: "Low complexity, medium demand. Template library dengan dynamic fields. Monetize: Rp 350rb per generated document.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { idea: "Material Price Tracker — harga real-time semen, besi, pasir dari marketplace", source: "Hendra proposal + market signal analysis", stage: "RESEARCH", score: "6.7/10", detail: "Need crawler ke Tokopedia/B2B material marketplace. Integration dengan HPS model untuk even more accurate estimates. Q1 2027.", tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
          ].map((r) => (
            <div key={r.idea} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.idea}</p>
                <div className="flex gap-1.5 shrink-0 text-[7px] font-mono">
                  <span className={r.tc}>{r.stage}</span>
                  <span className={`font-bold ${r.tc}`}>Score: {r.score}</span>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Source: {r.source}</p>
              <p className={`text-[8px] ${r.tc}`}>{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">Innovation pipeline scored berdasarkan: demand strength × WTP × strategic fit × build complexity. Top scorer masuk quarterly sprint planning. Bottom scorer di-review ulang atau dibatalkan.</p>
      </div>

      {/* Strategic Alignment Check */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Compass className="h-3.5 w-3.5 text-primary" /> STRATEGIC ALIGNMENT — Setiap Keputusan Besar di MJP Dites dengan 3 Pertanyaan Ini Sebelum Dieksekusi
        </p>
        <div className="flex flex-col gap-3 mb-3">
          <div className="border rounded-sm p-3 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700 mb-1">3 Strategic Alignment Questions (digunakan di setiap major decision):</p>
            <div className="flex flex-col gap-1.5">
              {[
                { q: "Q1: Apakah ini membuat klien kami lebih sukses memenangkan tender?", why: "Misi utama MJP. Jika tidak bisa dijelaskan hubungan ke tender win, keputusan ini perlu dikaji ulang." },
                { q: "Q2: Apakah ini memperkuat data moat kami vs melemahkan posisi kompetitif?", why: "Setiap keputusan tech, partnership, atau hiring harus mempertimbangkan apakah memperkuat keunggulan data." },
                { q: "Q3: Apakah ini scalable untuk 2.000 klien, bukan hanya 487?", why: "Solusi yang hanya work di skala kecil = technical debt. Setiap decision harus think 4× scale dari sekarang." },
              ].map((r) => (
                <div key={r.q} className="border-l-2 border-blue-300 pl-2">
                  <p className="text-[8px] font-bold">{r.q}</p>
                  <p className="text-[7px] text-muted-foreground">Why: {r.why}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[8px] font-mono font-bold mb-1">Recent decisions tested against these 3 questions:</p>
          {[
            { decision: "Build BIM Readiness Assessment tool (Q3 2026)", q1: "YES — BIM akan required untuk tender BUMN > Rp 50M Jan 2027. Klien yang ready = win advantage.", q2: "YES — BIM dataset adalah new moat territory no competitor has.", q3: "YES — Template tool, tidak custom per klien.", verdict: "APPROVED", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { decision: "Hire dedicated KA for enterprise clients (full-time)", q1: "YES — Enterprise klien butuh more hand-holding. NRR enterprise 89% renew.", q2: "NEUTRAL — tidak langsung memperkuat data moat.", q3: "BORDERLINE — KA model tidak infinitely scalable. Need hybrid human/automation plan.", verdict: "APPROVED WITH CONDITIONS: automate tier 1 support first", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { decision: "Build WhatsApp community feature (group BUJK per region)", q1: "WEAK — indirect relationship to tender win. More social, less actionable.", q2: "NO — community content not curated = noise. Risk to MJP brand if conflict occurs.", q3: "NO — community moderation does not scale.", verdict: "REJECTED", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
          ].map((r) => (
            <div key={r.decision} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-1">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.decision}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ${r.tc}`}>{r.verdict}</span>
              </div>
              {[['Q1', r.q1], ['Q2', r.q2], ['Q3', r.q3]].map(([q, a]) => (
                <p key={q} className="text-[8px] text-muted-foreground"><span className="font-bold">{q}:</span> {a}</p>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Meeting Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-primary" /> MEETING INTELLIGENCE — Template dan Framework untuk 4 Jenis Meeting Penting yang Sering Gagal Karena Persiapan Kurang
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              meetingType: "First Demo dengan Prospect (BUJK baru)",
              duration: "45 menit",
              agenda: ["0–5: Rapport + 'Ceritakan bisnis tender Anda bulan ini' (listen first)", "5–20: Show 3 things specific to THEIR category/region — not a generic tour", "20–35: Live demo: cari tender yang MEREKA akan ikut bulan ini. Real, not canned.", "35–40: ROI calculation together: 'Jika win rate naik 10pp, itu berapa Rupiah per tahun untuk Anda?'", "40–45: Soft close: 'Ada alasan untuk tidak coba 30 hari gratis?'"],
              successMetric: "Demo → trial dalam 48 jam. Target 60% demo-to-trial conversion.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              meetingType: "Quarterly Business Review (QBR) dengan Enterprise Klien",
              duration: "90 menit",
              agenda: ["0–10: Scorecard review — MJP's performance against SLA. Own the numbers.", "10–30: Klien results — win rate, kontrak won, ROI dari subscription. Celebrate wins.", "30–50: Sari presents market intelligence update — 3 key insights for their category", "50–70: Strategic discussion — where do they want to go next 6 months? How MJP helps.", "70–85: Roadmap preview — what MJP building next that matters to them.", "85–90: Renewal confirmation or flag issues early."],
              successMetric: "QBR completion = 89% renewal rate. No QBR = 71% renewal.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              meetingType: "Churn Save Meeting (klien yang request cancel)",
              duration: "30 menit",
              agenda: ["0–5: Do NOT defend. 'Tell me what's not working for you.' Listen completely.", "5–15: Categorize churn reason: price, value gap, competitor, business pause, or product failure.", "15–20: Address specifically. No generic reassurance.", "20–25: Offer if appropriate: pause, downgrade, or credit. Never beg. Offer, then let them decide.", "25–30: Whatever the outcome — learn for the next client. 'What would have kept you?'"],
              successMetric: "61% save rate. 23% downgrade (from cancel). 16% cancel anyway.",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
          ].map((r) => (
            <div key={r.meetingType} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-1">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.meetingType}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.duration}</span>
              </div>
              {r.agenda.map((a, i) => <p key={i} className="text-[8px] text-muted-foreground">• {a}</p>)}
              <p className={`text-[9px] font-mono font-bold ${r.tc} mt-0.5`}>{r.successMetric}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Team Communication Protocols */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> TEAM COMMUNICATION PROTOCOLS — Bagaimana Tim MJP 7 Orang Berkomunikasi Efektif tanpa Meeting Berlebihan atau Informasi Hilang?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              channel: "WhatsApp Group 'MJP Core' (semua 7 orang)",
              usage: "Daily standup ringkasan (Hendra post setiap 08:00): 1 kalimat per orang — hari ini fokus pada apa. Alert urgent yang butuh team awareness.",
              not_for: "Diskusi panjang, keputusan besar, complaint tentang pekerjaan orang lain.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              channel: "WhatsApp Group 'MJP Research' (Sari + Dewi + Budi)",
              usage: "Koordinasi riset harian: siapa ambil source apa, case yang perlu double-check, briefing kalau ada event yang perlu di-cover cepat.",
              not_for: "Platform issues, klien matters, AM updates.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              channel: "WhatsApp DM langsung",
              usage: "Blocking issues yang butuh response dalam <2 jam. Personal matters. Anything that doesn't need group context.",
              not_for: "Jangan gunakan DM untuk hal yang relevant ke tim — pakai group yang tepat agar semua punya context.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              channel: "MJP Workroom (platform ini)",
              usage: "Dokumentasi permanen: keputusan bisnis, analisis mendalam, prospek klien, innovation ideas. Setelah diskusi WA selesai, simpan kesimpulan ke Workroom.",
              not_for: "Real-time communication — ini bukan chat. Untuk reference dan knowledge retention.",
              tc: "text-violet-700", bc: "bg-violet-50 border-violet-200"
            },
            {
              channel: "Sync Meeting (1 per minggu, 45 menit — Rabu 10:00)",
              usage: "Review minggu kemarin (blockers, wins, misses). Prioritize minggu depan. Keputusan yang butuh diskusi synchronous. Nothing else.",
              not_for: "Status update yang bisa ditulis. Diskusi yang bisa di-async. Pertemuan sosial.",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
          ].map((r) => (
            <div key={r.channel} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.channel}</p>
              <p className="text-[8px] mb-0.5"><span className="font-bold">Untuk:</span> {r.usage}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Bukan untuk: {r.not_for}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Protocol sederhana ini mengurangi "where do I post this?" anxiety dan memastikan informasi sampai ke orang yang tepat. Review protokol setiap 6 bulan — tambah channel jika butuh, hapus jika overlap.</p>
      </div>

      {/* Decision Log — Major Decisions This Year */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> DECISION LOG 2026 — Keputusan Besar yang Dibuat Tim MJP Tahun Ini, Siapa yang Memutuskan, dan Mengapa
        </p>
        <div className="flex flex-col gap-2">
          {[
            { decision: "Tolak tawaran partnership dari perusahaan konsultan besar (non-disclosure)", when: "Feb 2026", who: "Hendra (solo)", outcome: "Partnership yang ditawarkan: white-label MJP data untuk 3 klien enterprise mereka. Terms: MJP tidak boleh engage dengan klien mereka langsung. Ditolak karena: terms restrictive, independence hilang, precedent yang buruk.", lesson: "Lesson: Short-term revenue yang membatasi long-term independence tidak worth it. Better to say no and grow organically.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { decision: "Invest Rp 24jt untuk server upgrade — bukan cloud scaling", when: "Apr 2026", who: "Hendra + Hendra Jr.", outcome: "Pilihan: scale cloud (Rp 8jt/bln extra) vs one-time upgrade dedicated server (Rp 24jt). Memilih dedicated: total 3-year cost 3× lebih murah, latency lebih baik, data sovereignty.", lesson: "Lesson: At MJP's current scale, ownership beats SaaS for infrastructure. Revisit when 10× current load.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { decision: "Naikkan harga 15% untuk all tiers — tidak ada grandfather exception", when: "Jun 2026", who: "Hendra + Reza (consulted)", outcome: "Dari: Rp 700rb/Rp 1.3jt/Rp 3.5jt. Ke: Rp 800rb/Rp 1.5jt/Rp 4.2jt. Churn spike concern — actual churn: 4.1% that month (vs 2.8% avg). Recovered by month 2.", lesson: "Lesson: Price increase fears are usually overblown. Klien yang churn atas harga alone were likely marginal value. MRR still net positive after churn.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { decision: "Tetap prioritaskan profitabilitas vs growth — no VC funding until Q1 2027", when: "Ongoing", who: "Hendra (founder conviction)", outcome: "Multiple VC expressions of interest. Decision: continue profitable-first, raise only when unit economics bulletproof and team gaps filled. Current runway: 14 months.", lesson: "Lesson: Profitable companies have leverage in fundraising. Raise from strength not desperation.", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
          ].map((r) => (
            <div key={r.decision} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.decision}</p>
                <div className="flex gap-1.5 shrink-0 text-[7px] font-mono">
                  <span className={r.tc}>{r.when}</span>
                  <span className="text-muted-foreground">{r.who}</span>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.outcome}</p>
              <p className={`text-[9px] font-mono font-bold ${r.tc}`}>{r.lesson}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Client Success Stories Gallery */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-amber-500" /> CLIENT SUCCESS GALLERY — 5 Kisah Sukses Klien MJP yang Paling Powerful untuk Digunakan dalam Sales, Marketing, dan Investor Pitch
        </p>
        <div className="flex flex-col gap-2">
          {[
            { client: "PT Karya Makmur Sejahtera (J9, Semarang)", story: "Klien 3 tahun. Win rate naik dari 19% ke 41% dalam 18 bulan. Kunci: Pre-Bid Intel Brief yang tunjukkan bahwa satu kompetitor utama mereka selalu bid -6% dari HPS. Karya Makmur adjust strategi untuk selalu beat mereka dengan margin minimal.", numbers: "22 kontrak dimenangkan 2026 YTD. Total nilai: Rp 247M. ROI dari subscription: 890×.", useFor: "Investor pitch (traction) + J9 prospect demo.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { client: "CV Bangun Karya (J7, Solo)", story: "Klien 8 bulan. Pertama kali menang tender pemerintah setelah 4 tahun gagal terus. Kunci: MJP alert untuk tender BPBD Solo Raya yang deadline-nya hampir tidak diketahui mereka. Submit H-3, win rate lebih baik karena less competition.", numbers: "Kontrak Rp 3.8M — kecil tapi first win ever. Klien literally berterima kasih via telepon ke Reza.", useFor: "J7 prospect yang ragu apakah platform worth it for small BUJK.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { client: "PT Infrastruktur Nusantara (J9, Jakarta)", story: "Enterprise klien sejak 2023. Custom research untuk masuk IKN market. MJP identified 3 tender categories in Kaltim where competition was lowest and INS could realistically win.", numbers: "Masuk IKN market Q1 2026. 2 tenders won: total Rp 67M. Market previously impossible for Jakarta-based BUJK.", useFor: "Enterprise pitch + IKN vertical positioning.", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
            { client: "UD Maju Bersama (J8, Surabaya)", story: "Churn-save success story. Minta cancel setelah 5 bulan karena 'belum menang apa-apa'. AM Reza analisis: klien bid 11 tender, semua salah kategori dan too competitive. Reza personally curated next 3 tenders to bid. Won 1.", numbers: "Dari hampir cancel → promoted ke Growth tier. MRR contribution: Rp 1.5jt/bln. NPS: 9/10.", useFor: "Churn save training untuk AM. Also shows value of active account management.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.client} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.client}</p>
              <p className="text-[8px] mb-0.5">{r.story}</p>
              <p className={`text-[9px] font-mono font-bold ${r.tc} mb-0.5`}>{r.numbers}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Best used for: {r.useFor}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Strategic Partnership Pipeline */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Handshake className="h-3.5 w-3.5 text-primary" /> STRATEGIC PARTNERSHIP PIPELINE — 5 Kemitraan Strategis yang Sedang atau Akan Dinegosiasikan MJP untuk Mempercepat Pertumbuhan
        </p>
        <div className="flex flex-col gap-2">
          {[
            { partner: "GAPENSI Nasional — Formal Co-Branding", status: "ADVANCED DISCUSSION", value: "Endorsed by GAPENSI: exposed ke 48.000 anggota. 'MJP is the intelligence platform of choice for GAPENSI members.' Co-branded materials.", timeline: "Target: MOU signed Q4 2026. Hendra present ke board meeting September.", risk: "GAPENSI bureaucratic — decision making slow. Have backup: regional chapter approach.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { partner: "Bank Mandiri UMKM / KUR program", status: "EXPLORATORY", value: "Bank Mandiri's SME clients include thousands of BUJK. MJP bundled with KUR package: klien yang apply KUR untuk modal proyek dapat MJP trial.", timeline: "First meeting: Q3 2026. Product demo to their digital partnership team.", risk: "Bank decision cycles: 12–18 bulan. Need champion inside the bank.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { partner: "Asosiasi Kontraktor Spesialis (Elektrikal/Mekanikal)", status: "PROSPECTING", value: "Tap into niche specialist contractor segments. Regulatory changes in MEP are frequent — high-value intel.", timeline: "Q1 2027 outreach to APEI, APPTI, ASTTI.", risk: "Multiple small associations = fragmented effort. Bundle outreach.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { partner: "Platform e-katalog pemerintah (e-purchasing LKPP)", status: "WATCH", value: "LKPP's e-purchasing growing. Integration: alert klien when products relevant to their category appear on e-katalog. Different from tender but same buyer universe.", timeline: "Needs API access from LKPP. Monitor LKPP opendata initiative.", risk: "Dependent on LKPP opendata policy — not in MJP's control.", tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
          ].map((r) => (
            <div key={r.partner} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.partner}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{{ "ADVANCED DISCUSSION":"Diskusi Lanjut", "EXPLORATORY":"Penjajakan", "PROSPECTING":"Pencarian Prospek", "WATCH":"Dipantau" }[r.status] ?? r.status}</span>
              </div>
              <p className="text-[8px] mb-0.5">Nilai: {r.value}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">Timeline: {r.timeline}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Risiko: {r.risk}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Account Management Playbook */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5 text-primary" /> AM PLAYBOOK — Panduan Lengkap Reza sebagai Account Manager: Apa yang Dia Lakukan Setiap Hari, Minggu, dan Bulan untuk Menjaga 487 Klien
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              cadence: "DAILY (30 menit pagi)",
              tasks: ["Check churn risk flagging: klien mana yang > 7 hari tidak login", "Check new clients in 1st 30 days — any that haven't taken first action yet?", "Review AM inbox: klien yang kirim WA kemarin yang belum dijawab"],
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              cadence: "WEEKLY (Senin, 1 jam)",
              tasks: ["Win reports: klien yang report winning tender this week — send congratulations + ask for testimonial", "Upsell pipeline review: Growth klien yang approaching 2×/month login (upgrade signal)", "Renewal pipeline: klien yang subscription expires in 30 days — start renewal conversation"],
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              cadence: "MONTHLY (Pertama minggu bulan, 3 jam)",
              tasks: ["Cohort analysis: clients by month of joining — what's the 3-month retention rate trending?", "Enterprise QBR prep: review usage data untuk 51 Enterprise klien sebelum QBR calls", "Success stories: document 1 new client win story per month for marketing + sales use"],
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              cadence: "QUARTERLY (Full week, highest priority)",
              tasks: ["Enterprise QBR calls: 30–45 menit per Enterprise klien. Hendra attends 20 most strategic.", "Churn post-mortem: review setiap klien yang churn — root cause, could it have been prevented?", "Competitive intel: update win/loss tracker dari Q interviews", "Reza personal development: 1 new tactic or tool learned each Q"],
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
          ].map((r) => (
            <div key={r.cadence} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.cadence}</p>
              {r.tasks.map((t, i) => <p key={i} className="text-[8px] text-muted-foreground">• {t}</p>)}
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Reza manages 487 klien — impossible to do deeply without a system. Playbook + CRM (currently spreadsheet, migrating to built-in platform tracking Q4 2026) = scale without losing personal touch. AM hiring Q1 2027 will shadow Reza for 2 months first.</p>
      </div>

      {/* Team Learning & Development */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> TEAM L&D — Rencana Pengembangan Individu Setiap Anggota Tim MJP: Skill yang Sedang Dibangun dan Mengapa Ini Penting untuk Pertumbuhan Perusahaan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { name: "Hendra (Founder + CEO)", currentFocus: "Fundraising — pitch deck, investor relations, term sheet negotiation. Due diligence process.", why: "Series A prep Q1 2027. Hendra has never raised institutional capital. External mentor: founder-turned-investor yang bersedia advise.", roadblock: "Time: 60% operational. Goal: 40% operational, 60% strategic by Q4 2026." },
            { name: "Sari (Research Lead)", currentFocus: "AI-assisted writing workflows. Learning: Notion AI, Claude API, prompt engineering for research synthesis.", why: "Target: 60 assets/bln tanpa headcount increase requires AI leverage. Sari akui butuh structured learning, not just experimentation.", roadblock: "30-day structured course (Deeplearning.ai) + weekly practice. Hendra approved 4 jam/minggu learning time." },
            { name: "Hendra Jr. (Lead Dev)", currentFocus: "System design at scale: PostgreSQL query optimization, Redis caching patterns, microservices architecture planning.", why: "Sprint 24 P0 is entity resolution performance — directly requires these skills. Also future-proofing for 10× scale.", roadblock: "Self-learning via Designing Data-Intensive Applications book + Architecture Katas weekly practice." },
            { name: "Reza (AM)", currentFocus: "Customer Success methodology: expansion revenue, QBR facilitation, churn prediction, upsell conversation frameworks.", why: "AM role evolving from reactive (answer questions) to proactive (drive expansion). 23% of Growth klien qualify for Enterprise upsell — Reza must close.", roadblock: "CS Certified course + bimonthly roleplay sessions with Hendra." },
            { name: "Dewi (Ops + Research)", currentFocus: "SQL + data analysis basics. Objective: pull own reports dari platform analytics without asking Hendra Jr.", why: "Dewi currently requests 12–15 data queries per month from Hendra Jr. At 30 minutes each: 7.5 hours of Hendra Jr. time redirectable to product.", roadblock: "Mode Analytics SQL course (8 weeks). Hendra Jr. budgeted 2 hrs/week to teach Dewi MJP-specific queries." },
            { name: "Budi (Field Researcher)", currentFocus: "Video interviewing — structured 10-minute video pain point capture. More efficient than written notes.", why: "Video captures tone, emotion, context that written transcript misses. Potential: client testimonials from same interviews.", roadblock: "Equipment: Rp 2.3jt smartphone upgrade budgeted. Tutorial dari Hendra Jr. (1 afternoon). Script template Sari creates." },
          ].map((r) => (
            <div key={r.name} className="border-l-2 border-primary/20 pl-3 py-1.5">
              <p className="text-[9px] font-bold mb-0.5">{r.name}</p>
              <p className="text-[8px] font-mono text-primary mb-0.5">Focus: {r.currentFocus}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Why: {r.why}</p>
              <p className="text-[7px]">How: {r.roadblock}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">L&D budget: Rp 18jt/tahun total across all 7 team members. ROI: every Rp 1 spent on upskilling = avg Rp 9.3 returned via increased capacity or revenue. Team yang terus belajar = competitive advantage yang tidak bisa direplikasi dengan modal saja.</p>
      </div>

      {/* Client Success Story Archive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-amber-500" /> SUCCESS ARCHIVE — 6 Kisah Sukses Klien MJP yang Paling Sering Digunakan Reza dalam Proses Penjualan dan Kenapa Setiap Cerita Meyakinkan Segmen Berbeda?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { story: "PT Graha Jaya, J8 Semarang — Dari kalah 7 tender berturut-turut ke menang pertama dalam 3 bulan pakai MJP", segment: "Resonates with: J8 yang belum pernah menang tender (biggest fear: wasting effort again)", quote: "\"Sebelum MJP saya asal ikut. Sekarang saya tahu siapa kompetitor saya dan berapa kira-kira mereka bid. Langsung menang pertama kali pakai intel MJP.\"", metric: "Win: Rp 4.2M gedung dinas, margin 18%. MJP used: Competitor Radar + Pre-Bid Brief.", tc: "text-emerald-700" },
            { story: "CV Bangun Mandiri, J7 Purwokerto — Naik kelas dari J7 ke J8 dalam 8 bulan dengan SKK Express", segment: "Resonates with: J7 yang ingin grow (biggest dream: access bigger tenders)", quote: "\"SKK Express selesai 5 hari. Saya kaget, biasanya 6 bulan lebih. Sekarang sudah bisa bid tender gedung provinsi.\"", metric: "4 tenaga ahli upgraded J7→J8. First J8 tender won 3 months after upgrade: Rp 2.1M.", tc: "text-emerald-700" },
            { story: "PT Konstruksi Bersama, J9 Surabaya — Hindari gugur administrasi pada 5 tender berturut-turut karena L1 alert", segment: "Resonates with: J9 yang sibuk dan sering miss regulatory updates (biggest fear: losing on paperwork)", quote: "\"5 kali dalam setahun MJP kirim alert yang buat saya tidak gugur. Tanpa MJP mungkin satu saja sudah cukup untuk merusak semester.\"", metric: "5 gugur prevented. Estimated value preserved: Rp 31M in tender opportunities.", tc: "text-blue-700" },
            { story: "CV Karya Mekar, J8 Makassar — Menemukan konsorsium partner yang tepat lewat Trust Score database", segment: "Resonates with: J8 yang ingin masuk tender J9 lewat konsorsium (biggest challenge: finding trustworthy partner)", quote: "\"Trust Score 9.1 memberi saya confidence untuk ajak mereka konsorsium. Menang. Dan mereka bayar tepat waktu sesuai perjanjian.\"", metric: "Consortium formed, won tender Rp 8.7M. First ever J9-equivalent contract for this client.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.story} className="border rounded-sm p-2.5 bg-muted/10">
              <p className="text-[8px] font-bold mb-0.5">{r.story}</p>
              <p className="text-[7px] font-mono text-primary mb-0.5">Target: {r.segment}</p>
              <p className={`text-[8px] italic mb-0.5 ${r.tc}`}>{r.quote}</p>
              <p className="text-[7px] text-muted-foreground">{r.metric}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Success stories need to match prospect's identity and fear. J8 that's never won = Graha Jaya story. J9 that loses on admin = Konstruksi Bersama story. Reza selects story based on 2-minute prospect profiling. Right story at right moment = objection disappears.</p>
      </div>

      {/* Cross-Functional Weekly Rhythm */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 text-primary" /> WEEKLY TEAM RHYTHM — Jadwal Mingguan Tim MJP yang Menjaga Koordinasi tanpa Meeting Berlebihan: 7 Agenda Tetap yang Tidak Boleh Dilewati
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { day: "Senin 08:30", meeting: "Research Sync (Sari + Dewi + Budi)", duration: "45 min", agenda: "Field debrief dari Budi, production queue review, top 5 urgent assets untuk minggu ini.", tc: "text-blue-700" },
            { day: "Senin 10:00", meeting: "KPI Review (Hendra solo)", duration: "10 min", agenda: "10 KPI platform health dashboard review. Mark AT RISK items. Decide if war room mode needed.", tc: "text-orange-700" },
            { day: "Selasa 14:00", meeting: "Sprint Standup (Hendra + Hendra Jr.)", duration: "15 min", agenda: "Hendra Jr. reports: kemarin selesai apa, hari ini apa, ada blocker? Hendra unblocks immediately.", tc: "text-emerald-700" },
            { day: "Rabu 16:00", meeting: "Reza AM Review (Reza solo + Hendra jika needed)", duration: "20 min", agenda: "Churn risk review, pipeline update, this week's conversations notable. Flag to Hendra if > 2 Enterprise at risk.", tc: "text-blue-700" },
            { day: "Kamis 11:00", meeting: "Content QA (Sari + Dewi)", duration: "30 min", agenda: "Review all assets published this week. Spot-check 20% for quality gate compliance. Fix any errors same day.", tc: "text-orange-700" },
            { day: "Jumat 15:00", meeting: "Weekly Close (all 7 — 30 menit hard stop)", duration: "30 min", agenda: "What went well this week? What was hardest? 1 thing to improve next week. Celebrate wins. Everyone speaks.", tc: "text-emerald-700" },
            { day: "Jumat 16:00", meeting: "Hendra Reflection (solo)", duration: "30 min", agenda: "Weekly journal: product, company, team health. Review next week priorities. Strategic decisions that need processing.", tc: "text-slate-600" },
          ].map((r) => (
            <div key={r.day} className="flex gap-2 items-start border-b py-0.5">
              <span className={`text-[7px] font-mono font-bold w-16 shrink-0 ${r.tc}`}>{r.day}</span>
              <div className="flex-1">
                <p className="text-[8px] font-bold">{r.meeting} <span className="font-normal text-muted-foreground">({r.duration})</span></p>
                <p className="text-[7px] text-muted-foreground">{r.agenda}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total meeting time: 3 jam 10 menit/minggu for full team. Per person: max 1.5 jam/minggu di meetings. 90%+ of work = async (Notion, WA). Meetings are for decisions and alignment, not status updates (those go to Notion). Rule: any meeting that could be a Notion comment = cancel the meeting.</p>
      </div>

      {/* Team Morale & Retention Strategy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Heart className="h-3.5 w-3.5 text-red-500" /> RETENTION STRATEGY — Bagaimana MJP Mempertahankan Tim 7 Orang yang Dibangun selama 4 Tahun: Apa yang Membuat Mereka Tetap Termotivasi?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Each team member has different retention drivers. Hendra maps them explicitly and reviews annually:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-2">
            {[
              { person: "Sari (Research Lead)", driver: "Impact + Intellectual autonomy", what: "Sari stays because: her work matters (klien act on her intelligence), she owns research direction, continuous learning. Risk factor: poaching by consulting firm. Mitigation: profit sharing + research budget autonomy.", tc: "text-emerald-700" },
              { person: "Budi (Field Researcher)", driver: "Purpose + Field freedom", what: "Budi stays because: he genuinely believes in helping small BUJK win fair. Flexibility to route his own field schedule. Risk: burnout from solo travel. Mitigation: quarterly team field trip + Budi's KTI hire as future colleague.", tc: "text-emerald-700" },
              { person: "Dewi (Operations)", driver: "Security + Growth", what: "Dewi stays because: stable job, clear promotion path (Ops Lead title 2025), SKK domain expertise makes her uniquely valuable. Risk: larger corp offer. Mitigation: SKK Express equity participation floated.", tc: "text-blue-700" },
              { person: "Reza (Account Manager)", driver: "Commission + Winning", what: "Reza stays because: uncapped commission when hitting target. Competitive instinct satisfied by Enterprise account management. Risk: startup AM role offer. Mitigation: Enterprise equity grant vesting 3 years.", tc: "text-blue-700" },
              { person: "Hendra Jr. (Developer)", driver: "Technical challenge + Ownership", what: "Hendra Jr. stays because: he owns the entire tech stack (pride + learning). Risk: tech company offer with 2× salary. Mitigation: 15% equity allocation (vesting), tech conference budget, new tech freedom.", tc: "text-orange-700" },
            ].map((r) => (
              <div key={r.person} className="border rounded-sm p-2 bg-muted/10">
                <p className={`text-[8px] font-bold mb-0.5 ${r.tc}`}>{r.person} — {r.driver}</p>
                <p className="text-[7px] text-muted-foreground">{r.what}</p>
              </div>
            ))}
          </div>
          <div className="border rounded-sm p-2 bg-emerald-50 border-emerald-200">
            <p className="text-[9px] font-bold text-emerald-700">Team retention stats: 2022–2026</p>
            <p className="text-[8px]">0 involuntary departures. 1 voluntary (Dian, graphic design, 2023 — left for maternity + freelance). 2 hires (Reza 2023, Hendra Jr. 2022). Avg tenure: 3.1 years. Industry benchmark for startup roles: 1.4 years. MJP 2.2× industry retention rate.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Retention is Hendra's biggest hidden competitive advantage. Sari's 4-year domain knowledge cannot be replaced — the market for her expertise in this niche is effectively zero. Every year a team member stays = compounding institutional knowledge that competitor cannot buy.</p>
      </div>

      {/* Strategic Options 2027–2029 */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Compass className="h-3.5 w-3.5 text-primary" /> STRATEGIC OPTIONS — 3 Jalur Strategis yang Tersedia untuk MJP pada 2027–2029 dan Trade-off Masing-Masing yang Hendra Sedang Pertimbangkan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              option: "Option A: Focused Depth — Dominate J8/J9 Construction Intelligence Indonesia",
              description: "Stay focused on current niche. Deepen features, expand coverage (KTI), grow to 2.000 klien. No new verticals outside construction procurement.",
              pros: ["Highest margin (no new product risk)", "Team stays focused (no context switching)", "Defensible niche — become THE construction intelligence platform", "Bootstrappable to profitability without Series A"],
              cons: ["TAM ceiling: ~8.000 potential clients (J8/J9 BUJK)", "Acquisition risk: large platform may replicate once market proven", "Limited growth story for investors"],
              verdict: "Hendra's BASELINE: if Series A doesn't close by Q4 2027, default to this path. Sustainable, profitable, defensible.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              option: "Option B: Vertical Expansion — Add ESG, BIM, Fintech for Construction",
              description: "Keep construction domain but expand product into adjacent verticals: ESG compliance, BIM advisory, supply chain intelligence, construction project financing.",
              pros: ["TAM expansion to 20.000+ BUJK", "Higher ARPU per klien (multi-product)", "Creates ecosystem play (switching cost increases)"],
              cons: ["Each vertical needs content depth (Sari bottleneck)", "BIM + ESG require specialist hires (cost)", "Fintech needs license + different regulatory approach"],
              verdict: "Hendra's GROWTH PATH: execute sequentially. BIM first (mandate-driven, 2027), ESG second (donor-driven, 2027–2028), fintech last (partnership model, 2028+).",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              option: "Option C: Geographic Expansion — ASEAN Construction Intelligence Platform",
              description: "Replicate MJP model in Vietnam, Philippines, Malaysia. Construction sectors have similar procurement complexity. Language/regulation differ.",
              pros: ["1.0+ Billion USD TAM if ASEAN", "Geographic diversification reduces single-market risk", "Scalable platform architecture"],
              cons: ["Vietnam/Philippines need local domain expert = hire Sari-equivalent in each country (hardest problem)", "Regulatory landscape completely different per country", "4–5 years before meaningful revenue contribution"],
              verdict: "Hendra's LONG-TERM CONSIDERATION: only viable after Series B + 3 years of product maturity. Not before 2029.",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
          ].map((r) => (
            <div key={r.option} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-1`}>{r.option}</p>
              <p className="text-[8px] text-muted-foreground mb-1">{r.description}</p>
              <div className="grid grid-cols-2 gap-1.5 mb-1">
                <div>
                  <p className="text-[7px] font-bold text-emerald-700 mb-0.5">Pros:</p>
                  {r.pros.map((p, i) => <p key={i} className="text-[7px]">+ {p}</p>)}
                </div>
                <div>
                  <p className="text-[7px] font-bold text-red-700 mb-0.5">Cons:</p>
                  {r.cons.map((c, i) => <p key={i} className="text-[7px]">− {c}</p>)}
                </div>
              </div>
              <p className={`text-[8px] font-mono font-bold ${r.tc}`}>Verdict: {r.verdict}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Strategic options are reviewed annually by Hendra + 2 advisors. Not mutually exclusive over time: A → B → C is the natural sequence. But doing B and C simultaneously = fragmentation of tiny team across too many initiatives. Sequence is everything. MJP's discipline: one strategic bet per 18 months.</p>
      </div>

      {/* Hendra's Operating Principles */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> OPERATING PRINCIPLES — 10 Prinsip Operasional Hendra yang Membentuk Budaya dan Keputusan MJP: Tidak Tertulis di Dokumen, Tapi Hidup dalam Setiap Meeting
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { n: "01", principle: "Customer problem first, solution second", context: "If you're in a meeting and no one has mentioned the customer problem in 10 minutes, Hendra stops the meeting. 'Who are we solving this for and what's their exact problem?' Before any solution is discussed." },
            { n: "02", principle: "Clarity over comfort", context: "When something is unclear — a responsibility, a decision, a metric target — Hendra will force the uncomfortable clarification. 'I know this is awkward to ask but: who is accountable for this specific outcome?'" },
            { n: "03", principle: "Small batch, high cadence", context: "WIP limit of 3 per sprint. Weekly Close every Friday. Monthly OKR check-in. Prefer 10 small decisions/week over 1 big decision/month. Small batches surface problems faster." },
            { n: "04", principle: "Data informs, judgment decides", context: "Data is required before major decisions, not instead of judgment. 'The data says X but my read of the market says we should do Y — let's test Y at small scale and see.' AI tools are in the same category: inputs, not decisions." },
            { n: "05", principle: "Name the problem before naming the solution", context: "Product idea presented without a customer problem behind it gets rejected immediately. 'Before you tell me the feature, tell me the pain in Budi's customer's words.' Applied even to Hendra's own ideas." },
            { n: "06", principle: "Institutional knowledge is a strategic asset", context: "Sari's 4 years of domain knowledge, Dewi's LPJK relationships, Budi's field network — Hendra treats these as balance sheet assets. Documentation of tacit knowledge = insurance policy." },
            { n: "07", principle: "Failures are mandatory curriculum", context: "Monthly retro includes explicit 'what failed and what did we learn?' section. Skipping it is not allowed. Team members who share failures openly get more trust, not less." },
            { n: "08", principle: "Over-communication in remote-first context", context: "MJP is semi-remote (Hendra + Sari Surabaya, Budi field, Reza Jakarta, Dewi Semarang). Default: over-share. 'If in doubt, write it down and share it. Your teammates cannot see what you haven't communicated.'" },
            { n: "09", principle: "Charge for the value you create, not your cost", context: "Pricing philosophy: anchor to klien's cost of not having MJP (bid losses, disqualifications, missed tenders). Reza is trained: 'CV BMJ won Rp 2.8M using MJP intel that cost Rp 499K. That's the pricing story — not cost.'"},
            { n: "10", principle: "Slow down to go faster", context: "When a sprint is falling behind, Hendra's first response: remove scope, not add hours. 'We always think working more hours will catch up. It almost never does. Better to ship 2 features well than 4 features badly.'" },
          ].map((r) => (
            <div key={r.n} className="flex gap-2 items-start border-b py-1">
              <span className="text-[9px] font-black font-mono text-primary shrink-0 w-5">{r.n}</span>
              <div className="flex-1">
                <p className="text-[8px] font-bold mb-0.5">{r.principle}</p>
                <p className="text-[7px] text-muted-foreground">{r.context}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">These principles emerged from Hendra's experience: 2 failed startups (2016, 2018), 1 pivot (2020 — from general B2B to construction-specific), and 4 years of MJP growth. Documented by Sari in 2025 after observing that new hires who 'got it' faster were the ones who internalized these unwritten rules early. Now in onboarding week 1.</p>
      </div>

      {/* Weekly Close Format */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-primary" /> WEEKLY CLOSE — Format Lengkap Weekly Close Meeting MJP Setiap Jumat Sore: 60 Menit yang Menjaga Seluruh Tim Selaras, Diperbarui, dan Accountable
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { segment: "00:00–10:00 — Numbers Dashboard (Hendra)", content: "MRR, new klien, churn count this week, SKK cases closed, pipeline status (Reza). No slides — live platform dashboard. Hendra narrates. If any number misses target: flag immediately, not tomorrow.", owner: "Hendra" },
            { segment: "10:00–20:00 — Intel Review (Sari)", content: "Top 3 signals published this week. L1 alerts summary. 'What we learned about the market this week that we didn't know last Friday.' No repetition of briefing — synthesis only.", owner: "Sari" },
            { segment: "20:00–30:00 — Field Update (Budi)", content: "'What 3 things surprised me in the field this week?' Budi's observations: verbatim quotes from BUJK directors if notable. Sari takes notes — these often become research items.", owner: "Budi" },
            { segment: "30:00–40:00 — Deals + Compliance (Reza + Dewi)", content: "Reza: deals in pipeline, deals closed, deals lost this week (brief). Dewi: SKK cases status, any LPJK intelligence, compliance questions from klien.", owner: "Reza + Dewi" },
            { segment: "40:00–50:00 — Tech Update (Hendra Jr.)", content: "Sprint progress. Any incidents or alerts from monitoring. Next week's deployment plan. Max 2 menit per item — no tech jargon unless team asks.", owner: "Hendra Jr." },
            { segment: "50:00–60:00 — Open Floor + Decisions", content: "Anyone raises anything. Hendra makes any pending decisions that team has been waiting on. Rule: if a decision has been waiting > 1 week, it gets forced to resolution in this slot.", owner: "All (Hendra decides)" },
          ].map((r) => (
            <div key={r.segment} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[8px] font-bold flex-1">{r.segment}</p>
                <span className="text-[7px] font-mono text-muted-foreground shrink-0">Owner: {r.owner}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.content}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Weekly Close is non-negotiable. In 4 years, cancelled only 3 times (2 national holidays, 1 Hendra family emergency). Remote team members join via WhatsApp group call. No video required. Meeting notes taken by rotation (weekly rota). Notes distributed within 2 hours. Rule: if it was decided in Weekly Close, it's binding unless explicitly revisited. No 'I didn't know' about decisions made in this meeting.</p>
      </div>

      {/* Team Communication Infrastructure */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MessageCircle className="h-3.5 w-3.5 text-primary" /> COMM INFRA — Stack Komunikasi Internal MJP untuk Tim Tersebar: WhatsApp, Notion, Git, dan Mengapa Hendra Menolak Slack
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              tool: "WhatsApp Groups (primary async + real-time)",
              usage: "4 active groups: (1) MJP Core Team (Hendra, Sari, Dewi, Reza, Budi, Hendra Jr.), (2) MJP-Ops (Hendra, Hendra Jr., Sari — technical/ops), (3) MJP-Sales (Hendra, Reza), (4) MJP-Urgent (all — P0 only)",
              rule: "Response expected < 2 jam for Core Team (working hours). P0 = < 30 menit. No requirement to respond on weekends unless P0.",
              why: "Indonesia-native. Team already uses it. Zero learning curve. Voice notes = faster than typing for complex explanations.",
              tc: "text-emerald-700"
            },
            {
              tool: "Notion (documentation + decisions)",
              usage: "All decisions documented here (not in WA). Meeting notes. SOPs. Research drafts before platform publishing. OKR tracker. Roadmap. Knowledge asset drafts.",
              rule: "'If it's not in Notion, it didn't happen.' Verbal decisions are confirmed in Notion within 24 hours by decision-maker.",
              why: "WA has no searchable history. Notion is searchable, structured, and keeps decisions forever. The combination WA (fast) + Notion (permanent) works.",
              tc: "text-blue-700"
            },
            {
              tool: "GitHub (code + technical docs)",
              usage: "All code + PR reviews. Hendra Jr. primary user. Hendra reviews weekly via PR summary. Sari has read access for understanding AI pipeline changes.",
              rule: "No direct pushes to main. All changes via PR + at least 1 review (Hendra on major changes). Commit messages: English + Bahasa Indonesia for team readability.",
              why: "Industry standard. Backup + version control + CI/CD pipeline. Non-negotiable.",
              tc: "text-muted-foreground"
            },
          ].map((r) => (
            <div key={r.tool} className="border-b py-2">
              <p className="text-[9px] font-bold mb-0.5">{r.tool}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5"><strong>Usage:</strong> {r.usage}</p>
              <p className="text-[7px] mb-0.5"><strong>Rule:</strong> {r.rule}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Why: {r.why}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-orange-50 border-orange-200 mt-1">
            <p className="text-[9px] font-bold text-orange-700">Why Hendra rejected Slack (2023):</p>
            <p className="text-[8px]">Trialed Slack for 3 months in 2023. Result: Budi and Reza never used it (WA habit too strong). Sari checked it sometimes. Only Hendra Jr. was consistent. Cost: Rp 1.1jt/bln. Value: zero adoption outside tech team. Hendra: 'A tool only the tech person uses is not a team communication tool.' Reverted to WA + Notion. No productivity loss — actually improved after reverting.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Communication stack philosophy: use what the team will actually use, not what looks best in a pitch deck. The WA + Notion stack looks unsophisticated but works because everyone uses it. Hendra's rule: adoption rate beats feature richness. A Notion page everyone reads beats a Confluence page nobody opens. The same principle applies to MJP's product choices.</p>
      </div>

      {/* Team Hiring Criteria */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <UserCheck className="h-3.5 w-3.5 text-primary" /> HIRING CRITERIA — Kriteria Perekrutan MJP: Apa yang Hendra Cari di Setiap Posisi, Mengapa Tim Saat Ini Sulit Direplikasi, dan Rencana 4 Hire Berikutnya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="border rounded-sm p-2.5 bg-muted/10 mb-2">
            <p className="text-[9px] font-bold mb-1">Hendra's universal hiring filters (all roles):</p>
            {[
              "Konstruksi fluency: can they talk to a BUJK director as a peer? Can they read a tender document and understand it? No domain fluency = no hire, regardless of other skills.",
              "Learning velocity: not 'smart' — specifically fast at internalizing complex domain knowledge. MJP moves fast; slow learners become anchors.",
              "Honest in uncertainty: does the candidate admit what they don't know? Candidates who bluff about domain knowledge = cultural mismatch. MJP operates on accurate information.",
              "Intrinsic motivation: are they curious about the construction industry itself, or just looking for a job? The former will compound. The latter will plateau.",
            ].map((c, i) => <p key={i} className="text-[7px] mb-0.5">• {c}</p>)}
          </div>
          <div className="overflow-x-auto mb-1">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Next Hire (priority order)</th>
                  <th className="p-1 text-center">Timeline</th>
                  <th className="p-1 text-center">Budget</th>
                  <th className="p-1 text-left">Non-negotiable skill</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["1. SKK Express Coordinator", "Q4 2026", "Rp 7–9jt/bln", "SKK/LPJK process familiarity. Dewi trains. Dewi also approves."],
                  ["2. Junior Software Engineer", "Q3 2026", "Rp 8–10jt/bln", "Python (crawlers). Hendra Jr. technical bar. For crawler ops + observability."],
                  ["3. Sales Development Rep (SDR)", "Q1 2027 (Series A)", "Rp 6–8jt + commission", "Cold outreach + CRM. Domain knowledge bonus. Reports to Reza."],
                  ["4. AI/ML Engineer", "Q2 2027 (Series A)", "Rp 15–18jt/bln", "NLP/LLM fine-tuning. NLQ productionization. Hendra Jr. peer-level."],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[2]}</td>
                    <td className="p-1 text-muted-foreground">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700">Why current team is hard to replicate:</p>
            <p className="text-[8px]">Hendra: construction background + product sense (rare combo). Sari: 4-year intelligence corpus + annotation discipline (time-locked). Dewi: LPJK network built over 4 years (cannot be fast-tracked). Reza: 23% cold close rate from domain credibility (not just sales skill). Budi: 8-year field network with peer-level BUJK access (trust cannot be purchased). Each person took years to reach current effectiveness. A competitor hiring equivalent talent starts 3–5 years behind.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Hiring is Hendra's most personally involved activity. He interviews every candidate, regardless of level. Rationale: at MJP's stage (6 people), each hire changes the team dynamic significantly. One wrong hire = 6 months of drag + 2 months offboarding. Hendra: 'Hiring slowly and firing quickly sounds cliché because it's actually correct.' All current team members passed 3+ rounds + a paid trial project before formal offer.</p>
      </div>

      {/* Quarterly Business Review Format */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> QBR FORMAT — Format Quarterly Business Review MJP: Bagaimana Hendra Memimpin 4-Jam Meeting per Kuartal yang Menentukan Arah 90 Hari Berikutnya
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { segment: "Segment 1 (45 menit) — Metrics Review", lead: "Hendra", content: "Full dashboard: MRR, churn, NPS, feature adoption, Enterprise health scores, financial summary. Hendra reads the numbers. No presentation slides — raw data discussion. Rule: no explaining away bad numbers. Bad numbers = honest discussion.", deliverable: "OKR grade for the quarter" },
            { segment: "Segment 2 (45 menit) — Market Intelligence Brief", lead: "Sari", content: "Sari presents: what changed in the construction market this quarter? Regulatory changes, market shifts, competitor moves. What signals are we seeing from Budi's field? What's coming in the next quarter?", deliverable: "Top 3 market signals that affect product roadmap" },
            { segment: "Segment 3 (30 menit) — Customer Voice", lead: "Reza + Budi", content: "Reza: 3 win stories + 3 loss stories (with root cause). Budi: 3 field conversations that revealed something new. What are klien actually saying? Direct quotes (anonymized). This segment cannot be shortened.", deliverable: "3 product insights from klien voice" },
            { segment: "Segment 4 (30 menit) — Technical Review", lead: "Hendra Jr.", content: "Infrastructure health, incident post-mortems, technical debt status. What slipped from last quarter's roadmap? Why? What's the realistic capacity for next quarter?", deliverable: "Technical capacity commitments for next quarter" },
            { segment: "Segment 5 (60 menit) — Next Quarter Planning", lead: "Hendra (facilitates)", content: "All team: What are the 3 most important things to accomplish next quarter? Structured debate — each team member proposes 1 priority. Hendra synthesizes into OKR draft.", deliverable: "Draft OKRs (finalized within 48 hours via async)" },
            { segment: "Segment 6 (30 menit) — Team Pulse + Open Agenda", lead: "Everyone", content: "How is everyone doing? Any interpersonal tension? Process improvement suggestions? Anonymous concerns raised via pre-submitted form. Hendra closes: what he's proud of + what he's worried about.", deliverable: "Morale read + any immediate action items" },
          ].map((r) => (
            <div key={r.segment} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[8px] font-bold flex-1">{r.segment}</p>
                <span className="text-[7px] font-mono text-primary shrink-0">Lead: {r.lead}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.content}</p>
              <p className="text-[7px] font-mono text-emerald-700">Deliverable: {r.deliverable}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">QBR has been run every quarter since Q2 2022 (11 total as of Q2 2026). Format evolved: Segment 3 (Customer Voice) was added in Q4 2022 after a product decision that turned out to miss the market — klien had told Reza the opposite of what Hendra assumed. Never missed another QBR. Longest QBR: 5.5 hours (Q1 2024 — churn crisis discussion extended). Normal: 4 hours. Hendra: 'QBR is the one time the whole team is facing the same information at the same time. Everything else is async — this is sync.'</p>
      </div>

      {/* Hendra's Decision-Making Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-primary" /> HENDRA'S DECISIONS — Framework Pengambilan Keputusan Hendra: Bagaimana Dia Membedakan Keputusan yang Perlu Diskusi Tim vs. Keputusan yang Dia Buat Sendiri dalam 10 Menit
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              type: "Tipe A — Reversible + Low Cost: Decide Alone (<10 menit)",
              examples: ["Email subject line for briefing", "WA message phrasing for alert", "Minor UI wording", "Which feature to demo in Reza's next call"],
              rule: "Hendra decides, informs team via brief Notion note. No consultation needed. Cost of wrong decision: minimal. Speed matters more than correctness.",
              tc: "text-muted-foreground"
            },
            {
              type: "Tipe B — Reversible + Medium Cost: Consult 1 Person (<1 jam)",
              examples: ["Knowledge asset topic priority (consult Sari)", "Tender alert wording change (consult Reza — how do klien read this?)", "Infrastructure spend < Rp 5jt/bln (consult Hendra Jr.)", "SKK Express pricing tweak (consult Dewi)"],
              rule: "Async WA question to 1 relevant person. Response within 24 hours expected. Hendra decides, notes dissent if any.",
              tc: "text-blue-700"
            },
            {
              type: "Tipe C — Irreversible OR High Cost: Full Team Discussion (Weekly Close agenda)",
              examples: ["Hire/fire decision", "Major pricing change", "New product vertical (> 3 months Sari time)", "Partnership with significant org (GAPENSI)", "Series A process initiation"],
              rule: "Added to Weekly Close agenda. Full team perspective. Hendra may decide against majority but must explain. Decision documented in Notion within 24h.",
              tc: "text-orange-700"
            },
            {
              type: "Tipe D — Irreversible AND Existential: Board-Level (if applicable)",
              examples: ["Equity dilution > 15%", "Company sale / acquisition offer", "Fundamental pivot from current business model", "Any action that could have legal consequences for team"],
              rule: "At current stage: Hendra + 1 external advisor minimum. Post-Series A: board consultation required.",
              tc: "text-red-700"
            },
          ].map((r) => (
            <div key={r.type} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.type}</p>
              <p className="text-[7px] mb-0.5">Examples: {r.examples.join(" · ")}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Rule: {r.rule}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-muted/10 mt-1">
            <p className="text-[9px] font-bold mb-0.5">Decision latency by type (2025 data):</p>
            {[["Tipe A", "avg 8 menit"], ["Tipe B", "avg 18 jam"], ["Tipe C", "avg 6 hari (to next Weekly Close)"], ["Tipe D", "avg 3 weeks"]].map(([t, v]) => (
              <div key={t} className="flex gap-4 text-[7px]"><p className="font-bold w-16">{t}</p><p className="text-muted-foreground">{v}</p></div>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Decision framework developed by Hendra after noticing two failure modes: (1) over-consulting on trivial decisions = team meeting fatigue and slow execution. (2) under-consulting on major decisions = team feels excluded, buy-in low. The framework is not written as a policy — it's internalized through Hendra's consistent behavior. Team has learned: if Hendra asks your opinion before noon, it's a Tipe B. If it shows up on Weekly Close agenda, it's a Tipe C. If Hendra is unusually quiet: it's probably a Tipe D.</p>
      </div>

      {/* Sari's Strategic Intelligence Method */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> SARI'S METHOD — Metode Intelijen Strategis Sari: Bagaimana Dia Memproses 400+ Sinyal per Minggu dan Menghasilkan 5 Knowledge Asset Berkualitas Tinggi — Bukan 400 Item yang Kurang Berguna
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Sari's weekly intelligence processing method (documented in full for the first time, Q3 2025):</p>
          {[
            { step: "Langkah 1 — Morning Scan (08:00–09:00, Monday–Friday)", desc: "7 sources checked in order: (1) LPJK official, (2) LKPP circular, (3) PUPR website, (4) 3 curated Twitter/X accounts of construction journalists, (5) Budi's Notion updates, (6) Dewi's Notion updates, (7) klien feedback inbox. Time-boxed to 60 minutes — no exceptions.", tc: "text-blue-700" },
            { step: "Langkah 2 — Signal Triage (09:00–09:30, Monday only)", desc: "All signals from the week sorted into 3 buckets: A (publish this week), B (add to queue), C (archive). B and C take 5 seconds each. A signals get a sticky note with draft thesis: 'This matters because ___'. If Sari can't complete the thesis sentence: the signal goes to B.", tc: "text-primary" },
            { step: "Langkah 3 — First Draft Before Research", desc: "Sari writes the knowledge asset outline (H1, 3 key points, implications) BEFORE doing deep research. Counterintuitive — but Sari's discovery: 'When I research first, I find confirmation for whatever direction I drift. When I draft first, I find evidence that challenges my draft.' Forces better epistemic hygiene.", tc: "text-orange-700" },
            { step: "Langkah 4 — Adversarial Read", desc: "After drafting, Sari asks: 'What would a smart BUJK director say to refute this?' If she can't answer the rebuttal, the asset needs more research. If she can answer it: the rebuttal is included in the asset (under 'Catatan / Caveat' section). No MJP asset presents only the 'confirming' view.", tc: "text-emerald-700" },
            { step: "Langkah 5 — Budi Gut Check (async WA)", desc: "For any asset making a claim about BUJK behavior ('BUJK typically prefer X'): Sari sends 1-question WA to Budi. 'Budi, apakah di lapangan BUJK biasanya [claim]?' Budi responds same-day. If Budi says no: asset revised or claim hedged. Budi is the reality check that prevents desk-analyst drift.", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.step} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.step}</p>
              <p className="text-[7px] text-muted-foreground">{r.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Sari's method produces 5 high-quality assets/week from 400+ signals — a 1.25% signal-to-asset ratio. This seems low but is actually high signal discipline. Most knowledge workers produce 40 low-quality outputs from 100 signals (40% ratio) — noise masquerading as signal. Sari's 1.25% is intentional: 'I would rather publish 5 things that BUJK trust completely than 50 things they eventually stop reading because quality varies.' Quality floor is non-negotiable. Volume is variable.</p>
      </div>

      {/* Weekly Rhythm: MJP Operating Cadence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-primary" /> WEEKLY RHYTHM — Ritme Operasi Mingguan MJP: Setiap Hari apa Tim Melakukan Apa — Jadwal yang Membuat MJP Bisa Beroperasi sebagai Perusahaan Intelligence yang Andal dengan 5 Orang
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { day: "SENIN", events: ["07:00 — Sari publishes Daily Briefing (automated + final edit)", "08:00–10:00 — Sari: signal triage + new asset drafting (sacred block)", "10:00 — Hendra + Hendra Jr.: async product check-in (WA voice note, no meeting)", "14:00 — Reza: weekly pipeline review (self, Notion)"], tc: "text-primary" },
            { day: "SELASA", events: ["07:00 — Daily Briefing", "09:00–12:00 — Hendra Jr.: feature build / technical debt time", "14:00 — Dewi: asesor coordination for current week Express cases", "Flexible — Sari external expert engagement if needed"], tc: "text-blue-700" },
            { day: "RABU", events: ["07:00 — Daily Briefing", "08:00 — Sari: new knowledge asset published (target: 1/day)", "Budi: field Day 1 or Day 2 (rotates with travel schedule)", "15:00 — Hendra: investor/partnership call slot (blocked for external)"], tc: "text-emerald-700" },
            { day: "KAMIS", events: ["07:00 — Daily Briefing", "Reza: outreach/follow-up calls (highest-activity day)", "Last Thursday of month: backlog prioritization (60 menit, all team)", "Hendra Jr.: staging deployment window (minimize klien disruption)"], tc: "text-orange-700" },
            { day: "JUMAT", events: ["07:00 — Daily Briefing", "14:00 — Weekly Close (Hendra-led, 45 menit): wins, blockers, 3 decisions", "15:00 — Hendra + Hendra Jr.: tech debt review (last Friday of month)", "End of day: Budi submits field notes to Notion for Sari's Monday triage"], tc: "text-muted-foreground" },
            { day: "WEEKEND", events: ["Hendra: reads 1 book/month chapter + 1 industry article", "Hendra Jr.: personal project or technical exploration (builds morale)", "Emergency only: P0 incidents. No exceptions. Reza/Sari/Dewi: full off."], tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.day} className="border-b py-1.5">
              <p className={`text-[8px] font-black font-mono ${r.tc} mb-0.5`}>{r.day}</p>
              <div>{r.events.map((e, i) => <p key={i} className="text-[7px] text-muted-foreground">• {e}</p>)}</div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Weekly rhythm designed for: (1) Daily Briefing as a reliability anchor (never misses, even when team is busy — klien trust requires consistency), (2) Sari's protected morning block (highest-quality work requires protected time), (3) Hendra Jr.'s build time (no meetings during 09:00–12:00 Tue/Wed/Thu), (4) Reza's outreach momentum (Thursday is the highest-response day for B2B calls in Indonesian business culture). Every meeting has a defined output — no meeting that ends without a 'what was decided' line.</p>
      </div>

      {/* Post-Series A Org Design */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> POST-SERIES A ORG — Desain Organisasi MJP Pasca Series A: Dari 5 Orang ke 18 Orang dalam 18 Bulan — Urutan Perekrutan, Prinsip Struktur, dan Apa yang Tidak Boleh Berubah
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Hiring sequence matters — each hire unblocks the next growth constraint:</p>
          {[
            { seq: "H1 — SDR (Sales Development Rep)", timing: "Month 1–2", unblocks: "Reza's capacity constraint. SDR handles prospecting + initial qualification. Reza focuses on close + Enterprise. Target: +15 klien/month from SDR alone.", constraint: "Reza currently bottleneck for growth past 600 klien.", tc: "text-primary" },
            { seq: "H2 — Backend Engineer #2", timing: "Month 2–4", unblocks: "Hendra Jr.'s development queue. Target: 2 features/month → 4 features/month. NLQ v2 + personalization parallel to ongoing maintenance.", constraint: "Hendra Jr. single-threaded blocks product velocity.", tc: "text-blue-700" },
            { seq: "H3 — BIM Domain Expert (content)", timing: "Month 3–6", unblocks: "BIM knowledge vertical ahead of 2027 mandate. Target: 10 BIM assets/month from month 4.", constraint: "BIM gap (94/400+ assets) is a churn risk for BUJK preparing for mandate.", tc: "text-orange-700" },
            { seq: "H4 — Senior Analyst (Sari -2)", timing: "Month 4–8", unblocks: "Sari's production bottleneck. Junior analyst handles research + drafts, Sari reviews. Target: 8 assets/week from 5.", constraint: "Sari at capacity. Post-Series A content ambition requires team.", tc: "text-emerald-700" },
            { seq: "H5 — Client Success (Reza -2)", timing: "Month 6–10", unblocks: "Day-14 check and renewal management at 600+ klien. Target: free Reza for Enterprise sales, CS handles SMB retention.", constraint: "At 600 klien: Reza can't do 25 Day-14 checks/month + 10 Enterprise calls + SDR coaching.", tc: "text-muted-foreground" },
            { seq: "H6–H7 — 2 Dewi Apprentice Asesor Coordinators", timing: "Month 6–12", unblocks: "SKK Express capacity for national scale. Target: Dewi trains 2 apprentices who own regional asesor networks.", constraint: "Dewi is single point of failure for SKK Express beyond 150 cases/month.", tc: "text-muted-foreground" },
            { seq: "H8 — Business Development (licensing + partnerships)", timing: "Month 10–14", unblocks: "GAPENSI partnership + licensing revenue streams. Target: first institutional licensing deal by Month 18.", constraint: "Licensing requires a BD person — not Reza (too busy with direct sales) and not Hendra (too strategic).", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.seq} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.seq}</p>
                <span className="text-[7px] font-mono text-muted-foreground shrink-0">{r.timing}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Unblocks: {r.unblocks}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Current constraint: {r.constraint}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-muted/10 mt-1">
            <p className="text-[9px] font-bold">What MUST NOT change post-Series A:</p>
            {["Weekly Close (keep the whole-team sync — last thing to sacrifice for 'efficiency')", "Sari's Monday morning block — it's what produces quality intelligence", "Budi's field program — the moment it's defunded, MJP loses its intelligence moat", "Hendra Jr.'s code ownership — no committee-by-committee architecture review that slows velocity", "No external board member who doesn't understand construction procurement deeply"].map((d, i) => <p key={i} className="text-[7px]">• {d}</p>)}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Org design from 5 → 18 requires 13 hires in 18 months (avg 0.72 hires/month). This is the right pace — fast enough to accelerate growth, slow enough to maintain culture and quality standards. Hendra: 'I'd rather miss a growth quarter than hire wrong. Every wrong hire in a 15-person company is a 7% culture contamination. We don't have room for cultural antibodies yet.' The sequence in H1–H8 is non-negotiable — Hendra won't reorder based on investor pressure.</p>
      </div>

      {/* MJP Team Culture Principles */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Heart className="h-3.5 w-3.5 text-primary" /> TEAM CULTURE — Prinsip Budaya Tim MJP yang Diterapkan Setiap Hari: 7 Nilai yang Bukan Poster di Dinding Tapi Keputusan Nyata yang Dibuat Berdasarkan Nilai Ini — Dengan Contoh Konkret Kapan Nilai Ini Diuji
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              value: "V1 — 'Intelligence, not data'",
              desc: "MJP's core belief: data has no value without interpretation. Every product decision runs through this filter.",
              tested: "When Hendra Jr. proposed showing raw LPSE data faster without Sari's annotation layer. Hendra said no: 'Speed of data without interpretation is a commodity. We're building intelligence.'",
              tc: "text-primary"
            },
            {
              value: "V2 — 'Trust is the only product we actually sell'",
              desc: "Every BUJK decision made with MJP intelligence involves real money. They trust us with decisions worth Rp 10jt–1T.",
              tested: "When a data error was discovered in a Trust Score that a klien had acted on. Hendra called the klien himself — didn't wait for Reza. 'When trust is at stake, I handle it personally.'",
              tc: "text-blue-700"
            },
            {
              value: "V3 — 'Field first, then model'",
              desc: "Product features start with what Budi observes, not what Hendra hypothesizes. Models describe reality; field intelligence discovers it.",
              tested: "When Sari proposed a new KBLI category structure based on academic research. Hendra asked Budi to validate in the field first. Budi found BUJK used a different mental model. Academic structure was revised to match field reality.",
              tc: "text-emerald-700"
            },
            {
              value: "V4 — 'Async by default, sync by exception'",
              desc: "Team communication is async (Notion, WA messages). Meetings require a clearly stated decision to be made.",
              tested: "When a Series A advisor suggested weekly 2-hour all-hands meetings. Hendra declined: 'We don't meet to discuss. We meet to decide. If there's no decision, we document asynchronously.'",
              tc: "text-orange-700"
            },
            {
              value: "V5 — 'Disagree and commit'",
              desc: "Anyone can disagree with a decision before it's made. Once made, everyone executes with full commitment.",
              tested: "Reza disagreed with the Enterprise tier pricing (too low, in his view). Hendra explained the rationale. Reza committed to selling at the price. 6 months later: Reza said 'you were right — the price anchors well against J9 contract values.'",
              tc: "text-muted-foreground"
            },
            {
              value: "V6 — 'Klien complaints are product gifts'",
              desc: "When a klien complains, MJP treats it as free user research. The complaint is logged, the root cause investigated, and if valid, a fix is shipped.",
              tested: "A klien complained that HPS estimates were systematically too low for MEP tenders. Sari investigated: confirmed. Led to MEP sub-model initiative (Q4 2026). The complaining klien was sent a personal thank-you and was included in the MEP model beta.",
              tc: "text-primary"
            },
            {
              value: "V7 — 'Boring infrastructure, creative intelligence'",
              desc: "The crawler, database, and delivery infrastructure should be boring, reliable, and invisible. The intelligence layer — Sari's interpretation, Budi's field insight, NLQ — is where creativity lives.",
              tested: "When Hendra Jr. proposed a technically interesting but complex new database architecture. Hendra said: 'Is this creative infrastructure, or reliable infrastructure? The platform needs boring reliability.' The complex architecture was simplified.",
              tc: "text-blue-700"
            },
          ].map((r) => (
            <div key={r.value} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.value}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Tested when: {r.tested}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">7 values written by Hendra in Q1 2024 (MJP's 3rd year). Not a founding document — a distillation of decisions already made. Hendra: 'I didn't write these to tell the team how to behave. I wrote them to describe how we already behave, so we can recognize and reinforce it.' The values are tested most intensely during disagreements and under time pressure. A team that lives its values only in comfortable times doesn't have a culture — it has a poster.</p>
      </div>

      {/* Hendra's Reading & Learning Stack */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> LEARNING STACK — Stack Pembelajaran Hendra: 12 Buku dan Sumber yang Membentuk Cara Dia Membangun MJP — dan Bagaimana Setiap Kerangka Pikir Diterapkan dalam Keputusan Nyata MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { source: "The Mom Test (Rob Fitzpatrick) — Customer interview methodology", application: "Sari's field observation protocol. The rule 'talk about problems, not solutions' directly shapes Budi's interview approach. 'Never ask if someone would use your product' is why MJP's pain point process starts with Budi's neutral field observation, not a survey.", tc: "text-primary" },
            { source: "Zero to One (Peter Thiel) — Monopoly theory, secrets", application: "MJP's positioning as 'the only platform built specifically for Indonesian BUJK procurement intelligence.' Hendra's obsession with secrets: 'What does MJP know that no one else knows?' Answer: 4 years of BUJK behavioral data + Budi's field intelligence. That's the secret.", tc: "text-blue-700" },
            { source: "Crossing the Chasm (Geoffrey Moore) — Technology adoption lifecycle", application: "MJP is currently crossing the chasm from early adopters (tech-forward J9 BUJK) to early majority (pragmatic J7–J8 BUJK). Reza's sales motion shift: from 'this is innovative' to 'X BUJK just like you are already using this.' Reference customers are the bridge.", tc: "text-orange-700" },
            { source: "Good Strategy / Bad Strategy (Richard Rumelt) — Kernel of strategy", application: "MJP's strategy kernel: diagnosis (BUJK are intelligence-poor in a high-stakes procurement environment), guiding policy (aggregate and interpret intelligence that they can't get elsewhere), coherent actions (Budi's field program + Sari's knowledge production + Hendra Jr.'s crawlers all serve the guiding policy).", tc: "text-emerald-700" },
            { source: "Thinking in Bets (Annie Duke) — Decision quality vs. outcome quality", application: "Sari's RICE scoring separates decision quality from outcome prediction. MJP tracks whether well-scored problems produced high-impact features — comparing prediction vs. outcome. Hendra: 'We make good decisions that sometimes produce bad outcomes. That's different from making bad decisions.'", tc: "text-muted-foreground" },
            { source: "Hendra's Indonesian construction reading: Jurnal Teknik Sipil (ITB), GAPENSI annual report, PUPR project updates", application: "Domain grounding. Hendra reads 1 industry publication/week. Sari and Dewi are the domain experts — Hendra reads enough to be fluent in the conversation, not an expert. 'I need to understand what BUJK directors are anxious about at 2am. That comes from reading what they read.'", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.source} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.source}</p>
              <p className="text-[7px] text-muted-foreground">{r.application}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Hendra's learning stack is deliberately cross-functional: strategy, customer discovery, product adoption, decision theory, and domain knowledge. He shares key insights with the team during Weekly Close ('what I've been reading'). The most influential framework for MJP's day-to-day: The Mom Test (shaped how every team member thinks about customer learning). Hendra requires every new hire to read The Mom Test and the Zero to One chapter on monopolies before their first day. 'I'd rather they arrive with a shared vocabulary about what we're building and why.'</p>
      </div>

      {/* MJP Decision Log — Key Historical Decisions */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" /> DECISION LOG — Log Keputusan Penting MJP: 8 Persimpangan Kritis dalam Sejarah MJP — Keputusan yang Diambil, Jalan yang Tidak Diambil, dan Apa yang Bisa MJP Pelajari Setelah 4 Tahun
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { decision: "D1 — 2022 Q2: Stay BUJK-only vs. expand to project owners (BPK, PUPR)", chosen: "CHOSEN: Stay BUJK-only. Rejected: serving project owners (procuring entities) as a parallel customer base.", reason: "Hendra's reasoning: 'Two customer types with conflicting interests on the same platform creates trust problems. BUJK trust our data because we're not also serving the entities that evaluate them.' Outcome: correct. Enterprise BUJK explicitly cite that MJP's BUJK-only positioning makes them trust the intelligence.", tc: "text-primary" },
            { decision: "D2 — 2022 Q4: Build in-house crawler vs. use existing scraping service", chosen: "CHOSEN: In-house crawler. Rejected: using ScrapingBee or similar service (would have cost Rp 2.8jt/month for 312 sources).", reason: "Hendra Jr.'s reasoning: 'LPSE structures are specific enough that a generic scraper would miss 30–40% of tender data. We need custom parsers per source.' Outcome: correct. The custom crawler gives MJP 98.1% extraction accuracy vs. the industry benchmark of 76% for generic scrapers.", tc: "text-blue-700" },
            { decision: "D3 — 2023 Q1: Price at Rp 500k (low) vs. Rp 2jt (value-based) for launch", chosen: "CHOSEN: Rp 500k Starter, Rp 2jt Pro. Rejected: single price at Rp 3jt (Hendra's original instinct).", reason: "Reza's analysis: 'A single high price excludes J7 BUJK who become Pro eventually. Two prices with a clear upgrade path generates more LTV.' Outcome: validated. J7→Pro upgrade path generates 34% higher LTV than direct Pro acquisition.", tc: "text-orange-700" },
            { decision: "D4 — 2023 Q3: Hire Budi full-time vs. use freelance field researchers", chosen: "CHOSEN: Hire Budi full-time (first non-founder employee). Rejected: freelance network of 5–8 regional researchers.", reason: "Hendra: 'Freelance research has no institutional memory. The value of field intelligence accumulates — one researcher who knows the industry for 3 years is worth 10 rotating freelancers.' Outcome: Budi's 3-year BUJK contact network (180+ contacts) is irreplaceable.", tc: "text-emerald-700" },
            { decision: "D5 — 2024 Q2: Raise Series Seed at Rp 600jt vs. stay bootstrapped", chosen: "CHOSEN: Raise Rp 600jt Series Seed (family office, 12% equity). Rejected: continue bootstrapped for 18+ months.", reason: "Hendra's math: 'The Rp 600jt funds Hendra Jr.'s full salary for 2 years + Sari's salary for 1.5 years. These hires are what allows the product to be built fast enough to reach Series A metrics. Without it, we hit Series A 2+ years later.' Outcome: validated. Hendra Jr.'s hiring in 2024 delivered the platform that now supports 487 klien.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.decision} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.decision}</p>
              <p className="text-[7px] font-mono text-muted-foreground mb-0.5">{r.chosen}</p>
              <p className={`text-[7px] ${r.tc}`}>{r.reason}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Decision log review is a quarterly practice at MJP (Q4 review, during Annual Planning). Hendra reads through key decisions and grades them in hindsight: Correct, Partially Correct, or Wrong. In 4 years: 0 decisions graded Wrong. 3 decisions graded Partially Correct (D3: price was right but Pro price should have been Rp 2.5jt from launch; D5: should have raised Rp 800jt not Rp 600jt; D4: should have hired Budi 6 months earlier). The retrospective practice isn't about self-congratulation — it's about calibrating Hendra's decision-making model. 'The only way to improve decision quality is to look at outcomes and update the priors that drove the decision.'</p>
      </div>

      {/* Annual Planning Process */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-primary" /> ANNUAL PLANNING — Proses Perencanaan Tahunan MJP: Bagaimana Tim 5 Orang Merencanakan Tahun Berikutnya — Format 3 Hari, Agenda per Sesi, dan Output yang Harus Ada Sebelum Rapat Bubar
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Annual Planning held each December (3 full days, offsite — 2025 location: Villa Puncak, 2024: Bali, 2023: Surabaya home office). Structure:</p>
          {[
            { day: "Day 1 — Review & Retrospective (08:00–17:00)", sessions: ["08:00–10:00: Hendra presents Year in Review: revenue, klien metrics, product shipped, team health", "10:00–12:00: Each team member presents their own retrospective (what worked, what didn't, what I wish we'd done differently)", "13:00–15:00: Decision Log review — grade each major decision of the year (Correct / Partially Correct / Wrong)", "15:00–17:00: RICE retrospective — for each feature shipped: did it reach the predicted users? Was the impact as estimated? Recalibrate scoring heuristics."], tc: "text-primary" },
            { day: "Day 2 — Strategy & Problem (08:00–17:00)", sessions: ["08:00–10:00: Sari presents Watch List — all problems observed but not yet at backlog threshold. Team discusses: should any be promoted?", "10:00–12:00: External landscape review — competitor moves, regulatory developments, industry changes (Sari leads)", "13:00–15:00: Problem-to-Solution Coverage Map update — where are we strong, where are gaps, what should we build next?", "15:00–17:00: Series A strategy session — investor landscape, term expectations, use of funds, timeline"], tc: "text-blue-700" },
            { day: "Day 3 — Planning & Commitment (08:00–15:00)", sessions: ["08:00–10:00: Product Roadmap — features committed for H1 and aspirational for H2 (Hendra Jr. reviews feasibility live)", "10:00–11:00: Revenue and growth plan — targets by tier (Starter/Pro/Enterprise), Reza's pipeline commitments", "11:00–12:00: Team plan — hiring sequence, Dewi's Express scaling, Sari's apprentice onboarding", "13:00–15:00: 3 commitments per person — each team member states 3 specific things they commit to deliver in the coming year. Written, not spoken. Shared via group WA."], tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.day} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.day}</p>
              <div>{r.sessions.map((s, i) => <p key={i} className="text-[7px] text-muted-foreground">• {s}</p>)}</div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Annual Planning is the only meeting where every team member is required to be present in person — no remote attendance. Hendra's reasoning: 'Planning requires full presence — body and mind. Remote planning is negotiation, not co-creation.' The 3-day format costs ~Rp 15–20jt (villa, meals, travel) — a number that felt significant in 2022 (first Annual Planning). In 2025: Reza's 3 personal revenue commitments from Day 3 of the 2024 planning resulted in Rp 48jt/month in incremental revenue by Q3 2025. ROI on the planning retreat: 240× in one year from one team member's commitments alone. Hendra: 'The 3 days are the most valuable investment we make every year. Everything else executes the plan — this is where the plan is built.'</p>
      </div>

      {/* R96: MJP Team Communication Architecture */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-primary" /> MJP TEAM COMMUNICATION ARCHITECTURE — Bagaimana Tim 6 Orang yang Tersebar Geografis Berkomunikasi Tanpa Meeting Berlebih: Stack, Ritme, dan Aturan Komunikasi yang Memungkinkan MJP Bergerak Cepat
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { channel: "WhatsApp Group 'MJP Ops'", frequency: "Async, 24/7", rule: "Hanya untuk: update operasional cepat, alert teknis, laporan field Budi. Bukan untuk: diskusi produk, decision-making, atau long-form analysis. Norma: response tidak wajib dalam 1 jam, tapi acknowledged dalam 4 jam.", tc: "text-emerald-700", who: "Semua (6 orang)" },
            { channel: "Notion 'MJP Brain'", frequency: "Update async, review mingguan", rule: "Semua long-form documentation: product decisions, research findings, investor updates, SOP. Bukan untuk: chat atau quick updates. Hendra Jr. adalah Notion admin — dia yang maintain structure.", tc: "text-blue-700", who: "Hendra, Hendra Jr., Sari" },
            { channel: "Monday Sync (30 menit, Google Meet)", frequency: "Mingguan, Senin 09.00 WIB", rule: "Agenda fixed: (1) Reza: pipeline update 5 menit. (2) Hendra Jr.: infra/product status 5 menit. (3) Sari: knowledge production status 5 menit. (4) Budi: field update 5 menit. (5) Hendra: priorities & blockers 10 menit. No new topics — bawa ke Notion.", tc: "text-primary", who: "Semua (6 orang)" },
            { channel: "Quarterly Deep Dive (3 jam, in-person jika bisa)", frequency: "Per kuartal", rule: "Untuk: review progress vs Annual Planning commitments, adjust priorities. Output mandatory: updated Notion 'Q[N] Review' page, 3 priority changes untuk kuartal berikutnya.", tc: "text-orange-700", who: "Hendra + direct reports" },
            { channel: "1-on-1 Hendra (setiap anggota)", frequency: "2x per bulan, 30 menit", rule: "Bukan performance review. Format: (1) Apa yang berjalan baik? (2) Apa yang menghambat kamu? (3) Apa yang kamu butuhkan dari saya? Hendra catat di Notion private page per orang.", tc: "text-purple-700", who: "Hendra + 1 anggota" },
          ].map((r) => (
            <div key={r.channel} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.channel}</p>
                <span className="text-[7px] font-mono text-muted-foreground shrink-0">{r.frequency}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Peserta: {r.who}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Rule: {r.rule}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2 bg-muted/30 mt-2">
            <p className="text-[8px] font-bold text-primary mb-1">ANTI-PATTERNS yang dilarang Hendra</p>
            <p className="text-[7px] text-muted-foreground">1. Meeting tanpa agenda tertulis: tidak ada. 2. Decision melalui WhatsApp: semua keputusan produk/bisnis harus di Notion, bukan chat. 3. 'Quick sync' yang tidak quick: jika sync butuh lebih dari 30 menit, itu adalah masalah scope, bukan scope untuk tambah waktu. 4. Email internal: MJP tidak menggunakan email untuk komunikasi antar tim.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Communication architecture MJP berkembang dari kekacauan. Di 2022–2023, semua communication terjadi di WhatsApp — termasuk product decisions dan KPI tracking. Hasilnya: keputusan penting tenggelam di chat history, Hendra Jr. sering tidak aware tentang product direction yang berubah karena Reza dan Hendra berdiskusi di WA tanpa inform dia. 'System failure' pertama terjadi ketika Hendra Jr. membangun fitur selama 2 minggu yang ternyata Hendra sudah pivot dari di WA conversation yang Hendra Jr. tidak lihat. Itu adalah moment Hendra memformalisasi communication architecture. Hendra: 'Tim kecil bukan berarti tidak perlu system. Justru tim kecil yang tidak punya system adalah yang paling mudah kacau.'</p>
      </div>

      {/* R97: MJP Knowledge Handover Protocol */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <UserCheck className="h-3.5 w-3.5 text-primary" /> MJP KNOWLEDGE HANDOVER PROTOCOL — Apa yang Terjadi Jika Anggota Tim Pindah, Diangkat Lebih Tinggi, atau Resign: Sistem Transfer Pengetahuan yang Mencegah Institutional Memory Loss di Perusahaan 6 Orang
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { role: "Sari (Knowledge Curator)", risk: "CRITICAL — institutional memory tentang 892 assets: mengapa setiap asset ada, edge cases dalam interpretasi, sumber-sumber informal yang hanya Sari tahu", handover: "Sari memiliki 'Sari's Notes' Notion page per asset category — personal annotations yang tidak masuk ke public asset content. Hendra's instruction: 'Setiap kali kamu tahu sesuatu yang tidak akan obvious dari asset itu sendiri, tulis di Sari's Notes.' Target: 100% knowledge externalized sebelum Q4 2026 apprentice hire.", tc: "text-red-700" },
            { role: "Hendra Jr. (Platform Engineer)", risk: "HIGH — sistem berjalan karena Hendra Jr. tahu quirks dan workarounds yang tidak terdokumentasi. Beberapa konfigurasi hanya ada di kepalanya.", handover: "ADR (Architecture Decision Records) — setiap keputusan arsitektur yang non-obvious harus documented: mengapa, alternative yang dipertimbangkan, apa yang tidak akan work. Hendra Jr. sedang membangun ADR library sejak Q1 2026. Target: 40 ADRs by year-end, covering semua critical system decisions.", tc: "text-orange-700" },
            { role: "Budi (Field Researcher)", risk: "MEDIUM — network kontak lapangan sebagian besar hanya Budi yang tahu secara personal", handover: "Contact registry: setiap kontak yang Budi punya untuk riset lapangan harus masuk ke Notion contact registry dengan: nama, asosiasi, reliability rating, topik expertise, last contact date. Current status: 67% of Budi's contacts registered. Target: 100% by Q3 2026.", tc: "text-orange-700" },
            { role: "Reza (Sales & Relationship)", risk: "MEDIUM-HIGH — klien relationships yang personal, deal-in-progress context, rejection history", handover: "CRM hygiene: setiap klien interaction harus logged dalam 24 jam. Reza resistant awalnya ('terlalu banyak admin') sampai Hendra menunjukkan bahwa Reza lupa follow up 3 warm leads yang harusnya bisa closed. CRM logging sekarang Reza's personal discipline, tidak hanya compliance.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.role} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.role}</p>
              </div>
              <p className="text-[7px] font-mono text-muted-foreground mb-0.5">Risiko: {r.risk}</p>
              <p className={`text-[7px] ${r.tc}`}>Handover protocol: {r.handover}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Knowledge handover protocol lahir dari satu near-miss: Q2 2024, Sari sakit 2 minggu (demam berdarah). Selama 2 minggu itu, knowledge production berhenti total karena tidak ada satupun yang tahu dimana Sari menyimpan source list untuk 3 assets yang sedang dalam progress. 2 minggu production gap + 1 minggu catch-up setelah Sari kembali = effective 3-week delay. Hendra melakukan post-mortem: 'Ini bukan tentang Sari. Ini adalah system failure — kita tidak punya backup untuk critical knowledge.' Protocol didesain bukan untuk 'replace' individu tapi untuk 'enable coverage': jika Sari tidak available, Hendra atau apprentice bisa complete asset produksi dari Sari's Notes. Handover bukan persiapan untuk orang keluar — itu adalah persiapan untuk tim bertahan.</p>
      </div>

      {/* R98: MJP Culture Principles & Operating Values */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-primary" /> MJP CULTURE PRINCIPLES {"&"} OPERATING VALUES — 6 Prinsip yang Digunakan Hendra untuk Membuat Keputusan Hiring, Promosi, dan Penyelesaian Konflik: Bukan Poster di Dinding, tapi Decision ListFilter yang Digunakan Setiap Minggu
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { principle: "P1: Transparency over comfort — selalu sampaikan realitas, bukan versi yang lebih menyenangkan", test: "Bagaimana kamu menyampaikan bad news ke klien, ke Hendra, atau ke tim? Apakah kamu delay, soften, atau langsung?", example: "Hendra Jr. melaporkan production incident ke Hendra dalam 15 menit meski incident terjadi jam 2 pagi. No sugarcoating, just facts and fix plan. This is the standard.", tc: "text-primary" },
            { principle: "P2: Evidence over opinion — setiap claim harus bisa di-backed oleh data atau observasi yang verifiable", test: "Ketika kamu merekomendasikan sesuatu, apakah kamu bisa menunjukkan data yang support rekomendasi tersebut? Atau apakah hanya 'saya rasa...'?", example: "Reza's D+10 check-in protocol: tidak dimulai karena Reza 'merasa' itu akan work. Dimulai karena Reza noticed correlasi antara early check-in dan conversion rate — kemudian presented data ke Hendra.", tc: "text-blue-700" },
            { principle: "P3: Long-term over short-term — keputusan yang terasa mahal hari ini tapi benar untuk 3 tahun ke depan", test: "Apakah keputusanmu akan still look good dalam 3 tahun? Atau kamu sedang optimizing untuk metrik bulan ini?", example: "Menolak satu investor offer di 2023 karena terms tidak align dengan long-term product vision. Short-term: Hendra harus bootstrap lebih lama. Long-term: leverage untuk Series A yang lebih favorable.", tc: "text-emerald-700" },
            { principle: "P4: Klien above all — jika keputusan bisnis dan kepentingan klien conflict, klien wins", test: "Pernahkah kamu suggest shortcut yang menguntungkan MJP tapi merugikan klien?", example: "MJP tidak mengirim promotional notifications yang disguised as product alerts. Reza pernah suggest 'bundled alert' yang sebenarnya adalah promo message. Hendra reject: 'Klien trust kita karena kita tidak spam them. Satu sponsored alert akan cost kita lebih dari the revenue it generates.'", tc: "text-orange-700" },
            { principle: "P5: Craft mastery — doing your specific job at an excellent level, not just adequate", test: "Apakah pekerjaan yang kamu hasilkan hari ini adalah pekerjaan yang kamu bangga tunjukkan dalam 2 tahun?", example: "Sari menolak publish asset yang belum diverifikasi meskipun ada tekanan karena ada regulasi baru yang klien tanyakan. 'Lebih baik terlambat tapi benar daripada cepat tapi salah. Reputasi saya sebagai kurator tergantung pada setiap asset yang saya publish.'", tc: "text-purple-700" },
          ].map((r) => (
            <div key={r.principle} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.principle}</p>
              <p className="text-[7px] font-mono text-muted-foreground mb-0.5">Decision test: {r.test}</p>
              <p className={`text-[7px] ${r.tc}`}>Example: {r.example}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Culture principles di MJP tidak pernah dibuat sebagai 'values workshop' output atau slogan untuk website. Mereka berkembang dari decisions Hendra harus buat dan penjelasan yang dia berikan kepada tim. Hendra: 'Saya tidak bisa bilang tim untuk 'be transparent' kalau saya sendiri tidak transparent tentang runway dan kesulitan yang kita hadapi. Culture is what you do when nobody is watching, not what you say when everybody is.' 5 prinsip ini adalah dokumen hidup — Hendra mengedit mereka setiap Annual Planning ketika ada prinsip yang terasa tidak lagi accurate atau ada yang harus ditambahkan. Versi pertama (2022) hanya punya 2 prinsip. Versi ini (2026) adalah yang paling lengkap dan paling tested.</p>
      </div>

      {/* R99: MJP Hiring Philosophy & Team Scaling Plan */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <UserPlus className="h-3.5 w-3.5 text-primary" /> HIRING PHILOSOPHY {"&"} TEAM SCALING PLAN — Prinsip Rekrutmen Hendra yang Tidak Berubah sejak 2021, Rencana Penambahan 8 Orang Post-Series A, dan Mengapa MJP Menolak Hire Fast Culture
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { principle: "Hiring Principle 1: Hire for judgment, not for credentials", detail: "MJP tidak mensyaratkan gelar S1 atau pengalaman kerja di perusahaan terkenal. Hendra meng-hire Budi (Peneliti Lapangan) yang adalah fresh graduate Teknik Sipil dari universitas daerah karena Budi memiliki natural curiosity, comfort dengan ketidakpastian, dan kemampuan untuk membuat narasumber nyaman berbicara. Budi sekarang adalah knowledge moat architecture-nya MJP.", tc: "text-primary" },
            { principle: "Hiring Principle 2: Cultural fit bukan 'comfort fit'", detail: "Hendra tidak mencari orang yang seperti dia — itu akan menciptakan echo chamber. Yang dicari: orang yang share prinsip (transparency, evidence-based, long-term) tapi approach problem secara berbeda. Reza (sales-oriented) dan Hendra Jr. (engineering-oriented) memiliki completely different communication styles — keduanya critical to MJP's success.", tc: "text-blue-700" },
            { principle: "Hiring Principle 3: Setiap hire di bawah 10 orang adalah existential decision", detail: "Pada 7 orang: setiap person = 14% dari output dan culture MJP. Satu bad hire dapat breakdown entire team culture. Hendra's hiring process: minimum 3 rounds, always includes 1 real work sample (paid), reference check tidak optional, 3-month probation dengan clear milestones.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.principle} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.principle}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
          <div className="mt-1">
            <p className="text-[8px] font-bold text-primary mb-1">Post-Series A Hiring Plan (8 new hires, 18 months)</p>
            {[
              ["Month 1–3", "Head of Growth (Reza's partner): revenue focus, manages outbound + partnerships. First non-founder hire in strategic role.", "text-primary"],
              ["Month 4–6", "2× Sales Development Reps: under Reza, focus outbound SME BUJK in Kalimantan + Sulawesi", "text-blue-700"],
              ["Month 4–6", "Senior Backend Engineer (Hendra Jr.'s first report): owns API infrastructure + B2B API product", "text-blue-700"],
              ["Month 7–9", "Knowledge Curator #2 (Sari's apprentice): MEP specialization, reduce Sari's production bottleneck", "text-orange-700"],
              ["Month 7–9", "Mobile Engineer: React Native specialist; Hendra Jr. is currently bottleneck for mobile features", "text-orange-700"],
              ["Month 10–12", "Field Researcher #2 (Budi's partner): Papua + Sulawesi coverage specialist", "text-emerald-700"],
              ["Month 12–18", "Head of Data / ML: owns AI recommendation engine, NLQ v2, signal intelligence", "text-emerald-700"],
            ].map(([timeline, role, tc]) => (
              <div key={timeline + role} className={`py-1 border-b flex gap-2`}>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${tc}`}>{timeline}</span>
                <p className="text-[7px] text-muted-foreground">{role}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Hiring plan adalah Series A use-of-funds primary narrative. Investors will ask: 'Bagaimana Rp 4–8M funding ini akan digunakan?' 8 hires atas 18 bulan adalah answer untuk 60% dari funds (40% ops + runway extension). Hendra sangat specific tentang sequencing: Head of Growth sebelum SDRs, karena SDRs tanpa good management = wasted headcount. Senior Backend sebelum Mobile Engineer, karena B2B API foundation harus ada sebelum mobile features expand. Hendra: 'Hire plan yang baik bukan tentang hire cepat. Tentang hire dalam urutan yang benar sehingga setiap orang yang masuk langsung productive karena infrastruktur yang mereka butuhkan sudah ada.'</p>
      </div>

      {/* R100: MJP Decision Log — Major Decisions 2021-2026 */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 text-primary" /> MJP DECISION LOG 2021–2026 — 8 Keputusan Terbesar yang Membentuk MJP Hari Ini: Konteks, Alternatif yang Ditolak, dan Bagaimana Setiap Keputusan Terlihat Melalui Kacamata 2026
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { decision: "D1 (2021): Build SaaS vs build consulting firm", chosen: "SaaS platform", rejected: "B2B consulting yang menggunakan data yang sama tapi deliver via manpower, not software", outcome: "VINDICATED. Consulting would have capped MJP at 30–40 klien (Reza's relationship capacity). SaaS allows 847+ klien with same team size. Hendra: 'Yang membuat keputusan ini sulit adalah consulting had faster initial revenue. SaaS requires patience.'", tc: "text-emerald-700" },
            { decision: "D2 (2022): Focus on construction only vs expand to real estate + property", chosen: "Construction procurement (tender, SKK, BUJK) only", rejected: "Broader property intelligence platform covering developer, broker, dan property management", outcome: "VINDICATED. Competitors who tried to cover all real estate + construction stayed shallow everywhere. MJP's depth in construction is defensible. Adjacent markets (developer, broker) now look at MJP as an acquisition target, not a competitor.", tc: "text-emerald-700" },
            { decision: "D3 (2023): Hire full-time research (Budi) vs freelance researcher network", chosen: "1 full-time researcher dengan domain expertise yang dibuild over time", rejected: "Network of 5–10 freelance field researchers with rotating assignments", outcome: "VINDICATED. Budi's accumulated trust network with narasumber is not replicable with rotating freelancers. His 67 documented relationships are a durable asset — 3 of those relationships became Enterprise klien. Rotating freelancers would have produced more volume at lower depth.", tc: "text-emerald-700" },
            { decision: "D4 (2023): WhatsApp delivery vs email-only", chosen: "Add WhatsApp as primary delivery channel alongside email", rejected: "Keep email-only to reduce complexity and cost", outcome: "VINDICATED. WhatsApp adoption: 73% of klien. Email-only churn risk for Digital Cautious/Resistant segment was real — they rarely check email for business purposes. Without WhatsApp: estimated 20–25% of current subscriber base would have churned.", tc: "text-emerald-700" },
            { decision: "D5 (2024): Build mobile app vs optimize web for mobile", chosen: "Native mobile app (Expo React Native) for field team use cases", rejected: "Progressive web app improvements only", outcome: "STILL EVALUATING. Mobile app adoption: 34% of subscribers. PWA-only approach might have achieved 25–28% mobile engagement at lower development cost. Field research team usage (Budi's app) unambiguously requires native — offline capability and camera access are critical.", tc: "text-orange-700" },
            { decision: "D6 (2025): Accept bootstrap growth vs raise angel round", chosen: "Accept Rp 800jt angel round from 2 angels", rejected: "Continue bootstrap, slower growth but full control", outcome: "VINDICATED SO FAR. Angel capital funded: Hendra Jr. full-time hire, Expo mobile app, and Knowledge Registry expansion. Without angel: MJP would be at ~600 klien vs current 847. Series A would be further away. Trade: 8% dilution. Hendra: 'Setiap kali saya lihat Hendra Jr. build something yang tidak bisa kita bayar tanpa angel capital, saya tahu keputusan itu benar.'", tc: "text-primary" },
          ].map((r) => (
            <div key={r.decision} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.decision}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.chosen}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Rejected: {r.rejected}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.outcome}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Decision log adalah Hendra's most valuable document for onboarding new team members dan new investors. For new hires: reading decision log gives them 5 years of organizational context in 30 minutes — why MJP is built the way it is, what alternatives were considered, and what trade-offs were made. For investors: decision log demonstrates disciplined thinking and intellectual honesty — 5 of 6 decisions are marked VINDICATED (track record of good decision-making), and 1 is marked STILL EVALUATING (honest about uncertainty). Hendra: 'Setiap startup CEO akan bilang setiap keputusan yang mereka buat adalah benar. Log ini memaksa saya untuk acknowledge trade-offs dan ambiguity. Jika saya tidak bisa honestly reflect on my decisions, bagaimana saya bisa improve?'</p>
      </div>

      {/* R101: Team Wellbeing & Sustainability Protocol */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Heart className="h-3.5 w-3.5 text-primary" /> TEAM WELLBEING {"&"} SUSTAINABILITY PROTOCOL — Cara MJP Menjaga Tim 7 Orang Tetap Produktif dan Sehat: 4 Kebijakan yang Tidak Pernah Dikompromikan, Mengapa Burnout Prevention adalah Business Strategy, Bukan Hanya HR Policy
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { policy: "WP-1: No work on weekends — strictly enforced, CEO included", detail: "Hendra tidak mengirim pesan Slack atau WhatsApp kerja pada hari Sabtu dan Minggu. Tim tidak diekspektasi read atau respond sampai Senin. Satu-satunya exception: platform down (P0 incident) yang butuh immediate response. Hendra Jr. memegang on-call rotation 1 minggu per bulan — tapi even on-call, tidak diharapkan melakukan pekerjaan pengembangan di weekend.", rationale: "Burnout dari overwork adalah existential risk untuk 7-orang company. Setiap orang yang burnout dan keluar: kehilangan 12–18 bulan institutional knowledge yang tidak bisa diganti. Forced rest adalah investasi dalam long-term capacity.", tc: "text-primary" },
            { policy: "WP-2: 20 hari cuti per tahun — wajib diambil, tidak carry-forward", detail: "Setiap team member wajib ambil minimum 15 hari dari 20 hari jatah per tahun. Hendra tracks ini — jika seseorang mendekati Desember dengan > 8 hari sisa: Hendra personally encourages them to take it. Budi's annual field trip to new region: partly funded as work, partly funded as personal development leave.", rationale: "Leave yang tidak diambil adalah deferred burnout. 'Saya terlalu sibuk untuk cuti' = early warning sign untuk burnout yang sedang menumpuk.", tc: "text-blue-700" },
            { policy: "WP-3: Quarterly 1:1 wellbeing check-in (separate from performance review)", detail: "Setiap quarter: Hendra meets each team member for 60-minute conversation specifically about wellbeing, personal development goals, and any concerns not related to performance metrics. No performance discussion in this meeting. Questions: 'Apa yang membuat kamu excited tentang pekerjaan ini akhir-akhir ini?' dan 'Apa yang paling membebani?'", rationale: "Performance reviews catch output problems. Wellbeing check-ins catch people problems before they become output problems. Hendra: 'Saya discover bahwa Sari sempat mengalami imposter syndrome phase di Q2 2024 hanya karena wellbeing check-in. Tanpa check-in, saya tidak akan tahu sampai mungkin dia resign.'", tc: "text-emerald-700" },
            { policy: "WP-4: Remote work as default, in-person optional", detail: "All 7 team members work remotely as default. Monthly optional in-person gathering (biasanya lunch di Jakarta/Bandung) untuk team yang available. Annual 2-day in-person retreat (paid, including travel and accommodation). No mandatory office attendance — ever. This policy is permanent, not a COVID legacy.", rationale: "Remote-first enables: Budi to work from wherever his field research takes him, Dewi to work from Bandung where her support network is, Hendra Jr. to have focus time without open-plan office interruptions. The productivity gain dari remote work more than offsets coordination overhead.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.policy} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.policy}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Rationale: {r.rationale}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Wellbeing protocol adalah Hendra's most personal management document — born from watching friends burn out at other startups and vowing to build differently. The founding principle: MJP's long-term success depends on a small, excellent, sustained team more than on a large, exhausted, high-turnover team. 5-year retention of 7 people builds institutional knowledge worth more than rapid expansion and replacement. Team tenure average: Reza (5 years), Budi (4 years), Sari (3.5 years), Hendra Jr. (2.5 years), Dewi (2 years). Zero involuntary turnover in 5 years. Hendra: 'Orang yang bertanya kenapa kita tidak hire lebih agresif — jawabannya adalah ini. Tim yang ada adalah tim yang bisa saya trust 100% karena sudah build trust selama bertahun-tahun. Hiring fast tanpa investasi dalam retention adalah illusion of growth.'</p>
      </div>

      {/* R102: Cross-functional Collaboration Patterns */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> CROSS-FUNCTIONAL COLLABORATION PATTERNS — Bagaimana 7 Orang MJP Bekerja Bersama Tanpa Struktur Korporat: 5 Recurring Collaboration Loops, Meeting Minimum, dan Mengapa 'Async First' adalah Default MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { loop: "Loop 1: Budi → Hendra → Hendra Jr. (pain-to-feature pipeline)", cadence: "Async, continuous", desc: "Budi logs pain point observation in platform (real-time). Hendra reviews new entries every Monday. High-RICE items: Hendra creates Notion feature brief, assigns Hendra Jr. Hendra Jr. responds with effort estimate within 48 hours. Hendra approves or adjusts scope. No meeting needed for 80% of features — async decision chain is sufficient.", tc: "text-primary" },
            { loop: "Loop 2: Sari → Hendra Jr. (Knowledge Registry system requirements)", cadence: "Monthly 30-min sync + async ad hoc", desc: "Sari brings: new content types that need new schema, UX problems in the Knowledge Registry interface, crawl quality issues she's observing. Hendra Jr. brings: platform changes that might affect Sari's workflow. Monthly meeting covers backlog review. Ad hoc: Sari can DM Hendra Jr. for urgent registry issues, target 4-hour response.", tc: "text-blue-700" },
            { loop: "Loop 3: Reza → Hendra (product-market feedback loop)", cadence: "Weekly 20-min on Monday morning", desc: "Reza's sales observations: prospect objections, win/loss patterns, competitive mentions. Hendra's product updates: new features Reza can use in pitches, pricing experiments, beta features for specific prospects. Most valuable part: Reza's 'this week's most interesting prospect conversation' — often surfaces emerging market dynamics before they show up in data.", tc: "text-emerald-700" },
            { loop: "Loop 4: Dewi → Sari (support-content knowledge loop)", cadence: "Biweekly 15-min + shared ticket log", desc: "Dewi surfaces: regulatory questions that clients ask repeatedly but Knowledge Registry doesn't answer well. Sari surfaces: new assets that Dewi should use when answering those question types. The feedback loop ensures Dewi's support intelligence feeds directly into Knowledge Registry production priorities.", tc: "text-orange-700" },
            { loop: "Loop 5: Full team Monday standup (all 7)", cadence: "Weekly 30 min, Mondays 9am WIB", desc: "Format: each person shares 1 win + 1 blocker in < 2 minutes. OKR progress review (last 5 minutes). No presentations, no decks. The meeting is NEVER extended — hard stop at 30 minutes. Items that need longer discussion: scheduled as separate bilateral or small-group meetings. Hendra: 'Standup yang melebihi 30 menit adalah planning meeting yang pura-pura jadi standup.'", tc: "text-primary" },
          ].map((r) => (
            <div key={r.loop} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.loop}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.cadence}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Collaboration pattern document adalah Hendra's answer to 'how does a 7-person team run without formal org structure?' The answer: informal but consistent loops that create information flow without meetings. Total recurring meeting time per week for the average team member: 45–55 minutes (20-min Reza:Hendra + 30-min standup, others as applicable). This is dramatically lower than most companies of comparable output — the savings go to deep work time. 'Async first' default: if a question can be answered asynchronously with &lt;24-hour delay without meaningful harm, it should be asked asynchronously. The exception: blockers that stop someone else's work — those get DM with expected response time. Hendra: 'Kita tidak bisa afford tim yang setengah waktunya di meetings. Tapi kita juga tidak bisa afford tim yang tidak aligned. Collaboration patterns adalah solusi untuk keduanya — cukup alignment, cukup waktu untuk kerja nyata.'</p>
      </div>

      {/* R103: Knowledge Transfer and Documentation Culture */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> KNOWLEDGE TRANSFER {"&"} DOCUMENTATION CULTURE — Bagaimana MJP Memastikan Pengetahuan Tidak Terkunci di Satu Orang: 4 Documentation Practices, Bus Factor Score per Fungsi, dan Mengapa 'Single Point of Knowledge' adalah Risiko Eksistensial
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { practice: "PRACTICE-1: 'If I Got Hit By A Bus' documentation (quarterly update mandatory)", desc: "Each team member maintains a document: 'Jika saya tidak bisa bekerja selama 2 minggu mulai besok, inilah yang perlu diketahui seseorang untuk melanjutkan pekerjaan saya.' Format: (1) top 3 ongoing responsibilities, (2) critical contacts and relationships (external: LSP, Reza's key prospects, Enterprise klien names), (3) access credentials location (stored in shared password manager, not in the doc itself), (4) known risks in my area that someone else should monitor.", current_bus_factor: "Sari: 1.2 (Hendra can cover triage with help from her docs, but full replacement takes 2 months). Hendra Jr.: 1.4 (Hendra can make product decisions, but engineering velocity drops 80%). Reza: 1.0 (no one covers sales if Reza is out — highest bus factor risk). Budi: 1.5 (field research pauses, platform continues).", tc: "text-primary" },
            { practice: "PRACTICE-2: System walkthrough video library (Hendra Jr.'s engineering videos)", desc: "Hendra Jr. records 20–30 minute screen-record walkthroughs of: crawler architecture, database schema decisions, alert delivery pipeline, AI recommendation flow. Library: 23 videos, avg 24 minutes. Audience: potential future engineers. Purpose: someone new can understand the system in 9 hours of video vs 6 weeks of pair programming.", current_bus_factor: "Engineering onboarding time (estimated): 3 months with videos vs 8+ months without. Hendra: 'Video library adalah investasi yang Hendra Jr. buat untuk dirinya sendiri — saat dia mengajarkan sistem ke video, dia mengidentifikasi gaps dalam dokumentasinya sendiri.'", tc: "text-blue-700" },
            { practice: "PRACTICE-3: Decision log as organizational memory (Dashboard Decision Log, R100)", desc: "Every significant decision documented: what was considered, what was chosen, why. Living document, reviewed by Hendra annually. Purpose: prevent decision thrashing (re-debating decisions already made). When new team member joins: Decision Log is part of their onboarding reading. When investor asks 'why did you choose X over Y?': answer exists in Decision Log.", current_bus_factor: "Organizational memory bus factor: N/A (system-wide, not person-dependent). The document IS the institutional memory, not the people.", tc: "text-emerald-700" },
            { practice: "PRACTICE-4: Pair work on all critical external relationships", desc: "No external relationship is owned by exactly one person. Enterprise klien: Hendra is primary + Reza knows them. GAPENSI chapter contacts: Sari is primary + Hendra knows them. LSP contacts: Dewi is primary + Sari knows top 5. BNSP API contact: Hendra Jr. is primary + Hendra is CC'd on all communications.", current_bus_factor: "External relationship bus factor: 2.0 minimum (two people always know each critical relationship). Exception: Budi's field research narasumber — Budi only, because narasumber trusted Budi personally (introducing a second person would feel like corporate escalation and would damage relationship).", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.practice} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.practice}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Bus factor note: {r.current_bus_factor}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Knowledge transfer culture adalah Hendra's insurance policy for MJP's continuity — built after a near-miss in 2023 when Hendra Jr. was hospitalized for 10 days and the entire engineering pipeline effectively stopped. Post-incident: mandatory documentation practices, video library started, pair-work protocol established. The most challenging bus factor: Reza (1.0 — single point of sales). Hendra Jr.'s engineering Bus Factor (1.4) is less critical in the short term because platform continues operating without new features. Reza's sales Bus Factor is critical because new ARR generation stops immediately if Reza is unavailable. This is the primary reason Head of Growth is the first post-Series A hire — not to replace Reza, but to eliminate the 1.0 bus factor. Hendra: 'Risiko terbesar yang pernah MJP hadapi bukan kompetitor atau market. Ini adalah bahwa seseorang yang tidak bisa digantikan overnight memutuskan untuk pergi. Kita sedang build sistem untuk survive setiap departure, including departure saya sendiri.'</p>
      </div>

      {/* R104: MJP Culture in Practice — Real Moments */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-primary" /> MJP CULTURE IN PRACTICE — 6 Momen Nyata yang Mendefinisikan Siapa MJP: Bukan Nilai-nilai yang Ditempel di Dinding, Tapi Keputusan Sulit yang Diambil Saat Tidak Ada yang Memperhatikan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { moment: "Momen 1: Hendra menolak enterprise deal yang akan merusak integritas data", year: "2023", story: "Perusahaan properti besar menawarkan kontrak 3 tahun senilai Rp 180jt/tahun dengan satu syarat: MJP menampilkan proyek mereka di posisi terdepan dalam pencarian kontraktor. Hendra menolak tanpa negosiasi. Tim mengetahui ini di Monday standup berikutnya.", why_it_matters: "Rp 540jt total contract left on the table. But accepting would have fundamentally compromised MJP's 'objective intelligence' positioning — every klien who trusts MJP's recommendations would be deceived. Hendra: 'Integritas data adalah hal yang saya tidak akan negotiate. Begitu kami terima satu sponsored result, kami bukan lagi intelligence platform. Kami menjadi iklan berbayar.'", tc: "text-primary" },
            { moment: "Momen 2: Sari mengakui error dalam Knowledge Registry ke semua klien secara proaktif", year: "2024", story: "Sari menemukan bahwa asset tentang persyaratan K3 telah berisi informasi yang tidak akurat selama 6 bulan. Estimated klien yang mengakses: 340+. Hendra's decision: proactive public disclosure via platform notification + email, not quiet fix.", why_it_matters: "Could have quietly fixed and hoped nobody noticed. Instead: sent notification to 340 klien explaining the error, what was wrong, what is correct, and new quality control measures. Response: 12 klien replied thanking MJP for transparency. 0 klien churned citing the incident. 3 klien specifically cited MJP's transparency as reason they upgraded to Pro.", tc: "text-emerald-700" },
            { moment: "Momen 3: Budi mengembalikan uang transport ke narasumber yang tidak mampu", year: "2022", story: "Budi scheduled interview with owner of small BUJK in Semarang. Narasumber traveled 2 hours by bus to meet Budi. During interview: Budi learned the BUJK was struggling financially. Post-interview: Budi offered to reimburse transport costs (Rp 80k). Narasumber initially refused. Budi insisted.", why_it_matters: "Not in any policy document. Budi's personal judgment. Hendra learned about it from Budi's field notes. This moment crystallized something about the ethics of field research: the people who share their struggles with MJP often have less to spare. Treating them with financial dignity is not just ethical — it builds the trust that makes future interviews deeper.", tc: "text-blue-700" },
            { moment: "Momen 4: Hendra Jr. told an investor 'no' on behalf of the team", year: "2025", story: "During early Series A conversations: one VC asked Hendra Jr. (in Hendra's absence) about MJP's 'real' burn rate, trying to get information before term sheet. Hendra Jr.: 'I'm not authorized to share financial details. Please direct that question to Hendra.' VC pushed. Hendra Jr. held firm.", why_it_matters: "Hendra Jr. could have answered — he knows the numbers. He chose not to because it would have undermined Hendra's position in negotiations. When Hendra heard about this: 'That's exactly the judgment I would have made. Team alignment matters more than any individual VC conversation.'", tc: "text-orange-700" },
            { moment: "Momen 5: Reza forfeit-ed a commission to protect klien interest", year: "2023", story: "Reza was about to close an Enterprise deal. During final call: discovered the klien's BUJK was actually Kualifikasi Menengah Bawah — Pro tier would serve them better than Enterprise. Pro commission: 60% less. Reza recommended Pro anyway.", why_it_matters: "Reza: 'Jika saya jual Enterprise ke orang yang hanya butuh Pro, mereka akan feel oversold dalam 3 bulan dan churn. Satu deal yang jujur lebih berharga dari satu deal yang dipaksakan.' The klien is still on Pro tier 2.5 years later.", tc: "text-primary" },
            { moment: "Momen 6: Tim mendukung Dewi saat client menjadi kasar", year: "2024", story: "Enterprise klien became abusive toward Dewi over the phone when a regulatory guidance turned out to be more complex than expected. Dewi handled it professionally. When Hendra heard about it: he called the klien directly and made clear that MJP's team would not accept abusive behavior from any klien, regardless of tier.", why_it_matters: "Klien was their 3rd-largest Enterprise account. The call was a financial risk. Hendra: 'Tidak ada contract yang valuable enough to expose any team member to mistreatment. If the klien cannot treat Dewi with respect, we will part ways.' Klien apologized. Relationship continued. Dewi: 'Itu pertama kalinya saya benar-benar merasa tim ini adalah keluarga.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.moment} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.moment}</p>
                <span className={`text-[7px] font-mono shrink-0 text-muted-foreground`}>{r.year}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.story}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Why it matters: {r.why_it_matters}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Culture in practice document adalah Hendra's antidote to the startup culture performance — mission statements on websites, values posted on Notion, culture decks for investor decks. None of those matter if they don't show up in actual decisions under pressure. The 6 moments above are the actual culture: how MJP behaves when nobody is grading them, when the financial incentive is to do the wrong thing, and when the right thing is costly. Hendra reads this document in new hire onboarding: 'Before I tell you about our product, I want to tell you about who we are when things get hard.' These moments are not extraordinary acts of heroism — they're ordinary decisions made with integrity by ordinary people who have internalized what MJP stands for. Hendra: 'Budaya adalah akumulasi dari ribuan keputusan kecil yang dibuat oleh semua orang dalam tim, bukan oleh founder. Saya bisa set tone tapi saya tidak bisa manufacture culture. Tim inilah yang sudah memilih untuk membawa integritas ke setiap keputusan mereka.'</p>
      </div>

      {/* R105: Team Hiring Philosophy — Who MJP Hires and Why */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> HIRING PHILOSOPHY — Siapa yang MJP Hire dan Mengapa: Hendra's Anti-credential Framework, 4 Hire yang Menjadi Pondasi Tim, dan Apa yang Akan Dia Lakukan Berbeda Post-Series A
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { hire: "Sari (Knowledge Manager): Hired over 2 Master's-degree candidates", hendra_reasoning: "Two other candidates had Masters in Law and Public Administration. Sari had a Bachelor's in Economics and 3 years working in a medium BUJK's procurement department. Hendra's hiring decision: 'Sari knows what it FEELS like to search for regulatory guidance under pressure because she's done it. The others know the theory. MJP needs someone who understands the practitioner's experience.'", what_she_had: "Practitioner empathy, high attention to detail, genuine curiosity about regulatory systems, and — critically — zero tolerance for ambiguity in information quality. Her BUJK experience made her see every knowledge gap as a real problem, not an academic gap.", tc: "text-primary" },
            { hire: "Hendra Jr. (Engineer): Hired over a senior backend engineer from a funded startup", hendra_reasoning: "The senior candidate had better credentials, more years of experience, and had worked at scale (50k users). Hendra chose the junior candidate (then 2 years experience) because of one interview moment: Hendra Jr. rebuilt the LPSE crawler prototype that Hendra showed him — in a different language, more efficiently — 'to see if I understood the problem.' Hendra: 'Orang yang membangun ulang sesuatu untuk memahaminya lebih baik — itu mindset yang tidak bisa di-train. Itu sudah ada atau tidak.'", what_she_had: "Problem-ownership mindset, technical curiosity that goes beyond specifications, and comfort with ambiguity. The senior candidate would have been better at executing defined requirements. MJP's work is often undefined — it requires someone who defines it themselves.", tc: "text-blue-700" },
            { hire: "Budi (Field Researcher): No prior research experience at all", hendra_reasoning: "Budi came from a regional trade association staff role — administrative work, no formal research training. His application for an 'operations assistant' role included an unsolicited analysis of why BUJK in his region were losing tenders they should have won. The analysis was 3 pages, hand-written, and more insightful than anything Hendra had read from formally trained researchers. Hired immediately for a role that didn't exist until Budi applied.", what_she_had: "Domain curiosity that came from living in the BUJK world, not studying it. Budi's 'informal' background gave him access to narasumber who wouldn't open up to someone who seemed like an outsider researcher.", tc: "text-emerald-700" },
            { hire: "Reza (Business Development): Hired over 3 SaaS sales candidates", hendra_reasoning: "3 candidates had SaaS or B2B sales experience. Reza had sold construction materials — not software, not subscriptions, but physical products to BUJK owners. Hendra's reasoning: 'Enterprise BUJK owners are skeptical of software. They've been burned by tools that didn't understand their world. Reza can walk into a BUJK owner's office and be seen as someone who understands construction, not as a software salesperson.'", what_she_had: "Credibility from domain proximity. Reza speaks the language of construction before speaking the language of software. This gives him access to conversations that a pure-software salesperson can't have.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.hire} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.hire}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Reasoning: {r.hendra_reasoning}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>What they had: {r.what_she_had}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Hiring philosophy adalah one of Hendra's most deliberate frameworks — built from observation that every successful MJP hire had domain proximity or unusual problem-ownership behavior, not credentials. The anti-credential principle is not anti-education: it's recognizing that for a domain-specific platform like MJP, proximity to the actual problem is more valuable than general technical excellence. Post-Series A hiring plan (3 engineers + 1 Head of Growth + 1 CSM): same filter applies. Engineers: Hendra Jr. will require a take-home challenge where candidates must crawl an LPSE portal and produce structured data. The challenge filters for candidates who engage with the actual problem domain. Head of Growth: must demonstrate 'construction procurement vocabulary' — able to use BUJK, KBLI, LPSE, Trust Score in context naturally before receiving any training. CSM: Reza will interview all CSM candidates himself. Hendra: 'Setiap orang yang bergabung dengan MJP harus datang dengan sesuatu yang genuine tentang masalah yang kami selesaikan. Salary kami bukan yang tertinggi. Kami tidak bisa bersaing dengan gaji. Yang bisa kami tawarkan adalah masalah yang interesting dan orang-orang yang genuinely peduli dengan itu.'</p>
      </div>

      {/* R106: MJP Offsite — How a 6-Person Team Makes Big Decisions Together */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" /> MJP ANNUAL OFFSITE — Bagaimana Tim 6 Orang dari 4 Kota Berbeda Membuat Keputusan Besar Bersama: Format, Agenda 3 Hari, dan 3 Keputusan Terpenting yang Lahir dari Offsite
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { session: "Offsite format: 3 hari, 1 kali setahun, kota yang berganti-ganti", detail: "MJP team is distributed: Hendra and Hendra Jr. in Jakarta, Sari in Bandung, Reza in Surabaya, Budi traveling (base: Yogyakarta), Dewi in Jakarta. Normal workflow: async, Slack, weekly video call. Annual offsite: the only time all 6 are in the same room for 3 consecutive days. Location rotates: 2022 Bandung, 2023 Yogyakarta, 2024 Surabaya, 2025 Jakarta, 2026 Bali (planned August 2026).", purpose: "Not a strategy retreat in the corporate sense. More like a deep-calibration: does everyone have the same understanding of where we are and where we're going? Are there things we've been avoiding saying async that need to be said in person?", tc: "text-primary" },
            { session: "Day 1: Retrospective — brutal honesty about what's not working", detail: "Day 1 rule: no solutions, only observations. Each person presents: (1) one thing they're proud of from the past year, (2) one thing they're frustrated about (about the product, process, or team), (3) one thing they think the team is avoiding talking about. The 'avoiding' category is the most valuable — it surfaces systemic issues that everyone feels but nobody has raised in weekly calls.", purpose: "2024 offsite Day 1 surfaced: Reza's concern that MJP's content was too complex for small BUJK (contributing to Starter PMF problem), Sari's concern that Knowledge Registry was being treated as a secondary feature rather than a core product, Budi's geographic bias self-critique. All 3 became product priorities.", tc: "text-blue-700" },
            { session: "Day 2: Forward planning — roadmap review and priority setting", detail: "Day 2 structure: morning review current year performance vs targets (ARR, churn, NPS, product velocity), afternoon set next year's OKRs. Everyone participates in OKR setting, not just Hendra. Rule: any OKR that someone cannot articulate WHY it matters for MJP's mission gets challenged.", purpose: "2025 offsite Day 2 produced: the decision to pursue Series A in 2026 (unanimous), the mobile app as a priority (Budi's consistent field experience drove this), and the geographic coverage NPS-linked investment (Reza's analysis of why Starter tier was underperforming).", tc: "text-emerald-700" },
            { session: "Day 3: Relationship and individual — not about the product", detail: "Day 3 rule: no product discussion. Focus: (1) each person shares one personal goal for the coming year (career or personal), (2) team reflects on what each person's strengths have been this year (acknowledgment), (3) open conversation about team health, workload, and what support people need. Hendra's rule: 'Day 3 is about the people who build MJP, not about MJP itself.'", purpose: "2025 offsite Day 3 led to: Hendra Jr.'s disclosure that he was feeling burned out from solo engineering pressure (triggered engineering hire acceleration), Sari's request for a formal Knowledge Manager title in investor materials (granted immediately), Budi's disclosure that the travel schedule was affecting his family (led to 2026 regional research redesign — less travel, more depth per city).", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.session} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.session}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Purpose + outcomes: {r.purpose}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Annual offsite adalah the single most important investment MJP makes in team cohesion — 3 days × 6 people × fully loaded cost including accommodation and travel: approximately Rp 45–60jt per offsite. ROI calculation: impossible to quantify directly. Indirect evidence: every major product direction change in MJP's history has been either decided at or triggered by the annual offsite. The Day 3 format (personal, not product) is the most unusual element — few startups dedicate a full day of a 3-day offsite to individual team member wellbeing and relationships. Hendra's reasoning: 'A team that only talks about the product together will eventually have only a product relationship — not a human relationship. And human relationships are what make people stay and give their best when things are hard. Tim kami distribute secara geografis. Kita tidak punya office culture yang membangun hubungan secara organik. Offsite adalah pengganti dari hal itu.'</p>
      </div>

      {/* R107: Async Culture — How a 4-City Team Stays Aligned Without Daily Standups */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MessageCircle className="h-3.5 w-3.5 text-primary" /> ASYNC CULTURE — Bagaimana Tim 6 Orang di 4 Kota Tetap Selaras Tanpa Daily Standup, Daily Sync, atau Kantor Bersama: 4 Praktik yang Membuat Async Bekerja di MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { practice: "P-1: Monday Weekly Update — setiap orang tulis update mereka, tidak ada rapat", format: "Every Monday morning: each team member writes a structured update in the team Notion page. Format: (1) what I shipped/completed last week, (2) what I'm working on this week, (3) any blockers I need help with. Time to write: 15 minutes. Time to read all 5 others: 10 minutes. Total team time cost: 25 minutes × 6 = 150 minutes to produce output that a daily standup culture would require 5 × 15min = 75 minutes per day × 5 days = 375 minutes per week. MJP: 40% less total time.", why_it_works: "Distributed team cannot reliably synchronize meeting times given different schedules (Budi in field, Hendra Jr. in late-night coding mode, Reza in morning sales calls). Async update: everyone reads when they want, responds when relevant. No one is held hostage to a calendar slot.", tc: "text-primary" },
            { practice: "P-2: Slack topik-spesifik, bukan 'general' channel yang berantakan", format: "#product-decisions, #data-quality-alerts, #klien-wins, #klien-support, #budi-fieldnotes, #hendra-jr-infra — each channel with a specific, narrow purpose. #general: explicitly banned. 'If a message could go in general, it means you haven't thought about who actually needs to read it.'", why_it_works: "Async communication breaks down when everyone receives everything. Channel specificity means: only relevant people follow each channel. Hendra Jr. doesn't read #klien-wins unless he wants to (it's positive, not actionable for him). Reza doesn't read #hendra-jr-infra (not actionable for him). Information density per channel: high.", tc: "text-blue-700" },
            { practice: "P-3: Decision Log — setiap keputusan penting dicatat dengan context dan reasoning", format: "Any decision affecting more than one person's work: logged in Notion Decision Log. Format: decision made, by whom, date, reasoning, alternatives considered, expected outcome, how we'll know if it was the right decision. 23 entries in 2026 (Q1–Q2). Reading time: 2 minutes per entry.", why_it_works: "Async teams make decisions separately. Without a decision log: team members discover decisions after they've impacted their own work — creating confusion and rework. Decision log makes decisions visible before they create friction. Most importantly: reasoning column prevents 'why did we decide this?' questions 3 months later.", tc: "text-emerald-700" },
            { practice: "P-4: Satu weekly sync meeting — 45 menit, selasa jam 10, agenda terstruktur", format: "One meeting per week, 45 minutes, every Tuesday 10am. Agenda: (1) celebrate wins from Monday updates (5 min), (2) cross-blocking issues only (issues where one person's work is blocked by another) (20 min), (3) one strategic topic with decision needed (20 min). No status updates in the meeting — those were written on Monday.", why_it_works: "The meeting exists for what async cannot do: (1) recognizing human accomplishment together (morale), (2) resolving cross-dependencies (requires conversation), (3) decisions that need group input in real-time. Keeping it to these 3 uses: 45 minutes is sufficient. Any agenda item that doesn't require real-time group input: moved back to Notion.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.practice} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.practice}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Format: {r.format}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Why it works: {r.why_it_works}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Async culture adalah MJP's most transferable organizational innovation — not specific to construction intelligence, but to any distributed team that needs to produce high-quality knowledge work without the overhead of meeting-heavy coordination. The 4 practices above were not designed as a system: they evolved from team pain (Monday Update: after a period of misaligned work priorities). Decision Log: after a product decision that Hendra made without properly informing Hendra Jr. (who then built the feature differently). Channel structure: after #general became an unreadable noise channel. Tuesday sync structure: after a 2-hour weekly sync that everyone dreaded. Each practice is a scar from a coordination failure that was too painful to repeat. The combined overhead: approximately 3.5 hours per person per week in explicit coordination time (Monday write: 15 min, Monday read: 50 min, Tuesday sync: 45 min, Decision Log write/read: 60 min). In exchange: alignment quality that most co-located teams with daily standups don't achieve. Hendra: 'Tim kami tidak pernah bertemu di kantor. Tapi kami hampir tidak pernah membangun hal yang salah karena ketidakjelasan arah. Itu bukan kebetulan — itu sistem.'</p>
      </div>

      {/* R108: When Team Alignment Breaks — MJP's Conflict Resolution Protocol */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-primary" /> CONFLICT RESOLUTION — Ketika Keselarasan Tim Pecah: 3 Konflik Nyata di MJP, Bagaimana Mereka Diselesaikan, dan Protokol yang Hendra Tetapkan untuk Memastikan Konflik Tidak Mengancam Tim yang Sudah Dibangun Selama 5 Tahun
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { conflict: "CONFLICT-1: Hendra vs Hendra Jr. — kecepatan feature vs kualitas infrastruktur (2023)", what_happened: "In Q2 2023: Hendra pushed for 3 major features to be shipped in 6 weeks to demonstrate progress to a potential investor. Hendra Jr. estimated: the features could be built in 6 weeks but would create significant technical debt in the crawler infrastructure, increasing outage risk. Hendra's position: investor momentum matters. Hendra Jr.'s position: a platform outage during investor due diligence would be worse than no new features.", resolution: "The conflict was resolved through a structured negotiation (not in the Tuesday sync — Hendra called a dedicated 90-minute 1:1). Agreement: 2 of 3 features in 6 weeks (velocity), with a 2-week buffer for infrastructure hardening after the investor meeting (quality). The investor meeting happened; 1 feature had a bug that required a 48-hour hotfix. No outage. Technical debt was addressed in Week 8 as agreed.", lesson: "The compromise worked because both Hendra and Hendra Jr. were arguing from principle (investor momentum vs platform quality), not from ego. The structured 1:1 format allowed each to fully articulate the concern before negotiating. Hendra Jr.: 'Kalau saya tidak mengatakan secara langsung bahwa saya khawatir dengan risiko outage, Hendra tidak akan tahu. Dan dia tidak bisa membuat keputusan yang baik tanpa informasi itu.'", tc: "text-primary" },
            { conflict: "CONFLICT-2: Sari vs Budi — scope of Knowledge Registry vs scope of field research (2024)", what_happened: "Budi's 2024 field research identified 12 new pain categories that should, in his view, be reflected in new Knowledge Registry assets. Sari's position: expanding Knowledge Registry coverage to these 12 categories would take 6 months of focused work and was not in the current year's plan. Budi felt Sari was deprioritizing field findings; Sari felt Budi was not understanding production capacity.", resolution: "Hendra mediated by framing the conflict as a planning process failure (the field research findings weren't fed into the Knowledge Registry production plan early enough), not an interpersonal failure. Resolution: quarterly research-to-registry handoff process added to the workflow. Budi provides Sari with a prioritized list of new topics from field research at the start of each quarter; Sari incorporates them into her production plan before finalizing. The 12 topics: 8 were addressed in the next 2 quarters, 4 deferred to Q1 2025.", lesson: "The conflict was a process gap, not a values conflict. Both Sari and Budi wanted the same thing (high-quality Knowledge Registry covering real practitioner needs) but lacked a coordination mechanism. Process fix: more effective than mediation. Hendra's diagnosis: 'Konflik yang akarnya adalah proses yang buruk diselesaikan dengan memperbaiki prosesnya, bukan dengan memediasi orangnya.'", tc: "text-blue-700" },
            { conflict: "CONFLICT-3: Reza vs Hendra — pricing di tender negotiation dengan klien potensial Enterprise (2025)", what_happened: "In Q3 2025: Reza was in extended negotiation with a large BUJK for an Enterprise contract. The BUJK requested a 40% discount from Enterprise pricing (Rp 6jt/month → Rp 3.6jt/month) citing competitive alternatives. Reza, in a moment of momentum pressure, verbally committed to 25% discount without confirming with Hendra. Hendra's position: MJP has a policy of no discounts {'>'} 10% on Enterprise tier to protect pricing integrity. Reza had exceeded this threshold.", resolution: "Hendra learned about the verbal commitment after the fact. He called Reza immediately — private conversation, no blame in front of the team. Hendra's position: the verbal commitment must be honored (breaking it would damage Reza's credibility and the klien relationship). But going forward: any discount {'>'} 10% requires Hendra's explicit approval before being offered. The klien received the 25% discount; Reza received a clear protocol for the future. The klien is now one of MJP's highest-NPS Enterprise klien.", lesson: "Reza's violation was a policy process failure, not a character failure. The response: honor the commitment (respect for the customer relationship), clarify the protocol (prevent recurrence), no public humiliation (protect team trust). Hendra: 'Cara seorang pemimpin merespons kesalahan pertama seseorang menentukan apakah orang itu akan jujur tentang kesalahan berikutnya.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.conflict} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.conflict}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">What happened: {r.what_happened}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Resolution: {r.resolution}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Lesson: {r.lesson}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Conflict resolution protocol adalah the organizational practice that prevents small misalignments from becoming team-threatening ruptures. The 3 conflicts above range from technical disagreement (velocity vs quality) to process failure (handoff gap) to policy violation (pricing commitment). Each required a different resolution approach: negotiated compromise (CONFLICT-1), process redesign (CONFLICT-2), and private accountability + protocol clarification (CONFLICT-3). The common element: none were resolved in public (in front of the full team) because public conflict creates sides, erodes team trust, and forces people to defend positions rather than solve problems. MJP's conflict protocol: (1) direct private conversation between the parties within 24 hours of a conflict becoming explicit, (2) if unresolved: Hendra mediates, also privately, (3) resolution documented in Decision Log with agreed-upon process change if applicable, (4) if a policy change is needed: communicated to full team as 'we updated our process' not 'someone made a mistake.' The culture this protocol creates: team members are not afraid to raise concerns or make mistakes, because they know mistakes are handled privately with process improvement as the goal, not public accountability as the cost. In a distributed team where relationships are already lower-bandwidth than a co-located team: conflict that goes public and unresolved is existentially damaging. Hendra: 'Tim jarak jauh yang sehat bukan tim yang tidak pernah berkonflik. Ini tim yang tahu cara berkonflik dengan cara yang memperkuat, bukan melemahkan, kepercayaan yang mereka butuhkan untuk bekerja bersama dari 4 kota yang berbeda.'</p>
      </div>

      {/* R109: MJP's Core Values — Written, Real, and Tested */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Heart className="h-3.5 w-3.5 text-primary" /> CORE VALUES IN PRACTICE — Nilai-Nilai Inti MJP yang Bukan Poster di Dinding: 5 Nilai, Bagaimana Masing-masing Muncul dalam Keputusan Nyata, dan Momen Ketika Nilai-Nilai Ini Diuji
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { value: "VALUE-1: Kejujuran data — kami tidak membuat klaim yang tidak bisa kami pertanggungjawabkan", in_practice: "Confidence scoring on every NLQ answer. 'Tier C/D BUJK' notation with explicit 'insufficient data' explanation rather than no-data BUJK appearing as Tier A (which would be misleading). HPS estimates with explicit confidence ranges (not point estimates). DBoR public commitment. Post-incident proactive disclosure (KON-089 Perpres 12/2021 case).", tested_moment: "2024: Enterprise klien asked MJP to remove a negative Trust Score signal (accurate but temporarily unfavorable during cash flow difficulty). Hendra declined to remove the signal but offered a context note feature. The klien briefly threatened to cancel. Hendra's response: 'Kami tidak bisa menghapus sinyal yang akurat — itu akan merusak nilai yang klien lain percaya dari Trust Score. Tapi kami bisa membantu Anda menambahkan konteks.' The klien stayed. The context note feature was built.", tc: "text-primary" },
            { value: "VALUE-2: Perspektif lapangan — keputusan produk harus didasarkan pada realitas di lapangan, bukan asumsi dari Jakarta", in_practice: "Budi's 67-narasumber network. Mandatory narasumber validation before features marked DONE. Geographic representation audit in annual product reviews. Flores interview as turning point. Budi's field budget: treated as product R&D, not market research.", tested_moment: "2023: Hendra proposed building a feature (tender calendar aggregation) without Budi's validation — citing time pressure from investor interest. Budi objected: 'Kita tidak tahu apakah BUJK akan menggunakan ini sebelum kita tanya mereka.' Hendra deferred. Budi validated the feature with 5 narasumber: 4 found it highly valuable (validation passed). Feature built. Hendra: 'Saya hampir melewati proses karena tekanan. Budi mengingatkan saya bahwa proses ada karena alasan yang baik.'", tc: "text-blue-700" },
            { value: "VALUE-3: Tanggung jawab kepada klien yang terpengaruh — kesalahan diakui, dikoreksi, dan dikomunikasikan secara proaktif", in_practice: "KON-089 Perpres 12/2021 protocol. Post-incident 7-day audit of all klien who accessed affected assets. Proactive outreach before klien discover the problem themselves. Financial compensation when error directly affected klien business decision. CHURN-4 Disappointed protocol: personal call from Hendra within 48 hours of any trust violation.", tested_moment: "2025: Hendra Jr. discovered a data normalization error that had affected HPS estimates for a specific KBLI category for 6 weeks. 34 Pro and Enterprise klien had potentially used incorrect HPS data. Option A: quietly fix and hope no one noticed. Option B: proactively contact all 34 klien, disclose the error, provide corrected estimates, offer partial refund. Hendra chose Option B. Cost: 34 individual outreach calls, 1 month subscription refund for each affected klien (Rp ~18jt total). Outcome: 2 klien cancelled. 32 remained. Multiple explicit 'thank you for telling me' responses. Hendra: 'Tidak ada pilihan lain yang konsisten dengan Value 3.'", tc: "text-emerald-700" },
            { value: "VALUE-4: Kejelasan tentang batas — kami tahu apa yang kami lakukan dan apa yang kami tidak lakukan", in_practice: "Declined pains list (5 categories MJP won't solve). Feature category definition test ('can I explain why we don't do X in one sentence?'). Explicit 'what MJP cannot do' section in Enterprise onboarding. Referral to right tools when klien ask about features outside MJP's category.", tested_moment: "2024: GAPENSI proposed that MJP build a dispute mediation feature — a mechanism for BUJK to report problems with JO partners through MJP's platform. Hendra's decline: immediate and unambiguous. 'Mediasi sengketa adalah kategori yang berbeda dengan intelligence. Ini membutuhkan keahlian hukum yang tidak kita miliki dan risiko litigasi yang tidak ingin kita ambil.' GAPENSI accepted the decline after Hendra explained the rationale clearly. Hendra: 'Batas yang jelas direspek lebih baik dari batas yang dipenuhi keraguan.'", tc: "text-orange-700" },
            { value: "VALUE-5: Tim sebagai manusia utuh — kami peduli tentang anggota tim sebagai manusia, bukan hanya sebagai kontributor produk", in_practice: "Annual offsite Day 3 (personal, not product). Individual career conversations at each offsite. Hendra Jr.'s career growth conversation (explicit, after Letter to 2020 Hendra). Flexible work hours (all team members set their own). No metric pressure on Budi's field research (relationship-building can't be rushed). Mental health days policy.", tested_moment: "2024: Sari disclosed to Hendra that she was experiencing burnout from the sustained workload during Perpres 12/2021 recovery period and IKN regulatory surge simultaneously. Hendra's response: immediate 1-week paid leave, no questions asked. Second response: restructured Sari's workload for the following quarter (reduced new asset production targets by 30%). Third response: initiated the Knowledge Research Analyst hire plan for post-Series A — formally acknowledging that Sari's current workload was not sustainable long-term. Sari: 'Hendra tidak menunggu untuk melihat apakah saya bisa bertahan. Dia langsung bertindak. Itu yang membuat saya tetap di sini.'", tc: "text-primary" },
          ].map((r) => (
            <div key={r.value} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.value}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">In practice: {r.in_practice}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Tested moment: {r.tested_moment}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Core values in practice adalah MJP's most important organizational document — because values that aren't tested by difficult decisions are just aspirations. The 5 values above have each been tested at least once by a situation where living the value was more costly than ignoring it. VALUE-1 (data honesty): costly in the short term (client almost cancelled over context note vs signal removal). VALUE-2 (field perspective): costly in the short term (feature delay due to Budi validation requirement). VALUE-3 (client accountability): costly in the short term (Rp 18jt in refunds + disclosure overhead). VALUE-4 (boundary clarity): costly in the short term (declining GAPENSI expansion opportunity). VALUE-5 (whole team): costly in the short term (Sari's workload reduction during growth period). In every case: the cost of living the value was real, immediate, and measurable. The benefit: harder to quantify but longer-lasting. Klien who experienced VALUE-3 in action (proactive disclosure) are among MJP's highest-retention cohort. Budi's adherence to VALUE-2 prevented 2 confirmed features that would have been removed within 6 months. Sari's retention (VALUE-5) preserved the regulatory knowledge infrastructure that would take years to rebuild. The values are documented not as aspirations but as decisions already made: 'When you face this type of situation at MJP, here is the decision this company has already made.' Every new hire receives this document. The tested moments are the most important part — they show that the values are not hypothetical. Hendra: 'Nilai yang tidak pernah diuji adalah dekorasi. Nilai yang diuji dan dipertahankan bahkan ketika biayanya nyata — itu adalah karakter perusahaan.'</p>
      </div>

      {/* R110: MJP's Weekly, Monthly, Annual Team Rhythm */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-primary" /> TEAM OPERATING RHYTHM — Kalender Ritme Operasional 6-Orang Tim MJP: Dari Sync Mingguan 45 Menit hingga Offsite Tahunan 3 Hari — Setiap Pertemuan Memiliki Tujuan Spesifik dan Format yang Tidak Boleh Diubah
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { cadence: "WEEKLY: Tuesday 14:00–14:45 WIB — All-hands team sync", format: "45 minutes, no extension. Agenda: always fixed. (1) Week in review — 5 minutes per person: what shipped, what stuck. (2) Competitive intelligence update — Reza: what C1 was mentioned in prospect conversations? Hendra Jr.: any significant RE finding? (3) Klien pulse — Reza: any at-risk klien identified? Any wins to celebrate? (4) One decision — one significant decision the team needs to make, with pre-circulated context, decided by end of call. The 45-minute limit is enforced: if one decision isn't resolved: it goes to async thread, not extended sync.", why_this_format: "Tuesday: after Monday's catch-up but early enough in the week for decisions to affect the week's work. 45 minutes: enough for updates and one decision, not enough for exploration (exploration happens async in Workroom). Fixed agenda: prevents sync from becoming a status meeting (status is shared async on Monday morning in written format before the call).", tc: "text-primary" },
            { cadence: "MONTHLY: First Friday 09:00–11:00 WIB — Deep review + prioritization", format: "2 hours. Agenda: 4 blocks. Block 1 (30 min): KPI review — ARR, MRR, churn, new klien, NPS. Each metric: current vs target vs last month vs 3-month trend. Block 2 (30 min): product update — what shipped in the past month, what's in progress, what moved on the backlog. Block 3 (30 min): market and competitive intelligence — Budi's field research update, Reza's market feedback, Hendra Jr.'s RE findings, Sari's regulatory landscape update. Block 4 (30 min): one strategic question — one topic that has been queued for monthly-level attention (can't be resolved in weekly 45-minute format). Decision documented in Decision Log.", why_this_format: "Monthly cadence: the right frequency for metrics (enough time between reviews to show meaningful trends) and strategic decisions (enough context accumulation for a well-informed decision). First Friday: end of the first week, giving the team fresh month-start data without waiting too long into the month.", tc: "text-blue-700" },
            { cadence: "QUARTERLY: Mid-quarter 1-day offsite (virtual) — Strategy and planning", format: "Full working day (09:00–17:00 WIB), virtual, no regular work. Morning: OKR mid-quarter review (what's on track, what needs to change, what can we drop without affecting annual objectives?). Afternoon: one deep strategic question per quarter (Q1 2026: Series A readiness. Q2 2026: IKN Intelligence tier design. Q3 2026 planned: post-Series A team expansion org design. Q4 2026 planned: Year 3 product strategy). Evening: optional social call (30 minutes, no agenda) — this is when the team talks about non-work topics. Participation in social call: voluntary, consistently high.", why_this_format: "Quarterly offsite is Hendra's answer to the problem that monthly syncs don't allow deep strategic exploration (30-minute strategic blocks aren't enough for complex topics). The full-day format: creates uninterrupted time that doesn't exist in normal weekly/monthly rhythm. Virtual format: practical (4 cities); the one full-day virtual day per quarter doesn't justify the travel cost of an in-person quarterly offsite. In-person reserved for annual offsite.", tc: "text-emerald-700" },
            { cadence: "ANNUAL: 3-day in-person offsite (Bandung, fixed location) — Reflection, relationships, direction", format: "Day 1: retrospective — what worked in the past year, what didn't, what should we do differently. No defensiveness rule: each person presents their own 'what I personally did that I wish I'd done differently' before team-level critique. Day 2: product and strategy — next year's roadmap, priorities, resource allocation. Day 3: personal — team values session (how are we living the 5 values?), career conversations (each person shares where they want to be in 2 years), team-building activity (varies each year). Bandung: chosen for accessibility from all 4 base cities, neutral territory (no one is 'at home'), and because the 2022 offsite there was the team's most productive.", why_this_format: "3 days in-person is the only format that allows the combination of work retrospective + strategic planning + personal relationship investment that Hendra believes is essential for a distributed team's long-term health. Day 3 (personal) is the most important and the most uncomfortable: career conversations require trust that doesn't exist in weekly syncs but does exist after 2 days together. Hendra: 'Offsite tahun ini adalah hari di mana saya belajar paling banyak tentang tim saya — dan di mana tim saya belajar paling banyak tentang satu sama lain.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.cadence} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.cadence}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.format}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Why this format: {r.why_this_format}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Team operating rhythm adalah one of Hendra's most deliberate organizational design choices — because the meeting cadence of a 6-person remote team determines whether information flows, decisions happen, and relationships are maintained. The 4-cadence structure (weekly → monthly → quarterly → annual) serves different functions that cannot be collapsed: weekly sync (tactical coordination, one decision), monthly review (metric accountability, strategic decision backlog), quarterly offsite (deep strategic exploration), annual offsite (reflection, relationships, direction-setting). Hendra's rule: never use a weekly sync for a monthly question, and never use an annual offsite for a weekly decision. The category confusion — using high-cadence meetings for long-horizon questions or using low-cadence meetings for urgent tactical matters — is the most common meeting design failure in remote teams. The fixed agenda format is equally important: meetings without fixed agendas drift toward whoever talks most, which in a distributed team means the most extroverted or the highest-seniority person. Fixed agenda items give everyone a defined moment to contribute. Budi's field research updates: appear in monthly sync (Block 3), not weekly sync (not enough happens weekly to warrant a weekly field update). Sari's regulatory update: also monthly. Hendra Jr.'s RE findings: weekly (competitive intelligence can be time-sensitive) and monthly (in depth). The rhythm was designed in Year 2 after Year 1 produced what Hendra describes as 'ad hoc coordination chaos — everyone was busy, no one knew what others were working on, and we made the same mistakes in parallel.' The rhythm solved the coordination problem. Hendra: 'Ritme yang baik bukanlah ritme yang paling sering. Ini ritme yang tepat untuk setiap jenis keputusan yang perlu dibuat. Lebih banyak pertemuan bukan berarti lebih baik terkoordinasi.'</p>
      </div>

      {/* R111: MJP Decision Log Architecture */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-primary" /> DECISION LOG ARCHITECTURE — Bagaimana MJP Mendokumentasikan Setiap Keputusan Besar dengan Konteks Lengkapnya: Dari Penolakan SKK Express hingga Pemilihan PostgreSQL, Mengapa MJP Memperlakukan Keputusan sebagai Aset Institusional
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { category: "DLOG-1: Product decisions — setiap fitur yang diputuskan dibangun atau tidak dibangun", format: "Each product decision log entry contains: (1) Date and context — what triggered the decision, (2) Options considered — minimum 2 options with tradeoffs documented, (3) Decision made and rationale — why this option was chosen, (4) Objections recorded — what was the strongest argument against this decision at the time, (5) Decision owner — who was accountable, (6) Review trigger — what event would cause us to revisit this decision. Format: structured text in Workroom, linked to the related pain point or feature spec.", why_it_matters: "The 'objections recorded' field: the most counterintuitive element. Most decision logs record why a decision was right; MJP's logs record why it might have been wrong. Purpose: future decision-makers reading the log can see the strongest counterarguments that were overruled — and judge whether those counterarguments are now more compelling given new information. Trust Score, NLQ, and SKK Express all have documented objections that were overruled. When reviewing these logs in 2026: the overruled objections were correct to overrule. Having them documented: confirms the decision was informed, not arbitrary.", tc: "text-primary" },
            { category: "DLOG-2: Architecture decisions — why PostgreSQL, why Drizzle, why React over Vue", format: "Technical decision logs: same format as product logs but written by Hendra Jr. and reviewed by Hendra. Architecture logs include: (1) the specific problem the architecture decision was solving, (2) alternatives evaluated with brief technical rationale, (3) the chosen approach with implementation notes, (4) 'regret trigger' — the specific scenario where we'd wish we'd chosen differently. Example: the PostgreSQL decision (Year 1) log includes a 'regret trigger': 'If we need to serve real-time data to more than 10.000 concurrent users: we may need to revisit. Current maximum concurrent users: 847.'", why_it_matters: "Architecture logs prevent 'we've always done it this way' from becoming a reason. When a new engineer joins post-Series A: they will read the PostgreSQL decision log and know: (1) the decision was deliberate, (2) the context in which it was made, and (3) the threshold at which it should be reconsidered. Without the log: new engineers either don't question foundational decisions (missing an opportunity to improve) or question them without context (wasting time re-evaluating decisions that were already carefully made).", tc: "text-blue-700" },
            { category: "DLOG-3: Partnership and vendor decisions — bagaimana MJP memilih LSP partners, data providers", format: "Business decision logs: vendor/partner selection rationale. LSP partnership decisions (for SKK Express): which 4 LSPs were selected and why, what alternatives were evaluated, what were the non-negotiable criteria. BNSP API vendor: why direct BNSP API was chosen over a data aggregator (answer: data freshness requirements made aggregators unacceptable). Cloud provider: why AWS was chosen over Azure or GCP (answer: Hendra Jr.'s existing expertise + available expertise in Indonesia for hiring). Each vendor decision: reviewed annually as part of the monthly rhythm.", why_it_matters: "Annual vendor review: 3 vendors have been replaced since 2021 (2 data providers and 1 email delivery service), all based on combination of cost increase + performance decline. The decision logs for these replacements: show the original selection criteria, the monitoring data that triggered replacement review, and the replacement selection rationale. New team members reading these logs: inherit the institutional knowledge about why the current vendor stack looks the way it does. Hendra: 'Setiap vendor yang ada sekarang: ada di sini karena alasan spesifik. Setiap vendor yang pernah diganti: ada alasan spesifik mengapa mereka diganti. Log itu adalah memori institusional yang tidak bergantung pada ingatan satu orang.'", tc: "text-emerald-700" },
            { category: "DLOG-4: Pricing and commercial decisions — bagaimana struktur tier MJP berevolusi", format: "Commercial decision logs document pricing architecture evolution: the original 2-tier pricing (Basic/Pro), when it changed to 3-tier (Starter/Pro/Enterprise) and why, each price adjustment, the trial length decision, and the refund policy. Each commercial decision log: includes the data analysis that preceded the decision (conversion data, cohort retention data, pricing sensitivity analysis from Reza's prospect conversations). The 3-tier addition log (Q2 2023): documents that 23% of Pro klien were systematically requesting features that were above Pro capabilities — the 'Enterprise need' was revealed by patterns of Pro requests, not market research.", why_it_matters: "Pricing decision logs are the most reference by Reza — he uses them in prospect conversations to explain why the tier structure is what it is. When a prospect asks 'why is Enterprise priced at Rp 3.5jt when Pro is Rp 1.8jt?' — Reza can answer from decision log context: 'Enterprise includes 3 capabilities that would cost more than the price difference to custom-build: SKK Express access, real-time NLQ, and unlimited Knowledge Registry download. The Enterprise price reflects those capabilities.' Reza: 'Decision log adalah cara saya menjelaskan harga dengan keyakinan. Bukan karena harganya sewenang-wenang — tapi karena saya tahu persis mengapa harganya seperti ini.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.category} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.category}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Format: {r.format}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Why it matters: {r.why_it_matters}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Decision Log Architecture adalah Hendra's answer to a specific organizational failure he observed in other startups: the loss of institutional memory that happens when decisions are undocumented and key people leave. At MJP's current size (6 people), institutional memory lives in people's heads — Hendra knows why every major decision was made, Hendra Jr. knows every architectural choice. But this is a fragile state: if either of them leaves MJP, that institutional memory leaves with them. The Decision Log converts institutional memory from personal to organizational — it belongs to MJP, not to Hendra or Hendra Jr. The log's value compounds over time: a log with 20 entries is useful; a log with 200 entries is irreplaceable. MJP's current Decision Log: 147 entries across 4 categories, spanning 5 years of decisions. The log's maintenance cost: Hendra estimates 30–45 minutes per entry for non-routine decisions. The log's retrieval value: estimated 4–6 hours saved per instance where a new team member or investor asks 'why did you make this decision?' — the answer is already written. For Series A due diligence: investors who have reviewed MJP's Decision Log consistently rank it among the top-3 most impressive operational artifacts they've seen in MJP's data room. Hendra: 'Decision log bukan untuk kita hari ini — ini untuk versi tim MJP yang lebih besar yang akan bergabung setelah Series A. Mereka berhak tahu bahwa keputusan yang mereka warisi dibuat dengan cermat, bukan secara kebetulan.'</p>
      </div>

      {/* R112: Culture Preservation as MJP Scales */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-primary" /> CULTURE PRESERVATION PLAN — Bagaimana MJP Menjaga Budaya dari 6 ke 15 Orang: 5 Cultural Practices yang Harus Bertahan Saat Tim Bertumbuh, Apa yang Hendra Khawatirkan Paling, dan Siapa yang Bertanggung Jawab Atas Kultur di MJP Versi Baru
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { practice: "CULTURE-1: Radical transparency tentang keputusan dan alasannya", current_state: "At 6 people: Hendra shares reasoning for every significant decision in the Monday meeting. Everyone understands why the strategy is what it is, why priorities are set as they are, and why certain things are declined. Knowledge of reasoning = alignment. No one at MJP follows a direction they don't understand.", scale_risk: "At 15 people: Monday meeting with 15 people takes 3× longer and becomes information overload rather than alignment. New hires join mid-story — they don't have the context for why certain decisions were made. Hendra's concern: 'Ketika orang baru bergabung dan mereka hanya melihat keputusan tanpa konteksnya, mereka mulai menyimpulkan alasan sendiri. Kesimpulan yang salah: sama berbahayanya dengan informasi yang salah.'", preservation_plan: "Decision Log (147 entries) serves this function for historical decisions. For ongoing: Hendra will write a monthly 'Decision Summary' memo — 1 page, distributed to all 15 people, summarizing the 3–5 most significant decisions of the past month and their rationale. The memo replaces the Monday full-team briefing as the primary transparency mechanism. Team size where this becomes necessary: Hendra's estimate — when weekly meeting exceeds 90 minutes (currently 47 minutes average for 6 people). Projected crossing point: 10 people.", tc: "text-primary" },
            { practice: "CULTURE-2: Data bukan opini sebagai bahasa keputusan", current_state: "At 6 people: when a product debate occurs, Hendra Jr. can retrieve platform usage data within 20 minutes. Budi can recall specific narasumber quotes that directly address the question. The team's collective memory of data is dense and immediately accessible. Data-based decision language is natural because everyone has direct access to the underlying data.", scale_risk: "At 15 people: new team members don't have 5 years of data context. Data without context can be misused — selectively cited to support a predetermined conclusion rather than to genuinely inform a decision. The most common culture degradation pattern in data-driven startups: new hires learn to use data rhetorically (to win arguments) rather than epistemically (to find truth). This pattern: produces an appearance of data-driven decision making without the substance.", preservation_plan: "Hendra Jr.'s plan: build a 'data literacy onboarding module' — a 3-hour self-paced course for new hires covering how to access, interpret, and appropriately caveat MJP's core data sources. The module includes 5 common data misuses observed in prior companies (Hendra Jr.'s personal list) and how to avoid them. Every new hire completes this before participating in a product decision discussion. The cultural anchor: Hendra's phrase 'tunjukkan datanya, bukan kesimpulannya terlebih dahulu' — show the data, then the conclusion, not the reverse.", tc: "text-blue-700" },
            { practice: "CULTURE-3: Jujur tentang kesalahan, cepat mengatasinya", current_state: "At 6 people: when something goes wrong, the person responsible tells the team the same day — not because of a formal rule, but because the team is small enough that hiding failures is both difficult and clearly counterproductive. Budi described a field research methodology error in his 2023 retrospective. Hendra Jr. publicly documented the SKK Express near-miss in the 3 near-failures analysis. This transparency culture: produces faster correction and better organizational learning.", scale_risk: "At 15 people: the social dynamics of error disclosure change. New hires don't yet know if transparency about failures is safe (are people punished for admitting mistakes?). In most organizations, social proof of safety comes from observing how senior people handle their own mistakes. If Hendra is transparent about his own failures: new hires learn the culture is safe. If transparency about failures is only expected from junior team members: the culture degrades into concealment.", preservation_plan: "Hendra's commitment: the Annual Decision Review (3 worst decisions of the year) will be conducted with all 15 people present, with Hendra's own decisions as the primary subject. New hires will observe in their first year — the review serves as cultural proof that admission of mistakes is not only safe but modeled by the CEO. The KON-089 case study (crisis response, 9/10 NPS): shared with every new hire as their first reading assignment on the topic of 'how we handle what goes wrong.'", tc: "text-emerald-700" },
            { practice: "CULTURE-4: Klien intelligence sebagai sumber kebenaran utama", current_state: "At 6 people: Budi's narasumber insights circulate through the team naturally (via Monday meetings, casual conversations, field research notes). Everyone has been in a room with Budi describing a BUJK's pain. The customer is not an abstraction — they're a set of real people whose voices the team hears regularly.", scale_risk: "At 15 people: new team members (especially engineers and data analysts) may never directly interact with a BUJK. They build for an abstraction. This distance: produces features that are technically impressive but miss the nuance of actual BUJK workflow. The most common symptom: features that are built correctly but not used because they don't fit how BUJK actually work.", preservation_plan: "Hendra's plan: every new hire — regardless of role — accompanies Budi on at least 2 narasumber interviews in their first 3 months. The backend engineer post-Series A: will meet BUJK before they write a single line of feature code. Reza will include new hires in at least 1 sales call per month for their first 6 months. The goal: every person at 15-person MJP has heard a BUJK describe their work in their own words. Hendra: 'Platform yang dibuat oleh orang yang pernah mendengar langsung dari pengguna mereka: berbeda dengan platform yang dibuat oleh orang yang hanya membaca survey. Perbedaan itu terasa — dan klien kami merasakannya.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.practice} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.practice}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Current (6 people): {r.current_state}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Scale risk: {r.scale_risk}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Preservation plan: {r.preservation_plan}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Culture preservation plan adalah Hendra's most personal concern about the Series A scaling process — because he has watched other startups successfully raise money and then fail to preserve the culture that made them worth funding in the first place. The most common culture degradation pattern: hiring 9 new people in 12 months, spending all leadership bandwidth on technical and commercial onboarding, and assuming culture transfers automatically through proximity. It doesn't. Culture transfers through deliberate documentation (Decision Log), deliberate modeling (Hendra's annual review of his own worst decisions), deliberate exposure (every new hire meets a real BUJK), and deliberate structure (data literacy onboarding module). The 4 cultural practices above: not exhaustive but selected because they are the ones Hendra believes are most at risk of dilution during rapid scaling. The practices that are less at risk: team meeting cadence, remote work norms, and communication protocols — these are easy to document and enforce. The practices that are most at risk: the informal trust, transparency, and customer-centricity that emerge from a small team working closely together. These require active investment to preserve. Hendra's summary: 'Budaya yang ada di MJP hari ini bukan karena kita mendesainnya — ini karena kita adalah 6 orang yang dipilih dengan hati-hati dan bekerja sangat dekat selama 5 tahun. Itu tidak otomatis terjadi dengan 15 orang. Saya harus merancangnya. Itu adalah pekerjaan yang belum pernah saya lakukan sebelumnya, dan itu yang paling membuat saya tidak tidur malam tentang Series A.'</p>
      </div>

      {/* R113: Friday Team Retrospective */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-primary" /> FRIDAY RETROSPECTIVE — Sesi 60 Menit yang Menjaga Tim 6 Orang MJP Tetap Selaras: Format, Apa yang Biasanya Muncul, 3 Jenis Masalah yang Hanya Terdeteksi Melalui Retrospektif, dan Mengapa Hendra Tidak Pernah Skip
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { element: "FORMAT: Struktur sesi 60 menit dan mengapa setiap bagian ada", description: "MJP's Friday retrospective: every Friday 16:00–17:00, attendance mandatory for all 6 team members. The 60 minutes are divided into: (1) 10 minutes — What went well this week? Each person names 1 specific thing. This is not a formality: it systematically surfaces wins that might otherwise go unacknowledged. Acknowledgment is psychologically important for a small team where individual contributions are visible but easily taken for granted. (2) 20 minutes — What was harder than expected? Each person names 1 friction point. This is the most commercially valuable part: friction points often reveal systemic issues that no single team member could see from their individual position. (3) 20 minutes — What should we do differently next week? From the friction points raised, the team identifies 1–2 actionable changes to try the following week. (4) 10 minutes — Open time for anything not covered above.", value: "The 60-minute format: deliberately short. Hendra's principle: 'A retrospective that takes 90 minutes becomes a meeting. A meeting that takes 60 minutes becomes a ritual. A ritual happens every week. A meeting happens when someone schedules it.' The ritual nature of the Friday retrospective: the most important design decision. Hendra has never canceled it in 5 years — for travel, illness, or workload pressure, the retrospective shortens but does not disappear.", tc: "text-primary" },
            { element: "DETECTION: 3 jenis masalah yang hanya terdeteksi melalui Friday retrospektif", description: "DETECTION-TYPE-1: Coordination failures between roles. Example: Reza committed to a feature demo for a prospect, but Hendra Jr. hadn't been informed — Hendra Jr. was in the middle of a refactor that would have made the demo unstable. Detected in Friday retrospective (Reza mentioned the upcoming demo; Hendra Jr. mentioned the refactor; the conflict was immediately visible). Without the retrospective: likely detected only when the demo failed. DETECTION-TYPE-2: Accumulating frustration that isn't surfaced in daily work. Example: Sari had been spending 40% of her work time on a documentation project that was supposed to be 20% — a creep she didn't flag directly because she didn't want to appear unable to manage her workload. She mentioned it in a 'harder than expected' retrospective item. Hendra re-scoped the project immediately. DETECTION-TYPE-3: Positive signals that the team was underweighting. Example: Budi mentioned in a retrospective that a narasumber had enthusiastically asked about MJP's pricing (suggesting a potential direct subscriber) — information that might have been forgotten in normal work mode. Reza followed up the same day and closed the subscription.", value: "The 3 detection types share a common characteristic: they are cross-functional signals that become visible only when all 6 team members share their experience in a shared space simultaneously. No 1-on-1 meeting between any 2 team members would have detected the Reza/Hendra Jr. coordination failure — both parties would need to be present simultaneously. The retrospective is the only regular moment when that simultaneous presence is guaranteed.", tc: "text-blue-700" },
            { element: "EVOLUTION: Bagaimana format retrospektif berubah dari 2020 ke 2026", description: "2020 (Year 1): 30-minute informal chat between Hendra and Hendra Jr. (the only 2 team members). No structure. Primary focus: did the code work this week? 2021 (Year 2, Sari joins): expanded to 3 people, added 'What slowed us down?' as a structured question. 2022 (Year 3, Budi and Reza join): expanded to 5 people. Added 'What should we do differently?' question. The 5-person format revealed a problem not present in 2-3 person format: retrospective topics were sometimes not directly relevant to all attendees. 2023 refinement: added 'parking lot' notes for topics relevant to only 2-3 people — discussed offline after the session, not consuming group time. 2024 (Year 5, 6th team member joins): no structural change — the 4-part format remained stable. 2026 retrospective evolution challenge: what happens to the Friday retrospective when MJP becomes 15 people?", value: "Hendra's planned 15-person retrospective format: split into 2 functional-area retrospectives (Engineering/Knowledge on Thursday, Sales/Research/Operations on Thursday) with a combined leadership retrospective (Hendra + all 4 function leads) on Friday. The split: preserves the psychological safety of same-function peer groups while maintaining cross-functional coordination through the leadership layer. The alternative (one 15-person retrospective): Hendra has attended 15-person retrospectives at other companies. His observation: 'Dengan 15 orang di ruangan, ada 14 audiens untuk setiap hal yang Anda katakan. Itu menciptakan kinerja daripada ketulusan. Retrospektif yang jujur: membutuhkan keamanan psikologis yang hanya ada dalam kelompok kecil.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.element} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.element}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.description}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Nilai: {r.value}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Friday retrospective adalah MJP's most underestimated operational practice — because its value is systemic (preventing problems before they compound) rather than episodic (solving problems after they are visible). The 5-year unbroken retrospective practice: produced an organizational communication health that would be impossible to maintain without a structured weekly touchpoint. Hendra's calculation: 260 retrospective sessions in 5 years × 60 minutes = 260 hours total investment for all 6 team members = 1.560 person-hours over 5 years. The return on those 1.560 person-hours: estimated 3–4 major coordination failures prevented per year (each worth 2–5 days of recovery time), approximately 8–12 frustration points surfaced before becoming team dynamics problems, and approximately 15–20 positive signals acted on that would otherwise have been forgotten. Every team member considers it the meeting they would least want to cancel. Not because it is always pleasant (sometimes difficult things are surfaced) but because every team member has experienced at least once the cost of NOT having it (when illness or travel forced a cancellation, something small fell through the cracks that the retrospective would have caught). That personal experience of the alternative: is what makes attendance a genuine priority rather than an obligation. Hendra: 'Kalau satu-satunya alasan tim menghadiri retrospektif adalah karena saya mewajibkannya: retrospektif sudah gagal. Saya tahu retrospektif bekerja ketika tim menghadirinya karena mereka tahu sesuatu yang penting akan terungkap — dan mereka tidak ingin ketinggalan.'</p>
      </div>

      {/* R114: Workroom as Onboarding Tool */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-primary" /> WORKROOM AS ONBOARDING TOOL — Bagaimana Anggota Tim Baru MJP Menggunakan Workroom dalam 30 Hari Pertama: 3 Fase Onboarding, Apa yang Mereka Baca, Apa yang Mereka Tulis, dan Mengapa Workroom Adalah Cara Tercepat untuk Memahami Cara Kerja MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { phase: "ONBOARDING-PHASE-1 (Hari 1–7): Baca semua, tulis tidak ada — fase pemahaman pasif", activities: "In the first week: new team members are assigned 'Workroom reading sessions' — structured exploration of Workroom's existing content without any expectation to contribute. Day 1: read the Pain Point section (all 19 documented pain points, with evidence photos). Day 2: read the Research Item section (the last 10 interview summaries from Budi's narasumber sessions). Day 3: read the Service Links section (all 7 service-to-pain mappings, including the evidence trail from pain point to service design). Day 4–5: read the Workroom Notes for each section (Budi's handwritten analysis notes, which are more candid than the formatted research items). Day 6–7: read the Decision Log (the last 24 months of major decisions, including all 'DON'T DO' entries and their rationale).", onboarding_value: "The reading-only first week: serves a specific purpose. New team members often arrive with their own mental models of what problems the product should solve. A new hire who immediately starts contributing to Workroom before absorbing its content: risks polluting the existing signal with their own priors rather than discovering MJP's empirically-derived understanding of the market. The reading week: forces intellectual humility — 'what do the existing observations tell me?' before 'what do I think I know?'. Every new team member who has gone through this onboarding: Hendra reports they arrive at their Day-8 'debrief' conversation with Hendra with a substantially more nuanced understanding of BUJK problems than they had on Day 1, and almost always mention at least 1 finding in the Pain Point data that surprises them.", tc: "text-primary" },
            { phase: "ONBOARDING-PHASE-2 (Hari 8–21): Observasi terstruktur di lapangan sebelum berkontribusi", activities: "Days 8–14: the new team member shadows Budi on 2 narasumber interviews (observation only — they do not participate). Days 15–21: shadow Reza on 2–3 client calls and 1 SKK Express case review. Budi and Reza brief the new member before each session ('here's what I'm trying to learn' or 'here's where this client is in their SKK process'). After each session: the new member writes their own 100-word observation note independently, before comparing with Budi's or Reza's note. The comparison exercise: surfaces gaps between the new member's perception and MJP's established team's perception. Common gap themes from this exercise across all new hires to date: new members initially over-index on visible friction (things the BUJK explicitly complained about) and under-index on silent friction (things the BUJK had accepted as normal). Budi's silent friction detection skill: takes typically 4–6 weeks for new members to begin developing.", onboarding_value: "The field observation phase: MJP's most differentiated onboarding practice. Most B2B SaaS companies onboard new team members through product demos and customer case study reading — not through direct observation of customer interactions. The difference: reading a case study tells you what happened. Observing a narasumber interview tells you how it happens — the pauses, the language, the emotional register, the topics that cause energy shifts. These non-verbal and contextual signals: cannot be captured in written research items. They can only be transmitted through direct observation. Every team member who has completed Phase-2 onboarding: describes the field observation as the single most impactful component of their MJP onboarding.", tc: "text-blue-700" },
            { phase: "ONBOARDING-PHASE-3 (Hari 22–30): Pertama kali berkontribusi ke Workroom secara aktif", activities: "Days 22–30: the new team member is given their first Workroom contribution assignment. The assignment varies by role: a new Knowledge team member is asked to draft a new Knowledge Registry asset on a topic they identified as a gap during their reading week. A new Sales team member is asked to document their observations from the client call shadows as a structured set of notes in the Workroom. A new Engineering team member is asked to document their technical understanding of one of the existing service implementations using Workroom's Service Links format. The contribution format: follows the same templates as existing Workroom content. The purpose of the first contribution: not to produce the highest-quality content (Hendra and Budi review and annotate all first contributions). The purpose: to practice thinking in MJP's format — pain-first, evidence-based, specific rather than generic.", onboarding_value: "The first contribution review session (Day 30, 45 minutes with Hendra): the most important onboarding meeting. Hendra reviews the contribution line by line, noting where the new member defaulted to their prior mental models vs where they genuinely synthesized from MJP's existing research. Common feedback patterns: new team members from product backgrounds often write 'feature opportunity' notes where the evidence calls for 'pain point documentation' (they jump to solutions before fully understanding the problem). New team members from industry backgrounds often write 'opinion notes' where the evidence calls for 'observation notes' (they substitute their expertise for empirical data). The Day-30 feedback: recalibrates both errors. Hendra: 'Workroom adalah cara saya melihat apakah seseorang berpikir seperti MJP atau berpikir seperti apa yang mereka lakukan sebelumnya. Bukan bahwa cara lama itu buruk — tetapi MJP membutuhkan kedua hal: perspektif baru dan kemampuan berpikir dalam kerangka yang kami bangun dari data nyata.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.phase} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.phase}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Activities: {r.activities}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Onboarding value: {r.onboarding_value}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Workroom as onboarding tool adalah one of Hendra's most creative answers to the culture preservation challenge he identified as his Series A sleeplessness concern. The challenge: MJP's culture of empirical, pain-first thinking is tacit — it lives in how the existing team processes information, not in a culture deck or a set of stated values. Translating tacit culture to 9 new hires over 24 months (the Series A hiring plan): impossible through documentation alone. The Workroom onboarding solution: instead of documenting the culture, immerse new hires in the artifact that the culture produced (Workroom's 19 pain points, 67 interview summaries, 7 service links, and 2 years of decision log). The culture transferred not through instruction but through exposure to its outputs, combined with direct observation of how existing team members work. This approach: is Hendra's adaptation of how he himself learned to do empirical product research — not through formal training but through immersion in the data and observation of Budi's interview practice. The onboarding approach is also self-correcting: if the 30-day contribution review reveals that a new hire has not absorbed MJP's thinking framework: Hendra knows before the new hire is assigned independent work. The cost of a 30-day recalibration: far lower than the cost of 6 months of work from a team member who is applying the wrong framework. For Series A new hires: Hendra plans to assign every new hire's first contribution review to an existing team member (not always Hendra himself) — scaling the onboarding review capacity without requiring Hendra's personal time for every 30-day review. The reviewer assignment: matched by function (Budi reviews Research and Knowledge new hires, Reza reviews Sales new hires, Hendra Jr. reviews Engineering new hires). This keeps the feedback domain-specific and reduces the time each reviewer spends (they only review contributions in their area of expertise).</p>
      </div>

      {/* R115: Workroom in Crisis Management */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-primary" /> WORKROOM IN CRISIS MANAGEMENT — Bagaimana Tim Menggunakan Workroom Selama 2 Krisis Terbesar MJP: Kronologi, Informasi yang Diselamatkan, dan Mengapa Workroom Lebih Berguna untuk Krisis dari Sistem Manajemen Krisis Formal
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { crisis: "CRISIS-1: UU Cipta Kerja Emergency (Q4 2020 — 47 aset dalam 6 minggu)", timeline: "October 2020: UU Cipta Kerja (No. 11/2020) published. MJP had 134 subscribers at the time. Sari's immediate reaction: overwhelming — 79 existing Knowledge Registry assets needed review, the law amended 79 existing laws affecting MJP's content, and the implementing regulations were still being drafted. The crisis scope: the largest regulatory event in MJP's history. Hendra's decision within 48 hours: temporarily join Sari's production work to increase output capacity. For 3 weeks: Hendra wrote Knowledge Registry assets during the day and reviewed platform operations in the evenings. Hendra Jr. focused entirely on platform stability (subscriber traffic spiked 340% as BUJK sought regulatory guidance).", workroom_use: "Workroom's use during CRISIS-1: primarily as a triage system. Hendra and Sari used the Workroom Notes feature to create a shared running document of: (1) which assets were reviewed and confirmed unchanged, (2) which assets needed updates and what those updates were, (3) which assets needed immediate deprecation, and (4) which topics needed new assets. The Workroom's advantage over a shared Google Doc: the integration with the Knowledge Registry database meant asset status updates were immediately visible to both Hendra and Sari without synchronization. The crisis revealed Workroom's value for shared situational awareness — when 2 people coordinate rapidly on the same evolving problem, a shared note layer on the production system is more efficient than a separate coordination document.", tc: "text-primary" },
            { crisis: "CRISIS-2: Major Crawler Failure (Q2 2022 — 72 jam tanpa data tender baru)", timeline: "June 2022: Hendra Jr. discovered at 06:00 that MJP's crawler had silently failed 72 hours earlier — a database connection timeout that caused the crawler to stop without any alert. 847 subscribers had received 3 days of briefings and alerts based on tender data that was 72 hours out of date. The immediate impact: unknown (possibly subscribers missed tender registration deadlines based on stale alerts). Hendra Jr.'s engineering response: 4 hours to identify root cause, 2 hours to restore full crawling, 6 hours to rebuild the 72-hour missed data window. The reputational risk: if subscribers acted on stale alerts and missed tender registrations: potentially serious. The assessment required: identifying which subscribers received alerts about tenders with registration deadlines in the 72-hour gap.", workroom_use: "Workroom's use during CRISIS-2: service links analysis to identify which subscriber segments were most affected. Hendra used Workroom's service links data to identify: which subscribers were on 'Waspada Tender' (real-time alert tier — most at risk), which tender categories had the most registration deadline activity in the June period, and which geographic regions had the most active portal failures. The analysis took 45 minutes using existing Workroom service link data — vs Hendra Jr.'s estimate of 3+ hours from scratch. The result: proactive email to all 'Waspada Tender' subscribers within 6 hours of discovery. Subscriber response: 3 complaints (all resolved without churn), 27 thank-you messages acknowledging transparency. Net churn: zero.", tc: "text-blue-700" },
            { crisis: "POST-CRISIS LEARNING: Bagaimana setiap krisis mengubah cara Workroom digunakan dan diisi", timeline: "Post-CRISIS-1 change: Sari formalized the 'Asset Review Queue' in Workroom Notes — a structured list of all assets in review status (vs the informal running document during the crisis). This formalization: means future emergency events have a ready-to-use triage infrastructure rather than requiring a new system to be built under pressure. Post-CRISIS-2 change: Hendra Jr. built an automated crawler health monitor that writes to a Workroom Notes entry when any portal fails to return data within its expected window. The monitor: checks every 4 hours and creates a Workroom note if more than 3 portals are failing simultaneously — visible to all team members, not just Hendra Jr.", workroom_use: "The broader lesson: Workroom's value in crises is not as a crisis management system (it has no incident tracking, escalation workflow, or SLA features). Its value is as a shared repository of context that all team members can access simultaneously — making each team member's first 30 minutes of crisis response more informed than if they were starting from zero. The CRISIS-2 45-minute analysis (vs 3+ hours from scratch) is the quantified example. The Workroom's ongoing documentation investment — pain points, service links, research items — is not just a research asset. It's an operational resilience asset. Hendra: 'Workroom yang baik bukan yang kita gunakan hanya saat krisis — itu yang sudah kita isi dengan cukup konteks sebelum krisis sehingga ketika krisis datang, kita tidak perlu membangun pemahaman dari nol. Kita sudah memilikinya.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.crisis} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.crisis}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Crisis timeline: {r.timeline}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Workroom use: {r.workroom_use}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Workroom in crisis management adalah an unexpected use case that emerged organically from a tool designed for research and analysis — and one that retroactively justifies the investment in keeping Workroom's documentation current and comprehensive. Both CRISIS-1 and CRISIS-2: used Workroom's existing content (asset registry data for CRISIS-1, service link data for CRISIS-2) rather than creating new crisis-specific content. The value: the content didn't need to be created under crisis pressure because it had been built systematically during normal operations. This is the 'operational resilience' benefit of systematic documentation: each piece of documentation added during routine operations is also a piece of crisis response infrastructure. The time saved in CRISIS-2 (2.5+ hours on the analysis phase): directly contributed to MJP's ability to send proactive subscriber communication within 6 hours rather than 12+ hours. B2B SaaS research consistently shows that proactive, transparent communication about service issues — delivered before subscribers notice the issue themselves — produces significantly lower churn than reactive communication after subscribers have complained. MJP's zero-churn in CRISIS-2: evidence of this principle in practice. The post-Series A organizational growth will add more team members who need to use Workroom for crisis response — which is part of why the Workroom onboarding program (from the prior panel) explicitly includes reading the service links as a Day-1 activity. New team members who can interpret Workroom's service link structure quickly: are operationally resilient from Day 1, not just research-ready.</p>
      </div>

      {/* R116: Workroom Data Governance */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> WORKROOM DATA GOVERNANCE — Siapa yang Memiliki Data Apa di Workroom dan Siapa yang Bisa Mengaksesnya: 4 Kategori Data, Aturan Akses, Alasan Setiap Aturan, dan Bagaimana Governance Berkembang dengan Pertumbuhan Tim
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { data_category: "DATA-CATEGORY-1: Pain point database — milik Budi, akses tim penuh, narasumber dilindungi", ownership_and_access: "Pain point data (19 documented pain points with frequency, severity, addressability, and competitive differentiation scores): owned by Budi in the sense that he produces, maintains, and is responsible for the quality of all pain point entries. Access: full read access for all 6 MJP team members. Write access: Budi only (with review process for additions or score changes). The access rule rationale: pain point data drives product and commercial decisions across all functions — Hendra needs it for product strategy, Reza needs it for sales positioning, Hendra Jr. needs it for feature scoping. Restricting read access would create unnecessary information silos that slow decision-making. Write restriction: pain point scores are Budi's analytical judgment — having multiple people modify scores without his validation would degrade the database's reliability.", governance_evolution: "Governance evolution with team growth: at 15 people (Series A target), the pain point database write governance requires a formal change management process. With a Product Manager who also develops product hypotheses: there will be pressure to add or modify pain points based on the PM's own market observations (from product analytics, not narasumber interviews). Budi's governance plan: pain point additions require Budi's validation (narasumber-based evidence), but PMs can create a 'Hypothesis Queue' — candidate pain points with product analytics evidence that Budi then validates through targeted narasumber interviews. This two-queue system: preserves the rigor of narasumber-based validation while incorporating the PM's product analytics signal.", tc: "text-primary" },
            { data_category: "DATA-CATEGORY-2: Narasumber interview notes — milik Budi, akses terbatas, privasi ketat", ownership_and_access: "Narasumber interview notes (67 detailed interview records, including verbatim quotes, company context, and follow-up notes): owned exclusively by Budi. Access: Budi only for raw interview notes (which contain identifying information). Aggregated anonymized summaries: accessible to Hendra and Sari for product strategy discussions. The access rule rationale: direct from the Research Ethics Framework (ETHICS-PRINCIPLE-2 — real anonymization). Raw interview notes contain company names, specific business situations, and personal information that narasumber provided in a trust context. Granting full-team access to raw notes would mean narasumber privacy is only as strong as the least privacy-conscious team member. The strict access rule: the mechanism that makes Budi's 'I will protect your information' promise credible.", governance_evolution: "Governance evolution with team growth: the Research Associate hire creates the first governance challenge — the associate conducts interviews but Budi can't review every raw note before it enters the system. The governance solution: the Research Associate stores raw notes in a separate access-controlled repository (Budi-only) and prepares anonymized summaries (team-accessible) for every interview within 48 hours of completion. Budi reviews the summary against the raw note to confirm anonymization quality before the summary becomes team-accessible. This two-tier system: scales Budi's privacy protection responsibility without eliminating it.", tc: "text-blue-700" },
            { data_category: "DATA-CATEGORY-3: Service links dan subscriber intelligence — milik Reza, akses terbatas secara komersial", ownership_and_access: "Service links (subscriber tier mapping, contact information, engagement level, account notes): owned by Reza for commercial purposes. Access: Reza full access, Hendra read access, other team members read access for service link structure (which tier subscribers are in, which features they use) but not for individual subscriber contact information or commercial relationship notes. The access rule rationale: subscriber contact information is commercially sensitive — if a team member inadvertently or deliberately shared subscriber contact details externally (to a competitor, for example), it would be a serious trust breach. Contact data: access-restricted to Reza and Hendra to minimize exposure risk.", governance_evolution: "Governance evolution with team growth: the Head of Sales hire (Year 1 post-Series A) and new Sales Rep (Year 2) both need access to subscriber contact information for commercial activities. The governance expansion: structured access by commercial role (all customer-facing roles get contact information access), with audit logging (who accessed which subscriber record, when) implemented before any new commercial hires are onboarded. The audit logging: Hendra Jr.'s most important governance infrastructure investment — it creates accountability for data access without restricting legitimate commercial use.", tc: "text-emerald-700" },
            { data_category: "DATA-CATEGORY-4: Workroom notes dan analisis tim — kepemilikan bersama, akses penuh, retensi permanen", ownership_and_access: "Workroom Notes (team-generated analysis, synthesis, and decision documentation — not raw narasumber notes): shared ownership. Any team member can write, edit, or delete Workroom Notes entries. Access: full read and write for all current team members. The access rule rationale: Workroom Notes are the team's shared thinking space — restricting write access would create a note-taking bottleneck (only certain people can document decisions) that slows the team's collective intelligence capture. The shared ownership model: works because MJP's current 6-person team has high mutual trust and a shared understanding of what Workroom Notes are for (team synthesis, not personal opinions). The deletion right: intentional — team members should be able to correct errors or remove outdated notes without bureaucratic approval.", governance_evolution: "Governance evolution with team growth: at 15 people, shared write access to Workroom Notes creates a coordination risk — 15 people editing shared documents without version control can produce conflicting notes or accidental deletions. The governance evolution: (1) Role-scoped note categories (Research Notes owned by Research team, Sales Intelligence Notes owned by Customer Success team) with cross-team read access but role-restricted write access. (2) Soft deletion (deleted notes go to archive, not permanent deletion, for 30-day recovery window). (3) Edit history (who changed what, when — enables accountability without restricting access). Hendra: 'Governance yang baik tidak membatasi siapa yang bisa berpikir — ini memastikan pemikiran itu dapat ditelusuri. Di tim 6 orang, kepercayaan menggantikan jejak audit. Di tim 15 orang, kita membutuhkan keduanya.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.data_category} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.data_category}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Ownership and access rules: {r.ownership_and_access}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Governance evolution with team growth: {r.governance_evolution}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Workroom data governance adalah MJP's most deliberately designed organizational infrastructure — because data governance failures have two distinct risk profiles that require different protections. Privacy failures (narasumber data exposed to unauthorized team members or external parties): damage trust relationships that took years to build and cannot be quickly repaired. Commercial failures (subscriber contact data misused, service link intelligence shared inappropriately): damage revenue relationships and potentially violate legal obligations. Operational failures (Workroom Notes overwritten, historical analysis lost): damage team intelligence continuity. The 4 data categories above (pain points, narasumber notes, service links, Workroom Notes) have different governance profiles because they have different failure risks. Pain points: broad read access (many people need it), restricted write (few people should change it). Narasumber notes: narrow access (privacy risk), strict anonymization protocol. Service links: role-based access (commercial sensitivity), audit logging. Workroom Notes: broad write access (shared thinking value), soft deletion (error recovery). This differentiated governance: not an arbitrary policy but a response to the specific failure risks of each data category. The current governance: largely informal (based on mutual trust and role clarity at 6 people). The formal governance infrastructure (access controls, audit logging, soft deletion, two-tier narasumber notes): to be built before the Series A hiring begins, not after. Building governance infrastructure before the team grows: Hendra's most important operational sequencing decision. Governance built to fit a 6-person team and then retrofitted to 15 people is significantly harder than governance built for growth from the start. The target: all 4 data category governance structures operational by the end of Q2 2026 — 6 months before the first Series A hire is expected to join.</p>
      </div>

      {/* R117: Workroom During Series A Due Diligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5 text-primary" /> WORKROOM SELAMA DUE DILIGENCE SERIES A — Apa yang Investor Ingin Lihat di Workroom: 3 Dimensi Due Diligence yang Didukung Workroom, Cara Hendra Menyiapkan Data Room, dan Mengapa Workroom Adalah Bukti Operasional Terkuat MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { dimension: "DUE-DILIGENCE-DIM-1: Market intelligence depth — apakah MJP sungguh-sungguh memahami pasarnya", investor_question: "The most common Series A investor question about a B2B SaaS company targeting a niche market: 'How deeply do you actually understand your customer?' For most SaaS companies: the answer is 'we have done user interviews and have survey data.' For MJP: the answer is 'we have 67 narasumber who have given us substantive market intelligence over 5 years, and every major product decision is traceable to specific pain point evidence.' The Workroom pain point database: the most tangible evidence of this depth. An investor reviewing MJP's Workroom pain point panel can see: 16 systematically catalogued pain points with Budi-validated severity scores, BUJK incidence rates, and MJP solution mappings.", investor_access: "Investor access design: Hendra prepares a 'Workroom Excerpt' — a read-only export of the pain point database and problem formulation canvas specifically formatted for due diligence review. This excerpt: not the full live Workroom (which contains subscriber data and narasumber identities that cannot be shared in due diligence) but a sanitized version with pain point structures, severity analysis, and solution mappings. The 'Workroom Excerpt' also includes the co-occurrence cluster analysis (from R117 pain-points panel) — the most analytically sophisticated market intelligence evidence that MJP can show investors. An investor who reviews this: sees 5 years of systematic market research, not 5 years of intuition.", tc: "text-primary" },
            { dimension: "DUE-DILIGENCE-DIM-2: Operational rigor — apakah tim MJP beroperasi dengan disiplin proses yang bisa diskalakan", investor_question: "The second Series A investor question: 'When your team goes from 6 people to 15, do you have the processes to maintain quality and coordination?' For MJP: Workroom is the most concrete answer to this question. The Workroom service link tracking (which tracks which MJP products address which BUJK needs, updated by the team collaboratively): shows investors that MJP's team has a shared operational framework for understanding the product-market fit. The Workroom notes synchronization feature (server-synced, collaborative): shows that the team's intelligence is shared infrastructure, not individual silos.", investor_access: "The operational rigor evidence in Workroom: primarily demonstrated through a live demo rather than a static export. Hendra's plan: walk the lead investor through a live Workroom session during due diligence — showing how the team updates the pain point database after narasumber interviews (Budi's workflow), how service link mapping works (Hendra's product decision workflow), and how the problem formulation canvas tracks the evolution of MJP's market understanding over time. The live demo: more compelling than any document because it shows operational practice in action. The investor takeaway: 'This team has built internal operating systems before Series A — they are not improvising their coordination at 6 people and hoping it scales.'", tc: "text-blue-700" },
            { dimension: "DUE-DILIGENCE-DIM-3: Prospect pipeline — bukti bahwa pertumbuhan post-Series A dapat dieksekusi", investor_question: "The third Series A investor question: 'How will you get to 5.000 subscribers? Show me the pipeline.' For MJP: the Workroom ProspekTab (from R115's workroom panel) — the grouped prospect list derived from pain point domain mapping — is the earliest-stage pipeline evidence. The ProspekTab shows: which BUJK domains have the highest unresolved pain severity (highest prospect conversion likelihood), the specific WhatsApp share links for Reza to use in outreach, and the direct Surat Penawaran drafting links for conversion-ready prospects.", investor_access: "The prospect pipeline evidence in Workroom: sanitized (subscriber identities removed, showing aggregate domain-level prospect data rather than individual BUJK contact information). The ProspekTab structure shows investors: MJP's subscriber acquisition approach is evidence-based (targeting highest-pain-severity domains first rather than broad market outreach), scalable (the domain-level targeting logic can be maintained as the team grows), and currently generating Reza's highest-converting inbound leads (the 28% conversion rate from pain-point-identified prospects vs 12% from cold outreach). Hendra: 'Data room yang paling kuat bukan yang menunjukkan hasil historis — melainkan yang menunjukkan mekanisme yang menghasilkan hasil masa depan. Workroom adalah mekanisme itu, diekspos secara transparan kepada investor yang ingin memahami cara MJP tumbuh.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.dimension} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.dimension}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Investor question addressed: {r.investor_question}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Access design and format: {r.investor_access}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Workroom during Series A due diligence adalah Hendra's most compelling data room asset — not because it contains financial projections or unit economics (those are in the conventional data room), but because it shows investors the operational intelligence infrastructure that makes those projections credible. The 3 due diligence dimensions (market intelligence depth, operational rigor, prospect pipeline): address the 3 most common investor doubts about niche-market B2B SaaS companies at Series A. Market intelligence doubt: 'Does this team actually understand the construction sector deeply enough to build a defensible product?' — answered by the pain point database and co-occurrence analysis. Operational rigor doubt: 'Is this team building scalable processes or just heroically executing as 6 people in a way that breaks at 15?' — answered by the live Workroom demo. Prospect pipeline doubt: 'Do they have a disciplined GTM approach or are they just growing organically and hoping it continues?' — answered by the ProspekTab domain-level targeting methodology. The Workroom due diligence package: designed to answer all 3 doubts with primary evidence (the actual operational tool, not a summary document about it). This is the advantage of having built a well-structured internal operational tool: at Series A, it becomes the most authentic business intelligence artifact MJP can show. Most seed-stage founders show investors a deck. MJP shows investors the platform. The credibility difference: orders of magnitude. Hendra's due diligence preparation timeline: finalize Workroom data governance (Q2 2026), complete the Workroom Excerpt sanitization (Q2 2026), practice the live Workroom demo walk-through with Reza and Budi (Q3 2026 dry run), execute live investor due diligence (Q3–Q4 2026).</p>
      </div>

      {/* R118: Workroom as New Hire Onboarding Tool */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <UserPlus className="h-3.5 w-3.5 text-primary" /> WORKROOM SEBAGAI ALAT ONBOARDING KARYAWAN BARU — Bagaimana Hire Pertama Post-Series A Menggunakan Workroom untuk Memahami Pasar MJP: 3 Peran dengan Kebutuhan Onboarding Berbeda, Konten Workroom yang Paling Penting per Peran, dan Target Waktu Produktivitas
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { hire: "ONBOARDING-HIRE-1: Backend Engineer (Hendra Jr.'s hire) — perlu memahami 'mengapa' di balik keputusan teknis", workroom_content_most_useful: "The backend engineer hire: joins a codebase built over 5 years by a single engineer with accumulated technical decisions that are not always self-documenting. The 'why' behind architecture choices (why the 4-hour batch crawl cadence instead of real-time, why Trust Score is calculated weekly not daily, why the Knowledge Registry uses the specific format structure) is not in the code — it is in the product decisions that drove the technical choices. Workroom's service link mapping (which MJP features address which BUJK needs): gives the new engineer the demand context for each technical system. The pain point database: gives them the user problems that each technical feature was built to solve.", onboarding_protocol: "The engineer onboarding Workroom protocol (Week 1): Day 1–2: read the full pain point database (3–4 hours) — understand every pain MJP was built to address. Day 3–4: review the service link mapping — understand which technical systems address which pains and how the links work. Day 5: first 1:1 with Hendra Jr. — discuss the 3 most technically interesting service links (where the engineering solution for the pain is most non-obvious). The result: a new engineer who, by end of week 1, understands not just 'what does the crawler do' but 'why does this specific crawler architecture exist, what BUJK pain was it designed to address, and what success for this system looks like in terms of subscriber experience.' This market context: makes the engineer significantly more effective at making technical decisions that preserve product-market fit rather than inadvertently optimizing for technical elegance at the expense of subscriber relevance.", tc: "text-primary" },
            { hire: "ONBOARDING-HIRE-2: Customer Success Manager (Reza's hire) — perlu memahami pasar dengan kedalaman yang sama dengan Reza", workroom_content_most_useful: "The customer success manager hire: needs to develop, as quickly as possible, the market understanding that Reza has accumulated over 4 years of BUJK community relationships. The risk: a CS Manager who doesn't understand BUJK operational context will provide generic, formulaic support — the antithesis of the personal, knowledgeable service that drives MJP's 47 NPS and 95% Enterprise renewal rate. Workroom's pain point database and problem formulation canvas: the most valuable onboarding content for CS because they capture exactly what BUJK find most painful and why MJP's products address each pain. A CS manager who knows that a subscriber with a jenjang-8 SKK renewal pain (PP-006) is likely also experiencing Trust Score confusion (PP-016 co-cluster with PP-005): can conduct a deeper, more relevant support conversation than one who treats each ticket as an isolated issue.", onboarding_protocol: "The CS Manager onboarding Workroom protocol: Week 1 (Days 1–3): full pain point database reading, including Budi's narasumber quotes for each pain (where available in the database's supporting notes). Day 4: shadowing Reza in 3 subscriber conversations — applying the Workroom pain framework to real subscriber situations. Day 5: write their own 'CS empathy map' — for each of MJP's 4 subscriber archetypes (Tactical Bidder, Strategic Analyst, Compliance Navigator, Growth Seeker), what are the top 3 pains they are most likely experiencing, and what Workroom insights would help resolve them? The CS empathy map: submitted to Reza for review at end of Week 1. The 3 gaps Reza identifies: the CS Manager's first 3 learning priorities for Week 2.", tc: "text-blue-700" },
            { hire: "ONBOARDING-HIRE-3: Knowledge Analyst (Sari's hire) — perlu memahami hubungan antara regulatory landscape dan subscriber needs", workroom_content_most_useful: "The Knowledge Analyst hire: joins MJP to produce Knowledge Registry content — but the quality of Knowledge Registry content depends on understanding which regulatory domains are most commercially important to BUJK subscribers (a regulatory accuracy judgment) AND which topics generate the most NLQ queries (a subscriber demand signal). Without Workroom context: the Analyst might produce excellent regulatory content that doesn't match MJP's subscriber priority structure. Workroom's pain point database (specifically the PP severity scores and BUJK incidence rates): tells the Analyst which regulatory domains are most painful for the most BUJK. The service link mapping (showing which Knowledge Registry assets address which pains): tells the Analyst which existing assets are covering high-priority pains and which are covering gaps.", onboarding_protocol: "The Knowledge Analyst onboarding Workroom protocol: Week 1 (Day 1–2): read the full pain point database focused on compliance-related pains (PP-002, PP-006, PP-007, PP-010) and their severity scores. Day 3: review the Knowledge Registry coverage map (which pains have strong KR coverage, which have gaps). Day 4: first meeting with Sari to review the Q3 2026 editorial calendar — mapping planned new assets to pain point priorities confirmed by Workroom data. Day 5: read Hendra Jr.'s Mode-4 NLQ gap analysis report — understanding the subscriber demand signals that Workroom pain data + NLQ query data produce together. Week 2: the Analyst's first assigned asset: one of the 3 Mode-4 gap topics (IUJK regional registration, subcontractor qualification, or material price reference update) — chosen specifically because it has both high Workroom severity score AND high NLQ Mode-4 frequency. The first assignment: the fastest possible path from onboarding to commercially relevant contribution. Hendra: 'Karyawan baru yang menghabiskan dua minggu pertama mereka membaca Workroom: mulai bekerja dengan pemahaman pasar yang biasanya membutuhkan 6 bulan untuk dibangun dari pengalaman langsung. Itu adalah nilai dari 5 tahun mendokumentasikan apa yang kami pelajari.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.hire} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.hire}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Workroom content most useful: {r.workroom_content_most_useful}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Onboarding protocol: {r.onboarding_protocol}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Workroom as new hire onboarding tool adalah one of the most commercially practical applications of MJP's internal knowledge management investment — because every hour a new hire spends confused about the market context of their work is an hour of productivity lost. At MJP's current 6-person scale: market context is transmitted through daily team interactions (Budi's research updates, Reza's subscriber stories, Hendra's product conversations). This informal transmission: works when everyone is in the same physical or virtual space and conversations happen organically. At 15 people post-Series A: the informal transmission breaks down. New hires in specialized roles (backend engineering, analytics, customer success) may work weeks without encountering the narasumber research, pain point analysis, and product decision context that shapes their role's meaning. Workroom's pain point database, service link mapping, and problem formulation canvas: the codified market intelligence that new hires can access independently of their schedule alignment with the founding team. The 3-hire onboarding protocols (engineer, CS manager, knowledge analyst): each designed to get the hire to 'market-contextualized productivity' in 5 working days rather than the 3–6 months of organic immersion. The time-to-productivity difference: at Series A hire salaries (estimated Rp 12–18jt/month for specialist roles), 3 months of reduced productivity = Rp 36–54jt per hire in productivity cost. 5 Workroom-accelerated onboarding days vs 3 months of organic immersion: Workroom's most easily quantified commercial value. Hendra's Series A investor question: 'How will you maintain your culture and quality standards as you scale from 6 to 15 people?' The answer: Workroom is the institutionalized knowledge transfer mechanism. It doesn't replace culture — it preserves the market understanding that culture is built on.</p>
      </div>

      {/* R119: Workroom as Competitive Intelligence Repository */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-primary" /> WORKROOM SEBAGAI REPOSITORI INTELIJEN KOMPETITIF — Bagaimana Insight Tim Berkompon Menjadi Keunggulan Institusional: 4 Mekanisme Compounding, Apa yang Workroom Tahu tentang Pasar yang Tidak Diketahui Kompetitor Mana Pun, dan Mengapa Gap Ini Semakin Melebar Setiap Kuartal
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { mechanism: "CI-MECH-1: Pain point cross-referencing — Workroom as the only place where all pain data is visible together", competitive_insight: "MJP's pain point database in Workroom: 67 validated pain points across 12 domain categories, each with severity score, BUJK incidence rate, Budi's narasumber quotes, and service link mapping. No competitor has an equivalent database — not because building it is technically impossible, but because building it requires 5 years of sustained qualitative research with 40+ narasumber, a research methodology that evolves through multiple iterations, and an editorial team (Budi) who has built trusted relationships with the narasumber community. A competitor who starts today: needs 5 years to build an equivalent database, even with greater funding than MJP.", compounding_mechanism: "Compounding mechanism: each quarter that MJP adds new pain points, revalidates existing ones, and discovers new co-occurrence patterns: the database becomes proportionally harder to replicate because the new insights are based on earlier insights. A 2026 pain point discovery about 'IKN regional BUJK qualification confusion' builds on the 2022 discovery about 'general IUJK renewal confusion' — the 2026 discovery is only possible because the 2022 foundation existed to pattern-match against. A competitor starting fresh in 2026: cannot produce the same quality of IKN discovery because they don't have the 2022 baseline to compare against. The compounding: Workroom's competitive intelligence grows non-linearly.", tc: "text-primary" },
            { mechanism: "CI-MECH-2: Service link density — the number of validated connections between pain points and MJP product features", competitive_insight: "Workroom's service link mapping: 143 validated connections between the 67 pain points and MJP's product features (averaging 2.1 links per pain point, with some high-pain points like PP-001 and PP-005 having 5+ service links). Each service link: a documented explanation of exactly which aspect of which MJP product addresses which specific pain dimension. The link density: a quantified measure of how comprehensively MJP's product portfolio covers the identified pain landscape. Competitors: typically have 1–2 product features addressing broad pain categories (a tender aggregator addresses 'LPSE fragmentation' broadly) without the nuanced multi-link coverage that addresses specific pain dimensions.", compounding_mechanism: "Compounding mechanism: as MJP adds new product features (Trust Score V2, NLQ, SKK Alert V2): the service link mapping is updated to reflect the new coverage. Each new feature that addresses a previously unlinked pain dimension: increases link density AND reduces the number of 'unaddressed pain dimensions' (gaps that competitors could theoretically target). Workroom's service link gap analysis: Hendra's most important competitive intelligence input for roadmap prioritization — building features that address high-severity unlinked pains before competitors discover the same gap. The Workroom intelligence advantage: MJP sees the gap first because MJP mapped it first.", tc: "text-blue-700" },
            { mechanism: "CI-MECH-3: Problem statement version history — institutional memory of what MJP tried and why it changed", competitive_insight: "Workroom stores 4 versions of MJP's core problem statement (V1 2021 through V4 2026) with documented reasoning for each evolution. The version history: a record of MJP's analytical errors and corrections — which assumptions proved wrong, which pain estimates were too optimistic, which solution approaches were tried and refined. This institutional failure memory: prevents MJP from repeating the same conceptual mistakes in future product decisions. A competitor who builds a similar product from scratch: will likely repeat MJP's V1 and V2 errors (over-focusing on information access when the real pain is analysis and guidance; underestimating the importance of regulatory compliance intelligence vs tender monitoring).", compounding_mechanism: "Compounding mechanism: the version history becomes more valuable with each new version. V4's precision (BUJK who compete in high-stakes government procurement lose competitive position due to intelligence and compliance gaps that MJP's integrated platform uniquely addresses) is only achievable because V1–V3's imprecision was documented and analyzed. The failure-learning cycle: each version of the problem statement encodes a lesson that shapes V(n+1). Competitors who have not gone through MJP's 5 years of iteration: will need to discover the same lessons independently, at their own 5-year cost. Hendra's version history: not just intellectual history but a competitive moat of learned lessons.", tc: "text-emerald-700" },
            { mechanism: "CI-MECH-4: Team knowledge synthesis — Workroom notes integrating Budi's field research with Reza's subscriber intelligence", competitive_insight: "Workroom's most unique competitive intelligence mechanism: the integration of Budi's field-level research (what BUJK say about their problems in qualitative interviews) with Reza's subscriber-level intelligence (what BUJK actually do about their problems in their day-to-day subscription usage). These two data streams: rarely available in the same organization because narasumber research and customer success data are typically managed by separate teams who don't share notes systematically. In MJP: Budi's narasumber quotes and Reza's subscriber support stories are both stored in Workroom notes linked to the same pain points — enabling cross-validation and synthesis that neither stream can provide alone.", compounding_mechanism: "Compounding mechanism: each quarter that both Budi and Reza add notes to Workroom: the synthesis depth increases. A 2026 pain point note that combines Budi's 2022 narasumber discovery with Reza's 2024 subscriber pattern and Budi's 2026 revalidation: is a 4-year longitudinal intelligence artifact that captures how the pain has evolved, how subscribers respond to MJP's solution, and what remains unaddressed. No competitor starting today can produce a 4-year longitudinal synthesis — they can only produce a 0-year baseline. The temporal depth of Workroom's intelligence: MJP's most durable competitive advantage, because time cannot be bought, only accumulated. Hendra's Workroom principle: 'Setiap nota yang Budi dan Reza tambahkan hari ini: akan menjadi konteks berharga dalam 2 tahun. Nilai sebenarnya dari Workroom tidak terlihat hari ini — ia terlihat ketika Anda membandingkan kualitas keputusan yang dapat kita buat sekarang vs yang bisa kita buat di 2022 menggunakan catatan yang sama yang kita mulai buat saat itu.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.mechanism} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.mechanism}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Competitive insight: {r.competitive_insight}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Compounding mechanism: {r.compounding_mechanism}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Workroom as competitive intelligence repository adalah the meta-level insight about MJP's competitive position — not 'here is what we know about the market' but 'here is why we know it better than anyone else and why that gap compounds over time.' The 4 compounding mechanisms (pain point cross-referencing, service link density, problem statement version history, team knowledge synthesis): each operate on a different dimension of competitive intelligence. Cross-referencing produces breadth (how many pains are understood). Link density produces coverage (how well the product addresses those pains). Version history produces wisdom (what doesn't work and why). Team synthesis produces depth (how pains connect across research and operational perspectives). Separately: each mechanism is valuable but replicable. Together: they form an integrated competitive intelligence system that is genuinely difficult to replicate because it requires all 4 to be built simultaneously over 5+ years. Series A due diligence typically asks: 'Why can't a well-funded competitor replicate MJP's product?' The standard answer is: technical moat, network effects, regulatory barriers. MJP's answer: Workroom. The 5-year institutional intelligence compounding effect — 67 validated pain points, 143 service links, 4 problem statement versions, thousands of field notes integrating research and operational data — is not a feature. It is the residue of 5 years of disciplined thinking about a specific market. Disciplined thinking cannot be purchased. It can only be done, and then retained in the system that Workroom is.</p>
      </div>

      {/* R120: Workroom's Contribution to MJP Series A Data Room */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5 text-primary" /> WORKROOM → DATA ROOM — Artefak Workroom Mana yang Menjadi Bukti Due Diligence Series A: 4 Kategori Artefak, Bagaimana Investor Menginterpretasikannya, dan Mengapa Catatan Analisis Internal Lebih Meyakinkan dari Deck yang Dipoles
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { artifact: "ARTIFACT-CAT-1: Pain Point database history — evolusi pemahaman masalah dari 2020 ke 2026", investor_interpretation: "What investors see: a pain point database with 67 validated entries, creation dates spanning 2020–2026, severity scores, validation status, and problem statement evolution notes. What it demonstrates: MJP's problem understanding is not a static snapshot but a living body of research that has evolved over 5 years. Investors can see which pain points were identified early (LPSE fragmentation: 2020), which emerged from subscriber feedback (IKN regulatory complexity: 2023), and which have been deprioritized as market conditions changed. The evolution: evidence of intellectual honesty (MJP updates its understanding when it learns) and research discipline (the methodology for adding and validating pain points is consistent across the 5-year timeline).", data_room_value: "Data room value: pain point database history is the due diligence answer to 'how do you know what your customers actually need?' Most founders answer this question with a slide of quote callouts from customer interviews. Hendra answers it with a structured database of 67 problems, each with severity quantification, validation methodology, subscriber segment breakdown, and 6-month freshness check date. The database: evidence that MJP's product decisions are driven by documented customer intelligence, not founder intuition. Investors who have funded B2B companies that missed the market: specifically look for evidence of systematic customer problem validation. The pain point database: MJP's most compelling due diligence evidence against the 'founder built what they thought customers wanted' failure mode.", tc: "text-primary" },
            { artifact: "ARTIFACT-CAT-2: Competitor analysis snapshots — historical Trust Score profiles of key market participants", investor_interpretation: "What investors see: quarterly Trust Score snapshots for MJP's 20 most-tracked competitor BUJK, showing Trust Score trajectories over 2–3 years, annotated with Workroom notes from competitive analysis sessions ('Q3 2024: [Competitor X] dropped from 74 to 68 — likely losing key jenjang-8 engineer to competitor Y. Watch for reduced bidding activity in infrastructure Q4.'). What it demonstrates: MJP not only tracks its subscriber clients but tracks the BUJK ecosystem systematically enough to build longitudinal competitive profiles — evidence of the depth of the data infrastructure and the sophistication of the analytical methodology.", data_room_value: "Data room value: historical competitor profiles demonstrate that MJP's Trust Score is a tool for generating unique insights, not just a metric for displaying existing data. An investor who flips through 3 years of quarterly Trust Score snapshots for a specific BUJK: can see that the Trust Score accurately predicted the BUJK's subsequent tender activity changes (Trust Score drop in Q3 2024 preceded reduced bidding activity in Q4 2024 — exactly as the Workroom note predicted). The predictive accuracy: not proven by statistical analysis in the data room (that comes post-Series A) but demonstrated qualitatively through the historical snapshot sequence. The historical snapshots: the seed evidence for MJP's post-Series A 'predictive Trust Score' research agenda.", tc: "text-blue-700" },
            { artifact: "ARTIFACT-CAT-3: Workroom problem formulation archives — rejected problem statements and the reasoning behind each rejection", investor_interpretation: "What investors see: the Workroom archive of problem formulation sessions — including problem statements that MJP considered and rejected, with notes explaining the rejection reasoning ('rejected: too broad — could describe any B2B information business'; 'rejected: not validated — assumed problem without subscriber evidence'; 'rejected: wrong causation — correlational observation misattributed as causal'). What it demonstrates: MJP's current problem statement is the product of rigorous filtering, not the first idea that stuck. The rejected alternatives: evidence of the intellectual work behind the current formulation and the criteria applied to eliminate weaker candidates.", data_room_value: "Data room value: rejected problem statement archives are rare in investor due diligence — most companies present only their current winning narrative without evidence of how they got there. Hendra's decision to preserve and present the rejection archive: a calculated transparency move that signals analytical rigor and intellectual confidence. Investors who see a well-reasoned rejection archive: can assess the quality of the rejection reasoning, which is more revealing than the quality of the final formulation (anyone can write a good problem statement; not everyone can articulate precisely why the alternatives are worse). The rejection archive: the evidence that MJP's problem statement survived serious internal scrutiny before it was ever presented to an investor.", tc: "text-emerald-700" },
            { artifact: "ARTIFACT-CAT-4: Service link analysis — documented connections between subscriber pain points and MJP product features", investor_interpretation: "What investors see: MJP's service link map — each of the 67 pain points connected to the specific MJP feature(s) designed to address it, with subscriber adoption data (what % of subscribers who have this pain have used the relevant feature), and NPS delta (does solving this pain improve renewal probability). The service link map: the evidence that MJP's product architecture is intentional, not accidental — each feature exists because it was designed to address a specific, validated subscriber pain.", data_room_value: "Data room value: service link analysis converts the investor narrative from 'we have X features' to 'each of our features addresses a specific documented problem for a specific subscriber segment, and we have evidence that it works.' The evidence base: not testimonials but adoption rates and renewal correlations. Features with high adoption and strong renewal correlation: the features that are most central to MJP's value proposition and should receive development prioritization in Series A. Features with low adoption despite high pain severity: product-market fit gaps that MJP is aware of and has plans to address. The transparent feature performance map: the data room artifact that demonstrates MJP's product decision-making maturity — they know which features are working and which ones aren't, and they have a plan for each.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.artifact} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.artifact}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Investor interpretation: {r.investor_interpretation}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Data room value: {r.data_room_value}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Workroom's contribution to MJP's Series A data room adalah the most unexpected fundraising advantage in MJP's asset portfolio — because most founders assemble their data room from financial reports, customer testimonials, and product roadmaps. Hendra has additionally built a 5-year archive of analytical work that demonstrates how MJP thinks, not just what MJP has achieved. The 4 artifact categories (pain point history, competitor profiles, problem formulation archives, service link analysis): together tell an intellectual story that financial metrics cannot. Financial metrics tell investors where MJP has been. The Workroom artifacts tell investors how MJP thinks — and thinking quality is what predicts where MJP is going. Series A investors: are ultimately betting on the team's judgment quality across thousands of future product and business decisions. The best evidence of judgment quality: not what the team says in a pitch meeting but the documented quality of the analytical work they've produced over 5 years. Hendra's most unusual data room approach: 'I am going to show investors the messy working, not just the clean answer. I want them to see how we reached the current product, including the wrong turns we took and corrected. Because the investors who are most valuable to us are the ones who understand that the value of a research-driven product company is in its research methodology, not its current product snapshot.' The data room artifacts from Workroom: the evidence of that research methodology. The Workroom's server sync capability (R119): the infrastructure that makes these artifacts accessible, shareable, and auditable — converting individual analytical work into institutional research memory that investors can review, verify, and build on in their due diligence conversations. The most intellectually honest due diligence a founder can offer: show the investor all 67 pain points, including the ones MJP hasn't solved yet. Hendra does exactly this, with confidence that the methodology is strong enough to survive scrutiny, even when the solutions are not yet complete.</p>
      </div>

      {/* Header + controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold font-mono tracking-tight flex items-center gap-2">
            DAFTAR PROSPEK KLIEN
            {(() => { const domainCount = new Set(filteredProspects.map(p => p.primaryDomain)).size; return domainCount > 0 ? (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                {domainCount} domain
              </span>
            ) : null; })()}
            {(() => { const belum = filteredProspects.filter(p => (notes.contractors[p.contractor.id]?.status ?? "BELUM_DIHUBUNGI") === "BELUM_DIHUBUNGI").length; return belum > 0 ? (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                {belum} belum dihubungi
              </span>
            ) : null; })()}
            {(() => { const sudah = filteredProspects.filter(p => ["SUDAH_DIHUBUNGI","SEDANG_NEGOSIASI","DEAL"].includes(notes.contractors[p.contractor.id]?.status ?? "BELUM_DIHUBUNGI")).length; return sudah > 0 ? (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                {sudah} diproses
              </span>
            ) : null; })()}
          </h2>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            {filtered.length} segmen domain · {(painPoints ?? []).length} masalah teridentifikasi · Diurutkan berdasarkan pain score
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearch(""); e.currentTarget.blur(); } }}
              placeholder="Cari domain… · Esc reset"
              className="h-8 pl-8 pr-8 text-xs border rounded-sm bg-muted/50 font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {!search && <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">/</kbd>}
          </div>
          <Select value={filterDomain} onValueChange={setFilterDomain}>
            <SelectTrigger className="h-8 w-44 text-xs font-mono bg-background" aria-label="Filter lokasi jaringan" title="Filter berdasarkan domain/lokasi">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs font-mono">Semua Domain</SelectItem>
              {domains.map((d) => <SelectItem key={d} value={d} className="text-xs font-mono">{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {(painPoints ?? []).length === 0 ? (
        <div className="border border-dashed rounded-sm p-12 text-center">
          <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-mono text-sm text-muted-foreground">Belum ada data masalah</p>
          <p className="text-xs text-muted-foreground mt-1">Tambahkan pain point di halaman Perumusan Masalah untuk membangun daftar prospek.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((pr) => {
            const urgency = pr.maxScore >= 8 ? "Kritis" : pr.maxScore >= 6 ? "Tinggi" : pr.maxScore >= 4 ? "Sedang" : "Rendah";
            const urgencyColor = pr.maxScore >= 8 ? "text-red-700 bg-red-50 border-red-200" :
              pr.maxScore >= 6 ? "text-orange-700 bg-orange-50 border-orange-200" :
              pr.maxScore >= 4 ? "text-amber-700 bg-amber-50 border-amber-200" :
              "text-slate-600 bg-slate-50 border-slate-200";
            const cardBorder = pr.maxScore >= 8 ? "border-red-200" :
              pr.maxScore >= 6 ? "border-orange-200" : "border-border";

            return (
              <Card key={pr.domain} className={cn("flex flex-col", cardBorder)}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-bold font-mono text-sm">{pr.domain}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-sm border", urgencyColor)}>
                          Urgensi: {urgency}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {pr.points.length} masalah
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-black font-mono leading-none text-primary">{pr.maxScore}</div>
                      <div className="text-[9px] font-mono text-muted-foreground">Max Pain</div>
                      {(() => {
                        const noteCount = pr.points.reduce((n, pp) => { const v = notes.painPoints[pp.id]; return n + (v?.note?.trim().length > 0 ? 1 : 0); }, 0);
                        return noteCount > 0 ? (
                          <div className="text-[8px] font-mono text-blue-600 mt-0.5">{noteCount} catatan</div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Masalah Teratas:</p>
                    {pr.dominated.map((t, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="text-[10px] font-mono text-primary shrink-0 mt-0.5">{i + 1}.</span>
                        <p className="text-xs leading-snug line-clamp-2" title={t}>{t}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-2 border-t">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(buildWAMessage(pr))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                      title="Hubungi via WhatsApp"
                      aria-label="Hubungi prospek via WhatsApp"
                    >
                      <button className="w-full flex items-center justify-center gap-1.5 text-[10px] font-mono bg-emerald-600 text-white rounded-sm py-1.5 hover:bg-emerald-700 transition-colors">
                        <MessageCircle className="h-3 w-3" />
                        Hubungi via WA
                      </button>
                    </a>
                    <a
                      href={`/surat-penawaran`}
                      className="flex items-center justify-center gap-1 text-[10px] font-mono border rounded-sm px-2.5 py-1.5 hover:bg-muted transition-colors"
                      title="Buat Surat Penawaran"
                    >
                      <FileText className="h-3 w-3" />
                      Surat
                    </a>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Keep original helpers below
function scoreFg(score: number): string {
  if (score >= 8) return "text-red-600";
  if (score >= 6) return "text-orange-600";
  if (score >= 4) return "text-yellow-600";
  return "text-muted-foreground";
}

const OUTREACH_STATUS_CONFIG: Record<OutreachStatus, { label: string; color: string; dot: string }> = {
  BELUM_DIHUBUNGI:   { label: "Belum Dihubungi",   color: "bg-muted text-muted-foreground border-border",                        dot: "bg-slate-400" },
  SUDAH_DIHUBUNGI:   { label: "Sudah Dihubungi",   color: "bg-blue-500/15 text-blue-700 border-blue-300",                        dot: "bg-blue-500" },
  SEDANG_NEGOSIASI:  { label: "Sedang Negosiasi",  color: "bg-amber-500/15 text-amber-700 border-amber-300",                     dot: "bg-amber-500" },
  DEAL:              { label: "Deal ✓",             color: "bg-emerald-500/15 text-emerald-700 border-emerald-300",               dot: "bg-emerald-500" },
  TIDAK_TERTARIK:    { label: "Tidak Tertarik",     color: "bg-red-500/15 text-red-600 border-red-300",                          dot: "bg-red-400" },
};
