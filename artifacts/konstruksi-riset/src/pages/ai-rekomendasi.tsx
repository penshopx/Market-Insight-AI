import React, { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  useListAiRecommendations,
  useCreateAiRecommendation,
  useUpdateAiRecommendation,
  getListAiRecommendationsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accessibility, TriangleAlert, ChartBar, Blocks, Brain, CircleCheck, ClipboardCheck, ChevronUp, Cpu, Database, DollarSign, Download, GitBranch, Globe, Loader2, LoaderCircle, MessageCircle, MessageSquare, Microscope, Network, Play, Plus, RefreshCw, Rocket, RotateCcw, Scale, Search, Shield, ShieldAlert, ShieldCheck, Sparkles, Star, Target, TrendingUp, Trophy, Users, X, Zap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { KnowledgeSourcesBar } from "@/components/knowledge-sources-bar";

// ─── Two-click delete for AI output ──────────────────────────────────────────
function AiOutputDeleteButton({ onConfirm }: { onConfirm: (e: React.MouseEvent) => void }) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirming) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setConfirming(false);
      onConfirm(e);
    } else {
      setConfirming(true);
      timerRef.current = setTimeout(() => setConfirming(false), 2500);
    }
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      className={cn("text-[10px] transition-colors", confirming ? "text-white bg-destructive hover:bg-destructive/90" : "text-destructive hover:bg-destructive/5")}
      onClick={handleClick}
    >
      <RotateCcw className="h-3 w-3 mr-1" />
      {confirming ? "Yakin hapus?" : "Hapus"}
    </Button>
  );
}

export default function AiRekomendasi() {
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); searchRef.current?.focus(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [createPriority, setCreatePriority] = useState("HIGH");
  const [createFeasibility, setCreateFeasibility] = useState("HIGH");
  const [createTouched, setCreateTouched] = useState<Record<string, boolean>>({});
  const [createValues, setCreateValues] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!isCreateOpen) {
      setCreatePriority("HIGH");
      setCreateFeasibility("HIGH");
      setCreateTouched({});
      setCreateValues({});
    }
  }, [isCreateOpen]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [recSearch, setRecSearch] = useState("");
  const [recNotes, setRecNotes] = useState<Record<number, string>>(() => {
    try { return JSON.parse(localStorage.getItem("mkp-rec-notes") ?? "{}") as Record<number, string>; } catch { return {}; }
  });
  const [savedNoteId, setSavedNoteId] = useState<number | null>(null);
  const updateRecNote = (id: number, val: string) => setRecNotes(prev => {
    const next = { ...prev, [id]: val };
    try { localStorage.setItem("mkp-rec-notes", JSON.stringify(next)); } catch { /* ignore */ }
    setSavedNoteId(id);
    setTimeout(() => setSavedNoteId(s => s === id ? null : s), 1500);
    return next;
  });

  const [generating, setGenerating] = useState<number | null>(null);
  const [aiOutput, setAiOutput] = useState<Record<number, string>>({});
  const hasAnyOutput = Object.keys(aiOutput).length > 0;

  const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

  const startPrototype = useCallback(async (rec: { id: number; aiProductName: string; problemSolved?: string | null; targetUsers?: string | null; techStack?: string | null; estimatedImpact?: string | null }) => {
    setGenerating(rec.id);
    setAiOutput(prev => ({ ...prev, [rec.id]: "" }));
    try {
      const convRes = await fetch(`${API}/openrouter/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Prototype: ${rec.aiProductName}`, model: "openai/gpt-4o-mini" }),
      });
      const conv = await convRes.json();
      const msgRes = await fetch(`${API}/openrouter/conversations/${conv.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "user",
          content: `Buatkan spesifikasi MVP singkat untuk produk AI berikut:\n\nNama: ${rec.aiProductName}\nMasalah diselesaikan: ${rec.problemSolved ?? "-"}\nTarget pengguna: ${rec.targetUsers ?? "-"}\nTech stack: ${rec.techStack ?? "tidak ditentukan"}\nEstimasi dampak: ${rec.estimatedImpact ?? "-"}\n\nBerikan: 1) Fitur utama MVP (5 poin), 2) User flow (3 langkah), 3) Metrik sukses. Format singkat, bahasa Indonesia.`,
        }),
      });
      if (msgRes.ok) {
        const data = await msgRes.json();
        const text = data?.content ?? data?.choices?.[0]?.message?.content ?? JSON.stringify(data);
        setAiOutput(prev => ({ ...prev, [rec.id]: text }));
      }
    } catch {
      setAiOutput(prev => ({ ...prev, [rec.id]: "Gagal menghasilkan output. Coba lagi." }));
    } finally {
      setGenerating(null);
    }
  }, [API]);

  const { data: recommendations, isLoading } = useListAiRecommendations({}, {
    query: { queryKey: getListAiRecommendationsQueryKey() }
  });

  const createMutation = useCreateAiRecommendation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAiRecommendationsQueryKey() });
        setIsCreateOpen(false);
      },
      onError: (err: unknown) => toast.error("Gagal menyimpan rekomendasi", { description: err instanceof Error ? err.message : "Coba lagi" }),
    }
  });

  const updateMutation = useUpdateAiRecommendation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAiRecommendationsQueryKey() });
        toast.success("Rekomendasi diperbarui", { duration: 1500 });
      },
      onError: (err: unknown) => toast.error("Gagal memperbarui rekomendasi", { description: err instanceof Error ? err.message : "Coba lagi" }),
    }
  });

  const AI_STATUS_STAGES = ["CONCEPT", "VALIDATED", "IN_DEVELOPMENT", "LAUNCHED"] as const;
  type AiStatus = typeof AI_STATUS_STAGES[number];

  const nextAiStatus = (current: string): AiStatus => {
    const idx = AI_STATUS_STAGES.indexOf(current as AiStatus);
    return AI_STATUS_STAGES[(idx + 1) % AI_STATUS_STAGES.length];
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const aiProductName = (fd.get("aiProductName") as string ?? "").trim();
    const description = (fd.get("description") as string ?? "").trim();
    const problemSolved = (fd.get("problemSolved") as string ?? "").trim();
    const targetUsers = (fd.get("targetUsers") as string ?? "").trim();
    if (!aiProductName || !description || !problemSolved || !targetUsers) {
      setCreateTouched({ aiProductName: true, description: true, problemSolved: true, targetUsers: true });
      setCreateValues((v) => ({ ...v, aiProductName, description, problemSolved, targetUsers }));
      return;
    }
    createMutation.mutate({
      data: {
        aiProductName,
        description,
        problemSolved,
        targetUsers,
        techStack: fd.get("techStack") as string,
        feasibility: fd.get("feasibility") as string,
        priority: fd.get("priority") as string,
        revenueModel: fd.get("revenueModel") as string,
        estimatedImpact: fd.get("estimatedImpact") as string,
        status: "CONCEPT"
      }
    });
  };

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'CRITICAL': return 'bg-destructive text-white border-destructive';
      case 'HIGH': return 'bg-orange-500 text-white border-orange-500';
      case 'MEDIUM': return 'bg-amber-500 text-black border-amber-500';
      case 'LOW': return 'bg-slate-300 text-black border-slate-300';
      default: return 'bg-muted';
    }
  };

  const getFeasibilityColor = (feasibility: string) => {
    switch(feasibility) {
      case 'HIGH': return 'text-green-600 border-green-600 bg-green-50 dark:bg-green-900/20';
      case 'MEDIUM': return 'text-amber-600 border-amber-600 bg-amber-50 dark:bg-amber-900/20';
      case 'LOW': return 'text-red-600 border-red-600 bg-red-50 dark:bg-red-900/20';
      default: return 'text-muted-foreground border-border';
    }
  };

  const matrixPositions = [
    { priority: 'HIGH', feasibility: 'HIGH', label: 'Quick Wins', col: 1, row: 1 },
    { priority: 'HIGH', feasibility: 'LOW', label: 'Major Projects', col: 2, row: 1 },
    { priority: 'LOW', feasibility: 'HIGH', label: 'Fill Ins', col: 1, row: 2 },
    { priority: 'LOW', feasibility: 'LOW', label: 'Thankless Tasks', col: 2, row: 2 },
  ];

  const recsAll = recommendations ?? [];
  const [pinnedRecs, setPinnedRecs] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("mkp-rec-pinned") ?? "[]") as number[]); } catch { return new Set(); }
  });
  const toggleRecPin = (id: number) => setPinnedRecs(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    try { localStorage.setItem("mkp-rec-pinned", JSON.stringify([...next])); } catch { /* ignore */ }
    return next;
  });
  const [showPinnedRecs, setShowPinnedRecs] = useState(false);
  const statCards = [
    { label: "Total Ide AI", value: recsAll.length, color: "text-foreground" },
    { label: "Siap Validasi", value: recsAll.filter(r => r.status === "CONCEPT").length, color: "text-amber-600" },
    { label: "Divalidasi", value: recsAll.filter(r => r.status === "VALIDATED").length, color: "text-blue-600" },
    { label: "In Development", value: recsAll.filter(r => r.status === "IN_DEVELOPMENT").length, color: "text-violet-600" },
    { label: "Sudah Diluncurkan", value: recsAll.filter(r => r.status === "LAUNCHED").length, color: "text-green-600" },
    { label: "Prioritas Kritis", value: recsAll.filter(r => r.priority === "CRITICAL").length, color: "text-red-600" },
    { label: "Dipin", value: pinnedRecs.size, color: "text-amber-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">REKOMENDASI PRODUK AI</h1>
          <p className="text-muted-foreground font-mono mt-1">
            IDEATION &amp; FEASIBILITY MATRIX · {recsAll.length} ide terdaftar
            {(statusFilter !== "ALL" || priorityFilter !== "ALL" || showPinnedRecs || recSearch) && (() => {
              const cnt = recsAll.filter(r => (statusFilter === "ALL" || r.status === statusFilter) && (priorityFilter === "ALL" || r.priority === priorityFilter) && (!showPinnedRecs || pinnedRecs.has(r.id)) && (!recSearch || r.aiProductName.toLowerCase().includes(recSearch.toLowerCase()) || r.problemSolved.toLowerCase().includes(recSearch.toLowerCase()) || (recNotes[r.id] ?? "").toLowerCase().includes(recSearch.toLowerCase()))).length;
              return cnt < recsAll.length ? (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {cnt} dari {recsAll.length}
                </span>
              ) : null;
            })()}
            {Object.keys(aiOutput).length > 0 && (
              <span className="ml-2 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {Object.keys(aiOutput).length} output AI
              </span>
            )}
            {(() => { const highCount = recsAll.filter(r => r.priority === 'HIGH' || r.priority === 'CRITICAL').length; return highCount > 0 ? (
              <span className="ml-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                {highCount} prioritas tinggi
              </span>
            ) : null; })()}
            {pinnedRecs.size > 0 && (
              <span className="ml-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                ★ {pinnedRecs.size} dipin
              </span>
            )}
          </p>
        </div>
        {hasAnyOutput && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-[10px] font-mono h-8"
              onClick={() => {
                const lines: string[] = [];
                recsAll.forEach(r => {
                  const out = aiOutput[r.id];
                  if (out) {
                    lines.push(`=== ${r.aiProductName} (ID:${r.id}) ===`);
                    lines.push(out);
                    lines.push("");
                  }
                });
                const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = "ai-prototype-outputs.txt"; a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-3 w-3 mr-1.5" /> Download Output
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/5 text-[10px] font-mono h-8"
              onClick={() => setAiOutput({})}
            >
              <RotateCcw className="h-3 w-3 mr-1.5" /> HAPUS SEMUA OUTPUT AI
            </Button>
          </div>
        )}
      </div>

      {/* Knowledge Sources Bar */}
      <KnowledgeSourcesBar pageKey="ai-rekomendasi" />

      {/* Stat cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="border rounded-sm p-3 bg-card text-center">
            <p className={`text-2xl font-black font-mono ${s.color}`}>{s.value}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5 font-mono uppercase">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Status pipeline progress bar */}
      {recsAll.length > 0 && (() => {
        const total = recsAll.length;
        const stages: { key: string; label: string; color: string }[] = [
          { key: "CONCEPT", label: "Konsep", color: "bg-amber-400" },
          { key: "VALIDATED", label: "Tervalidasi", color: "bg-blue-500" },
          { key: "IN_DEVELOPMENT", label: "Dalam Pengembangan", color: "bg-violet-500" },
          { key: "LAUNCHED", label: "Diluncurkan", color: "bg-emerald-500" },
        ];
        return (
          <div className="border rounded-sm px-4 py-3 bg-card">
            <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">PIPELINE STATUS</p>
            <div className="flex h-3 rounded-full overflow-hidden gap-px">
              {stages.map(s => {
                const cnt = recsAll.filter(r => r.status === s.key).length;
                if (cnt === 0) return null;
                return <div key={s.key} className={`${s.color} transition-all`} style={{ width: `${cnt / total * 100}%` }} title={`${s.label}: ${cnt}`} />;
              })}
            </div>
            <div className="flex gap-4 mt-1.5 flex-wrap">
              {stages.map(s => {
                const cnt = recsAll.filter(r => r.status === s.key).length;
                if (cnt === 0) return null;
                return (
                  <div key={s.key} className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${s.color}`} />
                    <span className="text-[9px] font-mono text-muted-foreground">{s.label} {cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* AI Technology Readiness Assessment */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-primary" /> AI TECHNOLOGY READINESS — Kesiapan Infrastruktur Data untuk Setiap Produk AI
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { produk: "SBU Expiry Predictor", readiness: 88, data: "LPJK + BNSP DB aktif", gap: "Butuh API LPJK real-time", tech: "ML klasifikasi + alert engine", color: "bg-emerald-500", status: "SIAP" },
            { produk: "Tender Eligibility Engine", readiness: 82, data: "LPSE 64 kota + parser tender", gap: "Parser dokumen PDF wajib", tech: "NLP + rule-based matching", color: "bg-blue-500", status: "SIAP" },
            { produk: "AI Briefing Generator", readiness: 91, data: "64 sumber intel aktif", gap: "Fine-tuning prompt domain", tech: "LLM + template engine", color: "bg-primary", status: "LAUNCHED" },
            { produk: "Regulatory Compass", readiness: 71, data: "JDIH + PUPR regulasi", gap: "Butuh OCR untuk PDF peraturan lama", tech: "RAG + knowledge graph", color: "bg-yellow-500", status: "DEV" },
            { produk: "AI Proposal Writer", readiness: 65, data: "Template penawaran MJP", gap: "Corpus proposal sukses belum cukup", tech: "LLM + few-shot learning", color: "bg-orange-500", status: "CONCEPT" },
            { produk: "Competitor Intel Bot", readiness: 58, data: "IjinTender + scraping data", gap: "Butuh sentiment analysis kompetitor", tech: "Web scraping + NLP analitik", color: "bg-red-400", status: "CONCEPT" },
          ].map((p) => (
            <div key={p.produk} className="border rounded-sm p-3 bg-card">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold leading-snug">{p.produk}</p>
                <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${p.status === "LAUNCHED" ? "bg-primary text-primary-foreground" : p.status === "SIAP" ? "bg-emerald-100 text-emerald-700" : p.status === "DEV" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"}`}>{{ LAUNCHED:"Diluncurkan", SIAP:"Siap", DEV:"Pengembangan", CONCEPT:"Konsep" }[p.status] ?? p.status}</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${p.color} rounded-full`} style={{ width: `${p.readiness}%` }} />
                </div>
                <span className="text-[10px] font-mono font-bold">{p.readiness}%</span>
              </div>
              <p className="text-[9px] text-muted-foreground leading-snug">{p.data}</p>
              <p className="text-[9px] font-mono text-orange-600 mt-0.5">△ {p.gap}</p>
              <p className="text-[9px] font-mono text-primary mt-0.5">→ {p.tech}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Product Launch Sequencer */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-primary" /> AI PRODUCT LAUNCH SEQUENCER — Urutan Prioritas Rilis Produk AI MJP
        </p>
        <div className="flex flex-col gap-2">
          {[
            { seq: 1, produk: "AI Briefing Generator", status: "LAUNCHED", desc: "Otomatisasi briefing harian dari 64 sumber intel aktif", rev: "Rp 15–40jt/bln", depOn: "—", statColor: "bg-primary text-primary-foreground" },
            { seq: 2, produk: "Tender Eligibility Engine", status: "SIAP LAUNCH", desc: "NLP matcher antara persyaratan tender vs profil klien", rev: "Rp 20–60jt/bln", depOn: "LPSE API + NLP pipeline", statColor: "bg-emerald-600 text-white" },
            { seq: 3, produk: "SBU Expiry Predictor", status: "SIAP LAUNCH", desc: "ML prediksi kapan SBU klien perlu diperbarui + alert otomatis", rev: "Rp 10–30jt/bln", depOn: "LPJK DB aktif", statColor: "bg-emerald-600 text-white" },
            { seq: 4, produk: "Regulatory Compass", status: "DEV", desc: "RAG engine untuk query regulasi PUPR, LKPP, dan BNSP", rev: "Rp 12–35jt/bln", depOn: "OCR + knowledge graph", statColor: "bg-blue-600 text-white" },
            { seq: 5, produk: "AI Proposal Writer", status: "CONCEPT", desc: "LLM yang generate draft surat penawaran berbasis profil klien", rev: "Rp 8–25jt/bln", depOn: "Corpus proposal + fine-tune", statColor: "bg-muted text-muted-foreground" },
          ].map((p) => (
            <div key={p.produk} className="flex items-start gap-3 border rounded-sm p-2.5 hover:bg-muted/30 hover:shadow-sm transition-all">
              <span className="text-xl font-black font-mono text-primary/30 leading-none w-5 shrink-0">{p.seq}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-semibold">{p.produk}</p>
                  <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${p.statColor}`}>{p.status}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{p.desc}</p>
                <p className="text-[9px] font-mono text-muted-foreground mt-0.5">Dep: {p.depOn}</p>
              </div>
              <p className="text-[10px] font-mono font-bold text-emerald-700 whitespace-nowrap shrink-0">{p.rev}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div />
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Cpu className="mr-2 h-4 w-4" />
              Tambah Ide AI
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Input Ide Produk AI</DialogTitle>
              <DialogDescription>Konversi pain point menjadi solusi berbasis Artificial Intelligence.</DialogDescription>
            </DialogHeader>
            <form key={String(isCreateOpen)} onSubmit={handleCreate} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="aiProductName">Nama Produk AI <span className="text-destructive">*</span></Label>
                <Input
                  id="aiProductName" name="aiProductName" placeholder="Cth: TenderAnalyzer AI" autoFocus maxLength={255}
                  value={createValues.aiProductName ?? ""}
                  onChange={(e) => setCreateValues((v) => ({ ...v, aiProductName: e.target.value }))}
                  onBlur={() => setCreateTouched((t) => ({ ...t, aiProductName: true }))}
                  className={createTouched.aiProductName && !createValues.aiProductName?.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {createTouched.aiProductName && !createValues.aiProductName?.trim() && (
                  <p className="text-xs text-destructive">Nama produk AI wajib diisi</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Deskripsi Konsep <span className="text-destructive">*</span></Label>
                <Textarea
                  id="description" name="description" placeholder="Aplikasi AI yang dapat…" className="h-20" maxLength={1000}
                  value={createValues.description ?? ""}
                  onChange={(e) => setCreateValues((v) => ({ ...v, description: e.target.value }))}
                  onBlur={() => setCreateTouched((t) => ({ ...t, description: true }))}
                  style={createTouched.description && !createValues.description?.trim() ? { borderColor: "hsl(var(--destructive))" } : {}}
                />
                <p className="text-[10px] font-mono text-muted-foreground text-right">{(createValues.description ?? "").length} / 1000</p>
                {createTouched.description && !createValues.description?.trim() && (
                  <p className="text-xs text-destructive">Deskripsi konsep wajib diisi</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="problemSolved">Masalah Utama yang Dipecahkan <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="problemSolved" name="problemSolved" placeholder="Menyelesaikan masalah…" maxLength={1000}
                    value={createValues.problemSolved ?? ""}
                    onChange={(e) => setCreateValues((v) => ({ ...v, problemSolved: e.target.value }))}
                    onBlur={() => setCreateTouched((t) => ({ ...t, problemSolved: true }))}
                    style={createTouched.problemSolved && !createValues.problemSolved?.trim() ? { borderColor: "hsl(var(--destructive))" } : {}}
                  />
                  <p className="text-[10px] font-mono text-muted-foreground text-right">{(createValues.problemSolved ?? "").length} / 1000</p>
                  {createTouched.problemSolved && !createValues.problemSolved?.trim() && (
                    <p className="text-xs text-destructive">Masalah yang dipecahkan wajib diisi</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetUsers">Target Pengguna <span className="text-destructive">*</span></Label>
                  <Input
                    id="targetUsers" name="targetUsers" placeholder="Cth: Kontraktor Menengah" maxLength={255}
                    value={createValues.targetUsers ?? ""}
                    onChange={(e) => setCreateValues((v) => ({ ...v, targetUsers: e.target.value }))}
                    onBlur={() => setCreateTouched((t) => ({ ...t, targetUsers: true }))}
                    className={createTouched.targetUsers && !createValues.targetUsers?.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {createTouched.targetUsers && !createValues.targetUsers?.trim() && (
                    <p className="text-xs text-destructive">Target pengguna wajib diisi</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prioritas (Value)</Label>
                  <input type="hidden" name="priority" value={createPriority} />
                  <Select value={createPriority} onValueChange={setCreatePriority} required>
                    <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CRITICAL">Kritis</SelectItem>
                      <SelectItem value="HIGH">Tinggi</SelectItem>
                      <SelectItem value="MEDIUM">Sedang</SelectItem>
                      <SelectItem value="LOW">Rendah</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Feasibility (Technical/Cost)</Label>
                  <input type="hidden" name="feasibility" value={createFeasibility} />
                  <Select value={createFeasibility} onValueChange={setCreateFeasibility} required>
                    <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HIGH">Tinggi (Mudah/Murah)</SelectItem>
                      <SelectItem value="MEDIUM">Sedang</SelectItem>
                      <SelectItem value="LOW">Rendah (Sulit/Mahal)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="techStack">Asumsi Tech Stack</Label>
                  <Input id="techStack" name="techStack" placeholder="Cth: OpenAI, RAG, Pinecone, Next.js" maxLength={255} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="revenueModel">Revenue Model</Label>
                  <Input id="revenueModel" name="revenueModel" placeholder="Cth: Freemium, Pay-per-use, B2B SaaS" maxLength={255} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedImpact">Estimasi Dampak Bisnis</Label>
                <Input id="estimatedImpact" name="estimatedImpact" placeholder="Cth: Akuisisi 10,000 user bulan pertama" maxLength={255} />
              </div>
              <DialogFooter className="mt-4 border-t pt-4">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Menyimpan…</> : "Simpan Ide AI"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* AI Opportunity Readiness Score */}
      <div className="border rounded-sm p-4 bg-card mb-6">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> AI OPPORTUNITY READINESS — Kesiapan Platform untuk Tiap Fitur AI
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {[
            { feat: "SBU Expiry Monitor Bot", readiness: 90, blocker: "—", status: "SIAP LAUNCH", color: "bg-emerald-500" },
            { feat: "LPSE Tender Alert WA", readiness: 85, blocker: "WhatsApp Business API", status: "NEAR READY", color: "bg-blue-500" },
            { feat: "Analisis Kesiapan Tender AI", readiness: 72, blocker: "Dataset training", status: "IN DEV", color: "bg-violet-500" },
            { feat: "SKK Chatbot Pendamping", readiness: 65, blocker: "LSP database scraping", status: "BETA", color: "bg-yellow-500" },
            { feat: "TKDN Verifikator AI", readiness: 58, blocker: "KEMENPERIN API akses", status: "CONCEPT", color: "bg-orange-500" },
            { feat: "BIM Regulatory Mapper", readiness: 40, blocker: "Permen PUPR data pipeline", status: "ROADMAP", color: "bg-slate-400" },
          ].map((f) => (
            <div key={f.feat} className="border rounded-sm p-2.5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold leading-tight flex-1 mr-2">{f.feat}</p>
                <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-sm ${
                  f.readiness >= 80 ? "bg-emerald-100 text-emerald-700" :
                  f.readiness >= 60 ? "bg-blue-100 text-blue-700" :
                  "bg-muted text-muted-foreground"
                }`}>{f.status}</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${f.color} rounded-full`} style={{ width: `${f.readiness}%` }} />
                </div>
                <span className="text-[10px] font-mono font-bold">{f.readiness}%</span>
              </div>
              {f.blocker !== "—" && (
                <p className="text-[9px] text-muted-foreground">⚠ {f.blocker}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card className="bg-sidebar border-sidebar-border text-sidebar-foreground">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Blocks className="h-5 w-5 text-primary" /> PRIORITY / FEASIBILITY MATRIX
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-square sm:aspect-[4/3] border-l-2 border-b-2 border-sidebar-foreground/20 ml-6 mb-6 mt-2 mr-2">
              <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-xs font-mono font-bold tracking-widest text-sidebar-foreground/60 whitespace-nowrap">
                Business Value (Priority)
              </div>
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs font-mono font-bold tracking-widest text-sidebar-foreground/60">
                Feasibility (Kemudahan Dev)
              </div>
              
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                <div className="border-r border-b border-sidebar-foreground/10 bg-green-500/5 relative group p-2">
                  <span className="absolute top-2 right-2 text-[10px] font-mono text-green-500/50">Quick Wins</span>
                  <div className="h-full w-full overflow-hidden flex flex-wrap gap-1 content-start">
                    {recommendations?.filter(r => (r.priority === 'HIGH' || r.priority === 'CRITICAL') && r.feasibility === 'HIGH').map(r => (
                      <Badge key={r.id} className="text-[9px] px-1 py-0 h-4 bg-primary text-primary-foreground truncate max-w-full" title={r.aiProductName}>{r.aiProductName}</Badge>
                    ))}
                  </div>
                </div>
                <div className="border-b border-sidebar-foreground/10 bg-amber-500/5 relative p-2">
                  <span className="absolute top-2 right-2 text-[10px] font-mono text-amber-500/50">Major Proj</span>
                  <div className="h-full w-full overflow-hidden flex flex-wrap gap-1 content-start">
                    {recommendations?.filter(r => (r.priority === 'HIGH' || r.priority === 'CRITICAL') && (r.feasibility === 'LOW' || r.feasibility === 'MEDIUM')).map(r => (
                      <Badge key={r.id} className="text-[9px] px-1 py-0 h-4 bg-amber-600 text-white truncate max-w-full" title={r.aiProductName}>{r.aiProductName}</Badge>
                    ))}
                  </div>
                </div>
                <div className="border-r border-sidebar-foreground/10 bg-blue-500/5 relative p-2">
                  <span className="absolute top-2 right-2 text-[10px] font-mono text-blue-500/50">Fill Ins</span>
                  <div className="h-full w-full overflow-hidden flex flex-wrap gap-1 content-start">
                    {recommendations?.filter(r => (r.priority === 'LOW' || r.priority === 'MEDIUM') && r.feasibility === 'HIGH').map(r => (
                      <Badge key={r.id} variant="outline" className="text-[9px] px-1 py-0 h-4 bg-background/10 border-sidebar-foreground/30 text-sidebar-foreground/80 truncate max-w-full" title={r.aiProductName}>{r.aiProductName}</Badge>
                    ))}
                  </div>
                </div>
                <div className="bg-red-500/5 relative p-2">
                  <span className="absolute top-2 right-2 text-[10px] font-mono text-red-500/50">Thankless</span>
                  <div className="h-full w-full overflow-hidden flex flex-wrap gap-1 content-start">
                    {recommendations?.filter(r => (r.priority === 'LOW' || r.priority === 'MEDIUM') && (r.feasibility === 'LOW' || r.feasibility === 'MEDIUM')).map(r => (
                      <Badge key={r.id} variant="outline" className="text-[9px] px-1 py-0 h-4 border-destructive/40 text-destructive/80 truncate max-w-full" title={r.aiProductName}>{r.aiProductName}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-mono">STATUS PIPELINE</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['CONCEPT', 'VALIDATED', 'IN_DEVELOPMENT', 'LAUNCHED'].map(status => {
                  const count = recommendations?.filter(r => r.status === status).length || 0;
                  const total = recommendations?.length || 1;
                  const percentage = Math.round((count / total) * 100);
                  const isActive = statusFilter === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      className={cn("space-y-1 rounded-sm px-2 py-1 cursor-pointer transition-colors w-full text-left", isActive ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/60")}
                      onClick={() => setStatusFilter(isActive ? "ALL" : status)}
                      aria-pressed={isActive}
                      title={isActive ? "Klik untuk hapus filter" : `Filter: ${status}`}
                    >
                      <div className="flex justify-between text-sm font-mono">
                        <span className={isActive ? "text-primary font-bold" : ""}>{status}</span>
                        <span className="font-bold">{count}</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full", isActive ? "bg-primary" : "bg-primary/60")}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-destructive/10 border-destructive/20">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold font-mono text-destructive">{recommendations?.filter(r => r.priority === 'CRITICAL').length || 0}</div>
                  <div className="text-[10px] font-bold text-destructive/80 mt-1">Prioritas Kritis</div>
                </div>
                <TriangleAlert className="h-8 w-8 text-destructive/30" />
              </CardContent>
            </Card>
            <Card className="bg-green-500/10 border-green-500/20">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold font-mono text-green-600">{recommendations?.filter(r => r.feasibility === 'HIGH').length || 0}</div>
                  <div className="text-[10px] font-bold text-green-600/80 mt-1">Kelayakan Tinggi</div>
                </div>
                <Sparkles className="h-8 w-8 text-green-600/30" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* AI Development Budget Calculator */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> AI DEVELOPMENT BUDGET ESTIMATOR — Biaya Pengembangan per Produk
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { phase: "MVP / Prototype", duration: "4–8 minggu", cost: "Rp 25–75jt", desc: "RAG + API wrapper + basic UI. Cocok untuk validasi konsep.", color: "bg-blue-50 border-blue-200", textColor: "text-blue-700" },
            { phase: "Beta / Pilot", duration: "2–4 bulan", cost: "Rp 75–200jt", desc: "Fitur lengkap + auth + feedback loop dari 20–50 pengguna pilot.", color: "bg-violet-50 border-violet-200", textColor: "text-violet-700" },
            { phase: "Production v1.0", duration: "4–6 bulan", cost: "Rp 200–500jt", desc: "Scalable infra, monitoring, error handling, SLA 99.5%.", color: "bg-emerald-50 border-emerald-200", textColor: "text-emerald-700" },
            { phase: "AI Operations (/bulan)", duration: "Ongoing", cost: "Rp 5–30jt/bln", desc: "API calls, hosting, vector DB, support, dan maintenance rutin.", color: "bg-amber-50 border-amber-200", textColor: "text-amber-700" },
          ].map((b) => (
            <div key={b.phase} className={cn("border rounded-sm p-3", b.color)}>
              <p className={cn("text-[9px] font-mono font-bold uppercase tracking-wider mb-1", b.textColor)}>{b.phase}</p>
              <p className="text-xl font-black font-mono text-foreground mb-1">{b.cost}</p>
              <p className="text-[10px] text-muted-foreground mb-2">{b.duration}</p>
              <p className="text-[10px] text-muted-foreground leading-snug">{b.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">
          Estimasi untuk tim Indonesia 3–5 developer senior · excludes GPU cloud cost untuk fine-tuning · data per Q3 2026
        </p>
      </div>

      {/* AI Product Roadmap Timeline strip */}
      <div className="border rounded-sm p-4 bg-violet-50/20 border-violet-200/50">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-violet-700 mb-3 flex items-center gap-1.5">
          <Play className="h-3.5 w-3.5" /> ROADMAP PRIORITAS — Urutan Pengembangan Produk AI
        </p>
        <div className="flex gap-0 overflow-x-auto pb-2">
          {[
            { quarter: "Q3 2026", label: "FOUNDATION", items: ["SBU Expiry Alert Bot", "Tender Radar AI", "SKK Gap Checker"], color: "bg-primary", textColor: "text-primary" },
            { quarter: "Q4 2026", label: "EXPANSION", items: ["SMAP Compliance Engine", "Competitor Price Watch", "RKK Auto-Generator"], color: "bg-blue-500", textColor: "text-blue-600" },
            { quarter: "Q1 2027", label: "INTELLIGENCE", items: ["VOC Analyzer", "BIM Advisory AI", "TKDN Verifier"], color: "bg-violet-500", textColor: "text-violet-600" },
            { quarter: "Q2 2027", label: "SCALE", items: ["Predictive Tender Win", "Client Prospecting AI", "Full Pipeline Automation"], color: "bg-emerald-500", textColor: "text-emerald-600" },
          ].map((phase, i) => (
            <div key={i} className="flex-none relative">
              <div className="flex items-center">
                <div className="w-72 border rounded-sm bg-card mx-1 overflow-hidden">
                  <div className={`h-1.5 ${phase.color}`} />
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-mono font-bold ${phase.textColor}`}>{phase.quarter}</span>
                      <span className="text-[9px] font-mono bg-muted px-1.5 py-0.5 rounded-sm">{phase.label}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {phase.items.map((item, j) => (
                        <div key={j} className="flex items-center gap-1.5 text-xs">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${phase.color}`} />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {i < 3 && <span className="text-muted-foreground font-mono text-lg mx-1">→</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Monetization Potential Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> AI MONETIZATION POTENTIAL MATRIX — Revenue Tier per Produk AI
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Produk AI", "Model Bisnis", "Target Segmen", "MRR Potential", "Prioritas Dev", "Time-to-Market"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { produk: "AI SBU Expiry Predictor", model: "SaaS / API", segmen: "BUJK + Konsultan", mrr: "Rp 15–45jt", pri: "P1", priColor: "bg-red-100 text-red-700", ttm: "Q3 2026" },
                { produk: "Tender Eligibility Engine", model: "Pay-per-report", segmen: "Kontraktor aktif tender", mrr: "Rp 20–60jt", pri: "P1", priColor: "bg-red-100 text-red-700", ttm: "Q3 2026" },
                { produk: "Briefing Harian AI (Auto)", model: "Subscription bulanan", segmen: "Tim riset & manajemen", mrr: "Rp 10–30jt", pri: "P1", priColor: "bg-red-100 text-red-700", ttm: "Launched" },
                { produk: "AI Regulatory Compass", model: "Advisory + SaaS hybrid", segmen: "BUJK Menengah-Besar", mrr: "Rp 25–75jt", pri: "P2", priColor: "bg-orange-100 text-orange-700", ttm: "Q4 2026" },
                { produk: "AI Proposal Writer", model: "Token-based / per-doc", segmen: "Tim tender kontraktor", mrr: "Rp 8–25jt", pri: "P2", priColor: "bg-orange-100 text-orange-700", ttm: "Q4 2026" },
                { produk: "Competitor Intel Bot", model: "Freemium + Pro", segmen: "Semua BUJK & konsultan", mrr: "Rp 5–20jt", pri: "P3", priColor: "bg-yellow-100 text-yellow-700", ttm: "Q1 2027" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 hover:shadow-sm transition-all">
                  <td className="px-3 py-2 font-medium">{r.produk}</td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground">{r.model}</td>
                  <td className="px-3 py-2 text-[10px]">{r.segmen}</td>
                  <td className="px-3 py-2 font-mono font-bold text-emerald-700 text-[10px] whitespace-nowrap">{r.mrr}</td>
                  <td className="px-3 py-2"><span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${r.priColor}`}>{r.pri}</span></td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.ttm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">MRR Potential = estimasi pendapatan berulang per bulan saat produk mencapai 50 pelanggan · Update setiap sprint review</p>
      </div>

      {/* AI Revenue Potential Summary */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> AI REVENUE POTENTIAL SUMMARY — Total MRR jika Semua Produk AI Diluncurkan
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {[
            { label: "Total Produk AI Direncanakan", val: (recommendations ?? []).length + 5, color: "text-primary" },
            { label: "Sudah Diluncurkan", val: (recommendations ?? []).filter(r => r.status === "LIVE" || r.status === "LAUNCHED").length, color: "text-emerald-700" },
            { label: "MRR jika Semua Live", val: "Rp 95–260jt", color: "text-violet-700" },
            { label: "Prioritas Eksekusi Berikutnya", val: "Tender Engine", color: "text-orange-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className={`text-lg font-black font-mono leading-none ${m.color}`}>{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-muted-foreground">MRR Realized vs Potential</span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: "18%" }} />
          </div>
          <span className="text-[9px] font-mono font-bold text-primary">18%</span>
          <span className="text-[9px] font-mono text-muted-foreground">terealisasi · 82% masih di pipeline</span>
        </div>
      </div>

      {/* AI Build vs Buy Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> AI BUILD VS BUY MATRIX — Analisis Keputusan Bangun Sendiri atau Lisensi API
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Produk AI", "Build Cost", "Buy/License", "Rekomendasi", "Time to Market", "Alasan"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { produk: "AI Briefing Generator", build: "Rp 50–120jt", buy: "Rp 3–8jt/bln", rec: "BUY (OpenAI API)", time: "2 minggu", alasan: "LLM sudah mature, build tidak efisien", rc: "text-emerald-700" },
                { produk: "Tender Matching Engine", build: "Rp 80–200jt", buy: "Rp 10–25jt/bln", rec: "BUILD (custom)", time: "3–4 bulan", alasan: "Data LPSE proprietary — perlu integrasi khusus", rc: "text-orange-700" },
                { produk: "SKK Recommendation Bot", build: "Rp 40–80jt", buy: "Rp 2–5jt/bln", rec: "BUY (fine-tune GPT)", time: "3 minggu", alasan: "Domain knowledge bisa di-embed via RAG", rc: "text-emerald-700" },
                { produk: "Competitor Price Predictor", build: "Rp 60–150jt", buy: "Rp 8–20jt/bln", rec: "BUILD (scraper + ML)", time: "2–3 bulan", alasan: "Data IjinTender eksklusif, tidak ada API publik", rc: "text-orange-700" },
                { produk: "AI Proposal Writer", build: "Rp 30–60jt", buy: "Rp 2–4jt/bln", rec: "BUY (OpenAI + template)", time: "2 minggu", alasan: "Template-driven — LLM cukup dengan prompt system", rc: "text-emerald-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 hover:shadow-sm transition-all">
                  <td className="px-3 py-2 font-medium">{r.produk}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.build}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.buy}</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[10px] ${r.rc}`}>{r.rec}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.time}</td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground">{r.alasan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Competitive Moat Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> AI COMPETITIVE MOAT — Keunggulan Defensif Platform AI MJP vs Alternatif
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { moat: "Data Proprietary 64 Sumber", strength: "SANGAT KUAT", desc: "Kompetitor tidak punya akses dataset LPJK + LPSE + LPJKN terintegrasi", score: 95, sc: "text-emerald-700", bc: "bg-emerald-500" },
            { moat: "Domain Expertise Konstruksi", strength: "KUAT", desc: "7 tahun pengetahuan regulasi & sertifikasi industri — susah direplikasi", score: 88, sc: "text-emerald-700", bc: "bg-blue-500" },
            { moat: "Network Effect Klien", strength: "SEDANG-KUAT", desc: "500+ klien menghasilkan data feedback loop yang memperkuat akurasi AI", score: 72, sc: "text-blue-700", bc: "bg-blue-400" },
            { moat: "Switching Cost Tinggi", strength: "KUAT", desc: "Klien yang pakai platform intel MJP susah pindah karena histori & personalisasi", score: 80, sc: "text-emerald-700", bc: "bg-violet-500" },
            { moat: "Speed-to-Market Indonesia", strength: "SANGAT KUAT", desc: "First mover AI untuk pasar sertifikasi konstruksi nasional", score: 92, sc: "text-emerald-700", bc: "bg-orange-500" },
            { moat: "Regulatory Relationships", strength: "KUAT", desc: "Akses langsung ke LPJK, BNSP, LKPP — data pertama sebelum publik", score: 85, sc: "text-emerald-700", bc: "bg-primary" },
          ].map((m) => (
            <div key={m.moat} className="border rounded-sm p-3">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-[10px] font-semibold">{m.moat}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ${m.sc}`}>{m.strength}</span>
              </div>
              <p className="text-[9px] text-muted-foreground mb-1.5 leading-snug">{m.desc}</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${m.bc} rounded-full`} style={{ width: `${m.score}%` }} />
                </div>
                <span className={`text-[9px] font-mono font-bold ${m.sc}`}>{m.score}/100</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Adoption Readiness by Segment */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> AI ADOPTION READINESS — Kesiapan Adopsi AI per Segmen Klien Konstruksi
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { seg: "BUJK Kualifikasi B2–M3 (Digital Native)", ready: 82, barrier: "Biaya berlangganan", action: "Trial 30 hari gratis + ROI calculator", color: "bg-emerald-500", tc: "text-emerald-700" },
            { seg: "BUJK Kualifikasi K (Kecil)", ready: 45, barrier: "Literasi digital rendah", action: "Onboarding WhatsApp-first + video tutorial", color: "bg-yellow-500", tc: "text-yellow-700" },
            { seg: "Konsultan Proyek Independent", ready: 68, barrier: "Kekhawatiran data privasi", action: "SOC2 compliance brief + NDA template", color: "bg-blue-500", tc: "text-blue-700" },
            { seg: "Developer Properti Besar", ready: 78, barrier: "Integrasi ERP existing", action: "API-first + dedicated account manager", color: "bg-blue-400", tc: "text-blue-700" },
            { seg: "Pemerintah Daerah (Proyek APBD)", ready: 32, barrier: "Regulasi pengadaan ketat", action: "Masuk e-Katalog LKPP sebagai vendor", color: "bg-orange-500", tc: "text-orange-700" },
            { seg: "Asosiasi Konstruksi (LPJK, GAPENSI)", ready: 55, barrier: "Proses keputusan kolektif", action: "MoU + bulk license model", color: "bg-violet-500", tc: "text-violet-700" },
          ].map((s) => (
            <div key={s.seg} className="border rounded-sm p-3">
              <p className="text-[9px] font-semibold mb-1.5 leading-snug">{s.seg}</p>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${s.color} rounded-full`} style={{ width: `${s.ready}%` }} />
                </div>
                <span className={`text-[9px] font-mono font-bold ${s.tc}`}>{s.ready}%</span>
              </div>
              <p className="text-[8px] text-muted-foreground">⚠ {s.barrier}</p>
              <p className="text-[8px] font-mono text-primary mt-0.5">→ {s.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI ROI Proof Dashboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> AI ROI PROOF DASHBOARD — Bukti Nyata Return dari Setiap Produk AI
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {[
            { metric: "Revenue Dihasilkan AI", val: "Rp 38jt", sub: "Bulan Juli 2026", tc: "text-emerald-700" },
            { metric: "Jam Kerja Dihemat", val: "142 jam", sub: "vs proses manual", tc: "text-primary" },
            { metric: "Akurasi Rekomendasi", val: "91.4%", sub: "Avg semua model", tc: "text-blue-700" },
            { metric: "ROI Platform AI", val: "6.8×", sub: "Revenue / biaya AI", tc: "text-violet-700" },
          ].map((m) => (
            <div key={m.metric} className="border rounded-sm p-3 text-center bg-muted/20">
              <p className={`text-xl font-black font-mono leading-none ${m.tc}`}>{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{m.metric}</p>
              <p className={`text-[8px] font-mono ${m.tc}`}>{m.sub}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { produk: "Intel Tender AI", cases: "28 klien berhasil submit", outcome: "Rp 14jt revenue dikontribusi", c: "text-orange-700" },
            { produk: "SKK Match AI", cases: "41 kandidat tercocokan", outcome: "Rp 12jt dari referral", c: "text-blue-700" },
            { produk: "Compliance Alert AI", cases: "198 alert dikirim tepat waktu", outcome: "Rp 12jt avoided penalty", c: "text-emerald-700" },
          ].map((p) => (
            <div key={p.produk} className="border rounded-sm p-2">
              <p className="text-[9px] font-semibold mb-0.5">{p.produk}</p>
              <p className="text-[9px] text-muted-foreground mb-0.5">{p.cases}</p>
              <p className={`text-[9px] font-mono font-bold ${p.c}`}>{p.outcome}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Training Data Quality Monitor */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-primary" /> AI TRAINING DATA QUALITY — Kualitas Data yang Melatih Model AI Produk MJP
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label: "Total Data Poin", val: "142K", sub: "Terakumulasi sejak 2024", tc: "text-primary" },
            { label: "Kualitas Avg", val: "88%", sub: "Pass verifikasi silang", tc: "text-emerald-700" },
            { label: "Data Baru Bulan Ini", val: "12.4K", sub: "+8.7% vs bulan lalu", tc: "text-blue-700" },
            { label: "Model Retrain Terakhir", val: "3 hari lalu", sub: "Acc meningkat +2.1%", tc: "text-violet-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className={`text-lg font-black font-mono leading-none ${m.tc}`}>{m.val}</p>
              <p className="text-[9px] font-mono font-bold mt-0.5">{m.label}</p>
              <p className="text-[9px] text-muted-foreground">{m.sub}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { model: "Tender Intel Model", dataPoints: "48K", quality: 92, lastRetrain: "2 hari lalu", trend: "↑" },
            { model: "SKK Match Model", dataPoints: "35K", quality: 87, lastRetrain: "3 hari lalu", trend: "→" },
            { model: "Compliance Alert Model", dataPoints: "29K", quality: 90, lastRetrain: "5 hari lalu", trend: "↑" },
          ].map((m) => (
            <div key={m.model} className="border rounded-sm p-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-semibold">{m.model}</p>
                <span className="text-[9px] font-mono text-primary">{m.trend} {m.quality}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-0.5">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${m.quality}%` }} />
              </div>
              <p className="text-[8px] font-mono text-muted-foreground">{m.dataPoints} poin · Retrain {m.lastRetrain}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Product Adoption Funnel */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> AI ADOPTION FUNNEL — Perjalanan Klien dari Tahu Produk AI sampai Bayar
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { stage: "Aware (Lihat demo / artikel)", pct: 100, users: 1840, c: "bg-primary" },
            { stage: "Interest (Klik coba gratis / tanya harga)", pct: 58, users: 1067, c: "bg-blue-500" },
            { stage: "Trial (Gunakan versi demo)", pct: 31, users: 570, c: "bg-violet-500" },
            { stage: "Conversion (Beli paket pertama)", pct: 14, users: 258, c: "bg-orange-500" },
            { stage: "Retention (Bayar bulan ke-2+)", pct: 9, users: 166, c: "bg-emerald-500" },
          ].map((s) => (
            <div key={s.stage} className="flex items-center gap-3">
              <p className="text-[9px] text-muted-foreground w-52 shrink-0">{s.stage}</p>
              <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${s.c} rounded-full`} style={{ width: `${s.pct}%` }} />
              </div>
              <p className="text-[9px] font-mono font-bold w-8 text-right shrink-0 text-primary">{s.pct}%</p>
              <p className="text-[9px] font-mono text-muted-foreground w-12 text-right shrink-0">{s.users.toLocaleString()}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Drop terbesar: Trial → Conversion (31% → 14%) — tingkatkan guided onboarding + social proof + money-back guarantee</p>
      </div>

      {/* AI Feature Request Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Blocks className="h-3.5 w-3.5 text-primary" /> AI FEATURE REQUEST TRACKER — Fitur yang Paling Sering Diminta Klien untuk Produk AI
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { feature: "Auto-notifikasi 30/60/90 hari sebelum SKK expiry", requests: 248, impact: "Retensi Tinggi", feasibility: "MUDAH", fc: "text-emerald-700" },
            { feature: "AI pengisi form tender otomatis dari data BUJK", requests: 196, impact: "Pengubah Permainan", feasibility: "SEDANG", fc: "text-blue-700" },
            { feature: "Prediksi probabilitas menang tender sebelum bid", requests: 184, impact: "Fitur Premium", feasibility: "SULIT", fc: "text-orange-700" },
            { feature: "Chatbot WhatsApp untuk cek status SKK / SBU", requests: 162, impact: "Volume Tinggi", feasibility: "MUDAH", fc: "text-emerald-700" },
            { feature: "Dashboard compliance real-time per BUJK", requests: 138, impact: "Peluang Upsell", feasibility: "SEDANG", fc: "text-blue-700" },
          ].map((f) => (
            <div key={f.feature} className="flex items-center gap-3 border-b last:border-0 pb-1.5 last:pb-0">
              <div className="flex-1">
                <p className="text-[9px] font-medium leading-snug">{f.feature}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[8px] font-mono font-bold ${f.fc}`}>{f.impact}</span>
                  <span className="text-[8px] font-mono text-muted-foreground">· {{ "MUDAH":"Mudah", "SEDANG":"Sedang", "SULIT":"Sulit" }[f.feasibility] ?? f.feasibility}</span>
                </div>
              </div>
              <div className="text-center shrink-0 w-12">
                <p className="text-[12px] font-black font-mono text-primary leading-none">{f.requests}</p>
                <p className="text-[7px] font-mono text-muted-foreground">request</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Product ROI Calculator */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> AI PRODUCT ROI CALCULATOR — Return on Investment Membangun vs Membeli Setiap Fitur AI
        </p>
        <div className="flex flex-col gap-2">
          {[
            { feature: "Sistem Notifikasi SKK Expiry Otomatis", buildCost: "Rp 15jt", buyCost: "Rp 3jt/bln", timeToROI: "2 bulan", revenueImpact: "+Rp 28jt/bln", rec: "BELI", rc: "text-emerald-700" },
            { feature: "AI Generator Surat Penawaran", buildCost: "Rp 45jt", buyCost: "N/A (custom)", timeToROI: "5 bulan", revenueImpact: "+Rp 34jt/bln", rec: "BANGUN", rc: "text-blue-700" },
            { feature: "Chatbot WhatsApp Compliance Advisor", buildCost: "Rp 28jt", buyCost: "Rp 5jt/bln", timeToROI: "3 bulan", revenueImpact: "+Rp 18jt/bln", rec: "BELI", rc: "text-emerald-700" },
            { feature: "AI Tender Win Probability Scorer", buildCost: "Rp 80jt", buyCost: "N/A", timeToROI: "8 bulan", revenueImpact: "+Rp 52jt/bln", rec: "BANGUN", rc: "text-blue-700" },
          ].map((f) => (
            <div key={f.feature} className="flex items-center gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[9px] font-semibold">{f.feature}</p>
                  <span className={`text-[8px] font-mono font-bold shrink-0 ${f.rc}`}>[{{ "BELI":"Beli", "BANGUN":"Bangun" }[f.rec] ?? f.rec}]</span>
                </div>
                <p className="text-[9px] text-muted-foreground">Build: {f.buildCost} · SaaS: {f.buyCost} · ROI: {f.timeToROI}</p>
              </div>
              <p className="text-[9px] font-mono font-bold text-emerald-700 shrink-0">{f.revenueImpact}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Competitive Landscape */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" /> AI COMPETITIVE LANDSCAPE — Platform AI Konstruksi di Indonesia & Positioning MJP
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Platform", "Fokus", "Harga", "Kelebihan vs MJP", "Kelemahan vs MJP"].map(h => (
                  <th key={h} className="text-left px-2 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { name: "Nawadata", focus: "Analytics tender pemerintah", price: "Rp 1.5–8jt/bln", strength: "Data LPSE lebih luas", weakness: "Tidak ada advisory + SKK layanan", mjp: true },
                { name: "SIBIMA CIPTA KARYA", focus: "Portal resmi PUPR", price: "Gratis", strength: "Sumber data otoritatif", weakness: "Hanya informasi, tidak ada jasa konsultan", mjp: true },
                { name: "Konstruksi.AI (startup)", focus: "BIM + scheduling AI", price: "Rp 5–25jt/bln", strength: "Tech lebih canggih", weakness: "Tidak ada expertise regulasi & sertifikasi", mjp: true },
                { name: "MJP Platform (kita)", focus: "Regulasi + SKK + Tender all-in-one", price: "Paket custom", strength: "Advisory + eksekusi = end-to-end", weakness: "UI perlu upgrade ke level enterprise", mjp: false },
              ].map((c, i) => (
                <tr key={i} className={`border-b last:border-0 ${!c.mjp ? "bg-primary/5 font-semibold" : "hover:bg-muted/30"} transition-colors`}>
                  <td className="px-2 py-2 text-[9px] font-medium">{c.name}</td>
                  <td className="px-2 py-2 text-[9px] text-muted-foreground">{c.focus}</td>
                  <td className="px-2 py-2 font-mono text-[9px]">{c.price}</td>
                  <td className="px-2 py-2 text-[9px] text-orange-700">{c.strength}</td>
                  <td className="px-2 py-2 text-[9px] text-emerald-700">{c.weakness}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Implementation Readiness Assessment */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> AI READINESS ASSESSMENT — Seberapa Siap Organisasi MJP Mengadopsi dan Menjalankan AI
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {[
            { dim: "Data Infrastructure", score: 78, detail: "DB sudah terstruktur, API tersedia", c: "bg-blue-500", tc: "text-blue-700" },
            { dim: "Team AI Literacy", score: 52, detail: "Perlu training intensif tim non-tech", c: "bg-orange-500", tc: "text-orange-700" },
            { dim: "Process Automation", score: 71, detail: "Scheduler + notif sudah berjalan", c: "bg-violet-500", tc: "text-violet-700" },
            { dim: "Data Quality", score: 64, detail: "62% data sudah validated", c: "bg-yellow-500", tc: "text-yellow-700" },
            { dim: "Leadership Buy-in", score: 88, detail: "Manajemen aktif dorong AI roadmap", c: "bg-emerald-500", tc: "text-emerald-700" },
            { dim: "Budget Allocation", score: 61, detail: "AI budget ada tapi belum cukup dedicated", c: "bg-orange-400", tc: "text-orange-700" },
          ].map((d) => (
            <div key={d.dim} className="border rounded-sm p-2">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[9px] font-semibold">{d.dim}</p>
                <span className={`text-[10px] font-mono font-black ${d.tc}`}>{d.score}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                <div className={`h-full ${d.c} rounded-full`} style={{ width: `${d.score}%` }} />
              </div>
              <p className="text-[9px] text-muted-foreground leading-snug">{d.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Overall AI Readiness: <b>69/100</b> (SIAP dengan catatan) · Bottleneck: Team AI Literacy → prioritaskan workshop Q3 2026</p>
      </div>

      {/* AI Value Chain Mapping */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-primary" /> AI VALUE CHAIN MAPPING — Di Mana AI MJP Menciptakan Nilai Terbesar dalam Proses Bisnis
        </p>
        <div className="flex flex-col gap-2">
          {[
            { step: "DATA INGESTION", aiRole: "Auto-crawl LPSE + LPJK + BNSP", value: 88, manual: "4 jam/hari → 0 jam", gain: "Hemat 100+ jam/bulan", c: "bg-emerald-500", tc: "text-emerald-700" },
            { step: "ANALYSIS & PATTERN", aiRole: "Deteksi pola win/loss + kompetitor", value: 72, manual: "Analisis manual tidak scalable", gain: "Insight yang tidak mungkin manual", c: "bg-blue-500", tc: "text-blue-700" },
            { step: "BRIEFING GENERATION", aiRole: "Susun laporan harian otomatis 07:00", value: 81, manual: "1.5 jam/hari → 5 menit review", gain: "Konsistensi 100% vs manual 60%", c: "bg-violet-500", tc: "text-violet-700" },
            { step: "RECOMMENDATION", aiRole: "Suggest layanan berdasarkan profil BUJK", value: 64, manual: "Account manager harus hafal semua klien", gain: "Personalisasi untuk 2.000+ klien", c: "bg-orange-500", tc: "text-orange-700" },
            { step: "NOTIFICATION", aiRole: "Trigger alert SKK/SBU expiry otomatis", value: 92, manual: "Tidak mungkin manual untuk semua klien", gain: "Zero missed expiry = 0 churn karena lupa", c: "bg-emerald-500", tc: "text-emerald-700" },
          ].map((v) => (
            <div key={v.step} className="flex items-center gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="w-24 shrink-0">
                <p className={`text-[8px] font-mono font-bold ${v.tc}`}>{v.step}</p>
                <div className="h-1 bg-muted rounded-full overflow-hidden mt-0.5">
                  <div className={`h-full ${v.c} rounded-full`} style={{ width: `${v.value}%` }} />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-[9px] font-medium leading-snug">{v.aiRole}</p>
                <p className="text-[9px] text-muted-foreground">Sebelum AI: {v.manual}</p>
              </div>
              <p className={`text-[9px] font-mono font-bold shrink-0 text-right w-40 ${v.tc}`}>{v.gain}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Cost Efficiency Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> AI COST EFFICIENCY — Cost per AI Output vs Nilai yang Dihasilkan untuk Operasional MJP
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["AI Task", "Cost/Bln", "Volume", "Cost/Unit", "Value/Unit", "ROI"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { task: "Briefing harian 07:00", cost: "Rp 180rb", vol: "30×", cpu: "Rp 6rb", vpu: "Rp 1.2jt", roi: "200×", rc: "text-emerald-700" },
                { task: "SKK expiry alert & matching", cost: "Rp 95rb", vol: "450×", cpu: "Rp 211", vpu: "Rp 7.2jt", roi: "34.000×", rc: "text-emerald-700" },
                { task: "Rekomendasi tender otomatis", cost: "Rp 320rb", vol: "1.800×", cpu: "Rp 178", vpu: "Rp 48rb", roi: "270×", rc: "text-emerald-700" },
                { task: "Analisis kompetitor dari crawl", cost: "Rp 240rb", vol: "90×", cpu: "Rp 2.7rb", vpu: "Rp 58rb", roi: "21×", rc: "text-blue-700" },
                { task: "Klasifikasi pain point otomatis", cost: "Rp 55rb", vol: "600×", cpu: "Rp 92", vpu: "Rp 1.8rb", roi: "20×", rc: "text-blue-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 hover:shadow-sm transition-all">
                  <td className="px-3 py-2 text-[9px] font-medium">{r.task}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{r.cost}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{r.vol}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{r.cpu}</td>
                  <td className="px-3 py-2 font-mono text-primary">{r.vpu}</td>
                  <td className={`px-3 py-2 font-mono font-bold ${r.rc}`}>{r.roi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>DAFTAR PRODUK AI</CardTitle>
            <div className="flex gap-2 flex-wrap">
              {/* Text search */}
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  ref={searchRef}
                  value={recSearch}
                  onChange={e => setRecSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === "Escape") { setRecSearch(""); e.currentTarget.blur(); } }}
                  title="Tekan / untuk fokus ke pencarian"
                  placeholder="Cari rekomendasi… · Esc reset"
                  className="h-8 rounded-sm border border-input bg-background pl-7 pr-6 py-1 text-[11px] font-mono w-52 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                {!recSearch && <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">/</kbd>}
                {recSearch && (
                  <button onClick={() => setRecSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Hapus pencarian">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              {/* Status filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-36 text-[11px] font-mono bg-background" aria-label="Filter status rekomendasi">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-[11px] font-mono">Semua Status</SelectItem>
                  <SelectItem value="CONCEPT" className="text-[11px] font-mono">Konsep</SelectItem>
                  <SelectItem value="VALIDATED" className="text-[11px] font-mono">Tervalidasi</SelectItem>
                  <SelectItem value="IN_DEVELOPMENT" className="text-[11px] font-mono">Dalam Pengembangan</SelectItem>
                  <SelectItem value="LAUNCHED" className="text-[11px] font-mono">Diluncurkan</SelectItem>
                </SelectContent>
              </Select>
              {/* Priority filter */}
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-8 w-36 text-[11px] font-mono bg-background" aria-label="Filter prioritas rekomendasi">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-[11px] font-mono">Semua Prioritas</SelectItem>
                  <SelectItem value="CRITICAL" className="text-[11px] font-mono">Kritis</SelectItem>
                  <SelectItem value="HIGH" className="text-[11px] font-mono">Tinggi</SelectItem>
                  <SelectItem value="MEDIUM" className="text-[11px] font-mono">Sedang</SelectItem>
                  <SelectItem value="LOW" className="text-[11px] font-mono">Rendah</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead colSpan={6} className="py-2 px-3 bg-muted/20 border-b">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPinnedRecs(v => !v)}
                      aria-pressed={showPinnedRecs}
                      className={cn("h-7 px-2.5 text-[10px] font-mono font-bold rounded-sm border transition-colors flex items-center gap-1", showPinnedRecs ? "bg-amber-100 text-amber-700 border-amber-400" : "border-border text-muted-foreground hover:bg-muted")}
                    >
                      <Star className={cn("h-3 w-3", showPinnedRecs && "fill-amber-400 text-amber-500")} />
                      {showPinnedRecs ? `${pinnedRecs.size} dipin` : "Semua"}
                    </button>
                    {(statusFilter !== "ALL" || priorityFilter !== "ALL" || showPinnedRecs || recSearch) && (
                      <button
                        onClick={() => { setStatusFilter("ALL"); setPriorityFilter("ALL"); setShowPinnedRecs(false); setRecSearch(""); }}
                        className="h-7 px-2 text-[9px] font-mono font-bold rounded-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1"
                        title="Reset semua filter"
                      >
                        ✕ Reset
                      </button>
                    )}
                    {Object.values(recNotes).filter(v => v?.trim()).length > 0 && (
                      <button
                        onClick={() => { setShowPinnedRecs(false); setRecSearch("catatan:"); }}
                        className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 transition-colors"
                        title="Filter rekomendasi dengan catatan"
                      >
                        {Object.values(recNotes).filter(v => v?.trim()).length} catatan
                      </button>
                    )}
                    <span className="text-[9px] font-mono text-muted-foreground ml-auto">{pinnedRecs.size} dari {recsAll.length} dipin</span>
                  </div>
                </TableHead>
              </TableRow>
              <TableRow>
                <TableHead>Nama Produk AI</TableHead>
                <TableHead>Target User</TableHead>
                <TableHead>Tech Stack</TableHead>
                <TableHead>Metrics</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell><div className="h-3 bg-muted rounded w-8" /></TableCell>
                    <TableCell><div className="h-3 bg-muted rounded w-40" /></TableCell>
                    <TableCell><div className="h-3 bg-muted rounded w-20" /></TableCell>
                    <TableCell><div className="h-3 bg-muted rounded w-16" /></TableCell>
                    <TableCell><div className="h-3 bg-muted rounded w-12" /></TableCell>
                    <TableCell><div className="h-3 bg-muted rounded w-16" /></TableCell>
                  </TableRow>
                ))
              ) : recommendations?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    <p className="text-muted-foreground font-mono text-sm mb-2">Belum ada ide produk AI</p>
                    <button
                      onClick={() => setIsCreateOpen(true)}
                      className="text-xs text-primary border border-primary/30 px-3 py-1.5 rounded-sm hover:bg-primary/5 transition-colors font-mono"
                    >
                      + Tambah Ide AI Pertama
                    </button>
                  </TableCell>
                </TableRow>
              ) : (() => {
                const filteredRecs = (recommendations ?? []).filter(rec =>
                  (statusFilter === "ALL" || rec.status === statusFilter) &&
                  (priorityFilter === "ALL" || rec.priority === priorityFilter) &&
                  (!showPinnedRecs || pinnedRecs.has(rec.id)) &&
                  (!recSearch || rec.aiProductName.toLowerCase().includes(recSearch.toLowerCase()) || rec.problemSolved.toLowerCase().includes(recSearch.toLowerCase()) || (recNotes[rec.id] ?? "").toLowerCase().includes(recSearch.toLowerCase()))
                );
                if (filteredRecs.length === 0) return (
                  <TableRow><TableCell colSpan={6} className="text-center h-32">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="h-8 w-8 opacity-30" />
                      <span className="text-muted-foreground font-mono text-xs">Tidak ada rekomendasi sesuai filter.</span>
                      <button
                        className="text-[10px] font-mono text-primary underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none"
                        onClick={() => { setStatusFilter("ALL"); setPriorityFilter("ALL"); setRecSearch(""); setShowPinnedRecs(false); }}
                      >
                        Reset filter
                      </button>
                    </div>
                  </TableCell></TableRow>
                );
                return filteredRecs.map(rec => (
                  <React.Fragment key={rec.id}>
                    <TableRow className={cn("group cursor-pointer transition-all hover:shadow-sm", expandedId === rec.id && "bg-muted/30", pinnedRecs.has(rec.id) && "bg-amber-50/40")} onClick={() => setExpandedId(expandedId === rec.id ? null : rec.id)}>
                      <TableCell>
                        <div className="font-bold text-base flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-primary" /> {rec.aiProductName}
                          {rec.createdAt && (Date.now() - new Date(rec.createdAt).getTime()) < 7 * 86400000 && (
                            <span className="text-[8px] font-mono bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded-sm border border-emerald-200">Baru</span>
                          )}
                          {rec.createdAt && <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-mono text-muted-foreground ml-1">{new Date(rec.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-1" title={rec.problemSolved ?? undefined}>{rec.problemSolved}</div>
                      </TableCell>
                      <TableCell className="text-sm max-w-[180px]"><span className="line-clamp-2" title={rec.targetUsers ?? undefined}>{rec.targetUsers}</span></TableCell>
                      <TableCell>
                        <span className="text-xs font-mono px-2 py-1 bg-muted rounded-sm border border-border inline-block max-w-[150px] truncate" title={rec.techStack || 'TBD'}>
                          {rec.techStack || 'TBD'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 w-fit">
                          <Badge variant="outline" className={cn("text-[10px] font-mono px-1.5 py-0 border", getPriorityColor(rec.priority))} title={({ CRITICAL:"Kritis — implementasi wajib segera", HIGH:"Tinggi — prioritaskan dalam sprint ini", MEDIUM:"Sedang — masuk backlog Q1", LOW:"Rendah — pantau perkembangan" } as Record<string,string>)[rec.priority] ?? rec.priority}>
                            {({ CRITICAL:"Kritis", HIGH:"Tinggi", MEDIUM:"Sedang", LOW:"Rendah" } as Record<string,string>)[rec.priority] ?? rec.priority}
                          </Badge>
                          <Badge variant="outline" className={cn("text-[10px] font-mono px-1.5 py-0 border", getFeasibilityColor(rec.feasibility))} title={({ HIGH:"Mudah diimplementasi — resource minimal", MEDIUM:"Kelayakan sedang — butuh perencanaan", LOW:"Sulit — butuh resource signifikan" } as Record<string,string>)[rec.feasibility ?? ""] ?? rec.feasibility ?? undefined}>
                            {({ HIGH:"Mudah", MEDIUM:"Sedang", LOW:"Sulit" } as Record<string,string>)[rec.feasibility ?? ""] ?? rec.feasibility}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={rec.status === 'LAUNCHED' ? 'default' : 'secondary'} className="text-[10px] font-mono" title={({ IDEA:"Ide — konsep awal, belum divalidasi", VALIDATING:"Validasi — sedang uji kelayakan dengan calon pengguna", BUILDING:"Dibangun — pengembangan aktif", LAUNCHED:"Diluncurkan — produk sudah live", PAUSED:"Ditunda — pengembangan dihentikan sementara" } as Record<string,string>)[rec.status ?? ""] ?? rec.status ?? undefined}>
                          {({ IDEA:"Ide", VALIDATING:"Validasi", BUILDING:"Dibangun", LAUNCHED:"Diluncurkan", PAUSED:"Ditunda" } as Record<string,string>)[rec.status ?? ""] ?? rec.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleRecPin(rec.id); }}
                            aria-label={pinnedRecs.has(rec.id) ? "Hapus pin rekomendasi ini" : "Pin rekomendasi ini"}
                            className={cn("h-7 w-7 flex items-center justify-center rounded-sm border transition-colors", pinnedRecs.has(rec.id) ? "bg-amber-100 border-amber-400 text-amber-600" : "border-border text-muted-foreground hover:border-amber-400 hover:text-amber-500")}
                            title={pinnedRecs.has(rec.id) ? "Hapus pin" : "Pin rekomendasi ini"}
                          >
                            <Star className={cn("h-3.5 w-3.5", pinnedRecs.has(rec.id) && "fill-amber-400")} />
                          </button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Lihat tren adopsi"><TrendingUp className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === rec.id && (
                      <TableRow className="bg-muted/10 border-b-2 border-primary/20">
                        <TableCell colSpan={6} className="p-0">
                          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 shadow-inner">
                            <div>
                              <h4 className="text-xs font-bold text-muted-foreground font-mono mb-2 uppercase">DESKRIPSI LENGKAP</h4>
                              <p className="text-sm leading-relaxed mb-6">{rec.description}</p>
                              
                              <h4 className="text-xs font-bold text-muted-foreground font-mono mb-2 uppercase">MASALAH YANG DIPecahkan</h4>
                              <p className="text-sm leading-relaxed border-l-2 border-primary pl-3 italic">{rec.problemSolved}</p>
                            </div>
                            <div className="space-y-6">
                              <div>
                                <h4 className="text-xs font-bold text-muted-foreground font-mono mb-2 uppercase">CATATAN TIM</h4>
                                <textarea
                                  value={recNotes[rec.id] ?? ""}
                                  onChange={(e) => { e.stopPropagation(); updateRecNote(rec.id, e.target.value); }}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); }}
                                  onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                                  placeholder="Tambah analisis, keputusan, atau konteks untuk produk ini…"
                                  rows={2}
                                  maxLength={500}
                                  className="w-full border rounded-sm px-2.5 py-1.5 text-xs resize-none bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
                                />
                                <div className="flex justify-between items-center">
                                  {savedNoteId === rec.id ? <span className="text-[9px] font-mono text-emerald-600">✓ Tersimpan</span> : <span />}
                                  <p className="text-[9px] font-mono text-muted-foreground text-right">{(recNotes[rec.id] ?? "").length} / 500</p>
                                </div>
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-muted-foreground font-mono mb-2 uppercase">ESTIMASI DAMPAK</h4>
                                <div className="bg-background border rounded-md p-3 text-sm font-medium text-green-600 dark:text-green-400">
                                  {rec.estimatedImpact || 'Belum ada estimasi dampak'}
                                </div>
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-muted-foreground font-mono mb-2 uppercase">REVENUE MODEL</h4>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="font-mono bg-background">
                                    {rec.revenueModel || 'FREE'}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex gap-2 justify-end pt-4 border-t border-border flex-wrap">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-green-500/40 text-green-700 hover:bg-green-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const txt = `🤖 *Produk AI: ${rec.aiProductName}*\n\n📌 Masalah: ${rec.problemSolved ?? "-"}\n🎯 Target: ${rec.targetUsers ?? "-"}\n💰 Revenue: ${rec.revenueModel ?? "-"}\n📊 Dampak: ${rec.estimatedImpact ?? "-"}\n⚙️ Status: ${rec.status}\n\n_Platform Intel-Konstruksi – PT Maheswara Jaya Persada_`;
                                    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
                                  }}
                                >
                                  <MessageCircle className="h-3 w-3 mr-2 text-green-600" /> Bagikan WA
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={generating === rec.id}
                                  onClick={(e) => { e.stopPropagation(); void startPrototype(rec); }}
                                >
                                  {generating === rec.id
                                    ? <><Loader2 className="h-3 w-3 mr-2 animate-spin" /> Generating…</>
                                    : <><Play className="h-3 w-3 mr-2" /> MULAI PROTOTYPE</>
                                  }
                                </Button>
                                {aiOutput[rec.id] && (
                                  <AiOutputDeleteButton
                                    onConfirm={(e) => { e.stopPropagation(); setAiOutput(prev => { const n = {...prev}; delete n[rec.id]; return n; }); }}
                                  />
                                )}
                                <Button
                                  size="sm"
                                  disabled={updateMutation.isPending}
                                  onClick={(e) => { e.stopPropagation(); updateMutation.mutate({ id: rec.id, data: { status: nextAiStatus(rec.status) } }); }}
                                >
                                  {updateMutation.isPending ? <LoaderCircle className="h-3 w-3 animate-spin mr-1" /> : null}→ {nextAiStatus(rec.status)}
                                </Button>
                              </div>
                              {/* AI Prototype Output */}
                              {aiOutput[rec.id] && (
                                <div className="mt-3 pt-3 border-t border-border">
                                  <div className="flex items-center gap-2 mb-2">
                                    <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-violet-700 flex items-center gap-1.5">
                                      <Sparkles className="h-3 w-3" /> SPESIFIKASI MVP — AI GENERATED
                                    </p>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="ml-auto h-6 text-[9px] font-mono text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={(e) => { e.stopPropagation(); void navigator.clipboard.writeText(aiOutput[rec.id] ?? "").then(() => toast.success("Disalin ke clipboard", { duration: 1500 })); }}
                                    >
                                      <ClipboardCheck className="h-3 w-3 mr-1" /> Copy
                                    </Button>
                                  </div>
                                  <div className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap bg-muted/40 rounded-sm p-2 max-h-48 overflow-y-auto">
                                    {aiOutput[rec.id]}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ));
              })()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* AI Roadmap 12-Bulan */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> AI PRODUCT ROADMAP — Timeline Launch 12 Bulan ke Depan
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { q: "Q3 2026", phase: "VALIDASI", products: ["SBU Expiry Monitor v1", "Pain-Point CPKB Intake", "Tender Eligibility Checker"], color: "border-blue-400 bg-blue-50/30 text-blue-700", status: "IN PROGRESS" },
            { q: "Q4 2026", phase: "LAUNCH AWAL", products: ["SKK Renewal Planner", "Competitor Intel Radar", "TKDN Compliance Bot"], color: "border-orange-400 bg-orange-50/30 text-orange-700", status: "PLANNED" },
            { q: "Q1 2027", phase: "SKALASI", products: ["Tender Win Predictor", "SMAP Gap Analyzer", "BIM Readiness Advisor"], color: "border-emerald-400 bg-emerald-50/30 text-emerald-700", status: "CONCEPT" },
            { q: "Q2 2027", phase: "PLATFORM", products: ["MJP Intel API", "White-Label Dashboard", "Mobile AI Fieldkit Pro"], color: "border-purple-400 bg-purple-50/30 text-purple-700", status: "IDEA" },
          ].map((q) => (
            <div key={q.q} className={`border rounded-sm p-3 ${q.color}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-bold uppercase">{q.q}</span>
                <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-sm font-bold ${q.color}`}>{q.status}</span>
              </div>
              <p className="text-xs font-bold mb-2">{q.phase}</p>
              <div className="flex flex-col gap-1">
                {q.products.map((p) => (
                  <div key={p} className="flex items-center gap-1.5 text-[10px]">
                    <Cpu className="h-2.5 w-2.5 shrink-0 opacity-60" />
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Roadmap didasarkan pada prioritas pain points CPKB + sinyal pasar aktif · Review tiap kuartal</p>
      </div>

      {/* AI Rekomendasi Confidence Calibration */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-violet-600" /> AI CONFIDENCE CALIBRATION — Akurasi Prediksi AI per Kategori Rekomendasi vs Hasil Aktual di Lapangan
        </p>
        <div className="flex flex-col gap-2">
          {[
            { cat: "Prediksi Tender Menang", predicted: 87, actual: 84, samples: 51, status: "TERKALIBRASI", sc: "text-emerald-700" },
            { cat: "Rekomendasi SKK Jenjang", predicted: 91, actual: 89, samples: 128, status: "TERKALIBRASI", sc: "text-emerald-700" },
            { cat: "Estimasi Biaya Layanan", predicted: 74, actual: 68, samples: 44, status: "PERLU TUNING", sc: "text-orange-700" },
            { cat: "Skor Prioritas Pain Point", predicted: 83, actual: 79, samples: 312, status: "TERKALIBRASI", sc: "text-emerald-700" },
            { cat: "Prediksi Churn Klien", predicted: 69, actual: 58, samples: 22, status: "UNDER-CONFIDENT", sc: "text-red-700" },
          ].map((r) => (
            <div key={r.cat} className="flex items-center gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-[9px] font-medium">{r.cat}</p>
                  <span className={`text-[8px] font-mono font-bold shrink-0 ml-2 ${r.sc}`}>{r.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden relative">
                    <div className="h-full bg-primary/30 rounded-full" style={{ width: `${r.predicted}%` }} />
                    <div className="absolute top-0 h-full bg-emerald-500 rounded-full" style={{ width: `${r.actual}%`, opacity: 0.7 }} />
                  </div>
                  <span className="text-[8px] font-mono text-muted-foreground shrink-0 w-24">Pred {r.predicted}% / Real {r.actual}%</span>
                  <span className="text-[8px] font-mono text-muted-foreground shrink-0">{r.samples} sample</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Churn prediction paling under-confident — butuh lebih banyak data historis churn untuk fine-tune model</p>
      </div>

      {/* AI Agent Workload & Task Queue */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-violet-600" /> AI AGENT WORKLOAD — Status Antrian Tugas yang Sedang Dikerjakan AI Agent di Seluruh Platform MJP
        </p>
        <div className="flex flex-col gap-2">
          {[
            { agent: "Synthesis Agent", task: "Mengkompilasi 47 pain points Sulawesi → draft proposal layanan", status: "RUNNING", progress: 67, eta: "~8 menit", ac: "text-blue-700", sc: "text-blue-700 bg-blue-50" },
            { agent: "Briefing Agent", task: "Menyusun briefing harian Rabu 2 Agustus — 64 sumber terpilih", status: "RUNNING", progress: 89, eta: "~2 menit", ac: "text-blue-700", sc: "text-blue-700 bg-blue-50" },
            { agent: "Competitor Intel Agent", task: "Crawl harga terbaru dari IjinTender + 3 portal tender", status: "SCHEDULED", progress: 0, eta: "07:00 esok", ac: "text-slate-600", sc: "text-slate-600 bg-slate-50" },
            { agent: "SKK Expiry Alert Agent", task: "Scan 312 kontraktor — SKK yang expire dalam 30/60/90 hari", status: "QUEUED", progress: 0, eta: "setelah crawl", ac: "text-slate-600", sc: "text-slate-600 bg-slate-50" },
            { agent: "Market Trend Agent", task: "Analisis 8 sinyal pasar baru dari pain points + tender + regulasi", status: "DONE ✓", progress: 100, eta: "selesai", ac: "text-emerald-700", sc: "text-emerald-700 bg-emerald-50" },
          ].map((r) => (
            <div key={r.agent} className="flex items-center gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-[9px] font-bold">{r.agent}</p>
                  <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm shrink-0 ${r.sc}`}>{r.status}</span>
                </div>
                <p className="text-[9px] text-muted-foreground mb-0.5">{r.task}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${r.progress === 100 ? "bg-emerald-500" : "bg-blue-400"} rounded-full transition-all`} style={{ width: `${r.progress}%` }} />
                  </div>
                  <span className="text-[8px] font-mono text-muted-foreground shrink-0">{r.progress}% · ETA: {r.eta}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Recommendation ROI Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> AI RECOMMENDATION ROI TRACKER — Berapa Revenue Nyata yang Dihasilkan dari Rekomendasi AI yang Dieksekusi Tim
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label: "Total Rek. Dieksekusi", val: "147", tc: "text-primary" },
            { label: "Revenue Terattribusi", val: "Rp 284jt", tc: "text-emerald-700" },
            { label: "Avg ROI per Rekomendasi", val: "Rp 1.93jt", tc: "text-blue-700" },
            { label: "Payback Period Avg", val: "8.2 hari", tc: "text-blue-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center">
              <p className={`text-lg font-black font-mono ${m.tc} leading-none`}>{m.val}</p>
              <p className="text-[8px] font-mono mt-0.5 text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {[
            { rec: "\"Tawarkan SKK Express ke klien yang tender dalam 30 hari\"", executed: 38, revenue: "Rp 57jt", conversion: "71%" },
            { rec: "\"Bundling SMAP + Intel Tender untuk BUJK BUMN target\"", executed: 24, revenue: "Rp 89jt", conversion: "54%" },
            { rec: "\"Proaktif kontak kontraktor dengan SKK mau expire\"", executed: 61, revenue: "Rp 94jt", conversion: "83%" },
          ].map((r) => (
            <div key={r.rec} className="flex items-start gap-2 border-b last:border-0 pb-1 last:pb-0">
              <p className="text-[9px] flex-1 leading-snug">{r.rec}</p>
              <div className="text-right shrink-0">
                <p className="text-[9px] font-mono font-bold text-emerald-700">{r.revenue}</p>
                <p className="text-[8px] font-mono text-muted-foreground">{r.executed}× · {r.conversion} CR</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Ethics & Transparency Dashboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" /> AI ETHICS & TRANSPARENCY — Prinsip yang Digunakan AI dalam Menghasilkan Rekomendasi untuk Klien MJP
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          {[
            { principle: "Explainability", status: "AKTIF", desc: "Setiap rekomendasi disertai alasan berbasis data yang dapat dibaca tim", icon: "✓", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { principle: "Human Override", status: "AKTIF", desc: "Tim selalu bisa menolak/modifikasi rekomendasi AI sebelum dikirim ke klien", icon: "✓", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { principle: "Bias Monitoring", status: "PARSIAL", desc: "Monitoring bias wilayah Jawa-sentris ongoing — model sedang dibalance", icon: "⚠", sc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { principle: "Data Privacy", status: "AKTIF", desc: "PII klien tidak dipakai untuk training model — hanya anonymous aggregate", icon: "✓", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.principle} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] ${r.sc}`}>{r.icon}</span>
                <p className={`text-[9px] font-bold ${r.sc}`}>{r.principle}</p>
                <span className={`text-[8px] font-mono font-bold ml-auto ${r.sc}`}>{r.status}</span>
              </div>
              <p className="text-[9px] text-muted-foreground leading-snug">{r.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">AI MJP adalah partner penguat keputusan — bukan pengganti judgment tim. Human-in-the-loop selalu di setiap output kritikal.</p>
      </div>

      {/* AI Learning Curve Dashboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-violet-600" /> AI LEARNING CURVE DASHBOARD — Peningkatan Kualitas Rekomendasi AI Seiring Bertambahnya Data Pelatihan
        </p>
        <div className="flex items-end gap-1 h-20 mb-2">
          {[
            { period: "Q1'25", accuracy: 58 }, { period: "Q2'25", accuracy: 67 },
            { period: "Q3'25", accuracy: 73 }, { period: "Q4'25", accuracy: 79 },
            { period: "Q1'26", accuracy: 84 }, { period: "Q2'26", accuracy: 89 },
            { period: "Q3'26", accuracy: 91, current: true },
          ].map((m) => {

            const maxAcc = 95;
            return (
              <div key={m.period} className="flex flex-col items-center gap-0.5 flex-1">
                <p className="text-[7px] font-mono font-bold">{m.accuracy}%</p>
                <div className={`w-full rounded-t-sm ${m.current ? "bg-violet-600" : "bg-violet-300"}`} style={{ height: `${(m.accuracy / maxAcc) * 100}%` }} />
                <p className="text-[7px] font-mono">{m.period}</p>
                {m.current && <p className="text-[6px] font-mono font-bold text-violet-700">NOW</p>}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {[
            { label: "Training Data", val: "47.200 records", tc: "text-primary" },
            { label: "Model Version", val: "v4.2 (Jul 2026)", tc: "text-violet-700" },
            { label: "Next Fine-tune", val: "Q4 2026", tc: "text-blue-700" },
          ].map((m) => (
            <div key={m.label} className="text-center border rounded-sm p-1.5">
              <p className={`text-[9px] font-bold font-mono ${m.tc}`}>{m.val}</p>
              <p className="text-[7px] font-mono text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">+7pp accuracy gain per kuartal sejak 2025 → model terus membaik dengan setiap feedback dari tim dan klien</p>
      </div>

      {/* AI Use Case Expansion Roadmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> AI USE CASE EXPANSION ROADMAP — Use Case AI Baru yang Sedang Dikembangkan untuk Platform MJP 2026–2027
        </p>
        <div className="flex flex-col gap-2">
          {[
            { useCase: "AI Tender Match (otomatis match klien ke tender yang paling pas)", eta: "Q3 2026", readiness: 91, stage: "BETA TESTING", impact: "Tingkatkan win-rate klien 25%+", rc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { useCase: "AI SKK Eligibility Checker (cek syarat sebelum daftar)", eta: "Q4 2026", readiness: 67, stage: "DEVELOPMENT", impact: "Kurangi rejection rate 40%", rc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { useCase: "AI Pain Point Clustering (grouping otomatis dari lapangan)", eta: "Q4 2026", readiness: 78, stage: "TESTING", impact: "10× lebih cepat insights dari lapangan", rc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { useCase: "AI Client Churn Prediction (prediksi klien mau churn 30 hari ke depan)", eta: "Q1 2027", readiness: 34, stage: "RESEARCH", impact: "Kurangi churn 20% via proaktif outreach", rc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { useCase: "AI Contract Review Assistant (review kontrak konstruksi risiko klien)", eta: "Q2 2027", readiness: 12, stage: "CONCEPT", impact: "Produk baru Rp 4jt/thn per klien", rc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
          ].map((r) => (
            <div key={r.useCase} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-bold flex-1 leading-snug">{r.useCase}</p>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className={`text-[8px] font-mono font-bold ${r.rc}`}>{{ "BETA TESTING":"Beta Testing", DEVELOPMENT:"Pengembangan", TESTING:"Testing", RESEARCH:"Riset", CONCEPT:"Konsep", LAUNCHED:"Diluncurkan" }[r.stage] ?? r.stage}</span>
                  <span className="text-[8px] font-mono text-muted-foreground">{r.eta}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${r.readiness >= 80 ? "bg-emerald-500" : r.readiness >= 50 ? "bg-blue-400" : r.readiness >= 25 ? "bg-orange-400" : "bg-slate-300"} rounded-full`} style={{ width: `${r.readiness}%` }} />
                </div>
                <span className={`text-[9px] font-mono font-bold shrink-0 ${r.rc}`}>{r.readiness}%</span>
              </div>
              <p className="text-[9px] text-muted-foreground">💡 {r.impact}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Personalization Engine */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> AI PERSONALIZATION ENGINE — Bagaimana AI MJP Menyesuaikan Rekomendasi Berdasarkan Profil Setiap Klien
        </p>
        <div className="flex flex-col gap-3">
          {[
            {
              persona: "BUJK Startup (0–2 thn, <10 tenaga ahli)",
              signals: ["Butuh SKK cepat", "Budget terbatas", "Pertama kali ikut tender BUMN"],
              recommendations: ["SKK Express paket hemat", "Template checklist tender BUMN gratis", "Intel Briefing trial 1 bulan"],
              conversion: "74% persona ini convert dalam 48 jam setelah rekomendasi dikirim",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200",
            },
            {
              persona: "BUJK Growth (3–10 thn, 10–50 ahli)",
              signals: ["Mulai ekspansi wilayah", "Butuh SMAP", "Tertarik tender >Rp 20M"],
              recommendations: ["SKK J9 prioritas + SMAP Advisory", "Intel Briefing Premium", "Analisis kompetitor 3 provinsi target"],
              conversion: "89% persona ini convert Intel Briefing setelah SMAP selesai",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200",
            },
            {
              persona: "BUJK Mature (>10 thn, >50 ahli)",
              signals: ["Tender korporasi besar", "ISO interest", "BIM exploration"],
              recommendations: ["BIM Readiness Assessment", "Riset Custom market share", "Partnership intel untuk klien end-user mereka"],
              conversion: "61% persona ini menjadi klien multi-produk (LTV tertinggi)",
              tc: "text-violet-700", bc: "bg-violet-50 border-violet-200",
            },
          ].map((r) => (
            <div key={r.persona} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold mb-1 ${r.tc}`}>{r.persona}</p>
              <div className="flex flex-wrap gap-1 mb-1">
                {r.signals.map(s => <span key={s} className="text-[7px] font-mono bg-muted px-1.5 py-0.5 rounded">{s}</span>)}
              </div>
              <p className="text-[8px] font-medium mb-0.5">AI Recommendations:</p>
              <div className="flex flex-wrap gap-1 mb-1">
                {r.recommendations.map(rec => <span key={rec} className={`text-[7px] font-mono px-1.5 py-0.5 rounded border ${r.bc} font-bold`}>{rec}</span>)}
              </div>
              <p className={`text-[9px] font-mono ${r.tc}`}>📊 {r.conversion}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Personalization engine menggunakan 12 signal per klien untuk menentukan rekomendasi terbaik · Diperbarui setiap interaksi baru</p>
      </div>

      {/* AI Decision Audit Log */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-primary" /> AI DECISION AUDIT LOG — Rekam Jejak Keputusan AI yang Paling Berdampak pada Bisnis MJP (30 Hari Terakhir)
        </p>
        <div className="flex flex-col gap-2">
          {[
            { decision: "AI merekomendasikan fokus Papua vs Sulawesi untuk ekspansi Q3", outcome: "Dipilih Papua → 4 klien baru closed Rp 34jt dalam 30 hari", verdict: "TEPAT", confidence: 87, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { decision: "AI memprediksi CV Maju Sejahtera akan churn dalam 30 hari", outcome: "Tim proaktif kontak → klien diretain dengan diskon 15%", verdict: "TEPAT", confidence: 73, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { decision: "AI sarankan turunkan harga SKK J8 untuk match kompetitor", outcome: "Tim menolak rekomendasi ini — pilih value-add strategy → berhasil", verdict: "AI SALAH", confidence: 61, tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { decision: "AI flag tender Papua Barat sebagai high-opportunity untuk klien BUJK Gedung", outcome: "3 klien submit, 1 menang tender Rp 18M", verdict: "TEPAT", confidence: 84, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { decision: "AI prediksi regulasi SMAP akan diperluas ke swasta Q4 2026", outcome: "Masih pending — MJP sudah menyiapkan kapasitas lebih awal", verdict: "BELUM TERBUKTI", confidence: 58, tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.decision} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start gap-2 mb-1">
                <p className="text-[9px] flex-1 leading-snug">🤖 {r.decision}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ${r.tc}`}>{r.verdict}</span>
              </div>
              <p className="text-[9px] text-muted-foreground mb-0.5">→ {r.outcome}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>AI confidence saat keputusan: {r.confidence}%</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">4/5 keputusan AI tepat (80% accuracy) · 1 keputusan AI salah → lesson: harga bukan selalu solusi, value-add lebih powerful</p>
      </div>

      {/* AI Recommendation Delivery Channel Optimization */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MessageCircle className="h-3.5 w-3.5 text-primary" /> RECOMMENDATION DELIVERY OPTIMIZATION — Channel Terbaik untuk Menyampaikan Rekomendasi AI ke Setiap Segmen Klien
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {[
            { channel: "WhatsApp Message (personal, langsung)", openRate: 96, actionRate: 74, bestFor: "Urgent actions: SKK expire, tender deadline dekat", timing: "7:00–9:00 pagi atau 19:00–21:00 malam", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { channel: "Intel Briefing PDF (comprehensive report)", openRate: 78, actionRate: 52, bestFor: "Strategic decisions: analisis market, perencanaan tahunan", timing: "Senin pagi setelah weekend review", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { channel: "Platform Dashboard Notification", openRate: 61, actionRate: 43, bestFor: "Data-driven: grafik trend, benchmark, perbandingan", timing: "Saat klien sedang aktif di platform", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { channel: "Email (formal, detailed)", openRate: 41, actionRate: 28, bestFor: "Regulasi resmi, kontrak, invoice — bukan rekomendasi", timing: "Selasa–Kamis 09:00–11:00", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.channel} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className="text-[9px] font-bold mb-1">{r.channel}</p>
              <div className="flex gap-4 text-[8px] font-mono mb-1">
                <span className="text-muted-foreground">Open: <span className={`font-bold ${r.tc}`}>{r.openRate}%</span></span>
                <span className="text-muted-foreground">Action: <span className={`font-bold ${r.tc}`}>{r.actionRate}%</span></span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Best for: {r.bestFor}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>⏰ {r.timing}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">WhatsApp = channel terbaik untuk action (74%) · Email = terendah (28%). Pastikan rekomendasi urgent selalu via WA, bukan email</p>
      </div>

      {/* AI Capability Expansion Roadmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" /> AI CAPABILITY ROADMAP — Kemampuan AI Baru yang Direncanakan untuk Platform MJP dalam 12 Bulan ke Depan
        </p>
        <div className="flex flex-col gap-2">
          {[
            { cap: "Natural Language Query Engine", desc: "Pengguna bisa tanya 'tender apa di Papua bulan ini dengan HPS >Rp 10M?' dalam bahasa natural", eta: "Q3 2026", readiness: 68, benefit: "Adoption Intel Briefing naik 40% karena tidak perlu filter manual", bc: "bg-violet-50 border-violet-200", tc: "text-violet-700" },
            { cap: "Predictive Tender Scoring", desc: "AI memberi score 1–100 untuk setiap tender: seberapa besar peluang klien menang berdasarkan profil mereka", eta: "Q4 2026", readiness: 41, benefit: "Klien fokus ke tender bernilai tinggi saja — win rate naik 12–18pp diprediksi", bc: "bg-blue-50 border-blue-200", tc: "text-blue-700" },
            { cap: "Automated Competitor Monitoring Alerts", desc: "AI scan semua aktivitas kompetitor (harga, tender, klien baru) dan kirim alert otomatis ke tim", eta: "Q3 2026", readiness: 79, benefit: "Response time ke pergerakan kompetitor turun dari 2 hari → 2 jam", bc: "bg-emerald-50 border-emerald-200", tc: "text-emerald-700" },
            { cap: "Client Risk Score (AI-driven churn prediction)", desc: "AI model prediksi churn 30–60 hari ke depan berbasis 18 behavioral signals per klien", eta: "Q4 2026", readiness: 52, benefit: "Proactive retention campaign → churn rate dari 8% → 4% dalam 6 bulan", bc: "bg-orange-50 border-orange-200", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.cap} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start gap-3 mb-1">
                <div className="flex-1">
                  <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.cap}</p>
                  <p className="text-[9px] text-muted-foreground mb-0.5">{r.desc}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[9px] font-mono font-bold ${r.tc}`}>{r.eta}</p>
                  <p className={`text-[10px] font-black font-mono ${r.tc} leading-none`}>{r.readiness}%</p>
                  <p className="text-[7px] font-mono text-muted-foreground">ready</p>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                <div className={`h-full ${r.readiness >= 70 ? "bg-emerald-400" : r.readiness >= 45 ? "bg-blue-400" : "bg-slate-300"} rounded-full`} style={{ width: `${r.readiness}%` }} />
              </div>
              <p className={`text-[9px] font-mono ${r.tc}`}>💡 Expected benefit: {r.benefit}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI vs Human Intelligence Comparison */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-primary" /> AI vs HUMAN INTELLIGENCE — Kapan MJP Harus Percaya AI dan Kapan Harus Override dengan Human Judgment
        </p>
        <div className="flex flex-col gap-2">
          {[
            { dimension: "Pattern Recognition (data besar, banyak variabel)", ai: 97, human: 42, winner: "AI", recommendation: "Serahkan ke AI: tender analysis, SKK expiry prediction, churn scoring", wc: "text-violet-700" },
            { dimension: "Relationship Context (nuance komunikasi klien)", ai: 38, human: 94, winner: "HUMAN", recommendation: "AM harus putuskan sendiri: cara approach klien at-risk, negosiasi harga, retention WA", wc: "text-emerald-700" },
            { dimension: "Regulatory Interpretation (hukum ambigu)", ai: 61, human: 88, winner: "HUMAN", recommendation: "Selalu review dengan firma hukum atau internal expert — AI bisa salah interpretasi", wc: "text-emerald-700" },
            { dimension: "Competitor Strategy (multi-step game theory)", ai: 74, human: 79, winner: "KOLABORASI", recommendation: "AI beri data + probabilitas, human putuskan strategi. Jangan pure AI atau pure human.", wc: "text-blue-700" },
            { dimension: "Crisis Communication (keluhan klien, reputasi)", ai: 24, human: 97, winner: "HUMAN ONLY", recommendation: "Jangan pernah balas keluhan klien dengan AI-generated response tanpa review — risiko brand", wc: "text-red-700" },
          ].map((r) => (
            <div key={r.dimension} className="border rounded-sm p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-bold flex-1">{r.dimension}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ml-2 ${r.winner === "AI" ? "text-violet-700" : r.winner === "HUMAN" ? "text-emerald-700" : r.winner === "HUMAN ONLY" ? "text-red-700" : "text-blue-700"}`}>{r.winner}</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[7px] font-mono w-10 text-violet-600">AI {r.ai}%</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-violet-400 rounded-full" style={{ width: `${r.ai}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[7px] font-mono w-10 text-emerald-700">Human {r.human}%</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${r.human}%` }} />
                    </div>
                  </div>
                </div>
              </div>
              <p className={`text-[9px] font-mono ${r.wc}`}>→ {r.recommendation}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Model Performance & Continuous Learning */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> AI MODEL PERFORMANCE & LEARNING — Seberapa Cepat Model AI MJP Belajar dan Meningkat dari Feedback Pengguna
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {[
            { model: "Churn Prediction Model (v4.2)", accuracy: 84, improvement: "+6pp vs v3.0", trainingData: "12.847 interaction records", lastRetrained: "28 Jul 2026", note: "v5.0 akan menyertakan behavioral signals baru (PDF scroll depth, response time) — ETA 15 Agt", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { model: "Tender Relevance Scoring (v2.8)", accuracy: 89, improvement: "+12pp vs v1.0", trainingData: "47.238 tender + outcome pairs", lastRetrained: "21 Jul 2026", note: "Model terkuat — perlu expansion ke Papua-specific features agar Papua accuracy naik ke 95%", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { model: "SKK Renewal Prediction (v3.1)", accuracy: 91, improvement: "+4pp vs v3.0", trainingData: "3.841 renewal histories", lastRetrained: "14 Jul 2026", note: "Terbaik dari semua model — sudah production-ready untuk email + WA automation trigger", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { model: "Intel Briefing Personalization (v1.4 - BETA)", accuracy: 71, improvement: "baseline — still training", trainingData: "2.147 feedback points", lastRetrained: "1 Agt 2026", note: "Belum production-ready — masih beta. Target 80% accuracy sebelum launch ke semua klien", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.model} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-[9px] font-bold ${r.tc}`}>{r.model}</p>
                <div className="text-right shrink-0 ml-2">
                  <p className={`text-[14px] font-black font-mono ${r.tc} leading-none`}>{r.accuracy}%</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>{r.improvement}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground mb-1">
                <span>Data: {r.trainingData}</span>
                <span>Last train: {r.lastRetrained}</span>
              </div>
              <p className="text-[9px] text-muted-foreground leading-snug">{r.note}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Feedback loop: setiap aksi klien (open, click, implement, ignore) menjadi training signal → model semakin akurat seiring platform berkembang</p>
      </div>

      {/* AI Ethics & Responsible AI Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> RESPONSIBLE AI FRAMEWORK — Prinsip dan Guardrail yang MJP Terapkan agar Rekomendasi AI Tidak Menyesatkan Klien
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {[
            { principle: "Transparency First", desc: "Setiap rekomendasi AI menampilkan confidence score + sumber data + kapan data diambil. Klien tidak pernah mendapat rekomendasi 'black box'.", status: "IMPLEMENTED", check: ["Confidence score ditampilkan di semua rec", "Sumber data dikutip", "Date freshness visible"], tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { principle: "Human Override Always", desc: "AI hanya merekomendasikan — tidak pernah mengeksekusi secara otomatis. Semua keputusan bisnis final ada di tangan klien.", status: "IMPLEMENTED", check: ["Tidak ada auto-action tanpa konfirmasi", "Semua alert memerlukan human review", "Eskalasi selalu ke AM manusia"], tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { principle: "Bias Monitoring", desc: "Model diperiksa secara berkala untuk bias regional (misal: model lebih akurat untuk Jawa vs luar Jawa). Bias dilaporkan transparansi.", status: "PARTIAL", check: ["Monthly bias audit dijadwalkan", "Papua accuracy masih lebih rendah 14pp", "Fairness metrics belum di-expose ke klien"], tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { principle: "Data Minimization", desc: "MJP hanya menggunakan data yang benar-benar diperlukan untuk membuat rekomendasi. Tidak ada data mining beyond stated purpose.", status: "IN PROGRESS", check: ["Data retention policy 24 bulan max", "PII tidak masuk ke model inference", "Audit log data access belum live"], tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.principle} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-[9px] font-bold ${r.tc}`}>{r.principle}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.status}</span>
              </div>
              <p className="text-[9px] text-muted-foreground mb-1 leading-snug">{r.desc}</p>
              {r.check.map((c, i) => (
                <p key={i} className={`text-[8px] font-mono ${r.status === "IMPLEMENTED" ? "text-emerald-700" : r.status === "PARTIAL" ? (i < 1 ? "text-emerald-700" : "text-orange-700") : "text-blue-700"}`}>
                  {r.status === "IMPLEMENTED" ? "✓" : i < 1 ? "✓" : "○"} {c}
                </p>
              ))}
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Responsible AI bukan sekadar etika — ini adalah diferensiasi kompetitif: klien trust MJP lebih karena AI-nya transparan dan humane</p>
      </div>

      {/* AI Roadmap 12 Months */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> AI PRODUCT ROADMAP — Kapabilitas AI Baru yang Akan MJP Tambahkan dalam 12 Bulan ke Depan (Prioritized)
        </p>
        <div className="flex flex-col gap-2">
          {[
            { feature: "Personalized Tender Alert (klien-specific relevance model)", quarter: "Q3 2026", priority: "P0", status: "IN DEVELOPMENT", desc: "Setiap klien dapat alert yang dipersonalisasi berdasarkan SKK, wilayah, track record, dan budget range mereka. Tidak ada lagi 'generic' tender blast.", impact: "Expected: open rate naik dari 70% → 87%, CTR naik dari 61% → 74%", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { feature: "Automated SKK Renewal Reminder dengan Slack/WA deep integration", quarter: "Q3 2026", priority: "P0", status: "DESIGN PHASE", desc: "Bukan hanya remind — sistem langsung share link renewal form yang sudah pre-filled dengan data klien. One-click renewal journey.", impact: "Expected: renewal rate naik dari 82% → 94%. Revenue impact: +Rp 48jt/thn", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { feature: "AI Bid Price Advisor (berikan rekomendasi range harga optimal)", quarter: "Q4 2026", priority: "P1", status: "RESEARCH", desc: "Berdasarkan HPS + historical win rates + kompetitor pricing → AI rekomendasikan range harga bid yang maximize probability menang sambil menjaga margin.", impact: "Expected: avg win rate klien naik +14pp → ROI sangat tinggi", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { feature: "BIM Compliance Checker (AI audit readiness sebelum regulasi berlaku)", quarter: "Q4 2026", priority: "P1", status: "SCOPING", desc: "Upload dokumen perusahaan → AI cek seberapa ready BUJK untuk adopsi BIM wajib → rekomendasi gap yang perlu diisi.", impact: "Bundled dengan BIM Readiness product — differentiator utama vs kompetitor", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { feature: "AI Meeting Summarizer untuk Workroom sessions", quarter: "Q1 2027", priority: "P2", status: "BACKLOG", desc: "Rekam sesi Workroom → AI generate keputusan, action items, dan follow-up. Otomatis masuk ke Decision Registry.", impact: "Tim efficiency: estimasi hemat 2 jam/minggu per AM untuk documentation", tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
          ].map((r) => (
            <div key={r.feature} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start gap-3 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.feature}</p>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <span className={`text-[7px] font-mono font-bold ${r.tc}`}>{r.priority}</span>
                  <span className={`text-[7px] font-mono font-bold ${r.tc}`}>{r.quarter}</span>
                </div>
              </div>
              <p className={`text-[7px] font-mono font-bold mb-0.5 ${r.tc}`}>{r.status}</p>
              <p className="text-[9px] text-muted-foreground mb-0.5 leading-snug">{r.desc}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>📊 {r.impact}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Recommendation Personalization Engine */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> PERSONALIZATION ENGINE — Bagaimana AI MJP Memastikan Setiap Klien Mendapat Rekomendasi yang Berbeda Sesuai Profil Mereka?
        </p>
        <div className="flex flex-col gap-2">
          <p className="text-[9px] text-muted-foreground mb-1">Dimensi yang digunakan AI untuk mempersonalisasi rekomendasi (14 dimensi, update real-time):</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            {[
              { dim: "SKK Jenjang & Bidang Spesialisasi", weight: 94, desc: "SKK J8 Sipil vs J8 Mekanikal → intel tender yang berbeda sama sekali" },
              { dim: "Lokasi & Wilayah Operasi", weight: 91, desc: "Klien Sulawesi tidak butuh info tender DKI Jakarta kecuali explicitly minta" },
              { dim: "HPS Range Preference", weight: 87, desc: "Klien yang biasa bid Rp 1–5M tidak perlu tahu tender Rp 500M+" },
              { dim: "Win/Loss History (bid pattern)", weight: 84, desc: "Klien yang sering lose di harga = kirim HPS benchmark lebih sering" },
              { dim: "Kompetitor yang Paling Sering Dihadapi", weight: 78, desc: "Klien yang sering lawan Konsultan A = fokuskan Radar Kompetitor ke Konsultan A" },
              { dim: "Regulasi yang Sedang Diproses", weight: 71, desc: "Klien yang sedang perpanjang SKK = hanya kirim regulasi terkait SKK" },
            ].map((d) => (
              <div key={d.dim} className="border rounded-sm p-2">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[9px] font-bold flex-1">{d.dim}</p>
                  <span className="text-[8px] font-mono font-bold text-primary shrink-0">w={d.weight}</span>
                </div>
                <p className="text-[8px] text-muted-foreground">{d.desc}</p>
              </div>
            ))}
          </div>
          <div className="border rounded-sm p-3 bg-muted/20">
            <p className="text-[9px] font-bold mb-1">Contoh output personalisasi (klien CV Sukses Mandiri vs PT Nusantara Build):</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <p className="text-[8px] font-bold text-blue-700 mb-0.5">CV Sukses Mandiri (J8 Sipil, Semarang):</p>
                <p className="text-[8px] text-muted-foreground">• 5 tender LPSE Jawa Tengah kategori sipil Rp 2–8M</p>
                <p className="text-[8px] text-muted-foreground">• SKK expire alert (7 hari lagi)</p>
                <p className="text-[8px] text-muted-foreground">• Konsultan B menang 3 tender serupa bulan ini</p>
              </div>
              <div>
                <p className="text-[8px] font-bold text-violet-700 mb-0.5">PT Nusantara Build (J9, Jakarta):</p>
                <p className="text-[8px] text-muted-foreground">• 3 tender BUMN nasional kategori gedung Rp 25–80M</p>
                <p className="text-[8px] text-muted-foreground">• BIM Readiness alert (regulasi Q1 2027)</p>
                <p className="text-[8px] text-muted-foreground">• Kompetitor A menang BUMN kemarin dengan harga Rp 47M</p>
              </div>
            </div>
          </div>
          <p className="text-[9px] font-mono text-muted-foreground">Dua klien yang sama sekali berbeda → briefing yang sama sekali berbeda. Inilah mengapa MJP sulit direplace dengan generic newsletter.</p>
        </div>
      </div>

      {/* AI Integration Ecosystem Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Blocks className="h-3.5 w-3.5 text-primary" /> AI INTEGRATION ECOSYSTEM — Bagaimana Semua Komponen AI di Platform MJP Saling Terhubung dan Berinteraksi?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { layer: "Data Ingestion Layer", components: ["LPSE Crawler", "IjinTender API", "LPJK Sync", "Forum Scraper"], outputs: "Raw structured data → 47k+ records/hari", aiRole: "Dedup + schema normalization via lightweight ML", c: "text-slate-600", b: "bg-slate-50 border-slate-200" },
            { layer: "Intelligence Synthesis Layer", components: ["Entity Resolution (NLP)", "Relevance Scoring (LLM)", "Trend Detection (TimeSeries)", "HPS Benchmarking"], outputs: "Processed intel → Knowledge Registry update", aiRole: "LLM: synthesis + tagging; ML: anomaly detection; Rules: business logic", c: "text-blue-700", b: "bg-blue-50 border-blue-200" },
            { layer: "Personalization Layer", components: ["Client Profile Model", "Churn Prediction", "Upsell Scoring", "Briefing Personalization (v1.4 beta)"], outputs: "Per-client intel feed + action recommendations", aiRole: "Collaborative filtering + gradient boosting + LLM reranking", c: "text-violet-700", b: "bg-violet-50 border-violet-200" },
            { layer: "Delivery Layer", components: ["WhatsApp API", "Email (SMTP)", "Mobile Push", "In-app Notification"], outputs: "Intel reaches clients across 4 channels simultaneously", aiRole: "Optimal timing prediction (open rate maximization)", c: "text-emerald-700", b: "bg-emerald-50 border-emerald-200" },
            { layer: "Learning Loop Layer", components: ["Click tracking", "User feedback signals", "AM annotation", "Outcome tracking (win/lose)"], outputs: "Training signals → model retraining pipeline", aiRole: "Continuous learning: every interaction improves all models", c: "text-orange-700", b: "bg-orange-50 border-orange-200" },
          ].map((l) => (
            <div key={l.layer} className={`border rounded-sm p-3 ${l.b}`}>
              <div className="flex items-start gap-3 mb-1">
                <div className="flex-1">
                  <p className={`text-[9px] font-bold ${l.c} mb-0.5`}>{l.layer}</p>
                  <div className="flex flex-wrap gap-1 mb-0.5">
                    {l.components.map(comp => (
                      <span key={comp} className={`text-[7px] font-mono px-1.5 py-0.5 rounded-sm border ${l.b} ${l.c}`}>{comp}</span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Output: {l.outputs}</p>
              <p className={`text-[8px] font-mono ${l.c}`}>AI role: {l.aiRole}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Platform MJP = 5 AI layers yang berjalan paralel dan saling memperkuat — inilah defensible moat yang sulit direplikasi kompetitor dalam {'<'}2 tahun</p>
      </div>

      {/* AI Ethics Charter */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> AI ETHICS CHARTER — Prinsip yang Mengatur Penggunaan AI di MJP agar Tidak Membahayakan Klien atau Membuat Keputusan Tidak Adil
        </p>
        <div className="flex flex-col gap-2">
          {[
            { principle: "1. Transparansi: Klien Selalu Tahu Kapan AI yang Berbicara", desc: "Setiap rekomendasi dari AI harus diberi label 'AI-generated' atau 'AI-assisted'. Tidak ada output AI yang disajikan seolah-olah berasal dari analisis manusia tanpa disclosure.", status: "IMPLEMENTED", evidence: "Label 'AI' muncul di semua recommendation cards. AM selalu verify sebelum forward ke klien.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { principle: "2. Human Override: Manusia Selalu Bisa Koreksi AI", desc: "AM punya tombol 'override' untuk semua rekomendasi AI. Platform tidak boleh pernah kirim intel ke klien tanpa ada human approval path untuk sinyal yang dampaknya tinggi.", status: "IMPLEMENTED", evidence: "Setiap briefing punya 'Flag as incorrect' button. AM spot-check 10% secara random.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { principle: "3. Fairness: Klien Kecil Dapat Kualitas Intel yang Sama dengan Klien Besar", desc: "Model personalisasi tidak boleh mendiskriminasi BUJK kecil hanya karena mereka bayar lebih sedikit. Kualitas insight harus proporsional, bukan binary privileged/unprivileged.", status: "IN REVIEW", evidence: "Audit Q3 2026 in progress: perbandingan intel quality Basic vs Premium. Hasil Aug 2026.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { principle: "4. Explainability: MJP Harus Bisa Jelaskan Kenapa AI Rekomendasikan Sesuatu", desc: "Setiap rekomendasi AI harus punya reasoning chain yang bisa dibaca manusia. 'AI bilang begitu' bukan jawaban yang acceptable.", status: "PARTIAL", evidence: "Intel Briefing sudah ada 'Kenapa ini relevan untukmu?' — Radar dan SKK Alert belum. Q4 fix.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { principle: "5. Data Minimization: Hanya Kumpulkan Data yang Benar-Benar Dibutuhkan", desc: "MJP tidak menyimpan data pribadi klien melebihi yang diperlukan untuk layanan. Tidak ada jual data ke pihak ketiga tanpa consent eksplisit.", status: "IMPLEMENTED", evidence: "Privacy policy v2.1. GDPR-lite compliance. Data retention: 3 tahun max.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.principle} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.principle}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.status}</span>
              </div>
              <p className="text-[9px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Evidence: {r.evidence}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">4/5 prinsip implemented, 1 partial — Explainability adalah frontier berikutnya untuk maintain klien trust jangka panjang</p>
      </div>

      {/* AI Investment ROI */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> AI INVESTMENT ROI — Berapa yang MJP Investasikan ke AI dan Berapa Return yang Didapatkan dari Setiap Rupiah yang Dibelanjakan?
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {[
            { category: "LLM Inference (synthesis + personalization)", monthly: "Rp 4.8jt", annualized: "Rp 57.6jt", revenueAttrib: "Rp 847jt", roi: "14.7×", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { category: "ML Model Training (churn + win rate)", monthly: "Rp 1.2jt", annualized: "Rp 14.4jt", revenueAttrib: "Rp 124jt (reduced churn)", roi: "8.6×", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { category: "Vector DB + Embedding (semantic search)", monthly: "Rp 800rb", annualized: "Rp 9.6jt", revenueAttrib: "Rp 48jt (faster research time)", roi: "5.0×", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { category: "Anomaly Detection (freshness monitoring)", monthly: "Rp 400rb", annualized: "Rp 4.8jt", revenueAttrib: "Rp 32jt (prevented data quality issues)", roi: "6.7×", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.category} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-1`}>{r.category}</p>
              <div className="flex flex-wrap gap-2 text-[8px] font-mono">
                <span className="text-muted-foreground">Cost: {r.monthly}/bln</span>
                <span className={`font-bold ${r.tc}`}>ROI: {r.roi}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-[8px] font-mono text-muted-foreground">
                <span>Annual: {r.annualized}</span>
                <span className={`${r.tc}`}>Attrib: {r.revenueAttrib}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="border rounded-sm p-3 bg-muted/20">
          <p className="text-[9px] font-bold mb-1">Total AI Investment vs Return:</p>
          <div className="flex flex-wrap gap-4 text-[8px] font-mono">
            <span className="text-muted-foreground">Total AI cost: Rp 7.2jt/bln (Rp 86.4jt/thn)</span>
            <span className="text-emerald-700 font-bold">Total attrib revenue: Rp 1.05M/thn</span>
            <span className="text-emerald-700 font-black text-[10px]">Blended ROI: 12.2×</span>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">Setiap Rp 1 yang diinvestasikan ke AI menghasilkan Rp 12.2 revenue. Benchmark SaaS yang baik: 5–8×. MJP sudah outperform.</p>
      </div>

      {/* AI Roadmap 2027 */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Blocks className="h-3.5 w-3.5 text-violet-500" /> AI CAPABILITY ROADMAP — Kemampuan AI Apa yang Akan MJP Bangun 12–24 Bulan ke Depan untuk Tetap Ahead dari Kompetitor?
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              capability: "Multi-modal Intelligence (Gambar + Dokumen + Audio)",
              horizon: "Q4 2026",
              description: "Klien bisa upload foto tender site, dokumen RAB, atau rekaman rapat — AI langsung extract intel yang relevan dan masukkan ke Workroom dengan auto-tagging.",
              techRequired: "Vision model (GPT-4o / Claude 3.5 Sonnet) + audio transcription + structured extraction",
              moatImpact: "HIGH — no competitor has this for konstruksi context. Photo-to-intel adalah killer feature di lapangan.",
              tc: "text-violet-700", bc: "bg-violet-50 border-violet-200"
            },
            {
              capability: "Predictive Tender Discovery (pre-LPSE signal)",
              horizon: "Q1 2027",
              description: "Prediksi tender yang BELUM muncul di LPSE berdasarkan sinyal dari SIMBG, OSS, APBN pipeline, dan rencana BUMN. Alert klien 30–60 hari sebelum tender resmi.",
              techRequired: "Multi-source correlation model + time-series forecasting + signal confidence scoring",
              moatImpact: "EXTREME — ini adalah unfair advantage terbesar yang bisa MJP bangun. First to market = 2-3 tahun lead.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              capability: "Autonomous Agent: Surat Penawaran Drafter",
              horizon: "Q2 2027",
              description: "Klien input: 'Saya mau bid tender ini.' AI langsung draft surat penawaran lengkap dengan HPS yang optimal, competitive strategy, dan technical narrative berdasarkan track record klien.",
              techRequired: "RAG dari knowledge base klien + fine-tuned formatting model + HPS optimization agent",
              moatImpact: "HIGH — dari intel-to-action dalam satu workflow. Klien tidak perlu expertise dokumen.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
          ].map((r) => (
            <div key={r.capability} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.capability}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.horizon}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.description}</p>
              <p className={`text-[8px] font-mono ${r.tc} mb-0.5`}>Tech: {r.techRequired}</p>
              <p className={`text-[9px] font-bold ${r.tc}`}>Moat impact: {r.moatImpact}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">Dari Intel Delivery hari ini → Predictive Discovery besok → Autonomous Action 2027. MJP akan jadi co-pilot bisnis BUJK, bukan sekadar info provider.</p>
      </div>

      {/* AI Accuracy Tracking */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> AI ACCURACY TRACKING — Seberapa Akurat Model AI MJP dan Bagaimana Kita Tahu Ketika Model Perlu Di-retrain?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { model: "Tender Relevance Scorer (Layer 5 filter)", metric: "76% 'very relevant' rating", target: "85%", gap: "9pp gap", method: "Klien rate setiap tender alert dengan thumbs up/down. 12.400 ratings terkumpul YTD.", retrain: "Retrain monthly dengan last 90 days data. Accuracy trending up +2pp/bulan.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { model: "Win Probability Predictor", metric: "Correlation r=0.67 dengan actual win rate", target: "r=0.80", gap: "r=0.13 gap", method: "Bandingkan win probability yang diprediksi vs actual outcome dari 3.200 historical bids.", retrain: "Retrain quarterly. Degradasi signifikan jika r turun <0.60 mid-quarter → emergency retrain.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { model: "Churn Prediction Model", metric: "Precision 81%, Recall 69%", target: "Prec 85%, Recall 75%", gap: "4pp precision, 6pp recall", method: "Bandingkan churn prediction 30 hari sebelumnya dengan actual churn events.", retrain: "Retrain bi-weekly. Recall lebih penting: miss churn = revenue loss. Trade-off: false alarm biaya AM time.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { model: "HPS Estimator (ML regression)", metric: "Avg error <6.2% vs actual HPS", target: "<4%", gap: "2.2pp gap", method: "Bandingkan HPS estimate vs actual HPS yang keluar di pengumuman LPSE post-award.", retrain: "Retrain setiap ada perubahan regulasi harga material signifikan (> 5% price shift).", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.model} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-3 mb-0.5">
                <div className="flex-1">
                  <p className={`text-[9px] font-bold ${r.tc}`}>{r.model}</p>
                  <div className="flex flex-wrap gap-3 text-[8px] font-mono mt-0.5">
                    <span className={`font-bold ${r.tc}`}>{r.metric}</span>
                    <span className="text-muted-foreground">Target: {r.target}</span>
                    <span className={r.tc}>Gap: {r.gap}</span>
                  </div>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Method: {r.method}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Retrain: {r.retrain}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Model accuracy dashboard diupdate weekly oleh Tim Tech. Setiap model punya SLO — jika di bawah threshold 2 minggu berturut-turut, immediate escalation ke Hendra.</p>
      </div>

      {/* AI Feature Adoption Funnel */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" /> AI FEATURE ADOPTION — Berapa % Klien yang Menggunakan Setiap Fitur AI MJP dan Di Mana Mereka Drop Off?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { feature: "Intel Briefing (AI-curated daily newsletter)", adoption: 100, pct: "100%", behavior: "Semua klien aktif receive. 89% open rate. Baseline product yang semua klien kenal.", color: "bg-emerald-500", tc: "text-emerald-700" },
            { feature: "Tender Relevance ListFilter (AI layer 5)", adoption: 100, pct: "100%", behavior: "Semua klien benefit meski tidak tahu bahwa ini AI — transparansi = informed trust.", color: "bg-emerald-500", tc: "text-emerald-700" },
            { feature: "Win Probability Indicator", adoption: 183, pct: "38%", behavior: "Hanya klien yang buka halaman Tender + scroll ke detail. Need more prominent placement.", color: "bg-blue-400", tc: "text-blue-700" },
            { feature: "HPS Estimator AI", adoption: 247, pct: "51%", behavior: "Dipakai saat preparation sebelum bid. Paling populer di klien Growth tier.", color: "bg-blue-500", tc: "text-blue-700" },
            { feature: "Competitor AI Analysis (battlecard generation)", adoption: 97, pct: "20%", behavior: "Feature hidden di dalam Radar Kompetitor — tidak cukup discoverable. Need surfacing.", color: "bg-orange-400", tc: "text-orange-700" },
            { feature: "Surat Penawaran AI Assist", adoption: 97, pct: "20%", behavior: "Adoption stuck di 20% meski satisfaction tinggi. Onboarding problem, not product problem.", color: "bg-orange-400", tc: "text-orange-700" },
            { feature: "Knowledge Synthesis (auto-summary regulasi)", adoption: 54, pct: "11%", behavior: "Feature baru (Mar 2026). Growing organically. Target 30% by Q4.", color: "bg-violet-400", tc: "text-violet-700" },
          ].map((r) => (
            <div key={r.feature} className="flex items-center gap-2">
              <p className="text-[8px] font-mono text-muted-foreground shrink-0 w-6">{r.pct}</p>
              <div className="flex-1">
                <div className="h-4 rounded-sm overflow-hidden bg-muted/30 mb-0.5">
                  <div className={`h-full ${r.color} rounded-sm`} style={{ width: r.pct }} />
                </div>
                <p className="text-[8px] font-bold">{r.feature}</p>
                <p className={`text-[7px] font-mono ${r.tc}`}>{r.behavior}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Avg AI feature adoption: 48.6%. Gap: features yang dipakai baseline semua tapi advanced AI features masih {'<'}40%. Fix: in-app AI feature spotlight + AM demo untuk klien premium.</p>
      </div>

      {/* AI vs Human Work Division */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> AI vs HUMAN — Pembagian Kerja yang Tepat antara AI dan Tim Manusia di MJP: Apa yang Harus AI Lakukan vs Apa yang Harus Manusia Lakukan?
        </p>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="border rounded-sm p-3 bg-blue-50 border-blue-200">
              <p className="text-[9px] font-bold text-blue-700 mb-1">AI HARUS HANDLE (Scale + Consistency):</p>
              {["Crawl dan parse semua 14 sumber data (4.200 records/hari)", "Score relevance setiap tender vs 487 profil klien (1.66M operations/hari)", "Generate draft Intel Briefing narrative dari structured data", "Alert trigger ketika kondisi terpenuhi (SKK expire, tender match, kompetitor win)", "Cluster dan categorize notes di Workroom dengan auto-tagging", "HPS estimation dari historical data (38.400+ data points)"].map(i => <p key={i} className="text-[8px] text-muted-foreground">✓ {i}</p>)}
            </div>
            <div className="border rounded-sm p-3 bg-emerald-50 border-emerald-200">
              <p className="text-[9px] font-bold text-emerald-700 mb-1">MANUSIA HARUS HANDLE (Judgment + Relationship):</p>
              {["Validasi intelligence sebelum dikirim ke klien (Gate 3 AM check)", "Interpretasi regulasi yang ambiguous atau baru (Sari's expertise)", "Relationship management dan kepercayaan klien (tidak bisa di-automate)", "Keputusan strategic: product, pricing, hiring, partnerships", "Handle situasi krisis atau outlier yang AI belum pernah lihat", "Workshop dan deep-dive problem dengan klien secara langsung"].map(i => <p key={i} className="text-[8px] text-muted-foreground">✓ {i}</p>)}
            </div>
          </div>
          <div className="border rounded-sm p-3 bg-orange-50 border-orange-200">
            <p className="text-[9px] font-bold text-orange-700 mb-1">GREY AREA (AI assists, human decides):</p>
            {[
              "Win probability prediction: AI gives number, AM decides whether to brief client with it",
              "Competitor intelligence narrative: AI drafts, Sari/Reza verify accuracy before sending",
              "Custom research: AI collects and structures, researcher interprets and adds context",
              "Churn risk flag: AI flags client as at-risk, AM decides how and when to intervene",
            ].map(i => <p key={i} className="text-[8px] text-muted-foreground">• {i}</p>)}
          </div>
          <p className="text-[9px] font-mono text-muted-foreground">Rule of thumb: AI handles {'>'} 80% of volume-based tasks. Humans handle 100% of relationship and judgment tasks. Grey area = {"~"}15% of total work — this is where MJP competitive advantage is built.</p>
        </div>
      </div>

      {/* AI Governance & Responsible Use Policy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> AI GOVERNANCE POLICY — Aturan Resmi MJP tentang Penggunaan AI yang Bertanggung Jawab terhadap Klien dan Masyarakat
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              principle: "Prinsip 1: Transparansi — Klien Selalu Tahu Kapan AI Terlibat",
              policy: "Setiap output yang dihasilkan AI diberi label 'AI-generated' atau 'AI-assisted'. Tidak ada penyamaran AI sebagai manusia dalam komunikasi klien.",
              enforcement: "AM tidak boleh kirim AI-generated content tanpa review dan labeling. Violation: eskalasi ke Hendra.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              principle: "Prinsip 2: Human-in-the-Loop untuk Keputusan Signifikan",
              policy: "AI tidak pernah autonomously decide: harga, SKK rejection, klien categorization, atau rekomendasi investasi besar. Human always has final say.",
              enforcement: "Setiap AI recommendation dengan impact > Rp 5jt harus divalidasi manusia sebelum dikomunikasikan.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              principle: "Prinsip 3: Fairness — Tidak Ada Bias Sistematis terhadap BUJK Kecil",
              policy: "Model AI diaudit quarterly untuk bias. Pastikan win probability model tidak sistematis merendahkan chance BUJK kecil (J7) vs J9.",
              enforcement: "Quarterly bias audit oleh Hendra + external review jika ada complaint. Results dipublish ke tim internal.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              principle: "Prinsip 4: Data Minimization — AI Hanya Pakai Data yang Diperlukan",
              policy: "Model tidak boleh menggunakan data klien untuk train model tanpa explicit consent. Each model trained on anonymized aggregate data only.",
              enforcement: "Setiap model baru harus melalui privacy review sebelum deployment. Documentation di Notion.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              principle: "Prinsip 5: Accountability — Jika AI Salah, MJP Bertanggung Jawab",
              policy: "Jika AI recommendation menyebabkan kerugian material bagi klien (dibuktikan), MJP akan investigate dan jika terbukti error: kompensasi atau service credit.",
              enforcement: "Incident log untuk setiap 'AI-caused harm' report. Review committee: Hendra + Reza + Sari.",
              tc: "text-violet-700", bc: "bg-violet-50 border-violet-200"
            },
          ].map((r) => (
            <div key={r.principle} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.principle}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.policy}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Enforcement: {r.enforcement}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">AI governance policy di-publish di Terms of Service MJP dan dijelaskan saat onboarding. Kepercayaan klien adalah asset — tidak boleh dikompromikan oleh AI yang tidak terkontrol.</p>
      </div>

      {/* AI Training Data Strategy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-primary" /> AI TRAINING DATA STRATEGY — Dari Mana Data Training MJP Berasal dan Mengapa Data Ini Adalah Competitive Moat yang Sulit Di-copy?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              dataSource: "38.400+ historical tender + outcome data (Q1 2022 – Q2 2026)",
              volume: "38.400 records",
              uniqueness: "Kompetitor tidak punya outcome data (siapa yang menang dan dengan harga berapa). MJP built this from day 1 by scraping post-award public data.",
              usedFor: "Win probability model + HPS benchmark model",
              replaceability: "Very difficult. 4 tahun collection effort. New entrant butuh 2–4 tahun untuk build equivalent.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              dataSource: "1.847 structured pain points dari lapangan (2021–2026)",
              volume: "1.847 pain records + 234 photo evidence",
              uniqueness: "Pain points dikumpulkan dari BUJK J7–J9 di 12 provinsi dengan geographic + jenjang breakdown. Tidak ada dataset ini yang dipublish atau tersedia komersial.",
              usedFor: "Sentiment analysis + need prediction model + product roadmap prioritization",
              replaceability: "Extremely difficult. Butuh physical field research network dan 5+ tahun collection.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              dataSource: "487 klien × 18 bulan avg × behavior data (clicks, bids, wins)",
              volume: "~3.9M behavioral events",
              uniqueness: "Client behavior dalam konteks konstruksi intel consumption — kapan mereka buka briefing, apa yang di-klik, berapa lama setelah alert mereka act.",
              usedFor: "Relevance scoring model + alert timing optimization + churn prediction",
              replaceability: "Cannot be replicated. Privacy-protected, consent-based, proprietary.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
          ].map((r) => (
            <div key={r.dataSource} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-1">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.dataSource}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.volume}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Why unique: {r.uniqueness}</p>
              <div className="flex flex-wrap gap-2 text-[8px] font-mono">
                <span className={r.tc}>Used for: {r.usedFor}</span>
                <span className="text-muted-foreground">Replaceability: {r.replaceability}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Data moat adalah real competitive advantage — tidak semua moat terlihat. MJP's moat adalah invisible ke kompetitor sampai mereka mencoba rebuild dan menyadari betapa susahnya.</p>
      </div>

      {/* AI Model Explainability */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-violet-500" /> MODEL EXPLAINABILITY — Bagaimana MJP Menjelaskan Kepada Klien Mengapa AI Merekomendasikan Sesuatu? Transparansi sebagai Trust Builder
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              model: "Win Probability Indicator",
              what: "Score 0–100 yang menunjukkan peluang klien menang tender tertentu",
              explainability: "Setiap score dilengkapi dengan 3 top reasons: '+: track record match (J8 gedung, 3 proyek serupa)' | '+: kompetisi rendah (avg 4.2 peserta di kategori ini)' | '−: tidak ada pengalaman di wilayah ini'",
              why_it_matters: "Klien tidak hanya tau angkanya — mereka tahu kenapa. Mereka bisa ACTION: fix the minus factors before bidding.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              model: "Tender Relevance ListFilter",
              what: "Algorithm yang decide tender mana yang masuk briefing klien",
              explainability: "Jika klien bertanya 'kenapa tender X tidak masuk briefing saya?': kita bisa show: kategori match (4/5) + wilayah match (5/5) + nilai match (3/5) + jenjang match (5/5) = total 17/20, threshold adalah 18/20. Di bawah threshold.",
              why_it_matters: "Transparansi ini memungkinkan klien calibrate profil mereka. 'Oh saya mau turunkan threshold' atau 'Saya mau include kategori lain'.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              model: "HPS Estimator",
              what: "Prediksi range HPS untuk tender yang belum diumumkan angkanya",
              explainability: "Model shows: 'Based on 47 similar tenders (same category + region + size) in 2024–2026. Range: Rp 14.2M–Rp 17.8M. Median: Rp 15.9M. Your recommended bid: Rp 15.1M (−4.8% from median).'",
              why_it_matters: "Klien tahu basis dari estimasi — 47 data points. Jika mereka tau ada faktor khusus yang model tidak ketahui, mereka bisa override dengan judgment.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
          ].map((r) => (
            <div key={r.model} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.model}</p>
              <p className="text-[8px] font-bold mb-0.5">What it does: {r.what}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">How it explains itself: {r.explainability}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>Why it matters: {r.why_it_matters}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Explainability principle: AI yang tidak bisa menjelaskan dirinya adalah AI yang tidak bisa dipercaya. MJP builds trust by showing the work, not just the answer.</p>
      </div>

      {/* AI Failure Modes & Safeguards */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-orange-500" /> AI FAILURE MODES — Cara AI MJP Bisa Gagal dan Safeguard yang Dipasang untuk Mencegah Dampak ke Klien
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              failure: "Hallucination: AI menghasilkan HPS estimate yang sangat tidak akurat karena insufficient data",
              likelihood: "MEDIUM (terjadi untuk kategori langka atau region yang data-sparse)",
              safeguard: "Minimum data threshold: estimasi hanya ditampilkan jika >=15 historical data points. Di bawah threshold: tampilkan 'Insufficient data — lihat HPS manual di Knowledge Registry'.",
              detection: "Setiap estimasi dibandingkan ke ±3σ dari historical range. Outlier auto-flagged untuk human review.",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
            {
              failure: "Stale Model: AI rekomendasi berdasarkan data sebelum regulasi besar berubah",
              likelihood: "LOW (terjadi jika L1 regulasi change belum masuk training data)",
              safeguard: "L1 regulatory changes trigger mandatory model context update. Intel Briefing harus menyertakan: 'Updated post-[PKPT Jan 2026]' label.",
              detection: "Sari quarterly spot-check: ambil 10 random AI recommendations dan verify against current rules.",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
            {
              failure: "Entity Confusion: AI merekomendasi competitor intel yang sebenarnya tentang BUJK yang berbeda (nama mirip)",
              likelihood: "CURRENT ISSUE — 4.1% error rate (entity resolution bug, Sprint 23 fix)",
              safeguard: "Setiap competitor recommendation harus show 3 entity identifiers: nama + NPWP (partial) + domisili. Klien bisa flag jika salah.",
              detection: "User feedback flag — 'Ini bukan kompetitor yang dimaksud'. AM Reza triage flags setiap hari.",
              tc: "text-red-700", bc: "bg-red-50 border-red-200"
            },
            {
              failure: "Confirmation Bias: AI selalu rekomendasi tender yang sama dengan yang sudah dimenangkan klien → tidak explore new opportunities",
              likelihood: "LOW-MEDIUM (lebih sering terjadi untuk klien lama dengan fixed profile)",
              safeguard: "10% 'exploration slot' di setiap briefing: tender dari kategori atau region baru yang klien belum pernah bid. Clearly labeled 'EKSPLORASI: kategori baru untuk Anda'.",
              detection: "Profile diversity score tracked per klien. Alert AM jika klien bid category breadth turun 3+ bulan berturut.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
          ].map((r) => (
            <div key={r.failure} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.failure}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.likelihood.split(' ')[0]}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Likelihood: {r.likelihood}</p>
              <p className="text-[8px] mb-0.5"><span className="font-bold">Safeguard:</span> {r.safeguard}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Detection: {r.detection}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">AI failure documentation adalah part of trust-building, not admission of weakness. Klien yang tahu system limitations trust it more, not less. Transparency = credibility.</p>
      </div>

      {/* AI Roadmap 2026–2027 */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-primary" /> AI DEVELOPMENT ROADMAP 2026–2027 — Kapabilitas AI Baru yang Sedang Dibangun MJP dan Dampak yang Diharapkan untuk Klien
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              feature: "Natural Language Query (NLQ) untuk Knowledge Registry",
              quarter: "Q4 2026",
              status: "IN SCOPING",
              description: "Klien bisa tanya dalam Bahasa Indonesia natural: 'Apa yang berubah untuk tender gedung J8 di Jawa Tengah bulan ini?' AI retrieves and synthesizes relevant knowledge assets.",
              impact: "Predicted: Knowledge Registry usage naik 3× karena barrier to use (navigation) hilang. Especially valuable for non-tech-savvy J7 klien.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              feature: "Automated Pre-Bid Intelligence Brief Generation",
              quarter: "Q1 2027",
              status: "RESEARCH",
              description: "AI auto-generates full 6-section Pre-Bid Brief untuk setiap tender yang masuk, tanpa manual input dari Sari. Quality checked by researcher before publish.",
              impact: "Scale from 18 manual briefs/bln to 100+ automated drafts/bln. Researcher becomes editor, not author. Cost per brief turun 80%.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              feature: "Predictive Churn Early Warning",
              quarter: "Q1 2027",
              status: "DATA READY",
              description: "Model prediksi churn probability per klien berdasarkan engagement patterns, support interactions, contract renewal timeline. Alert AM Reza 60 hari sebelum predicted churn.",
              impact: "Jika 50% predicted churners di-save: +Rp 42jt/bln ARR retention. Model already validated on 18 months historical churn data.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              feature: "Competitive Bid Strategy Simulator",
              quarter: "Q2 2027",
              status: "IDEATION",
              description: "Input: tender spec + your profile + known competitors. Output: Monte Carlo simulation of bid scenarios — at Rp X you have Y% win probability with Z% margin.",
              impact: "Highest potential value-add feature ever conceived for J9 klien. Transforms bidding from art to science.",
              tc: "text-violet-700", bc: "bg-violet-50 border-violet-200"
            },
          ].map((r) => (
            <div key={r.feature} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.feature}</p>
                <div className="flex gap-1.5 shrink-0 text-[7px] font-mono">
                  <span className={r.tc}>{r.quarter}</span>
                  <span className={`font-bold ${r.tc}`}>{r.status}</span>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.description}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>Impact: {r.impact}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total AI development investment 2026–2027 est.: Rp 180jt (Hendra Jr. 6 bulan focused + compute). Expected ARR uplift from all features combined: Rp 340jt/thn. ROI: 1.9× in year 1, compounding thereafter.</p>
      </div>

      {/* AI Competitive Positioning */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-amber-500" /> AI POSITIONING — Mengapa MJP Tidak Akan Kalah dari Generic AI Tools (ChatGPT, Copilot) yang Juga Bisa Menjawab Pertanyaan Konstruksi?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              dimension: "Data Freshness",
              generic: "ChatGPT: data sampai training cutoff (sering 12–24 bln lalu). Tidak tahu tender yang announced minggu ini.",
              mjp: "MJP: real-time data. Tender yang announce 2 jam lalu sudah ada di briefing. SKK yang expire minggu depan sudah di-alert.",
              verdict: "MJP wins by design", tc: "text-emerald-700"
            },
            {
              dimension: "Local Context",
              generic: "Generic AI: tidak tahu nuance LPJK Sulawesi berbeda dari LPJK Jawa, tidak tahu bahwa evaluator di Kemenpu Jateng strict pada hal tertentu.",
              mjp: "MJP: 5 tahun field experience Sari, 1.847 pain points dari lapangan, regional calibration yang terus diupdate.",
              verdict: "MJP wins — impossible to replicate without field presence", tc: "text-emerald-700"
            },
            {
              dimension: "Tender-Specific Intelligence",
              generic: "Generic AI: bisa bantu template dokumen, tidak bisa tahu siapa kompetitor yang akan ikut tender spesifik dan berapa mereka biasanya bid.",
              mjp: "MJP: 38.400 historical tender + outcome data. Head-to-head analysis. Win probability per specific tender.",
              verdict: "MJP wins — data moat is insurmountable for generics", tc: "text-emerald-700"
            },
            {
              dimension: "Accountability",
              generic: "Generic AI: if wrong recommendation leads to bad bid, no accountability. Black box.",
              mjp: "MJP: explainability (shows reasoning), track record (87% accuracy), SLA guarantee. Accountable partner.",
              verdict: "MJP wins — trust is a business relationship, not a chatbot", tc: "text-emerald-700"
            },
            {
              dimension: "Cost of Integration",
              generic: "Generic AI: free or cheap. BUJK need to learn prompting. No workflow integration.",
              mjp: "MJP: Rp 1.5jt/bln but delivers direct ROI. Integrated into AM workflow. Push alerts, not pull queries.",
              verdict: "Generic cheaper — but ROI-adjusted MJP wins 3.2× at Growth tier", tc: "text-blue-700"
            },
          ].map((r) => (
            <div key={r.dimension} className="border-b pb-1.5 pt-0.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[9px] font-bold flex-1">{r.dimension}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.verdict}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Generic: {r.generic}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>MJP: {r.mjp}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Positioning principle: MJP is not an AI tool — it's a domain-expert intelligence platform powered by AI. The expert knowledge is the product. AI is just the delivery mechanism.</p>
      </div>

      {/* AI Accuracy Benchmarking */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> AI ACCURACY BENCHMARKING — Bagaimana MJP Mengukur dan Membuktikan Akurasi Rekomendasi AI kepada Klien dan Investor?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { model: "HPS Estimation Model", metric: "Mean Absolute Error", score: "3.8%", baseline: "Industry manual estimate: 8.2%", improvement: "2.16× lebih akurat dari manual estimation", tested: "847 tenders YTD", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { model: "Win Probability Scorer", metric: "Brier Score (calibration)", score: "0.14 (perfect = 0, random = 0.25)", baseline: "Expert human estimate: Brier 0.19", improvement: "Lebih calibrated than expert human — especially for high/low probability ends", tested: "1.240 bid outcomes YTD", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { model: "Competitor Bid Pattern", metric: "Directional Accuracy (above/below HPS)", score: "87.3%", baseline: "No-information rate: 50%", improvement: "87% vs 50% = significant. Translates directly to pricing strategy edge.", tested: "384 competitor bid observations", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { model: "Churn Prediction (early warning)", metric: "F1 Score at 60-day horizon", score: "0.73", baseline: "Lagging human observation: F1 0.31", improvement: "2.35× better recall of actual churners. Identified 14 at-risk klien Q2 — 8 saved by AM.", tested: "487 klien tracked, 18 months", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.model} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.model}</p>
                <span className={`text-[7px] font-mono shrink-0 text-muted-foreground`}>{r.tested}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><p className="text-[7px] text-muted-foreground">Metric: {r.metric}</p><p className={`text-[9px] font-black font-mono ${r.tc}`}>{r.score}</p></div>
                <div><p className="text-[7px] text-muted-foreground">Baseline</p><p className="text-[8px]">{r.baseline}</p></div>
                <div><p className="text-[7px] text-muted-foreground">Improvement</p><p className={`text-[8px] font-mono ${r.tc}`}>{r.improvement}</p></div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Benchmarks di-publish ke Enterprise klien setiap kuartal. Methodology fully documented. Klien bisa audit sample. This level of transparency is rare in B2B SaaS — and it's MJP's credibility differentiator.</p>
      </div>

      {/* AI Governance Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> AI GOVERNANCE — Aturan Internal MJP tentang Bagaimana AI Boleh dan Tidak Boleh Digunakan dalam Produk yang Berdampak ke Keputusan Bisnis Klien
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              rule: "AI Never Makes Final Recommendations Alone",
              rationale: "Semua AI output yang berdampak ke keputusan bisnis klien HARUS di-validate oleh human expert (Sari atau Dewi) sebelum published.",
              implementation: "Pre-Bid Intel Brief: AI drafts, Sari reviews + edits + signs off. HPS Estimate: AI calculates, confidence score shown, user can override. Platform never says 'you must bid at Rp X' — always framed as intelligence, not instruction.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              rule: "Confidence Scores Must Be Shown — No Hidden Uncertainty",
              rationale: "Klien deserve to know how confident MJP's AI is. High confidence recommendation treated differently from low confidence.",
              implementation: "All AI outputs show confidence level prominently (HIGH/MEDIUM/LOW with percentage). Low confidence = expanded disclaimer. Platform design emphasizes uncertainty, not false precision.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              rule: "No Automation for Legally Consequential Actions",
              rationale: "Submitting a bid, signing a contract, reporting to regulator — these cannot be automated. MJP provides intelligence for humans to make these decisions.",
              implementation: "Platform has no 'auto-submit' feature. All export and sharing is manual. No integration with LPSE that would allow automated form submission.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              rule: "Regular Bias Audits — Ensure AI Doesn't Systematically Disadvantage Any Segment",
              rationale: "AI trained on historical data can encode historical biases (e.g., systematically lower win probability estimates for J7 BUJK from Eastern Indonesia).",
              implementation: "Quarterly bias audit by Sari: compare AI recommendations across BUJK class, region, age. Any systematic pattern triggers model review.",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
          ].map((r) => (
            <div key={r.rule} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.rule}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">Why: {r.rationale}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>How: {r.implementation}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">AI governance tidak hanya tentang ethics — ini tentang trust. Klien yang trust MJP AI framework = klien yang stay longer, pay more, and refer others. Governance is a competitive advantage when most competitors have none.</p>
      </div>

      {/* AI Feature Engagement Analytics */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> AI FEATURE ENGAGEMENT — Seberapa Aktif Klien Menggunakan Setiap Fitur AI MJP dan Apa yang Membuat Mereka Trust atau Tidak Trust?
        </p>
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-[8px] font-mono">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left p-1 text-muted-foreground">Fitur AI</th>
                <th className="p-1 text-center text-muted-foreground">MAU</th>
                <th className="p-1 text-center text-muted-foreground">Trust Score</th>
                <th className="p-1 text-center text-muted-foreground">% acted on recommendation</th>
                <th className="p-1 text-center text-muted-foreground">Top complaint</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["HPS Estimator", "412 (85%)", "8.2/10", "91%", "Occasional outlier for special construction types"],
                ["Win Probability Score", "287 (59%)", "7.4/10", "78%", "Unclear why probability is X — black box perception"],
                ["Competitor Bid Pattern AI", "241 (49%)", "8.7/10", "89%", "Some competitors have too few data points (<5)"],
                ["Intel Brief Auto-Summary", "198 (41%)", "7.9/10", "84%", "Too long sometimes — want 3-sentence summary option"],
                ["Recommendation Engine", "164 (34%)", "6.8/10", "61%", "Relevance miss — recommends things already known"],
                ["Sanggah Risk Analyzer", "87 (18%)", "8.1/10", "79%", "Only used when klien already in dispute situation"],
              ].map((row, i) => (
                <tr key={i} className="border-b hover:bg-muted/20">
                  {row.map((cell, j) => <td key={j} className={`p-1 ${j === 0 ? "font-bold" : j === 2 ? "text-center font-bold text-emerald-700" : "text-center text-muted-foreground"}`}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border rounded-sm p-2.5 bg-orange-50 border-orange-200">
          <p className="text-[9px] font-bold text-orange-700">Engagement Insight:</p>
          <p className="text-[8px]">Trust scores correlate strongly with transparency: HPS Estimator shows MAE + confidence level → 8.2/10. Recommendation Engine shows nothing → 6.8/10. Fix for Recommendation Engine: add 'why this recommendation?' explainability. Expected trust lift: +1.2 points.</p>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">All 6 AI features have {'>'} 60% action rate among users — meaning when clients use the feature, they act on it. The challenge is driving adoption, not trust. Onboarding must include mandatory AI feature walkthrough.</p>
      </div>

      {/* NLQ — Natural Language Query Roadmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-primary" /> NLQ ROADMAP — Rencana Implementasi Natural Language Query: Bagaimana MJP Akan Membiarkan Klien Tanya dalam Bahasa Indonesia Natural dan Mendapat Jawaban Tepat?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">NLQ allows klien to ask questions like: "Siapa kompetitor saya di tender gedung Jawa Tengah di atas Rp 2M bulan lalu dan berapa mereka menang?" — and get structured, data-backed answers.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            {[
              { phase: "Phase 1: Intent Classification (current — Sprint 24 scoping)", detail: "Build intent classifier: map natural language question to one of 12 pre-defined query templates. E.g. 'kompetitor [category] [region]' → competitor_analysis_query(category, region). Accuracy target: 85%.", status: "SCOPING", tc: "text-blue-700" },
              { phase: "Phase 2: Parameter Extraction (Q4 2026)", detail: "Extract entities from natural language: company names, locations, date ranges, monetary values. Uses NER (Named Entity Recognition) fine-tuned on Indonesian construction vocabulary.", status: "PLANNED", tc: "text-orange-700" },
              { phase: "Phase 3: Query Execution + Result Synthesis (Q1 2027)", detail: "Execute structured query against MJP DB. Use LLM to synthesize data into natural language answer with source citations. Show raw data table + narrative answer.", status: "PLANNED", tc: "text-orange-700" },
              { phase: "Phase 4: Context Memory + Multi-turn (Q2 2027)", detail: "Allow follow-up questions: 'Dan untuk Sulawesi?' should understand context from previous question. Session-based memory. Hardest engineering challenge.", status: "FUTURE", tc: "text-slate-600" },
            ].map((r) => (
              <div key={r.phase} className="border rounded-sm p-2.5 bg-muted/10">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.phase}</p>
                  <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.status}</span>
                </div>
                <p className="text-[7px] text-muted-foreground">{r.detail}</p>
              </div>
            ))}
          </div>
          <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200">
            <p className="text-[9px] font-bold text-emerald-700">WTP Validation (12 Enterprise klien, Sari interview Q2 2026):</p>
            <p className="text-[8px]">11 of 12 said NLQ would make them "significantly more confident" using platform. 8 of 12 said they would pay Rp 250–500rb/bln add-on. 3 said they'd upgrade tier for this feature alone. Validated: proceed to build.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">NLQ adalah single biggest product leap planned for 2027. It changes MJP from 'platform you navigate' to 'intelligence partner you ask'. Like Google Search: once users experience it, they cannot imagine going back to manual filtering.</p>
      </div>

      {/* AI Integration with External Tools */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> EXTERNAL AI INTEGRATIONS — Layanan AI Eksternal yang MJP Gunakan atau Rencanakan untuk Dintegrasikan dan Mengapa Bukan Build-from-Scratch?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { service: "Anthropic Claude API (current — used in briefing draft)", useCase: "Pre-Bid Intel Brief auto-draft. Feed: tender metadata + competitor history + HPS estimates → Claude generates narrative first draft. Sari edits and signs off.", whyThis: "Best-in-class instruction following + long context (tender docs can be 50+ pages). Safety features aligned with MJP governance (no hallucination-heavy confidently wrong answers).", cost: "Avg Rp 180rb/month current usage. At 45 briefs/bln target: Rp 520rb/bln. ROI: 45 briefs × Rp 2.5jt margin = Rp 112jt/bln.", tc: "text-emerald-700" },
            { service: "Google Gemini / Vertex AI (evaluated, Q4 2026 decision)", useCase: "Knowledge asset drafting pipeline. Sari gives research notes → Gemini generates structured first draft → Sari edits.", whyThis: "Gemini Pro long context + Google Docs integration makes editing seamless. Also evaluating: structured data extraction from tender PDFs where Gemini's PDF understanding may be superior.", cost: "Cost comparison underway. Decision Q4 2026.", tc: "text-blue-700" },
            { service: "OpenAI Embedding API (current — search index)", useCase: "Semantic search in Knowledge Registry. Klien searches 'tender rehabilitasi Semarang' → embedding similarity → returns relevant assets beyond keyword match.", whyThis: "text-embedding-3-small: 1536 dimensions, Rp 18rb per million tokens. Cost-effective for 5.200 assets × quarterly re-embedding.", cost: "Rp 12rb/bln current. At 60 assets/bln: ~Rp 18rb/bln. Negligible.", tc: "text-blue-700" },
            { service: "BPS Data API (public — planned Q1 2027)", useCase: "Macro economic indicators embedded in intel briefing: IHPB, construction cost index, GDP growth per province. Automated context for HPS calibration.", whyThis: "Free government API. Adds credible macro context without additional research effort. Supports political risk calendar product.", cost: "Free. 40-hour integration (Hendra Jr.). Q1 2027.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.service} className="border-l-2 border-primary/20 pl-3 py-1.5">
              <p className="text-[9px] font-bold mb-0.5">{r.service}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">Use: {r.useCase}</p>
              <p className="text-[8px] mb-0.5">Why: {r.whyThis}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Cost: {r.cost}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">MJP's AI strategy: use best-of-breed external models for commodity AI tasks (text generation, embedding, extraction), build proprietary models only where domain data gives unfair advantage (HPS estimation, win probability, entity resolution). Avoid NIH syndrome.</p>
      </div>

      {/* AI Training Data Strategy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-primary" /> TRAINING DATA STRATEGY — Data Apa yang MJP Gunakan untuk Melatih Model Proprietary dan Bagaimana Kualitas Data Training Dijaga?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              model: "HPS Estimation Model",
              trainingData: "6.895 historical tenders dengan: actual HPS, category, location, year, season. Labeled by Sari with 'reasonable' vs 'suspicious' flag (detects LPSE manipulation).",
              quality: "Human annotation rate: 100% (Sari reviews all training labels). Refresh cycle: monthly (new tender outcomes added). Current training set size: 6.895 rows.",
              performance: "MAE: 7.8% of HPS value. {'<'}8% = acceptable. Top categories: Rehabilitasi Gedung (5.1% MAE). Weakest: Infrastruktur Sulawesi (14.2% MAE — insufficient KTI data).",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              model: "Win Probability Score",
              trainingData: "4.312 tender outcomes where MJP klien participated. Features: HPS distance, competitor count, seasonal factor, BUJK experience score. Labels: Won / Lost.",
              quality: "Imbalanced class (won 27.4% vs lost 72.6%). SMOTE oversampling applied. Train/test split: 80/20 with temporal holdout (test only on last 12 months to prevent future leakage).",
              performance: "AUC-ROC: 0.74. Precision at top-30% predicted wins: 43% actual wins (vs 27.4% base rate). 1.57× improvement over random. Good enough to be useful, not perfect.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
          ].map((r) => (
            <div key={r.model} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.model}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">Data: {r.trainingData}</p>
              <p className="text-[8px] mb-0.5">Quality: {r.quality}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Performance: {r.performance}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-orange-50 border-orange-200">
            <p className="text-[9px] font-bold text-orange-700">Data Flywheel:</p>
            <p className="text-[8px]">Every new tender outcome = new training data point. 487 klien × 12–18 tenders/tahun each = 5.844–8.766 new labeled examples/tahun. More clients → more data → better model → better recommendations → more clients. Classic AI flywheel — MJP's moat compounds over time.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Training data is more valuable than the model architecture. A mediocre model trained on MJP's proprietary labeled data will outperform a state-of-the-art model trained on generic data. This data is impossible to replicate without MJP's 4.5 years of relationship-built dataset.</p>
      </div>

      {/* AI Governance & Ethics Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> AI GOVERNANCE — Framework Tata Kelola AI MJP: Apa yang Boleh AI Lakukan Sendiri dan Apa yang Harus Selalu Melewati Review Manusia?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200">
              <p className="text-[9px] font-bold text-emerald-700 mb-1">AI may act autonomously:</p>
              {[
                "Crawl and ingest raw data from LPSE, LPJK, BPS",
                "Normalize + entity-match with confidence > 0.78",
                "Generate first draft of briefing content (Sari edits)",
                "Score tenders for watchlist relevance",
                "Calculate HPS estimate (shown with confidence %, not as fact)",
                "Trigger L2 and L3 alerts after automated threshold check",
                "Suggest pain point cluster labels (Sari approves)",
              ].map((item, i) => (
                <p key={i} className="text-[7px] text-emerald-800">✓ {item}</p>
              ))}
            </div>
            <div className="border rounded-sm p-2.5 bg-red-50 border-red-200">
              <p className="text-[9px] font-bold text-red-700 mb-1">AI MUST have human approval:</p>
              {[
                "Trigger L1 (critical) alerts — Sari must personally approve",
                "Publish regulatory interpretations — Sari sign-off required",
                "Flag a BUJK as blacklisted — LPJK source must be confirmed",
                "Generate any legal/compliance guidance — reviewed by Sari",
                "Send outbound communications to klien",
                "Mark a pain point as DISCOVERY_CANDIDATE (Sari review)",
                "Any output presented as 'MJP official position'",
              ].map((item, i) => (
                <p key={i} className="text-[7px] text-red-800">✕ {item}</p>
              ))}
            </div>
          </div>
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700">Why these boundaries?</p>
            <p className="text-[8px]">Boundary logic: AI fails gracefully in low-stakes scenarios (wrong HPS estimate = klien uses it with caution, labeled as estimate). AI failures in high-stakes scenarios cause disproportionate harm (wrong blacklist flag = BUJK reputation damage; wrong L1 alert = klien takes costly wrong action). Human in the loop where stakes are asymmetric.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">AI governance framework disetujui Hendra Q1 2026. Written, not assumed. Shared with team in onboarding + quarterly review. Not just about safety — about liability: if AI makes a wrong call on regulatory guidance and klien suffers, who is responsible? Governance makes that answer clear: Sari, because she approved.</p>
      </div>

      {/* AI Recommendation Explainability */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-primary" /> EXPLAINABILITY — Mengapa MJP Selalu Menampilkan 'Mengapa AI Merekomendasikan Ini': Pentingnya Explainability dalam B2B Construction Intelligence?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="border rounded-sm p-2.5 bg-orange-50 border-orange-200 mb-1">
            <p className="text-[9px] font-bold text-orange-700">The 'Black Box' Problem:</p>
            <p className="text-[8px]">Jika MJP system says 'recommended: bid on Tender X, estimated win probability 31%' tanpa penjelasan — klien akan tanya 'kenapa?' atau 'bagaimana kamu bisa tahu?'. Di B2B, opaque AI recommendations destroy trust. Decision-makers need to explain their choices to their boards.</p>
          </div>
          <p className="text-[9px] font-bold mb-1">MJP explainability rules (all AI outputs must include):</p>
          {[
            { rule: "Tender recommendation", explanation: "Show contributing factors: 'Low competition in this category (3 qualified bidders), HPS realistic (+4% vs model), buyer track record: 8.1/10, J8 win lift: +23%'", format: "Factor card below recommendation" },
            { rule: "HPS estimation", explanation: "Show model reasoning: 'Based on 47 similar tenders in Jateng 2023–2025. Median winning price: X. 95% CI: Y–Z'", format: "Expand/collapse model basis" },
            { rule: "Win probability score", explanation: "Show: 'Your score vs competitors: X. Similar BUJK in same category won 29% of tenders they bid on last year.'", format: "Comparison reference" },
            { rule: "Daily briefing section", explanation: "Every claim in briefing has source citation (LPJK report, LPSE date, Sari analysis). Briefing footer: 'Reviewed by Sari, Research Lead, August 2 2026'", format: "Footnotes + signature" },
          ].map((r) => (
            <div key={r.rule} className="flex gap-2 items-start border-b py-1">
              <div className="flex-1">
                <p className="text-[8px] font-bold mb-0.5">{r.rule}</p>
                <p className="text-[7px] text-muted-foreground mb-0.5">Show: {r.explanation}</p>
                <p className="text-[7px] font-mono text-primary">Format: {r.format}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Explainability is not just ethics — it's product differentiation. Enterprise clients (which have boards and procurement committees) need to defend their decisions. 'MJP recommended it' is not sufficient. 'MJP showed us: low competition, realistic HPS, buyer track record 8.1 — we made an informed decision' is. Explainability closes Enterprise deals.</p>
      </div>

      {/* AI Model Evaluation Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Microscope className="h-3.5 w-3.5 text-primary" /> MODEL EVALUATION — Bagaimana MJP Mengevaluasi dan Memilih AI Model untuk Setiap Use Case: Framework 5-Dimensi yang Tidak Hanya Lihat Akurasi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Evaluation Dimension</th>
                  <th className="p-1 text-center">Weight</th>
                  <th className="p-1 text-left text-muted-foreground">What MJP Measures</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Task Accuracy", "30%", "For HPS: MAE%. For briefing: Sari edit distance (% of AI draft changed). For NLQ: answer relevance score."],
                  ["Latency (P99)", "20%", "< 500ms for inline suggestions, < 3s for briefing draft generation. > 5s = poor UX in mobile context."],
                  ["Cost per inference", "20%", "Total API cost/bln as % of AI operational budget (target < 8% of gross margin)"],
                  ["Bahasa Indonesia quality", "20%", "Sari subjective rating 1–5 on: naturalness, accuracy of construction terminology, BUJK-appropriate register."],
                  ["Data privacy posture", "10%", "Is client data sent to 3rd party? MJP standard: no PII in prompt. Tender IDs OK. BUJK identifiers OK. Personal data of directors: NO."],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center font-bold text-primary">{row[1]}</td>
                    <td className="p-1 text-muted-foreground">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700">Current model choices per use case:</p>
            {[
              ["Daily Briefing Draft", "Claude claude-3-5-sonnet (primary)", "Best Bahasa Indonesia quality. Sari edit rate: 22%."],
              ["HPS Estimation", "Internal regression model (sklearn)", "No LLM — proprietary mathematical model. 7.8% MAE."],
              ["NLQ Search", "Embedding: text-embedding-3-small + BM25 hybrid", "Optimized for construction terminology."],
              ["Alert classification", "Fine-tuned DistilBERT on Indonesian legal text", "Low latency (80ms), high accuracy on regulatory categories."],
            ].map(([usecase, model, note]) => (
              <div key={usecase} className="flex gap-1.5 border-b py-0.5">
                <p className="text-[7px] font-bold w-32 shrink-0">{usecase}</p>
                <p className="text-[7px] flex-1">{model}</p>
                <p className="text-[7px] text-muted-foreground shrink-0 max-w-[120px] text-right">{note}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Model evaluation is Hendra Jr.'s responsibility. Quarterly benchmark: run all 4 use cases on challenger models, compare on 5 dimensions. Switching cost is real: fine-tuned models (DistilBERT) require retraining if switching base model. LLM for briefing: easiest to switch — just update the system prompt. Rule: don't over-engineer model selection. Good enough + fast iteration beats perfect + slow.</p>
      </div>

      {/* AI Roadmap 2026–2028 */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> AI ROADMAP — Peta Jalan AI MJP 2026–2028: Dari Augmented Sari ke Platform Intelligence Penuh — 6 Kemampuan AI yang Akan Mengubah Cara Klien Menggunakan MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              year: "H2 2026 — Natural Language Query (NLQ) [IN PROGRESS]",
              capability: "Klien type natural language: 'Tampilkan tender gedung pemerintah di Jateng dengan HPS > 5M yang belum ada 3 peserta.' Platform returns filtered results. No filter dropdowns needed.",
              impact: "Estimated 3× faster time-to-relevant-tender. Key for mobile adoption (typing is easier than nested filter menus on phone). 70% of NLQ engine built.",
              readiness: "60% complete",
              tc: "text-orange-700"
            },
            {
              year: "H2 2026 — Proactive Deal Alert ('Saribot')",
              capability: "AI that monitors each klien's BUJK profile and sends proactive: 'CV Anda punya semua persyaratan untuk tender ini yang baru dibuka. Win probability: 34%. 4 kompetitor terdaftar. Batas: 8 hari.'",
              impact: "Replaces alert fatigue with targeted relevance. Currently: 97 alerts/klien/bln. With proactive deal: 12 high-confidence alerts. Less noise, more action.",
              readiness: "Design phase",
              tc: "text-blue-700"
            },
            {
              year: "2027 — Bid Strategy Assistant",
              capability: "AI that synthesizes: competitor history + HPS model + BUJK profile + seasonal pattern → generates 3 bid strategy options with rationale. Sari reviews, klien chooses.",
              impact: "Moves MJP from 'information platform' to 'decision support platform.' Unlocks higher tier pricing (Rp 5M+ /bln for Bid Strategy tier).",
              readiness: "Requires NLQ + 1 year more win/loss data",
              tc: "text-blue-700"
            },
            {
              year: "2027 — Regulatory Compliance Checker",
              capability: "Upload your tender document: AI checks compliance against all current regulations, SBU requirements, SKK requirements, and format rules. Returns: Pass/Fail per requirement + corrective action.",
              impact: "Eliminates 22% of disqualifications (SKK/SBU mismatch) automatically. Could be priced as standalone product (Rp 150K per document check).",
              readiness: "Dependent on BIM SKKNI finalization + training data",
              tc: "text-blue-700"
            },
            {
              year: "2028 — Autonomous Market Research",
              capability: "AI agent that identifies emerging market trends from LPSE + field data + regulatory signals without Sari needing to prompt it. Self-publishes draft reports for Sari's review.",
              impact: "Frees Sari from reactive research to focus on strategic analysis. From 60 min/day briefing to 20 min/day (review only).",
              readiness: "Requires 2026–2027 foundation + agentic AI maturity",
              tc: "text-muted-foreground"
            },
          ].map((r) => (
            <div key={r.year} className="border-l-2 border-primary/20 pl-3 py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.year}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.readiness}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.capability}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Impact: {r.impact}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Roadmap is aspirational — actual execution depends on Series A funding and hiring (1 AI engineer + 1 data scientist needed for 2027 items). Without funding: NLQ + Proactive Deal only (possible with current team). With Series A: full roadmap executable. Each AI capability builds on the previous: NLQ → Proactive Deal → Bid Strategy is a natural capability ladder that raises MJP's value ceiling.</p>
      </div>

      {/* AI Prompt Engineering Library */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-primary" /> PROMPT LIBRARY — Perpustakaan Prompt AI MJP: 5 System Prompt Utama yang Digunakan Sari, Mengapa Didesain Seperti Itu, dan Apa yang Pernah Gagal
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              name: "Daily Briefing System Prompt",
              purpose: "Generate daily construction intelligence briefing draft in Bahasa Indonesia for MJP klien",
              keyElements: ["Role: 'You are Sari, MJP's lead researcher with 4 years of construction industry expertise.'", "Constraints: 'Never fabricate statistics. If unsure, say \"perlu verifikasi\".'", "Format: 5 sections: Tender Highlights, Regulatory Update, Market Signal, Competitor Intel, Today's Action Item.", "Voice: 'Write as an informed colleague briefing a construction director, not as a chatbot.'"],
              fails: "Early version: AI used too formal bureaucratic language (sounding like PUPR circular). Fix: added 'conversational but authoritative' to voice guidance.",
              tc: "text-primary"
            },
            {
              name: "L1 Alert Annotation Prompt",
              purpose: "Classify regulatory change severity and suggest klien action",
              keyElements: ["Role: 'You are a compliance expert reviewing Indonesian construction regulations.'", "Output: Tier (L1/L2/L3), affected BUJK classes, deadline, recommended action, confidence level.", "Constraint: 'If article number referenced: state it explicitly. Never paraphrase legal text as if it's direct quote.'"],
              fails: "Version 2 hallucinated article numbers. Fix: added 'if you cannot find the exact article, say \"article reference pending verification\".'",
              tc: "text-orange-700"
            },
            {
              name: "Knowledge Asset Draft Prompt",
              purpose: "Create first-draft knowledge asset from Sari's topic brief",
              keyElements: ["Input: topic, key facts, target BUJK class, action the reader should take.", "Output: title, 3-paragraph body, 5 key takeaways, source citations.", "Constraint: 'Maximum 400 words. BUJK operations level reading ease.'"],
              fails: "Tendency to over-hedge ('namun perlu dicatat bahwa...'). Fix: added 'avoid caveating every claim — Sari will add appropriate caveats in her edit.'",
              tc: "text-blue-700"
            },
            {
              name: "HPS Context Explanation Prompt",
              purpose: "Explain MJP's HPS estimate to klien in plain language",
              keyElements: ["Input: tender ID, MJP estimate, similar tenders used as basis, confidence interval.", "Output: 2-sentence explanation suitable for WA delivery.", "Constraint: 'No jargon. No model explanation. Just: what the estimate is and why to trust it.'"],
              fails: "Early: too technical ('based on regression on 47 similar projects'). Fix: humanized ('Dari 47 tender serupa di Jateng 2023–2025, harga pemenang rata-rata...').",
              tc: "text-blue-700"
            },
          ].map((r) => (
            <div key={r.name} className="border rounded-sm p-2.5 bg-muted/5 mb-1">
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.name}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Purpose: {r.purpose}</p>
              <div className="mb-0.5">{r.keyElements.map((el, i) => <p key={i} className="text-[7px]">• {el}</p>)}</div>
              <p className={`text-[7px] font-mono ${r.tc}`}>Failure + fix: {r.fails}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Prompt library maintained in Notion by Sari (assisted by Hendra Jr.). Versioned: each prompt has v1/v2/v3 with change log. Why version prompts? AI model updates can change behavior — a prompt that worked on Claude claude-3 may need tuning on claude-3-5-sonnet. Versioning means rollback is possible. Total active prompts: 14 across all use cases. Sari reviews all prompts quarterly for relevance and quality drift.</p>
      </div>

      {/* AI Governance Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5 text-primary" /> AI GOVERNANCE — Kerangka Tata Kelola AI MJP: 5 Prinsip yang Memastikan AI Memperkuat Sari, Bukan Menggantikannya, dan Mengapa MJP Tidak Akan Pernah Publikasikan Konten AI Tanpa Review Manusia
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              principle: "P1 — Human-in-the-Loop (always)",
              description: "No AI-generated content reaches klien without Sari's explicit sign-off. AI = first draft assistant. Sari = editor, quality gate, and final author. The byline is always 'Sari, MJP Research Lead' — never 'AI-generated'.",
              why: "Trust is MJP's product. One AI hallucination reaching an Enterprise klien who uses it in a bid = trust destruction. The cost of one error exceeds the efficiency gain from removing Sari's review.",
              tc: "text-red-700"
            },
            {
              principle: "P2 — Transparency about AI use",
              description: "MJP discloses to Enterprise klien that AI assists Sari's drafting process. Framing: 'AI helps Sari produce at 2× speed — you still get Sari's judgment, faster.' Not hidden. Not prominently labeled on every asset.",
              why: "Proactive transparency prevents 'we found out you use AI' moment, which feels like deception. Controlled disclosure = controlled narrative.",
              tc: "text-orange-700"
            },
            {
              principle: "P3 — No AI for high-stakes advisory",
              description: "Tender-specific recommendations, bid-or-no-bid advice, sub-contractor trust assessment: human only. AI can surface context; Sari gives the recommendation. Klien making Rp 200M+ decisions deserve human accountability.",
              why: "AI is probabilistic. High-stakes decisions need explainable reasoning, not probabilistic inference that can't be audited.",
              tc: "text-orange-700"
            },
            {
              principle: "P4 — Hallucination monitoring protocol",
              description: "Sari maintains a 'hallucination log': AI claims that were wrong. Weekly review with Hendra Jr. Each error = prompt improvement task. Running accuracy rate of AI draft-to-publish: 91.4% (8.6% required Sari corrections).",
              why: "Without measurement, 'AI is generally reliable' is a belief, not a fact. Hallucination log = evidence base for continuous improvement.",
              tc: "text-blue-700"
            },
            {
              principle: "P5 — AI cost sovereignty",
              description: "MJP never becomes dependent on a single AI provider. Current: primarily Anthropic (Claude) for analysis, OpenAI (GPT-4o) for structured data extraction. Hendra Jr. runs both in parallel with routing logic. If one provider raises price or changes terms: switch routing in 48h.",
              why: "Vendor lock-in in AI = existential margin risk. Dual-provider redundancy costs 15% more in tokens but protects against single-provider dependency.",
              tc: "text-blue-700"
            },
          ].map((r) => (
            <div key={r.principle} className="border-b py-2">
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.principle}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.description}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Why: {r.why}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">AI governance document written by Hendra + Sari (Q1 2026). Reviewed with external AI ethics advisor (academic, anonymous). Not published publicly. Shared with Enterprise klien who ask. Hendra's position: 'We are not a neutral tool platform — we are an intelligence service. Intelligence services are accountable for the accuracy of what they produce. AI makes us faster; it doesn't change our accountability to accuracy.'</p>
      </div>

      {/* AI Training Data Strategy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-primary" /> TRAINING DATA — Strategi Data Pelatihan AI MJP: Dari Mana Model Belajar, Apa yang Tidak Boleh Digunakan sebagai Training Data, dan Bagaimana MJP Membangun Keunggulan Data yang Proprietary
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200">
              <p className="text-[9px] font-bold text-emerald-700 mb-1">✅ Data yang digunakan untuk training:</p>
              {[
                "Sari's 3.200 published knowledge assets (labeled, quality-gated)",
                "4.700+ historical LPSE tender records with outcomes (win/loss, winning price)",
                "Regulatory document corpus (Permen, Perpres, SNI — public domain)",
                "BUJK profile data (aggregated, anonymized for model training)",
                "Alert classification labels (Sari's L1/L2/L3 annotations)",
              ].map((d, i) => <p key={i} className="text-[7px]">• {d}</p>)}
            </div>
            <div className="border rounded-sm p-2.5 bg-red-50 border-red-200">
              <p className="text-[9px] font-bold text-red-700 mb-1">❌ Data yang TIDAK digunakan:</p>
              {[
                "Individual klien data (their specific bids, watchlists, notes)",
                "Budi's field notes with identifiable information",
                "Dewi's asesor network communication",
                "Enterprise klien's internal documents submitted via API",
                "Klien's Pre-Bid Brief content (confidential to each klien)",
              ].map((d, i) => <p key={i} className="text-[7px]">• {d}</p>)}
            </div>
          </div>
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200 mb-1">
            <p className="text-[9px] font-bold text-blue-700">MJP's proprietary data advantage:</p>
            {[
              "4 years of labeled construction intelligence (Sari's annotations) — no competitor has this corpus",
              "LPSE win/loss outcomes paired with HPS estimates — real-world validation data for pricing models",
              "L1/L2/L3 signal classification labels — regulatory alert AI needs these labeled examples to learn",
              "Budi's field pattern data (de-identified) — behavioral data that public data cannot contain",
            ].map((d, i) => <p key={i} className="text-[7px] mb-0.5">• {d}</p>)}
          </div>
          <div className="border rounded-sm p-2.5 bg-muted/10">
            <p className="text-[9px] font-bold mb-0.5">Foundation model vs. fine-tuning strategy:</p>
            <p className="text-[7px] text-muted-foreground">MJP uses foundation models (Claude, GPT-4o) for general reasoning + language generation. Fine-tuning planned only for: (1) HPS prediction (tabular model, not LLM — sklearn/XGBoost), (2) Alert classification (BERT-class model fine-tuned on Sari's labeled corpus). Foundation models for everything else = MJP avoids the cost + complexity of maintaining custom LLMs for tasks where frontier models already excel.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Proprietary training data is MJP's long-term AI moat. Every quarter, Sari adds ~90 new labeled assets to the corpus. At 2028 (target 6.000 assets): MJP's labeled construction intelligence corpus will be the most comprehensive in Indonesia. A new entrant using foundation models without this corpus will produce generic analysis. MJP's fine-tuned models + labeled corpus produce construction-specific analysis no foundation model can replicate without 4+ years of MJP's labeling work.</p>
      </div>

      {/* NLQ Architecture Preview */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-primary" /> NLQ ARCHITECTURE — Arsitektur Natural Language Query yang Sedang Dibangun Hendra Jr.: Bagaimana Klien Bisa Mengetik 'Tunjukkan tender jembatan di Jateng bulan ini' dan Mendapatkan Hasil yang Tepat
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">NLQ pipeline (70% complete as of Q2 2026):</p>
          {[
            { step: "Step 1 — Intent Classification", desc: "LLM identifies query intent from 5 categories: Tender Search, BUJK Lookup, Regulatory Query, HPS Query, or Knowledge Search. Confidence score required > 0.8 to proceed.", status: "✅ Complete", tc: "text-emerald-700" },
            { step: "Step 2 — Entity Extraction", desc: "Extract structured entities from natural language: KBLI code (from sector keywords), geography (province/kabupaten), value range, timeframe, BUJK class. Uses fine-tuned NER model on MJP's construction corpus.", status: "✅ Complete", tc: "text-emerald-700" },
            { step: "Step 3 — Query Translation", desc: "Convert extracted entities to structured database query. Handle ambiguity: 'jembatan' → KBLI 42101 + 42102 + 42103 (Hendra Jr. built construction-specific KBLI synonym dictionary).", status: "🟡 80% — synonym dict coverage gap for rare sub-sectors", tc: "text-orange-700" },
            { step: "Step 4 — Result Ranking", desc: "Apply klien's profile (their BUJK class, geography, historical win patterns) to rank results by relevance. Not just matching — personalized relevance.", status: "🟡 60% — personalization model needs more training data", tc: "text-orange-700" },
            { step: "Step 5 — Natural Language Response", desc: "LLM generates human-readable summary of results. 'Found 14 jembatan tenders in Jateng this month. Top 3 by fit score for your profile: [list].' Response in Bahasa Indonesia.", status: "✅ Complete (LLM handles this)", tc: "text-emerald-700" },
            { step: "Step 6 — Follow-up Handling", desc: "Multi-turn conversation: klien can refine ('hanya yang > Rp 1M' / 'hapus yang sudah tutup'). State maintained per session.", status: "🔴 20% — multi-turn state management not started", tc: "text-red-700" },
          ].map((r) => (
            <div key={r.step} className="flex gap-2 border-b py-1.5">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[8px] font-bold flex-1">{r.step}</p>
                  <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.status}</span>
                </div>
                <p className="text-[7px] text-muted-foreground">{r.desc}</p>
              </div>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200 mt-1">
            <p className="text-[9px] font-bold text-blue-700">Q4 2026 NLQ launch scope (MVP):</p>
            <p className="text-[8px]">Steps 1–3 + Step 5 (no personalization, no multi-turn). Single-turn queries only. Tender search + regulatory query + knowledge search. Multi-turn (Step 6) in v2 (Q1 2027). Personalization (Step 4) in v2 also. MVP launch target: October 2026. Series A demo: November 2026. The sequence is deliberate — ship usable before perfect.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">NLQ is Hendra Jr.'s most ambitious project. He described it to Hendra as: 'We're building the first construction-specific search engine in Indonesia that understands what BUJK actually mean when they type, not just what they literally type.' The synonym dictionary alone took 3 weeks — 4.200 construction terms mapped to KBLI codes and regulatory categories. This dictionary is itself a competitive moat that took domain expertise to build.</p>
      </div>

      {/* AI Model Selection Rationale */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-primary" /> MODEL SELECTION — Rasional Pemilihan Model AI MJP: Mengapa Tidak Semua Fitur Menggunakan GPT-4, Bagaimana Hendra Jr. Memilih Model Berdasarkan Akurasi vs. Biaya vs. Latensi, dan Roadmap Fine-Tuning 2026–2028
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Feature</th>
                  <th className="p-1 text-left">Model used</th>
                  <th className="p-1 text-center">Rationale</th>
                  <th className="p-1 text-center">Cost/call</th>
                  <th className="p-1 text-left">Next evolution</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Daily Briefing generation", "GPT-4o", "Requires coherent multi-source synthesis in formal Indonesian. Quality > cost.", "Rp 280–420/call", "Fine-tune on 3.200+ MJP assets for domain tone"],
                  ["NLQ intent classification", "GPT-3.5-turbo (plan)", "Simple classification task — doesn't need GPT-4o reasoning. 10× cheaper.", "Rp 12–18/call", "Distill to in-house model (2027)"],
                  ["KBLI entity extraction", "Custom NER (spaCy)", "Structured extraction task. No LLM needed after fine-tuning. Latency: <50ms.", "Rp 0 (self-hosted)", "Retrain quarterly on new KBLI additions"],
                  ["HPS estimate narrative", "GPT-4o-mini", "Needs good Indonesian but task is simpler. Balance quality/cost.", "Rp 45–80/call", "Fine-tune on MJP's HPS labeled dataset"],
                  ["Asset tagging (auto-suggest)", "Text-embedding-3-small", "Semantic similarity task. Embedding model is optimal.", "Rp 8/1k tokens", "In-house embedding after 6.000 assets"],
                  ["Competitor analysis summary", "GPT-4o", "Strategic analysis requires reasoning. Worth the cost for Enterprise klien.", "Rp 380–600/call", "Limit to Enterprise tier only"],
                  ["WA notification personalization", "GPT-3.5-turbo (plan)", "Simple personalization — klien name + KBLI + urgency. Low complexity.", "Rp 10–15/call", "Template-based fallback if cost exceeds budget"],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-primary">{row[1]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[2]}</td>
                    <td className="p-1 text-center text-orange-700">{row[3]}</td>
                    <td className="p-1 text-muted-foreground">{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-amber-50 border-amber-200">
            <p className="text-[9px] font-bold text-amber-700">Fine-tuning roadmap (2026–2028):</p>
            {[
              ["2026 Q4", "Fine-tune GPT-4o on MJP briefing corpus (1.200 labeled examples). Target: 25% cost reduction vs. base model."],
              ["2027 Q2", "Distill NLQ intent classifier to in-house model. Eliminate OpenAI dependency for classification tasks."],
              ["2027 Q4", "In-house embedding model trained on MJP 6.000-asset corpus. Full independence for semantic search."],
              ["2028 Q2", "MJP-Construction-LLM v1: fine-tuned foundation model for Indonesian construction intelligence. Shared-nothing deployment."],
            ].map(([q, d]) => (
              <div key={q} className="flex gap-2 text-[7px] border-b py-0.5 last:border-0"><p className="font-bold shrink-0 w-16 text-amber-700">{q}</p><p>{d}</p></div>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Model selection philosophy: Hendra Jr. uses the cheapest model that meets quality threshold for each task. Never use GPT-4o for tasks that GPT-3.5 handles adequately — cost compounds at scale. At 1.500 klien with 2× daily briefings + 10 NLQ queries/day/user: AI inference becomes Rp 5.5jt+/month (largest growing line item in infra budget). Fine-tuning path is not about capability — it's about cost reduction and data independence as MJP's corpus matures.</p>
      </div>

      {/* AI Failure Mode Registry */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-orange-500" /> AI FAILURE MODES — Register Kegagalan AI MJP: 7 Cara AI Bisa Salah dalam Konteks Platform MJP — dan Langkah Spesifik yang Sudah Diimplementasikan untuk Mencegah Setiap Jenis Kegagalan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { mode: "FM-01 — Hallucinated regulation (invents Permen/Perpres yang tidak ada)", severity: "CRITICAL", prevention: "All regulatory statements must cite source URL. If LLM cannot cite: blocked from publishing. Post-generation: automated source verification against official domains. Any unciteable regulatory claim = human review required.", status: "✅ Implemented. 0 incidents post-implementation." },
            { mode: "FM-02 — Stale training data (LLM knows 2024 regulations, not 2026)", severity: "HIGH", prevention: "LLM never used for real-time regulatory facts. It writes narrative around data that MJP injects at inference time. All regulatory data comes from Sari's knowledge base (current), not LLM training data (stale).", status: "✅ Architectural prevention. RAG pattern mandatory." },
            { mode: "FM-03 — BUJK name confusion (similar company names in construction)", severity: "HIGH", prevention: "All BUJK references resolved against LPJK ID (unique identifier), not company name. LLM-generated content with a BUJK name gets LPJK ID appended. Names alone are never used for Trust Score lookups.", status: "✅ Implemented. 0 cross-entity errors since." },
            { mode: "FM-04 — HPS hallucination (fabricates a number when uncertain)", severity: "CRITICAL", prevention: "HPS model is entirely rule-based + statistical, not LLM-generated. LLM writes the explanatory narrative after the number is calculated. The number itself is never generated by LLM.", status: "✅ Architecture separates calculation from narration." },
            { mode: "FM-05 — Language code-switching (mixes Indonesian/English inappropriately)", severity: "LOW", prevention: "System prompt enforces formal Bahasa Indonesia for all klien-facing content. Technical terms (API, SBU, KBLI, BIM) are whitelisted. Any English word not on whitelist triggers a review flag.", status: "🟡 Partially solved — LLM still occasionally uses informal Bahasa. Post-launch improvement." },
            { mode: "FM-06 — Overconfident framing (presents uncertain data as certain)", severity: "HIGH", prevention: "Sari's confidence labeling protocol required for all AI-generated content: [Est. X%] or [Low confidence — verify]. System prompt instructs: 'Express uncertainty explicitly. Never claim certainty you don't have.'", status: "✅ Enforced by system prompt + Sari's post-generation review." },
            { mode: "FM-07 — NLQ misinterpretation (wrong KBLI from ambiguous query)", severity: "MEDIUM", prevention: "If NLQ intent confidence < 0.8: show clarification question instead of results. 'Apakah maksud Anda tender [X] atau [Y]?' Prevents silently wrong results from seeming like correct ones.", status: "✅ Implemented in NLQ v1 pipeline (Step 1 confidence gate)." },
          ].map((r) => (
            <div key={r.mode} className={`border-b py-1.5 ${r.severity === "CRITICAL" ? "bg-red-50/30" : ""}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.severity === "CRITICAL" ? "text-red-700" : r.severity === "HIGH" ? "text-orange-700" : "text-muted-foreground"}`}>{r.mode}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.severity === "CRITICAL" ? "text-red-700" : r.severity === "HIGH" ? "text-orange-700" : "text-muted-foreground"}`}>{r.severity}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Prevention: {r.prevention}</p>
              <p className={`text-[7px] font-mono ${r.status.includes("✅") ? "text-emerald-700" : "text-orange-700"}`}>{r.status}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">AI failure mode register reviewed quarterly (Hendra + Hendra Jr. + Sari). New failure modes added when: (1) a new AI feature is deployed, (2) a near-miss is observed in testing, (3) an AI incident is reported by klien. Hendra's AI governance principle: 'AI failures in MJP are not product bugs — they're trust violations. A hallucinated regulation reaching a klien is more damaging than 3 days of downtime. Prevention investment is asymmetric with recovery cost.' This is why CRITICAL failure modes have zero-tolerance prevention — no production shortcuts allowed.</p>
      </div>

      {/* AI Product Roadmap 2026–2028 */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> AI ROADMAP 2026–2028 — Peta Jalan Produk AI MJP: Dari NLQ v1 di Q4 2026 hingga Sistem Rekomendasi Proaktif di 2028 — Setiap Milestone dan Apa yang Harus Benar Dulu Sebelum Bisa Dibangun
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { phase: "Phase 1 — Q4 2026: NLQ v1 (single-turn, Pro+)", features: ["Natural language tender search (Indonesian)", "KBLI entity extraction + synonym resolution", "Regulatory knowledge search via NLQ", "Confidence gate: clarification question if intent score < 0.8"], prereqs: "KBLI synonym dictionary (complete ✅), NLQ pipeline Steps 1–3 + 5 (80%).", tc: "text-primary" },
            { phase: "Phase 2 — Q1 2027: NLQ v2 (multi-turn + personalization)", features: ["Conversation memory (multi-turn: 'refine previous query')", "Profile-aware results (klien's KBLI + geography + history)", "NLQ-driven briefing personalization (queries feed daily briefing customization)", "NLQ for BUJK lookup ('tunjukkan BUJK MEP Jakarta dengan Trust Score > 80')"], prereqs: "NLQ v1 stable + klien feedback from 90-day v1 cohort. Personalization model needs 30+ days NLQ data.", tc: "text-blue-700" },
            { phase: "Phase 3 — Q3 2027: Proactive Intelligence (push model)", features: ["Opportunity radar: 'This tender matches your win pattern — recommend bidding'", "Risk alerts: 'Your trusted sub-contractor X just entered blacklist' (already have this, now contextual)", "HPS alert: 'Your current contract may be underbid — market price moved +12%'", "Consortium suggestion: 'Tender Y matches BUJK in your area — optimal consortium [A+B+C]'"], prereqs: "Win probability model v2 + NLQ v2 behavior data. At least 6 months of NLQ v1 usage patterns.", tc: "text-emerald-700" },
            { phase: "Phase 4 — Q2 2028: MJP-Construction-LLM v1 (in-house model)", features: ["Fine-tuned construction intelligence model on MJP 6.000-asset corpus", "Bahasa Indonesia construction dialect comprehension (terms like 'nilai pagu', 'BAST', 'addendum')", "Cost reduction: replace > 60% of GPT-4o calls with in-house model", "Competitive moat: model cannot be replicated without MJP's proprietary corpus"], prereqs: "6.000 labeled assets (Sari Q4 2027 estimate), fine-tuning infrastructure (AWS SageMaker or equivalent), ML engineering hire (post-Series A H2).", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.phase} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.phase}</p>
              <div className="mb-0.5">{r.features.map((f, i) => <p key={i} className="text-[7px]">• {f}</p>)}</div>
              <p className={`text-[7px] font-mono ${r.tc}`}>Prerequisites: {r.prereqs}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">AI roadmap dependency chain: NLQ v1 → v2 → Proactive Intelligence → MJP-LLM. Each phase unlocks the next through data generation. NLQ v1 generates query behavior data → feeds v2 personalization. v2 generates win pattern data → feeds proactive intelligence. Proactive intelligence generates labeled outcomes → feeds MJP-LLM training. Hendra: 'We're not building a chatbot. We're building a compounding intelligence system where every klien interaction makes the platform smarter for every other klien.' The flywheel only works if each phase executes cleanly.</p>
      </div>

      {/* AI Governance & Ethics Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> AI GOVERNANCE — Kerangka Tata Kelola dan Etika AI MJP: 6 Prinsip yang Menentukan Kapan MJP Boleh Menggunakan AI dalam Produk dan Kapan Tidak — serta Standar Transparansi ke Klien
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              principle: "G1 — AI augments human intelligence, never replaces it",
              rule: "Every AI output that reaches a klien must have gone through a human validation gate: Sari for knowledge, Dewi for SKK, Hendra for product recommendations. AI is the first draft, never the final word.",
              example: "NLQ results will include confidence scores. Results with confidence < 0.8 will trigger a 'Sari suggests clarifying' prompt before displaying — not just show low-confidence AI output to klien.",
              tc: "text-primary"
            },
            {
              principle: "G2 — No AI in high-stakes compliance decisions without explicit human override",
              rule: "SKK Express eligibility determination, BUJK qualification pre-screening for tenders > Rp 5T, and regulatory interpretation for active legal disputes — all require human (Sari or Dewi) sign-off, no AI auto-decision.",
              example: "Hendra Jr. prototyped an automated SKK eligibility checker. Hendra stopped it: 'If our AI says someone is eligible and they're not, they lose a tender. That's a legal and trust liability. Dewi confirms.'",
              tc: "text-blue-700"
            },
            {
              principle: "G3 — Transparent labeling of AI-generated content",
              rule: "Every AI-generated recommendation, HPS estimate, and win probability score is labeled 'Estimasi AI' with confidence score and a 'How is this calculated?' tooltip.",
              example: "HPS estimates show: 'Estimasi HPS: Rp 2.4M ± 8.3% (AI Model v2.1 — berdasarkan 1.247 tender serupa KBLI 42202 2024–2025)'. Klien know they're seeing a model output, not a ground truth.",
              tc: "text-emerald-700"
            },
            {
              principle: "G4 — No proprietary client data used for external model training",
              rule: "MJP's behavioral data (klien clicks, bookmarks, queries, NLQ history) is never sent to OpenAI or any external model provider for training purposes. API calls are stateless — no conversation history retained externally.",
              example: "Hendra explicitly reviewed OpenAI's data retention policies before NLQ integration. API is configured in zero-data-retention mode. This is a trust guarantee to klien.",
              tc: "text-orange-700"
            },
            {
              principle: "G5 — Klien can always opt out of AI features",
              rule: "Every AI feature has an off switch. Klien who prefer manual search over NLQ, or raw data over win probability scores, can disable AI overlays entirely. No feature is mandatory AI.",
              example: "In internal testing (beta with 12 klien): 2 of 12 preferred NLQ off (they found confidence scores created anxiety). Both stayed as klien. Opt-out is a retention feature, not a product failure.",
              tc: "text-muted-foreground"
            },
            {
              principle: "G6 — Annual AI audit (internal + optional external)",
              rule: "Hendra + Hendra Jr. + Sari conduct an annual AI system audit: bias check (does win probability model disadvantage BUJK from certain regions?), accuracy drift (has HPS model degraded?), failure mode review (new modes since last year?).",
              example: "2025 audit finding: win probability model was 4pp overconfident for outer island tenders (less training data). Correction applied. 2026 audit scheduled Q4 2026 after NLQ v1 launch.",
              tc: "text-primary"
            },
          ].map((r) => (
            <div key={r.principle} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.principle}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Rule: {r.rule}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Example: {r.example}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">AI governance framework positions MJP as a responsible AI platform at a time when most Indonesian construction tech has no AI governance at all. This is a competitive advantage in the Series A conversation and in Enterprise klien trust. Hendra: 'I want to be able to tell every klien exactly what our AI does, what it doesn't do, and what happens when it's wrong. Opacity is a liability. Governance is a product feature.' The framework is published in MJP's privacy policy (accessible from platform footer).</p>
      </div>

      {/* AI Recommendation Feedback Loop */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RotateCcw className="h-3.5 w-3.5 text-primary" /> AI FEEDBACK LOOP — Loop Umpan Balik Rekomendasi AI MJP: Bagaimana Setiap Klik dan Aksi Klien Membuat Model Menjadi Lebih Baik — Arsitektur Data yang Memungkinkan Sistem Belajar dari 487 Klien Serentak
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              signal: "Signal F1 — Tender alert click-through (positive signal)",
              how: "When a klien clicks on a tender alert and views the detail: the KBLI + region + time-of-click is logged as 'relevant' signal for that klien's personalization model.",
              scale: "487 klien × avg 2.1 alert clicks/day = 1.023 positive signals/day",
              model_impact: "Increases weight of similar KBLI+region combos in that klien's future alert ranking. Aggregate: feeds the cross-klien relevance model (what's popular for J8 Sipil in Jateng).",
              tc: "text-primary"
            },
            {
              signal: "Signal F2 — Alert dismiss without opening (negative signal)",
              how: "WA message delivered but not tapped within 4 hours: soft negative signal. Alert detail page opened then immediately closed (<10 sec): strong negative signal. Both logged per KBLI + region.",
              scale: "487 klien × avg 4.8 unopen alerts/day = 2.342 negative signals/day",
              model_impact: "Reduces future alert frequency for that KBLI category for that klien. At 14 consecutive unopen events: KBLI downgraded to Digest inclusion only (M3 mechanism).",
              tc: "text-orange-700"
            },
            {
              signal: "Signal F3 — Tender submission following an alert (strongest positive signal)",
              how: "Hendra Jr. cross-references LPSE submission data with klien alert history. If a klien submits a tender for a project they received an alert for within 14 days: BINGO — that alert triggered a real-world action.",
              scale: "~340 such events in 2025 (Hendra Jr.'s estimate based on LPSE cross-reference sample)",
              model_impact: "This signal propagates to ALL klien with similar KBLI+jenjang profiles: 'other J8 Sipil klien in Jateng acted on this tender type.' Strongest cross-klien learning signal.",
              tc: "text-emerald-700"
            },
            {
              signal: "Signal F4 — Knowledge asset bookmark (medium positive signal)",
              how: "Klien bookmarks an asset: indicates high perceived relevance. Correlated with later action (43% of bookmarked assets are referenced within 30 days in a deal conversation with Reza).",
              scale: "847 bookmarks added in 2025 across 312 unique assets",
              model_impact: "Bookmarked assets surface more prominently in daily briefing for klien with similar KBLI profiles. Sari reviews highly-bookmarked assets to create follow-on content.",
              tc: "text-blue-700"
            },
            {
              signal: "Signal F5 — NLQ query (Q4 2026+) — richest future signal",
              how: "Every NLQ query is a direct statement of intent. 'Tender irigasi Jatim > Rp 50M sejak Januari 2026' is explicit intelligence about what a klien cares about — richer than any click behavior.",
              scale: "Estimated 800–1.200 NLQ queries/day at steady state post-v1 launch",
              model_impact: "NLQ queries will feed Layer 5 of personalization: 'implicit intent from query history.' This is the future state where MJP knows not just what klien have looked at, but what they're actively searching for.",
              tc: "text-primary"
            },
          ].map((r) => (
            <div key={r.signal} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.signal}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.scale}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.how}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.model_impact}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">5 feedback signals generate 3.400+ learning events/day from 487 klien. This is MJP's data flywheel: more klien → more signals → better personalization → more alert relevance → higher retention → more klien. The flywheel accelerates non-linearly: at 3.000 klien, signals/day increase to ~21.000. Cross-klien learning is the non-obvious part: when one J8 Sipil klien in Jateng acts on a Rp 8M irigasi tender, all 34 similar profile klien receive that signal as a relevance boost. Network effects in a B2B intelligence platform.</p>
      </div>

      {/* AI Hallucination Prevention */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> HALLUCINATION PREVENTION — Pencegahan Halusinasi AI di Platform MJP: 6 Layer Teknis yang Memastikan AI Tidak Memberikan Informasi Tender atau Regulasi yang Salah kepada Klien — Mengapa Ini Tantangan Berbeda dari Platform AI Umum
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Construction procurement is a high-stakes domain — a wrong tender deadline or wrong HPS figure costs klien real money. MJP's 6-layer hallucination prevention system:</p>
          {[
            { layer: "L1 — Retrieval-Augmented Generation (RAG) only — no generative free-form answers", desc: "NLQ never generates an answer without a retrieved source. Every output must cite a specific tender record, regulation text, or knowledge asset in MJP's database. If the database has no relevant source: NLQ responds 'Saya tidak menemukan informasi yang relevan di database kami.' Never a guess.", tc: "text-primary" },
            { layer: "L2 — Tender data freshness gate — refuse to answer about tenders {'>'} 7 days old", desc: "If a klien asks 'masih buka tendernya?' for a tender whose crawl data is {'>'} 7 days old: NLQ says 'Data tender ini belum diperbarui dalam 7 hari — mohon cek langsung di LPSE [source]. Tidak bisa konfirmasi status saat ini.' Prevents confident wrong answers about deadline status.", tc: "text-blue-700" },
            { layer: "L3 — Regulatory text quotation, not paraphrase", desc: "When answering regulatory questions: NLQ quotes the exact text of the relevant clause, then provides a plain-language interpretation clearly labeled as interpretation. 'Bunyi peraturannya: [quote]. Interpretasi kami: [plain language].' Klien see the difference between the law and MJP's reading of the law.", tc: "text-orange-700" },
            { layer: "L4 — HPS figures always include source + date stamp", desc: "Any HPS figure cited in an NLQ answer includes: source LPSE, tender ID, and crawl date. 'HPS ini berasal dari LPSE [X], Tender ID [Y], diperbarui [date].' Prevents klien from using historical HPS as current market data without realizing it's dated.", tc: "text-emerald-700" },
            { layer: "L5 — Confidence score with every non-factual answer", desc: "For interpretive or estimative answers (e.g. 'apakah nilai penawaran saya kompetitif?'): NLQ always shows a confidence score (HIGH/MEDIUM/LOW) based on how many data points support the estimate. LOW confidence: explicit recommendation to verify with Sari or Dewi before acting.", tc: "text-muted-foreground" },
            { layer: "L6 — Sari validation of NLQ regulatory answers (weekly audit)", desc: "Every week: Hendra Jr. exports all NLQ regulatory queries. Sari reviews a random 20-query sample. If any answer is inaccurate or misleading: (1) Answer flagged and suppressed, (2) RAG knowledge base updated with correct information, (3) Model prompted adjusted. In beta phase: 4 such corrections in 6 weeks of testing.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.layer} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.layer}</p>
              <p className="text-[7px] text-muted-foreground">{r.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Hallucination prevention is the hardest engineering problem in MJP's AI roadmap. General-purpose LLMs (GPT-4o, Claude) are trained to be helpful — they will confidently answer questions even when they shouldn't. In a construction intelligence context: confident wrong answers are worse than no answer. Hendra's design principle: 'I'd rather our AI say 'I don't know' 100 times than say something wrong once about a Rp 500M tender.' The 6 layers make the system conservative by design. As the knowledge base grows (more tender records, more regulatory documents), RAG precision improves and the 'I don't know' rate decreases naturally — through data, not through lowering the bar.</p>
      </div>

      {/* MJP-LLM: The In-House Model Vision */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-primary" /> MJP-LLM VISION — Visi Model Bahasa In-House MJP: Mengapa Hendra Berencana Membangun Model AI Sendiri pada 2028 — Apa yang Membedakannya dari GPT-4o, Berapa Biayanya, dan Apa yang Harus Terjadi Dulu Sebelum Itu Masuk Akal
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              aspect: "What MJP-LLM is (and isn't)",
              detail: "Not a general-purpose LLM. A fine-tuned domain-specific model trained exclusively on: (1) Indonesian construction procurement text (LPSE documents, LPJK regulations, BUJK profiles), (2) MJP's knowledge registry corpus (1.247+ annotated assets), (3) NLQ query-response pairs generated from real klien queries (v1 logs from Q4 2026+).",
              advantage: "Result: a model that 'speaks BUJK language' — understands KBLI codes, jenjang hierarchy, SBU categories, HPS terminology, and Indonesian government procurement jargon without requiring prompt engineering workarounds. GPT-4o requires elaborate system prompts to understand this domain. MJP-LLM would understand it natively.",
              tc: "text-primary"
            },
            {
              aspect: "Why build it instead of just using GPT-4o forever",
              detail: "4 reasons: (1) Cost: at 3.000 klien, GPT-4o API cost reaches Rp 8–11jt/month. MJP-LLM (self-hosted) reduces this to Rp 2–3jt/month (compute only). (2) Latency: self-hosted model can achieve < 300ms response time. GPT-4o API: 1–3 seconds. (3) Data control: sensitive klien query data never leaves MJP's infrastructure. (4) Domain precision: fine-tuned model will have < 5% hallucination rate on construction domain (vs. ~18% for GPT-4o on the same domain in testing).",
              advantage: "ROI on model training investment: Rp 80–120jt one-time training cost → saves Rp 6–9jt/month in API costs → payback in 12–18 months. Plus the latency and precision advantages accrue immediately.",
              tc: "text-blue-700"
            },
            {
              aspect: "What must happen before MJP-LLM makes sense",
              detail: "Prerequisites (Hendra's checklist): (1) NLQ v1 live and generating real query logs (Q4 2026 target — logs needed as training data), (2) Knowledge registry at 2.000+ assets (training corpus density), (3) H2 backend engineer hired (who has ML infrastructure experience), (4) Series A closed (training cost funded), (5) 18 months of NLQ query-response pairs accumulated (minimum for fine-tuning that outperforms general model).",
              advantage: "Earliest realistic MJP-LLM training start: Q2 2028. First deployment: Q4 2028. Hendra: 'We're laying the data foundation now. Every NLQ query logged in 2027 is training data for the 2028 model. The foundation is more important than the timeline.'",
              tc: "text-orange-700"
            },
            {
              aspect: "MJP-LLM as competitive moat (the deep future)",
              detail: "A BUJK-specific LLM trained on MJP's data is not reproducible by a competitor who doesn't have MJP's data. It's the deepest possible moat: not just 'we have more data' but 'we have a model trained on data that only we have.' External AI companies cannot replicate it without access to MJP's knowledge registry, BUJK behavioral data, and NLQ query logs — all of which are proprietary.",
              advantage: "By 2029 projection: MJP-LLM powers NLQ v2 (Document Intelligence), the Alert Personalization v2 model, and the Trust Score algorithm. Three major product features powered by a proprietary model. No competitor can offer equivalent intelligence without equivalent data history — which they don't have.",
              tc: "text-emerald-700"
            },
          ].map((r) => (
            <div key={r.aspect} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.aspect}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.advantage}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">MJP-LLM is Hendra's most ambitious long-term technical vision. He discusses it openly with Series A investors as the 2028+ differentiation story: 'By the time our competitors understand they need a domain-specific model, we'll have been training ours for 2 years on data they don't have.' The vision is credible because the prerequisites are already being built: the NLQ v1 logging infrastructure, the knowledge registry density, the crawler volume. MJP-LLM is not a pivot — it's the natural destination of 4 years of data accumulation. Hendra Jr.: 'I've been thinking about MJP-LLM since I joined. Every architecture decision I've made has left the door open for it. We're not starting from scratch in 2028. We're arriving at the destination.'</p>
      </div>

      {/* R96: AI Governance & Ethics Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> AI GOVERNANCE {"&"} ETHICS FRAMEWORK — Prinsip, Batasan, dan Tanggung Jawab yang Mengatur Penggunaan AI di MJP: Apa yang Boleh AI Putuskan, Apa yang Harus Tetap Manusia, dan Mengapa Ini Penting untuk Kepercayaan Klien
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              principle: "P1: AI sebagai asisten, bukan pengambil keputusan",
              rule: "Tidak ada keputusan yang mempengaruhi klien secara langsung yang dibuat oleh AI tanpa human review. AI menyarankan — manusia memutuskan.",
              examples: "AI boleh: rank tender berdasarkan relevance. AI tidak boleh: otomatis kirim notifikasi ke klien tanpa Sari atau Hendra Jr. review. Exception: alert tier 1 (SKK expiry, blacklist update) — sudah structured enough untuk auto-send.",
              tc: "text-primary"
            },
            {
              principle: "P2: Explainability wajib untuk rekomendasi yang berdampak finansial",
              rule: "Setiap rekomendasi AI yang berimplikasi finansial (HPS estimate, win probability, ROI calculation) harus disertai dengan explanation yang dapat divalidasi klien.",
              examples: "HPS estimate tidak hanya tampilkan angka — tampilkan: sumber data (X tender sejenis), confidence interval, dan disclaimer. Klien yang membuat keputusan bid berdasarkan AI recommendation harus tahu basis kalkulasinya.",
              tc: "text-blue-700"
            },
            {
              principle: "P3: Data klien tidak digunakan untuk train model tanpa consent eksplisit",
              rule: "Behavioral data klien (search pattern, click history, tender favorit) digunakan untuk personalization — tapi tidak di-aggregate untuk train model yang akan digunakan klien lain.",
              examples: "MJP's NLQ model dilatih dari anonymized tender database publik, bukan dari klien-specific query logs. Exception jika klien opt-in: Enterprise klien bisa share query logs untuk 'custom model' — in roadmap, tidak live.",
              tc: "text-emerald-700"
            },
            {
              principle: "P4: Bias monitoring untuk rekomendasi regional dan BUJK grade",
              rule: "AI rekomendasi harus di-audit untuk bias geografis dan grade bias secara quarterly. Jika algoritma consistently under-serve BUJK dari region tertentu, itu adalah bug, bukan feature.",
              examples: "Q1 2026 audit: AI tender recommendation over-indexed untuk BUJK di Jawa vs Luar Jawa. Root cause: training data LPSE Jawa lebih banyak. Fix: regional normalization weight. Bias audit sekarang wajib per quarter.",
              tc: "text-orange-700"
            },
          ].map((r) => (
            <div key={r.principle} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.principle}</p>
              <p className="text-[7px] font-mono text-muted-foreground mb-0.5">Rule: {r.rule}</p>
              <p className={`text-[7px] ${r.tc}`}>Application: {r.examples}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2 bg-muted/30 mt-2">
            <p className="text-[8px] font-bold text-primary mb-1">Governance Owner dan Review Cadence</p>
            <p className="text-[7px] text-muted-foreground">Hendra: overall governance ownership. Hendra Jr.: technical implementation dan bias audits. Sari: content accuracy review untuk AI-generated summaries. Review cadence: quarterly for bias audits, annually for framework update. External review: planned untuk pre-Series A (Q4 2026) — Hendra ingin independent AI ethics advisor review framework sebelum investor due diligence.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">AI governance framework MJP lahir dari satu insiden: Q3 2024, NLQ prototype merekomendasikan tender yang ternyata sudah di-cancel 3 hari sebelumnya karena stale data. Klien Enterprise submit pertanyaan ke panitia berdasarkan recommendation ini — dan panitia surprised karena tender tidak ada. Klien embarrassed, Hendra menerima complaint call. Insiden ini tidak berdampak finansial tapi menyebabkan reputational risk. Post-incident: Hendra Jr. membangun freshness gate (tidak recommend tender dari data lebih dari 24 jam). Hendra memformalisasi governance framework. Hendra: 'Kita menggunakan AI di industri di mana satu kesalahan bisa biaya kontraktor miliaran rupiah. Kepercayaan klien terhadap AI recommendation adalah aset yang paling fragile dan paling berharga yang kita miliki.'</p>
      </div>

      {/* R97: NLQ v1 Query Analytics */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-primary" /> NLQ v1 QUERY ANALYTICS — Top 20 Jenis Pertanyaan yang Paling Sering Diajukan ke Platform AI MJP, Mana yang Dijawab dengan Baik, Mana yang Gagal, dan Bagaimana Query Log Membentuk Roadmap NLQ v2
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] font-bold text-primary mb-1">TOP QUERY CATEGORIES (dari 3.847 NLQ sessions sejak launch)</p>
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Query Category</th>
                  <th className="p-1 text-center">% of sessions</th>
                  <th className="p-1 text-center">Satisfaction rate</th>
                  <th className="p-1 text-center">NLQ handles?</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["'Tender apa saja yang cocok untuk BUJK saya?'", "31%", "84%", "YES — core use case"],
                  ["'Siapa saja kompetitor untuk tender X?'", "18%", "79%", "YES — BUJK + bid history"],
                  ["'Berapa estimasi HPS untuk tender Y?'", "14%", "61%", "PARTIAL — accuracy caveat"],
                  ["'SKK apa yang harus saya renew bulan ini?'", "11%", "92%", "YES — high confidence"],
                  ["'Regulasi apa yang berubah minggu ini?'", "9%", "88%", "YES — Sari's digest"],
                  ["'Bagaimana cara daftar ke LSP Z?'", "7%", "43%", "POOR — procedural detail"],
                  ["'Apakah BUJK X terpercaya?'", "6%", "71%", "PARTIAL — Trust Score only"],
                  ["'Tender IKN yang terbuka sekarang apa?'", "4%", "96%", "YES — real-time data"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold text-[7px]">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className={`p-1 text-center font-bold ${parseInt(row[2]) >= 85 ? "text-emerald-700" : parseInt(row[2]) >= 70 ? "text-orange-700" : "text-red-700"}`}>{row[2]}</td>
                    <td className={`p-1 text-[7px] font-bold ${row[3].startsWith("YES") ? "text-emerald-700" : row[3].startsWith("PARTIAL") ? "text-orange-700" : "text-red-700"}`}>{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {[
            { insight: "Procedural queries (43% satisfaction): biggest NLQ v1 gap", detail: "7% of queries ask 'bagaimana cara...' — step-by-step procedural guidance. NLQ v1 tidak didesain untuk ini: retrieves information, bukan generates procedures. Fix in NLQ v2: procedural query classifier yang routes to Sari's how-to knowledge assets instead of database retrieval. Expected satisfaction uplift: 43% → 78%.", tc: "text-red-700" },
            { insight: "IKN queries: 96% satisfaction — best performing query type", detail: "IKN queries work so well because: (1) real-time LPSE Kaltim crawler running every 2 hours. (2) Sari has 47 IKN-specific knowledge assets. (3) Query is highly specific and structured. This is the template for other high-performance query categories.", tc: "text-emerald-700" },
            { insight: "Query log as product roadmap: 3.847 sessions = 3.847 product requirements", detail: "Every query NLQ handles poorly is a roadmap item. Every query NLQ refuses is a feature gap. Hendra Jr. reviews query logs monthly — top 10 failed queries per month become NLQ improvement backlog. This approach ensures product development is driven by actual klien needs, not assumptions.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.insight} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.insight}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">NLQ v1 Query Analytics adalah salah satu data pipeline paling valuable yang Hendra Jr. build, meskipun bukan yang paling visible. Setiap query logged: text, timestamp, klien tier, session duration, satisfaction signal (thumb up/down atau re-query within 30 seconds = implicit dissatisfaction). 3.847 sessions dalam 6 bulan pertama melampaui Hendra's projection (ekspektasi: 1.500 sessions). Adoption driver: Reza demo-ing NLQ dalam setiap Enterprise pitch — 'tanya apapun tentang tender, coba sekarang.' 94% of Enterprise klien yang see demo mencoba NLQ dalam demo session. 71% continue using NLQ dalam 30 hari pertama. NLQ adoption jadi retention predictor — Enterprise klien yang menggunakan NLQ secara reguler memiliki churn rate 0.4% vs 1.8% non-NLQ Enterprise. Query analytics adalah the data Hendra Jr. needs to make NLQ v1 good enough that klien don't want to live without it.</p>
      </div>

      {/* R98: AI Recommendation Confidence Calibration */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RotateCcw className="h-3.5 w-3.5 text-primary" /> AI RECOMMENDATION CONFIDENCE CALIBRATION — Bagaimana MJP Mengkomunikasikan Ketidakpastian AI: 4 Confidence Level, Kapan Masing-Masing Digunakan, dan Mengapa Under-Confidence adalah Strategi yang Lebih Baik daripada Over-Confidence
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { level: "HIGH CONFIDENCE (> 85%)", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", when: "Tender yang sesuai dengan KBLI profil klien, SKK expiry alerts (berdasarkan hard data BNSP), blacklist status, tenders dari LPSE yang sering klien menang.", display: "No confidence badge shown — recommendation presented as matter-of-fact. Klien trust is high enough that confidence disclaimer would feel unnecessary.", risk: "False confidence possible for edge cases (new KBLI categories). Mitigated by data threshold requirement." },
            { level: "MEDIUM CONFIDENCE (60–85%)", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", when: "HPS estimates, competitor positioning analysis, tender likelihood scores (win probability). Data exists but has uncertainty.", display: "Yellow indicator + tooltip: 'Berdasarkan X data points historis. Verifikasi dengan market data sebelum keputusan akhir.'", risk: "Klien may anchor too strongly on estimate. Mitigation: always show confidence range (Rp X – Y), never single point." },
            { level: "LOW CONFIDENCE (40–60%)", color: "text-orange-700", bg: "bg-orange-50 border-orange-200", when: "Baru 5-10 data points, kategori yang jarang, region yang under-represented dalam training data.", display: "Orange indicator + explicit text: 'Data terbatas untuk kategori ini. Gunakan sebagai petunjuk awal saja.' Recommendation still shown but clearly caveated.", risk: "Some klien ignore caveats and treat as high confidence. UX fix in progress: low confidence recommendations will be visually more subdued." },
            { level: "INSUFFICIENT DATA — No recommendation", color: "text-red-700", bg: "bg-red-50 border-red-200", when: "<5 data points, completely new category/region, or data is > 6 months stale without reconfirmation.", display: "No AI estimate shown. 'Tidak cukup data historis — lihat referensi manual di Knowledge Registry.' Direct link to relevant asset.", risk: "Frustration when klien expects estimate and gets none. Counterintuitively: this behavior builds more long-term trust than showing a low-quality estimate." },
          ].map((r) => (
            <div key={r.level} className={`border rounded-sm p-2 mb-1 ${r.bg}`}>
              <p className={`text-[8px] font-bold ${r.color} mb-0.5`}>{r.level}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">When: {r.when}</p>
              <p className={`text-[7px] font-mono ${r.color} mb-0.5`}>Display: {r.display}</p>
              <p className="text-[7px] text-muted-foreground italic">Risk: {r.risk}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Confidence calibration adalah satu dari keputusan paling penting yang MJP telah buat dalam AI design. The temptation: always show a number, even if unreliable — because 'no answer' feels like platform failure. The reality: showing 'Insufficient Data' is the most honest thing a platform can do, and clients who have been burned by overconfident AI elsewhere actually appreciate it. MJP's guiding principle dari Hendra: 'AI yang terlalu percaya diri adalah AI yang berbohong. Klien kita membuat keputusan bernilai miliaran rupiah berdasarkan platform kita. Mereka berhak tahu seberapa yakin kita dengan setiap angka yang kita tampilkan.' Under-confidence is recoverable. Over-confidence that leads to a wrong bid decision is not.</p>
      </div>

      {/* R99: AI Training Data Pipeline */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-primary" /> AI TRAINING DATA PIPELINE — Bagaimana MJP Terus-Menerus Meningkatkan Kualitas AI dengan Proprietary Training Data: 5 Data Streams, Volume per Bulan, dan Keunggulan yang Tidak Bisa Direplikasi Kompetitor
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { stream: "DS-1: NLQ query-response-feedback pairs", volume: "~3.400 pairs/bulan", value: "Ground truth untuk NLQ improvement: query + AI response + klien satisfaction signal (thumb up/down, re-query). Each thumb-down with re-query = implicit label that first response was wrong. Labeled dataset growing at 3.400 pairs/month is unusual for vertical B2B AI.", uniqueness: "Competitor tanpa NLQ feature cannot collect this dataset. 18 months of NLQ = ~61.000 pairs by Q4 2026.", tc: "text-primary" },
            { stream: "DS-2: Tender outcome labels (win/loss/cancel per BUJK per tender)", volume: "~2.100 labels/bulan (estimated, partial)", value: "Ground truth untuk win probability model. Partial because MJP only knows outcome for klien who report back or where LPSE publishes winner data. Completeness: ~38% of tenders we monitor.", uniqueness: "This is the most valuable dataset in Indonesian construction intelligence. If MJP reaches 70%+ completeness: win probability model accuracy becomes impossible to replicate without years of data collection.", tc: "text-blue-700" },
            { stream: "DS-3: Regulatory interpretation corrections (Sari's edits to AI drafts)", volume: "~80 corrections/bulan", value: "Sari now reviews AI-drafted regulatory summaries before publication (v2 workflow). Her corrections are labeled data: AI draft + expert correction = high-quality training pair for regulatory NLU.", uniqueness: "Expert regulatory annotation at 80 corrections/month is significant. It would cost Rp 8–15jt/month to source equivalently from external annotators.", tc: "text-emerald-700" },
            { stream: "DS-4: Field interview transcripts (Budi's structured data)", volume: "~4–6 interviews/bulan", value: "Rich qualitative data about BUJK pain, behavior, and language. Used for: (1) NLQ query intent training — how do BUJK actually ask questions? (2) Alert relevance model — what context do BUJK consider when evaluating if an alert is relevant?", uniqueness: "Cannot be scraped, purchased, or replicated without field presence. MJP's field research program is a data collection program as much as a research program.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.stream} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.stream}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.volume}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.value}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Uniqueness: {r.uniqueness}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">AI training data pipeline adalah MJP's deepest moat argument untuk Series A investors. The narrative: MJP's AI will continue improving independent of any LLM advancement because our proprietary training data grows every day with usage. Competitor yang build tomorrow dengan same LLM stack would start with zero labeled data — MJP starts with 3+ years of construction-specific labeled pairs. Hendra Jr.: 'Kompetitor bisa hire lebih banyak engineer dari kita. Tapi mereka tidak bisa retroactively collect 3 tahun interaksi klien konstruksi Indonesia. Data moat ini adalah compound advantage — semakin lama platform ini ada, semakin jauh kita di depan dalam data quality.' The flip side: this data is only valuable if MJP uses it — Hendra Jr.'s Q3 2026 OKR is to build the fine-tuning pipeline that consumes all 4 data streams into monthly model updates.</p>
      </div>

      {/* R100: AI Recommendation Audit Trail */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ClipboardCheck className="h-3.5 w-3.5 text-primary" /> AI RECOMMENDATION AUDIT TRAIL — Mengapa Setiap Rekomendasi AI yang MJP Berikan Dicatat Lengkap: Arsitektur Audit Log, Apa yang Disimpan, dan Bagaimana Log Ini Melindungi Klien dan MJP dari Kesalahan yang Tidak Disadari
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { field: "Logged field 1: recommendation_id + timestamp + klien_id (anonymized)", purpose: "Basic audit trail: every recommendation is uniquely identified and timestamped. klien_id anonymized for privacy — only Hendra Jr. can de-anonymize with audit access key. Volume: ~34.000 recommendations logged per month.", privacy: "GDPR and UU PDP compliant: klien_id stored as hashed value, not raw identifier. De-anonymization requires additional authentication step.", tc: "text-primary" },
            { field: "Logged field 2: input_data_snapshot (what data was used to generate recommendation)", purpose: "At time of recommendation: snapshot of tender data, BUJK profile, SKK status that was fed to algorithm. Enables retroactive analysis: 'Was the data that led to this recommendation accurate at that time?' Critical for post-hoc debugging when klien reports a wrong recommendation.", privacy: "Data snapshot does not contain PII — only construction domain data (tender ID, KBLI codes, SKK jenjang). Stored 12 months, then archived.", tc: "text-blue-700" },
            { field: "Logged field 3: model_version + confidence_level + reasoning_path", purpose: "Which model version generated recommendation, what confidence tier was assigned, and the rule path that led to the output. If model is updated: older recommendations can be re-evaluated against new model to check if they would change. Crucial for: model quality regression testing.", privacy: "Internal-only log — not exposed to klien. Model reasoning path is proprietary.", tc: "text-emerald-700" },
            { field: "Logged field 4: klien_action_taken (did klien follow recommendation?)", purpose: "Behavioral outcome tracking: when a tender recommendation is shown, does klien view it? Bid on it? Win it? Provides ground truth for recommendation quality evaluation beyond just satisfaction survey. 47% of recommendations result in klien action within 72 hours.", privacy: "Aggregated for model training, individual actions not surfaced except in Enterprise reporting.", tc: "text-orange-700" },
            { field: "Logged field 5: klien_feedback (thumbs up/down + optional reason)", purpose: "Explicit satisfaction signal. Combined with implicit behavioral signal (field 4) for richer quality picture. 23% of recommendations receive explicit feedback. Negative feedback + no action = strongest negative training signal for model improvement.", privacy: "Free-text feedback stored and reviewed by Hendra Jr. quarterly for qualitative themes. Not indexed for AI training without human review first.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.field} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.field}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Purpose: {r.purpose}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Privacy: {r.privacy}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">AI recommendation audit log adalah keputusan arsitektur Hendra Jr. yang Hendra initially considered 'over-engineering for our size.' Hendra Jr.'s argument: 'Audit log sekarang costs us Rp 2jt/month in storage. But if we get one klien complaint about a wrong AI recommendation that affected a major bid decision — audit log adalah yang membedakan antara 'maaf kami tidak tahu apa yang terjadi' dan 'berikut analysis lengkap tentang apa yang terjadi, kapan, dan mengapa.' For B2B software where clients make Rp billions decisions: audit trail is not nice-to-have.' After hearing this argument: Hendra agreed and expanded audit log scope. 18 months later: first formal Enterprise audit request was received — a large BUJK group wanted to verify their recommendation history as part of internal audit. Audit log delivered complete, accurate response in 2 days. Client renewed Enterprise plan for 2 more years the following week. Hendra Jr.: 'Rp 2jt/month investment returned 24-month Enterprise renewal. That's the calculus of operational excellence.'</p>
      </div>

      {/* R101: AI Model Quality Metrics */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> AI MODEL QUALITY METRICS — Bagaimana MJP Mengukur Apakah AI-nya Benar-benar Bagus: 5 Metrics yang Dipantau Setiap Bulan, Target 2026, dan Riwayat Improvement dari V1 hingga Saat Ini
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Metric</th>
                  <th className="p-1 text-center">V1 (2023)</th>
                  <th className="p-1 text-center">Current (2026)</th>
                  <th className="p-1 text-center">Target 2026</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Tender relevance precision (rec. that klien act on)", "41%", "63%", "70%", "text-primary"],
                  ["NLQ answer accuracy (expert-validated sample)", "58%", "82%", "88%", "text-emerald-700"],
                  ["HPS estimate accuracy (within ±10% of actual HPS)", "61%", "78%", "85%", "text-blue-700"],
                  ["Explainability score (klien understand why recommended)", "N/A", "71%", "80%", "text-orange-700"],
                  ["Hallucination rate for NLQ (factually wrong answers)", "N/A", "3.2%", "<1%", "text-red-700"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold text-[7px]">{row[0]}</td>
                    <td className="p-1 text-center text-[7px] text-muted-foreground">{row[1]}</td>
                    <td className={`p-1 text-center text-[7px] font-bold ${row[4]}`}>{row[2]}</td>
                    <td className={`p-1 text-center text-[7px] ${row[4]}`}>{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {[
            { insight: "Hallucination rate 3.2%: the highest priority fix for Q3 2026", detail: "3.2% of NLQ answers contain factually incorrect information that Sari catches in her manual review sample. At 3.847 NLQ sessions in the first 6 months: ~123 sessions may have received wrong information. Each wrong answer is a trust breach. Hendra Jr.'s hallucination reduction plan: (1) add retrieval augmentation that forces answers to cite Knowledge Registry assets, (2) add factual consistency check against source documents, (3) lower confidence threshold for NLQ answers that can't cite a source.", tc: "text-red-700" },
            { insight: "Tender relevance precision improvement: most impactful metric for klien retention", detail: "From 41% (2023) to 63% (2026): +22pp improvement in 3 years. Each percentage point improvement = klien receives fewer irrelevant alerts = lower fatigue. Primary driver: improved KBLI matching algorithm (2024) that maps BUJK's specialization more precisely to tender requirements. Remaining 37% precision gap: mostly from ambiguous tender descriptions that even human evaluators can't reliably classify.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.insight} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.insight}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">AI quality metrics dashboard adalah Hendra Jr.'s monthly ritual — first Monday of every month: pull all 5 metrics, compare vs prior month, note trend, identify top-1 improvement opportunity. Monthly report sent to Hendra. This cadence has driven consistent, measurable AI quality improvement every quarter since 2023. The discipline: don't ship AI improvements without measuring impact on these metrics first. Before metrics dashboard: AI changes were deployed based on Hendra Jr.'s engineering intuition. Two changes were deployed that actually decreased precision (caught and rolled back only after klien complaints, 2 weeks later). With metrics: each change is A/B tested and metrics verified before full rollout. Hendra Jr.: 'AI tanpa measurement adalah art project. AI dengan measurement adalah engineering. Kita harus jadi engineer tentang AI kita sendiri.'</p>
      </div>

      {/* R102: AI Recommendation Failure Modes */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-primary" /> AI RECOMMENDATION FAILURE MODES — 5 Cara AI MJP Bisa Memberikan Rekomendasi yang Buruk: Root Causes, Frekuensi Aktual, dan Mitigasi yang Sudah Dibangun — Kejujuran tentang Keterbatasan AI yang MJP Punya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { mode: "FM-1: KBLI drift — recommending tenders outside BUJK's true capability", freq: "~2.1% of recommendations", cause: "BUJK that has historically bid on adjacent KBLIs (sometimes winning) gets recommended those adjacents. AI learns from bidding history, not from capability assessment. If bidding history includes accidental wins in adjacent categories: AI drifts toward those.", mitigation: "KBLI drift detection: any recommendation outside klien's registered KBLI set triggers confidence penalty. Klien can explicitly flag recommendations as 'outside my capability' — feeds back into personalization.", tc: "text-orange-700" },
            { mode: "FM-2: Recency bias — over-weighting recent tender activity patterns", freq: "Measurable in post-IKN surge (Aug 2024): 34% of Jakarta BUJK over-recommended IKN tenders", cause: "AI trained on historical win/loss data. When IKN tender volume surged in 2024, AI model saw recent patterns dominate historical patterns. Result: IKN recommendations flooded even for BUJK with zero IKN experience.", mitigation: "Recency weighting capped at 30% of recommendation score. Historical 24-month pattern minimum 70% weight. IKN-specific adjustments added: require IKN-adjacent experience before IKN tenders recommended.", tc: "text-red-700" },
            { mode: "FM-3: HPS estimation error for novel project types", freq: "~12% error rate for non-standard KBLI combinations", cause: "HPS estimation model trained on historical tender data. Novel project types (new IKN smart infrastructure categories, offshore MEP) have insufficient training samples. Model extrapolates poorly.", mitigation: "Confidence interval shown for HPS estimates. Novel category detected: model shows 'WIDE RANGE — limited historical data' warning. Sari manually adds HPS reference data for new categories from industry sources.", tc: "text-blue-700" },
            { mode: "FM-4: NLQ hallucination — confident wrong answers", freq: "3.2% of NLQ responses (priority for reduction)", cause: "LLM-based NLQ generates fluent, confident-sounding text. When knowledge gap exists: LLM may generate plausible but incorrect regulatory citations or technical specifications.", mitigation: "Retrieval augmentation: NLQ must cite a Knowledge Registry source for factual claims. If no source found: response includes 'Sumber tidak ditemukan — verifikasi manual disarankan.' Sari reviews flagged non-sourced responses weekly.", tc: "text-red-700" },
            { mode: "FM-5: Cold start problem — new klien gets generic recommendations for first 30 days", freq: "Affects all new klien for 30-day personalization warmup period", cause: "AI model requires behavioral data (which tenders opened, which alerts dismissed, which Knowledge Registry articles accessed) to personalize. New klien: no behavioral data.", mitigation: "30-day warmup uses KBLI + region + kualifikasi profile only (rules-based). After 30 days with sufficient interaction: AI personalization activates. Klien is informed of warmup period in onboarding.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.mode} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.mode}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.freq}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Cause: {r.cause}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Mitigation: {r.mitigation}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">AI failure mode documentation adalah Hendra Jr.'s radical transparency project — he believes MJP should understand and document its AI failures as rigorously as its AI successes. The audience: internal team (so they can answer klien questions honestly), enterprise klien during onboarding (so their expectations are calibrated), and Hendra (for Series A investor conversations about AI risk management). 'We know what can go wrong and we have mitigations' is a more defensible position than 'our AI is highly accurate.' FM-4 (hallucination) and FM-2 (recency bias) are the two highest-priority items for 2026. Hendra Jr.: 'AI yang kita bangun adalah probabilistic, bukan deterministic. Ini bukan kelemahan — ini adalah sifat AI. Kelemahan sejatinya adalah tidak memahami dan mengkomunikasikan keterbatasan ini kepada klien yang membuat keputusan bisnis berdasarkan output AI kita.'</p>
      </div>

      {/* R103: NLQ (Natural Language Query) Design Philosophy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-primary" /> NLQ DESIGN PHILOSOPHY — Mengapa MJP Memilih Natural Language Query sebagai Interface Utama AI: 4 Design Principles, Apa yang NLQ Bisa dan Tidak Bisa Dilakukan, dan Bagaimana Sari Menjadi Co-Designer Sistem yang Dia Bukan Engineer-nya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { principle: "DP-1: Meet klien where they already communicate — bahasa Indonesia informal", detail: "BUJK owners don't write formal SQL queries. They ask questions the way they'd ask a colleague: 'Apa syarat K3 untuk proyek gedung di atas 8 lantai?' NLQ is designed to understand this register. Training data includes: formal Indonesian (from regulations), informal Indonesian (from pain point interviews), and construction industry jargon (from Budi's glossary). The three-way training makes NLQ functional across different user communication styles.", hendra_jr: "Biggest NLQ engineering challenge: construction jargon has significant regional variation. 'Aanwijzing' (formal), 'rapat penjelasan' (informal), 'pen-penjelasan' (Javanese abbreviation) — all mean the same thing. NLQ must understand all.", tc: "text-primary" },
            { principle: "DP-2: Show sources, not just answers — enforce citation discipline", detail: "Every NLQ answer displays: the Knowledge Registry asset(s) it drew from, the specific regulation it's based on, and last-updated date of the source. Purpose: klien can verify, Sari can monitor citation quality, and hallucinations become visible (no source = suspect answer). Design principle: NLQ is a guide to knowledge, not a substitute for it.", hendra_jr: "Sari was the one who insisted on citation display. 'Jika AI tidak bisa show sumber, jangan show answer. Klien perlu tahu dari mana ini datang.' This was a UX debate — Hendra Jr. wanted clean single-line answers. Sari won. Retention data proved Sari right: cited answers have higher 'helpful' rating.", tc: "text-blue-700" },
            { principle: "DP-3: Graceful degradation — NLQ knows what it doesn't know", detail: "When NLQ confidence is low (< 0.6 confidence score): response changes from direct answer to 'This question may require specialized expertise. Here are the most relevant Knowledge Registry assets for you to explore.' Low-confidence responses are not suppressed (that would hide the gap) but they're clearly labeled EXPLORE vs ANSWER.", hendra_jr: "Low-confidence rate: 12% of all NLQ queries. These 12% are most often: very new topics not yet in Knowledge Registry (IKN-specific new regulations), highly technical structural engineering questions (outside Sari's scope), and legal interpretation questions that require a lawyer.", tc: "text-emerald-700" },
            { principle: "DP-4: Sari as co-designer through feedback loop", detail: "Weekly: Hendra Jr. sends Sari top 20 NLQ queries that returned low-confidence or user-downvoted responses. Sari reviews: does the Knowledge Registry have the information? If yes: NLQ retrieval issue (Hendra Jr.'s problem). If no: Knowledge Registry gap (Sari's next production priority). This feedback loop makes NLQ quality and Knowledge Registry coverage co-evolve.", hendra_jr: "Sari's feedback has driven 34 new Knowledge Registry assets in 2025–2026 — all triggered by NLQ coverage gaps. Sari: 'NLQ mengajarkan saya apa yang klien sebenarnya ingin tahu tapi belum pernah langsung tanyakan ke saya. Ini adalah market research tool yang berjalan di background sepanjang waktu.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.principle} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.principle}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Hendra Jr.: {r.hendra_jr}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">NLQ design philosophy adalah salah satu MJP's clearest examples of interdisciplinary product design — Hendra Jr. (engineer) and Sari (domain expert) co-designing a system where technical capability and content quality are equally critical. Hendra Jr. cannot build an accurate NLQ without Sari's Knowledge Registry. Sari cannot know what to prioritize in Knowledge Registry without NLQ's query data. The mutual dependency creates a collaborative relationship that has become one of MJP's organizational strengths. External observer view: 'MJP has an AI Q&A system.' Internal reality: 'Hendra Jr. and Sari run a continuous improvement loop where each makes the other's work more valuable.' NLQ accuracy has improved from 58% (2023) to 82% (2026) — a 24pp improvement driven almost entirely by this feedback loop, not by model upgrades. Hendra: 'AI yang terbaik yang kita punya adalah collaboration antara Hendra Jr. yang build sistem dan Sari yang mengisi sistem dengan knowledge. Teknologinya penting. Orang yang mengisi teknologi itu: lebih penting.'</p>
      </div>

      {/* R104: AI Roadmap — From Current State to 2028 */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> AI ROADMAP 2026–2028 — Dari NLQ dan Rekomendasi Tender ke Predictive Intelligence: 4 AI Capabilities yang Akan Dibangun, Prasyarat Data yang Harus Disiapkan Sekarang, dan Mengapa AI Journey MJP Adalah Multi-year Commitment
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { cap: "AI-CAP-1 (Current): NLQ + Tender recommendation + HPS estimation", status: "LIVE — continuously improving", detail: "Current AI serves: reactive intelligence (answer questions when asked) and alert personalization (surface relevant tenders). Accuracy improving quarterly. No predictive capability yet — all AI is retrospective (based on historical data) not prospective (predicting future outcomes).", data_requirement: "Required for current: Knowledge Registry (existing), 671 LPSE historical data (existing), klien interaction data (existing). Current data is sufficient for current capabilities.", tc: "text-primary" },
            { cap: "AI-CAP-2 (Q3 2026–Q1 2027): Bid outcome prediction — 'Should I bid on this tender?'", status: "IN DEVELOPMENT — F5 Win-Probability feature is prototype", detail: "Move from 'here are relevant tenders' to 'here is the probability you'll win this tender based on your profile vs historical winners.' Requires: training data with actual bid outcomes (tender X: BUJK Y bid at Rp Z and won/lost). Building labeled training dataset: started Q1 2026. Target dataset size: 50.000 labeled bid outcomes before model training.", data_requirement: "Need: Hendra Jr. to cross-reference LPSE award data with BUJK profiles to create labeled dataset. Estimated: 6 months of data engineering before training.", tc: "text-blue-700" },
            { cap: "AI-CAP-3 (Q2–Q4 2027): Regulatory impact forecasting", status: "CONCEPT — depends on LKPP partnership progress", detail: "Given: new regulation published today. Predict: how will this regulation change tender volumes and requirements in next 6 months? This requires: historical regulatory-to-market correlation analysis (which regulation changes correlated with which tender volume changes). Data: MJP has 5 years of parallel data (regulations + tender volumes). Model: time-series correlation analysis.", data_requirement: "Data exists — but needs to be formatted for training. Sari's regulatory change log + Hendra Jr.'s tender volume data need to be combined into time-series dataset. 3 months of data engineering.", tc: "text-emerald-700" },
            { cap: "AI-CAP-4 (2028): JO matching active recommendation — 'Find your best consortium partner'", status: "VISION — requires Trust Score V5 + PUPR e-monitoring data", detail: "Given: BUJK A wants to bid on IKN tender that requires Kualifikasi Besar in 3 KBLI categories. AI finds: BUJK B has complementary strengths, Trust Score 84+, no financial red flags, active in same region. AI recommends: 'Consider approaching BUJK B for JO — here is why and here is their Trust Score profile.' This is Vision 2028 capability.", data_requirement: "Requires: Trust Score V5 (outcome-based, not rule-based), PUPR e-monitoring integration (track record post-award), and 50.000+ Trust Score profiles with sufficient depth. All three in progress.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.cap} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.cap}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.status}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Data requirement: {r.data_requirement}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">AI roadmap adalah multi-year commitment that Hendra Jr. plans backward from 2028 capability targets to data requirements today. The key insight: you cannot train a prediction model without first collecting the training data. MJP is currently collecting data (labeled bid outcomes, regulatory change correlations, Trust Score with outcome tracking) that won't be useful for model training until 2027. This means the 'cost' of AI-CAP-2 and CAP-3 is being paid today in data engineering infrastructure, even before the models are trained. Hendra Jr.'s philosophy: 'AI capability that you want in 3 years requires data decisions you make today. If I wait until 2027 to start collecting training data, the model won't be ready until 2029 at best. Kami mulai sekarang karena itulah cara satu-satunya untuk on-time delivery 2027.' Hendra: 'MJP's AI roadmap adalah the clearest articulation of how data infrastructure today becomes product differentiation tomorrow. Setiap baris data yang kita kumpulkan dengan benar sekarang adalah leverage untuk AI yang lebih cerdas nanti.'</p>
      </div>

      {/* R105: AI Responsibility Framework — What MJP Will and Won't Let AI Decide */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> AI RESPONSIBILITY FRAMEWORK — Batas yang Hendra Tetapkan: Keputusan Apa yang AI MJP Boleh Buat, Apa yang Harus Tetap di Tangan Manusia, dan Mengapa Batasan Ini Bukan Ketakutan tentang AI tapi Tanggung Jawab Terhadap Klien
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { boundary: "AI CAN DO: Pattern recognition and scoring (Trust Score, HPS estimation, tender relevance)", rationale: "These are probabilistic assessments where AI's pattern-matching ability is genuinely superior to human manual analysis at scale. Trust Score: aggregates 50+ data points across 23.000 BUJK — no human can do this manually for all. HPS estimation: trained on 100.000+ historical tenders — pattern recognition at this scale is AI's core strength.", human_check: "Human check still required: Trust Score for JO partners in high-stakes tenders — Reza or klien's procurement manager reviews AI score before major decisions. HPS for large contracts (> Rp 50M): AI estimate + klien's own cost analysis.", tc: "text-primary" },
            { boundary: "AI CAN DO: Personalization and filtering (what tenders to show, what signals to highlight)", rationale: "Personalization based on usage history, KBLI profile, and stated preferences is pure pattern matching. No material consequence if the personalization is slightly wrong — klien can always see all tenders if needed. Personalization failure mode: showing irrelevant tenders, not hiding important ones (MJP's alert system always has 'see all' fallback).", human_check: "N/A — klien have full control over alert settings and can override AI personalization at any time.", tc: "text-blue-700" },
            { boundary: "AI CANNOT DO: Make final compliance determination ('is this BUJK qualified for this tender?')", rationale: "Compliance determination has legal and financial consequences. If AI incorrectly says 'BUJK is qualified' → BUJK submits disqualified bid → wastes time and money. If AI incorrectly says 'BUJK is not qualified' → BUJK doesn't bid on tender they could have won. Both error types have real cost. Hendra's principle: 'AI can tell you the probability. Humans must make the decision.'", human_check: "MJP's compliance checker: always shows 'Based on available data, this BUJK meets X of Y requirements. Verify directly before submission.' Never states 'BUJK is compliant' as fact — always as assessment.", tc: "text-orange-700" },
            { boundary: "AI CANNOT DO: Interpret ambiguous regulatory language definitively", rationale: "Regulatory interpretation requires judgment about legislative intent, contextual application, and legal precedent. When a regulation is ambiguous (common in Indonesian construction law): AI pattern-matching on text is insufficient. Two lawyers can read the same regulation and reach different conclusions. AI should not pretend otherwise.", human_check: "Sari's Knowledge Registry assets always cite source regulation + Sari's interpretation. NLQ answers for ambiguous regulatory questions: always include 'This is Sari's interpretation — consult a legal professional for binding advice.' Low-confidence responses are flagged explicitly.", tc: "text-emerald-700" },
            { boundary: "AI CANNOT DO: Replace Budi's empathy-based field research", rationale: "Field research value comes from human empathy, trust building, and real-time judgment about what to probe and what to leave alone. Pattern #4 dismissal signals (silence that indicates discomfort) cannot be detected by any AI system in any foreseeable timeframe. Budi's presence as a genuine human in narasumber's physical space creates a type of trust that AI interviewing tools cannot replicate.", human_check: "AI supports Budi: transcription, theme extraction from notes, prioritization of follow-up questions. AI does not replace: the interview itself, the relationship, or the judgment in the room.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.boundary} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.boundary}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Rationale: {r.rationale}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Human check: {r.human_check}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">AI responsibility framework adalah Hendra's explicit commitment to klien about how MJP uses AI — not as a generic 'we use AI responsibly' statement but as a specific articulation of exactly where AI makes decisions and where humans retain authority. This framework is published in MJP's terms of service (simplified version) and discussed in every Enterprise onboarding. The framework emerged from a near-miss in 2024: NLQ gave a high-confidence answer about SKK qualification that was technically correct but context-dependent — in a specific province with a local regulation that modified the national standard. Klien acted on it without verifying. Outcome: they submitted a bid that was disqualified because of the local modification. Post-incident: NLQ low-confidence threshold was tightened, all compliance-adjacent answers now carry explicit verification warnings, and the AI responsibility framework was formalized. Hendra: 'AI yang kuat tanpa framework tanggung jawab yang jelas adalah liability, bukan asset. Klien percaya AI kami karena kami sangat jelas tentang apa yang AI kami tidak bisa lakukan.'</p>
      </div>

      {/* R106: The Human Behind the Algorithm — What Makes MJP's AI Different */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-primary" /> THE HUMAN BEHIND THE ALGORITHM — Mengapa MJP Menolak 'Black Box AI': Setiap Model yang MJP Gunakan Harus Bisa Dijelaskan oleh Hendra Jr. ke Klien dalam 5 Menit, dan Mengapa Ini adalah Produk Positioning yang Kuat
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { principle: "Explainability as product requirement, not compliance checkbox", detail: "Hendra Jr.'s rule: every AI model MJP deploys must be explainable to a non-technical klien in under 5 minutes. If it takes longer: the model is too complex for MJP's context. This is not a regulatory requirement — it's a product requirement. Klien who don't understand how Trust Score is calculated don't trust it. Klien who understand the 5 dimensions and their weights: trust it and use it.", example: "Trust Score explanation: 'We look at 5 things: how many tenders you've bid on and won, whether your SKK is valid and complete, whether other BUJK have flagged payment issues with you, whether your KBLI and kualifikasi match your stated specialization, and whether your registration documents are current. We weight these 5 things to produce a score from 0–100.' Klien can evaluate this. Black box 'ML model says 74' cannot be evaluated.", tc: "text-primary" },
            { principle: "Rejection of large language models for compliance-critical features", detail: "Hendra Jr. has explicitly chosen NOT to use large language models (LLMs) for NLQ's core answer engine. LLMs: high fluency, unpredictable accuracy, prone to hallucination on specialized domains. MJP's choice: RAG (Retrieval-Augmented Generation) anchored to Knowledge Registry. Every NLQ answer is directly traceable to a specific Knowledge Registry asset. If the asset is wrong: the answer is wrong, but correctable. LLM hallucination: wrong and not correctable because there's no source to fix.", example: "When klien asks about K3 requirements: MJP finds the closest Knowledge Registry asset, retrieves the relevant section, and presents it with citation. No generation of new information. No hallucination risk. Trade-off: less fluent than GPT, more accurate for this specific domain.", tc: "text-blue-700" },
            { principle: "Human override is always accessible and never punished", detail: "Every AI feature in MJP has a human override. Trust Score: klien can flag 'I have conflicting information about this BUJK — please review.' NLQ low-confidence: automatically escalates to Sari review queue. Tender relevance algorithm: klien can manually adjust weight of each KBLI category in their alert profile. The system never penalizes overrides — it learns from them.", example: "72 manual overrides received in 2025 (Trust Score flags + NLQ escalations). Of 72: 41 (57%) led to data corrections or model improvements. These overrides are not support tickets — they're product feedback that improves the AI. Klien who override: are actively improving the system they use.", tc: "text-emerald-700" },
            { principle: "Algorithmic transparency to competitors: a calculated risk", detail: "MJP publishes Trust Score methodology (5 dimensions, approximate weights, data sources) on their website. Competitors can read this. Hendra's decision: transparency to klien is worth the competitor intelligence risk. 'If we hide how Trust Score works: klien who are wary of black-box AI won't trust it. If we publish: klien who value explainable AI will trust it more, and competitors who try to copy it will discover that the methodology is not the hard part — the data infrastructure is.'", example: "C1 has not replicated Trust Score despite knowing MJP's methodology for 2+ years. Hendra Jr.'s assessment: 'Mereka tahu resepnya. Mereka tidak punya bahan-bahannya.' Data coverage (147.000 BUJK) is the ingredient that can't be copied from a methodology document.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.principle} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.principle}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Example: {r.example}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">The human behind the algorithm philosophy adalah MJP's intentional positioning in an AI landscape that is moving toward opacity and complexity. While many AI platforms are building increasingly complex models that require trust-me-it-works explanations: MJP is moving in the opposite direction — more explainability, more human override, more transparency about what the AI can and cannot do. This is not technological conservatism — it's strategic positioning. MJP's target klien (BUJK owners making Rp 10M+ business decisions) want to understand what they're trusting. 'Our AI says so' is not sufficient for a contract decision. 'Our AI says so because it analyzed these 5 factors from these verified sources' is sufficient. The philosophy also serves MJP internally: every engineer who joins MJP inherits the explainability requirement — they cannot build models that the team can't explain. This constraint produces better, more reliable models because it forces simplicity and accuracy over complexity and fluency. Hendra: 'Platform terbaik untuk domain yang membutuhkan kepercayaan bukan yang punya AI paling canggih — tapi yang punya AI yang paling bisa dipercaya. Ini berbeda. Dan ini adalah bet yang kami ambil dengan sadar.'</p>
      </div>

      {/* R107: What Happens When AI Is Wrong — MJP's Error Recovery Protocol */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-primary" /> AI ERROR RECOVERY PROTOCOL — Apa yang Terjadi Ketika AI MJP Salah: 4 Kategori Error, Proses Recovery Untuk Setiap Kategori, dan Mengapa Error Handling adalah Bagian Terpenting dari AI Product Design
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { error_type: "ER-1: Trust Score error — scored BUJK too high or too low", detection: "Detection: klien flags discrepancy ('I have information contradicting this Trust Score'). OR: Hendra Jr.'s data quality monitoring detects source data anomaly post-scoring.", process: "Step 1 (Hendra Jr.): investigate source data (which dimension caused the error? SKK? Track record? Financial signal?). Step 2 (if source data issue): fix source, recalculate Trust Score, notify affected klien. Step 3 (if model weighting issue): retrain affected dimension. Step 4: log in Trust Score accuracy improvement queue. Timeline: 48-hour maximum from detection to resolution.", learning: "Every TS error is logged with root cause. Running tally: 34 Trust Score errors in 5 years. Root cause distribution: 43% source data errors (LPSE/BNSP lag artifacts), 35% model calibration errors, 22% data completeness issues (Tier C/D BUJK with insufficient data generating overconfident scores).", tc: "text-primary" },
            { error_type: "ER-2: NLQ error — incorrect or misleading answer to klien question", detection: "Detection: NLQ low-confidence flag triggers Sari review. OR: klien acts on answer and reports discrepancy. OR: Sari's weekly health check identifies incorrect answer in a cached NLQ response.", process: "Step 1 (Sari): identify whether error is Knowledge Registry gap (asset doesn't exist), Knowledge Registry error (asset exists but contains incorrect information), or retrieval error (asset is correct but NLQ cited wrong passage). Step 2: fix identified root cause. Step 3 (if klien acted on incorrect answer): proactive outreach. Timeline: Sari addresses all flagged NLQ errors within 72 hours.", learning: "Documented NLQ errors: 67 in 2 years of formal tracking. Categories: 41% retrieval errors (improved search indexing), 34% knowledge gaps (new assets produced), 25% knowledge errors (Sari corrections). After each error: NLQ confidence calibration reviewed for that question category.", tc: "text-blue-700" },
            { error_type: "ER-3: HPS estimation error — significant miss in price estimation", detection: "Detection: tender results published (LPSE shows winning bid) and winning bid is outside MJP's estimated range by {'>'} 20%. These are systematically trackable — every tender has an eventual result.", process: "Hendra Jr.'s monthly HPS accuracy audit: compare predicted range vs actual winning bid for all closed tenders where MJP made an HPS estimate. Errors classified: (1) market anomaly (extreme low bidder won — not MJP model failure), (2) model error (MJP's range was systematically wrong for this KBLI/region). Model errors: trigger retraining of affected KBLI-region segment.", learning: "Monthly HPS accuracy is the most data-rich AI feedback loop MJP has — LPSE always publishes results, so ground truth is always available. Current accuracy (winning bid within MJP's estimated range): 71%. Target: 78% by Q4 2026. Primary driver of 29% error rate: smaller/regional LPSE portals with lower historical data density.", tc: "text-emerald-700" },
            { error_type: "ER-4: Tender relevance error — irrelevant tender in alert or relevant tender missed", detection: "Detection: klien explicitly marks alert as 'irrelevant' (UI feedback mechanism). OR: klien asks 'why didn't I get alerted about [specific tender]?' (missed tender detection). Both are in-product feedback loops.", process: "Irrelevant alert: retrain personalization model for that klien segment (KBLI profile adjustment). Missed tender: investigate whether: (1) tender was in MJP's database but not matched to klien's KBLI (matching error), (2) tender was NOT in database (crawler miss), (3) klien's KBLI profile doesn't include that category (configuration issue). Each investigation produces a different fix.", learning: "Alert quality feedback (mark as irrelevant): 234 events in 2025. Missed tender reports: 47. Most common issue: klien's KBLI profile is too narrow — they bid on tenders adjacent to their registered KBLI that the algorithm doesn't know to include. Fix: 'Adjacent KBLI' suggestion feature (in backlog).", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.error_type} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.error_type}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Detection + process: {r.detection} → {r.process}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Learning: {r.learning}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">AI error recovery protocol adalah the part of MJP's AI product design that gets the least attention externally but generates the most long-term improvement internally. The 4 error categories above have formal detection mechanisms, defined resolution processes, and learning capture processes. Without formal error handling: AI systems degrade over time as data distributions shift, regulations change, and market conditions evolve. With formal error handling: each error is an input to improvement. The most important metric is not the current error rate — it's the trend. Trust Score errors: 11 in Year 1, 7 in Year 2, 6 in Year 3, 5 in Year 4, 5 in Year 5 (so far). Improving. HPS accuracy: 61% in Year 1, 67% in Year 3, 71% in Year 5. Improving. NLQ accuracy: 58% in Year 1 (2023), 82% in Year 5 (2026). Most improved. The improvement trend is the moat — competitors who build similar AI features today will start at MJP's Year 1 accuracy. By the time they reach Year 3 accuracy: MJP will be at Year 8. Error handling is how time advantage is maintained. Hendra Jr.: 'AI yang tidak pernah salah tidak pernah belajar. AI yang salah dengan belajar — itu yang membuat competitive advantage kita tumbuh bukan menyusut seiring waktu.'</p>
      </div>

      {/* R108: MJP's Internal AI Productivity Stack */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-primary" /> INTERNAL AI PRODUCTIVITY STACK — Bagaimana Tim 6 Orang MJP Menggunakan AI Secara Internal untuk Mengerjakan Volume yang Normalnya Butuh Tim 15 Orang: 4 Kategori Penggunaan AI Internal, Apa yang Berhasil, dan Batasnya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { category: "IA-1: Hendra Jr. — AI-assisted code review dan dokumentasi", tools_and_use: "Hendra Jr. uses AI coding assistants (Replit Agent + Claude) for: (1) code review — checking new implementations for common security issues and logic errors before self-merge, (2) documentation generation — converting code comments into API documentation, (3) test case generation — generating test scenarios for edge cases Hendra Jr. might miss. Estimated productivity multiplier: 1.4× (35–40% of tasks that would have taken 30+ minutes now take 15–20 minutes).", limits: "AI coding assistants fail on: MJP-specific domain knowledge (they don't know the 47 LPSE data format templates or the authentication quirks of specific portals). Hendra Jr.'s rule: AI can assist with generic programming tasks; all LPSE-specific logic requires Hendra Jr.'s own judgment. 'Kalau AI bisa menulisnya tanpa saya beri konteks yang sangat spesifik — itu adalah pekerjaan yang AI bisa bantu. Kalau butuh konteks LPSE spesifik — itu hanya bisa saya.'", tc: "text-primary" },
            { category: "IA-2: Sari — AI-assisted Knowledge Registry first-draft production", tools_and_use: "Sari uses AI (primarily Claude via Replit) for: (1) first draft of Knowledge Registry regulatory summaries — AI reads the primary regulation and produces a structured summary that Sari then verifies and refines, (2) cross-reference checking — identifying which existing Knowledge Registry assets are affected by a new regulatory change, (3) NLQ question category analysis — identifying patterns in NLQ queries to guide new asset priorities. Estimated productivity multiplier: 1.6× (new Knowledge Registry assets: first draft in 45 minutes vs 90–120 minutes without AI assistance; verification time unchanged).", limits: "AI regulatory summaries fail on: nuance interpretation (AI tends toward literal reading; Sari adds practitioner context that AI misses), conflict detection (AI doesn't know when a new regulation conflicts with existing MJP Knowledge Registry interpretations), and judgment calls (when Sari says 'this regulation means X in practice, not Y as literally written'). Sari's rule: 'AI menulis ringkasan pertama. Saya menulis ringkasan final. Tidak ada klien yang menerima ringkasan yang belum saya baca dan setujui.'", tc: "text-blue-700" },
            { category: "IA-3: Reza — AI-assisted sales research dan proposal personalization", tools_and_use: "Reza uses AI for: (1) pre-call research — given a BUJK name, generate a briefing about their likely tender activity, KBLI profile, and pain point hypothesis using public LPSE data + MJP Trust Score, (2) proposal personalization — generate first drafts of Enterprise proposal letters personalized to the prospect's specific procurement focus, (3) follow-up email drafting — personalized follow-up sequences based on call notes. Estimated productivity multiplier: 1.8× (Reza can conduct 6–7 quality research-backed sales calls per day vs 3–4 without AI assistance).", limits: "AI sales research fails on: understanding interpersonal dynamics (who in the BUJK organization is the real decision-maker), local context (BUJK in small cities require different sales approach than Jakarta-based BUJK), and emotional intelligence (when a prospect is hesitant for reasons they won't state directly). Reza's rule: 'AI kasih saya fakta. Saya yang membaca orangnya.'", tc: "text-emerald-700" },
            { category: "IA-4: Hendra — AI-assisted investor materials dan strategic analysis", tools_and_use: "Hendra uses AI for: (1) financial model sensitivity analysis — generating multiple scenario tables for investor presentations, (2) competitor analysis research — summarizing publicly available information about C1 and other competitors from public sources, (3) board communication drafts — first drafts of investor update emails that Hendra then personalizes, (4) strategic analysis frameworks — generating structured frameworks (Porter's Five Forces, etc.) applied to MJP's specific context as thinking tools. Estimated productivity multiplier: 1.5× (tasks that used to take 3–4 hours now take 2 hours).", limits: "AI strategic analysis fails on: knowing which facts are confidential vs public, understanding MJP's specific relationship history with investors or partners, and judgment calls about tone in sensitive communications. Hendra: 'AI adalah research assistant yang tidak pernah lelah dan tidak pernah perlu dibayar lembur. Tapi keputusan strategis yang penting tidak pernah saya biarkan dibuat oleh AI. Itu tetap pekerjaan saya.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.category} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.category}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Tools and use: {r.tools_and_use}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Limits: {r.limits}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Internal AI productivity stack adalah MJP's answer to a common investor question: 'How does a 6-person team produce the output quality and volume you produce?' The answer: deliberate AI augmentation of each team member's highest-repetition tasks, with clear human authority over judgment-dependent tasks. The combined productivity impact: MJP's 6-person team operates with the output volume of an estimated 9–10 person team without AI augmentation. This is the productivity multiplier that allows MJP to maintain sub-Rp 2B/year operating costs while delivering product depth that would normally require twice the headcount. The limits are as important as the capabilities: each team member has a clear line between 'what AI can do' and 'what I must do.' These lines are not arbitrary — they're drawn at the point where context, judgment, and accountability become critical. AI lacks MJP's institutional context (5 years of LPSE-specific knowledge), the ability to take responsibility for outputs (Sari's name is on every Knowledge Registry asset she approves), and emotional intelligence (Reza's ability to read a hesitant prospect's unspoken objection). The lines protect product quality: AI amplifies human capacity without replacing the human judgment that makes MJP's outputs trustworthy. Hendra: 'Tim yang tidak menggunakan AI secara internal sedang memboroskan kapasitas manusia mereka pada tugas yang bisa diotomasi. Tim yang menggunakan AI untuk menggantikan penilaian manusianya sedang memboroskan investasi mereka dalam membangun keahlian. Kami mencoba menjadi tim yang pertama, bukan yang kedua.'</p>
      </div>

      {/* R109: What MJP's AI Cannot Do — Technical Boundaries */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> AI TECHNICAL BOUNDARIES — Apa yang AI MJP Tidak Bisa Lakukan: 5 Batas Teknis yang Hendra Jr. Dokumentasikan Secara Eksplisit untuk Memastikan Klien Tidak Mempercayai Platform Melampaui Kemampuannya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { boundary: "BOUNDARY-1: NLQ tidak bisa memberikan pendapat hukum — hanya informasi regulasi", what_mjp_can_do: "MJP's NLQ can: retrieve and summarize what a regulation says, explain how a regulation has been interpreted in practice (based on LKPP guidance circulars), and identify which regulatory provisions apply to a described scenario. Every NLQ answer includes: 'Informasi ini berdasarkan [Regulasi X] — untuk keperluan hukum atau kontrak, konsultasikan dengan konsultan hukum pengadaan.'", what_mjp_cannot_do: "NLQ cannot: give legal advice (this would require attorney-client relationship and bar admission), interpret ambiguous regulatory provisions in binding ways (only LKPP can issue binding interpretations), predict how a specific panitia will apply a regulation (human judgment of specific procurement committees is outside data scope), or advise on legally gray areas (MJP surfaces the ambiguity; the decision is the klien's).", tc: "text-primary" },
            { boundary: "BOUNDARY-2: Trust Score tidak bisa memprediksi masa depan — hanya mencerminkan sejarah yang terverifikasi", what_mjp_can_do: "Trust Score reflects: verified LPSE track record (what contracts completed, what values, what outcomes), current SKK status (verified against BNSP), Daftar Hitam status (verified against LKPP). These are factual, verified historical records.", what_mjp_cannot_do: "Trust Score cannot: predict whether a BUJK will perform well on a future project (past performance correlates but doesn't guarantee), assess a BUJK's current financial capacity (a BUJK with good historical performance may be currently overextended), evaluate a BUJK's leadership team quality (human factors invisible in data), or predict future BUJK behavior in high-stress scenarios (disputes, payment delays, scope changes). Hendra Jr.'s explicit in-product statement: 'Trust Score reflects verified historical performance data. It is not a guarantee of future performance.'", tc: "text-blue-700" },
            { boundary: "BOUNDARY-3: HPS estimation tidak bisa memperhitungkan informasi internal yang tidak dipublikasikan", what_mjp_can_do: "HPS model uses: public LPSE award data (5-year historical), regional construction cost indices, scope complexity signals from public tender documents, market condition overlays from public data. All inputs are verifiable and public.", what_mjp_cannot_do: "HPS model cannot: account for panitia's internal budget pressure (which may cause HPS to be set higher or lower than cost-based calculation suggests), factor in informal industry intelligence about a specific project's political dimensions, adjust for panitia's informal preference for lowest possible bid (which sometimes sets HPS below cost of quality execution). These factors: real but invisible to MJP's data. Hendra Jr.'s honest summary: 'MJP's HPS is a model, not a source of truth. It's as good as the public data it's built on and no better than that.'", tc: "text-emerald-700" },
            { boundary: "BOUNDARY-4: Sistem alert tidak menjamin bahwa klien tidak akan melewatkan tender yang penting", what_mjp_can_do: "MJP's alert system: monitors 671 LPSE portals, delivers KBLI-personalized alerts, catches 99%+ of tenders matching klien's profile within MJP's SLA. Revision detection catches silent document updates. SKK alerts catch impending expiry.", what_mjp_cannot_do: "Alert system cannot: guarantee 100% coverage of all relevant tenders (31% of Tier-3 LPSE portals have data quality issues), cover non-LPSE procurement (Pengadaan Langsung below Rp 200M threshold), guarantee alert delivery in all connectivity conditions (mobile push notifications fail when devices are offline — though MJP's mobile app has offline queue for actions, not for alert delivery), or eliminate the need for klien to occasionally check LPSE directly (for high-stakes tenders: belt-and-suspenders verification recommended). Hendra: 'Sistem alert kami seharusnya membuat klien tidak perlu memeriksa LPSE setiap hari. Ini tidak seharusnya membuat mereka tidak pernah memeriksanya sama sekali untuk tender yang sangat penting.'", tc: "text-orange-700" },
            { boundary: "BOUNDARY-5: AI rekomendasi tidak memperhitungkan faktor relasional yang menentukan keberhasilan di lapangan", what_mjp_can_do: "MJP's AI recommendation (bid strategy, JO matching, tender selection) can: identify statistically favorable patterns, surface data that a klien might miss, flag risk factors visible in data, recommend JO partners based on verified track record alignment.", what_mjp_cannot_do: "AI recommendations cannot: account for the klien's existing relationship with a specific panitia (which may be the real decision factor), evaluate whether a potential JO partner's management team will be easy or difficult to work with, assess local community relationship factors (important for projects in remote areas), or predict whether a BUJK's internal team capacity can absorb a specific project without impacting existing commitments. Budi: 'AI bisa membaca data. Yang tidak bisa dibaca AI adalah ruangan ketika dua pemilik BUJK duduk bersama dan memutuskan apakah mereka bisa saling percaya. Itu adalah sesuatu yang tetap menjadi pekerjaan manusia.'", tc: "text-primary" },
          ].map((r) => (
            <div key={r.boundary} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.boundary}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Can do: {r.what_mjp_can_do}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Cannot do: {r.what_mjp_cannot_do}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">AI technical boundaries adalah the most counterintuitive document in MJP's product communication — because it explicitly limits rather than expands klien expectations. Most AI platforms communicate capabilities, not incapabilities. MJP publishes both: what the AI can do (product value) and what it cannot do (responsible use guidance). The rationale: a klien who knows the limits uses the platform correctly. A klien who believes there are no limits uses the platform incorrectly — and when the limits are revealed through a bad decision, they become CHURN-4 (Disappointed). The PP-C1 through PP-C4 platform-created pain points (from pain-points page) are all downstream effects of klien who didn't know or ignored the boundaries: over-reliance on HPS estimates (BOUNDARY-3), Trust Score anchoring (BOUNDARY-2), alert dependency (BOUNDARY-4), NLQ over-reliance (BOUNDARY-1). Publishing the boundaries proactively doesn't reduce klien confidence — it increases it. Enterprise klien who have been through MJP's onboarding (which explicitly covers AI boundaries) are more likely to describe MJP as 'trustworthy' and 'honest about limitations' in NPS verbatim responses. The paradox: being honest about what AI cannot do makes klien trust what it can do more. Hendra Jr.: 'Batasan ini bukan tentang meremehkan apa yang sudah kami bangun. Ini tentang memastikan bahwa kepercayaan klien terhadap apa yang kami bangun tidak melampaui apa yang bisa dipertanggungjawabkan. Kepercayaan yang berlebihan adalah risiko — kepercayaan yang kalibrasinya tepat adalah aset.'</p>
      </div>

      {/* R111: NLQ Development Roadmap 2027 */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> NLQ DEVELOPMENT ROADMAP 2027 — Apa yang NLQ Akan Bisa Lakukan dalam 18 Bulan ke Depan: 5 Kapabilitas Baru yang Akan Mengubah NLQ dari Query Interface menjadi Procurement Intelligence Partner
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { capability: "NLQ-ROAD-1: Multi-turn conversation memory — NLQ yang mengingat konteks dalam satu sesi", current_state: "Current NLQ: stateless — each query is independent. If a klien asks 'tunjukkan tender konstruksi gedung di Jakarta bulan ini' and follows up with 'mana yang HPS-nya di atas Rp 10 miliar?' — the second query is treated as independent, not as a refinement of the first. Result: klien must repeat context in every query, reducing the conversational quality of the interface.", roadmap: "NLQ v2 (Q1 2027 target): session memory — NLQ maintains context for the duration of a single session (maximum 30 minutes). The follow-up query above: NLQ understands 'mana yang' refers to the Jakarta construction tender results from the previous query. Hendra Jr.'s implementation approach: session context stored as a compressed representation of the last 5 queries + results, injected into the LLM prompt for each follow-up. Technical constraint: context window cost. Hendra Jr.'s optimization: only compress meaningful prior queries, not raw data.", tc: "text-primary" },
            { capability: "NLQ-ROAD-2: Proactive intelligence push — NLQ yang menawarkan informasi tanpa diminta", current_state: "Current NLQ: reactive only — responds to queries, never initiates. After answering a tender query, NLQ doesn't say 'Anda mungkin juga tertarik bahwa 3 BUJK yang menang tender serupa memiliki Trust Score di atas 7.2.' The information exists in MJP's database. The connection from query context to related intelligence: not made automatically.", roadmap: "NLQ v2 (Q2 2027 target): proactive context expansion. After answering a primary query, NLQ generates 1–2 proactive intelligence suggestions: 'Berdasarkan query ini, mungkin relevan: [X].' Implementation: a classifier that maps query intent to related intelligence categories. The proactive suggestions: based on MJP's historical data about what Enterprise klien tend to look up after different types of queries. Not random — learned from usage patterns. Hendra's concern: proactive suggestions that are irrelevant feel intrusive. Hendra Jr.'s solution: proactive suggestions are soft (small card below main answer, easily dismissable) and tracked — suggestions that are never clicked are suppressed.", tc: "text-blue-700" },
            { capability: "NLQ-ROAD-3: Cross-modal queries — menggabungkan teks, angka, dan kondisi dalam satu query", current_state: "Current NLQ: handles text queries well but struggles with complex multi-condition queries combining textual and numerical conditions. 'Tender konstruksi sipil di Jawa Tengah dengan HPS antara Rp 5M dan Rp 20M dari BUJK kualifikasi Menengah yang belum pernah kami bid' — this query combines 4 conditions (geography, category, value range, qualification type, and historical bid data). Current accuracy for this type of query: 67% (the most complex query type in MJP's error analysis).", roadmap: "NLQ v2 (Q3 2027 target): structured query parser layer. For complex multi-condition queries, NLQ v2 will use a hybrid approach: LLM for intent extraction + structured query builder for the filter conditions. The LLM extracts what the user wants; the structured query builder translates it into a database query with explicit filter parameters. User can see the interpreted filters ('Anda mencari: [list of extracted conditions]') and correct misinterpretations before execution. This transparency: reduces the black-box problem while improving accuracy for complex queries.", tc: "text-emerald-700" },
            { capability: "NLQ-ROAD-4: Competitive analysis synthesis — NLQ yang merangkum landscape kompetitor secara otomatis", current_state: "Current NLQ: answers specific questions about specific BUJK or tenders. It cannot synthesize competitive landscape: 'siapa saja pemain utama di konstruksi gedung komersial di Surabaya dan bagaimana posisi kami dibanding mereka?' This type of query requires: (1) identifying the relevant BUJK universe, (2) aggregating their historical performance data, (3) synthesizing a competitive landscape summary. Current capability: answers individual BUJK queries, not landscape synthesis.", roadmap: "NLQ v2 (Q4 2027 target): competitive synthesis mode. A specialized NLQ mode activated by synthesis-type queries (detected by query classifier). In synthesis mode: NLQ runs multiple sub-queries, aggregates results, and generates a structured landscape summary with a text synthesis and supporting data table. Performance constraint: synthesis queries take 8–15 seconds vs standard queries at under 2 seconds. Hendra Jr.'s approach: show a 'building your competitive landscape' progress indicator for synthesis queries to manage latency expectation.", tc: "text-orange-700" },
            { capability: "NLQ-ROAD-5: Personalized baseline calibration — NLQ yang belajar dari kebiasaan query tiap klien", current_state: "Current NLQ: treats all klien queries equivalently. A BUJK focused on jenjang 7 SKK Gedung Komersial in Jawa Barat: NLQ gives them the same results format and defaults as a BUJK focused on jenjang 9 SKK Sumber Daya Air in Papua. No personalization. The defaults (region, KBLI, qualification level): must be re-entered every session.", roadmap: "NLQ v2 (ongoing throughout 2027): personalization layer. NLQ learns from each klien's query history: their typical region, KBLI focus, qualification level, and tender size range. These learned defaults: pre-populate filter parameters for new queries ('Based on your typical activity, I've pre-set region to Jawa Barat and KBLI to 4100 — adjust if needed'). The personalization is transparent and overridable. Privacy consideration: query history used only for that klien's personalization, never for aggregate model training without explicit opt-in. Hendra Jr.: 'NLQ yang paling berguna bukan yang paling pintar secara umum — ini yang paling mengenal pengguna yang berbicara dengannya. Personalisasi adalah cara membuat 340 query harian terasa seperti mereka sedang bicara dengan asisten yang mengenal mereka, bukan search engine yang tidak peduli.'", tc: "text-primary" },
          ].map((r) => (
            <div key={r.capability} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.capability}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Current state: {r.current_state}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Roadmap: {r.roadmap}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">NLQ Development Roadmap 2027 adalah Hendra Jr.'s most ambitious engineering vision for MJP — because it describes a transition from NLQ as a query interface (where users ask and NLQ answers) to NLQ as a procurement intelligence partner (where NLQ anticipates, synthesizes, and personalizes). The 5 capabilities are sequenced by complexity and dependency: ROAD-1 (session memory) is foundational — ROAD-2 (proactive push) and ROAD-5 (personalization) are much better with session memory. ROAD-3 (cross-modal) is independent but needed before ROAD-4 (synthesis). The roadmap timeline (Q1 2027 – Q4 2027): ambitious but achievable with the post-Series A backend engineer. Without the additional engineer: only ROAD-1 and ROAD-5 are achievable in 2027 (Hendra Jr. working alone). With the additional engineer: all 5 capabilities, with the engineer taking primary responsibility for ROAD-3 and ROAD-4 while Hendra Jr. focuses on ROAD-1, ROAD-2, and ROAD-5. The investment case for NLQ v2: current NLQ usage (340 queries/day) is concentrated among 23% of active subscribers. The 77% non-NLQ users: Hendra Jr.'s analysis suggests 45% of them tried NLQ and found it insufficient for their query complexity (ROAD-3 problem) or didn't find the results personalized enough (ROAD-5 problem). NLQ v2 addressing both gaps: projected to increase daily NLQ users from 23% to 45% of active subscribers — a 95% increase in NLQ engagement from existing subscribers. Hendra Jr.: 'NLQ versi 1 adalah bukti bahwa konsepnya berhasil. NLQ versi 2 adalah versi yang layak menjadi alasan utama seseorang subscribe ke MJP — bukan sekadar fitur bonus bagi klien yang sudah subscribe karena alasan lain.'</p>
      </div>

      {/* R112: AI Ethics Committee */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> AI ETHICS COMMITTEE — Apa yang MJP Lakukan Sebelum Setiap Deployment Fitur AI Baru: 5-Gate Review Process, Prinsip yang Tidak Bisa Dikompromikan, dan Bagaimana Hendra Membuat Keputusan tentang AI yang Tidak Pernah Bisa Dia Undur Sepenuhnya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { gate: "GATE-1: Accuracy threshold — apakah model cukup akurat untuk use case ini?", standard: "For each new AI feature, Hendra Jr. defines a minimum accuracy threshold before deployment. Thresholds vary by use case criticality: NLQ query answering (threshold: 82% user satisfaction in internal testing — Hendra Jr. tests 50 queries spanning MJP's most common question types). Trust Score data enrichment (threshold: 96% agreement with manual verification on 30-BUJK test set). HPS estimation (threshold: accuracy improvement over baseline — model must beat the existing non-AI HPS calculation by at least 3 percentage points). The threshold is set BEFORE model development, not after — this prevents post-hoc rationalization ('the model achieved X%, and we decided X% is good enough').", passed_failed: "GATE-1 has blocked 2 AI feature deployments in MJP's history: (1) An automated regulatory impact summary model (trained in Q3 2024) that achieved 71% user satisfaction on internal testing — below the 82% threshold. Decision: model retrained with additional data, re-tested in Q1 2025, achieved 84% — deployed. (2) A BUJK creditworthiness prediction model (Q4 2024, for an experimental banking partnership) that achieved 78% agreement with bank credit officers — below the 85% threshold set for a decision with direct financial consequences. Decision: partnership deferred until model accuracy improves.", tc: "text-primary" },
            { gate: "GATE-2: Explainability requirement — apakah model bisa menjelaskan rekomendasinya?", standard: "MJP's explainability principle: every AI recommendation that a klien will act on must come with an explanation. No black-box recommendations. NLQ answer: always includes the specific data sources and Knowledge Registry assets cited. Trust Score: shows which dimensions drove the score (win rate, SKK validity, SBU compliance, etc.) and their weights. HPS estimate: shows the comparable tenders used as references and their award prices. Decision Intelligence actions: each action includes the specific signal that triggered it. The test: can a BUJK who receives an AI recommendation read the explanation and understand why it was made — without needing to know how the model works?", passed_failed: "GATE-2 required MJP to reject a more accurate but less explainable model architecture in Q2 2025: a gradient boosting model for HPS estimation that achieved 74% accuracy (vs the current linear model's 71%) but could not generate interpretable explanations for individual estimates. Hendra Jr.'s decision: keep the less accurate but more explainable model. Hendra's rationale: 'Klien yang mendapat estimasi salah tapi mengerti mengapa salah: bisa memberikan feedback yang memperbaiki model berikutnya. Klien yang mendapat estimasi salah dari black box: tidak tahu apa yang harus mereka percaya.'", tc: "text-blue-700" },
            { gate: "GATE-3: Bias audit — apakah model memperlakukan semua BUJK secara setara?", standard: "Before deploying any AI feature that produces scores, rankings, or recommendations: Hendra Jr. runs a bias audit. Test dimensions: (1) Geographic bias — does the model perform equally well for BUJK in Eastern Indonesia vs Java? (2) Size bias — does the model perform equally well for small BUJK (under Rp 2B ARV) and large BUJK? (3) Qualification bias — does the model favor BUJK with certain SBU types over others in ways that aren't justified by actual performance? The bias audit methodology: compare model performance metrics (accuracy, false positive rate, false negative rate) across subgroups. If any subgroup has performance more than 5 percentage points below average: investigate root cause and address before deployment.", passed_failed: "The Trust Score model's 2023 bias audit found: geographic bias (model was 6.2 percentage points less accurate for BUJK in Papua and Maluku vs Java, due to insufficient training data from Eastern Indonesia portals). Response: Budi's 2023–2024 narasumber expansion program (designed for geographic coverage) also increased Eastern Indonesia data representation in the Trust Score training set. 2025 re-audit: gap reduced to 2.8 percentage points. Hendra Jr.'s target: below 2 percentage points by Q4 2026.", tc: "text-emerald-700" },
            { gate: "GATE-4: Klien harm analysis — what's the worst case if the model is wrong?", standard: "For each AI feature, Hendra Jr. and Hendra construct a worst-case harm scenario: what is the most harmful outcome if the model makes its worst-possible recommendation to a klien, and the klien acts on it? Harm severity tiers: TIER-1 (Low): klien wastes time evaluating an irrelevant tender. TIER-2 (Moderate): klien submits a bid with an HPS estimate significantly off from the actual budget — loses time and submission cost. TIER-3 (High): klien misses a regulatory compliance deadline due to incorrect information from Knowledge Registry — faces disqualification or penalty. TIER-4 (Critical): Trust Score is incorrect for a JO partner assessment — klien enters a JO with a fraudulent or non-compliant BUJK, resulting in project failure or legal liability.", passed_failed: "No TIER-4 harm events documented in MJP's history. Highest actual harm documented: TIER-2 (HPS estimate off by 35% for 1 tender, klien submitted a non-competitive bid). Response: klien received a service credit, root cause was a data anomaly in the comparable tender set, and the anomaly detection system was improved. TIER-3 risk mitigation: all Knowledge Registry assets used for compliance decisions include a 'last verified date' and a warning if more than 60 days have passed since the last verification. Klien are explicitly told: 'for official compliance submissions, verify against primary source before relying solely on this asset.'", tc: "text-orange-700" },
            { gate: "GATE-5: Continuous monitoring — apakah model masih akuratsetelah deployment?", standard: "Post-deployment monitoring for all AI features: Hendra Jr.'s accuracy tracking runs weekly. For NLQ: random sampling of 10 user queries per week, manual review of answer quality. For Trust Score: monthly validation audit (20 BUJK). For HPS: monthly accuracy tracking against LPSE award data. Drift detection threshold: if any AI feature's accuracy drops 3 percentage points or more from its deployment baseline in any 30-day window: automatic investigation triggered. Possible causes: underlying data distribution shift (e.g. a new type of LPSE portal format that the parser handles poorly), regulatory change that makes training data outdated, or new BUJK behavior patterns that the model hasn't encountered.", passed_failed: "One accuracy drift event in MJP's history: NLQ answer quality dropped 4.2 percentage points over a 6-week period in Q2 2025. Root cause: a batch of 89 new Knowledge Registry assets added in that period had lower average source citation density than prior assets — reducing NLQ's ability to ground answers in specific evidence. Response: Sari's asset creation guidelines updated to include minimum citation density standards. NLQ quality recovered to baseline within 3 weeks of guideline update. Hendra Jr.: 'Model yang tidak dimonitor setelah deployment adalah model yang kamu deploy dan lupa. Kita tidak melupakan model kita — karena setiap model berjalan dalam produk yang klien kita taruhkan bisnis mereka.'", tc: "text-primary" },
          ].map((r) => (
            <div key={r.gate} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.gate}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Standard: {r.standard}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>History: {r.passed_failed}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">AI Ethics Committee adalah Hendra's answer to the question every AI-forward startup eventually faces: how do you deploy AI fast enough to stay competitive while being careful enough to avoid harms that damage trust? The 5-gate review process is MJP's answer — not a bureaucratic approval process, but a structured checklist that Hendra Jr. runs before every AI feature deployment. The 'committee' is currently 2 people (Hendra and Hendra Jr.): the word 'committee' reflects the intention (structured deliberation) not the headcount. Post-Series A, when MJP has a Backend Engineer and a Knowledge Research Analyst: the committee will expand to 4 people, with Sari added for GATE-3 (bias, specifically geographic knowledge gaps) and the Knowledge Research Analyst added for GATE-1 (accuracy testing, which currently falls entirely on Hendra Jr.). The 5 gates are not equally important: GATE-4 (harm analysis) and GATE-2 (explainability) are non-negotiable — MJP has never compromised on them. GATE-1 (accuracy) has flexible thresholds by use case. GATE-3 (bias) has a continuously improving standard (the 5-percentage-point gap target). GATE-5 (monitoring) is table stakes for any production AI feature. The framework's external value: when Enterprise klien or investors ask 'how do you ensure your AI doesn't mislead BUJK?' — Hendra can describe a systematic process with documented gate outcomes, not a vague commitment to 'responsible AI.' Hendra: 'AI yang bertanggung jawab bukan tentang tidak menggunakan AI. Ini tentang mengetahui secara eksplisit apa yang Anda jamin kepada pengguna Anda — dan memiliki sistem untuk memverifikasi bahwa jaminan itu terpenuhi setiap hari, bukan hanya saat peluncuran.'</p>
      </div>

      {/* R113: NLQ Cost Economics */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> NLQ COST ECONOMICS — Analisis Rp per Query dan Bagaimana MJP Menjaga NLQ Tetap Berkelanjutan Secara Ekonomi: Unit Economics Aktual, Proyeksi Biaya pada 2× Volume, dan 3 Strategi Optimasi yang Sudah Diimplementasikan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { dimension: "ECON-1: Unit economics NLQ saat ini — berapa biaya sebenarnya per query", breakdown: "NLQ query processing cost breakdown (per query, all-in): (1) LLM API call: Rp 380 average (varies by query complexity — simple factual queries Rp 180, complex multi-source synthesis queries Rp 780). The Rp 380 average: based on actual Q2 2026 API billing data (not estimated). (2) Vector search + retrieval infrastructure: Rp 45 per query (Hendra Jr.'s infrastructure cost allocation based on cloud billing). (3) Response caching infrastructure: Rp 12 per query (amortized cache storage cost). Total cost per query: Rp 437 average. NLQ query volume: 340 queries/day × 30 days = 10.200 queries/month. Total monthly NLQ cost: Rp 4.46jt/month.", revenue_per_query: "Revenue attribution: NLQ is included in Pro and Enterprise subscriptions. Direct revenue attribution is not per-query — it's bundled. Hendra Jr.'s indirect attribution: NLQ usage is the strongest predictor of retention for Pro and Enterprise subscribers (from the retrospective analysis). Without NLQ: estimated 12% higher Pro/Enterprise churn. 12% of Pro/Enterprise ARR = approximately Rp 168jt/year. NLQ's true economic contribution: Rp 168jt in annual churn prevention benefit vs Rp 53.5jt in annual direct cost = Rp 3.14 return per Rp 1 spent on NLQ infrastructure. This ROI calculation: Hendra Jr.'s primary justification for continuing to invest in NLQ cost optimization (keeping the cost low is important to preserve the ROI ratio as volume grows).", tc: "text-primary" },
            { dimension: "ECON-2: Proyeksi biaya pada 2× dan 5× volume saat ini", breakdown: "Current volume: 10.200 queries/month at Rp 437/query = Rp 4.46jt/month total. 2× volume (20.400 queries/month): WITHOUT optimization — Rp 8.92jt/month. WITH current optimizations (caching, query deduplication, model routing): Rp 6.1jt/month (68% of linear scaling, due to cache hit rate improvement at higher volume). 5× volume (51.000 queries/month): WITHOUT optimization — Rp 22.3jt/month. WITH optimizations AND additional optimization work planned for Q1 2027 (summarized in ECON-3): Rp 12.8jt/month (57% of linear scaling). The sub-linear scaling is critical for NLQ's long-term economics: if NLQ cost scaled linearly with volume, high NLQ adoption would erode MJP's margins. Sub-linear scaling: means NLQ gets more cost-efficient as it becomes more popular.", revenue_per_query: "At 5× volume: 45% of active subscribers using NLQ regularly (vs current 23%). The churn prevention value at 5× NLQ adoption: estimated Rp 420jt/year (churn reduction for the expanded NLQ user base). NLQ cost at 5× volume with optimization: Rp 153.6jt/year. ROI at 5× volume: Rp 2.73 return per Rp 1 spent — slightly lower than current ratio (Rp 3.14) due to diminishing returns on caching as queries diversify at higher volume. Still strongly positive and improving as absolute subscriber count grows.", tc: "text-blue-700" },
            { dimension: "ECON-3: 3 strategi optimasi NLQ yang sudah diimplementasikan", breakdown: "OPTIMIZATION-A: Semantic cache (implemented Q4 2024). Problem before: identical or near-identical queries from different users triggered new LLM API calls each time. Solution: semantic similarity matching for queries — if a new query is 92%+ similar to a cached query from the past 7 days, return the cached answer (with a freshness check to ensure the answer is still valid). Cache hit rate: 28% of all queries (cost saving: 28% × Rp 380 LLM cost = Rp 107 saved per cache-hit query). OPTIMIZATION-B: Model routing by query complexity (implemented Q1 2025). Problem before: all queries used the same LLM model regardless of complexity. Solution: Hendra Jr. built a query classifier that routes simple factual queries to a smaller, cheaper model (Rp 45 vs Rp 380) and only sends complex synthesis queries to the full model. Simple query share: 41% of total query volume. Cost saving from routing: Rp 138 average per simple query. OPTIMIZATION-C: Knowledge Registry pre-filtering before LLM call (implemented Q2 2025). Problem before: LLM was given a large context window of potentially-relevant assets. Solution: two-stage processing — (1) vector search narrows the context to 3–5 most relevant assets, (2) LLM only processes the pre-filtered context. Token cost reduction: 40% fewer tokens per query on average.", revenue_per_query: "Combined effect of all 3 optimizations: NLQ cost reduced from Rp 720/query (pre-optimization baseline in Q3 2024) to Rp 437/query (current) — a 39% cost reduction. The 39% reduction: achieved while simultaneously improving NLQ satisfaction rate from 74% to 84% (the model routing and pre-filtering improvements also improve answer quality, not just cost). Hendra Jr.'s principle: 'Optimasi biaya yang juga meningkatkan kualitas: itulah optimasi yang benar-benar berharga. Optimasi biaya yang mengorbankan kualitas: itu hanya transfer biaya dari infra ke churn.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.dimension} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.dimension}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Breakdown: {r.breakdown}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Revenue context: {r.revenue_per_query}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">NLQ cost economics adalah Hendra Jr.'s most important financial analysis for the AI investment case — because it converts NLQ from an intangible 'differentiation feature' into a measurable ROI calculation. The Rp 3.14 return per Rp 1 invested: a concrete number that answers the investor question 'is your AI investment paying off?' with a specific, verifiable answer rather than a narrative about competitive differentiation. The economics are favorable today and improve with scale (sub-linear cost scaling). But the most important insight from the cost analysis: NLQ's value is not in the direct revenue it generates (it's a bundled feature, not separately priced) — it's in the churn it prevents. This distinction matters for product investment decisions: if MJP evaluated NLQ purely on direct revenue contribution, it would appear to generate zero revenue. If evaluated on churn prevention value (Rp 168jt/year in retained ARR), it generates 3.14× its cost. The measurement framework: matters. Features evaluated incorrectly (wrong metric, wrong time horizon) are either under-invested in (if they look low-value on the wrong metric) or over-invested in (if the metric captures an illusory value). NLQ, evaluated on direct revenue: severely under-valued. NLQ, evaluated on churn prevention: correctly valued. Hendra Jr.'s next optimization target (Q1 2027, with the post-Series A backend engineer): OPTIMIZATION-D — result streaming. Currently, NLQ waits for the full response before delivering to the user. Result streaming (delivering the response incrementally as it's generated): reduces perceived latency from 3.2 seconds average to under 1 second for the first text. User satisfaction impact: expected +0.3 NPS points from latency improvement alone. Cost impact: neutral (streaming doesn't change total token usage). Hendra Jr.: 'Streaming adalah contoh sempurna dari optimasi yang tidak mengubah ekonomi tapi mengubah pengalaman. Kadang yang paling berharga bukan menjadi lebih murah — tapi menjadi lebih cepat.'</p>
      </div>

      {/* R114: NLQ Failure Modes */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> NLQ FAILURE MODES — 4 Cara Jawaban NLQ Bisa Salah dan Bagaimana MJP Mendeteksinya: Taksonomi Kegagalan, Rate per Mode, Sistem Deteksi Otomatis, dan Mengapa Mode Kegagalan yang Paling Berbahaya Adalah yang Terlihat Benar tapi Salah
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { mode: "FAILURE-MODE-1: Out-of-scope query — NLQ menjawab pertanyaan yang tidak seharusnya dijawab", description: "Definition: a query that falls outside MJP's Knowledge Registry scope (general construction market questions, competitor information, legal advice) where NLQ produces a response based on LLM general knowledge rather than MJP's curated assets. The danger: the response may be technically accurate but is not backed by MJP's verified, Indonesia-specific regulatory and market intelligence. Rate: approximately 8% of all NLQ queries. Detection method: query classifier that routes to 'out-of-scope response template' when query match score against Knowledge Registry assets is below 0.35. Out-of-scope response template: 'Pertanyaan ini di luar cakupan Knowledge Registry kami. Untuk topik ini, kami sarankan [relevant external resource]. Untuk pertanyaan regulasi dan intelligence yang tercakup, coba: [3 suggested in-scope questions].'", risk_level: "Risk level: MEDIUM. The out-of-scope failure is visible to users (the template response is clearly different from a full NLQ answer) and does not produce false confidence. The user knows they did not get an answer from MJP's knowledge base. The remaining 8% who receive out-of-scope responses: some try rephrasing (which sometimes produces an in-scope match), some switch to Knowledge Registry search directly (which sometimes surfaces a relevant asset), and some leave unsatisfied (counted as 'neutral' in NLQ satisfaction measurement).", tc: "text-primary" },
            { mode: "FAILURE-MODE-2: Hallucination — NLQ memproduksi informasi yang terdengar spesifik tapi tidak ada dalam Knowledge Registry", description: "Definition: NLQ generates a response that includes specific-sounding information (a specific regulation number, a specific threshold amount, a specific deadline) that is not present in any Knowledge Registry asset. Rate: approximately 3% of all NLQ queries before Hendra Jr.'s citation requirement was implemented (Q1 2024). After citation requirement (NLQ must include source asset reference for any specific claim): hallucination rate dropped to 0.4% for specific claims. Current detection: automated citation validator that checks whether cited assets actually contain the specific claim made. Any response where the claim cannot be verified in the cited asset: flagged for human review.", risk_level: "Risk level: HIGH. This is MJP's most dangerous failure mode because BUJK may act on specific incorrect information (filing a document by a deadline that is wrong, using a threshold amount that is incorrect). The citation requirement: the most important architectural fix in NLQ's history. Before citations: Hendra Jr. estimates 2–4 BUJK per month were acting on responses that contained at least 1 unverified specific claim. After citations: 2–3 per year. The residual 0.4% hallucination rate: Hendra Jr.'s most important ongoing quality target. The post-Series A engineering goal: reduce to below 0.1% through improved asset retrieval precision and citation validation.", tc: "text-red-700" },
            { mode: "FAILURE-MODE-3: Outdated information — NLQ menjawab dengan benar berdasarkan aset yang sudah tidak berlaku", description: "Definition: NLQ retrieves a Knowledge Registry asset that was accurate when it was written but has since been superseded by a regulatory update. The answer is internally consistent and properly cited — but the cited asset is outdated. Rate: approximately 1.2% of queries. Detection method: automated freshness check that alerts NLQ when the cited asset's 'last verified date' is older than the asset's declared review interval (if a regulatory asset is scheduled for 60-day review but hasn't been reviewed in 90 days: the NLQ response includes a freshness warning). Sari's maintenance backlog: the primary driver of this failure mode. When asset review backlogs grow (Sari has 127 assets to maintain), the probability of a query hitting an outdated asset increases.", risk_level: "Risk level: MEDIUM-HIGH. The outdated information failure: more dangerous than out-of-scope failure (no false confidence) but less dangerous than hallucination (at least the cited asset exists and was accurate at some point). The freshness warning: partially mitigates the risk by alerting the user that the information needs verification. Hendra Jr.'s 2026 improvement: automated regulatory source monitoring that flags when a primary source (LKPP, BNSP, PUPR) has published an update that may affect a specific Knowledge Registry asset. This automation: reduces Sari's maintenance backlog by pre-identifying which assets are most likely to be outdated after a regulatory event.", tc: "text-orange-700" },
            { mode: "FAILURE-MODE-4: Correct-but-incomplete — NLQ menjawab sebagian pertanyaan tapi melewatkan konteks kritis", description: "Definition: NLQ provides a factually accurate, properly cited answer — but misses a critical contextual qualifier that changes how the answer should be applied. Example: query about IUJK renewal requirements → NLQ correctly describes standard requirements but misses that the questioner's BUJK is in a transitional period under UU Cipta Kerja implementation where different requirements apply for a temporary 18-month period. The answer is correct for 80% of situations but wrong for the BUJK's specific situation. Rate: approximately 2.1% of queries. Detection method: user satisfaction thumbs-down rating combined with follow-up query analysis ('but what about...' follow-ups within the same session that indicate the initial answer was incomplete).", risk_level: "Risk level: MEDIUM. This is the hardest failure mode to detect automatically because the answer looks complete (proper citations, coherent prose, specific claims). The detection relies on user feedback. Hendra Jr.'s improvement strategy: 'completeness prompt engineering' — adding an explicit instruction in NLQ's system prompt to 'check for transitional provisions, exceptions, and context-specific qualifiers before finalizing any response about regulatory requirements.' The post-Series A plan: develop a 'contextual completeness evaluator' that uses a second LLM call to review the primary response for missing critical qualifiers before delivering to the user. Estimated cost increase: Rp 120/query for the second call. Estimated completeness improvement: 40% reduction in Type-4 failures. Hendra Jr.: 'Mode kegagalan yang paling berbahaya bukan yang paling sering terjadi — ini yang paling sulit dideteksi. Jawaban yang terlihat benar tapi tidak lengkap: lebih merusak kepercayaan daripada jawaban yang jelas-jelas di luar cakupan.'", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.mode} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.mode}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Description and detection: {r.description}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Risk level: {r.risk_level}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">NLQ failure modes adalah Hendra Jr.'s most rigorous quality engineering discipline — because in a regulatory intelligence product, a wrong answer has direct business consequences for BUJK (missed deadlines, incorrect compliance, invalid bids). The 4-mode taxonomy (out-of-scope, hallucination, outdated, correct-but-incomplete) covers the full failure space: Mode-1 and Mode-3 are largely detectable through system design (scope classification, freshness checks). Mode-2 (hallucination) was substantially reduced through citation architecture. Mode-4 (correct-but-incomplete) is the active frontier — the hardest to detect and the most dangerous because it produces false confidence. The overall NLQ quality metric: 16.3% of queries have some quality issue (8% out-of-scope + 0.4% hallucination + 1.2% outdated + 2.1% incomplete + 4.6% minor quality issues not in the 4 major modes). This means 83.7% of NLQ queries produce high-quality, fully reliable responses — the 84% satisfaction rate that Hendra reports to investors and uses in renewal conversations. The gap between 84% satisfaction and 83.7% technical quality: reflects that some 'quality issues' are not perceived as failures by users (an out-of-scope response that correctly redirects is perceived as 'helpful' even though it didn't answer the question). The distinction between technical quality metrics and user perception quality: both matter but for different purposes. Technical quality: drives system improvement. User perception quality: drives commercial outcomes (NPS, renewal, upgrade). Hendra Jr.'s target: 90%+ technical quality rate by Q4 2027 — primarily through Mode-4 completeness improvements and continued Mode-3 freshness automation. At 90% technical quality: MJP's NLQ would be industry-leading for a domain-specific knowledge query system operating in a complex regulatory environment.</p>
      </div>

      {/* R115: NLQ v3 Architecture Plan */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-primary" /> NLQ v3 ARCHITECTURE PLAN — Roadmap Engineering Post-Series A untuk NLQ: 4 Komponen Arsitektur Baru, Mengapa v2 Mencapai Batas Teknisnya, dan Bagaimana v3 Mempertahankan Keunggulan di Pasar Intelijen Konstruksi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { component: "NLQ-v3-COMPONENT-1: Structured Knowledge Graph menggantikan flat vector store", current_v2_limitation: "NLQ v2's core retrieval architecture: a flat vector store where all Knowledge Registry assets are embedded as dense vectors, and queries retrieve the top-k most semantically similar assets. The flat store's key limitation: it has no understanding of relationships between assets. Example: a BUJK asks 'Apa persyaratan kualifikasi untuk tender jalan senilai Rp 50 miliar?' — the correct answer requires synthesizing PP No. 16/2018 (procurement threshold), Permen PUPR No. 14/2020 (jenjang requirements for road construction), and LKPP Peraturan No. 12/2021 (qualification documentation requirements). The flat vector store retrieves each asset independently — but does not 'know' that these 3 assets are related and that the correct answer requires all 3.", v3_approach: "v3 approach: a structured knowledge graph where regulatory assets are nodes and their cross-references are explicit edges. The graph encodes relationships: 'PP No. 16/2018 amends PP No. 54/2010 for threshold values', 'Permen PUPR No. 14/2020 implements PP No. 16/2018 Section 12', 'LKPP No. 12/2021 provides documentation requirements for all procurement above PP No. 16/2018 thresholds.' The graph traversal: enables multi-hop reasoning — starting from the most semantically relevant asset and following edges to the full set of related assets. The knowledge graph: directly addresses Mode-4 failures (correct-but-incomplete responses) by ensuring that related assets are retrieved together, not independently.", tc: "text-primary" },
            { component: "NLQ-v3-COMPONENT-2: Query intent classification sebelum retrieval", current_v2_limitation: "NLQ v2's query processing: all queries go through the same retrieval pipeline regardless of intent. A factual query ('Berapa nilai threshold tender untuk pengadaan langsung?') and a procedural query ('Bagaimana cara mendaftar SKK jenjang-9?') and an analytical query ('Apa perbedaan antara jenis kontrak lump sum dan unit price?') — all processed identically. The retrieval pipeline: optimized for factual queries (highest volume). For procedural and analytical queries: the same pipeline produces noticeably lower quality responses because procedural queries need step-by-step content (not just the most semantically similar asset) and analytical queries need comparative content (not just the most relevant single asset).", v3_approach: "v3 approach: a 3-class query intent classifier (factual / procedural / analytical) runs before retrieval. Each class routes to a different retrieval strategy: factual → fast vector lookup (current v2 approach, already well-optimized). Procedural → knowledge graph path traversal starting from the relevant regulation or process, following 'implements' and 'requires' edges to build a complete step sequence. Analytical → comparative retrieval (intentionally fetching 2+ assets that cover different aspects of the analytical question for synthesis comparison). The intent classifier: trained on Hendra Jr.'s labeled query log (3.000+ queries from MJP's NLQ history, manually classified by Hendra Jr. and Sari over 3 weeks). Hendra Jr.: 'Satu pipeline untuk semua jenis query: seperti menggunakan alat yang sama untuk palu, gergaji, dan obeng. Efisiensi yang terasa masuk akal sampai kamu melihat kualitas hasilnya.'", tc: "text-blue-700" },
            { component: "NLQ-v3-COMPONENT-3: Subscriber context layer — personalisasi retrieval berdasarkan profil BUJK", current_v2_limitation: "NLQ v2's retrieval: context-free. Every subscriber asking the same question receives the same response, regardless of their KBLI profile, jenjang, or geographic focus. A jenjang-7 BUJK in Surabaya and a jenjang-9 BUJK in Jakarta asking 'Apa persyaratan kualifikasi tender senilai Rp 50 miliar?' have the same question but different correct answers (different jenjang requirements apply). v2 produces one answer — which is correct for one subscriber and potentially misleading for the other.", v3_approach: "v3 approach: a subscriber context layer that injects the subscriber's KBLI profile and jenjang into the query before retrieval. The injection: not visible to the subscriber (the query 'Apa persyaratan kualifikasi untuk tender Rp 50 miliar?' becomes internally 'Apa persyaratan kualifikasi untuk [jenjang-7 BUJK dengan KBLI 4110] pada tender senilai Rp 50 miliar?'). The context injection: routes the query to assets that are relevant to the subscriber's specific profile rather than the broadest possible interpretation of the question. For queries that genuinely don't depend on subscriber profile (e.g. 'Kapan LKPP terakhir memperbarui regulasi pengadaan?'): the context injection has no effect (the classifier identifies profile-independent queries and bypasses context injection). Hendra Jr.'s estimate: approximately 35% of NLQ queries are profile-dependent — for this 35%, subscriber context injection will produce meaningfully more relevant responses.", tc: "text-emerald-700" },
            { component: "NLQ-v3-COMPONENT-4: Continuous quality monitoring dan automated regression detection", current_v2_limitation: "NLQ v2's quality monitoring: manual. Hendra Jr. conducts quarterly manual audits of 50 randomly sampled queries, classifying each into the 4 failure modes. The quarterly cadence: means a new failure mode or quality regression can persist for up to 3 months before being detected. Example: when a new LKPP regulation was published in Q3 2024 that made 8 Knowledge Registry assets partially outdated (Mode-3 failures), the outdated responses persisted for 6 weeks before Sari caught them during a routine Knowledge Registry review — not through the NLQ quality monitoring process.", v3_approach: "v3 approach: an automated quality monitoring pipeline that runs after every Knowledge Registry update. When Sari updates an asset: the monitor automatically re-runs a sample of queries that previously cited the updated asset and checks whether the new response cites the updated version (Mode-3 check) and whether the response completeness has changed (Mode-4 check). Any quality regression: creates a notification in the Dashboard's scheduler history panel (reusing the existing notification infrastructure). The monitor: catches the Q3 2024-type regression within hours of the asset update rather than weeks. Hendra Jr.'s long-term v3 vision: 'Sistem monitoring NLQ yang baik bukan yang memberi tahu kami ketika NLQ rusak — itu yang memberi tahu kami sebelum pelanggan tahu bahwa itu rusak. Jarak antara kegagalan dan deteksi: itulah yang kami minimimalkan.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.component} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.component}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">v2 limitation: {r.current_v2_limitation}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>v3 approach: {r.v3_approach}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">NLQ v3 architecture plan adalah Hendra Jr.'s post-Series A engineering ambition — the system that will sustain MJP's AI differentiation as the BUJK intelligence market matures and well-funded competitors begin building NLQ capabilities. The 4-component v3 architecture (knowledge graph, intent classification, subscriber context layer, continuous quality monitoring) addresses the 4 most significant limitations of v2 — each directly mapped to a failure mode or quality ceiling. The knowledge graph: addresses Mode-4 (completeness) failures. Intent classification: addresses the quality gap between factual, procedural, and analytical queries. Subscriber context: addresses the profile-independence limitation that produces misleading responses for the wrong jenjang or KBLI. Continuous monitoring: addresses the detection latency that allows quality regressions to persist for weeks. The v3 development timeline: 18 months post-Series A. The knowledge graph: requires Sari's team to add explicit relationship metadata to all 127 current Knowledge Registry assets (estimated 3–4 months of Sari + Knowledge Analyst work). The intent classifier: requires completing Hendra Jr. and Sari's 3.000-query labeling project (already in progress, estimated 2 months to completion). The subscriber context layer: relatively fast to implement once the classifier is in place (estimated 6 weeks of engineering). The continuous monitoring pipeline: 3 months of engineering, with infrastructure shared with the existing scheduler monitoring system. The v3 investment: Rp 200–250jt in additional engineering time (primarily Hendra Jr. + one new backend engineer). The ROI case: v3 is the primary feature justification for the Enterprise tier upgrade campaign post-Series A. If v3 improves Mode-4 completeness from 83.7% to 90%+ technical quality: MJP's NLQ becomes genuinely irreplaceable for BUJK whose compliance questions require multi-regulation synthesis — the use case that large BUJK (jenjang-9, BUJK asosiasi leads) care about most, and the use case that drives Enterprise tier subscription at Rp 2.5jt/month.</p>
      </div>

      {/* R116: NLQ Accessibility for Varied Digital Literacy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Accessibility className="h-3.5 w-3.5 text-primary" /> NLQ ACCESSIBILITY FOR VARIED DIGITAL LITERACY — Bagaimana NLQ Dirancang untuk BUJK dengan Literasi Digital Berbeda: 4 Desain Aksesibilitas, Hambatan yang Tersisa, dan Rencana Menghilangkan Barrier Terakhir Sebelum NLQ Mencapai 100% Aktivasi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { accessibility_design: "ACCESSIBILITY-DESIGN-1: Bahasa Indonesia alami — tidak ada jargon teknis dalam interface NLQ", design_detail: "The most foundational NLQ accessibility decision: the interface language is natural Indonesian, without technical terminology. The NLQ input prompt: 'Tanyakan apa saja tentang regulasi, tender, atau pasar konstruksi Indonesia.' Not: 'Enter a natural language query.' Not: 'Search the knowledge base.' Not: 'Ask AI.' The word 'AI': deliberately absent from the NLQ interface label in the Basic and Pro tiers (where lower digital literacy is more common). Enterprise tier: the word 'AI' appears in the NLQ documentation but not in the primary interface label. The rationale: 'AI' carries both positive connotations (sophisticated, advanced) and negative ones (unreliable, 'hallucinates') among Indonesian BUJK. BUJK who are skeptical of AI: more likely to trust 'tanyakan apa saja' (ask anything) than to trust 'AI query interface.'", barrier_addressed: "Barrier addressed: cognitive distance between BUJK and the NLQ interface. A BUJK owner who has never used an AI chatbot: feels comfortable asking a question in natural Indonesian. The same BUJK confronted with 'AI query interface': may not know what 'query interface' means or may feel that their question is not 'sophisticated enough' for an AI system. The natural language label: removes the sophistication signal that creates hesitation. First-week NLQ activation rate for Basic tier subscribers: 61% (up from 28% before example queries and language simplification were implemented). The remaining 39% who don't activate NLQ in their first week: the current accessibility frontier.", tc: "text-primary" },
            { accessibility_design: "ACCESSIBILITY-DESIGN-2: Pertanyaan contoh yang berputar — mengajarkan format tanpa mendidik secara eksplisit", design_detail: "The rotating example query panel: shows 3 example questions before the NLQ input field, cycling through a library of 40+ real subscriber queries (anonymized and permission-cleared). The examples rotate on each page load, exposing different subscribers to different question types. Example rotation categories: (1) Factual lookup ('Berapa nilai maksimum pengadaan langsung jasa konstruksi?'), (2) Procedural how-to ('Apa langkah-langkah mendaftar SKK jenjang-8?'), (3) Regulatory comparison ('Apa perbedaan IUJK-N dan IUJK-P?'), (4) Situational ('Apakah BUJK jenjang-7 bisa mengikuti tender senilai Rp 2.5 miliar?'). The 4 category coverage: ensures every subscriber sees examples relevant to their immediate question type within 3 page loads.", barrier_addressed: "Barrier addressed: 'I don't know what to ask' paralysis. BUJK who have never formulated a question to an AI system: often experience blank-page paralysis in front of an empty query field. The rotating examples: solve blank-page paralysis by demonstrating that questions are ordinary Indonesian sentences about their specific problems — not technical formulations requiring special knowledge. The rotation mechanism: intentional (vs showing the same examples always). A BUJK who returns to the NLQ page multiple times: sees different examples that may trigger a question they hadn't previously considered. Hendra Jr.'s observation from click tracking: 23% of NLQ queries are submitted within 15 seconds of an example appearing — indicating the example directly triggered the query.", tc: "text-blue-700" },
            { accessibility_design: "ACCESSIBILITY-DESIGN-3: Response format adaptation — jawaban ringkas untuk mobile, lengkap untuk desktop", design_detail: "NLQ response formatting: adaptive based on device type. Mobile responses: shorter (under 200 words), bulleted key points, single primary citation. Desktop responses: full-length (300–500 words), full prose explanation, up to 3 citations. The adaptation: not a user-controlled toggle (which creates mode confusion as the retired 'simplified mode' toggle demonstrated) but an automatic device-type detection. The rationale: mobile BUJK users (predominantly lower digital literacy, more time-constrained) benefit from concise, actionable responses. Desktop users (predominantly Enterprise subscribers using MJP at desk during office hours) benefit from thorough explanations with full context.", barrier_addressed: "Barrier addressed: cognitive overload for mobile BUJK users. A 500-word NLQ response on a mobile screen: requires significant scrolling and sustained attention — two things that field-condition BUJK users have limited patience for. The mobile-adapted response: delivers the same core answer in 200 words. The same query from a desktop: delivers the full regulatory context that Strategic Analyst archetype subscribers need. The content of the answer: identical in both formats. The presentation: adapted to the reading context. Hendra Jr.'s most important finding from the adaptive formatting A/B test: mobile NLQ re-usage rate (returning to NLQ within 7 days after first query) increased 41% for mobile users after adaptive formatting was implemented. Desktop re-usage rate: unchanged (desktop users already had good retention). The 41% mobile re-usage increase: the clearest evidence that presentation format, not just answer quality, determines whether lower-literacy users incorporate NLQ into their workflow.", tc: "text-emerald-700" },
            { accessibility_design: "ACCESSIBILITY-DESIGN-4: WhatsApp NLQ — akses NLQ tanpa membuka aplikasi (rencana post-Series A)", design_detail: "The unbuilt accessibility design: a WhatsApp-based NLQ interface that allows BUJK to send questions directly to MJP's WhatsApp Business number and receive NLQ responses via WhatsApp message. The rationale: BUJK who have limited data plans, lower smartphone storage capacity (can't install another app), or simply prefer WhatsApp as their primary digital interface (which is 90%+ of Indonesian smartphone users) can access NLQ intelligence without opening a browser or the MJP platform. The WhatsApp NLQ: routes the message to MJP's NLQ backend, retrieves the Knowledge Registry response, and sends a mobile-formatted reply. The authentication: WhatsApp number linked to the subscriber's account during onboarding.", barrier_addressed: "Barrier addressed: platform access barrier — the deepest accessibility layer. The 39% of Basic tier subscribers who haven't activated NLQ in their first week: some have the digital literacy to use NLQ if they tried it, but many have an access barrier (they use MJP via the morning briefing on WhatsApp but rarely open the platform app for active queries). WhatsApp NLQ: removes the 'open the app' friction entirely, meeting BUJK at the interface they already use. Hendra's estimate: WhatsApp NLQ would increase NLQ activation from 61% to approximately 78% of Basic tier subscribers, and from 79% to approximately 88% of Pro tier — primarily by reaching the platform-access-resistant segment. The development cost: 3 months post-Series A (WhatsApp Business API integration with authentication linking). The commercial value: 17+ percentage points of NLQ activation improvement across the subscriber base = higher NPS, higher retention, and a clear Enterprise upgrade trigger for Pro subscribers who become heavy WhatsApp NLQ users.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.accessibility_design} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.accessibility_design}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Design detail: {r.design_detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Barrier addressed: {r.barrier_addressed}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">NLQ accessibility for varied digital literacy adalah Hendra Jr.'s most empathy-intensive engineering discipline — because the NLQ's technical sophistication (vector retrieval, citation architecture, knowledge graph traversal in v3) is entirely invisible to the BUJK who benefits from it. What the BUJK experiences: a text box where they type an ordinary question in Indonesian and receive a useful answer within 3 seconds. The entire engineering iceberg: below the surface of that interaction. But the accessibility designs above (natural language labeling, rotating examples, adaptive formatting, planned WhatsApp integration) are the designs that determine whether the BUJK ever reaches the text box at all. Technical sophistication without accessibility: like building a stadium but making the entrance too complicated to find. The 4 accessibility designs collectively moved NLQ activation from 28% (Basic tier, before 2024 accessibility improvements) to 61% (current). The remaining 39%: Hendra Jr.'s current engineering challenge. Of the 39% non-activators: Hendra Jr.'s user session analysis suggests 3 approximately equal-sized groups. Group A (13%): tried NLQ, received an unsatisfactory answer (a Mode-1, Mode-2, Mode-3, or Mode-4 failure), and stopped using it. These users: retained through NLQ quality improvement (v3 architecture). Group B (13%): visited the NLQ interface but didn't submit a query (blank-page or access barrier users). These users: retained through accessibility improvement (rotating examples, WhatsApp NLQ). Group C (13%): have never visited the NLQ interface despite being active subscribers (they use other MJP features but not NLQ). These users: retained through in-product discovery features (a 'Did you know you can ask any regulatory question?' contextual prompt in the morning briefing footer, scheduled for Q2 2026 implementation). The 3-segment strategy: addresses each non-activator group with a targeted intervention rather than a generic 'improve NLQ' initiative.</p>
      </div>

      {/* R117: NLQ Query Log as Product Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5 text-primary" /> NLQ QUERY LOG SEBAGAI PRODUCT INTELLIGENCE — Apa yang 3.000+ Query Mengungkapkan tentang Kebutuhan yang Belum Terpenuhi: 3 Kategori Insight dari Query Log, Temuan Paling Mengejutkan Hendra Jr., dan Bagaimana Query Log Membentuk Roadmap Produk
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { category: "QUERY-INSIGHT-1: Topik dengan volume tinggi tapi tanpa aset Knowledge Registry — gap konten yang tidak terdeteksi", discovery: "The query log's most commercially valuable insight: topics where BUJK are asking substantive questions but MJP has no Knowledge Registry asset to cite in the response. These queries: produce Mode-4 responses (incomplete or acknowledgment-only responses — 'I cannot find specific information about this topic in MJP's Knowledge Registry'). The gap discovery mechanism: Hendra Jr. analyzes Mode-4 queries quarterly, groups them by topic, and flags topics with 10+ Mode-4 queries/month as 'confirmed Knowledge Registry gaps.' The confirmed gaps feed directly into Sari's new asset creation queue.", top_gaps_discovered: "Top Knowledge Registry gaps discovered through query log analysis (Q1–Q2 2026): (1) IUJK regional office registration procedures by province (47 Mode-4 queries/month — BUJK asking about specific provincial IUJK requirements that vary from national standards). This gap: fed directly into Sari's 'Regional Nuance' roadmap item and the provincial expansion support product design (from R117 contractors panel). (2) SKK renewal timeline by LSP and current processing backlog (31 Mode-4 queries/month — BUJK asking when they can expect their renewed certificate given current LSP queue). This gap: fed into Reza's SKK Express product design (real-time LSP processing time estimates are now a feature on the SKK page). (3) Subcontractor qualification requirements for Tier-1 and Tier-2 subcontractors (28 Mode-4 queries/month). This gap: a new Knowledge Registry asset Sari has queued for Q3 2026 production.", tc: "text-primary" },
            { category: "QUERY-INSIGHT-2: Topik yang dicari pada waktu tertentu — korelasinya dengan siklus pengadaan", discovery: "The query log's most operationally interesting insight: query topic distribution shifts significantly with the procurement calendar. Hendra Jr.'s quarterly analysis: overlays query volume by topic against the national procurement calendar (which MJP tracks as part of the Sari's Practical Procurement Calendar Knowledge Registry asset). The pattern: specific topics spike predictably during procurement phase transitions. Qualification questions (IUJK, SKK) spike 6–8 weeks before major tender season openings (as BUJK rush to complete qualification renewals). Tender analysis questions spike at tender publication peaks. Regulatory interpretation questions spike 2–4 weeks after new regulation publications.", top_gaps_discovered: "The calendar correlation finding: the NLQ response system should be pre-loaded with the highest-probability queries for each procurement calendar phase. Hendra Jr.'s implementation: 2 weeks before each major tender season opening, the NLQ system automatically refreshes the 'pre-retrieved context window' with the top 20 qualification-related query responses — so they are served with sub-1-second latency rather than the standard 1.8-second vector retrieval time. This pre-loading: a practical performance optimization driven by query log analysis, not a theoretical architecture improvement. The calendar correlation also informs the Morning Briefing: Sari schedules content to 'pre-answer' NLQ spikes (a Section 3 regulatory deep-dive on qualification requirements published 3 weeks before tender season: reduces the subsequent NLQ spike by approximately 30% for qualification-related queries). The briefing and NLQ: increasingly coordinated as complementary intelligence channels rather than independent features.", tc: "text-blue-700" },
            { category: "QUERY-INSIGHT-3: Pola bahasa query — bagaimana BUJK berbicara tentang masalah mereka", discovery: "The query log's most product-design-relevant insight: the specific vocabulary, sentence structure, and question framing that BUJK use when they ask questions. Hendra Jr.'s linguistic analysis: identifies the most common question patterns and vocabulary used by BUJK who receive high-quality (Mode-1) NLQ responses vs those who receive incomplete (Mode-3/4) responses. The finding: BUJK who use formal regulatory vocabulary ('persyaratan kualifikasi Peraturan LKPP Nomor 12 Tahun 2021') receive better responses than BUJK who use informal operational vocabulary ('syarat ikut tender proyek PUPR di Jateng'). The vocabulary gap: reflects MJP's Knowledge Registry indexing language (formal regulatory terms) vs BUJK's natural problem-description language (informal operational terms).", top_gaps_discovered: "The linguistic analysis finding: drove the semantic synonym expansion in NLQ v2 (the Knowledge Registry indexing now maps informal BUJK vocabulary to formal regulatory terms during query processing — so 'syarat ikut tender' is semantically expanded to include 'persyaratan kualifikasi pengadaan' at retrieval time). The effect: Mode-1 response rate increased from 52% to 61% for queries using informal vocabulary. The most important vocabulary insight: BUJK rarely ask 'what is the regulation about X?' They ask 'can I do X?' or 'what do I need to do X?' — problem-framing, not regulation-lookup framing. MJP's NLQ: reoriented toward practical problem-framing responses (answering 'what you need to do X' rather than 'the regulation says Y') in v2.1. Hendra Jr.'s most surprising query log finding: 14% of all NLQ queries are not about regulatory compliance, tender processes, or competitive intelligence (MJP's 3 designed use cases) — they are about BUJK business strategy ('how do I increase my Trust Score?', 'what jenjang should I target for my company size?', 'which regions are least competitive for my KBLI category?'). This 14%: the natural language articulation of pain points that MJP was not designed to address but which BUJK are seeking help with. Hendra Jr.'s framing: 'Query log yang paling berharga: bukan yang mengkonfirmasi apa yang sudah kami bangun, melainkan yang mengungkapkan apa yang belum kami bangun. 14% query strategi bisnis itu: daftar backlog produk yang ditulis dalam bahasa BUJK itu sendiri.'", tc: "text-emerald-700" },
        ].map((r) => (
            <div key={r.category} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.category}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Discovery mechanism: {r.discovery}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Top gaps / findings: {r.top_gaps_discovered}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">NLQ query log as product intelligence adalah Hendra Jr.'s most underrated engineering artifact — because the query log is simultaneously a technical performance record (which queries fail and why) and a product research instrument (what problems BUJK are trying to solve in their own words). The 3 insight categories (topik gap, kalender korelasi, pola bahasa) collectively give MJP a 360-degree view of NLQ's interaction with its users that no survey or interview can replicate: the query log captures what BUJK actually ask, not what they say they would ask. The most commercially important query log finding: the 14% business strategy queries (what MJP wasn't designed to answer) represent a genuine product opportunity. If MJP's next major product pillar addresses strategic BUJK decision-support (provincial expansion decisions, bid portfolio strategy, Trust Score improvement planning): the query log has already validated the demand without a single user research interview. The 3.000+ queries: the most authentic product discovery dataset MJP has. The query log analysis: a continuous product discovery practice, not a one-time analysis. Hendra Jr. runs the quarterly analysis not because the product roadmap needs new items (it has more than it can build) but because the query log is MJP's clearest signal of where subscriber needs are evolving. A topic that was rare in 2022's query log and is now generating 30+ queries/month: the market is signaling a new priority. MJP's ability to detect and respond to that signal faster than competitors (who don't have a 5-year query log with 3.000+ data points): the NLQ's contribution to competitive intelligence that has nothing to do with its response quality and everything to do with what subscribers reveal when they think they're just asking a question.</p>
      </div>

      {/* R118: NLQ Competitive Advantage Durability */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> NLQ COMPETITIVE ADVANTAGE DURABILITY — Mengapa Keunggulan NLQ MJP Sulit Ditiru Kompetitor: 4 Lapisan Pertahanan, Estimasi Waktu Replikasi untuk Setiap Lapisan, dan Strategi Hendra untuk Memperlebar Gap Setiap Kuartal
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { layer: "LAYER-1: Knowledge Corpus Depth — 5 tahun konten terstruktur dari Sari", replication_time: "18–24 bulan minimum untuk kompetitor baru membangun corpus yang sebanding — bukan hanya volume, tapi kualitas struktur (setiap Knowledge Asset di-tag manual oleh Sari dengan metadata regulasi, kategori BUJK, dan relevansi regional yang tidak bisa di-scrape secara otomatis).", hendra_strategy: "Sari menambahkan 8–12 Knowledge Asset baru per bulan (lihat Editorial Calendar dari R117). Setiap bulan yang berlalu: kompetitor tertinggal 8–12 asset lagi. Hendra Jr.'s compounding rule: corpus gap bukan linier — asset baru memperkuat relevansi asset lama via cross-linking, sehingga nilai marginal setiap asset baru lebih tinggi dari asset sebelumnya.", tc: "text-primary" },
            { layer: "LAYER-2: Query Log Training Data — 3.000+ query nyata dari BUJK Indonesia", replication_time: "36+ bulan: kompetitor butuh basis subscriber aktif yang mau menggunakan NLQ-nya dulu, baru bisa mengakumulasi query log sebanding. Tanpa query log, mereka hanya bisa fine-tune model generik — bukan model yang dikalibrasi pada pola pikir dan terminologi BUJK Indonesia.", hendra_strategy: "Hendra Jr. menggunakan query log sebagai fine-tuning dataset setiap kuartal (bukan tahunan). Setiap fine-tuning cycle: model NLQ MJP makin presisi pada terminologi BUJK dan pola pertanyaan aktual. Kompetitor yang memulai hari ini: akan selalu fine-tune terhadap dataset yang lebih tua, lebih kecil, dan lebih generik.", tc: "text-blue-700" },
            { layer: "LAYER-3: BUJK Behavioral Context — profil subscriber yang terakumulasi dari interaksi NLQ", replication_time: "Tidak bisa di-replikasi tanpa subscriber yang sama: ini adalah keunggulan network-effect. Semakin banyak subscriber MJP menggunakan NLQ, semakin MJP memahami behavioral pattern per segmen BUJK (jenjang-7 vs jenjang-9, Jakarta vs Makassar, infrastruktur vs gedung). Kompetitor tidak bisa membeli atau men-scrape behavioral context ini.", hendra_strategy: "Post-Series A: Hendra Jr. berencana membangun 'subscriber-aware NLQ' — dimana NLQ meresponse berbeda berdasarkan profil subscriber (BUJK kecil di Sulawesi mendapat jawaban dengan konteks regional yang relevan, berbeda dari BUJK besar di Jakarta yang bertanya hal yang sama). Ini membuat NLQ MJP semakin personalized dan kompetitor semakin jauh tertinggal.", tc: "text-emerald-700" },
            { layer: "LAYER-4: Integration Lock-in — NLQ tertanam di dalam workflow SKK Express, Trust Score, dan Tender Alert", replication_time: "Kompetitor bisa build NLQ standalone dalam 6–12 bulan. Tapi mereka tidak bisa build NLQ yang terintegrasi dengan SKK tracking, Trust Score, dan tender alert dalam periode yang sama — karena integrasi ini membutuhkan data dari semua modul yang sudah mature. MJP membangun integrasi ini selama 4 tahun.", hendra_strategy: "Setiap modul baru yang ditambahkan ke platform MJP (post-Series A: IKN Intelligence Tier, Province Intelligence Report): secara otomatis menjadi sumber context yang memperkaya NLQ responses. The flywheel: platform breadth memperkuat NLQ depth, dan NLQ depth memperkuat platform stickiness.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.layer} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.layer}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Replication time: {r.replication_time}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Hendra's strategy: {r.hendra_strategy}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">NLQ competitive advantage durability adalah Hendra's most strategically important technical investment thesis — because the NLQ is not just a feature, it is a compounding moat. Each of the 4 layers reinforces the others: corpus depth improves NLQ response quality, which increases query volume, which grows the query log training dataset, which improves fine-tuning quality, which increases subscriber engagement, which deepens behavioral context, which enables integration personalization, which increases platform stickiness, which retains subscribers, which continue querying, which grow the corpus further. The compounding cycle: a self-reinforcing flywheel that gets harder to interrupt with every passing quarter. The most important strategic implication for MJP's Series A pitch: NLQ is not described as an 'AI chat feature' (a feature any competitor can build in 6 months). NLQ is described as 'a 5-year compounding knowledge infrastructure built on 3.000+ validated BUJK queries, a Sari-curated corpus of 200+ assets, and behavioral context from 487 active subscribers that no competitor can replicate without first replicating MJP's entire subscriber relationship history.' The 4-layer framing converts a feature conversation into a moat conversation — and moat conversations are the ones that justify Series A valuations. Hendra's quarterly NLQ durability review: checks the gap in each layer (how many months ahead is MJP vs the nearest competitor for each layer). The goal: widen every gap every quarter. The current status: Layer 1 gap = 20+ months, Layer 2 gap = 36+ months, Layer 3 gap = uncloseable without MJP's subscriber base, Layer 4 gap = platform-wide. The NLQ's competitive advantage: the strongest single argument for MJP's defensibility in the Series A materials.</p>
      </div>

      {/* R119: NLQ Confidence Scoring */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-primary" /> NLQ CONFIDENCE SCORING — Kapan Sistem Menjawab Langsung vs Kapan Ia Eskalasi ke Manusia: 4 Confidence Level, Threshold Keputusan Setiap Level, dan Mengapa Mengatakan 'Saya Tidak Tahu' dengan Tepat Lebih Berharga dari Menjawab Salah dengan Yakin
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { level: "CONF-LEVEL-1: High Confidence (skor 0.85+) — sistem menjawab langsung tanpa kualifikasi", threshold_definition: "Threshold: NLQ returns a direct answer when the retrieval score from the Knowledge Registry exceeds 0.85 (Hendra Jr.'s calibrated threshold based on 3.000+ query validation). At 0.85+: the top-retrieved Knowledge Asset is highly relevant to the query (confirmed by the KR asset's topic tags, regulatory domain classification, and semantic similarity score to the query). The answer: delivered as a direct statement ('Berdasarkan SE LKPP No. 3/2026: TKDN minimum untuk pengadaan alat berat di atas Rp 200jt adalah 40%.') without hedging language.", engineering_design: "Hendra Jr.'s design decision: the 0.85 threshold was calibrated by running all 3.000+ historical queries through the retrieval system and manually validating the top-100 high-confidence answers for accuracy. Finding: at 0.85+, the answer accuracy rate was 97.3%. Below 0.85: accuracy dropped rapidly (at 0.70: 83%, at 0.60: 71%). The 0.85 threshold: the point where confident direct answers are justified. Queries resolved at HIGH CONFIDENCE: 54% of all NLQ queries (an improvement from 38% when NLQ launched in 2022 — reflecting 4 years of Knowledge Registry growth and retrieval system refinement). The HIGH CONFIDENCE answer rate: the single most important NLQ quality metric Hendra Jr. tracks.", tc: "text-primary" },
            { level: "CONF-LEVEL-2: Medium Confidence (skor 0.65–0.84) — sistem menjawab dengan kualifikasi eksplisit", threshold_definition: "Threshold: NLQ returns an answer with an explicit qualifier ('Berdasarkan informasi terkini kami per [date], pemahaman kami adalah...') when the retrieval score is between 0.65 and 0.84. The qualifier: signals to the subscriber that the answer reflects MJP's best available analysis but that independent verification is recommended for high-stakes decisions. The answer: still derived from Knowledge Registry assets (not a refusal to answer), but the confidence qualifier sets appropriate expectations.", engineering_design: "Hendra Jr.'s design decision: the medium confidence range (0.65–0.84) was the most debated threshold in NLQ's design process. The debate: should MJP answer at this confidence level or refuse to answer until a relevant Knowledge Asset is created? Hendra's resolution: refusing to answer at 0.65–0.84 creates a worse user experience than answering with qualifications — a subscriber who gets a qualified answer can evaluate the qualification and decide whether to seek additional verification. A subscriber who gets 'tidak ditemukan': has no information at all and may conclude incorrectly that the regulation doesn't exist. The qualified answer at medium confidence: the 'honest helpful' design choice. Queries resolved at MEDIUM CONFIDENCE: 19% of all NLQ queries.", tc: "text-blue-700" },
            { level: "CONF-LEVEL-3: Low Confidence (skor 0.45–0.64) — sistem menampilkan related context tapi menandai gap", threshold_definition: "Threshold: NLQ returns related Knowledge Registry content with an explicit 'NLQ Gap Notice' ('Kami belum memiliki Knowledge Asset yang secara spesifik membahas pertanyaan ini. Konten terkait yang mungkin membantu: [3 related assets listed]. Jika pertanyaan ini penting untuk keputusan bisnis Anda, hubungi tim kami atau gunakan sumber primer.') when the retrieval score is between 0.45 and 0.64. The gap notice: also feeds directly into Hendra Jr.'s NLQ gap analysis queue — low confidence queries are categorized by topic and reported to Sari's editorial calendar as Knowledge Registry gap candidates.", engineering_design: "Hendra Jr.'s design decision: the gap notice mechanism is the most commercially valuable feature of the LOW CONFIDENCE tier. A system that silently fails (returns a low-confidence answer without flagging the gap) misses the opportunity to turn a product failure (can't answer the question) into product intelligence (we now know there's a gap in this topic area). The gap notice: converts every LOW CONFIDENCE query into a Knowledge Registry editorial input. The 27% of queries that return LOW CONFIDENCE or ZERO CONFIDENCE responses: not failures in the traditional sense but a continuous product improvement pipeline. Sari's quarterly editorial calendar review: begins with the top-10 topics from the LOW CONFIDENCE queue — the market is directly telling MJP what to write next.", tc: "text-emerald-700" },
            { level: "CONF-LEVEL-4: Zero Confidence (skor dibawah 0.45) — sistem mengeskalasi ke Reza untuk human response", threshold_definition: "Threshold: NLQ escalates to human response when no retrieved Knowledge Asset scores above 0.45 (meaning no relevant KR content exists for the query). The escalation path: an automated message to the subscriber ('Pertanyaan ini di luar cakupan pengetahuan saat ini kami. Tim kami (Reza) akan memberikan respons dalam 24 jam kerja.') paired with an internal alert to Reza's customer success queue. For Enterprise subscribers: Reza responds personally within 4 hours. For Pro subscribers: within 24 hours. For Standard subscribers: a response from Sari's editorial team within 48 hours (or, if the question indicates a KR gap that serves the broader subscriber base, a Knowledge Asset is created and shared proactively).", engineering_design: "Hendra Jr.'s design decision: the human escalation at ZERO CONFIDENCE is the most important design choice in NLQ's architecture — because it prevents the worst outcome in enterprise B2B AI tools: confidently wrong answers to high-stakes questions. A BUJK who relies on an NLQ answer about TKDN thresholds and submits a non-compliant tender based on that answer: suffers real financial harm (disqualification, bond forfeiture, reputational damage with the procuring agency). MJP's responsibility at ZERO CONFIDENCE: acknowledge the knowledge gap, escalate to human expertise, and resolve the gap permanently through editorial response. The 0.45 threshold: set low enough that only genuinely unknown topics reach human escalation (preserving Reza's capacity), but high enough that uncertain answers never reach subscribers without appropriate qualification. ZERO CONFIDENCE queries: approximately 8% of all NLQ queries — a number that decreases each year as Knowledge Registry coverage expands.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.level} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.level}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Threshold definition: {r.threshold_definition}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Engineering design: {r.engineering_design}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">NLQ confidence scoring adalah Hendra Jr.'s most important product integrity decision — because in an AI product serving B2B customers who make high-stakes financial decisions, the cost of a confidently wrong answer is orders of magnitude higher than the cost of a calibrated uncertain answer. The 4 confidence levels (HIGH direct answer, MEDIUM qualified answer, LOW gap notice, ZERO human escalation): map to a trust calibration that grows with use. Subscribers who experience HIGH CONFIDENCE answers: learn that MJP's direct answers are accurate (97.3% reliability). Subscribers who experience MEDIUM CONFIDENCE answers: learn that MJP's qualified answers are honest about their limitations. Subscribers who experience LOW CONFIDENCE gap notices: learn that MJP is transparent about knowledge boundaries rather than bluffing. Subscribers who experience ZERO CONFIDENCE escalations: learn that MJP has human experts available for questions the system can't answer. The cumulative effect of all 4 responses: a trust calibration that makes subscribers more confident in HIGH CONFIDENCE answers (because they've seen the system acknowledge uncertainty appropriately in other interactions). The trust calibration: the most commercially valuable consequence of the confidence scoring system. An NLQ that always responds with apparent confidence (hiding uncertainty behind fluent language): trains subscribers to treat all answers as equally reliable — which means they stop verifying even the genuinely uncertain ones. MJP's NLQ confidence transparency: the architectural choice that converts NLQ from 'a chatbot that sometimes gives wrong answers' into 'an intelligence system that tells you how confident it is so you can make appropriately calibrated decisions.' The difference: not a feature, it is a philosophy. Hendra Jr.'s engineering principle: 'Lebih baik terlihat tidak tahu daripada terlihat yakin tapi salah. Kepercayaan dibangun dari ketepatan kalibrasi, bukan dari keyakinan yang dipaksakan.'</p>
      </div>

      {/* R120: NLQ Expansion Roadmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> NLQ EXPANSION ROADMAP — 3 Domain Data Baru yang Direncanakan Hendra untuk Knowledge Index Post-Series A: Justifikasi Domain, Tantangan Integrasi, dan Bagaimana Setiap Ekspansi Melipatgandakan Nilai NLQ untuk Subscriber
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { domain: "EXPANSION-DOMAIN-1: IKN Project Database — database proyek Ibu Kota Nusantara yang terintegrasi ke NLQ", domain_justification: "The IKN opportunity: Indonesia's capital relocation project (Ibu Kota Nusantara in Kalimantan Timur) represents the largest construction procurement opportunity in Indonesian history — estimated Rp 466 trillion in total project value over 20 years, with Rp 120+ trillion in projects announced for 2025–2030 alone. Current NLQ coverage of IKN: partial — Knowledge Registry has IKN regulatory context but not project-level procurement data. The gap: subscribers who ask 'berapa nilai proyek IKN yang sudah ditenderkan di kategori infrastruktur sipil bulan ini?' receive a 'data tidak tersedia' response instead of a specific, actionable answer.", integration_challenge: "Integration challenge: IKN project data is distributed across multiple sources (OIKN official announcements, LPSE Kaltim portal, BPKAD Penajam Paser Utara publications, Ministry of PUPR infrastructure pipeline disclosures) that use different project classification systems, different HPS disclosure formats, and different timeline conventions. Hendra Jr.'s data integration plan: build an IKN-specific data parser that maps all 4 source formats to a unified IKN Project schema, with project-level records including category, HPS, timeline, qualification requirements, and award status. The unified IKN database: integrated into NLQ as a dedicated data domain, allowing subscribers to ask IKN-specific questions with the same precision as national LPSE questions. Value multiplication: subscribers in the IKN Intelligence Tier get NLQ access to the most comprehensive IKN project database available to any non-government entity — a competitive intelligence advantage worth significantly more than the tier premium.", tc: "text-primary" },
            { domain: "EXPANSION-DOMAIN-2: BUJK Financial Capacity Database — data kapasitas finansial BUJK yang terstandarisasi dari procurement disclosures", domain_justification: "The financial capacity intelligence gap: Trust Score's current financial component is based on binary data (does the BUJK have an audited financial statement? does their disclosed bonding capacity meet the threshold for the tenders they pursue?). The next level of financial intelligence: quantified financial capacity data — revenue ranges, bonding capacity levels, cash flow indicators — that allows subscribers to assess not just 'can this competitor qualify for this tender' but 'what is the maximum HPS this competitor can likely pursue without stretching their financial capacity?' The commercial intelligence value: a BUJK who knows their competitor's financial capacity ceiling can calibrate their own bidding strategy around it (bid aggressively in tenders above the competitor's capacity ceiling, where they won't face that competitor; focus defensive bid quality in tenders within the competitor's range).", integration_challenge: "Integration challenge: BUJK financial capacity data is disclosed in qualification documents (financial statements attached to qualification submissions, bonding capacity disclosures, bank reference letters) that are not machine-readable in their current LPSE format. Hendra Jr.'s extraction plan: build an OCR-based financial statement parser that extracts key financial indicators from PDF qualification documents collected by the LPSE crawler (for portals that publish full qualification packages, not just award notices). The OCR extraction: technically complex (financial statement formats vary by accountant, BUJK size, and reporting year) and requires human quality-checking for the first 3–6 months of operation (a Knowledge Analyst task post-Series A). Value multiplication: quantified financial capacity data converts NLQ from 'can you tell me about my competitor's experience?' to 'can you tell me the financial ceiling at which my competitor becomes unable to outbid me?' — a qualitative leap in competitive intelligence depth.", tc: "text-blue-700" },
            { domain: "EXPANSION-DOMAIN-3: Regional Government Procurement Pipeline — pipeline pengadaan pemerintah daerah di luar APBN untuk 5 provinsi prioritas", domain_justification: "The regional procurement intelligence gap: MJP's current NLQ covers APBN-funded projects (national budget) comprehensively but APBD-funded projects (regional budget) inconsistently. The APBD gap: significant because regional government construction spending (schools, health centers, road maintenance, local government buildings) represents approximately 40% of total Indonesian public construction spending — the renovation and maintenance category that serves as cash flow for growth BUJK (R120 Tender Category Intelligence). The APBD pipeline intelligence: not currently in NLQ, meaning subscribers who ask 'apa proyek gedung yang akan ditenderkan oleh Pemerintah Provinsi Sulawesi Selatan di Q3 2026?' receive a 'tidak dapat menjawab pertanyaan ini' instead of a pipeline overview.", integration_challenge: "Integration challenge: APBD procurement planning is disclosed in RKPD (Regional Government Work Plan) documents published by 514 kabupaten/kota and 34 provincial governments, using 548 different document formats, on 582 different government websites. Hendra Jr.'s phased integration plan: start with 5 priority provinces (matching the Province Intelligence Pack roadmap), build province-specific RKPD parsers, and integrate the parsed pipeline data into NLQ as 'Regional Pipeline' domain queries. The phased approach: begins with Sulawesi Selatan (highest subscriber concentration outside Java) and Kalimantan Timur (IKN alignment). Value multiplication: for subscribers operating in the 5 priority provinces, NLQ gains the ability to answer 'what is in the regional procurement pipeline for my category in my province in the next 6 months?' — a strategic planning question currently unanswerable by any commercial intelligence platform in Indonesia. The regional pipeline domain: the NLQ expansion that most directly serves the 60% of MJP subscribers who are primarily regional competitors and whose most valuable intelligence need is in APBD-funded local procurement, not national APBN tenders.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.domain} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.domain}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Domain justification: {r.domain_justification}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Integration challenge: {r.integration_challenge}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">NLQ expansion roadmap adalah Hendra's most technically ambitious post-Series A initiative — because each domain expansion multiplies NLQ's answerable question space in ways that are qualitatively different from simply adding more data of the same type. The 3 new domains (IKN projects, BUJK financial capacity, regional procurement pipeline): each addresses a class of questions that NLQ currently cannot answer at all, not just questions it answers incompletely. The value multiplication: non-linear. Adding IKN project data: doesn't just give IKN subscribers more IKN answers — it enables cross-domain questions ('show me all civil infrastructure tenders in IKN whose HPS falls within the financial capacity range of competitor X') that require data from 3 domains simultaneously. The cross-domain query capability: the highest-value NLQ feature for Enterprise subscribers who think about competitive intelligence as a multi-dimensional analysis, not a series of isolated lookups. Hendra Jr.'s domain expansion sequencing (IKN first, financial capacity second, regional pipeline third): based on subscriber impact size (IKN addresses high-value IKN Tier subscribers), data integration feasibility (IKN has more structured source data than BUJK financials), and strategic timing (regional pipeline domain expansion is most valuable when 5 Province Intelligence Packs are launched, making it a post-Series A Year 2 initiative). The expansion roadmap: funded by Series A and delivered over 24 months post-investment. Hendra's pitch to investors on NLQ: 'Saat ini, NLQ dapat menjawab sekitar 3.000 jenis pertanyaan berbeda tentang pengadaan konstruksi Indonesia. Dengan 3 domain ekspansi ini: sekitar 12.000 jenis pertanyaan. Setiap pertanyaan tambahan yang bisa kami jawab adalah satu lagi keputusan bisnis yang subscriber kami bisa buat dengan data, bukan dengan intuisi. Dan setiap keputusan yang dibuat dengan data yang kami sediakan: adalah bukti bahwa subscripsi MJP menghasilkan ROI yang jauh melebihi biayanya.' The 3 domains: the 3 investments that convert NLQ from a powerful regulatory and market intelligence tool into a comprehensive decision-support system for every significant BUJK business decision — from individual bid strategy to annual portfolio planning to capital allocation across categories, regions, and project sizes.</p>
      </div>
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-6 right-6 z-50 h-9 w-9 rounded-full bg-primary animate-in fade-in slide-in-from-bottom-2 text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" aria-label="Kembali ke atas" title="Kembali ke atas"><ChevronUp className="h-4 w-4" /></button>
      )}
    </div>
  );
}
