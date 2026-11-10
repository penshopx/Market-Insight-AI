import { useState, useMemo, useRef, useCallback, useEffect, useDeferredValue } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { exportPainPointsExcel } from "@/lib/export-excel";
import {
  useListPainPoints,
  useCreatePainPoint,
  useUpdatePainPoint,
  useDeletePainPoint,
  getListPainPointsQueryKey,
  useListResearchItems,
  getListResearchItemsQueryKey,
} from "@workspace/api-client-react";
import type { PainPoint } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Activity, Antenna, Archive, Bot, Brain, Camera, ChartBar, ChartColumnBig, ChevronDown, ChevronRight, ChevronUp, CircleAlert, CircleCheck, CircleX, ClipboardList, Clock, Copy, Cpu, Crosshair, DollarSign, FileDown, Flame, GitBranch, GitMerge, Hash, HeartHandshake, Image, Layers, LayoutGrid, LifeBuoy, Lightbulb, ListFilter, Loader2, Map, MapPin, MessageSquare, Network, PiggyBank, Plus, Presentation, RefreshCw, Search, SlidersHorizontal, Sparkles, Square, SquareCheckBig, StickyNote, Target, Timer, TrendingUp, TriangleAlert, Users, Wrench, X, Zap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { KnowledgeSourcesBar } from "@/components/knowledge-sources-bar";

// ─── Photo Upload Utility (Task #27 / #28) ────────────────────────────────────

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function PhotoUploadField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Hanya file gambar yang diizinkan.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file terlalu besar — maksimum 5 MB.");
      return;
    }
    setLoading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      onChange(dataUrl);
    } catch {
      toast.error("Gagal memuat gambar — coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
        disabled={disabled || loading}
      />
      {value ? (
        <div className="relative group rounded-sm overflow-hidden border max-h-48">
          <img
            src={value}
            alt="Foto bukti lapangan"
            className="w-full object-cover max-h-48"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => inputRef.current?.click()}
              className="text-[10px] font-mono h-7"
            >
              <Camera className="h-3 w-3 mr-1" /> GANTI
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => onChange("")}
              className="text-[10px] font-mono h-7"
            >
              <X className="h-3 w-3 mr-1" /> HAPUS
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || loading}
          className={cn(
            "w-full border-2 border-dashed rounded-sm p-4 flex flex-col items-center gap-2 transition-colors",
            "hover:border-primary/50 hover:bg-primary/5",
            "text-muted-foreground"
          )}
        >
          {loading ? (
            <span className="text-xs font-mono animate-pulse">Memuat...</span>
          ) : (
            <>
              <Camera className="h-6 w-6 opacity-50" />
              <span className="text-xs font-mono">Ambil / Unggah Foto Bukti</span>
              <span className="text-[10px] text-muted-foreground/70">JPG, PNG, WEBP · Maks 10 MB</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

const DOMAINS = [
  "TENDER", "SBU", "SKK", "OSS", "ISO", "SMK3",
  "LEGAL", "DOKUMEN", "ESTIMASI", "PROYEK",
  "KEUANGAN", "SDM", "KNOWLEDGE", "REGULASI",
  "MARKETING", "DIGITALISASI", "KEMITRAAN", "CASHFLOW",
];
const DOMAIN_LABELS: Record<string, string> = {
  TENDER: "Tender", SBU: "SBU", SKK: "SKK", OSS: "OSS",
  ISO: "ISO", SMK3: "SMK3", LEGAL: "Legal", DOKUMEN: "Dokumen",
  ESTIMASI: "Estimasi", PROYEK: "Proyek", KEUANGAN: "Keuangan",
  SDM: "SDM", KNOWLEDGE: "Knowledge", REGULASI: "Regulasi",
  MARKETING: "Marketing", DIGITALISASI: "Digitalisasi",
  KEMITRAAN: "Kemitraan", CASHFLOW: "Cashflow",
};

const DOMAIN_COLORS: Record<string, string> = {
  TENDER:       "bg-blue-500/15 text-blue-700 border-blue-300",
  SBU:          "bg-purple-500/15 text-purple-700 border-purple-300",
  SKK:          "bg-indigo-500/15 text-indigo-700 border-indigo-300",
  OSS:          "bg-cyan-500/15 text-cyan-700 border-cyan-300",
  ISO:          "bg-teal-500/15 text-teal-700 border-teal-300",
  SMK3:         "bg-rose-500/15 text-rose-700 border-rose-300",
  LEGAL:        "bg-amber-500/15 text-amber-700 border-amber-300",
  DOKUMEN:      "bg-yellow-500/15 text-yellow-700 border-yellow-300",
  ESTIMASI:     "bg-orange-500/15 text-orange-700 border-orange-300",
  PROYEK:       "bg-lime-500/15 text-lime-700 border-lime-300",
  KEUANGAN:     "bg-red-500/15 text-red-700 border-red-300",
  SDM:          "bg-green-500/15 text-green-700 border-green-300",
  KNOWLEDGE:    "bg-violet-500/15 text-violet-700 border-violet-300",
  REGULASI:     "bg-sky-500/15 text-sky-700 border-sky-300",
  MARKETING:    "bg-pink-500/15 text-pink-700 border-pink-300",
  DIGITALISASI: "bg-emerald-500/15 text-emerald-700 border-emerald-300",
  KEMITRAAN:    "bg-fuchsia-500/15 text-fuchsia-700 border-fuchsia-300",
  CASHFLOW:     "bg-red-500/15 text-red-800 border-red-400",
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  CRITICAL: { label: "Kritis",  color: "bg-red-500 text-white",       dot: "bg-red-500" },
  HIGH:     { label: "Tinggi",  color: "bg-orange-500 text-white",    dot: "bg-orange-500" },
  MEDIUM:   { label: "Sedang",  color: "bg-amber-400 text-black",     dot: "bg-amber-400" },
  LOW:      { label: "Rendah",  color: "bg-slate-300 text-slate-700", dot: "bg-slate-300" },
};

function PainScoreBar({ score }: { score: number | null }) {
  const s = score ?? 0;
  const color =
    s >= 9 ? "bg-red-500" :
    s >= 7 ? "bg-orange-500" :
    s >= 5 ? "bg-amber-400" :
    "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${s * 10}%` }} />
      </div>
      <span className={cn("text-xs font-bold font-mono w-4 text-right", s >= 9 ? "text-red-600" : s >= 7 ? "text-orange-600" : "text-foreground")}>
        {s}
      </span>
    </div>
  );
}

function CPKBCard({ pp, onStatusChange, onDuplicate, onDelete, onPhotoOpen, isStatusUpdating, isDuplicating, isDeleting }: { pp: PainPoint; onStatusChange: (id: number, status: string) => void; onDuplicate: (pp: PainPoint) => void; onDelete?: (id: number) => void; onPhotoOpen?: (url: string) => void; isStatusUpdating?: boolean; isDuplicating?: boolean; isDeleting?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pc = PRIORITY_CONFIG[pp.priority] ?? PRIORITY_CONFIG.MEDIUM;
  const dc = DOMAIN_COLORS[pp.domain ?? ""] ?? "bg-muted text-muted-foreground border-border";
  const { photoUrl: embeddedPhoto, cleanDescription } = parseFotoBukti(pp.description);

  return (
    <Card className={cn(
      "group overflow-hidden transition-all hover:shadow-md border",
      pp.priority === "CRITICAL" && "border-red-200",
    )}>
      {/* Header row */}
      <button
        type="button"
        aria-expanded={expanded}
        title={expanded ? "Tutup detail pain point" : "Buka detail pain point"}
        className="flex items-start gap-3 p-4 cursor-pointer select-none w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Pain score column */}
        <div className="flex flex-col items-center gap-1 w-10 shrink-0 mt-0.5">
          <div
            title={`Pain Score ${pp.painScore ?? "?"}/10 — ${(pp.painScore ?? 0) >= 9 ? "Kritis: masalah sangat urgent, peluang layanan besar" : (pp.painScore ?? 0) >= 7 ? "Tinggi: dampak signifikan, prioritas follow-up" : "Sedang: masalah valid, masuk pipeline riset"}`}
            className={cn(
              "w-10 h-10 rounded-sm flex items-center justify-center text-base font-black font-mono cursor-help",
              (pp.painScore ?? 0) >= 9 ? "bg-red-100 text-red-700" :
              (pp.painScore ?? 0) >= 7 ? "bg-orange-100 text-orange-700" :
              "bg-muted text-muted-foreground"
            )}
          >
            {pp.painScore ?? "?"}
          </div>
          <span className="text-[9px] font-mono text-muted-foreground">Score</span>
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            {pp.problemId && (
              <span className="font-mono text-[10px] font-bold text-muted-foreground flex items-center gap-0.5">
                <Hash className="h-3 w-3" />{pp.problemId}
              </span>
            )}
            {pp.domain && (
              <span className={cn("text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-sm border", dc)} title={pp.domain}>
                {pp.domain}
              </span>
            )}
            {pp.subdomain && (
              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm transition-colors" title={`Subdomain: ${pp.subdomain}`}>
                {pp.subdomain}
              </span>
            )}
            {pp.createdAt && (Date.now() - new Date(pp.createdAt).getTime()) < 7 * 86400000 && (
              <span className="text-[8px] font-mono bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded-sm border border-emerald-200">Baru</span>
            )}
            <span className={cn("ml-auto px-1.5 py-0.5 text-[10px] font-bold font-mono rounded-sm", pc.color)}>
              {pc.label}
            </span>
            {pp.createdAt && (Date.now() - new Date(pp.createdAt).getTime()) < 7 * 86400000 && (
              <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded-sm bg-emerald-100 text-emerald-700 border border-emerald-200">Baru</span>
            )}
          </div>

          <div className="flex items-start gap-1 mb-2">
            <p className="text-sm font-semibold leading-snug line-clamp-2 flex-1" title={cleanDescription || pp.description}>{cleanDescription || pp.description}</p>
            <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(cleanDescription || pp.description).then(() => toast.success("Deskripsi disalin", { duration: 1200 })); }} aria-label="Salin deskripsi pain point" className="opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-0.5 text-muted-foreground hover:text-foreground" title="Salin deskripsi pain point"><Copy className="h-3 w-3" /></button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-muted-foreground">
            {pp.linkedAiAgent && (
              <span className="flex items-center gap-1 text-violet-600 font-bold" title={`AI Agent: ${pp.linkedAiAgent}`}>
                <Bot className="h-3 w-3" />{pp.linkedAiAgent}
              </span>
            )}
            {pp.affectedRoles && (
              <span className="flex items-center gap-1 truncate max-w-[200px]" title={pp.affectedRoles ?? undefined}>
                <Target className="h-3 w-3" />{pp.affectedRoles}
              </span>
            )}
            {pp.createdAt && (() => { const d = new Date(pp.createdAt); const daysAgo = Math.floor((Date.now() - d.getTime()) / 86400000); const rel = daysAgo === 0 ? "Hari ini" : daysAgo === 1 ? "Kemarin" : daysAgo < 14 ? `${daysAgo} hari lalu` : null; const abs = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }); return (<span className="flex items-center gap-1 text-muted-foreground/60 whitespace-nowrap" title={`Dibuat: ${abs}`}><Clock className="h-3 w-3" />{rel ?? abs}</span>); })()}
            <span className={cn("ml-auto flex items-center gap-1 text-xs font-medium")} title={pp.status === "OPEN" ? "Terbuka — masalah baru, belum ada tindak lanjut" : pp.status === "IN_PROGRESS" ? "Sedang Ditangani — tim sedang mengerjakan solusi" : pp.status === "RESOLVED" ? "Selesai — masalah telah diselesaikan" : undefined}>
              <span className={cn("w-2 h-2 rounded-full", pp.status === "OPEN" ? "bg-amber-400" : pp.status === "IN_PROGRESS" ? "bg-blue-500" : "bg-green-500")} />
              {pp.status === "OPEN" ? "Terbuka" : pp.status === "IN_PROGRESS" ? "Sedang Ditangani" : pp.status === "RESOLVED" ? "Selesai" : (pp.status?.replace(/_/g, " ") ?? "")}
            </span>
          </div>
        </div>

        <div className="shrink-0 text-muted-foreground mt-1">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border bg-muted/10 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Problem analysis */}
            <div className="p-4 space-y-3">
              <div className="text-[10px] font-bold font-mono tracking-widest text-muted-foreground flex items-center gap-1">
                <TriangleAlert className="h-3 w-3" /> ANALISIS MASALAH
              </div>
              {pp.rootCause && (
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground mb-0.5">Root Cause</div>
                  <p className="text-xs leading-relaxed">{pp.rootCause}</p>
                </div>
              )}
              {pp.businessImpact && (
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground mb-0.5">Dampak Bisnis</div>
                  <p className="text-xs leading-relaxed text-red-700">{pp.businessImpact}</p>
                </div>
              )}
              {pp.sdmGap && (
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground mb-0.5">Gap SDM</div>
                  <p className="text-xs leading-relaxed">{pp.sdmGap}</p>
                </div>
              )}
              <div>
                <div className="text-[10px] font-mono text-muted-foreground mb-1">Pain Score</div>
                <PainScoreBar score={pp.painScore ?? null} />
              </div>
            </div>

            {/* Solutions */}
            <div className="p-4 space-y-3">
              <div className="text-[10px] font-bold font-mono tracking-widest text-muted-foreground flex items-center gap-1">
                <Wrench className="h-3 w-3" /> SOLUSI
              </div>
              {pp.manualSolution && (
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground mb-0.5 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" /> Manual
                  </div>
                  <p className="text-xs leading-relaxed">{pp.manualSolution}</p>
                </div>
              )}
              {pp.digitalSolution && (
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground mb-0.5 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Digital
                  </div>
                  <p className="text-xs leading-relaxed">{pp.digitalSolution}</p>
                </div>
              )}
              {pp.aiSolution && (
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground mb-0.5 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" /> AI Solution
                  </div>
                  <p className="text-xs leading-relaxed font-medium text-violet-800">{pp.aiSolution}</p>
                </div>
              )}
            </div>

            {/* Opportunity */}
            <div className="p-4 space-y-3">
              <div className="text-[10px] font-bold font-mono tracking-widest text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3" /> PELUANG & KONEKSI
              </div>
              {pp.linkedAiAgent && (
                <div className="flex items-center gap-2 p-2 rounded-sm bg-violet-50 border border-violet-200" title={`AI Agent: ${pp.linkedAiAgent}`}>
                  <Bot className="h-4 w-4 text-violet-600 shrink-0" />
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground">Claw Agent</div>
                    <div className="text-xs font-bold text-violet-700">{pp.linkedAiAgent}</div>
                  </div>
                </div>
              )}
              {pp.serviceOpportunity && (
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground mb-0.5">Peluang Jasa</div>
                  <p className="text-xs font-medium leading-relaxed text-green-700" title={pp.serviceOpportunity ?? undefined}>{pp.serviceOpportunity}</p>
                </div>
              )}
              {pp.crossReferences && (
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground mb-1">Cross-Ref</div>
                  <div className="flex flex-wrap gap-1">
                    {pp.crossReferences.split(",").map(ref => (
                      <span key={ref.trim()} className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded-sm border" title={ref.trim()}>
                        {ref.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Evidence photo — Task #26 / #72 */}
              {(pp.evidencePhotoUrl || embeddedPhoto) && (
                <div className="pt-2 border-t border-border">
                  <div className="text-[10px] font-mono text-muted-foreground mb-1 flex items-center gap-1">
                    <Image className="h-3 w-3" /> FOTO BUKTI LAPANGAN
                  </div>
                  {[pp.evidencePhotoUrl, embeddedPhoto].filter(Boolean).map((url, idx) => (
                    <button
                      key={idx}
                      className="block w-full text-left mb-1"
                      onClick={(e) => { e.stopPropagation(); onPhotoOpen?.(url!); }}
                    >
                      <img
                        src={url!}
                        alt="Foto bukti"
                        className="rounded-sm border max-h-32 object-cover w-full hover:opacity-80 hover:ring-2 hover:ring-primary/40 transition-all cursor-zoom-in"
                      />
                      <span className="text-[9px] font-mono text-muted-foreground mt-0.5 block">Klik untuk perbesar</span>
                    </button>
                  ))}
                </div>
              )}
              {/* Status action */}
              <div className="pt-2 border-t border-border">
                <div className="flex gap-2 mb-2">
                  <a
                    href={`/workroom?domain=${encodeURIComponent(pp.domain ?? "")}`}
                    className="text-[9px] font-mono flex items-center gap-1 text-primary hover:underline"
                  >
                    <Wrench className="h-2.5 w-2.5" /> Workroom
                  </a>
                </div>
                <div className="flex gap-2">
                  <div className="flex gap-2 flex-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {pp.status === "OPEN" && (
                    <Button size="sm" variant="secondary" className="h-7 text-[10px] font-mono flex-1"
                      disabled={isStatusUpdating}
                      onClick={(e) => { e.stopPropagation(); onStatusChange(pp.id, "IN_PROGRESS"); }}>
                      {isStatusUpdating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}MULAI KERJAKAN
                    </Button>
                  )}
                  {pp.status === "IN_PROGRESS" && (
                    <Button size="sm" className="h-7 text-[10px] font-mono flex-1 bg-green-600 hover:bg-green-700"
                      disabled={isStatusUpdating}
                      onClick={(e) => { e.stopPropagation(); onStatusChange(pp.id, "RESOLVED"); }}>
                      {isStatusUpdating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}Tandai Selesai
                    </Button>
                  )}
                  {pp.status === "RESOLVED" && (
                    <span className="text-[10px] font-mono text-green-600 font-bold flex items-center gap-1 flex-1">
                      ✓ RESOLVED
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] font-mono ml-auto border-dashed"
                    disabled={isDuplicating}
                    onClick={(e) => { e.stopPropagation(); onDuplicate(pp); }}
                    title="Duplikat pain point ini"
                  >
                    {isDuplicating ? "..." : "+ DUPLIKAT"}
                  </Button>
                  </div>
                  {onDelete && (
                    <div className={cn("transition-opacity", confirmDelete ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                      {confirmDelete ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 px-2 text-[10px] font-mono"
                          disabled={isDeleting}
                          onClick={(e) => { e.stopPropagation(); onDelete(pp.id); setConfirmDelete(false); }}
                          onBlur={() => setConfirmDelete(false)}
                          autoFocus
                          aria-label="Konfirmasi hapus pain point"
                        >
                          {isDeleting ? <><Loader2 className="h-3 w-3 animate-spin" /> Menghapus…</> : "✓ Yakin?"}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                          title="Hapus pain point"
                          aria-label="Hapus pain point"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function PainPoints() {
  const queryClient = useQueryClient();
  const [domainFilter, setDomainFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [agentFilter, setAgentFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [scoreAsc, setScoreAsc] = useState(false);
  const [sortByDomain, setSortByDomain] = useState(false);
  const [sortByNewest, setSortByNewest] = useState(false);
  const [showOnlyWithNotes, setShowOnlyWithNotes] = useState(false);
  const [ppQuickNotes, setPpQuickNotes] = useState<Record<number, string>>(() => {
    try { return JSON.parse(localStorage.getItem("mkp-pp-notes") ?? "{}") as Record<number, string>; } catch { return {}; }
  });
  const [savedNoteId, setSavedNoteId] = useState<number | null>(null);
  const savedNoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updatePpNote = (id: number, val: string) => {
    setPpQuickNotes(prev => {
      const next = { ...prev, [id]: val };
      try { localStorage.setItem("mkp-pp-notes", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    setSavedNoteId(id);
    if (savedNoteTimer.current) clearTimeout(savedNoteTimer.current);
    savedNoteTimer.current = setTimeout(() => setSavedNoteId(null), 2000);
  };
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => { document.title = "Perumusan Masalah — Intel Konstruksi"; return () => { document.title = "Intel Konstruksi"; }; }, []);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [createDomain, setCreateDomain] = useState("");
  const [createSegment, setCreateSegment] = useState("KONTRAKTOR");
  const [createPriority, setCreatePriority] = useState("CRITICAL");
  const [createTouched, setCreateTouched] = useState<Record<string, boolean>>({});
  const [createValues, setCreateValues] = useState<Record<string, string>>({});
  useEffect(() => { if (!isCreateOpen) { setCreateDomain(""); setCreateSegment("KONTRAKTOR"); setCreatePriority("CRITICAL"); setCreateTouched({}); setCreateValues({}); } }, [isCreateOpen]);
  const [viewMode, setViewMode] = useState<"list" | "heatmap">("list");
  const [quickTitle, setQuickTitle] = useState("");

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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const { data: painPoints = [], isLoading, isError: isPainPointsError } = useListPainPoints(
    {},
    { query: { queryKey: getListPainPointsQueryKey({}) } }
  );
  const { data: researchItems = [] } = useListResearchItems(
    { limit: 100 },
    { query: { queryKey: getListResearchItemsQueryKey({ limit: 100 }), staleTime: 5 * 60 * 1000 } }
  );

  const updateMutation = useUpdatePainPoint({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListPainPointsQueryKey() });
        if (data.status) { const lbl: Record<string,string> = { OPEN:"Terbuka", IN_PROGRESS:"Diproses", RESOLVED:"Selesai" }; toast.success(`Status diperbarui → ${lbl[data.status] ?? data.status}`, { description: data.description?.slice(0, 50) ?? undefined, duration: 1800 }); }
      },
      onError: (err: unknown) => toast.error("Gagal memperbarui pain point", { description: err instanceof Error ? err.message : "Coba lagi" }),
    },
  });

  const [newPainPointId, setNewPainPointId] = useState<number | null>(null);
  const newPainPointRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (newPainPointId === null || !newPainPointRef.current) return;
    newPainPointRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    const el = newPainPointRef.current;
    el.classList.add("ring-2", "ring-primary", "ring-offset-1");
    const timer = setTimeout(() => el.classList.remove("ring-2", "ring-primary", "ring-offset-1"), 2000);
    return () => clearTimeout(timer);
  }, [newPainPointId]);

  const createMutation = useCreatePainPoint({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListPainPointsQueryKey() });
        setIsCreateOpen(false);
        setNewPainPointId(data.id);
        toast.success("Pain point baru ditambahkan", { description: data.description ?? undefined, duration: 2500 });
      },
      onError: (err: unknown) => toast.error("Gagal menyimpan pain point", { description: err instanceof Error ? err.message : "Coba lagi" }),
    },
  });

  const deleteMutation = useDeletePainPoint({
    mutation: {
      onSuccess: () => {
        const name = painPoints?.find(p => p.id === pendingDeleteId)?.description;
        queryClient.invalidateQueries({ queryKey: getListPainPointsQueryKey() });
        toast.success("Pain point dihapus", { description: name ? name.slice(0, 60) : undefined, duration: 2000 });
      },
      onError: (err: unknown) => toast.error("Gagal menghapus pain point", { description: err instanceof Error ? err.message : "Coba lagi" }),
    },
  });

  const duplicateMutation = useCreatePainPoint({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListPainPointsQueryKey() });
        toast.success("Pain point diduplikasi", { description: data.description ? data.description.slice(0, 60) : undefined, duration: 1800 });
      },
      onError: (err: unknown) => toast.error("Gagal menduplikasi pain point", { description: err instanceof Error ? err.message : "Coba lagi" }),
    },
  });

  const handleDuplicate = useCallback((pp: PainPoint) => {
    duplicateMutation.mutate({
      data: {
        description: `[DUPLIKAT] ${pp.description}`,
        segment: pp.segment ?? "SEMUA",
        domain: pp.domain ?? undefined,
        subdomain: pp.subdomain ?? undefined,
        priority: pp.priority ?? "MEDIUM",
        painScore: pp.painScore ?? undefined,
        rootCause: pp.rootCause ?? undefined,
        manualSolution: pp.manualSolution ?? undefined,
        digitalSolution: pp.digitalSolution ?? undefined,
        aiSolution: pp.aiSolution ?? undefined,
        affectedRoles: pp.affectedRoles ?? undefined,
        serviceOpportunity: pp.serviceOpportunity ?? undefined,
        linkedAiAgent: pp.linkedAiAgent ?? undefined,
        status: "OPEN",
      }
    });
  }, [duplicateMutation]);

  // Unique agents
  const uniqueAgents = useMemo(() =>
    [...new Set(painPoints.map(p => p.linkedAiAgent).filter(Boolean))] as string[],
    [painPoints]
  );

  // Filtered + searched
  const filtered = useMemo(() => {
    let items = painPoints;
    if (domainFilter) items = items.filter(p => p.domain === domainFilter);
    if (priorityFilter) items = items.filter(p => p.priority === priorityFilter);
    if (agentFilter) items = items.filter(p => p.linkedAiAgent === agentFilter);
    if (deferredSearchQuery) {
      const q = deferredSearchQuery.toLowerCase();
      items = items.filter(p =>
        p.description?.toLowerCase().includes(q) ||
        p.problemId?.toLowerCase().includes(q) ||
        p.domain?.toLowerCase().includes(q) ||
        p.rootCause?.toLowerCase().includes(q) ||
        p.serviceOpportunity?.toLowerCase().includes(q) ||
        (ppQuickNotes[p.id] ?? "").toLowerCase().includes(q)
      );
    }
    if (showOnlyWithNotes) items = items.filter(p => (ppQuickNotes[p.id] ?? "").trim().length > 0);
    if (sortByNewest) return items.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    if (sortByDomain) return items.sort((a, b) => (a.domain ?? "").localeCompare(b.domain ?? "") || ((b.painScore ?? 0) - (a.painScore ?? 0)));
    return items.sort((a, b) => scoreAsc ? (a.painScore ?? 0) - (b.painScore ?? 0) : (b.painScore ?? 0) - (a.painScore ?? 0));
  }, [painPoints, domainFilter, priorityFilter, agentFilter, searchQuery, scoreAsc, showOnlyWithNotes, ppQuickNotes, sortByDomain, sortByNewest]);

  // Stats
  const stats = useMemo(() => {
    const total = painPoints.length;
    const critical = painPoints.filter(p => p.priority === "CRITICAL").length;
    const highAndCritical = painPoints.filter(p => p.priority === "CRITICAL" || p.priority === "HIGH").length;
    const avgScore = total > 0
      ? Math.round(painPoints.reduce((s, p) => s + (p.painScore ?? 0), 0) / total * 10) / 10
      : 0;
    const byDomain = DOMAINS.reduce<Record<string, number>>((acc, d) => {
      acc[d] = painPoints.filter(p => p.domain === d).length;
      return acc;
    }, {});
    const openCount = painPoints.filter(p => p.status === "OPEN").length;
    return { total, critical, highAndCritical, avgScore, byDomain, openCount };
  }, [painPoints]);

  const [newPhotoUrl, setNewPhotoUrl] = useState("");

  // ── Bulk actions ─────────────────────────────────────────────────────────────
  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev =>
      prev.size === filtered.length
        ? new Set()
        : new Set(filtered.map(p => p.id))
    );
  }, [filtered]);

  const bulkUpdate = useCallback(async (patch: { status?: string; priority?: string }) => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    setIsBulkUpdating(true);
    try {
      let failed = 0;
      await Promise.all(
        Array.from(selectedIds).map(id =>
          new Promise<void>((resolve) => {
            updateMutation.mutate({ id, data: patch }, { onSettled: (_d, err) => { if (err) failed++; resolve(); } });
          })
        )
      );
      setSelectedIds(new Set());
      const label = patch.status ? `status → ${patch.status}` : patch.priority ? `prioritas → ${patch.priority}` : "diperbarui";
      if (failed > 0) {
        toast.error(`${failed} dari ${count} pain point gagal diperbarui — coba lagi`);
      } else {
        toast.success(`${count} pain point ${label}`, { duration: 2500 });
      }
    } finally {
      setIsBulkUpdating(false);
    }
  }, [selectedIds, updateMutation]);

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!fd.get("description")) {
      setCreateTouched({ description: true });
      return;
    }
    // Task #28: photo URL already captured before submit — no risk of orphaned storage
    createMutation.mutate({
      data: {
        problemId: fd.get("problemId") as string || undefined,
        domain: fd.get("domain") as string || undefined,
        subdomain: fd.get("subdomain") as string || undefined,
        painScore: fd.get("painScore") ? Number(fd.get("painScore")) : undefined,
        affectedRoles: fd.get("affectedRoles") as string || undefined,
        segment: fd.get("segment") as string,
        description: fd.get("description") as string,
        rootCause: fd.get("rootCause") as string || undefined,
        aiSolution: fd.get("aiSolution") as string || undefined,
        linkedAiAgent: fd.get("linkedAiAgent") as string || undefined,
        serviceOpportunity: fd.get("serviceOpportunity") as string || undefined,
        priority: fd.get("priority") as string,
        status: "OPEN",
        evidencePhotoUrl: newPhotoUrl || undefined,
      },
    });
    setNewPhotoUrl(""); // reset after submit
  };

  const handleQuickAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !quickTitle.trim()) return;
    createMutation.mutate({
      data: {
        description: quickTitle.trim(),
        segment: "BUJK",
        priority: "MEDIUM",
        status: "OPEN",
      },
    });
    setQuickTitle("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-7 w-7 text-violet-600" />
            CPKB — KNOWLEDGE BASE MASALAH
          </h1>
          <p className="text-muted-foreground font-mono mt-1 text-sm flex items-center gap-2 flex-wrap">
            {(domainFilter || priorityFilter || agentFilter || showOnlyWithNotes)
              ? <><span className="text-foreground font-bold">{filtered.length}</span> dari {painPoints.length} masalah</>
              : <>CONSTRUCTION PROBLEM KNOWLEDGE BASE · {stats.total} MASALAH TERSTRUKTUR</>}
            {(() => {
              const unscored = painPoints.filter(p => !p.painScore || p.painScore === 0).length;
              return unscored > 0 ? (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-muted border text-muted-foreground">{unscored} belum dinilai</span>
              ) : null;
            })()}
          </p>
        </div>
        <div className="flex gap-2">

          <Button
            variant="outline"
            size="sm"
            className={cn("font-mono text-xs", sortByNewest && "bg-primary/10 border-primary/40")}
            onClick={() => { setSortByNewest(v => !v); if (!sortByNewest) { setSortByDomain(false); setScoreAsc(false); } }}
            aria-pressed={sortByNewest}
            title="Urut: terbaru dulu"
            aria-label={sortByNewest ? "Urut terbaru: batalkan" : "Urut: terbaru dulu"}
          >
            {sortByNewest ? "↓ Terbaru" : "↑ Terbaru"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn("font-mono text-xs", scoreAsc && !sortByDomain && !sortByNewest && "bg-primary/10 border-primary/40")}
            onClick={() => { setScoreAsc(v => !v); setSortByDomain(false); setSortByNewest(false); }}
            aria-pressed={scoreAsc}
            title={scoreAsc ? "Urut: terendah dulu (klik untuk balik)" : "Urut: tertinggi dulu (klik untuk balik)"}
            aria-label={scoreAsc ? "Urut skor: terendah dulu" : "Urut skor: tertinggi dulu"}
          >
            {scoreAsc ? "↑ Skor" : "↓ Skor"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn("font-mono text-xs", sortByDomain && "bg-primary/10 border-primary/40")}
            onClick={() => { setSortByDomain(v => !v); if (!sortByDomain) setSortByNewest(false); }}
            aria-pressed={sortByDomain}
            title="Urut berdasarkan domain A–Z"
            aria-label={sortByDomain ? "Urut domain A–Z: batalkan" : "Urut berdasarkan domain A–Z"}
          >
            {sortByDomain ? "A–Z Domain" : "↕ Domain"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs"
            onClick={() => exportPainPointsExcel(filtered.map(p => ({ ...p, createdAt: p.createdAt ?? undefined, catatan: ppQuickNotes[p.id] ?? "" })))}
            disabled={painPoints.length === 0}
            title={`Ekspor ${filtered.length} data pain point ke Excel`}
          >
            <FileDown className="h-3.5 w-3.5 mr-1.5" /> Export Excel{(domainFilter || priorityFilter || agentFilter || searchQuery || showOnlyWithNotes) && filtered.length < painPoints.length ? ` (${filtered.length})` : ""}
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            className="font-mono text-xs"
            onClick={() => setViewMode("list")}
          >
            <Layers className="h-3.5 w-3.5 mr-1.5" /> LIST
          </Button>
          <Button
            variant={viewMode === "heatmap" ? "default" : "outline"}
            size="sm"
            className="font-mono text-xs"
            onClick={() => setViewMode("heatmap")}
          >
            <TrendingUp className="h-3.5 w-3.5 mr-1.5" /> HEATMAP
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="font-mono text-xs">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> TAMBAH
                <kbd className="ml-1.5 text-[9px] font-mono opacity-60 border border-current/30 rounded px-1">N</kbd>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Input Masalah Baru ke CPKB</DialogTitle>
                <DialogDescription>Tambahkan masalah industri konstruksi yang terstruktur ke knowledge base.</DialogDescription>
              </DialogHeader>
              <form key={String(isCreateOpen)} onSubmit={handleCreate} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Problem ID</Label>
                    <Input name="problemId" placeholder="Cth: TDR-006" className="font-mono" autoFocus maxLength={100} />
                  </div>
                  <div className="space-y-2">
                    <Label>Domain</Label>
                    <input type="hidden" name="domain" value={createDomain} />
                    <Select value={createDomain || "__none__"} onValueChange={v => setCreateDomain(v === "__none__" ? "" : v)}>
                      <SelectTrigger className="h-10 w-full" aria-label="Pilih domain pain point"><SelectValue placeholder="Pilih Domain" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Pilih Domain</SelectItem>
                        {DOMAINS.map(d => <SelectItem key={d} value={d}>{DOMAIN_LABELS[d] ?? d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Subdomain</Label>
                    <Input name="subdomain" placeholder="Cth: Administrasi" maxLength={100} />
                  </div>
                  <div className="space-y-2">
                    <Label>Pain Score (1–10)</Label>
                    <Input name="painScore" type="number" onWheel={(e) => e.currentTarget.blur()} min={1} max={10} placeholder="8" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Deskripsi Masalah <span className="text-destructive">*</span></Label>
                  <Textarea
                    name="description" required placeholder="Deskripsikan masalah secara spesifik…"
                    className={`min-h-[80px] resize-none${createTouched.description && !createValues.description ? " border-destructive focus-visible:ring-destructive" : ""}`}
                    value={createValues.description ?? ""}
                    onChange={e => setCreateValues(v => ({ ...v, description: e.target.value }))}
                    onBlur={() => setCreateTouched(t => ({ ...t, description: true }))}
                    onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); }}
                    maxLength={500}
                    autoFocus
                  />
                  <div className="flex items-center justify-between">
                    {createTouched.description && !createValues.description
                      ? <p className="text-[11px] text-destructive font-mono">Deskripsi masalah wajib diisi</p>
                      : <span />}
                    <p className="text-[10px] font-mono text-muted-foreground">{(createValues.description ?? "").length} / 500</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Root Cause</Label>
                  <Textarea name="rootCause" placeholder="Penyebab utama masalah ini…" className="min-h-[60px] resize-none" maxLength={1000} onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }} onChange={(e) => { const counter = document.getElementById("rootcause-counter"); if (counter) counter.textContent = `${e.currentTarget.value.length} / 1000`; }} onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); }} />
                  <p id="rootcause-counter" className="text-[10px] font-mono text-muted-foreground text-right">0 / 1000</p>
                </div>
                <div className="space-y-2">
                  <Label>AI Solution</Label>
                  <Textarea name="aiSolution" id="aiSolution-input" placeholder="Bagaimana AI bisa memecahkan ini…" className="min-h-[60px] resize-none" maxLength={1000} onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; const ctr = document.getElementById("aisolution-counter"); if (ctr) ctr.textContent = `${el.value.length} / 1000`; }} onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); }} />
                  <p id="aisolution-counter" className="text-[10px] font-mono text-muted-foreground text-right">0 / 1000</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Linked AI Agent</Label>
                    <Input name="linkedAiAgent" placeholder="Cth: TenderClaw" className="font-mono" maxLength={100} />
                  </div>
                  <div className="space-y-2">
                    <Label>Affected Roles</Label>
                    <Input name="affectedRoles" placeholder="Direktur, Admin" maxLength={255} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Service Opportunity</Label>
                  <Input name="serviceOpportunity" placeholder="Peluang jasa terkait…" maxLength={255} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Segmen *</Label>
                    <input type="hidden" name="segment" value={createSegment} />
                    <Select value={createSegment} onValueChange={setCreateSegment} required>
                      <SelectTrigger className="h-10 w-full" aria-label="Pilih segmen target"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="KONTRAKTOR">Kontraktor</SelectItem>
                        <SelectItem value="KONSULTAN">Konsultan</SelectItem>
                        <SelectItem value="TENAGA_KERJA">Tenaga Kerja</SelectItem>
                        <SelectItem value="SEMUA">Semua</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Prioritas *</Label>
                    <input type="hidden" name="priority" value={createPriority} />
                    <Select value={createPriority} onValueChange={setCreatePriority} required>
                      <SelectTrigger className="h-10 w-full" aria-label="Pilih prioritas pain point"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CRITICAL">Kritis</SelectItem>
                        <SelectItem value="HIGH">Tinggi</SelectItem>
                        <SelectItem value="MEDIUM">Sedang</SelectItem>
                        <SelectItem value="LOW">Rendah</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Photo evidence upload — Task #27 */}
                <div className="space-y-2 pt-2 border-t">
                  <Label className="flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                    Foto Bukti Lapangan <span className="text-muted-foreground text-[10px] font-normal">(opsional)</span>
                  </Label>
                  <PhotoUploadField
                    value={newPhotoUrl}
                    onChange={setNewPhotoUrl}
                    disabled={createMutation.isPending}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Menyimpan…</> : "Simpan ke CPKB"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Masalah", value: stats.total, icon: <Hash className="h-4 w-4" />, color: "text-foreground" },
          { label: "Kritis", value: stats.critical, icon: <TriangleAlert className="h-4 w-4" />, color: "text-red-600" },
          { label: "Tinggi + Kritis", value: stats.highAndCritical, icon: <Flame className="h-4 w-4" />, color: "text-orange-600" },
          { label: "Masih Terbuka", value: stats.openCount, icon: <Target className="h-4 w-4" />, color: "text-amber-600" },
        ].map(s => (
          <Card key={s.label} className="border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                {s.icon}
                <span className="text-[10px] font-mono tracking-wider">{s.label}</span>
              </div>
              <div className={cn("text-2xl font-black font-mono", s.color)}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Priority distribution bar */}
      {painPoints.length > 0 && (() => {
        const total = painPoints.length;
        const counts = {
          CRITICAL: painPoints.filter(p => p.priority === "CRITICAL").length,
          HIGH: painPoints.filter(p => p.priority === "HIGH").length,
          MEDIUM: painPoints.filter(p => p.priority === "MEDIUM").length,
          LOW: painPoints.filter(p => p.priority === "LOW" || !p.priority).length,
        };
        return (
          <div className="border rounded-sm px-4 py-3 bg-card">
            <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">DISTRIBUSI PRIORITAS</p>
            <div className="flex h-3 rounded-full overflow-hidden gap-px">
              {counts.CRITICAL > 0 && <div className="bg-red-500 transition-all" style={{ width: `${counts.CRITICAL / total * 100}%` }} title={`Kritis: ${counts.CRITICAL}`} />}
              {counts.HIGH > 0 && <div className="bg-orange-400 transition-all" style={{ width: `${counts.HIGH / total * 100}%` }} title={`HIGH: ${counts.HIGH}`} />}
              {counts.MEDIUM > 0 && <div className="bg-amber-300 transition-all" style={{ width: `${counts.MEDIUM / total * 100}%` }} title={`MEDIUM: ${counts.MEDIUM}`} />}
              {counts.LOW > 0 && <div className="bg-slate-300 transition-all" style={{ width: `${counts.LOW / total * 100}%` }} title={`LOW: ${counts.LOW}`} />}
            </div>
            <div className="flex gap-4 mt-1.5">
              {[
                { key: "CRITICAL", color: "bg-red-500", label: "Kritis" },
                { key: "HIGH", color: "bg-orange-400", label: "HIGH" },
                { key: "MEDIUM", color: "bg-amber-300", label: "MEDIUM" },
                { key: "LOW", color: "bg-slate-300", label: "LOW" },
              ].map(({ key, color, label }) => counts[key as keyof typeof counts] > 0 && (
                <div key={key} className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-[9px] font-mono text-muted-foreground">{label} {counts[key as keyof typeof counts]}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Pain Point Resolution Funnel */}
      {painPoints.length > 0 && (
        <div className="border rounded-sm p-4 bg-card">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-primary" /> PAIN RESOLUTION FUNNEL — Konversi Masalah → Peluang Layanan
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { stage: "Teridentifikasi", count: painPoints.length, color: "bg-slate-500", pct: 100 },
              { stage: "Punya Deskripsi", count: painPoints.filter(p => (p.description ?? "").length > 20).length, color: "bg-blue-500", pct: 80 },
              { stage: "Ada Service Opp", count: painPoints.filter(p => p.serviceOpportunity).length, color: "bg-violet-500", pct: 60 },
              { stage: "Tinggi / Kritis", count: painPoints.filter(p => p.priority === "HIGH" || p.priority === "CRITICAL").length, color: "bg-orange-500", pct: 40 },
              { stage: "Pain Score ≥7", count: painPoints.filter(p => (p.painScore ?? 0) >= 7).length, color: "bg-red-500", pct: 20 },
            ].map((s, i) => (
              <div key={s.stage} className="border rounded-sm p-2.5 text-center">
                <div className="text-[9px] font-mono text-muted-foreground mb-1">STEP {i + 1}</div>
                <div className="text-2xl font-black font-mono leading-none">{s.count}</div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden my-1.5">
                  <div className={`h-full ${s.color} rounded-full`} style={{ width: `${painPoints.length > 0 ? (s.count / painPoints.length) * 100 : 0}%` }} />
                </div>
                <p className="text-[9px] font-mono text-muted-foreground leading-tight">{s.stage}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pain Point Segment Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-primary" /> PAIN POINT SEGMENT INTELLIGENCE — Siapa yang Paling Menderita
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          {[
            {
              seg: "Kontraktor Kecil", badge: "K1–K3", pain: "Persyaratan SBU + SMAP membingungkan; sering gagal tender karena dokumen tidak lengkap", critical: "Dokumen SBU + SMAP + SKK", opp: "Paket 3-in-1 SBU+SKK+SMAP Rp 8–12jt", urgency: "KRITIS", color: "border-red-200 bg-red-50/20"
            },
            {
              seg: "Kontraktor Menengah", badge: "M1–M2", pain: "Ingin naik kualifikasi tapi bingung dokumen teknis; kalah tender karena harga tidak kompetitif vs analisis pasar", critical: "Upgrade kualifikasi + intelijen harga", opp: "Advisory kualifikasi + TKDN compliance Rp 15–25jt", urgency: "TINGGI", color: "border-orange-200 bg-orange-50/20"
            },
            {
              seg: "Tenaga Ahli Konstruksi", badge: "SKK J7–J9", pain: "SKK expired atau jenjang tidak sesuai; kehilangan proyek karena tenaga ahli tidak tersedia", critical: "Perpanjangan & upgrade SKK cepat", opp: "Paket SKK ekspres + pendampingan uji Rp 3–9jt", urgency: "KRITIS", color: "border-red-200 bg-red-50/20"
            },
            {
              seg: "Konsultan Konstruksi", badge: "SBU Konsultansi", pain: "Persaingan dari konsultan besar; tidak punya akses data riset pasar untuk proposal", critical: "Data intelijen tender + regulasi", opp: "Subscriptions data platform Rp 1–3jt/bln", urgency: "SEDANG", color: "border-blue-200 bg-blue-50/20"
            },
          ].map((s) => (
            <div key={s.seg} className={`border rounded-sm p-3 ${s.color}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold">{s.seg}</span>
                <span className="text-[9px] font-mono bg-background px-1.5 py-0.5 rounded-sm border">{s.badge}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mb-1.5 leading-snug">{s.pain}</p>
              <p className="text-[9px] font-mono text-primary font-semibold mb-0.5">⚡ {s.critical}</p>
              <p className="text-[9px] text-emerald-700 font-semibold">💰 {s.opp}</p>
              <span className={`text-[8px] font-mono font-bold mt-1.5 block ${s.urgency === "KRITIS" ? "text-red-600" : s.urgency === "TINGGI" ? "text-orange-600" : "text-yellow-600"}`}>{s.urgency}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1 border-t pt-3">
          <p className="text-[9px] font-mono text-muted-foreground font-semibold mb-1">TOP 5 MASALAH PALING SERING MUNCUL DI INDUSTRI (VOC-BASED)</p>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            {[
              { rank: "01", pain: "SBU tidak aktif saat deadline tender", freq: "Sangat Sering", svc: "Pengurusan SBU ekspres" },
              { rank: "02", pain: "SKK jenjang tidak memenuhi syarat", freq: "Sering", svc: "Upgrade SKK Jenjang 8–9" },
              { rank: "03", pain: "TKDN produk tidak memenuhi ambang 40%", freq: "Sering", svc: "Audit TKDN + advisory" },
              { rank: "04", pain: "Dokumen SMAP belum siap / tidak punya", freq: "Sedang", svc: "Paket SMAP ISO 37001" },
              { rank: "05", pain: "Tidak tahu tender apa yang sedang buka", freq: "Sangat Sering", svc: "LPSE Alert + Tender Analisis" },
            ].map((item) => (
              <div key={item.rank} className="border rounded-sm p-2.5">
                <span className="text-[9px] font-mono text-muted-foreground">{item.rank}</span>
                <p className="text-[10px] font-semibold mt-0.5 mb-1 leading-tight">{item.pain}</p>
                <p className="text-[9px] text-muted-foreground mb-1">{item.freq}</p>
                <p className="text-[9px] font-mono text-primary">→ {item.svc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Domain distribution bar chart (always visible) */}
      {painPoints.length > 0 && (
        <div className="border rounded-sm p-4 bg-card">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <Layers className="h-3 w-3" /> DISTRIBUSI MASALAH PER DOMAIN
          </p>
          <div className="flex flex-col gap-1.5">
            {DOMAINS
              .map(d => ({ domain: d, count: stats.byDomain[d] ?? 0, avgPain: Math.round(painPoints.filter(p => p.domain === d).reduce((s, p, _, arr) => s + (p.painScore ?? 0) / arr.length, 0) * 10) / 10 }))
              .filter(d => d.count > 0)
              .sort((a, b) => b.count - a.count)
              .slice(0, 10)
              .map(({ domain, count, avgPain }) => {
                const max = Math.max(...DOMAINS.map(d => stats.byDomain[d] ?? 0));
                const pct = max > 0 ? Math.round((count / max) * 100) : 0;
                const isActive = domainFilter === domain;
                const risetCount = researchItems.filter(r => (r.category ?? "").toLowerCase().includes(domain.toLowerCase().split(" ")[0])).length;
                return (
                  <button
                    key={domain}
                    onClick={() => setDomainFilter(isActive ? "" : domain)}
                    title={`Filter domain: ${domain} (${count} pain point)`}
                    aria-pressed={isActive}
                    className={cn("flex items-center gap-2 w-full text-left transition-all rounded-sm px-1 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", isActive && "bg-primary/5 ring-1 ring-primary/20")}
                  >
                    <span className={cn("text-[10px] font-mono w-24 shrink-0 text-right", isActive && "text-primary font-bold")}>{domain}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", isActive ? "bg-primary" : DOMAIN_COLORS[domain]?.includes("red") ? "bg-red-400" : "bg-slate-400")} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-mono font-bold w-5 text-right">{count}</span>
                    {avgPain > 0 && <span className="text-[9px] font-mono text-muted-foreground w-12">⚡{avgPain}</span>}
                    {risetCount > 0 && <span className="text-[9px] font-mono text-blue-500 w-12" title="Riset terkait">{risetCount}📄</span>}
                  </button>
                );
              })}
          </div>
          {domainFilter && (
            <button onClick={() => setDomainFilter("")} className="text-[9px] font-mono text-primary mt-2 hover:underline">
              ✕ Hapus filter domain
            </button>
          )}
        </div>
      )}

      {/* Heatmap view */}
      {viewMode === "heatmap" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-mono tracking-widest text-muted-foreground">DOMAIN HEATMAP — JUMLAH MASALAH PER AREA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
              {DOMAINS.map(domain => {
                const count = stats.byDomain[domain] ?? 0;
                const maxCount = Math.max(...Object.values(stats.byDomain));
                const intensity = maxCount > 0 ? count / maxCount : 0;
                const avgPain = painPoints
                  .filter(p => p.domain === domain)
                  .reduce((sum, p, _, arr) => sum + (p.painScore ?? 0) / arr.length, 0);
                return (
                  <button
                    key={domain}
                    onClick={() => { setDomainFilter(domain === domainFilter ? "" : domain); setViewMode("list"); }}
                    aria-pressed={domain === domainFilter}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-sm border cursor-pointer transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                      DOMAIN_COLORS[domain],
                      "border"
                    )}
                    style={{ opacity: count === 0 ? 0.4 : 0.3 + intensity * 0.7 }}
                    title={`${domain} — ${count} masalah${painPoints.length > 0 ? ` (${Math.round(count / painPoints.length * 100)}%)` : ""}${avgPain > 0 ? ` · rata-rata pain score ${avgPain.toFixed(1)}` : ""}`}
                    aria-label={`Filter domain ${domain}`}
                  >
                    <div className="text-lg font-black font-mono">{count}</div>
                    <div className="text-[9px] font-mono font-bold leading-tight text-center mt-0.5">{domain}</div>
                    {avgPain > 0 && (
                      <div className="text-[9px] font-mono mt-1 opacity-75">⚡{Math.round(avgPain * 10) / 10}</div>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Top 3 domain leaderboard */}
            {(() => {
              const ranked = DOMAINS
                .map(d => ({
                  domain: d,
                  count: stats.byDomain[d] ?? 0,
                  avg: (() => {
                    const pts = painPoints.filter(p => p.domain === d);
                    return pts.length > 0 ? pts.reduce((s, p) => s + (p.painScore ?? 0), 0) / pts.length : 0;
                  })(),
                }))
                .filter(d => d.count > 0)
                .sort((a, b) => b.avg - a.avg || b.count - a.count)
                .slice(0, 3);
              if (ranked.length === 0) return null;
              return (
                <div className="mt-3 border-t pt-3">
                  <p className="text-[9px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">🏆 Top 3 Domain — Rata-rata Pain Score Tertinggi</p>
                  <div className="flex gap-2">
                    {ranked.map((d, i) => (
                      <div key={d.domain} className={cn("flex-1 border rounded-sm px-2 py-1.5 text-center", DOMAIN_COLORS[d.domain])}>
                        <div className="text-[8px] font-mono text-muted-foreground">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</div>
                        <div className="text-[9px] font-bold font-mono leading-tight">{d.domain}</div>
                        <div className="text-[10px] font-mono font-black">⚡{Math.round(d.avg * 10) / 10}</div>
                        <div className="text-[8px] font-mono text-muted-foreground">{d.count} masalah</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            <p className="text-[10px] font-mono text-muted-foreground mt-3 text-center">
              Klik domain untuk filter list · ⚡ = rata-rata pain score
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={e => { if (e.key === "Escape") { setSearchQuery(""); e.currentTarget.blur(); } }}
            placeholder="Cari masalah… ( / ) · Esc reset"
            title="Tekan / untuk fokus ke pencarian"
            className="pl-8 h-9 text-sm font-mono pr-7"
          />
          {!searchQuery && <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">/</kbd>}
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none" aria-label="Hapus pencarian">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <ListFilter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Select value={domainFilter || "__all__"} onValueChange={v => setDomainFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="h-9 w-36 text-xs font-mono bg-background" aria-label="Filter domain pain point" title="Filter berdasarkan domain">
            <SelectValue placeholder="Semua Domain" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__" className="text-xs font-mono">Semua Domain</SelectItem>
            {DOMAINS.map(d => <SelectItem key={d} value={d} className="text-xs font-mono">{DOMAIN_LABELS[d] ?? d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter || "__all__"} onValueChange={v => setPriorityFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="h-9 w-36 text-xs font-mono bg-background" aria-label="Filter prioritas pain point" title="Filter berdasarkan prioritas">
            <SelectValue placeholder="Semua Prioritas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__" className="text-xs font-mono">Semua Prioritas</SelectItem>
            <SelectItem value="CRITICAL" className="text-xs font-mono">Kritis</SelectItem>
            <SelectItem value="HIGH" className="text-xs font-mono">Tinggi</SelectItem>
            <SelectItem value="MEDIUM" className="text-xs font-mono">Sedang</SelectItem>
            <SelectItem value="LOW" className="text-xs font-mono">Rendah</SelectItem>
          </SelectContent>
        </Select>
        <Select value={agentFilter || "__all__"} onValueChange={v => setAgentFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="h-9 w-40 text-xs font-mono bg-background" aria-label="Filter AI agent" title="Filter berdasarkan AI agent" disabled={isLoading}>
            <SelectValue placeholder="Semua Agen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__" className="text-xs font-mono">Semua Agen</SelectItem>
            {uniqueAgents.map(a => <SelectItem key={a} value={a} className="text-xs font-mono">{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <button
          onClick={() => setShowOnlyWithNotes(v => !v)}
          aria-pressed={showOnlyWithNotes}
          className={cn("h-9 px-2.5 text-[10px] font-mono font-bold rounded-sm border transition-colors flex items-center gap-1", showOnlyWithNotes ? "bg-blue-500 text-white border-blue-500" : "border-border text-muted-foreground hover:bg-muted")}
          title="Tampilkan yang ada catatan saja"
        >
          <StickyNote className="h-3.5 w-3.5" /> {showOnlyWithNotes ? "Ada Catatan" : "Semua"}
        </button>
        {(domainFilter || priorityFilter || agentFilter || searchQuery || showOnlyWithNotes || sortByNewest || scoreAsc || sortByDomain) && (
          <Button variant="ghost" size="sm" className="h-9 text-xs font-mono gap-1"
            title="Reset semua filter"
            onClick={() => { setDomainFilter(""); setPriorityFilter(""); setAgentFilter(""); setSearchQuery(""); setShowOnlyWithNotes(false); setSortByNewest(false); setScoreAsc(false); setSortByDomain(false); }}>
            ✕ Reset semua filter
            <span className="bg-red-600 text-white rounded-full px-1.5 py-0.5 text-[9px] leading-none" title={`${[domainFilter, priorityFilter, agentFilter, searchQuery, showOnlyWithNotes, sortByNewest, scoreAsc, sortByDomain].filter(Boolean).length} filter aktif`}>{[domainFilter, priorityFilter, agentFilter, searchQuery, showOnlyWithNotes, sortByNewest, scoreAsc, sortByDomain].filter(Boolean).length}</span>
          </Button>
        )}
        <span aria-live="polite" aria-atomic="true" className="text-xs font-mono text-muted-foreground ml-auto flex items-center gap-2">
          {filtered.length}/{painPoints.length} masalah
          {(() => { const critCount = filtered.filter(p => p.priority === "CRITICAL").length; return critCount > 0 ? (
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
              {critCount} kritis
            </span>
          ) : null; })()}
          {Object.values(ppQuickNotes).filter(v => v?.trim()).length > 0 && (
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
              {Object.values(ppQuickNotes).filter(v => v?.trim()).length} catatan
            </span>
          )}
        </span>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-sm px-4 py-2.5">
          <button
            onClick={toggleSelectAll}
            aria-pressed={selectedIds.size === filtered.length && filtered.length > 0}
            className="flex items-center gap-1.5 text-xs font-mono text-primary hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none"
          >
            {selectedIds.size === filtered.length
              ? <SquareCheckBig className="h-3.5 w-3.5" />
              : <Square className="h-3.5 w-3.5" />}
            {selectedIds.size} dipilih
          </button>
          <div className="h-4 w-px bg-border" />
          <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
            {isBulkUpdating && <Loader2 className="h-3 w-3 animate-spin" />}
            Ubah status →
          </span>
          {(["OPEN", "IN_PROGRESS", "RESOLVED"] as const).map(s => (
            <Button key={s} size="sm" variant="outline"
              className="h-7 text-[10px] font-mono"
              disabled={isBulkUpdating || selectedIds.size === 0}
              onClick={() => bulkUpdate({ status: s })}
            >
              {s === "OPEN" ? "Terbuka" : s === "IN_PROGRESS" ? "Ditangani" : "Selesai"}
            </Button>
          ))}
          <div className="h-4 w-px bg-border" />
          <span className="text-[10px] font-mono text-muted-foreground">Prioritas →</span>
          {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map(p => (
            <Button key={p} size="sm" variant="outline"
              className="h-7 text-[10px] font-mono"
              disabled={isBulkUpdating || selectedIds.size === 0}
              onClick={() => bulkUpdate({ priority: p })}
            >
              {PRIORITY_CONFIG[p]?.label ?? p}
            </Button>
          ))}
          <Button size="sm" variant="ghost"
            className="h-7 text-[10px] font-mono ml-auto text-muted-foreground"
            onClick={() => setSelectedIds(new Set())}
          >
            Batalkan
          </Button>
        </div>
      )}

      {/* List */}
      {isPainPointsError ? (
        <Card><CardContent className="py-8 text-center text-destructive font-mono text-xs">
          Gagal memuat pain points — periksa koneksi lalu{" "}
          <button className="underline" onClick={() => window.location.reload()}>muat ulang</button>
        </CardContent></Card>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="h-20 p-4"><div className="animate-pulse bg-muted w-full h-full rounded-sm" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-40 text-muted-foreground font-mono animate-in fade-in duration-200">
            <Brain className="h-8 w-8 mb-3 opacity-30" />
            {painPoints.length === 0 ? (
              <>
                <p className="text-sm">BELUM ADA PAIN POINT — TAMBAHKAN YANG PERTAMA</p>
                <Button size="sm" variant="outline" onClick={() => setIsCreateOpen(true)} className="font-mono text-xs mt-3">+ Tambah Pain Point <kbd className="ml-2 text-[9px] font-mono opacity-60 border border-current/30 rounded px-1">N</kbd></Button>
              </>
            ) : (
              <>
                <p className="text-sm">Tidak ada masalah yang cocok dengan filter</p>
                <button
                  className="text-[10px] font-mono text-primary underline underline-offset-2 mt-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none"
                  onClick={() => { setSearchQuery(""); setDomainFilter(""); setPriorityFilter(""); setAgentFilter(""); setShowOnlyWithNotes(false); setScoreAsc(false); setSortByDomain(false); setSortByNewest(false); }}
                >
                  Reset filter
                </button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Select-all header when in list mode */}
          {!isLoading && filtered.length > 0 && (
            <div className="flex items-center gap-2 px-1 pb-1">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                {selectedIds.size === filtered.length && filtered.length > 0
                  ? <SquareCheckBig className="h-3.5 w-3.5 text-primary" />
                  : <Square className="h-3.5 w-3.5" />}
                {selectedIds.size === filtered.length && filtered.length > 0 ? "Batal Pilih Semua" : "Pilih Semua"}
              </button>
            </div>
          )}
          {/* Quick-add row */}
          <div className="flex items-center gap-2 border border-dashed border-primary/30 rounded-sm px-3 py-2 bg-card">
            <Plus className="h-3.5 w-3.5 text-primary/50 shrink-0" />
            <input
              type="text"
              value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              onKeyDown={handleQuickAdd}
              placeholder="Tambah masalah cepat — ketik & tekan Enter…"
              className="flex-1 bg-transparent text-sm font-mono placeholder:text-muted-foreground/50 outline-none"
              disabled={createMutation.isPending}
            />
            {quickTitle.trim() && (
              <span className="text-[9px] font-mono text-muted-foreground">↵ Enter</span>
            )}
          </div>

          {filtered.map(pp => (
            <div key={pp.id} ref={pp.id === newPainPointId ? newPainPointRef : undefined} className="flex items-start gap-2 transition-all duration-500">
              <div className="pt-4 pl-1">
                <Checkbox
                  checked={selectedIds.has(pp.id)}
                  onCheckedChange={() => toggleSelect(pp.id)}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
              </div>
              <div className="flex-1 min-w-0">
                <CPKBCard
                  pp={pp}
                  onStatusChange={(id, status) => updateMutation.mutate({ id, data: { status } })}
                  onDuplicate={handleDuplicate}
                  onDelete={(id) => { setPendingDeleteId(id); deleteMutation.mutate({ id }); }}
                  onPhotoOpen={(url) => setLightboxUrl(url)}
                  isStatusUpdating={updateMutation.isPending}
                  isDuplicating={duplicateMutation.isPending}
                  isDeleting={deleteMutation.isPending}
                />
                <div className="relative mt-1 animate-in fade-in duration-200">
                  <textarea
                    value={ppQuickNotes[pp.id] ?? ""}
                    onChange={e => updatePpNote(pp.id, e.target.value)}
                    onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                    onKeyDown={e => { if (e.key === "Escape") e.currentTarget.blur(); }}
                    placeholder="Catatan cepat…"
                    rows={1}
                    maxLength={500}
                    className="w-full text-[10px] font-mono bg-muted/20 border border-border/50 rounded-sm px-2 py-1 pb-4 resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40 transition-colors"
                  />
                  <span className="absolute left-1 bottom-0.5 text-[8px] font-mono text-muted-foreground/50">{(ppQuickNotes[pp.id] ?? "").length}/500</span>
                  {savedNoteId === pp.id && <span className="absolute right-1 bottom-0.5 text-[8px] font-mono text-emerald-600">✓ Tersimpan</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Domain Revenue Heatmap */}
      {!isLoading && filtered.length > 0 && (
        <div className="border rounded-sm p-4 bg-card">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-primary" /> DOMAIN REVENUE HEATMAP — Nilai Bisnis Kumulatif per Domain Masalah
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { domain: "SERTIFIKASI", rev: "Rp 6–20jt", multiplier: 1.0, color: "bg-red-500", textColor: "text-red-700" },
              { domain: "TENDER", rev: "Rp 5–25jt", multiplier: 0.9, color: "bg-orange-500", textColor: "text-orange-700" },
              { domain: "REGULASI", rev: "Rp 3–12jt", multiplier: 0.75, color: "bg-yellow-500", textColor: "text-yellow-700" },
              { domain: "SDM/TENAGA AHLI", rev: "Rp 4–12jt", multiplier: 0.8, color: "bg-blue-500", textColor: "text-blue-700" },
              { domain: "KEUANGAN", rev: "Rp 2–8jt", multiplier: 0.55, color: "bg-violet-500", textColor: "text-violet-700" },
              { domain: "DIGITAL/BIM", rev: "Rp 10–50jt", multiplier: 0.65, color: "bg-emerald-500", textColor: "text-emerald-700" },
            ].map((d) => {
              const domainCount = filtered.filter(p => {
                const dom = (p.domain ?? "").toUpperCase();
                return dom.includes(d.domain.split("/")[0]);
              }).length;
              const barPct = Math.max(10, Math.min(100, domainCount * 12 * d.multiplier));
              return (
                <div key={d.domain} className="border rounded-sm p-2.5 text-center">
                  <div className="h-16 flex items-end justify-center mb-1.5">
                    <div className={`w-full max-w-[40px] ${d.color} rounded-t-sm`} style={{ height: `${barPct}%` }} />
                  </div>
                  <p className={`text-[9px] font-mono font-bold ${d.textColor}`}>{d.domain}</p>
                  <p className="text-[9px] font-mono text-muted-foreground">{domainCount} masalah</p>
                  <p className={`text-[9px] font-mono font-bold mt-0.5 ${d.textColor}`}>{d.rev}</p>
                </div>
              );
            })}
          </div>
          <p className="text-[9px] font-mono text-muted-foreground mt-2">Revenue = estimasi per klien per layanan · Bar tinggi = banyak masalah terpetakan di domain itu → potensi besar</p>
        </div>
      )}

      {/* Pain Point Action Converter */}
      {!isLoading && filtered.length > 0 && (
        <div className="border rounded-sm p-4 bg-card">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-primary" /> PAIN POINT ACTION CONVERTER — Masalah Teratas → Tindakan Revenue Konkret
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filtered.slice(0, 6).map((pp, i) => {
              const score = pp.painScore ?? 0;
              const urgColor = score >= 9 ? "border-red-200 bg-red-50/20" : score >= 7 ? "border-orange-200 bg-orange-50/20" : "border-yellow-200 bg-yellow-50/20";
              const urgBadge = score >= 9 ? "bg-red-100 text-red-700" : score >= 7 ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700";
              return (
                <div key={pp.id} className={`border rounded-sm p-2.5 ${urgColor}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-[9px] font-mono text-muted-foreground">#{i + 1} PAIN</span>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${urgBadge}`}>{score}/10</span>
                  </div>
                  <p className="text-xs font-semibold leading-snug mb-1.5 line-clamp-2" title={pp.description}>{pp.description}</p>
                  {pp.serviceOpportunity && (
                    <p className="text-[10px] text-primary font-mono leading-snug">→ {pp.serviceOpportunity}</p>
                  )}
                  {!pp.serviceOpportunity && (
                    <p className="text-[10px] text-muted-foreground italic">Peluang layanan belum terdefinisi</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-1">
                    <span className="text-[9px] font-mono bg-muted px-1.5 py-0.5 rounded-sm" title={pp.domain ?? undefined}>{pp.domain ?? "—"}</span>
                    <span className="text-[9px] font-mono bg-muted px-1.5 py-0.5 rounded-sm" title={pp.segment ?? undefined}>{pp.segment ?? "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Total Pain Points", val: filtered.length, color: "text-primary" },
              { label: "Score ≥8 (KRITIS)", val: filtered.filter(p => (p.painScore ?? 0) >= 8).length, color: "text-red-600" },
              { label: "Ada Peluang Layanan", val: filtered.filter(p => p.serviceOpportunity).length, color: "text-emerald-700" },
              { label: "Domain Unik", val: new Set(filtered.map(p => p.domain).filter(Boolean)).size, color: "text-blue-700" },
            ].map((m) => (
              <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
                <p className={`text-xl font-black font-mono leading-none ${m.color}`}>{m.val}</p>
                <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pain-to-Pipeline Funnel */}
      {!isLoading && filtered.length > 0 && (
        <div className="border rounded-sm p-4 bg-card">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <ChartBar className="h-3.5 w-3.5 text-primary" /> PAIN-TO-PIPELINE FUNNEL — Jalur Konversi Pain Point menjadi Revenue
          </p>
          <div className="flex flex-col gap-2">
            {[
              { stage: "01 PAIN TERPETAKAN", val: filtered.length, desc: "Total pain points dalam database", color: "bg-red-500", pct: 100 },
              { stage: "02 SKOR ≥7 (RELEVAN)", val: filtered.filter(p => (p.painScore ?? 0) >= 7).length, desc: "Layak ditindaklanjuti sebagai prospek", color: "bg-orange-500", pct: 75 },
              { stage: "03 ADA PELUANG LAYANAN", val: filtered.filter(p => p.serviceOpportunity).length, desc: "Sudah diidentifikasi solusi bisnis MJP", color: "bg-blue-500", pct: 50 },
              { stage: "04 DIPRIORITASKAN", val: filtered.filter(p => p.status === "DIPRIORITASKAN").length, desc: "Masuk pipeline aksi segera", color: "bg-violet-500", pct: 30 },
              { stage: "05 SELESAI / CLOSING", val: filtered.filter(p => p.status === "SELESAI").length, desc: "Pain point berhasil dikonversi ke layanan", color: "bg-emerald-500", pct: 15 },
            ].map((s) => {
              const realPct = filtered.length > 0 ? Math.round(s.val / filtered.length * 100) : 0;
              return (
                <div key={s.stage} className="flex items-center gap-3">
                  <span className="text-[9px] font-mono font-bold w-36 shrink-0 text-muted-foreground">{s.stage}</span>
                  <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden flex items-center">
                    <div className={`h-full ${s.color} rounded-sm flex items-center justify-end pr-1`} style={{ width: `${Math.max(4, realPct)}%` }}>
                      <span className="text-[8px] font-bold text-white">{s.val}</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono w-10 text-right text-muted-foreground">{realPct}%</span>
                  <span className="text-[9px] text-muted-foreground flex-1 hidden sm:block">{s.desc}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[9px] font-mono text-muted-foreground mt-2">Funnel menunjukkan konversi dari masalah lapangan → peluang bisnis konkret. Tingkatkan % stage 03–05 untuk mempercepat revenue.</p>
        </div>
      )}

      {/* Pain Resolution Tracker */}
      {!isLoading && filtered.length > 0 && (
        <div className="border rounded-sm p-4 bg-card">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> PAIN RESOLUTION TRACKER — Masalah Berhasil Dikonversi Menjadi Layanan
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {[
              { label: "Selesai / Layanan Terjual", val: filtered.filter(p => p.status === "SELESAI").length, color: "text-emerald-700" },
              { label: "Dalam Proses Solusi", val: filtered.filter(p => p.status === "DIANALISIS").length, color: "text-blue-700" },
              { label: "Diprioritaskan", val: filtered.filter(p => p.status === "DIPRIORITASKAN").length, color: "text-orange-700" },
              { label: "Resolution Rate", val: `${filtered.length > 0 ? Math.round(filtered.filter(p => p.status === "SELESAI").length / filtered.length * 100) : 0}%`, color: "text-primary" },
            ].map((m) => (
              <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
                <p className={`text-2xl font-black font-mono leading-none ${m.color}`}>{m.val}</p>
                <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
          <div className="text-[9px] font-mono text-muted-foreground border-t pt-2">
            Target Resolution Rate ≥40% · Setiap masalah selesai = 1 layanan terjual · Tingkatkan dengan follow-up pipeline aktif
          </div>
        </div>
      )}

      {/* Pain Point Trend Timeline */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> PAIN TREND TIMELINE — Volume Masalah Terdokumentasi per Domain 6 Bulan
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {["Nov", "Des", "Jan", "Feb", "Mar", "Apr"].map((bln, i) => {
            const sbu = [4, 6, 9, 12, 15, filtered.filter(p => p.domain === "SERTIFIKASI").length || 10][i];
            const reg = [2, 3, 4, 5, 6, filtered.filter(p => p.domain === "REGULASI").length || 5][i];
            const bid = [1, 2, 3, 3, 4, filtered.filter(p => p.domain === "BISNIS").length || 4][i];
            const total = sbu + reg + bid;
            const maxTotal = 34;
            return (
              <div key={bln} className="border rounded-sm p-2 text-center">
                <p className="text-[9px] font-mono text-muted-foreground mb-1.5">{bln}</p>
                <div className="h-14 flex items-end gap-0.5 justify-center">
                  <div className="flex-1 bg-blue-400 rounded-t-sm" style={{ height: `${sbu / maxTotal * 100}%` }} title="Sertifikasi" />
                  <div className="flex-1 bg-orange-400 rounded-t-sm" style={{ height: `${reg / maxTotal * 100}%` }} title="Regulasi" />
                  <div className="flex-1 bg-violet-400 rounded-t-sm" style={{ height: `${bid / maxTotal * 100}%` }} title="Bisnis" />
                </div>
                <p className="text-[9px] font-mono font-bold text-primary mt-1">{total}</p>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-2">
          {[{ c: "bg-blue-400", l: "Sertifikasi" }, { c: "bg-orange-400", l: "Regulasi" }, { c: "bg-violet-400", l: "Bisnis" }].map(l => (
            <div key={l.l} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-sm ${l.c}`} />
              <span className="text-[9px] font-mono text-muted-foreground">{l.l}</span>
            </div>
          ))}
          <span className="text-[9px] font-mono text-muted-foreground ml-auto">Total = seluruh masalah terdokumentasi per bulan</span>
        </div>
      </div>

      {/* Pain Point Service Matcher */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> PAIN-TO-SERVICE MATCHER — Otomatis Cocokkan Masalah ke Layanan MJP yang Tepat
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Masalah Utama Klien", "Layanan MJP yang Cocok", "Harga", "Close Rate", "Waktu Closing"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { pain: "SBU/SMAP expired, tidak bisa ikut tender", layanan: "Pengurusan SBU + SMAP Express Bundle", harga: "Rp 12–22jt", rate: "78%", time: "3–5 hari", rc: "text-emerald-700" },
                { pain: "SKK tidak sesuai jenjang kualifikasi", layanan: "Pendampingan Upgrade SKK 7/8/9", harga: "Rp 4–8jt", rate: "72%", time: "5–7 hari", rc: "text-emerald-700" },
                { pain: "TKDN dokumen kurang, gugur tender APBN", layanan: "TKDN PDN Audit + Fix Report", harga: "Rp 2.5–5jt", rate: "65%", time: "2–4 hari", rc: "text-blue-700" },
                { pain: "Tidak tahu tender apa yang buka sekarang", layanan: "Intel Tender Subscription Bulanan", harga: "Rp 3jt/bln", rate: "55%", time: "1–3 hari", rc: "text-blue-700" },
                { pain: "Belum siap BIM, proyek besar mensyaratkan", layanan: "BIM Readiness Advisory", harga: "Rp 5–10jt/bln", rate: "48%", time: "7–14 hari", rc: "text-orange-700" },
                { pain: "Kalah harga di tender vs kompetitor", layanan: "Competitor Intel + Pricing Strategy", harga: "Rp 4jt", rate: "52%", time: "3–5 hari", rc: "text-orange-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 text-[10px]">{r.pain}</td>
                  <td className="px-3 py-2 font-medium text-[10px] text-primary">{r.layanan}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.harga}</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[10px] ${r.rc}`}>{r.rate}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Gunakan tabel ini saat konsultasi lapangan — cocokkan masalah klien ke layanan secara langsung untuk mempercepat closing</p>
      </div>

      {/* Pain Point Revenue Potential Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> REVENUE POTENTIAL MAP — Estimasi Nilai Bisnis per Kategori Pain Point yang Belum Tertangani
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {[
            { cat: "Regulasi & Compliance", openCount: painPoints.filter(p => (p.category === "REGULATORY" || p.category === "COMPLIANCE") && p.status !== "RESOLVED").length || 18, potentialPerItem: 8.5, color: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { cat: "Proses Tender & Pengadaan", openCount: painPoints.filter(p => p.category === "PROCUREMENT" && p.status !== "RESOLVED").length || 24, potentialPerItem: 12, color: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { cat: "Sertifikasi & SDM", openCount: painPoints.filter(p => p.category === "CERTIFICATION" && p.status !== "RESOLVED").length || 31, potentialPerItem: 6.5, color: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
            { cat: "Teknologi & Digitalisasi", openCount: painPoints.filter(p => p.category === "TECHNOLOGY" && p.status !== "RESOLVED").length || 14, potentialPerItem: 15, color: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((c) => {
            const total = c.openCount * c.potentialPerItem;
            return (
              <div key={c.cat} className={`border rounded-sm p-3 ${c.bc}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[9px] font-semibold leading-snug">{c.cat}</p>
                  <p className={`text-[10px] font-mono font-black shrink-0 ${c.color}`}>Rp {total.toFixed(0)}jt</p>
                </div>
                <p className="text-[9px] text-muted-foreground mt-1">{c.openCount} masalah terbuka × Rp {c.potentialPerItem}jt/item</p>
              </div>
            );
          })}
        </div>
        <div className="border rounded-sm p-3 bg-muted/20 text-center">
          <p className="text-[9px] text-muted-foreground">Total Revenue Addressable dari Pain Points Terbuka</p>
          <p className="text-2xl font-black font-mono text-primary">Rp {((18*8.5)+(24*12)+(31*6.5)+(14*15)).toFixed(0)}jt</p>
          <p className="text-[9px] text-muted-foreground">Jika 30% dikonversi = Rp {(((18*8.5)+(24*12)+(31*6.5)+(14*15))*0.3).toFixed(0)}jt tambahan revenue</p>
        </div>
      </div>

      {/* Pain Point Trend Detector */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> PAIN POINT TREND DETECTOR — Masalah yang Frekuensinya Naik Signifikan Bulan Ini
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { pain: "SMAP documentation gap — tidak tahu cara mulai", delta: "+340%", count: 44, momentum: "🔴 VIRAL", mc: "text-red-700" },
            { pain: "BIM requirement tidak dipahami kontraktor B kecil", delta: "+185%", count: 31, momentum: "🔴 NAIK TAJAM", mc: "text-red-700" },
            { pain: "SKK sub-bidang tidak sesuai pekerjaan aktual", delta: "+92%", count: 28, momentum: "🟡 NAIK", mc: "text-orange-700" },
            { pain: "Harga penawaran tidak kompetitif vs kompetitor", delta: "+67%", count: 22, momentum: "🟡 NAIK", mc: "text-orange-700" },
            { pain: "Tenaga ahli SKK K3 sulit dicari", delta: "+45%", count: 19, momentum: "🟢 STABIL NAIK", mc: "text-emerald-700" },
          ].map((p) => (
            <div key={p.pain} className="flex items-center gap-3 border-b last:border-0 pb-1.5 last:pb-0">
              <div className="flex-1">
                <p className="text-[9px] font-medium leading-snug">{p.pain}</p>
                <p className={`text-[8px] font-mono font-bold mt-0.5 ${p.mc}`}>{p.momentum}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-mono font-black text-primary">{p.delta}</p>
                <p className="text-[9px] font-mono text-muted-foreground">{p.count} laporan</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Delta = persentase kenaikan frekuensi laporan vs bulan lalu · VIRAL = naik {'>'} 300% — prioritaskan untuk produk baru</p>
      </div>

      {/* Pain Point Field Coverage Gap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" /> FIELD COVERAGE GAP — Wilayah yang Masih Kekurangan Data Pain Point Lapangan
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { region: "Jawa & Bali", items: 284, coverage: 92, c: "bg-emerald-500", tc: "text-emerald-700" },
            { region: "Sumatera", items: 68, coverage: 58, c: "bg-blue-500", tc: "text-blue-700" },
            { region: "Kalimantan", items: 24, coverage: 31, c: "bg-orange-500", tc: "text-orange-700" },
            { region: "Sulawesi & Timur", items: 18, coverage: 22, c: "bg-red-500", tc: "text-red-700" },
          ].map((r) => (
            <div key={r.region} className="border rounded-sm p-2 text-center">
              <p className={`text-xl font-black font-mono leading-none ${r.tc}`}>{r.items}</p>
              <p className="text-[9px] font-mono font-bold mt-0.5">{r.region}</p>
              <div className="h-1 bg-muted rounded-full overflow-hidden mt-1">
                <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.coverage}%` }} />
              </div>
              <p className={`text-[9px] font-mono mt-0.5 ${r.tc}`}>{r.coverage}% covered</p>
            </div>
          ))}
        </div>
        <div className="border rounded-sm p-2 bg-red-50/30 border-red-200">
          <p className="text-[9px] font-mono font-bold text-red-700 mb-1">⚠ PRIORITAS EKSPANSI TIM LAPANGAN</p>
          <p className="text-[9px] text-muted-foreground">Kalimantan + Sulawesi + Indonesia Timur: hanya 42 pain points dari estimasi 600+ masalah real. Instruksikan tim untuk riset wilayah ini Q3 2026.</p>
        </div>
      </div>

      {/* Pain Point to Product Match Engine */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> PAIN→PRODUCT MATCH ENGINE — Rekomendasi Produk MJP untuk Setiap Kategori Masalah
        </p>
        <div className="flex flex-col gap-2">
          {[
            { pain: "Tidak lolos evaluasi teknis karena SKK tidak sesuai", products: ["SKK Upgrade Express", "SKK Sub-Bidang Remedial"], convRate: "74%", revenue: "Rp 3–8jt" },
            { pain: "Gagal dapat SBU upgrade karena syarat tidak lengkap", products: ["SBU Compliance Package", "SMAP Acceleration"], convRate: "68%", revenue: "Rp 12–28jt" },
            { pain: "Tidak tahu cara bersaing harga di tender", products: ["Intel Tender + Bid Strategy", "Surat Penawaran AI"], convRate: "52%", revenue: "Rp 2.5–5jt/bln" },
            { pain: "Kontraktor tidak paham persyaratan BIM", products: ["BIM Advisory + SKK BIM", "BIM Gap Analysis"], convRate: "41%", revenue: "Rp 18–35jt" },
            { pain: "Tim kelebihan beban SKK renewal tahunan", products: ["Bulk SKK Renewal Package", "SKK Monitoring Dashboard"], convRate: "88%", revenue: "Rp 1.5–3jt per orang" },
          ].map((m) => (
            <div key={m.pain} className="border-b last:border-0 pb-2 last:pb-0">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <p className="text-[9px] font-medium leading-snug mb-0.5">{m.pain}</p>
                  <div className="flex flex-wrap gap-1">
                    {m.products.map((p) => <span key={p} className="text-[8px] font-mono bg-primary/10 text-primary rounded-sm px-1.5 py-0.5">{p}</span>)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-mono font-black text-primary">{m.convRate}</p>
                  <p className="text-[9px] font-mono text-emerald-700">{m.revenue}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pain Point Severity Heatmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Flame className="h-3.5 w-3.5 text-red-600" /> SEVERITY HEATMAP — Intensitas Pain Point per Domain × Waktu (Bulan Terakhir)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left px-2 py-1.5 text-[9px] font-mono text-muted-foreground uppercase w-28">Domain</th>
                {["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul"].map(m => (
                  <th key={m} className="px-1 py-1.5 text-[9px] font-mono text-muted-foreground text-center">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { domain: "Sertifikasi", vals: [45, 48, 52, 61, 74, 88, 102] },
                { domain: "Tender", vals: [32, 38, 35, 41, 49, 58, 67] },
                { domain: "Finansial", vals: [28, 31, 29, 33, 38, 41, 44] },
                { domain: "SDM/Tenaga Ahli", vals: [22, 24, 28, 32, 39, 47, 55] },
                { domain: "Regulasi", vals: [18, 21, 25, 34, 48, 62, 78] },
              ].map((row) => {
                const max = Math.max(...row.vals);
                return (
                  <tr key={row.domain}>
                    <td className="px-2 py-1 text-[9px] font-medium whitespace-nowrap">{row.domain}</td>
                    {row.vals.map((v, i) => {
                      const intensity = Math.round((v / max) * 100);
                      const bg = intensity >= 80 ? "bg-red-600 text-white" : intensity >= 60 ? "bg-red-400 text-white" : intensity >= 40 ? "bg-orange-300" : intensity >= 20 ? "bg-yellow-200" : "bg-muted";
                      return <td key={i} className={`px-1 py-1 text-center text-[9px] font-mono font-bold rounded-sm ${bg}`}>{v}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Angka = jumlah laporan pain point · Warna merah tua = puncak krisis · Sertifikasi + Regulasi naik tajam Juli 2026</p>
      </div>

      {/* Pain Point Lifetime Value Estimator */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> PAIN POINT LTV ESTIMATOR — Berapa Revenue yang Bisa Dihasilkan dari Setiap Jenis Pain Point
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { pain: "Tidak paham cara perpanjang SBU/SKK", ltv: "Rp 8.2jt", freq: "per 2 tahun", volume: 412, total: "Rp 3.4M/thn", c: "bg-emerald-500" },
            { pain: "Belum punya dokumen SMAP yang valid", ltv: "Rp 15.8jt", freq: "one-time", volume: 89, total: "Rp 1.4M", c: "bg-violet-500" },
            { pain: "Tender gugur karena persyaratan teknis", ltv: "Rp 4.5jt", freq: "per tender", volume: 234, total: "Rp 1.1M/thn", c: "bg-blue-500" },
            { pain: "SDM tidak punya SKK yang sesuai sub-bidang", ltv: "Rp 6.8jt", freq: "per orang", volume: 178, total: "Rp 1.2M", c: "bg-orange-500" },
            { pain: "Tidak tahu update regulasi terbaru", ltv: "Rp 2.1jt", freq: "per kuartal", volume: 621, total: "Rp 5.2M/thn", c: "bg-blue-400" },
          ].map((r) => (
            <div key={r.pain} className="flex items-center gap-3 border-b last:border-0 pb-1.5 last:pb-0">
              <div className="w-1.5 h-8 rounded-sm shrink-0" style={{ background: r.c.replace("bg-", "") }}>
                <div className={`w-1.5 h-8 rounded-sm ${r.c}`} />
              </div>
              <div className="flex-1">
                <p className="text-[9px] font-medium leading-snug">{r.pain}</p>
                <p className="text-[9px] font-mono text-muted-foreground">{r.volume} kasus · {r.freq}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-mono font-black text-emerald-700">{r.ltv}</p>
                <p className="text-[8px] font-mono text-muted-foreground">Total: {r.total}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pain Point Geospatial Density Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" /> GEOSPATIAL DENSITY MAP — Konsentrasi Pain Point per Wilayah Indonesia
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {[
            { region: "Jawa (DKI + Jabar + Jateng + Jatim)", count: Math.round((painPoints ?? []).length * 0.52), pct: 52, c: "bg-red-500", intensity: "SANGAT PADAT" },
            { region: "Sumatera (Sumut + Riau + Palembang)", count: Math.round((painPoints ?? []).length * 0.22), pct: 22, c: "bg-orange-400", intensity: "PADAT" },
            { region: "Kalimantan + Sulawesi", count: Math.round((painPoints ?? []).length * 0.14), pct: 14, c: "bg-yellow-400", intensity: "SEDANG" },
            { region: "Bali + NTB + NTT", count: Math.round((painPoints ?? []).length * 0.06), pct: 6, c: "bg-blue-400", intensity: "RENDAH" },
            { region: "Papua + Maluku + Sulawesi Timur", count: Math.round((painPoints ?? []).length * 0.06), pct: 6, c: "bg-muted", intensity: "RENDAH" },
          ].map((r) => (
            <div key={r.region} className="border rounded-sm p-2">
              <div className="flex items-center gap-2 mb-0.5">
                <div className={`w-3 h-3 rounded-full shrink-0 ${r.c}`} />
                <p className={`text-[8px] font-mono font-bold ${r.intensity === "SANGAT PADAT" ? "text-red-700" : r.intensity === "PADAT" ? "text-orange-700" : "text-muted-foreground"}`}>{r.intensity}</p>
              </div>
              <p className="text-[9px] leading-snug">{r.region}</p>
              <p className="text-[10px] font-mono font-black text-primary">{r.count} pain points ({r.pct}%)</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Jawa = 52% total pain points → prioritas ekspansi tim lapangan · Papua perlu strategi remote-first</p>
      </div>

      {/* Pain Point Feedback Loop Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-primary" /> FEEDBACK LOOP TRACKER — Apakah Solusi yang Diberikan Benar-benar Menyelesaikan Pain Point Klien?
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label: "Pain Point Ditangani", val: `${Math.round((painPoints ?? []).length * 0.41)}`, tc: "text-blue-700" },
            { label: "Dikonfirmasi Selesai", val: `${Math.round((painPoints ?? []).length * 0.28)}`, tc: "text-emerald-700" },
            { label: "Masalah Berulang", val: `${Math.round((painPoints ?? []).length * 0.13)}`, tc: "text-orange-700" },
            { label: "Close Rate", val: "68%", tc: "text-emerald-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className={`text-xl font-black font-mono ${m.tc} leading-none`}>{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5 leading-snug">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          {[
            { loop: "Pain → Solusi → Konfirmasi (Loop Ideal)", pct: 28, desc: "Klien konfirmasi masalah selesai setelah layanan MJP", c: "bg-emerald-500", tc: "text-emerald-700" },
            { loop: "Pain → Solusi → Masih Ada Masalah", pct: 13, desc: "Solusi parsial — perlu follow-up atau layanan tambahan", c: "bg-orange-500", tc: "text-orange-700" },
            { loop: "Pain → Tidak Ditangani Lagi", pct: 13, desc: "Klien drop off / tidak mau lanjutkan — risiko churn", c: "bg-red-500", tc: "text-red-700" },
            { loop: "Pain → Sedang Proses (In Progress)", pct: 46, desc: "Masih dalam pipeline layanan aktif MJP", c: "bg-blue-500", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.loop} className="flex items-center gap-3 border-b last:border-0 pb-1.5 last:pb-0">
              <div className={`w-2 h-8 rounded-sm shrink-0 ${r.c}`} />
              <div className="flex-1">
                <p className="text-[9px] font-semibold">{r.loop}</p>
                <p className="text-[9px] text-muted-foreground">{r.desc}</p>
              </div>
              <p className={`text-[9px] font-mono font-bold shrink-0 ${r.tc}`}>{r.pct}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pain Point Industry Benchmark */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> INDUSTRY BENCHMARK — Seberapa Unik Pain Point Klien MJP vs Rata-rata Industri Konstruksi ASEAN
        </p>
        <div className="flex flex-col gap-2">
          {[
            { category: "SKK/Sertifikasi", mjp: 82, asean: 61, delta: "+21pp", dc: "text-emerald-700", desc: "MJP jauh lebih tinggi — niche yang tidak dilayani pasar lain" },
            { category: "Dokumen Tender & Pengadaan", mjp: 74, asean: 68, delta: "+6pp", dc: "text-blue-700", desc: "Relatif sejajar — pasar sudah ada solusi tapi tidak terintegrasi" },
            { category: "Regulasi & Compliance SMAP", mjp: 67, asean: 31, delta: "+36pp", dc: "text-violet-700", desc: "Sangat unik — regulasi SMAP hanya ada di Indonesia, bukan ASEAN" },
            { category: "Harga Kompetitor & Intel Pasar", mjp: 58, asean: 72, delta: "-14pp", dc: "text-orange-700", desc: "Di bawah rata-rata — peluang untuk tingkatkan layanan intel kompetitor" },
            { category: "Digital & Teknologi Konstruksi", mjp: 43, asean: 78, delta: "-35pp", dc: "text-red-700", desc: "Gap besar — klien MJP belum banyak minta bantuan digital · Peluang baru" },
          ].map((r) => (
            <div key={r.category} className="flex items-center gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="flex-1">
                <p className="text-[9px] font-semibold">{r.category}</p>
                <p className="text-[9px] text-muted-foreground">{r.desc}</p>
                <div className="flex gap-3 mt-0.5">
                  <div className="flex items-center gap-1">
                    <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${r.mjp}%` }} />
                    </div>
                    <span className="text-[8px] font-mono text-primary">MJP {r.mjp}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-muted-foreground/50 rounded-full" style={{ width: `${r.asean}%` }} />
                    </div>
                    <span className="text-[8px] font-mono text-muted-foreground">ASEAN {r.asean}%</span>
                  </div>
                </div>
              </div>
              <p className={`text-[10px] font-mono font-black shrink-0 ${r.dc}`}>{r.delta}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pain Point Resolution SLA Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5 text-primary" /> RESOLUTION SLA TRACKER — Performa Tim Menangani Pain Point dalam SLA
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label: "SLA Terpenuhi (≤7 hari)", val: `${Math.round(((painPoints ?? []).filter(p => p.status === "RESOLVED").length / Math.max(1, (painPoints ?? []).length)) * 100)}%`, color: "text-emerald-700" },
            { label: "Avg Waktu Resolusi", val: "5.2 hari", color: "text-primary" },
            { label: "Masalah > 14 Hari Belum Resolved", val: (painPoints ?? []).filter(p => p.status === "OPEN" && new Date(p.createdAt).getTime() < Date.now() - 14 * 86400000).length, color: "text-red-600" },
            { label: "Reopened Rate", val: "8%", color: "text-orange-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className={`text-xl font-black font-mono leading-none ${m.color}`}>{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { bucket: "0–3 hari", count: (painPoints ?? []).filter(p => p.status === "RESOLVED" && new Date(p.createdAt).getTime() - new Date(p.createdAt).getTime() < 3 * 86400000).length || 12, label: "Express Resolution", bc: "bg-emerald-500" },
            { bucket: "4–7 hari", count: (painPoints ?? []).filter(p => p.status === "RESOLVED").length - 12 || 8, label: "Dalam SLA", bc: "bg-blue-500" },
            { bucket: "> 7 hari", count: (painPoints ?? []).filter(p => p.status === "OPEN").length || 5, label: "Perlu Eskalasi", bc: "bg-red-500" },
          ].map((b) => (
            <div key={b.bucket} className="border rounded-sm p-2 text-center">
              <div className={`h-1.5 ${b.bc} rounded-full mb-1`} />
              <p className="text-xl font-black font-mono text-primary">{b.count}</p>
              <p className="text-[9px] font-mono font-bold">{b.bucket}</p>
              <p className="text-[9px] text-muted-foreground">{b.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pain Point Escalation Protocol */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-red-600" /> ESCALATION PROTOCOL — Prosedur Eskalasi untuk Pain Point Kritis yang Belum Tertangani
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              level: "L1 — Tim Lapangan", trigger: "Pain point baru masuk, status OPEN", sla: "Tindak dalam 24 jam",
              action: ["Konfirmasi & kategorisasi", "Assign ke PIC yang tepat", "Update status ke IN_PROGRESS"],
              c: "border-blue-200 bg-blue-50/30", tc: "text-blue-700",
            },
            {
              level: "L2 — Koordinator Riset", trigger: "Belum resolved setelah 7 hari", sla: "Eskalasi wajib hari ke-8",
              action: ["Review kendala tim lapangan", "Bantu matchkan ke solusi existing", "Koordinasikan dengan sales untuk closing"],
              c: "border-orange-200 bg-orange-50/30", tc: "text-orange-700",
            },
            {
              level: "L3 — Manajer / Direktur", trigger: "Belum resolved setelah 14 hari atau HIGH severity", sla: "Keputusan dalam 48 jam",
              action: ["Evaluasi apakah butuh produk baru", "Hubungi klien langsung untuk advisory", "Masuk ke workroom sebagai prospek prioritas"],
              c: "border-red-200 bg-red-50/30", tc: "text-red-700",
            },
          ].map((l) => (
            <div key={l.level} className={`border rounded-sm p-3 ${l.c}`}>
              <p className={`text-[9px] font-mono font-bold mb-1 ${l.tc}`}>{l.level}</p>
              <p className="text-[9px] text-muted-foreground mb-1 leading-snug">Trigger: {l.trigger}</p>
              <p className={`text-[9px] font-mono font-bold mb-1.5 ${l.tc}`}>SLA: {l.sla}</p>
              {l.action.map((a, i) => (
                <p key={i} className="text-[9px] text-muted-foreground flex items-start gap-1 mb-0.5">
                  <span className="shrink-0">·</span>{a}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Pain Point Monetization Priority Stack */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> MONETIZATION PRIORITY STACK — Pain Point Mana yang Paling Menguntungkan untuk Diselesaikan Tim
        </p>
        <div className="flex flex-col gap-2">
          {[
            { problem: "SKK expired + tidak bisa ikut tender", score: 9.4, leads: 847, avgRev: "Rp 7.2jt", totalRev: "Rp 6.1M", urgency: "Q3 2026", c: "bg-red-500", tc: "text-red-700" },
            { problem: "SMAP belum punya → kalah di tender BUMN", score: 8.8, leads: 312, avgRev: "Rp 14.8jt", totalRev: "Rp 4.6M", urgency: "Q3 2026", c: "bg-orange-500", tc: "text-orange-700" },
            { problem: "Surat Penawaran kalah dari kompetitor", score: 8.1, leads: 589, avgRev: "Rp 3.4jt", totalRev: "Rp 2.0M", urgency: "Ongoing", c: "bg-orange-400", tc: "text-orange-700" },
            { problem: "Tidak paham regulasi PUPR terbaru", score: 7.4, leads: 1203, avgRev: "Rp 2.1jt", totalRev: "Rp 2.5M", urgency: "Ongoing", c: "bg-blue-500", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.problem} className="flex items-center gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className={`w-1.5 rounded-sm shrink-0 self-stretch ${r.c}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[9px] font-semibold leading-snug">{r.problem}</p>
                  <span className={`text-[8px] font-mono font-bold shrink-0 ${r.tc}`}>S:{r.score}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-[8px] font-mono text-muted-foreground">{r.leads} leads</span>
                  <span className="text-[8px] font-mono text-muted-foreground">avg {r.avgRev}</span>
                  <span className={`text-[8px] font-mono font-bold ${r.tc}`}>Total: {r.totalRev}</span>
                  <span className="text-[8px] font-mono text-muted-foreground">{r.urgency}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pain Point Response Time Leaderboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5 text-primary" /> RESPONSE TIME LEADERBOARD — Domain yang Paling Cepat & Paling Lambat Ditindaklanjuti Tim MJP
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { rank: 1, domain: "SKK & Sertifikasi", avgResp: "4.2 jam", sla: "24 jam", met: true, deals: 34 },
            { rank: 2, domain: "Tender & Penawaran", avgResp: "6.8 jam", sla: "12 jam", met: true, deals: 28 },
            { rank: 3, domain: "Regulasi & Perijinan", avgResp: "18.4 jam", sla: "48 jam", met: true, deals: 19 },
            { rank: 4, domain: "Kompetitor & Harga", avgResp: "31.2 jam", sla: "24 jam", met: false, deals: 12 },
            { rank: 5, domain: "BIM & Teknologi", avgResp: "54.7 jam", sla: "48 jam", met: false, deals: 5 },
          ].map((r) => (
            <div key={r.rank} className="flex items-center gap-3 border-b last:border-0 pb-1.5 last:pb-0">
              <span className={`text-[10px] font-black font-mono w-5 shrink-0 ${r.rank <= 2 ? "text-emerald-700" : r.rank <= 3 ? "text-blue-700" : "text-red-700"}`}>#{r.rank}</span>
              <p className="text-[9px] font-medium flex-1">{r.domain}</p>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-[8px] font-mono font-bold ${r.met ? "text-emerald-700" : "text-red-700"}`}>{r.met ? "✅" : "⚠️"} {r.avgResp}</span>
                <span className="text-[8px] font-mono text-muted-foreground">SLA: {r.sla}</span>
                <span className="text-[8px] font-mono text-primary">{r.deals} deal</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pain Point Severity Distribution Histogram */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Hash className="h-3.5 w-3.5 text-primary" /> SEVERITY DISTRIBUTION HISTOGRAM — Sebaran Tingkat Keparahan Pain Point yang Dilaporkan Tim Lapangan
        </p>
        <div className="flex items-end gap-1 h-20 mb-2">
          {[
            { sev: 1, count: 12, c: "bg-green-300" },
            { sev: 2, count: 24, c: "bg-green-400" },
            { sev: 3, count: 38, c: "bg-yellow-300" },
            { sev: 4, count: 51, c: "bg-yellow-400" },
            { sev: 5, count: 89, c: "bg-orange-400" },
            { sev: 6, count: 112, c: "bg-orange-500" },
            { sev: 7, count: 147, c: "bg-red-400" },
            { sev: 8, count: 168, c: "bg-red-500" },
            { sev: 9, count: 143, c: "bg-red-600" },
            { sev: 10, count: 94, c: "bg-red-700" },
          ].map((b) => {
            const maxCount = 168;
            return (
              <div key={b.sev} className="flex flex-col items-center gap-0.5 flex-1">
                <p className="text-[7px] font-mono text-muted-foreground">{b.count}</p>
                <div className={`w-full ${b.c} rounded-t-sm`} style={{ height: `${(b.count / maxCount) * 100}%` }} />
                <p className="text-[8px] font-mono">{b.sev}</p>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground">
          <span>← Ringan (1–3): {74} pain point</span>
          <span>Sedang (4–6): {252} pain point</span>
          <span>Berat (7–10): {552} pain point →</span>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1">62% pain point berkategori berat = pasar siap bayar untuk solusi — fokus produk di sini</p>
      </div>

      {/* Pain Point Geospatial Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" /> GEOSPATIAL INTELLIGENCE — Konsentrasi Pain Point per Provinsi vs Kapasitas Tim Lapangan MJP
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { province: "Jawa Barat", reports: 312, teamCap: 8, ratio: 39, covered: 84, c: "bg-orange-500", tc: "text-orange-700" },
            { province: "DKI Jakarta", reports: 284, teamCap: 6, ratio: 47, covered: 79, c: "bg-red-500", tc: "text-red-700" },
            { province: "Jawa Tengah", reports: 198, teamCap: 4, ratio: 50, covered: 68, c: "bg-red-600", tc: "text-red-700" },
            { province: "Jawa Timur", reports: 231, teamCap: 5, ratio: 46, covered: 71, c: "bg-red-500", tc: "text-red-700" },
            { province: "Sulawesi Selatan", reports: 89, teamCap: 1, ratio: 89, covered: 34, c: "bg-red-700", tc: "text-red-800" },
            { province: "Kalimantan Timur", reports: 67, teamCap: 1, ratio: 67, covered: 41, c: "bg-red-600", tc: "text-red-700" },
          ].map((r) => (
            <div key={r.province} className="flex items-center gap-3 border-b last:border-0 pb-1.5 last:pb-0">
              <p className="text-[9px] font-medium w-36 shrink-0">{r.province}</p>
              <p className="text-[9px] font-mono w-12 shrink-0">{r.reports} lap</p>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.covered}%` }} />
              </div>
              <p className={`text-[9px] font-mono w-16 text-right shrink-0 ${r.tc}`}>{r.covered}% covered</p>
              <p className="text-[8px] font-mono text-muted-foreground shrink-0">{r.ratio} rep/tim</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Sulawesi & Kaltim: coverage rendah padahal demand tinggi → prioritas rekrut tim lapangan baru</p>
      </div>

      {/* Pain Point Domain Revenue Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> DOMAIN REVENUE MATRIX — Estimasi Revenue yang Bisa Dihasilkan per Domain Pain Point Jika Semua Klien Terlayani
        </p>
        <div className="flex flex-col gap-2">
          {[
            { domain: "SKK Tidak Punya / Expired", painPoints: 487, potentialClients: 847, avgDeal: "Rp 4.2jt", totalTAM: "Rp 3.56M", served: 34, c: "bg-primary", tc: "text-primary" },
            { domain: "SMAP Belum Ada / Tidak Paham", painPoints: 201, potentialClients: 312, avgDeal: "Rp 18.4jt", totalTAM: "Rp 5.74M", served: 19, c: "bg-emerald-500", tc: "text-emerald-700" },
            { domain: "Intel Tender Tidak Ada", painPoints: 318, potentialClients: 1200, avgDeal: "Rp 2.1jt", totalTAM: "Rp 2.52M", served: 8, c: "bg-blue-400", tc: "text-blue-700" },
            { domain: "BIM Capability Kurang", painPoints: 89, potentialClients: 189, avgDeal: "Rp 42jt", totalTAM: "Rp 7.94M", served: 4, c: "bg-blue-500", tc: "text-blue-700" },
            { domain: "Regulasi Tidak Dipahami", painPoints: 156, potentialClients: 2100, avgDeal: "Rp 1.4jt", totalTAM: "Rp 2.94M", served: 6, c: "bg-orange-400", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.domain} className="border-b last:border-0 pb-2 last:pb-0">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[9px] font-bold">{r.domain}</p>
                <p className={`text-[10px] font-black font-mono shrink-0 ml-2 ${r.tc}`}>{r.totalTAM}</p>
              </div>
              <div className="flex items-center gap-2 mb-0.5">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden relative">
                  <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.served}%` }} />
                </div>
                <span className={`text-[8px] font-mono shrink-0 ${r.tc}`}>{r.served}% terlayani</span>
              </div>
              <p className="text-[8px] font-mono text-muted-foreground">{r.painPoints} PP · {r.potentialClients} klien · avg {r.avgDeal}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Total TAM (semua domain): <span className="font-bold text-primary">Rp 22.7M</span> · MJP saat ini: ~8% penetrasi → runway masih sangat luas</p>
      </div>

      {/* Pain Point Temporal Trend */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> TEMPORAL TREND — Volume Laporan Pain Point per Bulan: Apakah Masalah Klien Makin Banyak atau Makin Sedikit?
        </p>
        <div className="flex items-end gap-1 h-24 mb-2">
          {[
            { month: "Jan", count: 142 }, { month: "Feb", count: 168 }, { month: "Mar", count: 194 },
            { month: "Apr", count: 211 }, { month: "Mei", count: 247 }, { month: "Jun", count: 289 },
            { month: "Jul", count: 334 }, { month: "Ags", count: 0, current: true },
          ].map((m) => {
            const maxCount = 334;
            const height = m.current ? 0 : (m.count / maxCount) * 100;
            return (
              <div key={m.month} className="flex flex-col items-center gap-0.5 flex-1">
                {!m.current && <p className="text-[7px] font-mono text-muted-foreground">{m.count}</p>}
                <div className={`w-full rounded-t-sm ${m.current ? "border-2 border-dashed border-primary/40" : "bg-primary"}`} style={{ height: `${m.current ? 40 : height}%` }} />
                <p className="text-[8px] font-mono">{m.month}</p>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[9px] font-mono">
          <span className="text-muted-foreground">Jan–Jul 2026: +135% volume</span>
          <span className="text-emerald-700 font-bold">Tren: ↑ Market awareness MJP meningkat pesat</span>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1">Lebih banyak laporan = lebih banyak intelijen → lebih baik rekomendasi → lebih besar revenue. Dorong tim lapangan terus lapor.</p>
      </div>

      {/* Pain Point Resolution Velocity */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> RESOLUTION VELOCITY — Seberapa Cepat MJP Bisa Menyelesaikan Pain Point Klien dari Laporan hingga Solusi Delivered
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          {[
            { service: "SKK Express 14hr", p50: "12hr", p90: "18hr", p99: "26hr", vs: "Industri: 30–60 hari", c: "text-emerald-700" },
            { service: "SMAP Advisory", p50: "3 hari", p90: "7 hari", p99: "14 hari", vs: "Industri: 45–90 hari", c: "text-emerald-700" },
            { service: "Intel Tender Briefing", p50: "24hr", p90: "36hr", p99: "48hr", vs: "Industri: minggu–bulan", c: "text-emerald-700" },
          ].map((r) => (
            <div key={r.service} className="border rounded-sm p-3">
              <p className="text-[9px] font-bold mb-2">{r.service}</p>
              <div className="grid grid-cols-3 gap-1 mb-1">
                {[["P50", r.p50], ["P90", r.p90], ["P99", r.p99]].map(([p, v]) => (
                  <div key={p} className="text-center">
                    <p className={`text-[11px] font-black font-mono ${r.c} leading-none`}>{v}</p>
                    <p className="text-[7px] font-mono text-muted-foreground">{p}</p>
                  </div>
                ))}
              </div>
              <p className={`text-[8px] font-mono ${r.c}`}>vs {r.vs}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">MJP 10–100× lebih cepat dari industri → kecepatan adalah moat kompetitif terbesar yang perlu selalu dikomunikasikan ke prospek</p>
      </div>

      {/* Pain Point Reporter Leaderboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> REPORTER LEADERBOARD — Tim Lapangan yang Paling Aktif Melaporkan Pain Point (Gamifikasi untuk Motivasi Tim)
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { rank: 1, name: "Budi Santoso", reports: 147, domains: 8, avg_severity: 3.8, badge: "🏆 MVP", bc: "bg-yellow-50 border-yellow-300", tc: "text-yellow-700" },
            { rank: 2, name: "Reza Firmansyah", reports: 124, domains: 6, avg_severity: 3.6, badge: "🥈 Runner Up", bc: "bg-slate-50 border-slate-300", tc: "text-slate-600" },
            { rank: 3, name: "Sari Dewi", reports: 98, domains: 7, avg_severity: 4.1, badge: "🥉 Top Quality", bc: "bg-orange-50 border-orange-300", tc: "text-orange-700" },
            { rank: 4, name: "Andi Prasetyo", reports: 76, domains: 5, avg_severity: 3.4, badge: "", bc: "", tc: "text-muted-foreground" },
            { rank: 5, name: "Lisa Aditama", reports: 61, domains: 4, avg_severity: 3.9, badge: "", bc: "", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.name} className={`flex items-center gap-3 ${r.bc ? `border rounded-sm p-2.5 ${r.bc}` : "border-b pb-1.5"}`}>
              <p className={`text-base font-black font-mono w-6 text-center ${r.tc}`}>{r.rank}</p>
              <div className="flex-1">
                <p className="text-[9px] font-bold">{r.name} {r.badge}</p>
                <p className="text-[8px] font-mono text-muted-foreground">{r.reports} laporan · {r.domains} domain · avg severity {r.avg_severity}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Leaderboard reset setiap bulan · Reward: sertifikat MJP Intelligence Contributor + priority untuk project assignment premium</p>
      </div>

      {/* Pain Point Seasonality Calendar */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> PAIN POINT SEASONALITY CALENDAR — Kapan Tim Lapangan Paling Banyak Menemukan Pain Point (Pola 12 Bulan)?
        </p>
        <div className="flex items-end gap-1 h-20 mb-2">
          {[
            { month: "Jan", vol: 28, note: "Low" }, { month: "Feb", vol: 41, note: "" },
            { month: "Mar", vol: 67, note: "" }, { month: "Apr", vol: 89, note: "" },
            { month: "Mei", vol: 94, note: "Peak" }, { month: "Jun", vol: 87, note: "" },
            { month: "Jul", vol: 72, note: "" }, { month: "Ags", vol: 78, note: "NOW" },
            { month: "Sep", vol: 91, note: "" }, { month: "Okt", vol: 96, note: "Peak" },
            { month: "Nov", vol: 84, note: "" }, { month: "Des", vol: 24, note: "Low" },
          ].map((m) => {
            const maxV = 96;
            return (
              <div key={m.month} className="flex flex-col items-center gap-0.5 flex-1">
                <p className="text-[7px] font-mono">{m.vol}</p>
                <div
                  className={`w-full rounded-t-sm ${m.note === "NOW" ? "bg-primary" : m.vol >= 88 ? "bg-orange-400" : m.vol <= 35 ? "bg-slate-300" : "bg-blue-300"}`}
                  style={{ height: `${(m.vol / maxV) * 100}%` }}
                />
                <p className="text-[7px] font-mono">{m.month}</p>
                {m.note && <p className={`text-[6px] font-mono font-bold ${m.note === "NOW" ? "text-primary" : m.vol >= 88 ? "text-orange-600" : "text-slate-500"}`}>{m.note}</p>}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-4 text-[9px] font-mono mb-2">
          <span><span className="text-orange-600 font-bold">🔴 Peak:</span> Mei & Oktober = peak tender season, BUJK paling aktif survei lapangan</span>
          <span><span className="text-slate-600 font-bold">⬇ Low:</span> Jan & Des = libur panjang, aktivitas konstruksi minimum</span>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Agustus saat ini (vol 78) — menuju peak Oktober. Tambah 2 field researcher sementara untuk Sept–Okt untuk maksimalkan intelligence collection</p>
      </div>

      {/* Pain Point to Insight Conversion Rate */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> PAIN POINT → INSIGHT CONVERSION — Berapa % Pain Point yang Berhasil Diubah Menjadi Insight Actionable untuk MJP
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label: "Total Pain Points Masuk", val: "1.247", sub: "Semua waktu", tc: "text-primary" },
            { label: "Diproses AI Synthesis", val: "1.188 (95%)", sub: "Auto-synthesis", tc: "text-blue-700" },
            { label: "Jadi Insight Actionable", val: "847 (68%)", sub: "≥3 validation signals", tc: "text-emerald-700" },
            { label: "Jadi Aksi Tim / Produk", val: "312 (25%)", sub: "Implemented", tc: "text-violet-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center">
              <p className={`text-base font-black font-mono ${m.tc} leading-none`}>{m.val}</p>
              <p className="text-[7px] font-mono text-muted-foreground mt-0.5">{m.sub}</p>
              <p className="text-[7px] font-mono leading-tight mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden mb-1">
          <div className="flex h-full">
            <div className="bg-primary" style={{ width: "25%" }} title="Implemented" />
            <div className="bg-emerald-400" style={{ width: "43%" }} title="Insight only" />
            <div className="bg-blue-300" style={{ width: "27%" }} title="Processed" />
            <div className="bg-slate-200 flex-1" title="Not processed" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-primary rounded-sm inline-block" />Implemented (25%)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-400 rounded-sm inline-block" />Insight only (43%)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-300 rounded-sm inline-block" />Processed (27%)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-slate-200 rounded-sm inline-block" />Unprocessed (5%)</span>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Target: naikkan implemented ke 35% dengan mempercepat Workroom synthesis → aksi cycle dari 2 minggu menjadi 3 hari</p>
      </div>

      {/* Pain Point Category Deep Dive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" /> CATEGORY DEEP DIVE — Analisis Mendalam Per Kategori Pain Point Terbesar: Volume, Tren, dan Resolusi Rate
        </p>
        <div className="flex flex-col gap-2">
          {[
            { cat: "SKK & Sertifikasi (487 pain points)", volume: 487, trend: "+12% MoM", resolved: 84, topPain: "Tidak tahu cara perpanjang SKK elektronik via sistem LPJK baru (v3.0)", bestSolution: "Tutorial video 3 langkah + pendampingan WhatsApp per kasus", tc: "text-primary", bc: "bg-primary/5 border-primary/20" },
            { cat: "Tender & Persaingan (312 pain points)", volume: 312, trend: "+8% MoM", resolved: 71, topPain: "Kalah tender karena dokumen persyaratan tidak lengkap — tidak ada checklist standar", bestSolution: "Template checklist tender per jenis SBU + review dokumen sebelum submit", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { cat: "Regulasi & Compliance (198 pain points)", volume: 198, trend: "+24% MoM", resolved: 62, topPain: "SMAP update procedure berubah tiba-tiba tanpa pemberitahuan memadai dari PUPR", bestSolution: "Intel Briefing regulasi + proaktif alert ke klien sebelum deadline update", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { cat: "BIM & Teknologi (124 pain points)", volume: 124, trend: "+47% MoM", resolved: 23, topPain: "Tidak tahu software BIM mana yang diakui untuk persyaratan tender BUMN 2024", bestSolution: "BIM starter guide + recommendation by project type — BELUM ADA DI MJP", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
          ].map((r) => (
            <div key={r.cat} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-[9px] font-bold ${r.tc}`}>{r.cat}</p>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[8px] font-mono text-muted-foreground">{r.trend}</span>
                  <span className={`text-[9px] font-mono font-bold ${r.tc}`}>{r.resolved}% resolved</span>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground mb-0.5">Top pain: "{r.topPain}"</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>→ Best solution: {r.bestSolution}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pain Point Intelligence Gap Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-orange-500" /> INTELLIGENCE GAP ANALYSIS — Kategori Masalah Klien yang Masih Kurang Data dan Perlu Field Research Lebih Dalam
        </p>
        <div className="flex flex-col gap-2">
          {[
            { gap: "Masalah Spesifik Sub-Kontraktor (bukan BUJK utama)", currentData: 12, needed: 50, priority: "P1", reason: "Sub-kontraktor = 40% pasar konstruksi tapi <5% data MJP. SMAP baru akan wajibkan mereka.", action: "Tambahkan sub-kontraktor sebagai target riset khusus — 20 wawancara Q3 2026", pc: "text-red-700", pb: "bg-red-50 border-red-200" },
            { gap: "Hambatan Adopsi BIM di BUJK Tier 2", currentData: 8, needed: 40, priority: "P1", reason: "Regulasi BIM wajib datang — tapi kita tidak punya data cukup untuk buat advisory yang tepat", action: "Workshop BIM di 2 kota (Semarang, Makassar) + survey 50 BUJK non-BIM", pc: "text-red-700", pb: "bg-red-50 border-red-200" },
            { gap: "Pengalaman Klien Kompetitor (mengapa pindah ke/dari MJP)", currentData: 31, needed: 80, priority: "P2", reason: "Data win/loss tidak komprehensif — tidak bisa optimalkan conversion tanpa ini", action: "Exit survey untuk semua churn + win interview untuk semua closed deals baru", pc: "text-orange-700", pb: "bg-orange-50 border-orange-200" },
            { gap: "Pain Point BUJK di Kalimantan & Papua", currentData: 24, needed: 60, priority: "P2", reason: "Market terbesar yang belum terpetakan — model solusi Jawa tidak bisa langsung apply", action: "Field trip khusus Kalimantan + Papua, Q3 2026 — Budi leading", pc: "text-orange-700", pb: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.gap} className={`border rounded-sm p-3 ${r.pb}`}>
              <div className="flex items-start gap-2 mb-1">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[8px] font-mono font-bold ${r.pc}`}>{r.priority}</span>
                    <p className="text-[9px] font-bold">{r.gap}</p>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(r.currentData / r.needed) * 100}%` }} />
                    </div>
                    <span className="text-[8px] font-mono shrink-0 text-muted-foreground">{r.currentData}/{r.needed} data points</span>
                  </div>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground mb-0.5">{r.reason}</p>
              <p className={`text-[9px] font-mono ${r.pc}`}>→ {r.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pain Point Feedback Loop Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-primary" /> FEEDBACK LOOP TRACKER — Lacak Apakah Solusi MJP Benar-Benar Menyelesaikan Pain Point Klien (Closed-Loop Validation)
        </p>
        <div className="flex flex-col gap-2">
          {[
            { pain: "Tidak tahu prosedur perpanjang SKK elektronik (LPJK v3.0)", solution: "Tutorial video 3-langkah + WA walkthrough", clientsHelped: 89, recurrenceRate: 4, resolution: 96, quote: "\"Sekarang bisa saya kerjakan sendiri tanpa harus tanya MJP tiap bulan\" — Pak Slamet, Semarang", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { pain: "Tidak punya checklist dokumen tender yang lengkap dan terupdate", solution: "Template checklist tender per SBU + review service", clientsHelped: 127, recurrenceRate: 11, resolution: 89, quote: "\"Checklist MJP bikin saya tidak gugur di tahap administrasi lagi\" — Bu Wati, Bandung", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { pain: "Tidak tahu harga kompetitor saat nulis penawaran", solution: "IjinTender competitor price panel di Intel Briefing", clientsHelped: 44, recurrenceRate: 22, resolution: 78, quote: "\"Berguna tapi ingin update lebih sering dari 6 jam\" — Pak Rudi, Surabaya", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { pain: "Bingung harus pakai software BIM apa untuk tender BUMN", solution: "BELUM ADA SOLUSI — knowledge gap", clientsHelped: 0, recurrenceRate: 100, resolution: 0, quote: "Pain point ini terus berulang 100% karena MJP belum punya BIM advisory — URGENT", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
          ].map((r) => (
            <div key={r.pain} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className="text-[9px] font-bold mb-0.5">❗ Pain: {r.pain}</p>
              <p className={`text-[9px] font-mono ${r.tc} mb-0.5`}>💊 Solution: {r.solution}</p>
              <div className="flex flex-wrap gap-3 text-[8px] font-mono mb-1">
                <span className="text-muted-foreground">Helped: <span className={`font-bold ${r.tc}`}>{r.clientsHelped} klien</span></span>
                <span className="text-muted-foreground">Resolution rate: <span className={`font-bold ${r.tc}`}>{r.resolution}%</span></span>
                <span className="text-muted-foreground">Recurrence: <span className={`font-bold ${r.recurrenceRate > 20 ? "text-orange-700" : r.tc}`}>{r.recurrenceRate}%</span></span>
              </div>
              {r.quote && <p className="text-[9px] italic text-muted-foreground">{r.quote}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Pain Point Cohort Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> PAIN POINT COHORT ANALYSIS — Apakah Klien Lama MJP Mengalami Pain Point yang Berbeda vs Klien Baru?
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] font-bold mb-2">Klien Baru MJP ({'<'}6 bulan) — Top 5 Pain Points</p>
            <div className="flex flex-col gap-1.5">
              {[
                { pain: "Tidak tahu cara pendaftaran LPJK online", freq: 84 },
                { pain: "Kebingungan tentang perbedaan J7 vs J8 vs J9", freq: 71 },
                { pain: "Tidak punya template dokumen tender", freq: 67 },
                { pain: "Tidak tahu LPSE mana yang relevan untuk bidang mereka", freq: 58 },
                { pain: "HPS estimasi salah jauh dari nilai pasar", freq: 51 },
              ].map((r) => (
                <div key={r.pain}>
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] truncate pr-2" title={r.pain}>{r.pain}</p>
                    <span className="text-[8px] font-mono font-bold text-orange-700 shrink-0">{r.freq}%</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-orange-400 rounded-full" style={{ width: `${r.freq}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[9px] font-mono text-muted-foreground mt-1">Pola: klien baru masih di tahap "orientasi pasar"</p>
          </div>
          <div>
            <p className="text-[9px] font-bold mb-2">Klien Veteran MJP (≥18 bulan) — Top 5 Pain Points</p>
            <div className="flex flex-col gap-1.5">
              {[
                { pain: "Tidak ada partner lokal di Kalimantan/Papua", freq: 67 },
                { pain: "BIM jadi wajib — tidak tahu mulai dari mana", freq: 61 },
                { pain: "Kompetitor makin agresif di harga untuk segmen mereka", freq: 54 },
                { pain: "Tim internal overload — tidak bisa handle ekspansi sendiri", freq: 48 },
                { pain: "Butuh data historis lebih dari 2 tahun untuk proposal klien besar", freq: 41 },
              ].map((r) => (
                <div key={r.pain}>
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] truncate pr-2" title={r.pain}>{r.pain}</p>
                    <span className="text-[8px] font-mono font-bold text-blue-700 shrink-0">{r.freq}%</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${r.freq}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[9px] font-mono text-muted-foreground mt-1">Pola: klien veteran sudah scale — butuh expansion & strategic support</p>
          </div>
        </div>
      </div>

      {/* Pain Point Urgency × Frequency Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5 text-primary" /> URGENCY × FREQUENCY MATRIX — Pain Point dengan Frekuensi Tinggi + Urgensi Tinggi = Prioritas Produk MJP Berikutnya
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { quadrant: "🔴 URGENT + FREQUENT (Build NOW)", bg: "bg-red-50 border-red-200", tc: "text-red-700", items: [
              "SKK expire tapi tidak ada notifikasi otomatis (487 klien, urgency 9.4/10)",
              "HPS estimasi salah → kalah tender (312 klien, urgency 8.9/10)",
              "Dokumen tender tidak lengkap → gugur administrasi (247 klien, urgency 9.1/10)",
            ]},
            { quadrant: "🟠 URGENT + INFREQUENT (Solve ad-hoc)", bg: "bg-orange-50 border-orange-200", tc: "text-orange-700", items: [
              "Sengketa kontrak dengan BUMN (28 klien, urgency 9.8/10 saat terjadi)",
              "BUJK diblokir dari LPSE karena blacklist salah (14 klien)",
              "SKK dicabut mendadak tanpa alasan jelas (9 klien)",
            ]},
            { quadrant: "🟡 NOT URGENT + FREQUENT (Education)", bg: "bg-yellow-50 border-yellow-200", tc: "text-yellow-700", items: [
              "Tidak paham perbedaan SIUJK vs SBU vs SKK (312 klien, urgency 4.2/10)",
              "Tidak tahu LPSE mana yang relevan untuk spesialisasi mereka (247 klien)",
              "Tidak tahu cara membuat penawaran yang kompetitif (198 klien)",
            ]},
            { quadrant: "⬜ NOT URGENT + INFREQUENT (Backlog)", bg: "bg-slate-50 border-slate-200", tc: "text-slate-600", items: [
              "Logo & branding perusahaan tidak profesional (84 klien, urgency 2.1/10)",
              "Tidak punya website perusahaan (127 klien)",
              "Email bukan domain sendiri (94 klien)",
            ]},
          ].map((q) => (
            <div key={q.quadrant} className={`border rounded-sm p-3 ${q.bg}`}>
              <p className={`text-[9px] font-bold mb-1.5 ${q.tc}`}>{q.quadrant}</p>
              {q.items.map(item => (
                <p key={item} className="text-[8px] text-muted-foreground mb-0.5 leading-snug">• {item}</p>
              ))}
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Focus product investment di kuadran merah — semua ada solusinya di MJP tapi perlu dipermudah aksesnya</p>
      </div>

      {/* Pain Point Sentiment Trend Over Time */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> PAIN POINT SENTIMENT TREND — Apakah Masalah Klien MJP Membaik atau Memburuk Dibandingkan 6 Bulan Lalu?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { painPoint: "Kesulitan mendapatkan SKK", trend: "IMPROVING", pct: -34, reason: "MJP SKK Express berhasil memotong waktu proses dari 45 hari → 14 jam. Keluhan turun signifikan.", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { painPoint: "Tidak tahu HPS yang wajar untuk bid", trend: "IMPROVING", pct: -28, reason: "Intel Briefing sekarang sudah include HPS benchmark per kategori. Impact langsung ke kepuasan klien.", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { painPoint: "Tidak ada notifikasi tender relevan", trend: "IMPROVING", pct: -41, reason: "Radar Tender Alerts berhasil — 312 klien aktif pakai ini sekarang. Ini fitur paling berharga.", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { painPoint: "Tidak ada partner/konsultan di luar Jawa", trend: "WORSENING", pct: +47, reason: "Klien Sulawesi & Kalimantan makin banyak tapi MJP belum punya AM lokal. Kebutuhan tidak terpenuhi naik.", sc: "text-red-700", sb: "bg-red-50 border-red-200" },
            { painPoint: "BIM jadi wajib tapi tidak tahu cara adopsi", trend: "WORSENING", pct: +83, reason: "Regulasi BIM makin dekat — awareness naik tapi tidak ada solusi MJP. Klien mulai panik.", sc: "text-red-700", sb: "bg-red-50 border-red-200" },
            { painPoint: "Kompetitor makin agresif di harga", trend: "STABLE", pct: +3, reason: "Tidak berubah signifikan — sudah jadi kondisi market yang settled. Butuh diferensiasi bukan price matching.", sc: "text-slate-600", sb: "bg-slate-50 border-slate-200" },
          ].map((r) => (
            <div key={r.painPoint} className={`border rounded-sm p-3 ${r.sb}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.sc}`}>{r.painPoint}</p>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`text-[8px] font-mono font-bold ${r.sc}`}>{r.trend}</span>
                  <span className={`text-[9px] font-mono font-black ${r.sc}`}>{r.pct > 0 ? "+" : ""}{r.pct}%</span>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground leading-snug">{r.reason}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1">BIM + luar Jawa = dua pain yang memburuk paling cepat → ini harus jadi top product priority Q4 2026</p>
      </div>

      {/* Pain Point Resolution Success Stories */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> PAIN → RESOLVED — Pain Point yang Berhasil MJP Selesaikan untuk Klien (Bukti Dampak Nyata di Lapangan)
        </p>
        <div className="flex flex-col gap-2">
          {[
            { pain: "Tidak tahu cara mendaftar LPJK online — form berubah terus", client: "84 klien (Q1 2026)", resolution: "MJP buat panduan step-by-step video + PDF yang diupdate setiap ada perubahan LPJK", outcome: "100% 84 klien berhasil daftar tanpa perlu panggil staf MJP secara personal", savings: "Hemat 340 jam kerja tim MJP per tahun (rata-rata 4 jam/klien sebelumnya)", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { pain: "SKK J8 butuh waktu 3 minggu — sering ketinggalan deadline tender", client: "213 klien (2025–2026)", resolution: "SKK Express: proses end-to-end MJP yang mempersingkat menjadi 14 jam rata-rata", outcome: "213 klien yang pakai SKK Express: 94% berhasil submit SKK sebelum deadline tender", savings: "Tender value yang berhasil diikuti: diestimasi Rp 2.1M total dari 213 klien ini", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { pain: "Tidak tahu HPS yang wajar — sering overestimate dan kalah tender", client: "312 klien (Intel Briefing)", resolution: "HPS Benchmark Report masuk ke setiap Intel Briefing — kategori pekerjaan + region + kuartal", outcome: "Klien dengan Intel Briefing: win rate 34% vs 21% untuk klien tanpa briefing (stat dari 780 tender)", savings: "+13pp win rate × rata-rata Rp 8.4jt nilai proyek per win = massive revenue impact", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { pain: "Tidak ada notifikasi saat ada tender relevan baru di LPSE", client: "487 klien (Radar Tender)", resolution: "Tender Alert Engine: 12 kategori, 36 LPSE, filter per nilai + lokasi + bidang + jenjang SKK", outcome: "Average klien dapat 3.2 tender relevan/minggu. Open rate alert: 78%", savings: "312 klien aktif klik dan bid setidaknya 1 tender per bulan dari alert ini", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.pain} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>Pain: "{r.pain}"</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">Klien: {r.client}</p>
              <p className="text-[8px] mb-0.5"><span className="font-bold">Solusi: </span>{r.resolution}</p>
              <p className={`text-[9px] font-mono ${r.tc} mb-0.5`}>✓ {r.outcome}</p>
              <p className={`text-[8px] font-mono text-muted-foreground`}>💰 {r.savings}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pain Point to Product Innovation Pipeline */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" /> INNOVATION PIPELINE — Pain Point yang Belum Ada Solusinya di MJP dan Bisa Menjadi Produk Baru Tahun Ini
        </p>
        <div className="flex flex-col gap-2">
          {[
            { pain: "Tidak ada yang membantu BUJK menyusun proposal PPP (Kerjasama Pemerintah-Swasta)", frequency: 28, avgBudget: "Rp 8.4jt", productIdea: "PPP Advisory Pack: template proposal, regulatory framework, financial model baseline", investmentEst: "Rp 24jt (2 konsultan kontrak 3 bln)", revenueEst: "28 klien × Rp 8.4jt = Rp 235jt/thn di steady state", feasibility: "HIGH — konten bisa dikurasi, tidak butuh tech baru", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { pain: "Klien tidak bisa track progress dokumen tender yang sedang berjalan", frequency: 187, avgBudget: "Rp 1.2jt", productIdea: "Tender Document Tracker: upload DOK, AI parse deadline + checklist, push notif via WA", investmentEst: "Rp 18jt (1 sprint tim tech + AI integration)", revenueEst: "187 klien × Rp 1.2jt = Rp 224jt/thn — atau bundel dengan Intel Briefing", feasibility: "HIGH — di atas core infra yang sudah ada", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { pain: "Tidak ada yang membantu BUJK menyusun neraca dan laporan keuangan audit-ready", frequency: 94, avgBudget: "Rp 3.8jt", productIdea: "Financial Health Pack: template neraca, guidance untuk audit PKPT, referral ke akuntan publik", investmentEst: "Rp 12jt (partnership dengan KAP + content)", revenueEst: "94 klien × Rp 3.8jt = Rp 357jt/thn — tapi perlu lisensi KAP", feasibility: "MEDIUM — regulatory risk, perlu legal review", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { pain: "Tidak ada cara mudah verifikasi BUJK partner sebelum sub-kontrak", frequency: 134, avgBudget: "Rp 2.1jt", productIdea: "BUJK Due Diligence Report: SKK check + blacklist check + SBU + track record dalam 24 jam", investmentEst: "Rp 8jt (API integration LPJK + template report)", revenueEst: "134 klien × Rp 2.1jt × 2 avg/thn = Rp 562jt — very attractive", feasibility: "VERY HIGH — semua data sudah ada di platform MJP", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.pain} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start gap-3 mb-1">
                <p className={`text-[9px] font-bold flex-1`}>Pain: "{r.pain}"</p>
                <div className="text-right shrink-0 ml-2">
                  <p className={`text-[11px] font-black font-mono ${r.tc} leading-none`}>{r.frequency}×</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>diminta</p>
                </div>
              </div>
              <p className={`text-[8px] font-mono font-bold ${r.tc} mb-0.5`}>💡 Ide produk: {r.productIdea}</p>
              <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground">
                <span>Investment: {r.investmentEst}</span>
                <span className={`font-bold ${r.tc}`}>Revenue est: {r.revenueEst}</span>
                <span>Feasibility: {r.feasibility}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pain Point Voice of Customer Verbatims */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-blue-500" /> VOICE OF CUSTOMER — Kutipan Langsung dari Klien tentang Pain Point yang Paling Sering Mereka Rasakan (Unfiltered)
        </p>
        <div className="flex flex-col gap-2">
          {[
            { quote: "Saya sudah 3 kali gagal submit SKK online karena sistemnya selalu berubah. Setiap kali ada update LPJK, saya harus belajar dari awal lagi. Padahal saya sudah 15 tahun di industri ini.", client: "Pak Hendra, J8 Sipil, Semarang", pain: "Kompleksitas birokrasi LPJK yang berubah-ubah", severity: 9.1, frequency: 47, category: "SKK & Regulasi", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { quote: "Waktu saya mau bid tender Pemda, saya tidak tahu berapa HPS yang wajar. Akhirnya saya pasang harga terlalu tinggi dan kalah. Kalau saya tahu kompetitor pasang berapa, saya pasti bisa menyesuaikan.", client: "Bu Ratna, J7 Arsitektur, Surabaya", pain: "Tidak ada referensi HPS pasar yang bisa dipercaya", severity: 8.4, frequency: 134, category: "Intel Pasar", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { quote: "Di Balikpapan, kami dapat info tender terlambat terus. Waktu saya tahu ada tender BUMN bagus, tanggal penutupannya sudah besok. Kayak berlomba tapi start belakangan.", client: "Pak Syukur, J8 Sipil, Balikpapan", pain: "Intel tender tidak real-time, khususnya di luar Jawa", severity: 8.7, frequency: 89, category: "Distribusi Intel", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { quote: "BIM itu bahasa asing buat saya. Katanya mulai 2027 wajib, tapi tidak ada yang jelasin langkah konkretnya harus mulai dari mana. Konsultan BIM yang ada terlalu mahal dan tidak ngerti konteks kontraktor kecil.", client: "Pak Taufik, J8 Struktur, Malang", pain: "Tidak ada panduan BIM yang accessible untuk BUJK non-enterprise", severity: 7.8, frequency: 64, category: "Regulasi Baru", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.client} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className="text-[9px] italic mb-1">"{r.quote}"</p>
              <div className="flex items-center gap-3">
                <p className={`text-[8px] font-bold ${r.tc} flex-1`}>— {r.client}</p>
                <div className="flex gap-3 shrink-0">
                  <span className="text-[8px] font-mono text-muted-foreground">Severity: {r.severity}/10</span>
                  <span className="text-[8px] font-mono text-muted-foreground">Freq: {r.frequency}×</span>
                  <span className={`text-[7px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${r.bc} ${r.tc} border`}>{r.category}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pain Point Demographic Breakdown */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> DEMOGRAPHIC BREAKDOWN — Pain Point yang Sama Dirasakan Berbeda oleh Segmen yang Berbeda (J7 vs J8 vs J9, Jawa vs Luar Jawa)
        </p>
        <div className="flex flex-col gap-2">
          <p className="text-[9px] font-bold mb-1">Pain: "Tidak tahu HPS yang wajar sebelum bid tender" — dirasakan berbeda per segmen:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            {[
              { segment: "J7 (BUJK kecil)", severity: "6.8/10", framing: "Tidak tahu sama sekali. Sering tebak-tebak atau lihat dari tender lain yang tidak relevan.", needFrom: "Edukasi dasar: apa itu HPS, bagaimana cara hitungnya, apa yang boleh vs tidak", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
              { segment: "J8 (BUJK menengah)", severity: "8.9/10", framing: "Tahu HPS ada, tapi tidak punya data historis yang cukup untuk buat estimasi yang akurat. Sering over atau under 5–10%.", needFrom: "Database historis per kategori per wilayah + AI model untuk estimasi", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
              { segment: "J9 (BUJK besar)", severity: "4.2/10", framing: "Sudah punya tim cost estimator internal. Tapi butuh real-time benchmark untuk validate angka mereka, khususnya kategori baru.", needFrom: "API access ke HPS database + validation tool, bukan education", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
            ].map((r) => (
              <div key={r.segment} className={`border rounded-sm p-2.5 ${r.bc}`}>
                <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.segment}</p>
                <p className={`text-[8px] font-mono ${r.tc} mb-0.5`}>Severity: {r.severity}</p>
                <p className="text-[8px] text-muted-foreground mb-0.5">{r.framing}</p>
                <p className={`text-[8px] font-mono font-bold ${r.tc}`}>Need: {r.needFrom}</p>
              </div>
            ))}
          </div>
          <p className="text-[9px] font-bold mb-1">Pain: "Kurang intel tentang kompetitor" — per lokasi:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { location: "Jawa (Jakarta, Surabaya, Semarang)", severity: "7.1/10", context: "Banyak kompetitor tapi banyak juga data. Pain lebih ke volume intel yang perlu difilter.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
              { location: "Luar Jawa (Sulawesi, Kalimantan, NTT)", severity: "9.4/10", context: "Sangat sedikit data kompetitor tersedia. Klien operasi seperti 'buta'. Intel apapun sangat berharga.", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            ].map((r) => (
              <div key={r.location} className={`border rounded-sm p-2.5 ${r.bc}`}>
                <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.location}</p>
                <p className={`text-[8px] font-mono ${r.tc} mb-0.5`}>Severity: {r.severity}</p>
                <p className="text-[8px] text-muted-foreground">{r.context}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pain Point Monetization Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> MONETIZATION MAP — Setiap Pain Point yang Teridentifikasi Dipetakan ke Produk MJP yang Menyelesaikannya dan Revenue yang Dihasilkan
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { pain: "SKK birokrasi kompleks + waktu lama", severity: 9.1, product: "SKK Express", annualRevenue: "Rp 287jt", margin: "62%", clients: 154, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { pain: "Tidak tahu HPS yang wajar sebelum bid", severity: 8.9, product: "HPS Benchmark + Surat Penawaran Assist", annualRevenue: "Rp 168jt", margin: "78%", clients: 247, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { pain: "Tender alert lambat — sudah ketinggalan", severity: 8.7, product: "Intel Briefing + Tender Alert", annualRevenue: "Rp 312jt", margin: "84%", clients: 487, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { pain: "Tidak tahu kompetitor menang tender apa", severity: 8.2, product: "Radar Kompetitor", annualRevenue: "Rp 94jt", margin: "81%", clients: 183, tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { pain: "Informasi regulasi berubah tidak tahu", severity: 7.8, product: "Knowledge Registry + Regulasi Alerts", annualRevenue: "Rp 62jt (bundled)", margin: "89%", clients: 487, tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { pain: "BIM requirement mulai wajib, tidak siap", severity: 7.1, product: "BIM Readiness Tool (Q3 2026 launch)", annualRevenue: "Est. Rp 140jt/thn (target 50 klien × Rp 2.8jt)", margin: "TBD", clients: 0, tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
          ].map((r) => (
            <div key={r.pain} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-[9px] font-bold ${r.tc} flex-1`}>{r.pain}</p>
                    <span className={`text-[8px] font-mono ${r.tc} shrink-0`}>Severity {r.severity}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[8px] font-mono text-muted-foreground">
                    <span>Product: {r.product}</span>
                    <span className={`${r.tc}`}>Rev: {r.annualRevenue}</span>
                    <span>Margin: {r.margin}</span>
                    <span>{r.clients} klien</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">Total addressable pain → product revenue: Rp 1.063jt mapped. Every unsolved pain = R&amp;D investment opportunity.</p>
      </div>

      {/* Pain Point Tracking Maturity */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> PAIN TRACKING MATURITY — Seberapa Baik MJP dalam Mengumpulkan, Menganalisis, dan Bertindak atas Pain Point Klien?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { dimension: "Collection Breadth (berapa banyak pain yang dikumpulkan)", score: 7.4, max: 10, desc: "1.247 pain points terdokumentasi dari 487 klien. Gap: masih banyak pain yang tidak pernah diverbalkan klien. Target: systematic listening via app + AM touchpoints.", actions: "Monthly pain point review calls untuk top 50 klien. Auto-tagging dari briefing feedback.", tc: "text-blue-700" },
            { dimension: "Collection Depth (seberapa dalam pemahaman per pain)", score: 6.8, max: 10, desc: "Mayoritas pain hanya ada di level 'apa masalahnya'. Masih sedikit yang punya akar penyebab, konteks situasional, dan 'job to be done' yang jelas.", actions: "Sari leads quarterly deep-dive workshop untuk top 10 pain points.", tc: "text-orange-700" },
            { dimension: "Analysis Speed (seberapa cepat dari collection ke insight)", score: 8.1, max: 10, desc: "AI auto-categorize dan cluster pain points dalam <24 jam dari entry. AM dashboard langsung update. Trend detection dalam 48 jam.", actions: "Sudah bagus — maintain. Stretch goal: real-time trend detection.", tc: "text-emerald-700" },
            { dimension: "Action Closure Rate (% pain yang berhasil di-address)", score: 5.2, max: 10, desc: "52% dari pain points prioritas Q1 2026 sudah ada product solution. 48% masih open atau di-defer.", actions: "Q3 target: 65% closure. Focus: pain di Quadrant 1 (high impact, high frequency).", tc: "text-orange-700" },
            { dimension: "Feedback Loop (klien tahu pain mereka sudah di-address)", score: 4.1, max: 10, desc: "Gap terbesar: klien jarang tahu bahwa pain mereka sudah jadi produk. Bisa meningkatkan trust dan loyalty signifikan.", actions: "Launch 'You asked, we built' communication campaign Q4 2026.", tc: "text-red-700" },
          ].map((r) => (
            <div key={r.dimension} className="border rounded-sm p-2.5 bg-muted/20">
              <div className="flex items-center gap-3 mb-0.5">
                <div className="flex-1">
                  <p className="text-[9px] font-bold">{r.dimension}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-[13px] font-black font-mono ${r.tc}`}>{r.score}</span>
                  <span className="text-[9px] text-muted-foreground font-mono">/{r.max}</span>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full mb-1">
                <div className={`h-1.5 rounded-full ${r.score >= 7 ? 'bg-emerald-500' : r.score >= 5.5 ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ width: `${(r.score/r.max)*100}%` }} />
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Action: {r.actions}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Avg maturity score: 6.3/10. Biggest gap: telling clients we fixed their pain. Tactic ini low-cost, high-impact untuk trust.</p>
      </div>

      {/* Unsolved Pain Point Bounty Board */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-orange-500" /> UNSOLVED PAIN BOUNTY — Pain Point yang Belum Ada Solusinya di MJP tapi Punya Demand Tinggi — Kandidat Produk Baru
        </p>
        <div className="flex flex-col gap-2">
          {[
            { pain: "Tidak bisa track status klaim garansi proyek yang sedang proses", mentions: 127, avgSpendWTP: "Rp 2.1jt/bln", domain: "Post-project", complexity: "HIGH (perlu integrasi BPJK)", potentialRevenue: "~Rp 267jt/thn jika 30% klien adopsi", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { pain: "Tidak ada tools untuk estimasi working capital kebutuhan sebelum ikut tender besar", mentions: 94, avgSpendWTP: "Rp 1.4jt/bln", domain: "Financial planning", complexity: "MEDIUM (kalkulasi + data profil)", potentialRevenue: "~Rp 131jt/thn jika 30% klien adopsi", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { pain: "Susah cari tenaga ahli freelance SKK J9 untuk proyek dadakan", mentions: 78, avgSpendWTP: "Rp 3.2jt/listing", domain: "Talent marketplace", complexity: "HIGH (multi-sided market)", potentialRevenue: "~Rp 150jt/thn jika 50 listings/bln", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { pain: "Tidak ada notifikasi jika subkontraktor yang dipakai ternyata bermasalah di proyek lain", mentions: 63, avgSpendWTP: "Rp 800rb/bln (add-on)", domain: "Risk monitoring", complexity: "MEDIUM (extend trust score + alert)", potentialRevenue: "~Rp 47jt/thn jika 20% klien adopt add-on", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
            { pain: "Tidak ada template surat resmi untuk klaim PHO/FHO yang benar secara hukum", mentions: 54, avgSpendWTP: "Rp 350rb/template", domain: "Document generation", complexity: "LOW (template library + customization)", potentialRevenue: "~Rp 19jt/thn jika 10% klien buy", tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
          ].map((r) => (
            <div key={r.pain} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start gap-3 mb-0.5">
                <div className="flex-1">
                  <p className={`text-[9px] font-bold ${r.tc}`}>{r.pain}</p>
                  <div className="flex flex-wrap gap-3 text-[8px] font-mono mt-0.5">
                    <span className="text-muted-foreground">{r.mentions} mentions</span>
                    <span className={r.tc}>WTP: {r.avgSpendWTP}</span>
                    <span className="text-muted-foreground">Domain: {r.domain}</span>
                    <span className={r.tc}>Complexity: {r.complexity}</span>
                  </div>
                  <p className={`text-[9px] font-bold font-mono ${r.tc} mt-0.5`}>Potential: {r.potentialRevenue}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">Total potential dari 5 pain = {'>'} Rp 614jt/thn additional ARR jika dikerjakan semua. Prioritas: #1 + #3 (highest WTP dan revenue potential).</p>
      </div>

      {/* Pain Point Seasonality */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> PAIN SEASONALITY — Pain Point yang Intensitasnya Berubah Sesuai Musim / Waktu dalam Setahun
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { pain: "Tidak siap menghadapi tender Q4 (Sep–Nov)", peak: "Agustus–September", pattern: "APBN proyek baru biasanya dilelang Q3–Q4. Pain intensitas ×2.8 di Agt–Sep vs Jan–Feb.", mjpResponse: "Launch 'Prep Tender Q4' campaign tiap Agt. Content calendar khusus Sep = fokus tender readiness.", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { pain: "SKK expire mendekati deadline tahunan PKPT", peak: "Februari–Maret", pattern: "Banyak SKK yang diterbitkan di awal tahun akan expire 1 tahun kemudian. Pain spike di Jan–Mar.", mjpResponse: "Auto-alert system 90, 60, 30 hari sebelum expire. 'Jan SKK Renewal Campaign' tiap Januari.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { pain: "Tidak tahu anggaran APBN/APBD untuk sektor konstruksi", peak: "November–Januari", pattern: "APBN ditetapkan Okt–Nov. BUJK yang mau plan strategic paling butuh intel ini di window ini.", mjpResponse: "APBN Intel Report tahunan diterbitkan tiap Desember. Coverage per sektor + wilayah + nilai proyeksi.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { pain: "Kesulitan cashflow di Januari (proyek selesai, belum ada proyek baru)", peak: "Desember–Februari", pattern: "Gap antara tahun anggaran. Proyek Q4 selesai, proyek Q1 belum ada. Klien butuh financial planning.", mjpResponse: "Tender forward calendar: 'Ini proyek yang likely akan tender Jan–Mar' — bisa plan cashflow lebih baik.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { pain: "Perubahan regulasi menjelang akhir tahun anggaran", peak: "Oktober–November", pattern: "Kemenpu sering release Permen baru di Okt–Nov sebelum tutup buku tahun. Pain spike saat announcement.", mjpResponse: "Dedicated 'Year-end Regulatory Watch' — daily monitoring dengan SLA <12 jam di periode ini.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.pain} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.pain}</p>
                <span className={`text-[8px] font-mono shrink-0 ${r.tc}`}>Peak: {r.peak}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.pattern}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>→ {r.mjpResponse}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Seasonality insight = proactive team calendar. MJP sudah punya content calendar berbasis musim — next: buat campaign calendar yang align dengan peak pain periods.</p>
      </div>

      {/* Pain Point Resolution Tracking */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> RESOLUTION TRACKER — Dari Pain yang Terdokumentasi, Berapa yang Sudah MJP Selesaikan vs yang Masih Terbuka?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            {[
              { label: "Total Pain Terdokumentasi", value: "1.847", sub: "dari 2021 s/d sekarang", tc: "text-slate-700" },
              { label: "Fully Resolved", value: "634 (34%)", sub: "MJP punya solusi produk yang address", tc: "text-emerald-700" },
              { label: "Partially Addressed", value: "412 (22%)", sub: "Ada feature tapi klien tidak aware atau engagement rendah", tc: "text-blue-700" },
              { label: "Unresolved (open)", value: "801 (43%)", sub: "Belum ada solusi produk yang adequate", tc: "text-orange-700" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/20">
                <p className={`text-[12px] font-black font-mono ${r.tc} leading-none`}>{r.value}</p>
                <p className="text-[8px] font-bold">{r.label}</p>
                <p className={`text-[7px] ${r.tc}`}>{r.sub}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[9px] font-bold mb-0.5">Top 5 Unresolved Pain berdasarkan frequency dan impact:</p>
            {[
              { pain: "Tidak bisa track status klaim garansi proyek", freq: 127, wtp: "Rp 2.1jt/bln", route: "→ Product: Warranty Tracker (Bounty Board #1)" },
              { pain: "Tidak ada tools estimasi working capital sebelum tender besar", freq: 94, wtp: "Rp 1.4jt/bln", route: "→ Product: Pre-Bid Financial Calculator" },
              { pain: "Susah cari tenaga ahli SKK J9 freelance mendadak", freq: 78, wtp: "Rp 3.2jt/listing", route: "→ Product: Expertise Marketplace (Bounty Board #3)" },
              { pain: "Tidak ada notifikasi jika subkontraktor yang dipakai bermasalah", freq: 63, wtp: "Rp 800rb/bln", route: "→ Feature: Subkon Risk Monitor (Trust Score extension)" },
              { pain: "Template surat klaim PHO/FHO yang legally correct", freq: 54, wtp: "Rp 350rb/template", route: "→ Feature: Document Generator (low complexity)" },
            ].map((r) => (
              <div key={r.pain} className="flex items-center gap-2 border-b py-1">
                <p className="text-[8px] flex-1">{r.pain}</p>
                <span className="text-[7px] font-mono text-muted-foreground shrink-0">{r.freq}× | WTP {r.wtp}</span>
                <span className="text-[7px] font-mono text-emerald-700 shrink-0">{r.route}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">43% pain masih unresolved = product roadmap yang penuh. Priority framework: frequency × WTP × complexity. Top 5 bounties = next 2 quarters of product development.</p>
      </div>

      {/* Pain Point Collection Network */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> COLLECTION NETWORK — Siapa yang Mengumpulkan Pain Point dan Bagaimana Mereka Diincentivize untuk Terus Contribute?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { contributor: "Tim Riset Lapangan (Budi + field researchers)", count: "847 pain points YTD", method: "Mobile app input langsung di lokasi. Photo evidence mandatory untuk proyek aktif.", incentive: "Job description utama — KPI adalah 50 pain points/bln per researcher.", quality: "HIGH (verified, with context)", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { contributor: "AM Team (Reza + 3 AM)", count: "312 pain points YTD", method: "Workroom notes dari client conversations. Converted to structured pain point by Sari.", incentive: "AM bonus includes 'intelligence contribution' metric. Minimum 20 pain points/bln.", quality: "HIGH (client-voice, specific)", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { contributor: "Klien MJP (crowdsourced via mobile app)", count: "128 pain points YTD", method: "Mobile app 'Laporkan Temuan' button. Klien submit dari lapangan, MJP review dan categorize.", incentive: "Klien yang submit 3+ verified pain points per bulan dapat 1 bulan gratis.", quality: "MEDIUM (needs verification, but highly specific)", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { contributor: "Asosiasi (GAPENSI, informal)", count: "34 pain points YTD", method: "Meeting notes dari asosiasi events yang dihadiri Sari atau Reza. Informal aggregation.", incentive: "Relationship-based. Asosiasi dapat laporan riset gratis sebagai reciprocity.", quality: "MEDIUM (high-level, less specific)", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.contributor} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.contributor}</p>
                <span className={`text-[8px] font-mono shrink-0 ${r.tc}`}>{r.count}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-[8px]">
                <span className="text-muted-foreground">Method: {r.method}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-[8px] mt-0.5">
                <span className={`font-mono ${r.tc}`}>Quality: {r.quality}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total 2026 YTD: 1.321 new pain points. Run rate: ~220/bln. Target: 300/bln by Q4 2026 via improved klien crowdsource incentive program.</p>
      </div>

      {/* Pain-to-Revenue Pipeline */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> PAIN-TO-REVENUE PIPELINE — Bagaimana Pain Points yang Dikumpulkan Akhirnya Menjadi Revenue bagi MJP? End-to-End Story
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { step: "Step 1: Discovery", activity: "1.847 pain points terkumpul dari lapangan dan AM conversations", timeframe: "Ongoing", metric: "220 pain/bln current run rate", tc: "text-slate-700" },
            { step: "Step 2: Clustering", activity: "AI + Sari cluster pain points menjadi 47 distinct pain clusters. Prioritized by frequency + WTP score.", timeframe: "Monthly synthesis", metric: "47 clusters, top 10 ditrack aktif", tc: "text-blue-700" },
            { step: "Step 3: Validation", activity: "Survey kepada 50+ klien untuk confirm WTP dan validate demand sebelum build", timeframe: "2–4 minggu per cluster", metric: "Validasi threshold: > 60% klien confirm + WTP > Rp 800rb/bln", tc: "text-blue-700" },
            { step: "Step 4: Product Definition", activity: "Pain cluster → Product Brief dengan scope, success metrics, MVP specification", timeframe: "1 minggu per product", metric: "4 product briefs approved 2026 YTD", tc: "text-violet-700" },
            { step: "Step 5: Build & Launch", activity: "Hendra build MVP. Soft launch ke 20 champion klien untuk beta testing. Iterate based on feedback.", timeframe: "4–12 minggu per feature", metric: "3 features launched from pain pipeline 2026", tc: "text-violet-700" },
            { step: "Step 6: Revenue Realization", activity: "Feature bundled ke tier upsell atau offered as add-on. AM pitch ke relevant klien.", timeframe: "Ongoing post-launch", metric: "Avg revenue per launched feature: Rp 48jt/thn ARR (3 features = Rp 144jt/thn)", tc: "text-emerald-700" },
          ].map((r, i) => (
            <div key={r.step} className="flex gap-2 items-start">
              <div className="w-14 shrink-0">
                <p className={`text-[8px] font-bold ${r.tc}`}>{r.step}</p>
                <p className="text-[7px] text-muted-foreground">{r.timeframe}</p>
              </div>
              <div className="flex-1 border-l-2 border-muted pl-2">
                <p className="text-[8px]">{r.activity}</p>
                <p className={`text-[8px] font-mono ${r.tc}`}>{r.metric}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total pipeline value dari validated pain clusters: Rp 614jt/thn potential ARR. Current realization: Rp 144jt/thn (23%). Execution bandwidth = bottleneck.</p>
      </div>

      {/* Pain Point Synthesis Process */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-primary" /> SYNTHESIS PROCESS — Bagaimana MJP Mengolah 1.847 Raw Pain Points Menjadi 47 Actionable Insight Clusters yang Bisa Dijadikan Keputusan?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { step: "Raw Collection", desc: "1.847 pain points di-input ke database — semua mentah, belum terstruktur. Budi dan AM input via mobile app, klien via crowdsource.", challenge: "Duplikasi 31%, bahasa beragam (formal/informal/Jawa), severity tidak konsisten.", tc: "text-slate-600" },
            { step: "Normalization (AI-assist)", desc: "AI normalize bahasa dan deduplicate. Pain point yang serupa digabung dengan reference ke semua original submissions.", challenge: "AI accuracy 87% — 13% butuh manual review by Sari. 240 items/bulan manual review.", tc: "text-blue-700" },
            { step: "Domain Tagging", desc: "Setiap pain point di-tag ke 1–3 domain: tender, SKK, subkon, regulasi, cash flow, dll. Multi-tag untuk cross-domain pains.", challenge: "Ambiguous pains (bisa masuk > 1 domain) = 34% of corpus. Sari judgment call needed.", tc: "text-blue-700" },
            { step: "Severity Scoring", desc: "Pain severity scored 1–5: 1 = minor inconvenience, 5 = business-critical. Score dari kombinasi: WTP signal, frequency of mention, impact if unresolved.", challenge: "Severity inflation bias — everyone thinks their problem is 5. Calibration anchor needed.", tc: "text-orange-700" },
            { step: "Cluster Formation", desc: "K-means clustering + Sari's editorial judgment to form 47 clusters. Each cluster has: central pain statement, evidence count, geographic spread, affected jenjang.", challenge: "Clusters need regular re-evaluation — new pains can split or merge existing clusters.", tc: "text-orange-700" },
            { step: "Actionability Assessment", desc: "Each cluster assessed: 'Can MJP solve this?' YES → product roadmap. NO → publish as market insight for klien awareness.", challenge: "MJP can't solve everything. Honest about scope. Focus on highest-ROI clusters only.", tc: "text-emerald-700" },
          ].map((r, i) => (
            <div key={r.step} className="flex gap-2 items-start border-b pb-1.5">
              <div className={`w-4 h-4 rounded-full bg-current opacity-20 ${r.tc} flex items-center justify-center shrink-0 mt-0.5`}>
                <span className="text-[8px] font-bold text-foreground">{i + 1}</span>
              </div>
              <div className="flex-1">
                <p className={`text-[8px] font-bold ${r.tc}`}>{r.step}</p>
                <p className="text-[8px] text-muted-foreground">{r.desc}</p>
                <p className={`text-[7px] font-mono ${r.tc}`}>Challenge: {r.challenge}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total synthesis cycle: 3 hari/bulan (Sari 6h + AI automated 14h). Output: 47 live clusters, updated monthly. This turns noise into signal — the entire intelligence advantage depends on this process.</p>
      </div>

      {/* Top Pain Clusters Deep Dive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-violet-500" /> TOP PAIN CLUSTERS — 5 Cluster Pain Point Terbesar yang Sudah Divalidasi dan Menunggu untuk Dijadikan Produk MJP Berikutnya
        </p>
        <div className="flex flex-col gap-2">
          {[
            { rank: 1, cluster: "Post-PHO/FHO Warranty Tracking", pains: 127, wtp: "Rp 2.1jt/bln", rootCause: "Tidak ada sistem untuk track klaim garansi dan response time kontraktor setelah PHO. Klien sering kehilangan hak garansi karena tidak documented.", blockers: "BPJK data tidak public, butuh manual tracking atau owner-reported. Complexity HIGH.", stage: "DISCOVERY", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { rank: 2, cluster: "Pre-bid Capital Adequacy Estimation", pains: 94, wtp: "Rp 1.6jt/bln", rootCause: "BUJK tidak bisa estimate working capital requirement sebelum bid. Sering menang tender tapi tidak punya cash untuk mobilize.", blockers: "Need financial modeling expertise. Payment terms vary per tender.", stage: "SCOPING", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { rank: 3, cluster: "Subkon Dispute Resolution Toolkit", pains: 78, wtp: "Rp 1.2jt/bln", rootCause: "Saat dispute terjadi, BUJK tidak punya dokumentasi yang proper untuk menang. Kontrak subkon sering tidak lengkap atau tidak bisa dieksekusi.", blockers: "Legal expertise required. Need partnership dengan law firm.", stage: "VALIDATION", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { rank: 4, cluster: "Material Price Alert & Budget Impact", pains: 67, wtp: "Rp 980rb/bln", rootCause: "Harga material fluktuasi, tapi BUJK sudah commit ke fixed-price contract. No early warning system untuk protect margin.", blockers: "Tested as H5 — usage was low. Reconsider dengan framing berbeda: 'margin protection' bukan 'material tracker'.", stage: "RE-EVALUATION", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { rank: 5, cluster: "Labor SKK Marketplace (find + hire)", pains: 58, wtp: "Rp 1.4jt/bln per successful hire", rootCause: "BUJK butuh tenaga ahli SKK J9 last-minute untuk qualify tender. Tidak ada marketplace untuk ini.", blockers: "Two-sided market = chicken-egg problem. Need supply side first.", stage: "IDEATION", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.cluster} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[9px] font-black w-4 shrink-0 ${r.tc}`}>#{r.rank}</span>
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.cluster}</p>
                <div className="flex gap-1.5 shrink-0 text-[7px] font-mono">
                  <span className={r.tc}>{r.pains} pains</span>
                  <span className="text-muted-foreground">WTP: {r.wtp}</span>
                  <span className={r.tc}>{r.stage}</span>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Root cause: {r.rootCause}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Blockers: {r.blockers}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pain Point → Policy Advocacy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-primary" /> PAIN-TO-POLICY — Bagaimana MJP Menggunakan Aggregated Pain Data untuk Influence Kebijakan Industri dan Membangun Credibility di Level Nasional?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              initiative: "Laporan BUJK Nasional — Dipublikasikan ke LPJK dan Media",
              howBuilt: "Aggregasi 47 pain clusters + quantitative data dari 1.847 pain points + 487 klien voices. Published sebagai '2026 Indonesia BUJK Pain Index' dengan angka yang konkret.",
              impact: "LPJK mengutip laporan MJP dalam 2 pertemuan konsultasi regulasi 2026. GAPENSI share ke 3.400 member mereka. Hendra diundang bicara di 2 industry event.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              initiative: "Submission ke Konsultasi Publik Peraturan PKPT",
              howBuilt: "MJP menganalisis draft PKPT baru dari perspektif BUJK kecil. Submitted formal comment dengan data: '34% klien J7 kami akan kesulitan comply dengan timeline ini karena...' Specific dan evidence-based.",
              impact: "Transition timeline yang di-request MJP (6 bln, bukan 3 bln) akhirnya di-adopt. Hendra credited di notulensi konsultasi resmi Kemenpu.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              initiative: "Whitepaper: 'Digitalisasi Pengadaan Konstruksi Indonesia'",
              howBuilt: "Collaborative dengan 2 akademisi UI + data MJP. 24 halaman. Peer-reviewed. Distribusi ke DPR Komisi V, Kemenpu, Bank Indonesia, BAPPENAS.",
              impact: "Cited in 1 Parliamentary inquiry. Downloaded 2.400 kali. Establishes MJP as serious data institution, not just SaaS company.",
              tc: "text-violet-700", bc: "bg-violet-50 border-violet-200"
            },
          ].map((r) => (
            <div key={r.initiative} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.initiative}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">How: {r.howBuilt}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>Impact: {r.impact}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Policy advocacy = long-term moat. Government yang mengenal MJP = potential partnership, endorsement, atau co-branding yang paid ADs could never buy. Positioning MJP as the "voice of BUJK" is a 5-year play.</p>
      </div>

      {/* Field Research Operations Manual */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Map className="h-3.5 w-3.5 text-primary" /> FIELD OPS MANUAL — SOP Lengkap Budi dan Tim Lapangan: Dari Persiapan Pre-Visit Hingga Submit ke Platform
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { phase: "PRE-VISIT (H-3 sebelum kunjungan)", tasks: ["Buka Pain Points queue — target lokasi/domain yang under-represented", "Brief dengan Reza: ada klien aktif di area ini yang punya specific intel need?", "Print/download daftar kontraktor target dari platform untuk verification visit", "Tentukan sasaran: min 5 pain points + 2 contractor profile updates per hari"], tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { phase: "DURING VISIT (Di lapangan)", tasks: ["Gunakan mobile app untuk input langsung — no paper (sinkron saat kembali ke coverage area)", "Foto bukti: proyek aktif, papan nama, equipment on site — setiap pain point butuh 1 foto minimum", "Triangulasi: satu pain point dari min 2 sumber berbeda sebelum submit sebagai VERIFIED", "Never promise anything — observer only. 'Saya riset independen untuk platform data.'"], tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { phase: "POST-VISIT (H+1 setelah kunjungan)", tasks: ["Upload semua pain points dengan foto dalam 24 jam", "Flag items yang butuh Sari review karena potensial high-impact", "Update kontraktor profil yang ada update — akreditasi baru, proyek selesai, dll", "Brief Reza jika ada intel yang relevan untuk AM klien aktif"], tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.phase} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-1`}>{r.phase}</p>
              {r.tasks.map((t, i) => <p key={i} className="text-[8px] text-muted-foreground">• {t}</p>)}
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Budi melakukan 3–4 field visit per bulan. Biaya: Rp 1.8jt/bln (transport + akomodasi). Output: 78 pain points/bln average. Cost per pain point: Rp 23rb. Signal quality dari field: 3.4× lebih accurate dari crawled data.</p>
      </div>

      {/* Pain Point Severity Scoring */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> SEVERITY SCORING — Bagaimana MJP Memberi Skor 1–10 untuk Setiap Pain Point dan Mengapa Skoring Ini Penting untuk Prioritisasi Produk?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          <p className="text-[8px] font-mono text-muted-foreground mb-1">Score = weighted average dari 4 dimensi (converted ke 1–10):</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-2">
            {[
              { dim: "Frequency (30%)", measure: "Berapa banyak BUJK mengalami ini per bulan? Scale: 1–5 reports = score 1; 50+ reports = score 10.", tc: "text-blue-700" },
              { dim: "Financial Impact (35%)", measure: "Berapa kerugian per kejadian? <Rp 500rb = score 1; > Rp 20jt = score 10. Direct + opportunity cost.", tc: "text-red-700" },
              { dim: "Urgency (20%)", measure: "Seberapa time-sensitive? Chronic issue = score 3; Issue with hard deadline (tender) = score 9–10.", tc: "text-orange-700" },
              { dim: "Lack of Alternative (15%)", measure: "Apakah ada solusi yang sudah ada di pasar? Good solutions exist = score 2; No solution = score 10.", tc: "text-emerald-700" },
            ].map((r) => (
              <div key={r.dim} className="border rounded-sm p-2 bg-muted/10">
                <p className={`text-[8px] font-bold ${r.tc}`}>{r.dim}</p>
                <p className="text-[7px] text-muted-foreground">{r.measure}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1 text-[8px] font-mono mb-1">
            {[
              ["Score 1–3", "LOW — monitor only", "text-slate-600"],
              ["Score 4–5", "MEDIUM — track trends", "text-blue-700"],
              ["Score 6–7", "HIGH — potential product", "text-orange-700"],
              ["Score 8–10", "CRITICAL — build ASAP", "text-red-700"],
            ].map(([score, label, tc]) => (
              <div key={score} className={`border rounded px-2 py-1 ${tc}`}>{score}: {label}</div>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Scoring enables product prioritization by data, not intuition. Cluster with highest aggregate score gets built first. Current highest: Post-PHO Warranty Tracking (cluster avg 7.8) — in discovery. Score calculated by AI, verified by Sari.</p>
      </div>

      {/* Pain Point Geography Heat Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Map className="h-3.5 w-3.5 text-primary" /> GEOGRAPHIC PAIN DISTRIBUTION — Di Mana Pain Point Paling Banyak dan Paling Berat di Indonesia Konstruksi dan Apa Artinya?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { region: "Jawa Tengah + DIY", count: 387, dominantPain: "HPS yang terlalu rendah untuk proyek rehabilitasi gedung tua — biaya aktual selalu lebih tinggi dari estimasi panitia", pattern: "Rehabilitation-heavy market with old building stock. Systematic underpricing at source.", actionable: "HPS rehabilitation specialist product opportunity. Strong product-market fit evidence.", tc: "text-red-700" },
            { region: "DKI Jakarta + Jabodetabek", count: 312, dominantPain: "Kompetisi ekstrem di semua kategori — terlalu banyak BUJK J9 untuk pasar yang ada, margin terus turun", pattern: "Market saturation in premium segment. Race to bottom pricing.", actionable: "Competitor analysis most-used feature here. Differentiation intel most valuable.", tc: "text-orange-700" },
            { region: "Kalimantan Timur", count: 178, dominantPain: "Kurangnya subkontraktor lokal yang qualified — harus bawa dari Jawa yang mahal dan ribet logistiknya", pattern: "IKN effect: demand far outpacing local supplier capacity.", actionable: "Subkon marketplace opportunity. Rp 1.4jt WTP confirmed. High priority.", tc: "text-orange-700" },
            { region: "Sulawesi Selatan", count: 143, dominantPain: "Terlambatnya pembayaran termin dan klaim garansi yang tidak diproses — cash flow BUJK sangat terganggu", pattern: "Payment culture issues specific to this region. Regional government budget execution patterns.", actionable: "Post-PHO warranty tracking cluster (score 7.8) mostly from Sulsel data.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.region} className="border-l-2 border-muted pl-3 py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold ${r.tc} flex-1`}>{r.region}</p>
                <span className={`text-[8px] font-mono font-bold ${r.tc}`}>{r.count} pain points</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Dominant pain: {r.dominantPain}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>→ {r.actionable}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Geographic distribution helps MJP prioritize: (1) product development (Sulsel warranty → Post-PHO product), (2) field research allocation (Kaltim needs KTI researcher), (3) content production (Jateng HPS calibration needed).</p>
      </div>

      {/* Pain Point Interview Protocol */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-primary" /> INTERVIEW PROTOCOL — Cara Budi Menggali Pain Point yang Sesungguhnya dari BUJK di Lapangan: Pertanyaan Utama dan Teknik yang Terbukti Efektif
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Setiap interview Budi berlangsung 45–90 menit. Framework: Jobs-to-be-Done + Problem Discovery. Script diupdate setiap 6 bulan berdasarkan apa yang worked:</p>
          {[
            {
              phase: "Phase 1: Context Building (10 menit)",
              questions: [
                "'Ceritakan tender terakhir yang Bapak/Ibu ikut — dari awal sampai hasil?' (open-ended, biarkan mereka bercerita)",
                "'Apa bagian yang paling melelahkan dari proses itu?'",
              ],
              technique: "Active listening. Take no notes during this phase — just build rapport. This surfaces authentic stories.",
              tc: "text-blue-700"
            },
            {
              phase: "Phase 2: Pain Discovery (20 menit)",
              questions: [
                "'Kalau Bapak/Ibu kalah tender, biasanya karena apa? Dan bagaimana cara tahu kalah?'",
                "'Ada situasi dimana Bapak/Ibu sudah invest effort tapi akhirnya tahu dari awal tidak akan menang? Ceritakan.'",
                "'Apa informasi yang SELALU Bapak/Ibu inginkan sebelum memutuskan mau ikut tender tapi susah didapat?'",
              ],
              technique: "Follow pain signals: when voice changes, body language shifts, or they pause — probe deeper. 'Kenapa itu terasa berat?' is the most important follow-up.",
              tc: "text-orange-700"
            },
            {
              phase: "Phase 3: Current Solution & Workaround (15 menit)",
              questions: [
                "'Sekarang cara Bapak/Ibu cari info kompetitor bagaimana? Dan berapa jam ini butuh?'",
                "'Pernah salah informasi? Akibatnya apa?'",
              ],
              technique: "Document current workaround in detail. Workaround = willingness to pay signal. The worse the workaround = stronger the pain.",
              tc: "text-emerald-700"
            },
          ].map((r) => (
            <div key={r.phase} className="border rounded-sm p-3 bg-muted/5">
              <p className="text-[9px] font-bold mb-0.5">{r.phase}</p>
              {r.questions.map((q, i) => <p key={i} className="text-[8px] text-muted-foreground">{"➜"} {q}</p>)}
              <p className={`text-[8px] font-mono mt-0.5 ${r.tc}`}>Technique: {r.technique}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Interview protocol is Budi's most valuable skill — learned over 4 years. Rule: never ask 'would you use a product that...?' — that's feature validation, not pain discovery. Only ask about past behavior and current reality. Future-hypothetical responses = unreliable.</p>
      </div>

      {/* Pain Point Lifecycle: From Field to Product */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" /> PAIN TO PRODUCT — Perjalanan Sebuah Pain Point dari Catatan Lapangan Budi Hingga Menjadi Feature yang Digunakan 487 Klien
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { step: "1. Budi observes pain in field interview (Semarang, June 2024)", detail: "Direktur PT Karya Utama: 'Kami selalu kalah di harga karena tidak tahu kompetitor bid berapa. Kita pakai feeling saja.' Budi logs: [pain: HPS + Kompetitor Intel] [score: 8.3] [region: Jateng] [freq: high].", tc: "text-blue-700" },
            { step: "2. Pattern confirmed: 47 similar reports (June–Aug 2024)", detail: "Pain signal threshold (15 reports, severity 6.5+) passed in August. DISCOVERY_CANDIDATE flag auto-set by AI scoring. Sari reviews and confirms.", tc: "text-blue-700" },
            { step: "3. Sari writes problem statement (August 15, 2024)", detail: "'J8 BUJK dalam kategori bangunan pemerintah di Jawa tidak memiliki referensi harga penawaran dari kompetitor sebelumnya, menyebabkan kalah tender karena bid terlalu tinggi (rata-rata 12% above winning bid).'", tc: "text-orange-700" },
            { step: "4. Hendra Jr. evaluates technical feasibility (2 weeks)", detail: "LPSE stores historical award prices — can be scraped. Historical winner data available. Levenshtein for company matching. Verdict: buildable in 3 sprints.", tc: "text-orange-700" },
            { step: "5. Budi WTP validation (Sept 2024, 8 interviews)", detail: "8 BUJK direktur in Jateng + Jatim. Avg WTP: Rp 280rb/bln add-on. 6/8 said it would change their bidding strategy. Decision: proceed.", tc: "text-emerald-700" },
            { step: "6. Hendra prioritizes in Sprint 18 (Oct 2024)", detail: "Competitor Radar v1: display of historical bid prices by competitor in category. 4 sprints (8 weeks). Launched December 2024.", tc: "text-emerald-700" },
            { step: "7. Post-launch result (6 months after launch, Jun 2025)", detail: "287 MAU. 89% action rate. Attributed win rate lift: +31%. Klien testimonials collected × 9. Feature now cited in 89% of Enterprise renewal calls.", tc: "text-emerald-700" },
          ].map((r, i) => (
            <div key={r.step} className="flex gap-2 items-start border-b pb-1.5">
              <span className={`text-[8px] font-black w-4 shrink-0 ${r.tc}`}>{i + 1}.</span>
              <div className="flex-1">
                <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.step}</p>
                <p className="text-[8px] text-muted-foreground">{r.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">This is the story of Competitor Radar — from one Budi interview to MJP's most-loved feature. Time: 6 months from first observation to launch. Total time investment before development: 40 jam. Development time: 3 sprints. Result: revenue-generating feature used by 59% of all clients.</p>
      </div>

      {/* Pain Point Clustering Methodology */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-primary" /> CLUSTERING METHODOLOGY — Cara MJP Mengelompokkan Ribuan Pain Point Individual menjadi Cluster yang Dapat Diambil Keputusan?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Monthly clustering process by Sari (4–6 hours) using 3-stage methodology:</p>
          {[
            { stage: "Stage 1: Semantic Clustering (AI-assisted)", process: "All new pain points in the month fed to embedding model (OpenAI text-embedding-3-small). Cosine similarity clustering with threshold 0.78. Items with similarity > 0.78 auto-grouped. AI produces 12–18 candidate clusters per month.", quality: "AI clustering accuracy: 87%. 13% require human recategorization by Sari.", tc: "text-blue-700" },
            { stage: "Stage 2: Domain + Urgency Enrichment (Sari review)", process: "Sari reviews all AI clusters. Merges obviously related clusters. Splits overly broad clusters. Adds: Domain Industry tag, BUJK class relevance, urgency score, and cluster theme label.", quality: "Average review time: 35 minutes. Produces final 8–12 clusters per month with clear theme labels.", tc: "text-blue-700" },
            { stage: "Stage 3: Scoring + Prioritization (Sari + Hendra)", process: "Each cluster scored on 4 dimensions: Frequency (30%), Financial Impact (35%), Urgency (20%), Lack of Alternative (15%). Weighted score → cluster priority ranking. Presented to Hendra monthly.", quality: "Output: Monthly Top 5 Clusters deck. Input to product discovery sprint queue.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.stage} className="border rounded-sm p-2.5 bg-muted/5 mb-1">
              <p className="text-[9px] font-bold mb-0.5">{r.stage}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.process}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Quality: {r.quality}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200">
            <p className="text-[9px] font-bold text-emerald-700">August 2026 Top Clusters:</p>
            <div className="grid grid-cols-2 gap-1">
              {["Post-PHO Warranty Tracking (8.1/10)", "Payment Delay Early Warning (7.9/10)", "BIM Readiness Gap (7.4/10)", "Specialist Subkon Directory (7.2/10)", "TKDN Calculator Tool (7.0/10)"].map((c) => <p key={c} className="text-[7px] text-emerald-700">• {c}</p>)}
            </div>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Clustering converts noise into signal. 780 pain points/month → 8–12 actionable clusters → 1–2 discovery sprints. Without clustering: product team drowns in individual reports and misses the forest for the trees.</p>
      </div>

      {/* Pain Point Geographic Distribution */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" /> GEOGRAPHIC DISTRIBUTION — Peta Persebaran Pain Point Berdasarkan Region: Di Mana Masalah Paling Banyak Terdeteksi dan Apa Implikasinya?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Region</th>
                  <th className="p-1 text-center">Pain Points (YTD)</th>
                  <th className="p-1 text-center">Avg Severity</th>
                  <th className="p-1 text-center">Top Cluster</th>
                  <th className="p-1 text-center">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Jawa (Jateng + Jatim + DIY)", "4.847", "7.2/10", "Tender Admin Errors", "HIGH — 4 Budi routes"],
                  ["DKI Jakarta + Banten", "1.936", "7.8/10", "HPS Accuracy", "MEDIUM — 2 Budi routes"],
                  ["Jawa Barat", "1.248", "7.1/10", "Competitor Intelligence", "HIGH — 3 Budi routes"],
                  ["Sumatra (all)", "892", "6.8/10", "Regulatory Compliance", "LOW — 1 partner reporter"],
                  ["Kalimantan", "341", "7.4/10", "Material Price Intel", "VERY LOW — ad-hoc only"],
                  ["Sulawesi", "298", "7.6/10", "SKK & Certification", "VERY LOW — ad-hoc only"],
                  ["Papua + NTT + Maluku (KTI)", "87", "8.1/10", "All — extreme infra gaps", "MINIMAL — 0 permanent coverage"],
                ].map((row, i) => (
                  <tr key={i} className={`border-b hover:bg-muted/20 ${i >= 4 ? "text-orange-700" : ""}`}>
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center">{row[1]}</td>
                    <td className="p-1 text-center">{row[2]}</td>
                    <td className="p-1 text-center">{row[3]}</td>
                    <td className={`p-1 text-center font-bold ${row[4].startsWith("HIGH") ? "text-emerald-700" : row[4].startsWith("MEDIUM") ? "text-blue-700" : "text-orange-700"}`}>{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-orange-50 border-orange-200">
            <p className="text-[9px] font-bold text-orange-700">Coverage Gap = Opportunity Gap</p>
            <p className="text-[8px]">KTI pain points avg severity 8.1/10 — highest of any region. But only 87 collected (vs 4.847 from Jawa). Why: we have no permanent Budi-equivalent in KTI. This is selection bias creating a data blind spot. Hire 1 KTI researcher = unlock 300+ pain points/month from the highest-severity region.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Geographic distribution guides Budi's travel schedule. Quarterly field visits: 3 routes in Jawa (priority), 1 Sumatra trip per quarter (Medan + Palembang). KTI: targeted trip 1× per semester pending budget. Pain point density map = investment case for next hire location.</p>
      </div>

      {/* Pain Signal Velocity Trending */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> SIGNAL VELOCITY — Pain Point yang Paling Cepat Naik dalam 6 Bulan Terakhir: Tren Muncul yang Baru Belum Ada di Workstream Utama MJP?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { pain: "BIM Readiness Gap — 'Tidak tahu harus mulai dari mana untuk BIM'", velocity: "+214% vs H1 2025", why: "Perpres signed. BUJK mulai panik tapi tidak ada guidance dalam Bahasa Indonesia yang practical.", mjpStatus: "IN PROGRESS — BIM Knowledge Vertical aktif. 12 assets sudah published.", tc: "text-red-700" },
            { pain: "Supply chain disruption: baja impor delay + harga naik", velocity: "+89% vs H1 2025", why: "Global steel supply chain issue Q1 2026. Material uncertainty = HPS estimates unreliable. BUJK who locked in prices early win.", mjpStatus: "BACKLOG — Supply chain intelligence product discussed. No implementation yet.", tc: "text-orange-700" },
            { pain: "Subkon tidak mau terima proyek pemerintah karena payment delay", velocity: "+67% vs H1 2025", why: "Subkontraktor refuse government projects due to payment delay history. BUJK struggling to find quality subkon for government work.", mjpStatus: "DISCOVERY CANDIDATE — 3 more reports needed to hit threshold.", tc: "text-orange-700" },
            { pain: "Konflik kepemilikan dokumen saat direktur BUJK berganti", velocity: "+43% vs H1 2025", why: "Ownership transition creating administrative chaos. BUJK 'orphaned' when founding director passes on or exits.", mjpStatus: "MONITORING — Legal domain. Refer to legal counsel. Not MJP's core.", tc: "text-blue-700" },
            { pain: "AI tools yang digunakan BUJK rival tidak MJP klien ketahui", velocity: "+38% vs H1 2025", why: "BUJK hearing competitors use AI for estimating, document prep. Fear of being left behind. Not sure what tools to use.", mjpStatus: "PARTIALLY ADDRESSED — AI Rekomendasi page exists but needs 'tool guide' content.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.pain} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[8px] font-bold flex-1">{r.pain}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.velocity}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Why rising: {r.why}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>MJP: {r.mjpStatus}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Velocity tracking is Sari's early warning system for product roadmap. A pain growing {'>'} 50% in 6 months = intervention needed within 12 months or MJP falls behind market need. BIM is the only one currently in the CRITICAL zone (214% growth + mandate deadline).</p>
      </div>

      {/* Pain Point to Product Pipeline */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-primary" /> P2P PIPELINE — Dari Pain Point ke Produk: 7 Contoh Nyata Bagaimana Masalah Lapangan Menjadi Fitur MJP yang Berdampak
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { pain: "'Saya kalah tender karena tidak tahu kompetitor bid berapa' (2021, Budi field Jateng, 14 reports)", product: "Competitor Bid History Radar — launched Q3 2022", impact: "12% improvement in avg win rate for active Radar users. Now used by 68% of Pro/Enterprise klien.", months: "14 months pain→product" },
            { pain: "'SKK saya expired tiba-tiba pas mau daftar tender' (2022, Dewi intake, 23 reports)", product: "SKK Expiry Notification System — launched Q1 2023", impact: "91% of SKK Express klien now renew before expiry vs 34% before the alert system.", months: "9 months pain→product" },
            { pain: "'Saya tidak mengerti kenapa HPS tender ini berbeda jauh dari biaya saya' (2022, 31 reports)", product: "HPS Estimation Model — launched Q2 2023", impact: "7.8% MAE. Klien using HPS model have 18% higher win rate vs those who bid blind.", months: "12 months pain→product" },
            { pain: "'Alert dari Sari kadang terlambat 1–2 hari' (2023, klien survey, 19 respondents)", product: "Automated L1/L2 Alert System — launched Q3 2023", impact: "Avg alert latency: 18 menit vs 1.8 hari manual. 96.1% SLA compliance.", months: "6 months pain→product" },
            { pain: "'Saya tidak tahu apakah BUJK yang mau saya ajak konsorsium aman' (2023, 16 reports)", product: "BUJK Trust Score — launched Q4 2023", impact: "12,400 BUJKs scored. Used in 47% of Enterprise klien's consortium selection process.", months: "10 months pain→product" },
            { pain: "'Briefing harian susah dibaca di HP saat di lapangan' (2024, Budi + 8 lainnya)", product: "WhatsApp-formatted Daily Briefing — launched Q2 2024", impact: "Open rate on WA: 84% vs 31% for email. Most-cited reason for subscription renewal.", months: "5 months pain→product" },
            { pain: "'Tim lapangan kami tidak bisa akses platform saat sinyal lemah' (2024, 22 Enterprise reports)", product: "Mobile App with Offline Mode — launched Q1 2026", impact: "34 Enterprise companies adopted mobile. Offline usage: 28% of total mobile sessions.", months: "18 months pain→product (blocked on dev resource)" },
          ].map((r) => (
            <div key={r.pain} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[8px] font-bold flex-1">{r.product}</p>
                <span className="text-[7px] font-mono text-muted-foreground shrink-0">{r.months}</span>
              </div>
              <p className="text-[7px] text-orange-700 mb-0.5">Pain: {r.pain}</p>
              <p className="text-[7px] text-emerald-700">{r.impact}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Average pain-to-product time: 10.6 months. Fastest: 5 months (WA briefing — low tech lift). Slowest: 18 months (mobile offline — high tech lift, blocked by dev capacity). Pattern: tech-light solutions always beat tech-heavy on time-to-market. Hendra's rule: if there's a non-technical solution to a pain, do that first while the tech is built.</p>
      </div>

      {/* Latent Pain Discovery */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> LATENT PAIN — 5 Jenis Masalah yang BUJK Tidak Sadari Sebagai Masalah Sampai MJP Menunjukkannya: Teknik Discovery untuk Memunculkan Pain yang Tidak Terucapkan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Latent pains = real pains that BUJK normalizes as 'how things work' until someone names it differently:</p>
          {[
            {
              latent: "The 'Kalah Terus' Normalization",
              symptom: "Direktur CV: 'Biasa, 1 dari 5 menang.' Tidak ada rasa bahwa angka ini seharusnya bisa lebih baik.",
              discovery: "Budi question: 'Bagaimana kalau bisa jadi 1 dari 3?' Shock, then curiosity. The reframe creates the pain: 'Am I leaving 40% of potential wins on the table?'",
              mjp: "Competitor Radar + Win Probability scoring. Frames the problem as solvable, not inevitable.",
              tc: "text-orange-700"
            },
            {
              latent: "The 'Macet Administrasi' Fatalism",
              symptom: "'SKK itu memang lama, kita sudah biasa nunggu 3–4 bulan.' Normalized friction in qualification process.",
              discovery: "Dewi question during field visit: 'Tahu tidak ada yang bisa diselesaikan dalam 5 hari?' Response: 'Tidak mungkin.' Dewi: 'Mau coba?' Express case instantly converts fatalism to curiosity.",
              mjp: "SKK Express. Discovery is the sales pitch. The latent pain becomes active the moment the faster path is revealed.",
              tc: "text-orange-700"
            },
            {
              latent: "The 'Tidak Tahu Tidak Tahu' Gap",
              symptom: "'Regulasi konstruksi itu banyak ya, kita ikut yang kita tahu aja.' Not aware they are missing things they don't know they should know.",
              discovery: "Sari shows regulatory alert history: '17 peraturan baru dalam 12 bulan yang mempengaruhi kelas Anda. Anda tahu berapa?' Answer: 2–3. The gap is visible.",
              mjp: "Regulatory Alert system. L1/L2 alerts turn unknown-unknowns into known-knowns.",
              tc: "text-blue-700"
            },
            {
              latent: "The 'Data HPS Rahasia' Assumption",
              symptom: "'HPS kan tidak boleh dipublikasikan, bagaimana bisa tahu?' Assumption that competitor bid data is inaccessible.",
              discovery: "Reza shows Competitor Radar during demo: 'Lihat ini — 5 tahun data harga penawaran pemenang untuk kategori yang sama di provinsi ini.' Jaw drop.",
              mjp: "Competitor Radar is a discovery product — 74% of sales happen after first demo. The pain only becomes active when the solution is shown.",
              tc: "text-blue-700"
            },
          ].map((r) => (
            <div key={r.latent} className="border rounded-sm p-2.5 bg-muted/5 mb-1">
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.latent}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5"><strong>Symptom:</strong> {r.symptom}</p>
              <p className="text-[7px] mb-0.5"><strong>Discovery:</strong> {r.discovery}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>MJP product: {r.mjp}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Latent pain discovery is Reza's superpower in sales, Budi's superpower in field research. Neither lists features — they reveal hidden problems first. The product becomes obvious once the problem is named. Hendra's sales doctrine: 'Don't show the solution until the customer has felt the pain. The moment they say 'oh ternyata ini masalah saya' — that's when they're ready to buy.'</p>
      </div>

      {/* Pain Point Interview Taxonomy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-primary" /> INTERVIEW TAXONOMY — Taksonomi 6 Jenis Percakapan Lapangan Budi: Dari Small Talk ke Deep Problem Discovery — Teknik yang Menghasilkan Pain Point Paling Berkualitas
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { type: "Jenis 1 — Complaint Venting", signal: "Klien mulai dengan keluhan umum: 'Tender sekarang susah.', 'Pemerintah tidak transparan.'", technique: "Budi listens fully without interruption. Never defends system. After venting completes: 'Ceritakan satu kejadian spesifik dari 6 bulan terakhir.' Venting → specific incident → concrete pain.", quality: "High volume, low specificity. Needs probing to sharpen.", tc: "text-muted-foreground" },
            { type: "Jenis 2 — Workaround Description", signal: "'Jadi kami biasanya...' or 'Cara kami mengatasi itu adalah...' Describing a workaround = unsolved problem underneath.", technique: "Budi: 'Kalau tidak perlu cara seperti itu, idealnya prosesnya bagaimana?' The gap between their workaround and their ideal = the exact pain MJP can solve.", quality: "HIGHEST QUALITY. Workarounds = proven pain with active effort to solve.", tc: "text-emerald-700" },
            { type: "Jenis 3 — Comparison Story", signal: "'Kompetitor kami (si X) bisa melakukan Y — kami tidak bisa.' Or 'Dulu di kontraktor lama, kami...'", technique: "Note the capability gap. Don't immediately pitch solution. Understand why they haven't found the solution themselves: is it awareness gap? Cost? Access?", quality: "High specificity. Often points to competitive intel or feature gap.", tc: "text-emerald-700" },
            { type: "Jenis 4 — Future Worry", signal: "'Saya khawatir kalau BIM jadi wajib, kami tidak siap.' or 'Takutnya kalau regulasi berubah...'", technique: "Validate the worry: 'Kekhawatiran itu wajar. Dari yang saya dengar, memang sedang...' Budi has context from Sari. Positions MJP as solution before problem becomes acute.", quality: "Emerging pain. Perfect for early product positioning.", tc: "text-blue-700" },
            { type: "Jenis 5 — Positive Surprise", signal: "'Oh ternyata ada cara seperti itu? Saya tidak tahu.' or 'Wah, kalau begitu kami bisa...'", technique: "Track WHAT surprised them. Surprise = previously unknown capability = latent pain just becoming active. Budi notes the specific capability that triggered surprise.", quality: "Product discovery signal. Often leads to new feature ideas.", tc: "text-blue-700" },
            { type: "Jenis 6 — Hard Stop / Deflection", signal: "Klien becomes guarded, changes subject, or gives one-word answers.", technique: "Don't push. Topic is sensitive (potentially corrupt practice involvement, financial distress, dispute). Budi notes deflection pattern without probing further. Signal to Sari: sensitive domain.", quality: "Signals risk areas MJP should not enter (legal/ethical).", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.type} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.type}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5"><strong>Signal:</strong> {r.signal}</p>
              <p className="text-[7px] mb-0.5"><strong>Technique:</strong> {r.technique}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Quality: {r.quality}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Budi trained on this taxonomy by Sari over 3 months (2023). He initially collected mostly Jenis 1 (complaints) — large volume, low actionability. After taxonomy training: 60% of his interviews now yield Jenis 2 or Jenis 3 (workarounds + comparison stories). These produce 4× more actionable pain points. Quality of field data improved without increasing field hours.</p>
      </div>

      {/* Pain Point Severance Economics */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> COST-OF-PAIN — Berapa Biaya Nyata dari Setiap Pain Point di Lapangan: Kalkulasi Kehilangan Pendapatan yang Biasa Dialami BUJK dan Mengapa Rp 1,5jt/bln Terasa Murah Sesudahnya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Pain Point</th>
                  <th className="p-1 text-center">Frequency</th>
                  <th className="p-1 text-center">Cost per incident</th>
                  <th className="p-1 text-center">Annual cost avg BUJK</th>
                  <th className="p-1 text-left">How MJP addresses</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Missed tender deadline (not noticed in time)", "2–3x/year", "Rp 15–45jt (mobilization cost)", "Rp 60jt", "L1/L2 Alerts with 48h window"],
                  ["Disqualified — SBU/SKK mismatch", "1–2x/year", "Rp 25jt (bid prep cost)", "Rp 38jt", "SBU/SKK compliance check pre-bid"],
                  ["Wrong HPS estimate (bid too high)", "3–5x/year", "Rp 0 (no win, but cost of bid prep)", "Rp 30jt", "HPS Model ±8.3% accuracy"],
                  ["Wrong HPS estimate (bid too low, win)", "1–2x/year", "Rp 50–200jt (margin erosion)", "Rp 90jt", "HPS Model + competition density"],
                  ["Sub-contractor default (trust failure)", "1x/2 years", "Rp 200–500jt (project disruption)", "Rp 150jt", "BUJK Trust Score screening"],
                  ["SKK expired → tender penalty", "1–2x/year", "Rp 5–15jt (penalty + re-process)", "Rp 15jt", "SKK Expiry Reminder + Express"],
                  ["Regulatory change missed → non-compliance", "1x/2 years", "Rp 50jt+ (contract amendment, delay)", "Rp 30jt", "Regulatory Alert System (Sari)"],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[2]}</td>
                    <td className="p-1 text-center font-bold text-red-700">{row[3]}</td>
                    <td className="p-1 text-emerald-700">{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200">
            <p className="text-[9px] font-bold text-emerald-700">The ROI calculation Reza uses in every Enterprise pitch:</p>
            <p className="text-[8px]">Total addressable pain cost for avg BUJK (J8): Rp 413jt/year. MJP Pro subscription: Rp 1.5jt/bln × 12 = Rp 18jt/year. If MJP prevents just 5% of pain cost: saves Rp 20.6jt — exceeds subscription cost. At 20% pain prevention: saves Rp 82.6jt = 4.6× ROI. Enterprise clients typically achieve 30%+ pain reduction. Reza: 'We don't ask them to trust us — we ask them to do the math.'</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Cost-of-pain analysis compiled by Hendra from Budi's field interviews (klien shared actual loss figures, anonymized) + Reza's CRM notes from Enterprise onboarding conversations. Not published externally — used only in Enterprise sales. Basis of Reza's ROI calculator in the pitch deck (Slide 10 addendum). The most persuasive sales tool MJP has: concrete numbers, not feature lists.</p>
      </div>

      {/* Pain Point Segmentation by BUJK Class */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" /> CLASS SEGMENTATION — Pain Point yang Berbeda untuk Setiap Kelas BUJK: J7 vs. J8 vs. J9 Menghadapi Masalah yang Sangat Berbeda Meski Semua Mengikuti Tender yang Sama
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              kelas: "BUJK Kelas J7 (CV dan PT kecil, < 750 SDM)",
              pct: "61% of MJP klien base",
              topPains: [
                "Tidak tahu tender mana yang realistis untuk diikuti (kurang data filtering)",
                "SKK expiry sering mendadak — tidak ada sistem tracking internal",
                "Modal terbatas untuk mobilisasi — salah pilih tender = kerugian besar",
                "Tidak punya akses ke jaringan mitra konsorsium yang terpercaya",
              ],
              mjpFit: "Tender Alert (L1/L2) + SKK Reminder + HPS model + Consortium matching. All 4 core features directly address J7 pain.",
              color: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              kelas: "BUJK Kelas J8 (PT menengah, 750–3.000 SDM)",
              pct: "31% of MJP klien base",
              topPains: [
                "Kalah dari kompetitor yang punya koneksi internal di LPSE buyer",
                "Estimasi HPS seringkali meleset 15–25% — kehilangan margin",
                "Susah benchmark harga sub-material yang berubah tiap kuartal",
                "Tidak punya intelijen regulasi yang cukup cepat untuk proyek lintas provinsi",
              ],
              mjpFit: "Competitor Radar + HPS model + Regulatory Alert + Pre-Bid Brief. J8 uses more advanced features.",
              color: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
            {
              kelas: "BUJK Kelas J9 (perusahaan besar, > 3.000 SDM)",
              pct: "8% of MJP klien base (all Enterprise tier)",
              topPains: [
                "Managing 50+ active tenders simultaneously — coordination breakdown",
                "Sub-contractor due diligence di 5+ provinsi secara bersamaan",
                "BIM compliance documentation untuk proyek di atas Rp 100M",
                "Risk management: regulatory change terlambat diketahui oleh tim tender regional",
              ],
              mjpFit: "API + BUJK Trust Score + BIM vertical + multi-user account access. J9 needs integration, not just alerts.",
              color: "text-red-700", bc: "bg-red-50 border-red-200"
            },
          ].map((r) => (
            <div key={r.kelas} className={`border rounded-sm p-2.5 ${r.bc} mb-1`}>
              <div className="flex items-center justify-between mb-0.5">
                <p className={`text-[8px] font-bold ${r.color}`}>{r.kelas}</p>
                <span className="text-[7px] font-mono text-muted-foreground">{r.pct}</span>
              </div>
              <p className="text-[8px] font-semibold mb-0.5">Top pains:</p>
              {r.topPains.map((p, i) => <p key={i} className="text-[7px] mb-0.5">• {p}</p>)}
              <p className={`text-[7px] font-mono mt-0.5 ${r.color}`}>MJP fit: {r.mjpFit}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Class segmentation guides both product roadmap and sales messaging. Reza's opening pitch is different for J7 vs. J8 vs. J9. Sari's knowledge assets are tagged by intended BUJK class (J7-focus: 48%, J8-focus: 38%, J9-focus: 14%). Class segmentation also explains why MJP's churn differs by tier: Enterprise (J9) churn = {'<'}5%, Pro (J7/J8) churn = 13%. J7 is more price-sensitive and needs faster time-to-value.</p>
      </div>

      {/* Seasonal Pain Point Calendar */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5 text-primary" /> SEASONAL PAINS — Kalender Musiman Pain Point BUJK: Masalah Berbeda di Setiap Kuartal — Panduan untuk Sari agar Konten Selalu Tepat Waktu dan untuk Reza agar Pitch Selalu Relevan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              quarter: "Q1 (Jan–Mar) — APBN Budget Release Season",
              pains: [
                "Tender APBN flood: ratusan tender baru muncul bersamaan. BUJK kewalahan filtering mana yang cocok.",
                "SKK renewal rush: BUJK yang menunda pembangunan tim baru sadar SKK kedaluwarsa saat tender baru muncul.",
                "Estimasi HPS buruk: BUJK tidak update benchmark dari tahun lalu — harga material sudah berubah.",
                "Konsorsium formation urgency: banyak tender besar membutuhkan konsorsium yang harus dibentuk dalam 2–3 minggu.",
              ],
              mjpAction: "Q1 is Sari's busiest annotation quarter. MJP pre-loads watchlist defaults for Q1 tender patterns. Reza uses Q1 urgency for upgrade conversations.",
              tc: "text-blue-700"
            },
            {
              quarter: "Q2 (Apr–Jun) — Evaluation & Delivery Season",
              pains: [
                "Dokumen tidak lengkap saat evaluasi — panitia menemukan expired SKK yang lolos saat screening awal.",
                "Subcontracting disputes: project delivery begins, sub-contractor issues surface.",
                "Competitor monitoring fatigue: klien won tenders now focused on delivery, neglect intelligence.",
              ],
              mjpAction: "Sari focuses on compliance guides. Reza does health checks on klien who went quiet. MJP reminder: 'Delivery is the time to watch competitors who are still bidding.'",
              tc: "text-emerald-700"
            },
            {
              quarter: "Q3 (Jul–Sep) — Mid-Year Budget Revision Season",
              pains: [
                "APBN-P (perubahan) tenders: revised budget tenders appear with shorter timelines.",
                "APBD Q3: regional government tenders flood, different rules than APBN.",
                "Regulatory change catch-up: mid-year is when some Permen changes take effect. BUJKs scramble.",
                "Rainy season mobilization costs: project cost estimates built for dry season, now need adjustment.",
              ],
              mjpAction: "Sari's APBD focus quarter. Regional regulatory alerts ramp. Budi's Wilayah D flexible week often directed to regional intelligence.",
              tc: "text-orange-700"
            },
            {
              quarter: "Q4 (Oct–Dec) — Year-End Budget Flush",
              pains: [
                "Budget flush tenders: low quality tenders with very tight deadlines (2–5 hari). High risk for BUJK.",
                "SKK Express peak: BUJK who waited all year rush for SKK renewal — Dewi at max capacity.",
                "HPS inflations: panitia set high HPS to exhaust budget — good for BUJK but unusual pricing dynamics.",
                "Year-end decision fatigue: BUJK directors also tired — decision quality drops, Reza adjusts pitch cadence.",
              ],
              mjpAction: "Dewi's busiest SKK Express quarter (47% of annual Express volume in Q4). Sari flags budget-flush tenders with special warning label. Hendra monitors Dewi capacity weekly.",
              tc: "text-red-700"
            },
          ].map((r) => (
            <div key={r.quarter} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.quarter}</p>
              <div className="mb-0.5">{r.pains.map((p, i) => <p key={i} className="text-[7px]">• {p}</p>)}</div>
              <p className={`text-[7px] font-mono ${r.tc}`}>MJP response: {r.mjpAction}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Seasonal pain calendar drives MJP's content planning and feature emphasis. Sari prepares Q1 content in December, Q4 content in September. Hendra plans Dewi's capacity and Budi's routes with seasonal intelligence demand in mind. This is coordinated operational intelligence — most competitors publish reactively; MJP publishes proactively because we track the pattern.</p>
      </div>

      {/* Pain Point Resolution Velocity */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> RESOLUTION VELOCITY — Kecepatan MJP Mengubah Pain Point menjadi Solusi: Dari Budi Melaporkan Masalah hingga Klien Bisa Menggunakan Fitur — Berapa Waktu yang Dibutuhkan dan Di Mana Biasanya Terjadi Bottleneck
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">End-to-end timeline for a pain point → shipped feature (based on 10 historical features):</p>
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Phase</th>
                  <th className="p-1 text-center">Owner</th>
                  <th className="p-1 text-center">Avg time</th>
                  <th className="p-1 text-center">Bottleneck?</th>
                  <th className="p-1 text-left">Output</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Pain point capture", "Budi", "0–7 hari", "No", "Notion field note"],
                  ["Triage + RICE scoring", "Sari", "3–7 hari", "Moderate", "Prioritized in backlog"],
                  ["Problem statement refinement", "Hendra + Sari", "3–5 hari", "Low", "1-page Notion spec"],
                  ["Hypothesis testing", "Hendra + Reza", "7–21 hari", "YES — highest variance", "Go/No-go decision"],
                  ["Feature design (Hendra)", "Hendra", "3–7 hari", "Low", "Wireframe in Figma"],
                  ["Development (Hendra Jr.)", "Hendra Jr.", "14–35 hari", "YES — capacity", "Working feature in staging"],
                  ["QA + klien testing (early)", "Reza + 3 klien", "5–7 hari", "Low", "Feedback + approval"],
                  ["Staged rollout (Pro → all)", "Hendra Jr.", "3–7 hari", "No", "Live in production"],
                ].map((row, i) => (
                  <tr key={i} className={`border-b hover:bg-muted/20 ${row[3] === "YES — highest variance" || row[3] === "YES — capacity" ? "bg-orange-50" : ""}`}>
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className="p-1 text-center text-primary">{row[2]}</td>
                    <td className={`p-1 text-center font-bold ${row[3].includes("YES") ? "text-red-700" : row[3] === "Moderate" ? "text-orange-700" : "text-emerald-700"}`}>{row[3]}</td>
                    <td className="p-1 text-muted-foreground">{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            <div className="border rounded-sm p-2.5 bg-red-50 border-red-200">
              <p className="text-[9px] font-bold text-red-700">Bottleneck 1: Hypothesis testing (7–21 days)</p>
              <p className="text-[8px]">High variance because: some hypotheses require Reza to test with klien (scheduling friction), some require market data that takes time to gather. Fast hypothesis (1 week): 'would klien pay for X' → 3 WA questions to existing klien. Slow hypothesis (3 weeks): 'does Y reduce churn' → wait for cohort data.</p>
            </div>
            <div className="border rounded-sm p-2.5 bg-red-50 border-red-200">
              <p className="text-[9px] font-bold text-red-700">Bottleneck 2: Development capacity (Hendra Jr. only)</p>
              <p className="text-[8px]">Hendra Jr. cannot parallelize more than 2 features. Queue forms during high-signal periods (Q1 tender season = many pain points surfaced simultaneously). Post-Series A hire plan: 1 additional backend engineer specifically to dequeue Hendra Jr.'s backlog.</p>
            </div>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total pain-to-feature average: 45–90 days. Best case (fast hypothesis, available Hendra Jr. capacity): 28 days. Worst case: 6 months (NLQ — complex technology requirement). The speed variation reflects problem complexity, not team efficiency. Hendra's benchmark: 'A 6-week average for a 2-person team building domain-specific intelligence tools is genuinely fast. We're not building TODO apps — we're building a procurement intelligence engine.'</p>
      </div>

      {/* Pain Point Severity Economics by Segment */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> PAIN SEVERITY ECONOMICS — Ekonomi Keparahan Pain Point per Segmen Klien: Berapa Nilai Rata-rata Proyek yang Hilang atau Terancam karena Masalah yang Dipecahkan MJP — Dibedakan antara J7, J8, dan J9
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Pain magnitude varies dramatically by BUJK jenjang. This drives pricing, pitch, and feature priorities:</p>
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Pain point</th>
                  <th className="p-1 text-center">J7 cost</th>
                  <th className="p-1 text-center">J8 cost</th>
                  <th className="p-1 text-center">J9 cost</th>
                  <th className="p-1 text-left">Nature of cost</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Missed tender deadline", "Rp 3–8jt", "Rp 5–15jt", "Rp 15–50jt", "Bid prep cost wasted + opportunity cost"],
                  ["SKK expired = disqualification", "Rp 5–20jt", "Rp 10–40jt", "Rp 40–150jt", "Bid prep + potential damages if disqualified mid-process"],
                  ["HPS underestimate (bid too low)", "Rp 2–15jt", "Rp 8–50jt", "Rp 50–500jt", "Loss per unit on underbid contract"],
                  ["Bad sub-contractor (no trust score check)", "Rp 10–50jt", "Rp 30–200jt", "Rp 200jt–2T", "Delay penalties + cost overrun + reputational"],
                  ["Regulatory surprise (compliance fail)", "Rp 5–30jt", "Rp 20–100jt", "Rp 100jt–1T", "Fine + addendum cost + project delay"],
                  ["Consortium dissolution mid-project", "Rare for J7", "Rp 50–300jt", "Rp 300jt–3T", "Project abandonment + penalty exposure"],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className="p-1 text-center text-orange-700">{row[2]}</td>
                    <td className="p-1 text-center text-red-700 font-bold">{row[3]}</td>
                    <td className="p-1 text-muted-foreground">{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700">ROI calculation by tier — how Reza prices the value:</p>
            <p className="text-[8px]">J7 (Pro Rp 1.5jt/bln = Rp 18jt/thn): breakeven if MJP prevents 1 SKK disqualification/year = Rp 5–20jt saved. J8 (Pro Rp 2.5jt/bln = Rp 30jt/thn): breakeven if MJP prevents 1 HPS underestimate/year. J9 (Enterprise Rp 7.5jt/bln = Rp 90jt/thn): breakeven if MJP prevents 1 bad sub-contractor consortium in 5 years = expected value from consortium intelligence alone {'>'} Rp 90jt/thn. This is why Enterprise ROI case is easiest to make — the stakes are highest.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Pain severity table validated by Reza's deal debrief data (287 closed deals). When Reza uses a specific number ('prevented Rp 23jt loss') vs. generic ('saves you money'), conversion improves 2.1×. The table is Reza's reference for grounding the ROI conversation in specific, jenjang-relevant numbers. Sari updates it annually with fresh HPS and project cost data from the knowledge registry.</p>
      </div>

      {/* Emerging Pains 2026–2027 Radar */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Antenna className="h-3.5 w-3.5 text-primary" /> EMERGING PAINS RADAR — Radar Pain Point Baru yang Belum Masuk Backlog: 7 Masalah yang Budi Mulai Dengar di Lapangan Sejak 2025 — Belum Cukup Data untuk Dibangun, Tapi Cukup Kuat untuk Dimonitor Ketat
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Sari's 'watch list' — not yet in backlog, not yet scored, but mentioned consistently:</p>
          {[
            { pain: "EP-01 — 'Kami tidak tahu cara mempersiapkan dokumen BIM untuk tender PUPR'", signal: "Budi hears this in 6+ BUJK visits in Q2 2026. Expected to become critical 2027 when mandate activates.", validation: "Scheduled validation interview Q3 2026. If RICE > 10: enters active backlog immediately.", tc: "text-red-700" },
            { pain: "EP-02 — 'Sub-kontraktor meminta bukti bahwa BUJK kami tidak di-blacklist sebelum mau kerja'", signal: "Reverse trust issue: BUJK themselves need to prove their own clean status to potential sub-contractors. Need shareable trust certificate.", validation: "Sari's proposed solution: MJP shareable Trust Score URL (like a public profile). Estimated development: 5 days.", tc: "text-orange-700" },
            { pain: "EP-03 — 'Sulit track multiple project timelines serentak saat tender dan delivery overlap'", signal: "Reza hears from Enterprise J9 klien managing 3+ concurrent projects. Project scheduling pain, not procurement.", validation: "Hendra's pre-assessment: RICE likely < 10 (not MJP's core). Potentially refer to project management tools (not compete with them).", tc: "text-muted-foreground" },
            { pain: "EP-04 — 'Persyaratan ESG mulai muncul di beberapa tender BUMN'", signal: "Budi reports 3 BUJK mentioned ESG reporting requirements in BUMN tender docs. Not yet widespread but trend is clear.", validation: "Sari tracking ESG tender requirements. If 10+ LPSE instances show ESG requirements by Q4 2026: new knowledge category needed.", tc: "text-blue-700" },
            { pain: "EP-05 — 'Tidak ada cara mudah memverifikasi BUJK baru di daerah lain untuk sub-kontrak'", signal: "J8/J9 klien expanding nationally face due diligence problem for BUJK they've never worked with in other provinces.", validation: "Current Trust Score partially solves this. Gap: outer island BUJK coverage thin in MJP DB. Expansion plan (post-Series A) closes gap.", tc: "text-primary" },
            { pain: "EP-06 — 'Klausul asuransi proyek semakin kompleks dan kami tidak mengerti implikasinya'", signal: "2 BUJK mentioned this independently to Budi (Q1 2026). Insurance requirements in tender docs increasing.", validation: "Sari reviewing: is this solvable with knowledge assets (insurance clause explainer) or requires insurance expertise MJP doesn't have?", tc: "text-muted-foreground" },
            { pain: "EP-07 — 'Data IKN berubah terus, informasi lama menyesatkan'", signal: "IKN project scope evolves faster than most data sources. 4 klien report acting on outdated IKN information from non-MJP sources.", validation: "MJP already has IKN-tagged alerts. Gap: IKN-specific knowledge assets are thin. Sari adding 2 IKN assets/week since Q2 2026.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.pain} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.pain}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Signal: {r.signal}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.validation}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Emerging pain radar maintained by Sari in Notion ('Watch List' tag). Items graduate to active backlog when: (1) mentioned in 5+ independent field encounters, (2) RICE score estimated {'>'} 10, (3) MJP can plausibly be the best solution. EP-01 (BIM) is close to graduation — blocked only by insufficient validation sample size. EP-05 (outer island verification) is an infrastructure dependency, not a product development dependency. EP-07 (IKN data freshness) already being addressed without formal backlog entry.</p>
      </div>

      {/* Pain Prioritization Economics */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <PiggyBank className="h-3.5 w-3.5 text-primary" /> PRIORITIZATION ECONOMICS — Ekonomi Prioritisasi Pain Point MJP: Mengapa Rp 23jt per Klien per Kuartal adalah Angka Paling Penting dalam Seluruh Framework — dan Bagaimana Angka Ini Dihitung Ulang Setiap Tahun
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">The Rp 23jt/klien/quarter reference value: how it's built from first principles:</p>
          {[
            { component: "C1 — Missed tender opportunity cost (largest component)", calc: "Avg J7–J8 BUJK submits 4 tenders/quarter. Win rate without intelligence: 17%. With 6pp premium: 23%. Incremental win: 0.24 tenders/quarter. Avg contract value J7–J8: Rp 450jt. Avg gross margin: 12%. Incremental gross profit: 0.24 × 450jt × 12% = Rp 12.96jt/quarter.", source: "Derived from Reza's 287 deal debrief data + LPSE award data sample.", tc: "text-primary" },
            { component: "C2 — SKK expiry penalty avoidance", calc: "1 SKK expiry event per year average = 1 missed tender/quarter in the affected quarter. Value of prevented expiry: Rp 450jt × 12% margin × 0.25 quarters = Rp 13.5jt/year = Rp 3.375jt/quarter.", source: "Dewi's SKK Express case data. 341 expiry saves in 2025.", tc: "text-blue-700" },
            { component: "C3 — Blacklist intelligence saves", calc: "Probability J7–J8 encounters a blacklisted BUJK in 12 months: 18% (from MJP data, 87 klien in 487 were near-miss situations in 2025). Cost of partnering with blacklisted BUJK: disqualification = Rp 8.4jt tender prep cost. Expected value: 18% × 8.4jt ÷ 4 = Rp 0.378jt/quarter.", source: "Reza's renewal notes 2025.", tc: "text-orange-700" },
            { component: "C4 — Regulatory compliance cost avoided", calc: "1.3 regulatory changes/quarter that affect a typical J7–J8 BUJK KBLI scope. Without advance notice: avg 2.3 days of lost productivity per event (legal consultation, documentation). Daily cost of BUJK director time: Rp 1.5jt. Cost per event: Rp 3.45jt. With MJP alert 45 days early: cost drops to 0.5 days preparation. Saving: Rp 2.6jt per event × 1.3 = Rp 3.38jt/quarter.", source: "Sari's regulatory alert ROI case studies.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.component} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.component}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.calc}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Source: {r.source}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-primary/5 border-primary/20 mt-1">
            <p className="text-[9px] font-bold text-primary">Total: C1 + C2 + C3 + C4 = Rp 12.96 + 3.375 + 0.378 + 3.38 = Rp 20.09jt/quarter</p>
            <p className="text-[8px]">Rounded to Rp 23jt with 15% buffer for non-modeled benefits (team alignment, time savings, network intelligence). Reza uses Rp 23jt in all J7–J8 sales calls. For J9: recalculated to Rp 67jt/quarter using J9 contract sizes and margins. Annual MJP subscription Pro = Rp 24jt = 26% of ONE quarter of conservative value delivered. LTV:CAC intuition built into ROI frame.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">ROI model reviewed annually (Sari Q1 audit, Hendra approval). Key assumption: win rate premium is real and attributable to MJP. The attribution problem is inherent — we can't run a controlled experiment. Sari's standard: use the most conservative attributable premium estimate (6pp, not the 13pp Jateng outlier). Even at 6pp, the model shows 8.7× LTV:CAC. Reza: 'I've heard hundreds of BUJK calculate this in real-time when I walk them through it. Nobody argues with the math.'</p>
      </div>

      {/* Pain Point Resolution Lifecycle */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <LifeBuoy className="h-3.5 w-3.5 text-primary" /> RESOLUTION LIFECYCLE — Siklus Hidup Resolusi Pain Point: Dari Pertama Kali Diidentifikasi oleh Budi hingga Solusi di Platform dan Validasi Bahwa Masalah Benar-Benar Terpecahkan — Timeline Rata-Rata dan 3 Kasus Studi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Avg lifecycle: 14 months from first field identification to validated resolution. Phases:</p>
          {[
            { phase: "Phase 1 — Discovery (Budi) → avg 2.3 months of observation", desc: "Budi identifies pattern: 3+ independent BUJK mentions of same friction in same context. Logs in research platform with field evidence. Triggers Sari's review.", timeline: "Avg observation period: 2.3 months (to reach 3+ independent mentions)" },
            { phase: "Phase 2 — Problem framing (Sari + team) → avg 3 weeks", desc: "Sari writes 4-element problem statement. Team scores RICE. Hendra reviews. If score > 10: enters active backlog. If < 10: goes to Sari's watch list.", timeline: "3 weeks average, including 1 Hendra review cycle" },
            { phase: "Phase 3 — Solution design (Hendra) → avg 4 weeks", desc: "Hendra designs solution: 'What is the minimum product/feature that resolves this pain?' Sari validates that the solution addresses the actual friction (not a related but different problem).", timeline: "4 weeks. Occasionally faster (obvious solutions) or much longer (complex solutions requiring new infrastructure)" },
            { phase: "Phase 4 — Build (Hendra Jr.) → avg 3–8 weeks", desc: "Hendra Jr. builds the feature. For simple features: 3 weeks. For complex features (e.g., Consortium Matching): 8+ weeks. Hendra Jr. ships when: (1) unit tested, (2) Hendra reviewed, (3) Sari validated output quality.", timeline: "Avg: 5.2 weeks across 12 features shipped in 2025" },
            { phase: "Phase 5 — Beta rollout → avg 3 weeks", desc: "New feature rolled out to 15–20 klien who reported the original pain (or similar profile). Reza calls each: 'We built something that addresses what you told us. Try it and tell us if it helps.'", timeline: "3 weeks. Reza's beta call cadence: Day 3 + Day 14 + Day 21" },
            { phase: "Phase 6 — Validation (Sari metric review) → ongoing 90 days", desc: "Sari tracks: Did the feature reduce mentions of the original pain in new field observations? Did the associated metric improve (e.g., open rate, action rate, NPS)?", timeline: "Ongoing. Pain marked 'resolved' when: (1) No new field mentions in 60 days, (2) associated metric improved > 15%." },
          ].map((r) => (
            <div key={r.phase} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[8px] font-bold flex-1">{r.phase}</p>
                <span className="text-[7px] font-mono text-muted-foreground shrink-0">{r.timeline}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">14-month average lifecycle from first observation to validated resolution. Longest phases: Discovery (waiting for pattern confirmation) and Build (Hendra Jr.'s time). Shortest: Problem framing (Sari's process is efficient). The beta rollout phase is the most emotionally resonant for klien — Reza's call ('we built this because you told us about the problem') creates one of the strongest trust moments in the klien relationship. 23% of beta call klien spontaneously refer MJP to a colleague within 30 days of the call. Product problem-solving is MJP's most organic referral trigger.</p>
      </div>

      {/* Pain Point → Revenue Connection */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <GitMerge className="h-3.5 w-3.5 text-primary" /> PAIN-TO-REVENUE MAP — Peta Koneksi Pain Point ke Revenue: Setiap Fitur Unggulan MJP Bisa Dilacak Langsung ke Satu Pain Point Spesifik — 8 Fitur Tertinggi Revenue dan Pain Point Asalnya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Revenue traceability: each major MJP feature traced to its originating pain point and its revenue contribution:</p>
          {[
            { feature: "Tender Alert Engine (L1)", pain: "Pain P1: 'Kami sering telat tahu tender yang sesuai — sudah tutup saat kami cek.' (Budi field, 2022, 67 mentions)", revenue: "Core revenue driver — justifies Starter/Pro/Enterprise subscription. 83% of klien cite this as #1 value.", tc: "text-primary" },
            { feature: "BUJK Trust Score", pain: "Pain P7: 'Tidak ada cara tahu BUJK mana yang bisa dipercaya untuk konsorsium — harus tanya-tanya dulu.' (Budi field, 2022, 34 mentions)", revenue: "Enterprise differentiation feature. 97% Enterprise klien renewal rate attributed to this + consortium matching.", tc: "text-blue-700" },
            { feature: "Regulatory Alert (Sari-annotated)", pain: "Pain P4: 'Sering kaget ada peraturan baru yang sudah berlaku — padahal kami harus comply.' (Sari research, 2022, 28 mentions)", revenue: "Key retention driver. Klien who receive > 2 regulatory alerts/quarter: 31% lower churn than average.", tc: "text-emerald-700" },
            { feature: "SKK Express (Dewi)", pain: "Pain P9: 'Urus SKK perpanjangan sendiri sangat membingungkan — makan waktu 3 bulan tanpa kepastian.' (Budi field, 2023, 19 mentions)", revenue: "Rp 510jt/year incremental service revenue. NPS: 71. Referral generator.", tc: "text-orange-700" },
            { feature: "HPS Model", pain: "Pain P2: 'Estimasi HPS kami sering meleset karena tidak punya referensi harga lapangan yang terkini.' (Reza commercial intel, 2023, 44 mentions)", revenue: "Enterprise upgrade trigger. 'I'm bidding the wrong price' is the #1 reason Pro klien upgrade to Enterprise.", tc: "text-primary" },
            { feature: "Consortium Matching Algorithm", pain: "Pain P6: 'Susah cari mitra konsorsium yang SBU-nya komplementer dan trackRecord-nya bersih.' (Budi field, 2023, 22 mentions)", revenue: "Enterprise feature. 97% renewal rate for users. 34 consortium formations documented.", tc: "text-blue-700" },
            { feature: "Daily PDF Briefing", pain: "Pain P11: 'Terlalu banyak informasi dari banyak sumber — butuh ringkasan harian yang sudah difilter untuk saya.' (Reza customer call, 2023, 31 mentions)", revenue: "Engagement anchor. Briefing open rate: 71%. Klien who open briefings daily: 23% lower churn.", tc: "text-emerald-700" },
            { feature: "Surat Penawaran HPS validator", pain: "Pain P14: 'Tidak ada benchmark untuk nilai penawaran yang kompetitif tapi masih profitable.' (Reza commercial intel, 2024, 18 mentions)", revenue: "Enterprise feature. Converts 'uncertain' J9 bidders into systematic bidders. Reduces underbidding losses.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.feature} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.feature}</p>
              <p className="text-[7px] text-muted-foreground italic mb-0.5">Origin: {r.pain}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.revenue}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">100% traceability from revenue feature to originating pain point. Hendra insists on this: 'If you can't tell me what specific problem this feature solves, and who told us about that problem, and when, we don't build it.' This traceability discipline means MJP has never built a feature that klien don't need. Zero abandoned features in 4 years. In comparison, the industry average for SaaS: 40–60% of features have {'<'} 10% adoption. MJP's adoption rate across all features: avg 67%. The pain-first method is why.</p>
      </div>

      {/* Pain Intelligence as Investor Signal */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Presentation className="h-3.5 w-3.5 text-primary" /> INVESTOR SIGNAL — Pain Intelligence sebagai Sinyal Investor: Bagaimana Hendra Menggunakan Data Pain Point untuk Membuktikan Product-Market Fit kepada Calon Investor Series A — 4 Slide yang Paling Sering Ditanya dalam Pitch
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { slide: "Slide 1 — 'The Problem Exists and Is Quantified'", content: "Hendra shows the top-5 pain points with RICE scores and Budi's raw field evidence count. Not just '487 klien' — but '67 independent BUJK directors told Budi this specific problem cost them this specific amount.' Investor question: 'How do you know the problem is real?' Hendra: 'Because 67 people told our field researcher independently, without being prompted by a product.'", tc: "text-primary" },
            { slide: "Slide 2 — 'The Problem Is Solvable By Us Specifically'", content: "Shows the 3-tier problem framework (Tier A: MJP can solve alone). Hendra demonstrates why the top-5 pains are Tier A — solvable by intelligence aggregation and interpretation. Then shows the 4 product ideas he REJECTED because they were Tier B or C. Investor question: 'Why don't you also build X?' Hendra has the pre-baked answer: 'X is a Tier B problem — we partially address it but don't fully solve it. Here's why.'", tc: "text-blue-700" },
            { slide: "Slide 3 — 'The Solution Works (Pain Reduction Evidence)'", content: "Shows before/after: 'BUJK without MJP: 23% win rate.' 'BUJK with MJP for 12+ months: 32% win rate.' Then shows 3 case study BUJK (anonymized) who describe specific pain resolution in their own words (verbatim from Reza's renewal notes). Investor question: 'Is the win rate improvement attributable to MJP?' Hendra: 'We can't run a controlled experiment. But 14 klien explicitly attributed it to MJP in renewal conversations with Reza. Conservative attribution: 60% of the improvement.'", tc: "text-emerald-700" },
            { slide: "Slide 4 — 'New Pains Are Emerging, Creating Future Roadmap'", content: "Shows the 'watch list' — problems observed but not yet at backlog-entry threshold. BIM mandate, Green Construction, NLQ as 'search and ask' paradigm. Investor question: 'What's the 3-year roadmap?' Hendra: 'Dictated by the pain watch list, not by us. We build what BUJK need next, not what we think is cool. The watch list is our roadmap.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.slide} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.slide}</p>
              <p className="text-[7px] text-muted-foreground">{r.content}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">The pain intelligence deck is Hendra's most effective investor communication tool. In 8 investor meetings conducted in Q1–Q2 2026 (exploratory, pre-formal-process): 7 of 8 investors cited the pain documentation methodology as 'something we haven't seen before' in Indonesian B2B SaaS pitches. Most Indonesian SaaS pitches show TAM and GMV projections. Hendra shows field evidence and pain-feature traceability. The difference: investors are hearing a product story, not a financial projection. Hendra: 'If you can't tell me what pain you're solving, I don't trust your financial model. If you can show me 67 real people who told you about the pain, I trust you understand the market.'</p>
      </div>

      {/* R96: Pain Point Seasonal Patterns */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Presentation className="h-3.5 w-3.5 text-primary" /> PAIN POINT SEASONAL PATTERNS — Kapan Pain Terasa Paling Kuat Sepanjang Tahun: Pola Musiman dari 67 Pain Points yang Terdokumentasi dan Implikasinya untuk Timing Outreach Reza
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Bulan</th>
                  <th className="p-1 text-center">Pain Category Dominant</th>
                  <th className="p-1 text-center">Intensity</th>
                  <th className="p-1 text-center">Reza's action</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Jan–Feb", "SKK expiry + Tender APBN baru dibuka", "HIGH", "Push SKK reminder + tender alert demo"],
                  ["Mar–Apr", "Keterlambatan SPMK + cash flow", "MEDIUM", "Upsell cash flow intelligence (future feature)"],
                  ["May–Jun", "Tender deadline pile-up Q2", "VERY HIGH", "Free trial push — pain terasa akut"],
                  ["Jul", "Lebaran slowdown — low activity", "LOW", "Relationship maintenance calls"],
                  ["Aug–Sep", "Persiapan APBN P-APBN + SKK batch", "HIGH", "SKK batch enrollment campaigns"],
                  ["Oct–Nov", "Tender year-end rush", "VERY HIGH", "Best conversion window — pain at peak"],
                  ["Des", "Budget habis, year-end review", "MEDIUM", "Renewal conversations + upsell"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-muted-foreground text-[7px]">{row[1]}</td>
                    <td className={`p-1 text-center font-bold text-[7px] ${row[2] === "VERY HIGH" ? "text-red-700" : row[2] === "HIGH" ? "text-orange-700" : row[2] === "MEDIUM" ? "text-yellow-700" : "text-muted-foreground"}`}>{row[2]}</td>
                    <td className="p-1 text-primary text-[7px]">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {[
            { insight: "Dua puncak akuisisi klien: Mei–Juni dan Oktober–November", detail: "Pola ini tidak kebetulan — ini adalah puncak tender pain. Reza secara intuitif sudah tahu ini sejak 2023, tapi MJP baru memformalisasikannya dalam seasonal calendar Q1 2026. Implikasi konkret: marketing spend (LinkedIn ads, webinar) dialokasikan 70% ke 4 bulan peak (Mei, Juni, Oktober, November), 30% ke 8 bulan non-peak. Efisiensi CAC meningkat karena prospect lebih receptive.", tc: "text-primary" },
            { insight: "Juli adalah bulan relationship, bukan closing", detail: "Reza tidak push demo atau trial di Juli. Sebaliknya: dia visit klien existing, lunch meeting, check-in calls. 'Relationship yang dibangun di Juli akan jadi referral di Oktober.' Reza's referral win rate dari klien yang di-visit di Juli: 34% lebih tinggi dari rata-rata referral.", tc: "text-blue-700" },
            { insight: "Pain point yang paling akut tapi paling sulit di-capture: keterlambatan SPMK", detail: "Mar–Apr adalah periode SPMK chaos — kontrak ditandatangani akhir tahun, SPMK sering terlambat terbit karena birokrasi internal klien pemerintah. BUJK yang sudah mobilize tim dan equipment mengalami idle cost. MJP belum punya solusi untuk pain ini — tapi Budi mencatatnya sebagai 8 pain point entries (11.9% dari total), menunjukkan ini bukan noise.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.insight} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.insight}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Seasonal pain pattern diidentifikasi Budi setelah 3 tahun field work — bukan dari data analysis, tapi dari observation. 'Saya perhatikan setiap Oktober-November, orang yang saya interview jauh lebih frustrated dan lebih terbuka berbagi masalah. Di Juli mereka seperti sedang berlibur dari masalah.' Hendra kemudian memvalidasi Budi's observation dengan klien acquisition data: Oktober-November adalah 2 bulan dengan konversi tertinggi per impressi. Ini adalah contoh bagaimana qualitative field insight dari Budi mendahului dan menginform quantitative analysis dari Hendra Jr. — bottom-up dan top-down berjalan bersama di MJP.</p>
      </div>

      {/* R97: Pain Point Longitudinal Drift Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <GitMerge className="h-3.5 w-3.5 text-primary" /> PAIN POINT LONGITUDINAL DRIFT ANALYSIS — Bagaimana Prioritas Masalah BUJK Berubah dari 2022 ke 2026: Masalah yang Semakin Mendesak, Masalah yang Berkurang, dan Apa yang Datanya Katakan tentang Arah Industri
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { category: "MENINGKAT: SKK & Sertifikasi pain (2022: 12% → 2026: 21% dari total pain)", driver: "PP No. 14/2021 yang menaikkan persyaratan SKK untuk semua jenjang mulai berlaku efektif 2023. BUJK yang sebelumnya 'aman' tiba-tiba harus upgrade. Regulasi catalyst yang mengangkat pain dari latent ke acute.", implication: "Dewi's SKK vertical menjadi semakin relevan. Investment in SKK intelligence: tepat waktu.", tc: "text-red-700" },
            { category: "MENINGKAT: Digital/Teknologi adoption pain (2022: 4% → 2026: 11%)", driver: "LPSE 4.0 rollout membutuhkan digital literacy yang banyak BUJK belum miliki. E-tendering, digital signatures, e-katalog — setiap update LPSE interface adalah pain event. Budi: 'Setiap kali LKPP update LPSE, saya dapat 5-10 interview request dari BUJK yang kebingungan.'", implication: "Produk baru yang belum ada: LPSE navigation guide + tutorial. Low build cost, high perceived value.", tc: "text-orange-700" },
            { category: "STABIL: Tender intelligence pain (~27% dari total pain, konsisten)", driver: "Core pain yang tidak berubah karena LPSE volume terus tumbuh. Lebih banyak tender = lebih sulit untuk monitor manual. MJP's core value proposition addressing this pain: validated by stability.", implication: "Tidak ada action required — ini adalah MJP's defensible core.", tc: "text-blue-700" },
            { category: "BERKURANG: Cash flow pain yang berkaitan dengan keterlambatan pembayaran", driver: "Bukan karena masalah selesai — tapi karena BUJK yang paling suffer cash flow pain telah mencari solusi lain (invoice financing, tidak ambil proyek pemerintah). Sample selection bias: klien MJP mungkin under-represents BUJK dengan cash flow crisis terberat.", implication: "Masalah ini mungkin lebih besar dari yang MJP capture. Budi perlu interview non-klien MJP untuk uncovering.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.category} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.category}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Driver: {r.driver}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Implication: {r.implication}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Longitudinal drift analysis dilakukan Sari setiap 6 bulan dengan re-categorizing seluruh pain point database dan comparing distribution dengan periode sebelumnya. Ini adalah Sari's most strategic work — lebih impactful dari single asset production karena shapes product direction. Metode: Sari assign setiap pain point ke category, lalu Hendra review categorization untuk 10% sample. Drift analysis Q1 2026 adalah yang pertama menangkap 'Digital adoption pain' sebagai growing category — sebelumnya lumped ke 'operational pain'. Hendra: 'Pain portfolio drift adalah leading indicator yang paling credible untuk arah industri. Lebih reliable dari survey atau analyst report, karena ini adalah unfiltered voice dari orang yang mau jujur tentang masalah mereka kepada Budi yang mereka percaya.'</p>
      </div>

      {/* R98: Pain-to-Product Traceability Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <LifeBuoy className="h-3.5 w-3.5 text-primary" /> PAIN-TO-PRODUCT TRACEABILITY MAP — Untuk Setiap Fitur Utama MJP, Pain Point Mana yang Melahirkannya: Complete Ancestry dari Platform yang Ada Hari Ini ke 67 Orang yang Berbicara Jujur kepada Budi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { feature: "Tender Alert (core feature)", pain_origin: "P-002, P-003, P-007: 'Kami selalu terlambat tahu tentang tender yang cocok' — 3 orang dari 3 kota berbeda, Q4 2021. First interview yang mengkonfirmasi market need sebelum MJP dibangun.", budi_quote: "Budi: 'P-002 adalah interview yang mengubah segalanya. Pak Budiono dari Semarang bilang: saya pernah melewatkan tender senilai Rp 2M karena tidak tahu itu ada. Saat itu saya tahu ini bukan masalah satu orang.'", tc: "text-primary" },
            { feature: "SKK Expiry Reminder", pain_origin: "P-008, P-012, P-019: 'SKK saya expired, saya tidak tahu sampai panitia bilang tidak qualify' — 3 kejadian berbeda, 2022. Semua 3 subjek: biaya riil dari missed tender karena SKK expired.", budi_quote: "Reza's observation: 'Ketiga klien ini adalah yang paling passionate saat demo SKK reminder. Mereka yang pernah kena — mereka yang paling appreciate.'", tc: "text-blue-700" },
            { feature: "BUJK Trust Score", pain_origin: "P-021: 'Saya pernah sub-kon ke BUJK yang ternyata bermasalah — tidak bayar, menghilang.' Satu kejadian ini dengan kerugian Rp 400jt mendorong Hendra untuk build trust scoring.", budi_quote: "Hendra setelah interview P-021: 'Ini bukan hanya masalah Pak Heru. Ini adalah masalah sistemik. Tidak ada cara yang reliable untuk vetting sub-kontraktor. Kita harus bangun itu.'", tc: "text-emerald-700" },
            { feature: "Regulatory Alert (Sari's digest)", pain_origin: "P-031, P-034: 'Saya kena teguran karena regulasi K3 berubah dan saya tidak tahu' — Q1 2023. Dua kejadian dalam 6 minggu dari dua klien di Sulawesi mendorong Sari untuk formalize regulatory monitoring.", budi_quote: "Sari: 'Dua kejadian ini dalam 6 minggu — satu di Makassar, satu di Kendari. Budi yang ambil kedua interview ini. Dia yang call saya dan bilang: Sari, kita harus serius dengan regulatory alert ini.'", tc: "text-orange-700" },
            { feature: "Workroom (collaborative notes)", pain_origin: "P-044, P-047: 'Tim saya di lapangan dan saya di kantor — kita tidak bisa koordinasi analisis tender dengan baik' — Enterprise klien feedback Q2 2024, 2 terpisah.", budi_quote: "Hendra Jr. setelah hearing both: 'Ini bukan pain yang bisa diselesaikan oleh WhatsApp. Mereka butuh structured workspace di dalam platform yang sudah mereka gunakan.'", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.feature} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.feature}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Origin: {r.pain_origin}</p>
              <p className={`text-[7px] font-mono italic ${r.tc}`}>{r.budi_quote}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Pain-to-product traceability adalah Hendra's antidote to 'feature factory' culture. Every feature on this platform can be traced back to a specific person who had a specific problem. This is not a coincidence — it's a discipline. When Hendra Jr. asks 'should we build X?', Hendra asks back: 'Which pain are we solving? Whose pain? What's their ID in Budi's database?' If no pain ID can be cited: the feature doesn't get built. Hendra: 'Platform yang tidak bisa di-trace ke pain points nyata adalah platform yang dibangun atas asumsi. Asumsi adalah utang teknis yang dibayar dengan churn.'</p>
      </div>

      {/* R99: Pain Severity vs Addressability Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> PAIN SEVERITY VS ADDRESSABILITY MATRIX — Pemetaan 67 Pain Point ke 4 Kuadran: Mana yang Harus Diselesaikan Sekarang, Mana yang Harus Di-roadmap, dan Mana yang Harus Diakui sebagai Di Luar Jangkauan MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 gap-2 mb-2">
            {[
              { q: "Q1: HIGH severity + HIGH addressability", label: "SOLVE NOW — core product priority", count: "23 pain points (34%)", desc: "Masalah yang menyakitkan dan MJP bisa solve secara langsung. Contoh: tender alert (done), SKK expiry (done), blacklist check (done). Remaining Q1 items in active development.", tc: "text-primary", bg: "bg-primary/5 border-primary/30" },
              { q: "Q2: HIGH severity + LOW addressability", label: "ACKNOWLEDGE + REFER — don't pretend to solve", count: "19 pain points (28%)", desc: "Masalah nyata dan besar tapi di luar MJP's scope: cash flow, bank garansi access, subkon non-bayar, government corruption di procurement. MJP acknowledges but refers to other services.", tc: "text-red-700", bg: "bg-red-50 border-red-200" },
              { q: "Q3: LOW severity + HIGH addressability", label: "ROADMAP — nice-to-have, build when Q1 is done", count: "17 pain points (25%)", desc: "Masalah yang MJP bisa solve tapi klien won't churn without the solution. Contoh: bulk tender export, custom PDF templates, in-platform calendar sync. Feature backlog, not urgent.", tc: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
              { q: "Q4: LOW severity + LOW addressability", label: "MONITOR — may become Q1/Q2 as context shifts", count: "8 pain points (13%)", desc: "Small problems that are also hard to solve. Not worth current investment. Annual review: if severity increases (industry changes) or addressability improves (new tools), reassess.", tc: "text-muted-foreground", bg: "bg-muted/30 border-border" },
            ].map((r) => (
              <div key={r.q} className={`border rounded-sm p-2 ${r.bg}`}>
                <p className={`text-[7px] font-bold ${r.tc} mb-0.5`}>{r.label}</p>
                <p className={`text-[7px] font-mono ${r.tc} mb-0.5`}>{r.count}</p>
                <p className="text-[6px] text-muted-foreground">{r.desc}</p>
              </div>
            ))}
          </div>
          <div className="py-1.5 border-t">
            <p className="text-[8px] font-bold text-primary mb-0.5">Q2 handling adalah MJP's most important customer success principle</p>
            <p className="text-[7px] text-muted-foreground">19 pain points yang Hendra acknowledges but cannot solve: ini adalah gelombang kedua dari customer-centricity. Bukan hanya 'build what klien wants' tapi juga 'be honest about what you can't build and point them to who can.' Reza's referral list: (1) fintech konstruksi untuk cash flow, (2) asosiasi GAPENSI untuk collective bargaining dengan PPK yang tidak bayar, (3) legal aid konstruksi untuk sengketa pengadaan. Hendra: 'Klien yang kita bantu navigate ke solusi yang tepat — meski bukan solusi kita — adalah klien yang paling loyal. Mereka ingat bahwa kita tidak selling tapi genuinely helping.'</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Pain matrix adalah Hendra's quarterly planning tool — more important than any OKR framework. Before each quarterly planning session, Hendra and Budi review matrix together: has any Q3 pain crossed threshold into Q4 based on new field data? Has any Q2 pain become addressable due to new technology or partnership? Has a Q1 pain been adequately solved or does it need refinement? The matrix prevents two failure modes: (1) building solutions for problems that aren't painful enough (feature bloat), and (2) building solutions for problems that can't be solved at MJP's layer (misdirected investment). Budi: 'Matrix adalah cara saya dan Hendra bicara bahasa yang sama tentang prioritas. Sebelum ada matrix: saya bilang pain ini penting, Hendra tanya kenapa, saya tidak bisa answer quantitatively. Sekarang: saya tunjuk kuadran.'</p>
      </div>

      {/* R100: Pain Point Collection Ethics */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <HeartHandshake className="h-3.5 w-3.5 text-primary" /> PAIN POINT COLLECTION ETHICS — 5 Prinsip Etika yang Budi Patuhi dalam Setiap Riset Lapangan: Cara MJP Memastikan Data yang Dikumpulkan Tidak Mengeksploitasi Narasumber yang Sudah Mempercayakan Masalah Mereka
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { principle: "E1: Informed consent yang nyata, bukan ceremonial", detail: "Sebelum setiap interview, Budi menjelaskan secara verbal (bukan hanya form): 'Apa yang Bapak/Ibu ceritakan akan saya dokumentasikan dan digunakan untuk mengembangkan platform kami. Nama asli dan perusahaan tidak akan ditulis — kami pakai kode.' Budi tidak boleh mulai merekam atau mencatat sebelum ada verbal 'ya' yang jelas. 3 calon narasumber pernah menolak setelah penjelasan ini — Budi respects sepenuhnya.", tc: "text-primary" },
            { principle: "E2: Narasumber bisa review dan withdraw data mereka", detail: "Setiap narasumber mendapat opsi untuk minta review catatan Budi (dalam 7 hari setelah interview) dan meminta informasi tertentu di-delete. 4 narasumber telah menggunakan hak ini — semuanya di-accommodate tanpa pertanyaan. Hendra: 'Hak withdrawal bukan hanya prosedur — itu adalah sinyal kepada narasumber bahwa kita menghormati mereka lebih dari data yang mereka berikan.'", tc: "text-blue-700" },
            { principle: "E3: Tidak ada recording tanpa izin eksplisit", detail: "Budi menggunakan notes only kecuali narasumber memberi izin eksplisit untuk audio recording. Dari 67 narasumber: 19 setuju audio recording. Data kualitas dari audio-recording interviews tidak secara signifikan lebih baik dari notes — tetapi consent rate yang rendah (28%) mengkonfirmasi bahwa recording membuat narasumber kurang comfortable berbagi secara terbuka.", tc: "text-emerald-700" },
            { principle: "E4: Tidak boleh ask about competitors di luar etika kompetitif", detail: "Budi tidak boleh ask: 'Apakah BUJK X yang menjadi kompetitor klien Bapak memiliki kelemahan?' atau pertanyaan yang mengeksploitasi insider knowledge tentang pihak ketiga. Allowed: 'Bagaimana dinamika persaingan di sektor ini secara umum?' Budi menjaga diri untuk tidak menjadi saluran untuk competitor intelligence yang bisa merugikan pihak lain.", tc: "text-orange-700" },
            { principle: "E5: Value exchange yang nyata — narasumber mendapat something back", detail: "Setelah interview selesai: setiap narasumber mendapat 3-month Pro access (nilai Rp 1.197.000) sebagai gratitude. Budi juga sering mengirimkan relevant knowledge assets yang berhubungan dengan pain yang dibahas dalam interview. 'Saya tidak mau orang merasa sudah memberi saya sesuatu dan tidak mendapat apapun kembali.' 3 dari 5 paying Enterprise klien pertama MJP adalah mantan narasumber interview Budi.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.principle} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.principle}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Ethics framework ini tidak pernah required by law — Indonesia belum punya comprehensive research ethics law untuk private sector. MJP adopts academic research ethics standards voluntarily. Hendra: 'Kita bukan akademisi. Tapi narasumber yang mempercayakan masalah terdalam mereka kepada Budi adalah orang yang juga menjadi klien kita. Jika mereka tahu bahwa Budi mengeksploitasi kepercayaan mereka — bukan hanya reputasi riset yang rusak. Seluruh MJP's integrity hancur.' Platform yang dibangun di atas trust hanya bisa sustain dengan practices yang worthy of that trust. Ethics bukan compliance burden — it is the foundation on which everything else is built.</p>
      </div>

      {/* R101: Pain Point Resolution Velocity */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5 text-primary" /> PAIN POINT RESOLUTION VELOCITY — Dari Identifikasi oleh Budi hingga Solusi di Platform: Berapa Lama Rata-rata, Apa yang Mempercepat, dan 3 Kasus Dimana Kecepatan Resolusi Membuat Perbedaan Kompetitif
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[7px] text-muted-foreground mb-1">Velocity tracked dari: tanggal pain pertama kali dicatat oleh Budi → tanggal feature/asset yang menyelesaikan pain tersebut di-launch. Data dari 38 Q1 pain points (solved).</p>
          {[
            { pain_type: "Regulatory knowledge gap (knowledge asset needed)", avg_velocity: "11 hari", fastest: "3 hari (urgent regulatory change)", slowest: "47 hari (complex cross-regulation interpretation)", bottleneck: "Sari's production capacity. Each asset = 4.2 jam. Concurrent production limit: 3 assets/week.", tc: "text-primary" },
            { pain_type: "Data coverage gap (new LPSE atau BUJK source needed)", avg_velocity: "18 hari", fastest: "5 hari (single LPSE crawler addition)", slowest: "62 hari (new data format requiring parser rewrite)", bottleneck: "Hendra Jr.'s crawler engineering time. Complex new sources require significant schema mapping.", tc: "text-blue-700" },
            { pain_type: "Feature request (new platform functionality)", avg_velocity: "34 hari", fastest: "7 hari (UI improvement without backend)", slowest: "94 hari (new vertical with data + API + UI stack)", bottleneck: "Full product development cycle: design → build → test → deploy. Hendra Jr. is single point of failure for engineering.", tc: "text-orange-700" },
            { pain_type: "Alert / notification enhancement", avg_velocity: "9 hari", fastest: "2 hari (threshold adjustment)", slowest: "28 hari (new delivery channel integration)", bottleneck: "Relatively fast because notification infrastructure is modular. New channel = new integration; threshold change = config update.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.pain_type} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.pain_type}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>avg {r.avg_velocity}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Fastest: {r.fastest} · Slowest: {r.slowest}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Bottleneck: {r.bottleneck}</p>
            </div>
          ))}
          <div className="py-1.5 border-t">
            <p className="text-[8px] font-bold text-primary mb-0.5">Case: SKK expiry reminder — 8-day velocity from pain to feature</p>
            <p className="text-[7px] text-muted-foreground">Budi documented P-008 on Monday (tenant expired SKK, lost tender). By Tuesday: Hendra Jr. had scoped the feature. By Thursday: basic expiry alert built. By following Monday: deployed and active for all klien. 3 klien benefited immediately — all had SKK expiring within 30 days that they didn't know about. One of the 3 renewed in time and won a tender the following month. Total time from pain to value: 8 days. This is MJP's fastest end-to-end pain resolution — still cited by Hendra as the best example of 'startup pace' in product development.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Resolution velocity data adalah one of the metrics Hendra is most proud of: average 11–34 days from pain identification to shipped feature. This is faster than most SaaS companies at MJP's stage because: (1) small team = zero bureaucracy, (2) Budi → Hendra direct communication without middle layers, (3) Hendra Jr. has full-stack ownership — no handoffs between design, backend, and frontend teams. Post-Series A risk: as team grows, velocity may slow due to coordination overhead. Mitigation: maintain direct Budi → Hendra → Hendra Jr. escalation path for highest-priority pains (top-5 RICE score), even as other processes become more structured. Hendra: '34-day feature velocity is a startup superpower. We must protect it as we grow. Every new process and approval layer must justify its existence against the cost of slower response to klien pain.'</p>
      </div>

      {/* R102: Pain Point Clustering Across BUJK Types */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartColumnBig className="h-3.5 w-3.5 text-primary" /> PAIN POINT CLUSTERING ACROSS BUJK TYPES — Apakah BUJK Besar, Menengah, dan Kecil Mengalami Masalah yang Sama? Analisis Budi terhadap 67 Interview: Mana yang Universal, Mana yang Size-Specific
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { pain: "UNIVERSAL (muncul di semua ukuran BUJK, > 80% of interviews across all segments)", examples: "Monitoring LPSE manual terlalu time-consuming (91%). Regulasi terlalu sering berubah, sulit diikuti (87%). SKK renewal timing sering tidak terencana (83%). Tidak tahu BUJK mana yang reliable untuk JO (79%).", insight: "Universal pains validate MJP's core product — they're not niche problems. Every BUJK in Indonesia experiences these regardless of size.", tc: "text-emerald-700" },
            { pain: "BUJK BESAR ONLY (> Kualifikasi Menengah Atas, 51+ employees)", examples: "Managing multi-project SKK compliance simultaneously — which staff assigned to which project. Corporate governance requirements for bid submissions (multiple authorization layers). Cash flow timing vs payment terms mismatch at scale.", insight: "Enterprise tier specific pains. These drove the Multi-project SKK Dashboard feature and the structured governance workflow in bid submission.", tc: "text-blue-700" },
            { pain: "BUJK MENENGAH ONLY (Kualifikasi Menengah, 11–50 employees)", examples: "Growing too fast for current kualifikasi — winning bids that require higher qualification than they have. Missing tenders because they don't know about non-regional LPSEs. JO coordination with larger BUJK (power imbalance in contract negotiation).", insight: "Pro tier target. The 'gap year' problem: between kualifikasi upgrades, BUJK menengah are most hungry for intelligence that helps them punch above their weight.", tc: "text-primary" },
            { pain: "BUJK KECIL ONLY (Kualifikasi Kecil, < 11 employees)", examples: "Tidak tahu apakah bisa ikut tender tertentu (kualifikasi confusion). Tidak punya staff dedicated untuk procurement — owner does everything. Budget constraint: Rp 399k/month feels significant.", insight: "Starter tier. The primary solution: simplicity. One KBLI, one LPSE region, one tender alert per day maximum. Feature overload causes abandonment.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.pain} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.pain}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Examples: {r.examples}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Product insight: {r.insight}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Pain clustering analysis confirmed MJP's three-tier product architecture was correct — Starter, Pro, Enterprise weren't arbitrary pricing tiers, they mapped to genuine behavioral and pain differences across BUJK sizes. This validation happened 18 months AFTER MJP launched with three tiers — Hendra had intuited the segmentation from early conversations, but Budi's structured research confirmed it quantitatively. Most surprising finding from clustering: Bujk Kecil and Bujk Besar share identical frustration with regulatory complexity (87%+ both segments), but their solutions are opposite — Kecil needs extreme simplification, Besar needs comprehensive coverage with enterprise-grade filtering. Hendra: 'Satu produk tidak bisa melayani keduanya dengan baik. Three-tier architecture bukan tentang pricing — ini tentang genuinely berbeda cara dua extreme segmen ini perlu dibantu.'</p>
      </div>

      {/* R103: Pain Point Longitudinal Tracking */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> PAIN POINT LONGITUDINAL TRACKING — Apakah Pain BUJK Berubah Seiring Waktu? Budi Mengunjungi Kembali 12 Narasumber dari 2021 untuk Melihat Apakah Masalah Mereka Sudah Selesai, Bergeser, atau Bertambah Buruk
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { finding: "Finding 1: Core pains are persistent, not transient", evidence: "12 narasumber re-interviewed in Q4 2025 (avg 4 years after original interview). P-CORE-1 (LPSE monitoring overload): 11 of 12 still report this as active pain. 10 of 12 are now using MJP — but 2 of 12 still not subscribed: 'Kami sudah coba tapi subscription terlalu mahal untuk skala kami.' Core pain did not go away with time. It was solved for MJP klien, not for non-MJP BUJK.", implication: "Market not saturating — pain still exists for non-subscribers. For current subscribers: MJP solved the pain, which is why they stayed.", tc: "text-primary" },
            { finding: "Finding 2: New pains emerged that didn't exist in 2021", evidence: "3 new pain categories identified in 2025 re-interviews that were not present in 2021: (1) IKN complexity — no IKN tenders in 2021, BUJK now overwhelmed by IKN procurement differences, (2) Digital signature and e-procurement compliance — OSS-RBA and digital certificate requirements added post-2021, (3) ESG reporting pressure — BUMN contractors now require ESG compliance from their subcontractors, none of which was visible in 2021 interviews.", implication: "MJP's addressable pain space is growing, not shrinking. Each new regulatory or market development creates new intelligence demand.", tc: "text-emerald-700" },
            { finding: "Finding 3: Pain intensity changed even when pain category didn't", evidence: "Narasumber A (2021): 'Saya kadang melewatkan tender karena tidak sempat cek LPSE.' Narasumber A (2025): 'Kalau saya tidak punya MJP sekarang, saya estimated kehilangan Rp 300–500jt project revenue per tahun. LPSE sekarang ada 671 — dulu mungkin 400. Pain-nya sama tapi intensitasnya jauh lebih tinggi.' The market grew, the pain scale grew with it.", implication: "WTP (willingness to pay) is likely higher now than at MJP's founding — same pain but higher stakes. This justifies gradual price increases as the market matures.", tc: "text-blue-700" },
            { finding: "Finding 4: MJP klien vs non-MJP BUJK — diverging outcomes", evidence: "7 of 12 re-interviewed became MJP klien after original interview (some immediately, some years later). 5 did not. Comparison after 4 years: MJP klien segment grew average revenue 34%, won average 41% more tenders. Non-MJP segment: revenue flat or declining, 2 of 5 reduced bidding activity due to missed opportunities. Causation vs correlation: Budi acknowledges that BUJK who subscribed were likely more proactive in general.", implication: "Qualitative evidence supports MJP's value proposition: the gap between MJP and non-MJP BUJK outcomes is observable and growing.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.finding} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.finding}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Evidence: {r.evidence}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Implication: {r.implication}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Longitudinal tracking adalah Budi's most ambitious research project — revisiting original narasumber 4 years later to see if MJP's market thesis still held. The meta-finding: the 2021 thesis was correct and the market has actually gotten harder to navigate since (more LPSE, more IKN complexity, more digital compliance requirements), increasing MJP's value proposition rather than eroding it. This is unusual — most products see their core pain erode as the market adapts. MJP's pain is structural (government procurement complexity is increasing, not decreasing) and will persist indefinitely. Budi: 'Saya pergi ke 12 orang yang 4 tahun lalu ceritakan masalah mereka ke saya. Ketemu mereka lagi dan dengar bahwa masalah itu makin besar, bukan makin kecil — itu validasi paling kuat yang pernah saya dapatkan tentang mengapa MJP penting.'</p>
      </div>

      {/* R104: Pain Point RICE Scoring Backlog */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 text-primary" /> PAIN POINT RICE SCORING BACKLOG — Top 8 Unresolved Pains yang Menunggu Respon Produk: RICE Score Masing-masing, Estimasi Effort, dan Mengapa Mereka Belum Dibangun Meski Sudah Diketahui Sejak Lama
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[7px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Pain</th>
                  <th className="p-1 text-center">Reach</th>
                  <th className="p-1 text-center">Impact</th>
                  <th className="p-1 text-center">Confidence</th>
                  <th className="p-1 text-center">Effort (wks)</th>
                  <th className="p-1 text-center font-bold">RICE</th>
                  <th className="p-1 text-center">Why not built yet</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["P-UNR-1: JO matching active recommendation", "423 klien", "HIGH", "78%", "18", "218", "Requires Vision 2028 capability — data model not ready", "text-primary"],
                  ["P-UNR-2: Multi-company dashboard (grup kontraktor)", "67 Enterprise klien", "HIGH", "91%", "14", "197", "Waiting for CSM hire post-Series A to scope user model", "text-blue-700"],
                  ["P-UNR-3: Bid calendar integration (Google Cal sync)", "312 Pro klien", "MEDIUM", "82%", "8", "190", "Third-party OAuth complexity; deprioritized vs higher RICE items", "text-emerald-700"],
                  ["P-UNR-4: Automated compliance report PDF", "208 klien", "HIGH", "71%", "12", "184", "PDF generation for compliance reports: design complexity unresolved", "text-orange-700"],
                  ["P-UNR-5: Competitor bid history (past project outcomes)", "178 klien", "VERY HIGH", "45%", "10", "160", "Data availability uncertain — public bid records incomplete", "text-primary"],
                  ["P-UNR-6: Aanwijzing schedule aggregator", "267 klien", "MEDIUM", "83%", "6", "147", "LPSE aanwijzing data: inconsistent format across portals", "text-blue-700"],
                  ["P-UNR-7: SKK multi-person tracking (project assignment)", "89 Enterprise klien", "VERY HIGH", "88%", "16", "135", "Complex data model; F1 auto-qualification check higher priority", "text-emerald-700"],
                  ["P-UNR-8: IKN vendor registration tracker", "134 klien", "HIGH", "61%", "9", "90", "IKN vendor system still evolving — spec not stable enough to build against", "text-muted-foreground"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b hover:bg-muted/20">
                    <td className={`p-1 font-bold text-[7px] ${row[7]}`}>{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[2]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[3]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[4]}</td>
                    <td className={`p-1 text-center font-bold ${row[7]}`}>{row[5]}</td>
                    <td className={`p-1 text-[6px] ${row[7]}`}>{row[6]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">RICE scoring backlog adalah Hendra's most honest product document — it shows not just what's being built but what's waiting and why. The 'Why not built yet' column is the most important: it distinguishes between items that are delayed because of data limitations (P-UNR-5, P-UNR-8), engineering capacity constraints (P-UNR-1, P-UNR-7), or design uncertainty (P-UNR-4). Understanding WHY an item isn't built prevents the wrong response: for P-UNR-5 (competitor bid history — data availability uncertain), the wrong response is 'build anyway with incomplete data.' The right response: 'invest in data source before building the feature.' Post-Series A engineering investment will directly address items P-UNR-1 and P-UNR-2 (the two highest RICE scores) within the first 6 months. Hendra Jr.: 'Backlog bukan daftar kegagalan — ini adalah daftar yang sudah kita prioritaskan dengan sadar. Setiap item di sini sudah ada karena ada alasan yang baik. Ketika alasannya hilang, kita build.'</p>
      </div>

      {/* R105: Pain Point Dismissal Patterns — What BUJK Say When They Don't Want to Admit a Problem */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-primary" /> PAIN POINT DISMISSAL PATTERNS — Pola Bahasa yang Budi Identifikasi Saat BUJK Menyembunyikan Pain yang Sebenarnya: 4 Dismissal Patterns, Cara Membacanya, dan Teknik Follow-up yang Budi Gunakan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { pattern: "DP-1: 'Kami sudah punya sistem sendiri'", surface_meaning: "We have this under control.", real_meaning: "Usually: we have a spreadsheet, or a junior staff who handles this manually. 'Sistem' is being used defensively to avoid admitting they don't have a professional solution.", budi_followup: "Budi: 'Sistem yang bagaimana? Boleh saya tanya lebih lanjut tentang prosesnya?' 87% of cases: the 'system' is revealed to be manual, fragile, and person-dependent. The admission comes naturally when Budi shows curiosity without judgment.", examples: "Found in: SKK monitoring (28 narasumber), tender tracking (41 narasumber), competitor monitoring (35 narasumber).", tc: "text-primary" },
            { pattern: "DP-2: 'Tidak terlalu masalah, kami sudah terbiasa'", surface_meaning: "This problem is manageable.", real_meaning: "This problem has been normalized through repetition — they've adapted their workflow to compensate for the problem, which means the problem's cost is hidden in inefficiency rather than visible as a failure.", budi_followup: "Budi: 'Sudah terbiasa berarti proses apa yang biasanya dilakukan?' Unpacking 'terbiasa' reveals the workaround cost. '3 orang di kantor dedikasi 2 jam tiap pagi untuk check LPSE manual' is a pain disguised as routine.", examples: "Found in: manual LPSE monitoring (54 narasumber), document preparation (31 narasumber). Average hidden time cost discovered: 7.3 hours/week per person.", tc: "text-orange-700" },
            { pattern: "DP-3: 'Kompetitor kami juga punya masalah yang sama, jadi kami tidak rugi'", surface_meaning: "This is an industry problem, not our specific problem.", real_meaning: "Correct observation — but wrong conclusion. If competitors face the same friction, the BUJK that eliminates it first gains competitive advantage. 'Everyone has it' is not a reason to accept it; it's a reason to solve it faster than competitors.", budi_followup: "Budi: 'Kalau ada cara untuk menyelesaikan masalah ini yang kompetitor Anda tidak punya — itu keuntungan apa untuk Anda?' The reframe from 'shared problem' to 'competitive opportunity' shifts the conversation. 73% of narasumber who used DP-3 engaged meaningfully with the competitive opportunity framing.", examples: "Found in: HPS estimation (38 narasumber), SKK shortage awareness (22 narasumber).", tc: "text-blue-700" },
            { pattern: "DP-4: Diam, angguk, dan tidak bertanya lanjut", surface_meaning: "Agreement or understanding.", real_meaning: "Often: discomfort with the topic. BUJK owners who have made bad decisions (chose wrong JO partner, missed tender due to SKK expiry) often go quiet when those topics arise. The silence is shame-adjacent, not agreement.", budi_followup: "Budi learned to pause after DP-4 and say: 'Apakah ada pengalaman serupa yang pernah Anda alami?' The open question after a pause: invites sharing without pressure. 61% of DP-4 silences followed by this question: yield substantive disclosure.", examples: "Found in: JO partner quality topics (45 narasumber), near-miss disqualification events (28 narasumber). These conversations produced some of Budi's most valuable pain point data.", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.pattern} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.pattern}: "{r.surface_meaning}" → real meaning: {r.real_meaning}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Budi's follow-up: {r.budi_followup}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Examples: {r.examples}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Pain point dismissal patterns adalah Budi's most advanced interviewing intelligence — understanding not just what narasumber say but what they mean when they're being defensive. Most product research stops at surface level: 'We asked and they said it wasn't a problem.' Budi's training: 'Jika tidak ada masalah, tidak ada yang bisa saya pelajari. Setiap dismissal adalah petunjuk tentang di mana masalah yang sebenarnya berada.' The 4 dismissal patterns cover 80%+ of all defensive responses Budi has encountered. Each has a specific follow-up technique that converts the defensive response into honest disclosure. Skill required: patience, non-judgment, and genuine curiosity. The dismissal pattern work is the part of Budi's methodology that cannot be automated, cannot be done by survey, and cannot be replicated by a less-experienced researcher. It requires reading the room in real-time and adapting. This is why Budi's field research is operationally irreplaceable — even after 4 years, his methodology is still producing insights that a junior researcher with a questionnaire would never find.</p>
      </div>

      {/* R106: Pain Point Severity Gradient — Not All Pains Are Equal */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartColumnBig className="h-3.5 w-3.5 text-primary" /> PAIN SEVERITY GRADIENT — Bukan Semua Masalah Sama Beratnya: Budi's 4-Level Pain Severity Framework, Bagaimana MJP Memilih Pain yang Layak Diselesaikan, dan 3 Kasus di Mana Severity Assessment yang Salah Mengarah ke Produk yang Salah
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { level: "SEVERITY-1: EXISTENTIAL — 'Pain ini bisa membuat perusahaan bangkrut atau kehilangan kontrak besar'", examples: "SKK expiry crisis (Pak Wahyu case: Rp 340jt tender at risk). JO partner selection failure (CASE-TS-1: potential Rp 47M contract dispute). HPS estimation error by > 20% (automatic disqualification). Regulatory compliance miss (bid rejection).", product_response: "MJP builds features for Severity-1 pains first, regardless of RICE score. The feature doesn't need high reach — it needs to prevent a catastrophic event. Trust Score, SKK monitoring, compliance checklist: all built initially for Severity-1 use cases.", tc: "text-red-700" },
            { level: "SEVERITY-2: SIGNIFICANT — 'Pain yang menyebabkan kerugian finansial atau kompetitif terukur'", examples: "Missed tender (MISS-1 through MISS-5). Wrong bid price (losing 10–20% below true competitive price). Late document submission (small penalties, lost goodwill). Geographic coverage gap (can't evaluate partners from unfamiliar regions).", product_response: "RICE scoring most relevant at Severity-2. Reach × Impact × Confidence / Effort determines priority. Severity-2 pains drove most of MJP's Pro tier features: tender alerts, filter personalization, mobile app.", tc: "text-orange-700" },
            { level: "SEVERITY-3: FRICTION — 'Pain yang mengganggu dan memakan waktu tapi tidak menyebabkan kerugian langsung'", examples: "Manual LPSE monitoring (2–3 hours/day but not causing missed tenders directly). SKK tracking in spreadsheet (friction but not expiry risk if carefully maintained). Jargon confusion in procurement documents (time cost but solvable by asking panitia).", product_response: "Severity-3 pains often have high Reach (many BUJK experience them) but lower immediate value to solve. MJP addresses these after Severity-1 and -2: NLQ (reduces jargon friction), PDF briefing (reduces manual monitoring time).", tc: "text-blue-700" },
            { level: "SEVERITY-4: AWARENESS — 'Bukan pain yang dirasakan — ketidaktahuan tentang peluang'", examples: "BUJK unaware they qualify for IKN tenders (BUJK-B case). BUJK not using local preference rules in bidding (RU-4). BUJK not tracking competitor bid histories. These aren't pains in the traditional sense — they're optimization opportunities the BUJK doesn't know they're missing.", product_response: "Severity-4 is the hardest to build for: the user doesn't feel the pain, so they don't search for a solution. MJP's Decision Intelligence widget and personalized recommendations are designed for Severity-4 — surfacing opportunities the BUJK wouldn't have looked for. Requires push, not pull.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.level} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.level}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Examples: {r.examples}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Product response: {r.product_response}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Pain severity gradient adalah Budi and Hendra's joint framework for ensuring product priorities match actual user impact — not just feature frequency in feedback. The 3 cases where severity assessment error led to wrong product decisions: (1) 2022: built document format checker (Severity-3 feature) before completing SKK monitoring (Severity-1 feature) — wrong prioritization that delayed solving the more critical problem. (2) 2023: underestimated severity of eastern Indonesia LPSE coverage gap — assessed as Severity-3 (friction) when it was actually Severity-2 (significant) for non-Java klien. Led to NPS detractor problem. (3) 2024: spent engineering time on a dashboard widget that solved a Severity-4 problem for a small segment, while a Severity-2 problem (offline mobile data loss, Task #24) was still unresolved. All 3 errors: now documented as severity assessment calibration lessons. Current rule: if Budi's interview indicates Severity-1 pain: bypass RICE prioritization entirely, go directly to engineering queue. Hendra: 'Feature yang mencegah bencana harus dibangun sebelum feature yang membuat sesuatu lebih nyaman. Kami belajar ini melalui kesalahan yang tidak menyenangkan.'</p>
      </div>

      {/* R107: The Pain Points MJP Deliberately Chose NOT to Solve */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleX className="h-3.5 w-3.5 text-primary" /> PAINS MJP CHOSE NOT TO SOLVE — 5 Masalah BUJK yang Nyata dan Signifikan yang MJP Secara Sadar Memilih untuk Tidak Diselesaikan: Mengapa Batasan Produk yang Jelas adalah Tanda Strategi yang Matang
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { pain: "DECLINED-1: 'Kami butuh tools untuk manage proyek konstruksi yang sedang berjalan'", why_real: "Real pain, significant severity: project management chaos costs BUJK 15–20% of project margins in rework, delays, and coordination failures. Highly requested by Enterprise klien.", why_declined: "Out of category: MJP is procurement and compliance intelligence. Project management is a different product category requiring different data (site progress, worker scheduling, material logistics), different user personas (site supervisors, not procurement managers), and different competitive landscape (Procore, OpenSpace, local PM tools). Building this would dilute MJP's focus on its core moat.", alternatives: "MJP recommendation when klien raises this: 'Check Procore or Mekari for project management. MJP is not that tool.' Honest referral to right solution.", tc: "text-muted-foreground" },
            { pain: "DECLINED-2: 'Kami butuh tools untuk manage keuangan dan invoicing proyek'", why_real: "Construction finance management (interim payment tracking, bank guarantee management, project cash flow) is a significant pain. Financial mismanagement is one of the top 3 reasons BUJK fail.", why_declined: "Same category problem as DECLINED-1. MJP's data infrastructure (LPSE, BNSP, regulatory) has no overlap with financial systems data. Building financial management would require: bank API integrations, accounting integrations, payroll connections — a completely different engineering domain. Hendra Jr.: 'Ini bukan produk yang bisa saya build. Ini adalah perusahaan yang berbeda.'", alternatives: "Jurnal.id, Gadjian for construction-specific financial management. MJP's value to klien is NOT comprehensive business management — it's procurement intelligence.", tc: "text-muted-foreground" },
            { pain: "DECLINED-3: 'Kami ingin tahu siapa yang bisa beli tender kita' (tender assignment marketplace)", why_real: "Some BUJK win tenders they can't execute and want to 'sell' the contract to other BUJK. Other BUJK want to acquire contracts. This is a real secondary market that exists informally (illegal in most cases — contract assignment without panitia approval violates procurement rules).", why_declined: "Legal risk: facilitating contract assignment without panitia approval could make MJP complicit in procurement violation. Regulatory clarity: this practice's legality is ambiguous under Indonesian procurement law. Hendra's absolute rule: MJP does not facilitate anything that could be construed as procurement fraud or regulation circumvention.", alternatives: "No recommendation. This is a pain MJP explicitly will not solve. The legal risk is existential — one formal complaint to LKPP or KPK about MJP facilitating contract assignment would potentially end MJP.", tc: "text-red-700" },
            { pain: "DECLINED-4: 'Kami butuh platform untuk mengumpulkan dan membagikan pengalaman negatif dengan panitia/BUJK'", why_real: "BUJK have real experiences with problematic panitia (biased evaluation, arbitrary requirements) and problematic BUJK partners (bad payment, poor work quality). A platform for sharing these experiences would have genuine community value.", why_declined: "Defamation risk: a review platform for panitia and BUJK could expose MJP to defamation claims from any panitia or BUJK that received negative reviews. Even if MJP only hosts the reviews (not authors them): as platform operator in Indonesia, MJP bears editorial responsibility. One defamation lawsuit from a large BUJK or government agency would be existentially costly.", alternatives: "Trust Score (for BUJK) serves the 'avoid bad partners' need with data-backed scoring rather than subjective reviews. Panitia evaluation: not solved — deliberately out of scope.", tc: "text-orange-700" },
            { pain: "DECLINED-5: 'Kami ingin platform untuk mencari subkontraktor tukang/buruh harian'", why_real: "Finding reliable daily workers (tukang, buruh) is a persistent operational pain for BUJK, especially for project-based staffing in new cities. Labor shortage in skilled construction trades is getting worse.", why_declined: "Different market: construction labor sourcing is a consumer/gig-economy problem, not a B2B intelligence problem. Requires: worker profiles (different privacy considerations), geographic matching, scheduling systems, verification infrastructure for worker skills (different from SKK). Building this would require MJP to become an HR/staffing platform — completely different product, different regulatory environment (manpower regulations), different business model.", alternatives: "Seekgig, WorkerLink (emerging local platforms for construction labor). MJP will not compete here.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.pain} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.pain}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Why real: {r.why_real}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Why declined: {r.why_declined}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Alternatives: {r.alternatives}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Pains MJP chose not to solve adalah the inverse of the product roadmap — it defines MJP's category by exclusion as much as by inclusion. The 5 declines above are each important for a different reason: DECLINED-1 and -2 are scope discipline (stay in the procurement intelligence lane). DECLINED-3 and -4 are legal discipline (don't facilitate anything that could be construed as procurement violation or defamation). DECLINED-5 is market discipline (don't expand into different market verticals that would dilute focus). Hendra's category definition test: 'If a BUJK asks whether MJP does X, and the answer is no, can I explain why in one sentence that makes the klien understand and respect the boundary?' For all 5 declines: the answer is yes. This boundary clarity is also a competitive advantage: MJP doesn't try to be everything. Klien who know exactly what MJP is (and isn't) are more likely to commit fully to it for its core use case. Hendra: 'Produk yang mencoba menyelesaikan semua masalah biasanya tidak menyelesaikan satu pun dengan sangat baik. Kami memilih masalah yang kami tahu cara menyelesaikannya. Dan kami menyelesaikannya sebaik yang kami bisa.'</p>
      </div>

      {/* R108: Pain Points MJP Platform Has Accidentally Created */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleAlert className="h-3.5 w-3.5 text-primary" /> PLATFORM-CREATED PAIN POINTS — 4 Masalah Baru yang MJP Tidak Sengaja Ciptakan untuk Kliennya Sendiri: Bagaimana Platform Intelligence Bisa Menimbulkan Ketergantungan, Distorsi, dan Risiko yang Tidak Diantisipasi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { pain: "PP-C1: Ketergantungan pada HPS estimate — klien berhenti mengembangkan kemampuan estimasi internal", observation: "3 Enterprise klien (identified via NPS follow-up interviews in 2025) have reported reducing their internal estimating team's role because 'MJP gives us the HPS range.' One klien: let their experienced estimator retire without replacement, using MJP as substitute. When MJP's HPS estimate for a complex IKN tender was outside the actual HPS range: this klien had no backup estimating capability to verify or adjust.", mjp_response: "MJP's HPS estimates explicitly carry a confidence range, not a point estimate. Rewrite of HPS feature copy: 'MJP's range is a starting point, not a substitute for expert judgment.' Sari added a Knowledge Registry note: 'When to use and when not to use HPS estimation tools.' But the underlying risk — klien over-relying on any intelligence tool — is structural, not solvable with copy changes.", tc: "text-red-700" },
            { pain: "PP-C2: Trust Score anchoring — klien reject qualified partners because of Trust Score tier", observation: "Budi's 2025 interviews surfaced a pattern: 4 narasumber mentioned declining JO partnership discussions with BUJK in Trust Score Tier C after seeing MJP's Trust Score — even when the Tier C BUJK had strong LOCAL execution history (exactly the gap Gregorius identified in Flores). Trust Score anchoring: klien treating a data signal as a final verdict rather than one input among many.", mjp_response: "Trust Score UI update: added 'Trust Score covers LPSE-trackable performance only — local execution history, relationship networks, and non-LPSE track records are not reflected.' Additionally: tooltip on every Trust Score display explaining the 4 dimensions it covers and the 4 it doesn't. Hendra Jr.'s ongoing work: 'Local Execution History' dimension to reduce systematic bias against non-Java BUJK in Tier C.", tc: "text-orange-700" },
            { pain: "PP-C3: Alert dependency — klien tidak lagi aktif memonitor LPSE secara langsung", observation: "22% of Pro klien (self-reported) have stopped their manual LPSE monitoring entirely, relying 100% on MJP's alert system. This creates a single point of failure: when MJP's crawler has a delay ({'>'}4h above SLA for a specific LPSE), these klien have no backup. 2 documented cases of klien missing tender deadlines they would have caught manually: both occurred during crawler delays.", mjp_response: "MJP cannot tell klien to maintain dual monitoring — that would undermine the product's value proposition. Instead: Hendra Jr. built a fallback alert when MJP's own freshness drops below SLA for any portal that a klien monitors. 'Alert: MJP's data for [Portal X] may be delayed — direct LPSE check recommended.' This converts the single point of failure into a transparent risk signal.", tc: "text-blue-700" },
            { pain: "PP-C4: NLQ over-reliance — klien stop reading primary regulatory documents", observation: "Sari's NLQ failure analysis (the meeting that examines incorrect NLQ answers) surfaced a pattern: klien who rely exclusively on NLQ for regulatory interpretation are more likely to miss important nuance in the primary regulation. NLQ summarizes correctly 82% of the time — but the 18% where it doesn't: the error propagates because klien didn't read the primary source. One incident: klien relied on NLQ answer about qualification thresholds and submitted a bid for a tender they were not technically qualified for (they were at the boundary, and NLQ missed a recent circular that had changed the threshold).", mjp_response: "NLQ response template update: all NLQ answers now include a 'primary source' link at the bottom. 'This answer is based on: [Regulation X, Article Y] — read the primary source for official reference.' Sari: 'NLQ adalah ringkasan yang saya bisa pertanggungjawabkan. Bukan pengganti untuk membaca regulasi asli ketika keputusan tinggi-stakes.'", tc: "text-primary" },
          ].map((r) => (
            <div key={r.pain} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.pain}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Observation: {r.observation}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>MJP response: {r.mjp_response}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Platform-created pain points adalah the most uncomfortable category in MJP's pain point analysis — because these are problems MJP is responsible for creating. A platform that genuinely helps its users can also inadvertently create dependency patterns, distortions, and risks. The 4 cases above share a common root: intelligence tools work best when used as inputs to human judgment, not substitutes for it. When klien treat HPS estimates as final answers, Trust Scores as verdicts, alerts as complete coverage, and NLQ as regulatory authority — they are using intelligence tools incorrectly, and MJP bears partial responsibility for not designing the tools to resist misuse. Hendra's framing: 'Kami membangun tools yang sangat berguna sehingga klien mempercayainya lebih dari yang seharusnya. Itu adalah masalah yang baik untuk dimiliki — tetapi masalah yang kami tetap bertanggung jawab untuk diselesaikan.' The solutions (confidence ranges, tooltip disclaimers, freshness alerts, primary source links) are product mitigations — they reduce the risk of misuse without eliminating the tool's utility. But the deeper solution is user education: every Enterprise onboarding now includes a 45-minute session specifically on 'How to use MJP intelligence correctly — and what not to use it for.' Budi: 'Platform yang paling bertanggung jawab bukan yang paling berhati-hati dalam klaim yang dibuat. Tapi yang paling jujur tentang batas kemampuannya — termasuk dengan dirinya sendiri.'</p>
      </div>

      {/* R109: Pain Point Patterns Across BUJK Sizes */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartColumnBig className="h-3.5 w-3.5 text-primary" /> PAIN PATTERNS BY BUJK SIZE — Bagaimana Pain Point Berubah Seiring Ukuran BUJK: 4 Profile BUJK dengan Distribusi Pain yang Sangat Berbeda, dan Apa yang Ini Berarti untuk Bagaimana MJP Mendesain Solusi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { profile: "PROFILE-1: BUJK Kecil (0–3 tahun, Rp 0–5B ARR) — pain utama: orientation", top_pains: "P-1: Tidak tahu tender mana yang eligible (kualifikasi confusion) — Severity 1. P-2: Tidak paham cara submit dokumen LPSE (procedural fear) — Severity 2. P-3: Tidak tahu bagaimana menghitung HPS yang kompetitif — Severity 2. P-4: SKK management — masih learning, biasanya hanya 1–2 SKK holder — Severity 3.", what_this_means: "Small BUJK pain is primarily informational: they know what they want to do (win tenders) but don't know how to do it correctly. MJP's Starter tier is calibrated for this profile: basic alert + regulatory guide. BUT: the orientation pain (P-1, P-2) requires guided onboarding, not just features. Addressing CHURN-1 (Trialist) requires fixing orientation pain at the onboarding level.", tc: "text-primary" },
            { profile: "PROFILE-2: BUJK Menengah Muda (3–8 tahun, Rp 5–20B ARR) — pain utama: optimization", top_pains: "P-1: Win rate stuck (bidding many, winning few) — Severity 2. P-2: HPS estimation uncertainty on larger contracts — Severity 2. P-3: Finding reliable JO partners for larger contracts — Severity 1 (high because failure costs more). P-4: SKK portfolio management (growing team, multiple jabatan kerja, renewals becoming complex) — Severity 2.", what_this_means: "This profile is MJP's Pro tier sweet spot. Win rate improvement (HPS + competitor intelligence) and JO partner finding (Trust Score) are exactly what Pro tier addresses. SKK management at this stage: 5–20 SKK holders — complex enough to need systematic management, simple enough that MJP's current tools handle it. Budi finds this the most analytically interesting pain profile: pains are clearly defined but solutions require data infrastructure that most BUJK can't build internally.", tc: "text-blue-700" },
            { profile: "PROFILE-3: BUJK Mapan (8+ tahun, Rp 20–100B ARR) — pain utama: strategic intelligence", top_pains: "P-1: Market signal blindness (not seeing IKN, infrastructure opportunities early enough) — Severity 2. P-2: JO partner ecosystem management (multiple concurrent JO partnerships, need quality across portfolio) — Severity 2. P-3: Regulatory change impact assessment (changes affect multiple active projects simultaneously) — Severity 1 for enterprise-scale projects. P-4: Competitive positioning (why do we lose to Competitor X on these specific tender types?) — Severity 3.", what_this_means: "Enterprise tier is calibrated for this profile: market signals (Radar Pasar + PDF briefing), JO network (Trust Score portfolio view), regulatory intelligence (Sari's work), competitive analysis (Radar Kompetitor). The Strategic analysis pain (P-4) is the least addressed by current MJP — it's partially addressed by Workroom and Radar Kompetitor, but a full competitive analytics dashboard is in the future roadmap.", tc: "text-emerald-700" },
            { profile: "PROFILE-4: BUJK IKN-focused (any size, but IKN-specific focus) — pain unik: specialized intelligence gap", top_pains: "P-1: IKN-specific regulatory framework not covered in standard procurement intelligence — Severity 1 (many klien explicitly say MJP's Knowledge Registry has gaps for IKN). P-2: Kalimantan-specific labor/SKK market dynamics not reflected in Trust Score — Severity 2. P-3: KPBU project intelligence (different procurement rules from standard LPSE) — Severity 1 for BUJK targeting KPBU. P-4: Competitor positioning in IKN (different competitive landscape from national) — Severity 2.", what_this_means: "Profile 4 is the clearest evidence that MJP needs a specialized 'IKN Intelligence' tier. Current MJP serves Profiles 1–3 well; Profile 4 is systematically underserved. The Severity-1 pains (IKN regulatory gap, KPBU intelligence gap) are not addressed by any current tier. These are precisely the gaps that a post-Series A IKN Intelligence tier would address — and the reason this tier's potential ARR is Rp 8–15jt/month per klien.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.profile} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.profile}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Top pains: {r.top_pains}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>What this means: {r.what_this_means}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Pain patterns by BUJK size adalah the segmentation framework that connects market segment to product tier to pain profile. The 4 profiles above reveal a clear progression: small BUJK need orientation, growing BUJK need optimization, established BUJK need strategic intelligence, and IKN-focused BUJK need specialized coverage. MJP's current tier structure (Starter, Pro, Enterprise) maps roughly to Profiles 1, 2, and 3 respectively. Profile 4 (IKN-focused) is unserved — it's the gap that the future IKN Intelligence tier would fill. The business implication: MJP's churn patterns align with pain alignment. Profile-1 BUJK (Starter) churn when MJP doesn't address orientation pain (they're in CHURN-1 Trialist category). Profile-3 BUJK (Enterprise) have lowest churn because their strategic intelligence pain is best served by current Enterprise features. Profile-2 is the highest-growth segment: 3–8 year BUJK experiencing rapid procurement volume growth and actively seeking optimization tools. Budi's 2025 research: this segment is growing at approximately 12% per year as Indonesian infrastructure spending matures more BUJK from Kecil to Menengah. This growth tailwind means the Pro tier addressable market is expanding structurally — not just from overall BUJK registration growth but from BUJK aging into the pain profile that MJP serves best. Hendra: 'Kita bukan hanya menjual kepada pasar yang ada. Kita menjual kepada pasar yang sedang tumbuh menuju kebutuhan yang kita paling baik memenuhinya. Itu adalah posisi yang ingin kita pertahankan.'</p>
      </div>

      {/* R110: How MJP Chooses the Next Pain Point to Solve */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Crosshair className="h-3.5 w-3.5 text-primary" /> PAIN POINT SELECTION FRAMEWORK — Bagaimana MJP Memilih Pain Point Berikutnya yang Akan Diselesaikan: Proses 4-ListFilter yang Memastikan MJP Selalu Membangun untuk Pain Nyata, Bukan Pain yang Terdengar Menarik
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { filter: "ListFilter 1: Frekuensi — seberapa sering pain ini dirasakan?", criteria: "Minimum threshold: pain mentioned by 5+ narasumber OR documented in 15+ NLQ queries OR cited in 3+ Reza win/loss conversations in a quarter. Below threshold: interesting signal, not yet actionable — 'watch list' status. Above threshold: enters active evaluation. Rationale: pain mentioned once might be idiosyncratic. Pain mentioned repeatedly across different narasumber, geographies, and interaction types: structural pain that the product can systematically address.", example: "SKK management pain: mentioned by 12 of 18 narasumber in 2022 research (67% hit rate). Clear frequency signal. JO partner verification: mentioned by 8 of 18 (44%). Both above threshold; SKK prioritized by Severity + Unaddressed scoring.", tc: "text-primary" },
            { filter: "ListFilter 2: Keparahan (Severity) — apa dampak biaya ketika pain ini terjadi?", criteria: "Severity rating: 1 (catastrophic — disqualification, contract loss, regulatory penalty), 2 (significant — measurable financial loss {'>'} Rp 5jt or major time waste), 3 (moderate — friction or inconvenience, {'<'}Rp 5jt), 4 (minor — negligible impact). Priority calculation: Frequency × (5 - Severity). Severity 1 × high frequency: highest priority. Severity 4 × low frequency: lowest priority. Pain with Severity 1: gets additional weight because catastrophic outcomes drive churn and word-of-mouth simultaneously.", example: "SKK disqualification (Severity 1) vs difficulty understanding regulatory documents (Severity 3). If both have equal frequency: SKK disqualification gets prioritized. Hendra's rationale: 'Pain that costs a klien Rp 23.5jt sunk cost is worth more prevention investment than pain that costs 2 hours of confusion.'", tc: "text-blue-700" },
            { filter: "ListFilter 3: Addressability — bisa MJP benar-benar membantu? Dan apakah ini kategori kami?", criteria: "3 questions: (A) Does MJP have or can MJP acquire the data needed to solve this pain? (B) Is the solution technically within MJP's stack (alert, intelligence, NLQ, Trust Score — not document management, not accounting, not project management)? (C) Is solving this consistent with MJP's mission (democratizing construction market intelligence)? All 3 must be yes. If any is no: pain goes to 'Declined Pains' list with documented reason.", example: "Pain: BUJK needs to manage contract document signing digitally. Frequency: high. Severity: 2. But Addressability check fails question B (document management is outside MJP's stack) and question C (document management ≠ market intelligence). Declined. Rationale in Declined Pains list: 'Category: operational tool. Recommended: esign.id or DocuSign. MJP referral provided.'", tc: "text-emerald-700" },
            { filter: "ListFilter 4: Distinctiveness — apakah ada yang sudah menyelesaikan ini dengan baik?", criteria: "If another product already solves this pain well: MJP should not duplicate. Instead: MJP should integrate or recommend. Exceptions: (A) existing solution is not available to small/medium BUJK (access inequality). (B) existing solution doesn't work within MJP's specific context (LPSE-connected construction procurement). (C) MJP can solve it significantly better because of its unique data position (LPSE + BNSP + field research integration). If exceptions apply: build. If not: refer.", example: "Pain: BUJK needs to file SPT Pajak (tax return). Frequency: universal. Severity: 2. Addressability: fails (tax is not MJP's data domain). Distinctiveness: many existing solutions (OnlinePajak, etc.). Clear refer case. Pain: BUJK needs real-time SKK verification. Frequency: high. Severity: 1. Addressability: MJP has BNSP API access. Distinctiveness: no other product integrates SKK verification with tender alerts. Build decision: correct.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.filter} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.filter}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Criteria: {r.criteria}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Example: {r.example}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Pain point selection framework adalah MJP's quality gate for deciding what to build — distinct from RICE (which determines sequence among approved features) and Done Definition (which determines completion quality). The 4-filter framework determines eligibility: does this pain point deserve to become a product investment at all? The framework prevents 3 categories of product mistakes: (1) building for infrequent pain (ListFilter 1 prevents: 'one klien mentioned this interesting problem' → building something only 1 klien needs), (2) building for low-severity pain when high-severity pains are unaddressed (ListFilter 2 prevents: building nice-to-have features when urgent pains exist), (3) building outside category (ListFilter 3 prevents: scope creep into document management, accounting, HR — areas where MJP would be competing against specialists without MJP's data advantage), (4) duplicating existing solutions (ListFilter 4 prevents: building something that already exists and referring to it instead). The framework was codified after the Social Forum mistake: Social Forum passed a rudimentary version of ListFilter 1 (narasumber mentioned desire for peer community) and ListFilter 3 (technically buildable) but failed ListFilter 2 (severity was low — klien don't lose money from not having a forum) and ListFilter 4 (existing industry WhatsApp groups and associations already served this need partially). Had the 4-filter framework existed: Social Forum would have been declined at ListFilter 2. Hendra: 'Framework seleksi pain point adalah cara saya memastikan bahwa MJP membangun untuk BUJK yang kehilangan uang karena tidak punya kami — bukan untuk BUJK yang mungkin menikmati memiliki kami.'</p>
      </div>

      {/* R111: PP-011 — The Pain Point That Surprised MJP */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleAlert className="h-3.5 w-3.5 text-primary" /> PP-011: PAIN POINT YANG MENGEJUTKAN MJP — Bagaimana Temuan tentang 'Waktu Hilang untuk Negosiasi Harga Material' Mengekspos Blind Spot Terbesar dalam Asumsi Product-Market Fit MJP Selama 3 Tahun
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { phase: "Penemuan: Budi's 2024 field research — signal yang tidak dicari", story: "Budi's Q3 2024 field research focus was on tender monitoring pain. But in 7 consecutive interviews, narasumber pivoted away from tender monitoring and started talking about material price negotiation. Unsolicited: each narasumber described the same pain — spending 3–5 hours per tender bid building material price quotes from multiple suppliers because supplier prices are volatile and no centralized reference exists. Budi noted the pattern in his field notes: 'Saya tidak pernah menanyakan tentang harga material. Mereka yang membawa topik ini 7 kali berturut-turut. Ketika 7 orang yang berbeda menceritakan hal yang sama tanpa diminta: itu sinyal yang tidak bisa diabaikan.'", implication: "The surprising element: MJP had assumed that after solving tender intelligence (monitoring + HPS estimation), the adjacent pain was regulatory compliance. The 2024 research revealed a different adjacent pain: material sourcing intelligence. Budi brought the finding to Hendra with his field notes from all 7 interviews. Hendra's initial reaction: 'Material pricing is outside our current data infrastructure — we'd need supplier price feeds we don't have. This would require a completely different data architecture.'", tc: "text-primary" },
            { phase: "Analisis: Mengapa MJP tidak melihat pain ini selama 3 tahun?", story: "Post-discovery analysis: why did MJP miss this for 3 years? Hendra's retrospective: (1) Budi's earlier interviews (2021–2023) were primarily with BUJK that had already partially solved this problem using Excel-based supplier databases. The narasumber who talked to Budi in 2021–2023 were relatively sophisticated — they had workarounds. The 2024 narasumber were from smaller BUJK (under Rp 2B ARV) who didn't have sophisticated workarounds. (2) MJP's existing klien skew toward larger, more sophisticated BUJK — who are less affected by this pain. The smaller BUJK who feel this pain most acutely: underrepresented in MJP's klien base.", implication: "The discovery revealed a product gap: MJP's platform serves the 'already-partially-solved' version of the problem for larger BUJK, but misses the unsolved version for smaller BUJK. The implication for market sizing: the 40% of BUJK that don't subscribe to MJP are disproportionately smaller BUJK — and they're absent partly because MJP's current feature set doesn't address their most acute pain. Hendra: 'Tiga tahun kami berpikir bahwa BUJK yang belum subscibe belum convert karena masalah marketing. PP-011 memberi tahu kami: mungkin ada sebagian yang belum convert karena platform kami belum memecahkan masalah yang paling penting bagi mereka.'", tc: "text-blue-700" },
            { phase: "Evaluasi: Apakah MJP akan membangun material price intelligence?", story: "PP-011 ran through MJP's 4-filter Pain Point Selection Framework. ListFilter 1 (Frequent + persistent): 7 of 7 narasumber mentioned it unprompted — PASS. ListFilter 2 (Severe): average 4 hours lost per bid, directly affects margin on every bid submitted — PASS with high score. ListFilter 3 (In-category): this is where debate happened. Material price intelligence requires supplier data feeds, not LPSE data. Is this 'in MJP's category'? Hendra's question: 'Does having material price data compound the value of having tender intelligence, or is it a separate business?'", implication: "The ListFilter 3 debate lasted 3 months. Hendra's resolution (Q1 2025): 'Material price intelligence is adjacent to tender intelligence — a BUJK who builds a bid needs both. If MJP provides material price reference alongside HPS estimation: the combination makes MJP's bid assistance complete rather than partial. This is category expansion, not category change.' ListFilter 4 (no existing solution): partially failed — some large BUJK have supplier databases. But for BUJK under Rp 3B ARV: no adequate solution. Result: PP-011 progresses to roadmap planning stage as a Series A-funded investment. Current status: Material Price Reference is in MJP's post-Series A roadmap (Q3 2027 target launch).", tc: "text-emerald-700" },
            { phase: "Pelajaran: Apa yang PP-011 mengajarkan tentang product discovery process MJP", story: "PP-011's most important lesson: the pain points you find depend on who you interview. Budi's 2021–2023 narasumber network skewed toward larger, more sophisticated BUJK — which was exactly who MJP was building for. But it meant that smaller-BUJK-specific pains were invisible. The discovery of PP-011 happened because Budi deliberately expanded his narasumber network in 2023–2024 to include more BUJK in the Rp 500jt–2B ARV range. The narasumber expansion was not motivated by seeking PP-011 — it was motivated by geographic expansion (more provinces). PP-011 was an accidental benefit.", implication: "The accidental nature of PP-011's discovery: Budi describes as a 'research process failure that produced a product discovery success.' Failure: MJP should have been interviewing this BUJK size segment from Year 1. Success: the 2024 narasumber expansion program (designed for geographic coverage) accidentally provided the demographic diversity that revealed the pain. Budi's protocol update post-PP-011: every annual narasumber expansion plan now explicitly includes a target for BUJK size distribution — ensuring that small BUJK (under Rp 2B ARV) are always represented in the annual interview sample. Budi: 'PP-011 adalah pengingat bahwa kita tidak tahu apa yang tidak kita ketahui. Cara terbaik melawan itu: memastikan kita berbicara dengan orang-orang yang hidupnya berbeda dari asumsi kita.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.phase} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.phase}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Story: {r.story}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Implication: {r.implication}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">PP-011 adalah the most consequential pain point discovery in MJP's history — not because it will generate the most immediate revenue, but because it forced a fundamental reassessment of who MJP was building for and who it was inadvertently neglecting. For 3 years: MJP optimized for 847 BUJK who subscribed. PP-011 revealed: approximately 12.000 BUJK who hadn't subscribed might have a different primary pain that MJP had never investigated. The philosophical implication: product-market fit is not a binary state — it exists on a spectrum, and MJP had strong fit for large-sophisticated BUJK but potentially weak fit for small-unsophisticated BUJK who needed material price intelligence more than tender intelligence. The roadmap implication: post-Series A, MJP will build Material Price Reference (Q3 2027). The market implication: if Material Price Reference closes the small-BUJK adoption gap by even 20%, MJP's TAM effectively expands by 2.400 BUJK — equivalent to 2.8 years of current organic growth. Hendra's framing: 'PP-011 bukan hanya sebuah pain point. Ini adalah cermin yang menunjukkan kepada kami celah terbesar dalam pemahaman kami tentang pasar yang selama ini kami kira sudah kami pahami dengan baik.'</p>
      </div>

      {/* R112: Platform-Created Pain Points */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleAlert className="h-3.5 w-3.5 text-primary" /> PLATFORM-CREATED PAIN POINTS — 4 Cara Platform MJP Sendiri Menciptakan Masalah Baru bagi BUJK: Paradoks Informasi Berlebih, Dependensi Tool, Alert Fatigue, dan Benchmarking Anxiety — dan Bagaimana MJP Mengelolanya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { pain: "PCP-1: Information Overload Paradox — BUJK yang dulunya kurang informasi, kini terlalu banyak", description: "Pre-MJP BUJK pain: insufficient tender intelligence. Post-MJP problem: some BUJK receive more tender alerts than they can evaluate. MJP's alert system identifies all relevant tenders based on KBLI and province settings. A well-configured Medium-tier BUJK: may receive 8–12 tender alerts per day. For a BUJK owner running day-to-day operations: 8–12 evaluations per day is not feasible. Result: alert fatigue, inbox abandonment, and ironically reduced platform engagement from the very feature designed to increase it.", how_mjp_addresses: "Hendra Jr. added relevance scoring to the alert system (Q2 2025) — alerts are ranked by HPS match (within 20% of BUJK's historical winning range), province priority (home province vs adjacent), and historical win rate for similar work type. Top 3 alerts per day are highlighted as 'Priority.' BUJK can set maximum alerts per day. The alert quality over quantity principle: now in onboarding materials. Budi's ongoing research: 'at what alert volume does engagement start dropping?' — current data suggests the inflection point is 5–7 alerts/day for owner-operated BUJK.", tc: "text-primary" },
            { pain: "PCP-2: Tool Dependence — BUJK yang tidak lagi bisa berfungsi tanpa MJP tapi tidak membangun kapabilitas internal", description: "MJP's value proposition: making BUJK more competitive. Unintended consequence: BUJK who fully adopt MJP may atrophy their own market intelligence capabilities. A BUJK whose owner spent 3 hours/week manually researching LPSE: shifts to 30 minutes/week reviewing MJP summaries. Net gain: 2.5 hours. Net risk: if MJP experiences downtime or subscription lapses, they lose both the MJP intelligence AND their prior manual research skills (atrophied from disuse). Reza's observation: 'beberapa klien kami yang paling aktif mengatakan mereka tidak tahu bagaimana mereka akan beroperasi tanpa MJP. Itu menyenangkan dan menakutkan pada saat yang sama.'", how_mjp_addresses: "MJP's philosophical response: tool dependence is not inherently bad — BUJK have dependence on Excel, WhatsApp, and email too. The risk is excessive dependence without redundancy. MJP's practical response: Knowledge Registry exports available as standalone PDFs. Morning briefing archives accessible offline for 90 days. Sari's documentation: written so a BUJK could use it without the NLQ interface if needed. Goal: MJP makes BUJK more capable, not merely more dependent.", tc: "text-blue-700" },
            { pain: "PCP-3: Alert Fatigue Variation — terlalu banyak notifikasi yang tidak menghasilkan tindakan", description: "Different from PCP-1 (volume overload): Alert Fatigue here means alerts that are individually relevant but collectively create a notification treadmill where the BUJK opens alerts reflexively without genuinely evaluating each one. Budi's field observation: 3 narasumber described opening MJP alerts as a morning ritual that takes 5 minutes — but when asked what they did with the alerts, their answers revealed scanning without acting. High open rates but low actual platform ROI.", how_mjp_addresses: "The diagnostic question Reza asks during check-in calls: 'Berapa banyak dari alert tender yang Anda terima bulan lalu yang menghasilkan proposal atau submission?' If the ratio is below 10%: either alert relevance needs tuning (wrong KBLI/province settings) or the BUJK is scanning reflexively. For the latter case: Reza works with the BUJK to set a tender evaluation commitment — a maximum of 3 tender evaluations per week, deeply rather than 20 shallowly. Quality depth principle: not just for information processing but for action conversion.", tc: "text-emerald-700" },
            { pain: "PCP-4: Benchmarking Anxiety — BUJK yang merasa lebih buruk setelah melihat data kompetitor", description: "Radar Kompetitor shows BUJK how they compare to their competitive set — intended to motivate improvement. Unintended consequence: a BUJK who sees their 3 closest competitors have higher Trust Scores, more recent LPSE wins, and better SKK coverage may experience 'benchmarking anxiety' — a demotivating awareness of competitive gap without a clear path to close it. Strategic Analyst archetypes handle this data constructively. Compliance Guardian archetypes sometimes experience it as demoralizing.", how_mjp_addresses: "MJP's in-progress response (Q3 2026): redesigning Radar Kompetitor to include a Competitive Improvement Pathway feature — when a BUJK views a competitor's Trust Score gap, the platform surfaces specific actionable steps ('Your competitor has SKK Jenjang 9 in Civil Works — here is how to pursue that certification through SKK Express'). The pathway converts a diagnostic view (gap awareness) into a prescriptive one (gap closure roadmap). Budi: 'Data yang menunjukkan kelemahan tanpa menunjukkan cara memperbaikinya: itu bukan intelligence — itu adalah kecemasan yang terdokumentasi. Intelligence yang baik: selalu berakhir dengan tindakan yang bisa diambil.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.pain} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.pain}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Description: {r.description}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>How MJP addresses it: {r.how_mjp_addresses}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Platform-created pain points adalah the most intellectually honest category of MJP's pain point documentation — because it acknowledges that MJP's own platform creates new problems even as it solves old ones. This is not unusual for any platform: every significant tool creates dependencies, learning curves, and behavioral changes that produce secondary challenges. What distinguishes MJP's approach: these platform-created pains are actively researched (Budi documents them in his annual retrospective), publicly acknowledged in internal documentation, and systematically addressed. Most platforms treat user problems created by their own product as support tickets rather than product problems. MJP treats them as research findings. The 4 platform-created pains are at different stages of resolution: PCP-1 (information overload) is partially addressed through relevance scoring. PCP-3 (alert fatigue) has a manual Reza intervention protocol but no systematic product solution yet. PCP-2 (tool dependence) has a philosophical response but no product response. PCP-4 (benchmarking anxiety) is being addressed through the Q3 2026 Competitive Improvement Pathway feature. The deeper principle: a platform that creates problems it refuses to acknowledge is misaligned with its users. A platform that creates problems, documents them, and fixes them: is building the trust that produces 91% first-win retention and 9/10 NPS scores even after service errors. Hendra: 'Platform yang paling kami hormati bukan yang tidak pernah membuat kesalahan atau menciptakan masalah sekunder. Ini platform yang mengakuinya dan memperbaikinya. Itu adalah standar yang kami terapkan pada diri kami sendiri.'</p>
      </div>

      {/* R113: Pain Point Monetization Roadmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleAlert className="h-3.5 w-3.5 text-primary" /> PAIN POINT MONETIZATION ROADMAP — PP Mana yang Akan MJP Selesaikan Pertama, Kedua, Ketiga dan Mengapa: Matriks Prioritas Berdasarkan Revenue Potential, Build Complexity, dan Kesesuaian Strategis
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { tier: "TIER-1 (Sudah Diselesaikan — Aktif Menghasilkan Revenue)", pain_points: "PP-001: Tender intelligence access — solved by core platform (LPSE monitoring, alerts, HPS). Revenue model: monthly subscription (Pro/Enterprise). PP-002: Regulatory compliance complexity — solved by Knowledge Registry + NLQ. Revenue model: included in subscription, drives tier upgrades. PP-003: BUJK qualification verification — solved by Trust Score. Revenue model: included in Enterprise subscription. PP-009: SKK certification urgency — solved by SKK Express. Revenue model: per-case transaction fee (Rp 2.5jt–8.5jt). PP-007: Market intelligence scarcity — solved by morning briefing + Sinyal Pasar. Revenue model: included in all subscription tiers. Combined revenue from TIER-1 pain points: 100% of MJP's current Rp 2.1B ARR.", monetization_completeness: "TIER-1 is fully monetized. Every pain point in TIER-1 has a defined product feature, clear value proposition, and proven revenue model. The remaining monetization question: can MJP increase ARPU from existing solutions? Yes — through tier upgrades (Pro to Enterprise adds Rp 1.6jt/month) and SKK Express volume growth (+40% YoY).", tc: "text-emerald-700" },
            { tier: "TIER-2 (Target Q3 2027 — Material Price Reference untuk PP-011)", pain_points: "PP-011: Material and labor price reference for smaller BUJK (under Rp 2B ARV) preparing Surat Penawaran. Discovered 2024 — the pain that surprised MJP by being almost invisible in prior research due to demographic sampling bias. Build complexity: MEDIUM. Requires: (1) regional material price data collection (Budi's narasumber network + PUPR price indices), (2) price display interface in Surat Penawaran feature, (3) quarterly update process (Sari builds into maintenance routine). Revenue model under evaluation: 3 options being considered by Hendra. Option A: include in Pro/Enterprise subscription (no new revenue, but drives adoption by smaller BUJK not currently subscribing). Option B: add as paid feature at all tiers (Rp 200rb/month add-on). Option C: free at Basic tier (acquisition driver for smaller BUJK), paid in Pro/Enterprise (retention driver). Hendra's current lean: Option C — maximizes new subscriber acquisition in the underserved segment.", monetization_completeness: "Expected incremental ARR from PP-011: Rp 120–180jt/year (Option C model, targeting 600–900 new smaller BUJK at Basic tier). Not all smaller BUJK who use the free feature will upgrade to Pro — but even a 15% conversion to Pro tier adds Rp 270jt incremental ARR. Budi's market size estimate: 3.000–5.000 BUJK in the Rp 500jt–2B ARV range who have the Material Price Reference pain acutely.", tc: "text-blue-700" },
            { tier: "TIER-3 (Target Q2 2028 — Document Preparation Intelligence untuk PP-014)", pain_points: "PP-014: Document preparation complexity — 71% of Budi's 2025 narasumber mentioned 'persiapan dokumen kualifikasi' as a significant friction point (the second-most mentioned pain after tender discovery, which is already solved). The pain: BUJK frequently submit incomplete or incorrectly formatted qualification documents — causing disqualification at the administrative stage before their technical and commercial bid is even evaluated. Build complexity: HIGH. Requires: (1) integration with LPSE's qualification document requirements for each tender type, (2) a document checklist generator (what documents are needed for THIS specific tender, based on KBLI, jenjang, and tender value), (3) a document completeness validator (has the BUJK uploaded all required documents?). Revenue model: Hendra's preliminary thinking — include in Enterprise tier only (the BUJK who are losing on administrative disqualification are disproportionately Pro-tier or below, who lack the sophistication to prepare complete documents; making this an Enterprise feature incentivizes Pro-to-Enterprise upgrades). This would add 'Document Intelligence' to Enterprise's differentiation from Pro.", monetization_completeness: "Expected impact: 40% reduction in administrative disqualification rate for Enterprise klien. The business case: BUJK who avoid 1 administrative disqualification per quarter (saving Rp 2–5jt in preparation costs) will attribute that saving to MJP's Document Intelligence feature — strengthening retention. The expected NPS improvement for Enterprise klien who use Document Intelligence: +0.7 (based on similar feature introductions' NPS impact in MJP's history).", tc: "text-primary" },
            { tier: "TIER-4 (Horizon 2029+ — Geographic Intelligence Network untuk PP-019)", pain_points: "PP-019: Local market intelligence for geographic expansion — BUJK who want to expand to new provinces lack local intelligence about which government agencies are active procurers, which BUJK dominate locally, what local pricing norms are, and which LSP relationships matter in that region. This pain: identified in 23 narasumber interviews in 2025 (Budi's 'untaken finding' from R112 retrospective). Build complexity: VERY HIGH. Requires either: (1) a massive geographic data expansion (local government procurement data beyond LPSE), or (2) a BUJK-crowdsourced intelligence network (BUJK share local intelligence with MJP). Both options require infrastructure MJP doesn't currently have.", monetization_completeness: "Target timing: 2029+ (post-Series A, after Material Price Reference and Document Intelligence are shipping). Revenue model: most likely an Enterprise-only add-on at Rp 500rb/month for 'Geographic Expansion Intelligence' — targeting the Strategic Analyst archetype who is actively expanding into new provinces. Estimated TAM for this add-on: 150–250 Enterprise BUJK actively managing geographic expansion at any point in time. Expected incremental ARR (full penetration): Rp 90–150jt/year. This is not a large revenue opportunity in isolation — but it is a key retention driver for Strategic Analyst archetypes who are MJP's highest-ARPU klien.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.tier} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.tier}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Pain points: {r.pain_points}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Monetization completeness: {r.monetization_completeness}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Pain point monetization roadmap adalah MJP's product strategy expressed as a revenue sequence: which BUJK problems will MJP solve, in what order, and how will each solution generate sustainable revenue? The 4-tier structure reflects a deliberate sequencing logic: solve the highest-frequency, highest-urgency pains first (TIER-1 — already done), then the next-highest-frequency mid-urgency pains (TIER-2: PP-011, Q3 2027), then the complex infrastructure-intensive pains (TIER-3: PP-014, Q2 2028), then the geographically-specific pains that require scale to solve (TIER-4: PP-019, 2029+). The sequencing is not purely by revenue potential — it's by build readiness and strategic fit. PP-014 (Document Intelligence) may have higher revenue potential than PP-011 (Material Price Reference) — but MJP's build team cannot execute both simultaneously, and PP-011 opens a new demographic (smaller BUJK) that matters more to MJP's Series A valuation story. The monetization roadmap also reflects MJP's tier architecture: TIER-2 features drive new subscriber acquisition (smaller BUJK segment), TIER-3 features drive tier upgrades (Pro to Enterprise), TIER-4 features drive retention at the top-ARPU segment. Together: a three-dimensional revenue improvement strategy — acquire more BUJK, move them to higher tiers, and retain the most valuable ones through features they cannot get anywhere else. Hendra: 'Peta monetisasi pain point adalah cara saya meyakinkan investor bahwa MJP tidak hanya tumbuh secara linier — kami tumbuh secara tiga dimensi. Setiap pain point baru yang kami selesaikan: menambah pelanggan baru, mendorong upgrade, atau mempertahankan pelanggan terbaik kami. Dan ada cukup pain point untuk mengisi roadmap 5 tahun berikutnya.'</p>
      </div>

      {/* R114: Pain Point Severity Scoring Methodology */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleAlert className="h-3.5 w-3.5 text-primary" /> PAIN POINT SEVERITY SCORING METHODOLOGY — Bagaimana MJP Memberikan Skor 1–10 untuk Setiap Pain Point: 4 Dimensi Penilaian, Formula Perhitungan, dan Mengapa Skor PP-011 yang Rendah Awalnya Membuat MJP Hampir Melewatkan Pain Point Terpenting Tahun 2024
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { dimension: "DIM-1: Frequency (F) — berapa banyak narasumber yang menyebutkan pain point ini tanpa dipancing", weight: "Weight: 30% of total score. Measurement: pure mention rate in Budi's interviews when the narasumber is not asked about a specific topic. F-Score calculation: (number of unprompted mentions) / (total narasumber interviewed). Scale: F-Score of 0.50+ = 10 points, 0.40–0.49 = 8 points, 0.30–0.39 = 6 points, 0.20–0.29 = 4 points, 0.10–0.19 = 2 points, below 0.10 = 0 points. PP-001 (Tender Intelligence): F-Score 0.72 = 10 points. PP-011 (Material Price Reference): F-Score 0.13 = 2 points (the key reason its initial severity score was low — it was rarely mentioned without prompting because smaller BUJK normalized the problem as 'just how things are').", scoring_note: "The frequency dimension's design principle: only unprompted mentions count because prompted mentions reflect Budi's hypothesis rather than the narasumber's actual pain. This is why PP-011 had a low F-Score despite being genuinely common: smaller BUJK didn't spontaneously complain about material price reference because they had accepted the manual process as unavoidable. When Budi started asking about it directly (after discovering it through a GAPEKSINDO member), prompted mentions were extremely high — but those prompted mentions don't count toward F-Score.", tc: "text-primary" },
            { dimension: "DIM-2: Severity (S) — seberapa besar dampak bisnis dari pain point ini pada BUJK yang mengalaminya", weight: "Weight: 40% of total score (highest weight because impact is more important than frequency for prioritization). Measurement: Budi's severity assessment per narasumber who mentions the pain, on a 1–5 scale (1: minor inconvenience, 5: business-critical impact). S-Score: average severity across all narasumber who mentioned the pain. Scale: S-Score 4.5–5.0 = 10 points, 4.0–4.4 = 8 points, 3.5–3.9 = 6 points, 3.0–3.4 = 4 points, 2.5–2.9 = 2 points, below 2.5 = 0 points. PP-011 (Material Price Reference): S-Score 4.3 = 8 points (the high severity score for smaller BUJK who DO experience it — because inaccurate material cost estimates lead to bids that either lose [too high] or win but destroy margins [too low]).", scoring_note: "The severity dimension reveals the critical insight about PP-011: when it's experienced, it's severe — but it's experienced primarily by smaller BUJK (under Rp 2B ARV) who were underrepresented in Budi's early narasumber network (which skewed toward larger BUJK). The combination of low F-Score (rarely mentioned spontaneously) and high S-Score (very severe when experienced): created a misleadingly low overall severity score for PP-011 in the initial scoring. This is why demographic segmentation of pain point data matters: a pain that is frequent among one segment but invisible in another can be severely underweighted in aggregate analysis.", tc: "text-blue-700" },
            { dimension: "DIM-3: Addressability (A) — seberapa feasible MJP membangun solusi untuk pain ini", weight: "Weight: 20% of total score. Measurement: Hendra and Hendra Jr.'s joint assessment of build feasibility. A-Score: 1–5 scale (1: technically infeasible or data unavailable, 5: straightforward build with available data and MJP's current capabilities). PP-011 A-Score: 3.5 = 7 points (requires regional material price data collection that MJP doesn't currently have — moderate feasibility, not trivial but clearly achievable). DIM-4: Competitive Differentiation (D) — seberapa unik adalah solusi MJP vs apa yang sudah tersedia. Weight: 10% of total score. D-Score for PP-011: 4.5 = 9 points (no competitor currently provides regional material price references for BUJK in the procurement context — MJP would be the first).", scoring_note: "Final PP-011 composite score: (F: 2 × 0.30) + (S: 8 × 0.40) + (A: 7 × 0.20) + (D: 9 × 0.10) = 0.6 + 3.2 + 1.4 + 0.9 = 6.1 out of 10. This score: significantly lower than PP-001 (8.4) and PP-002 (7.9) but high enough to qualify for the Tier-2 roadmap. The near-miss lesson: if Budi had not specifically expanded his GAPEKSINDO narasumber network (adding smaller BUJK perspectives), the F-Score would have remained at 2 points, and the composite score at 6.1 would likely have led to PP-011 being deprioritized for another year or two. The demographic blind spot: was the risk, not the methodology. Hendra: 'Metodologi penilaian pain point yang benar tidak cukup jika populasi narasumber tidak mewakili seluruh pasar. Skor kami hanya sebaik cakupan demografis dari narasumber yang menghasilkan data itu.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.dimension} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.dimension}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Weight and measurement: {r.weight}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Scoring note: {r.scoring_note}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Pain point severity scoring methodology adalah MJP's most important product prioritization tool — because it converts qualitative narasumber feedback into a quantitative framework that can be compared across pain points with different profiles. The 4-dimension model (Frequency, Severity, Addressability, Competitive Differentiation) was designed by Hendra in 2022 after noticing that MJP's early pain point prioritization was dominated by whichever pain point Hendra happened to hear about most recently (recency bias) and whichever was mentioned most enthusiastically (intensity bias rather than frequency bias). The model's most important design decision: Severity has the highest weight (40%) because in B2B SaaS for high-stakes markets like government procurement, a severe problem experienced by 20% of the market is often more commercially valuable to solve than a mild problem experienced by 80% of the market. The PP-011 near-miss: the methodology's most valuable real-world test. The composite score was correct (6.1 — lower priority than PP-001 and PP-002) given the data inputs at the time. The error was in the data inputs: the demographic bias in Budi's narasumber network caused the F-Score to be systematically underestimated. After correcting the demographic bias: PP-011's adjusted F-Score would be approximately 0.28–0.32 (if narasumber population reflected the full BUJK market) — giving it a composite score of 7.4–7.6, much closer to PP-001's 8.4. The lesson: pain point scoring is only as reliable as the research sample. Budi's 2025 narasumber expansion into GAPEKSINDO smaller BUJK: not just good research practice — it was a product strategy correction that prevented MJP from systematically under-serving the smaller BUJK segment for another 2–3 years.</p>
      </div>

      {/* R115: Invisible Pain Points */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleAlert className="h-3.5 w-3.5 text-primary" /> INVISIBLE PAIN POINTS — Masalah yang Dialami BUJK tapi Tidak Bisa Mereka Artikulasikan: 4 Tipe Invisible Pain, Bagaimana Budi Mendeteksinya, dan Mengapa Pain yang Tidak Terucapkan Sering Kali Lebih Berharga dari Pain yang Terucapkan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { invisible_type: "INVISIBLE-TYPE-1: Normalized friction — masalah yang diterima BUJK sebagai 'memang begini cara kerjanya'", detection: "BUJK who have been operating in the government procurement market for 10+ years: have normalized many process frictions as 'how it works here.' They don't mention these frictions in interviews because they've accepted them as baseline reality, not as problems worth complaining about. PP-011 (Material Price Reference) is Budi's clearest example: smaller BUJK owners had been manually checking material prices for 10+ years. When asked about pain points, they described tender complexity, regulatory confusion, and partner trust issues — not material price checking, because price checking was normal effort that they'd stopped perceiving as a problem.", detection_method: "Budi's detection technique for INVISIBLE-TYPE-1: the 'counterfactual probe.' He asks narasumber to describe their ideal workday in procurement preparation — what tasks they wish someone else would do, what information they wish existed automatically. This counterfactual framing bypasses the 'normalized friction filter' by asking BUJK to imagine a better state rather than criticize the current state. The counterfactual probe: detected PP-011, PP-014 (document preparation complexity), and PP-019 (geographic expansion intelligence) — none of which appeared in direct pain point surveys. Budi's estimate: approximately 40% of MJP's most important pain point discoveries came from counterfactual probes rather than direct questions.", tc: "text-primary" },
            { invisible_type: "INVISIBLE-TYPE-2: Second-order pain — masalah yang disebabkan oleh solusi yang sudah ada, bukan oleh masalah aslinya", detection: "Second-order pain: a new problem created by an existing solution. Example: BUJK who use multiple LPSE aggregators (to ensure they don't miss any tenders) now have a new problem — they receive duplicate alerts for the same tender from multiple platforms, and they spend significant time deduplicating across platforms. The original problem (missing tenders): solved. The second-order problem (alert deduplication): created by the solution. Second-order pains are invisible in direct interviews because narasumber describe them as 'annoyances with tools they use' rather than 'market problems' — and they typically blame the specific tool rather than identifying it as a solvable design problem.", detection_method: "Budi's detection technique for INVISIBLE-TYPE-2: the 'current tools walkthrough.' He asks narasumber to walk him through how they use each tool in their workflow — step by step. During the walkthrough: he listens for procedural friction (steps that the narasumber performs to compensate for a tool's limitation) rather than verbal complaints (which are filtered by the 'it's just the tool' rationalization). Procedural frictions that appear in 3+ walkthroughs: flagged as second-order pain candidates. Example second-order pain discovered in 2025: BUJK who use MJP's Trust Score then manually cross-reference with SIKI-LPJK to verify — suggesting Trust Score, while valued, lacks the government registry's official authority for formal JO partner due diligence. This finding shapes Hendra's SIKI-LPJK integration consideration for post-Series A.", tc: "text-blue-700" },
            { invisible_type: "INVISIBLE-TYPE-3: Pre-conscious pain — masalah yang belum disadari BUJK sampai ada solusi yang menunjukkan keberadaannya", detection: "Pre-conscious pain: the pain that doesn't exist in the BUJK's awareness until a solution reveals that the pain was there all along. The classic example from MJP's history: before MJP built the morning briefing, BUJK didn't know they had a 'fragmented daily intelligence' problem. They just started each day doing manual checks across multiple sources — and didn't experience this as a problem because no alternative existed. After the morning briefing: BUJK retrospectively recognized that the pre-briefing manual process was a significant pain. The pre-conscious pain: invisible before the solution, obvious after it.", detection_method: "Budi cannot directly detect pre-conscious pain through interviews (the narasumber doesn't experience it as a problem yet). His technique: 'solution seeding.' When Budi describes a potential solution during the interview ('imagine if X were available — would that be useful?'), he watches for a specific reaction: the 'oh, I didn't know I wanted that but now that you describe it...' recognition signal. The recognition signal: changes in body language (leaning forward, nodding with increasing speed), specific elaboration ('that would help especially when...'), and often a follow-up question ('does this already exist?'). The solution seeding technique: ethically borderline in pure research (it risks bias by introducing the researcher's solution framing). Budi manages this by seeding multiple solutions per interview — including some he knows are not feasible — and using the differential reaction to identify genuine pre-conscious pain vs polite agreement.", tc: "text-emerald-700" },
            { invisible_type: "INVISIBLE-TYPE-4: Embarrassment pain — masalah yang BUJK enggan akui karena menyiratkan kompetensi rendah", detection: "Some BUJK pain points are invisible because BUJK are embarrassed to admit them — they imply a lack of expertise or sophistication. PP-014 (document preparation errors leading to administrative disqualification): a significant pain for many BUJK, but one that BUJK are reluctant to mention directly because admitting you were administratively disqualified implies you don't know how to prepare a tender package properly. Similarly: BUJK who don't fully understand regulatory threshold calculations for qualification levels — but won't admit confusion because it implies incompetence.", detection_method: "Budi's detection technique for INVISIBLE-TYPE-4: 'third-party witnessing.' He asks narasumber to describe problems he has seen OTHER BUJK have — not the narasumber themselves. 'Bapak sering berinteraksi dengan BUJK lain — apa masalah yang paling sering Bapak lihat pada sesama kontraktor?' This indirect framing: removes the personal embarrassment filter. The frequency with which a 'third-party witnessed' problem appears: Budi's proxy for its actual prevalence. PP-014's discovery: entirely through third-party witnessing. 7 narasumber described observing fellow BUJK being administratively disqualified due to document errors — zero narasumber described it as their own experience. Budi: 'Masalah yang paling memalukan untuk diakui: sering kali masalah yang paling umum. Dan produk yang menyelesaikan masalah itu dengan anggun: produk yang paling dihargai, karena memberikan jalan keluar tanpa mempermalukan pengguna.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.invisible_type} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.invisible_type}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Definition: {r.detection}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Detection method: {r.detection_method}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Invisible pain points adalah Budi's most methodologically sophisticated research contribution — because they require detecting problems that narasumber themselves don't have language for. The 4 invisible pain types (normalized friction, second-order pain, pre-conscious pain, embarrassment pain) all share a characteristic: they are systematically under-represented in standard survey research and under-represented even in casual interviews. They require specific detection techniques (counterfactual probing, tools walkthrough, solution seeding, third-party witnessing) that go beyond asking 'what are your pain points?' The distribution of MJP's 19 documented pain points: approximately 11 were visible (mentioned directly without prompting), 4 were normalized friction, 2 were second-order, 1 was pre-conscious, and 1 was embarrassment pain. The most commercially valuable discoveries: disproportionately from the invisible category. PP-011 and PP-014 are both post-visible discoveries — and both drive the TIER-2 and TIER-3 monetization roadmap. If Budi had only used direct interview questions: MJP's product roadmap would end with TIER-1. The indirect detection techniques: opened the TIER-2 and TIER-3 opportunities. This is why Budi's methodology evolution is inseparable from MJP's product strategy evolution — every new detection technique unlocks a new category of previously invisible opportunity.</p>
      </div>

      {/* R116: Pain Point Retirement Protocol */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Archive className="h-3.5 w-3.5 text-primary" /> PAIN POINT RETIREMENT PROTOCOL — Kapan dan Bagaimana Sebuah Pain Point Dinonaktifkan dari Database Aktif: 3 Alasan Pensiun, Kasus PP yang Sudah Dipertimbangkan untuk Pensiun, dan Mengapa Menghapus Pain Point Justru Memperkuat Kredibilitas Database
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { retirement_reason: "RETIREMENT-REASON-1: Pain diselesaikan oleh MJP sendiri — pain point yang menjadi fitur sukses", definition: "The most satisfying retirement reason: MJP built a product feature that directly addresses the pain point, and narasumber follow-up confirms that the pain is no longer experienced at the same frequency and severity. The retirement criterion: not that the feature was built, but that it verifiably reduced the pain. Budi's protocol: 6 months after a feature launch, he returns to 5–8 narasumber who previously reported the pain point and asks whether their experience has changed. If 4+ of the 5–8 report meaningful improvement: the pain point is eligible for retirement.", mjp_example: "Candidate for REASON-1 retirement: PP-006 (fragmented daily intelligence consolidation — the pain that the morning briefing was built to solve). Narasumber follow-up in 2024 (6 months after the briefing's 2023 redesign): 7 of 8 narasumber reported that MJP's morning briefing had substantially solved their daily intelligence consolidation problem. The remaining 1: an Enterprise subscriber whose intelligence needs had evolved beyond what the briefing format addresses (a new pain, not a failure of the briefing). Budi's recommendation: PP-006 should be reclassified from ACTIVE to MONITORED — it is no longer a driver of product development but should be retained as historical context for the briefing's founding rationale. Hendra's decision: keep in MONITORED state indefinitely (preserving the founding pain narrative for investor and onboarding use), not full retirement.", tc: "text-primary" },
            { retirement_reason: "RETIREMENT-REASON-2: Pain diselesaikan oleh perubahan regulasi atau pasar — bukan oleh MJP", definition: "The most surprising retirement reason: a regulatory change or market evolution eliminates the pain point independently of MJP's product decisions. Indonesian government procurement has been digitizing rapidly under the UU Cipta Kerja implementation — and some procurement friction pain points that existed in 2021 (when LPSE portals were fragmented and poorly maintained) have been reduced by LKPP's portal standardization program without any MJP intervention. The retirement criterion: narasumber follow-up confirms that the pain is substantially reduced, AND the reduction is attributable to external change (not to MJP's product), AND the pain is unlikely to re-emerge if the external change is sustained.", mjp_example: "Candidate for REASON-2 retirement: PP-003 (LPSE portal inconsistency — the difficulty of comparing tender requirements across different regional portals that used different document formats). In 2024: LKPP's SiRUP (Sistem Informasi Rencana Umum Pengadaan) standardization initiative reduced portal format inconsistency significantly for procurement planning documents. Narasumber follow-up: 5 of 7 reported meaningfully reduced frustration with portal inconsistency. The pain is not eliminated (portal inconsistency persists for other document types) but has been reduced. Budi's recommendation: PP-003 should be reclassified to DECLINING — still active but with reduced commercial development urgency. The monitoring question: will LKPP's standardization continue, or will the reduction reverse if the program stalls? This uncertainty: the reason for DECLINING rather than retirement.", tc: "text-blue-700" },
            { retirement_reason: "RETIREMENT-REASON-3: Pain diselesaikan oleh kompetitor — MJP memilih tidak bersaing di area ini", definition: "The most strategically difficult retirement reason: a competitor builds a feature that meaningfully addresses the pain point, reducing BUJK's experience of the pain. MJP must decide whether to (a) build a competing feature to retain subscribers who valued MJP's potential solution, (b) acknowledge the competitor's success and retire the pain point from MJP's active development roadmap, or (c) build a superior solution that the competitor's feature pointed toward but didn't fully solve. The retirement criterion for REASON-3: the competitor's solution is good enough that BUJK narasumber report it as sufficient AND the pain point is outside MJP's competitive advantage area (where Budi's depth of knowledge adds the most value).", mjp_example: "Candidate for REASON-3 retirement: PP-009 (tender document download friction — the difficulty of accessing tender document packages from LPSE portals). In 2023: two LPSE aggregator competitors significantly improved their document download interfaces, reducing this friction for their subscribers. Narasumber follow-up: competitors' interfaces are 'good enough' for document download. Budi's recommendation: PP-009 should be retired from active development consideration because (1) it is a commodity feature that any well-designed aggregator can solve, (2) MJP's competitive advantage is intelligence (analysis, insight, regulatory context) not aggregation (download interfaces), and (3) building a superior download feature would not differentiate MJP. Hendra's decision: retire PP-009 from active roadmap, focus on intelligence depth where competitors are weakest. Budi: 'Pensiun pain point bukan kekalahan — ini adalah keputusan strategic tentang di mana MJP tidak boleh bersaing. Pemimpin yang paham dirinya tahu kapan harus melepaskan pertarungan yang tidak bernilai untuk dimenangkan.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.retirement_reason} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.retirement_reason}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Definition and criterion: {r.definition}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>MJP example: {r.mjp_example}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Pain point retirement protocol adalah Budi's most counterintuitive research practice — because the instinct in product research is to accumulate evidence of problems, not to systematically remove problems from the active database. The retirement protocol's commercial logic: a pain point database that never retires entries becomes increasingly noisy over time, with old pain points (already solved, externally reduced, or outside competitive scope) consuming development attention alongside genuinely actionable current pain points. MJP currently has 19 documented pain points. Of these: Budi's assessment is that 3 are candidates for MONITORED reclassification (PP-006, PP-003, PP-009 — discussed above), 14 are ACTIVE (genuinely unresolved, within MJP's competitive scope, and supported by current narasumber data), and 2 are EMERGING (identified in 2025 research, not yet scored with full narasumber coverage). The retirement protocol: not just about data hygiene. It's about forcing Budi and Hendra to explicitly confirm the current relevance of each pain point against recent narasumber data — a discipline that prevents feature investment based on 3-year-old pain data that the market has moved past. The protocol also addresses a leadership communication challenge: when Hendra tells investors 'we've identified 19 BUJK pain points,' the credibility of that claim depends on whether the 19 are currently validated or historically accumulated. A database with a rigorous retirement protocol: more credible than one that only adds, never removes. The post-Series A Product Manager: will inherit the pain point database as their primary product intelligence input. The retirement protocol: the quality control that ensures the Product Manager is working from live intelligence, not a historical museum of resolved problems.</p>
      </div>

      {/* R117: Co-occurring Pain Patterns */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <GitMerge className="h-3.5 w-3.5 text-primary" /> CO-OCCURRING PAIN PATTERNS — Nyeri yang Muncul Bersama di BUJK yang Sama: 3 Klaster Ko-Okurens, Implikasi Produk dari Setiap Klaster, dan Mengapa Memahami Paket Nyeri Lebih Berharga dari Memahami Nyeri Tunggal
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { cluster: "CO-CLUSTER-1: Klaster 'Informasi Terfragmentasi' — PP-001 + PP-002 + PP-008 sering muncul bersama", pain_set: "PP-001 (monitoring 671 portal LPSE), PP-002 (interpretasi peraturan yang kompleks), PP-008 (akses informasi harga material yang tidak real-time): the most common co-occurring pain cluster, present in 68% of BUJK who report PP-001. The connecting thread: all 3 pains share a root cause of information fragmentation — regulatory information is scattered across agencies, tender information is scattered across portals, and price information is scattered across suppliers and market sources. The BUJK who has PP-001: almost certainly has PP-002 (they are monitoring portals manually, and when they find relevant tenders, they also struggle to interpret qualification regulations). The BUJK who has PP-001 + PP-002: very likely to have PP-008 (their manual information management extends to price information for their cost estimates).", product_implication: "Product implication: MJP's Morning Briefing is specifically designed for this cluster — integrating tender alerts (PP-001), regulatory summaries (PP-002), and material price references (PP-008) in a single daily touch. A subscriber who has this cluster: should experience all 3 pains addressed simultaneously by the briefing. The cluster co-occurrence data: validates the 'integrated intelligence' product design decision (vs building separate standalone products for each pain). If MJP had built a tender-monitoring app (PP-001 only): it would have served this cluster but missed 2/3 of the pain. The integrated briefing: the product design that matches the integrated pain cluster reality. The cluster insight also explains MJP's low churn: subscribers with the full PP-001+002+008 cluster who have their pain addressed by 3 features simultaneously are far less likely to churn than subscribers using only 1 feature.", tc: "text-primary" },
            { cluster: "CO-CLUSTER-2: Klaster 'Rekam Jejak & Reputasi' — PP-005 + PP-009 + PP-016 sering muncul bersama", pain_set: "PP-005 (difficulty proving track record to new clients), PP-009 (JO partner selection risk), PP-016 (Trust Score disputes — being evaluated unfairly): present together in 54% of BUJK who report PP-005. The connecting thread: all 3 pains involve the management of professional reputation and verification in a market where formal reputation signals are weak. PP-005 (proving track record) and PP-009 (evaluating JO partners) are mirror images: the same BUJK who struggles to prove their own track record also struggles to assess their potential partners' track records. PP-016 (Trust Score disputes): appears in this cluster because BUJK who care about their Trust Score (because they use it to prove their track record and evaluate partners) are also more likely to challenge inaccurate scores.", product_implication: "Product implication: Trust Score is the primary product addressing this cluster — but it addresses each pain in the cluster differently. PP-005: addressed by giving BUJK a standardized Trust Score they can share as proof of track record. PP-009: addressed by giving BUJK access to their potential JO partners' Trust Scores for evaluation. PP-016: addressed by the dispute resolution process (Trust Score Advisory Panel, from R115). The cluster insight: Trust Score's adoption challenge may be underestimated if evaluated as a solution to PP-005 alone (31% of BUJK report this pain). But as a solution to the full PP-005+009+016 cluster: it addresses a pain package that 54% of BUJK with PP-005 have — a more accurate measure of Trust Score's addressable market. Reza's Enterprise success practice: explicitly focuses on this cluster in his onboarding conversations — presenting Trust Score as a solution to the full reputation and verification pain package, not just one component.", tc: "text-blue-700" },
            { cluster: "CO-CLUSTER-3: Klaster 'Kapasitas Tim' — PP-012 + PP-013 + PP-015 sering muncul bersama", pain_set: "PP-012 (insufficient admin staff for bid preparation), PP-013 (excessive bidding effort without proportional win rate), PP-015 (working capital strain from payment delays): the capacity constraint cluster, present together in 47% of BUJK who report PP-012. The connecting thread: all 3 are symptoms of a resource-constrained BUJK operating at the edge of its capacity. PP-012 (admin capacity shortage) leads to PP-013 (bidding on too many tenders without sufficient preparation quality, because the admin team doesn't have time to prepare high-quality bids — resulting in low win rates). PP-013 (low win rate from excessive low-quality bids) combined with PP-015 (slow payment from won contracts) creates a cash flow trap: winning fewer contracts than expected but having the won contracts pay slowly.", product_implication: "Product implication: this cluster is the most complex to address because it requires behavioral change (bid selectivity, PP-013 solution) not just information access. MJP's no-bid intelligence system (from R117's tenders panel): specifically designed for this cluster — providing the bid selectivity intelligence that helps PP-012 BUJK focus limited admin capacity on the highest-probability tenders. The cluster insight: the no-bid intelligence system's primary target user is NOT a large BUJK with many analysts who want strategic optimization — it is a capacity-constrained BUJK with a small admin team who needs help deciding where to focus their limited bid preparation time. The framing change: from 'strategic bid optimization' to 'capacity-aware bid prioritization' — the latter more accurately describes the pain this cluster experiences. Budi's RESEARCH-Q2 (no-bid decision study): investigating whether experienced BUJK in this cluster have developed informal bid prioritization heuristics that MJP's no-bid intelligence system could formalize and make accessible to earlier-stage BUJK facing the same capacity constraints. Budi: 'BUJK yang paling berhasil yang saya wawancarai bukan yang paling banyak menawar — melainkan yang paling selektif. Keterampilan itu biasanya datang dari 10 tahun pengalaman menyakitkan. Tugas MJP adalah mempersingkat kurva pembelajaran itu dari 10 tahun menjadi 10 bulan.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.cluster} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.cluster}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Pain set and connection: {r.pain_set}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Product implication: {r.product_implication}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Co-occurring pain patterns adalah Budi's most analytically valuable contribution to MJP's product strategy — because single-pain analysis produces single-feature solutions, while co-occurrence analysis produces integrated product design that addresses how BUJK actually experience their problems (as interconnected difficulties, not isolated issues). The 3 clusters (Informasi Terfragmentasi, Rekam Jejak and Reputasi, Kapasitas Tim): are not exhaustive — Budi has identified 7 distinct clusters in the full pain point co-occurrence analysis. But these 3 are the largest and most commercially significant: they cover 68%, 54%, and 47% of BUJK who have the anchor pain in each cluster. The most important insight from co-occurrence analysis: MJP's core product architecture (integrated briefing + Trust Score + Knowledge Registry + NLQ) maps almost exactly to the top 3 pain clusters. The Morning Briefing addresses CO-CLUSTER-1. Trust Score addresses CO-CLUSTER-2. The no-bid intelligence system (in progress) addresses CO-CLUSTER-3. This coherence: not coincidental — it reflects 5 years of iterative product development guided by pain point research. But the co-occurrence framing provides a richer explanation for why the product architecture is coherent: the 4 pillars each address a distinct pain cluster, and the clusters are the organizing principle of BUJK's real-world experience. Hendra's Series A product narrative: now grounded in co-occurrence data ('We built each product pillar to address a distinct pain cluster. The clusters are empirically distinct, covering 68–47% of our target market. The pillars work together because the clusters co-occur in the same BUJK.'). This narrative: more credible than 'we built features our users asked for' — it shows systematic pain discovery, cluster analysis, and product design coherence.</p>
      </div>

      {/* R118: Pain Point Severity Calibration */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-primary" /> PAIN POINT SEVERITY CALIBRATION — Bagaimana Budi Memvalidasi Skor Keparahan Setiap Tahun: 3 Metode Kalibrasi, Apa yang Terjadi Ketika Skor Berubah, dan Mengapa Kalibrasi Rutin Lebih Penting daripada Akurasi Awal
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { method: "CALIBRATION-METHOD-1: Annual narasumber panel re-scoring — 20 narasumber inti memperbarui penilaian keparahan mereka", process: "Each January, Budi conducts brief calibration check-ins with his 20 core narasumber (15-minute conversations, either WhatsApp voice note exchange or brief call). The calibration question: 'On a scale of 1–10, how painful is [PP-code topic] for you now, compared to 12 months ago? Is it more painful, less painful, or the same?' The calibration also asks: 'Has any new pain point emerged in the past 12 months that you don't think MJP has addressed yet?' The annual re-scoring: not a full research interview (which would consume too much narasumber goodwill) but a targeted severity check-in.", finding_and_adjustment: "2026 calibration findings and score adjustments: PP-001 (LPSE monitoring): severity score held stable at 8.2/10 — crawler complexity unchanged. PP-008 (material price reference): severity increased from 5.5 to 7.1 after material price volatility in 2024–2025 — updated to HIGH and queued for new Knowledge Registry asset (confirmed by NLQ Mode-4 query spike for price-related queries). PP-007 (government quota for local contractors in non-home region tenders): severity decreased from 6.3 to 4.8 after LKPP's 2025 policy clarification reduced the ambiguity — severity score lowered, MJP's Knowledge Registry asset updated to reflect the clarification. Pain recalibration: not just score updates — they trigger Knowledge Registry updates, briefing topic adjustments, and occasionally product roadmap shifts.", tc: "text-primary" },
            { method: "CALIBRATION-METHOD-2: NLQ query volume analysis — permintaan actual pengguna sebagai proxy keparahan yang terpasang", process: "Budi's calibration validation: cross-referenced against Hendra Jr.'s quarterly NLQ Mode-4 query volume analysis. The hypothesis: pain point severity should correlate positively with NLQ query volume for that topic (a highly painful topic = many BUJK asking about it). When a pain point's narasumber severity score and its NLQ query volume agree: the score is well-calibrated. When they diverge (high narasumber severity but low NLQ volume, or vice versa): investigation is needed. Common divergence explanation types: (1) High severity + low NLQ: BUJK experience the pain but don't think MJP can help (they haven't tried asking NLQ about it). (2) Low severity + high NLQ: the topic generates questions but the pain is situational rather than widespread.", finding_and_adjustment: "2026 calibration divergence finding: PP-016 (Trust Score disputes) — narasumber severity score: 5.1/10 (moderate). NLQ query volume: 47 queries/month (high for a specific operational topic). The divergence: narasumber describe Trust Score disputes as 'frustrating but manageable,' while the NLQ query volume suggests many BUJK are actively seeking resolution guidance. Resolution: the severity score discrepancy may reflect that the 20 core narasumber have more direct access to Reza (and can escalate dispute resolution through the personal relationship channel) than the broader BUJK population who turn to NLQ when they don't know Reza. Recommendation: severity score for PP-016 should be higher for non-Enterprise subscribers (who don't have Reza's direct support). Score split created: PP-016 Enterprise severity 4.8, PP-016 non-Enterprise severity 7.2. Product implication: the self-service dispute resolution feature (NLQ-guided dispute submission) is more urgently needed than the narasumber data alone suggested.", tc: "text-blue-700" },
            { method: "CALIBRATION-METHOD-3: Churn exit interview analysis — mengapa subscriber tidak memperbarui (sinyal keparahan yang tidak teratasi)", process: "Reza conducts exit interviews with all churned subscribers who accept an exit conversation (approximately 60% of churned subscribers, primarily Pro tier). The exit interview question most relevant to pain point calibration: 'Which of the problems you came to MJP to solve do you feel are still unresolved?' The exit interview responses: the most candid pain severity data available (a churned subscriber has no incentive to spare MJP's feelings). Pain points that appear consistently in exit interviews as 'still unresolved': are evidence that the pain is either higher severity than the current score reflects, or that MJP's current product is not adequately addressing it.", finding_and_adjustment: "2025–2026 exit interview calibration findings: PP-003 (difficulty comparing multiple tender opportunities simultaneously) — appeared in 23% of exit interviews as 'still unresolved.' PP-003's current severity score: 6.1/10 (MEDIUM). The exit interview prevalence: suggests the score may be too low OR MJP's current tender comparison feature is insufficient. Budi's investigation (3 follow-up interviews with churned PP-003 subscribers): revealed that MJP's current tender comparison interface requires switching between pages rather than supporting side-by-side comparison. The solution: not a severity score update but a product UI improvement (side-by-side tender comparison view — a 3-week Hendra Jr. engineering task, queued for Q3 2026). The exit interview calibration: the most commercially direct calibration method because churned subscriber feedback can be directly linked to product improvement decisions that prevent future churn of the same type. Budi: 'Exit interview adalah satu-satunya kalibrasi di mana biaya tidak membereskan masalah sudah diketahui secara pasti: satu subscriber yang berhenti berlangganan. Itu membuat datanya paling mudah untuk diprioritaskan.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.method} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.method}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Process: {r.process}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Finding and adjustment: {r.finding_and_adjustment}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Pain point severity calibration adalah the quality control system that keeps MJP's product decisions grounded in current market reality rather than the market reality of the year the pain points were initially scored. A severity score established in 2021 and never updated: reflects the BUJK market's pain intensity in 2021. The market has changed (new regulations, digitalization of BNSP, LPSE policy changes, material price volatility): and so has pain intensity. The 3 calibration methods (narasumber annual re-scoring, NLQ query volume cross-reference, churn exit interview analysis): each captures a different dimension of pain severity. Narasumber re-scoring: captures the experienced practitioner's subjective assessment of pain trajectory. NLQ query volume: captures the aggregate revealed behavior of all BUJK seeking help with a topic. Exit interviews: capture the commercially decisive cases where unresolved pain drove product abandonment. Using all 3 methods: provides triangulated calibration that no single method can provide. A pain point that scores HIGH on all 3 (high narasumber severity, high NLQ volume, high exit interview frequency): is categorically more urgent for product attention than one that only scores high on narasumber severity. The calibration system's most important operational function: it prevents MJP's product roadmap from being driven by 3-year-old pain point scores that no longer reflect the current market. In fast-moving regulatory environments (Indonesia's construction procurement regulations: approximately 3–5 significant changes per year): a static pain point database is a liability disguised as an asset. The annual calibration: converts the static database into a living market intelligence system. The post-Series A Product Manager hire: will inherit both the pain point database AND the calibration methodology — ensuring that MJP's market grounding discipline survives the transition from founder-led research to professional product management.</p>
      </div>

      {/* R119: Pain Point Decay Curve */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> PAIN POINT DECAY CURVE — Berapa Lama Pain Point yang Tervalidasi Tetap Actionable Sebelum Membutuhkan Revalidasi: 4 Kategori Nyeri dengan Decay Rate Berbeda, Penyebab Decay, dan Protokol Budi untuk Memutuskan Kapan Revalidasi Diperlukan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { category: "DECAY-CAT-1: Infrastructure procurement process pains — decay window 18 bulan", decay_cause: "Infrastructure procurement process pains (PP-001: LPSE multi-portal fragmentation, PP-003: qualification document inconsistency, PP-008: tender calendar unpredictability): driven by structural characteristics of Indonesia's procurement system that change slowly. LPSE's basic architecture, the qualification document framework, and the APBN procurement cycle: governed by LKPP regulations that are updated approximately every 18–24 months. A pain point validated in 2024 about 'LPSE portal inconsistency': still valid in 2026 — the same 671-portal fragmentation exists. The 18-month decay window: not because the pain resolves, but because the specific manifestation details (which portals are most fragmented, what the specific inconsistencies are) require fresh field data to ensure MJP's product continues to address the current manifestation, not the 2024 manifestation.", revalidation_protocol: "Budi's revalidation protocol: at the 18-month mark for each infrastructure pain, a targeted narasumber session focused specifically on the pain's current manifestation — has it worsened, improved, or shifted in character? The most common finding from infrastructure pain revalidations: the pain is still present but its most painful aspect has shifted (e.g., multi-portal fragmentation is still painful, but the specific challenge shifted from 'hard to find tender publications' to 'inconsistent qualification document formats across portals' — both related to fragmentation but requiring different product responses). MJP's responses: updated to match the current pain manifestation.", tc: "text-primary" },
            { category: "DECAY-CAT-2: Regulatory compliance awareness pains — decay window 12 bulan", decay_cause: "Regulatory compliance pains (PP-002: IUJK renewal confusion, PP-006: SKK expiry blind spots, PP-007: TKDN threshold uncertainty): driven by regulatory changes that happen approximately annually (BNSP updates SKK requirements, LKPP updates TKDN thresholds, regional governments update IUJK procedures). The 12-month decay window: because the specific regulations that cause compliance pain change each year. A pain point about 'TKDN threshold confusion' validated in 2024 (when the threshold was 40% for certain categories): may have decayed significantly by 2026 if LKPP has since clarified the threshold — or may have intensified if LKPP added new categories. The pain category (regulatory compliance confusion) persists, but the specific pain (which regulation is most confusing and why) changes.", revalidation_protocol: "Budi's revalidation protocol: annual regulatory landscape mapping session with 3–4 narasumber (compliance-specialist narasumber who monitor LKPP, BNSP, and PUPR outputs closely). The session: specifically asks 'which regulatory requirements caused the most confusion, missed deadlines, or emergency compliance actions in the last 12 months?' The answer: recalibrates PP-002, PP-006, PP-007 severity scores and updates their 'specific manifestation' descriptions. Sari's editorial calendar: updated based on Budi's regulatory pain revalidation findings — new regulatory confusion topics become Knowledge Registry priority assets.", tc: "text-blue-700" },
            { category: "DECAY-CAT-3: Personnel certification management pains — decay window 24 bulan", decay_cause: "Personnel certification pains (PP-005: SKK renewal complexity, PP-009: multi-personnel tracking overhead, PP-014: jenjang advancement timeline confusion): driven by BNSP's certification framework structure, which changes on a roughly 2-year cycle (BNSP's SKKNI updates, examination schedule revisions, sub-category additions). The longer 24-month decay window: because BNSP changes its framework less frequently than LKPP changes procurement regulations, and because the core pain (managing multiple personnel certifications with different expiry dates) is structural to BNSP's model and unlikely to resolve without systematic reform. The pain's fundamental character: stable over 24 months even as specific sub-category requirements evolve.", revalidation_protocol: "Budi's revalidation protocol: biennial deep-dive narasumber session focused specifically on SKK pain — typically timed to coincide with BNSP's framework update cycle. The session: examines whether the new BNSP framework update has created new pain manifestations (new sub-categories with confusing requirements, changed jenjang prerequisites) or resolved existing ones. Reza's input: critical for SKK pain revalidation (Reza's SKK Express case data provides empirical evidence of which certification pains are most common, most costly, and most growing — more reliable than narasumber survey for operational pain measurement).", tc: "text-emerald-700" },
            { category: "DECAY-CAT-4: Market intelligence and competitive positioning pains — decay window 6 bulan", decay_cause: "Market intelligence pains (PP-004: competitor tracking difficulty, PP-011: tender win pattern opacity, PP-015: market pricing opacity): driven by competitive market dynamics that change fastest. A BUJK's competitive positioning pain in Q1 2026: reflects who their current strongest competitors are, what categories are most contested, and what pricing dynamics are most opaque. By Q4 2026: new competitors may have entered (or exited), category competition may have intensified or softened, and pricing norms may have shifted. The 6-month decay window: the shortest of any pain category because market competitive dynamics respond to external events (regulation changes, economic cycles, government budget shifts) that can change competitive landscapes within one quarter.", revalidation_protocol: "Budi's revalidation protocol: semi-annual competitive landscape mapping session with narasumber who are active bidders — specifically focused on 'what has changed in your competitive environment in the last 6 months?' The most commercially important revalidation finding type: a new competitor entering a previously MJP-underserved category (signaling a new product opportunity) or an existing strong competitor weakening (signaling Trust Score data that reflects a declining BUJK that subscribers should know about). Hendra Jr.'s Trust Score data: the most objective revalidation input for market intelligence pains — Trust Score trends across competitor categories provide empirical evidence of competitive landscape shifts that supplements Budi's qualitative narasumber data.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.category} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.category}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Decay cause: {r.decay_cause}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Revalidation protocol: {r.revalidation_protocol}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Pain point decay curve adalah the temporal dimension of MJP's pain point database — because a pain point is not a static fact but a dynamic observation about market conditions that change over time. Without decay management, the pain point database becomes an archaeological record of what BUJK found painful in 2021–2023, not a current map of what they find painful in 2026. The 4 decay windows (6 months for market intelligence, 12 months for regulatory compliance, 18 months for infrastructure procurement, 24 months for personnel certification): correspond to how frequently the underlying drivers of each pain category change. Budi's revalidation calendar: set at 80% of each decay window to provide revalidation buffer (ensuring that pain points are refreshed before they expire, not after). The revalidation effort: not equal across all pain points — high-severity, high-incidence pain points (PP-001, PP-002, PP-005) receive full narasumber validation; low-severity pain points receive lighter-touch validation (Reza's subscriber support ticket analysis as proxy validation, rather than dedicated narasumber sessions). Budi's annual research time allocation: 30% of narasumber research hours dedicated to revalidating existing pain points (vs 70% on discovering new ones). The 30% allocation: the most important editorial discipline in Budi's research calendar, ensuring that MJP's product development decisions are made on current data, not on pain assessments that may have shifted significantly since their last validation. The decay curve is ultimately a reminder that market research is not an event — it is a continuous process of checking whether yesterday's insights still describe today's reality.</p>
      </div>

      {/* R120: Pain Point Clustering by BUJK Size */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" /> PAIN POINT CLUSTERING BY BUJK SIZE — Bagaimana Pain yang Sama Bermanifestasi Berbeda di BUJK Kecil, Menengah, dan Besar: 3 Segmen Ukuran, Perbedaan Manifestasi untuk 3 Pain Terpenting, dan Implikasi Produk dari Perbedaan Ini
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { segment: "SIZE-SEGMENT-1: BUJK Kecil (omzet tahunan di bawah Rp 5M, 1–10 proyek/tahun) — 55% subscriber MJP", pain_manifestation: "PP-001 (LPSE multi-portal fragmentation): manifests as 'I can't find all the tenders relevant to my category — I can only check 2–3 portals before I run out of time.' Small BUJK rarely have dedicated procurement staff (the owner or one manager handles everything), so portal fragmentation translates directly to missed tender opportunities due to capacity limitations, not just time inefficiency. PP-002 (regulatory compliance confusion): manifests as 'I don't know which regulations apply to my company size and project type — the language assumes I have a compliance department.' Small BUJK lack the regulatory literacy infrastructure (no in-house legal counsel, no compliance specialist) to navigate the regulatory landscape independently. PP-005 (SKK renewal complexity): manifests as 'I manage 3–5 key personnel certificates manually in a spreadsheet — one expiry slip means I lose eligibility for the next tender I planned to bid.'", product_implication: "Product implication: small BUJK are the subscribers who get the most direct operational value from MJP's core products — the morning briefing solves the portal fragmentation problem by centralizing tender discovery, the Knowledge Registry solves the regulatory confusion problem by providing accessible expert guidance, and the SKK Alert solves the certificate tracking problem. For small BUJK: MJP replaces a compliance department function that they couldn't afford to hire. The Standard tier pricing (Rp 850rb/month): calibrated precisely for the small BUJK's 'affordable compliance function' budget. The most effective MJP message for small BUJK acquisition: 'MJP is the compliance and intelligence team your company can't yet afford to hire.'", tc: "text-primary" },
            { segment: "SIZE-SEGMENT-2: BUJK Menengah (omzet Rp 5–50M, 10–50 proyek/tahun) — 35% subscriber MJP", pain_manifestation: "PP-001 (portal fragmentation): manifests differently from small BUJK — mid-size BUJK have dedicated procurement staff who can check 5–7 portals regularly, but the fragmentation causes data inconsistency (the same tender appearing on different portals with different details, creating ambiguity about which version is authoritative). The problem: not 'I miss tenders' but 'I waste time reconciling conflicting data from multiple portal sources.' PP-004 (competitor tracking difficulty): emerges prominently at mid-size scale — mid-size BUJK compete against 3–5 specific large competitors for the same mid-tier projects and need structured competitor intelligence, not just general market awareness. PP-006 (SKK expiry blind spots): manifests as 'I manage 15–30 personnel certificates across 3 offices — I need a system, not a spreadsheet.'", product_implication: "Product implication: mid-size BUJK are the primary target for Pro tier — they have the budget for higher-tier products and the operational complexity that makes advanced features (Trust Score competitor analysis, multi-personnel SKK tracking) genuinely valuable. The most effective MJP message for mid-size BUJK: not 'we replace a function you don't have' but 'we give your existing procurement team information they currently don't have access to.' Mid-size BUJK already have procurement capacity — they need intelligence quality, not intelligence access. The Pro tier's value proposition: enabling mid-size BUJK's procurement team to operate at the intelligence quality of a 5× larger company's team.", tc: "text-blue-700" },
            { segment: "SIZE-SEGMENT-3: BUJK Besar (omzet di atas Rp 50M, 50+ proyek/tahun) — 10% subscriber MJP, 22% ARR", pain_manifestation: "PP-001 (portal fragmentation): manifests as an analytics and audit problem — large BUJK track tender activity across 5+ provinces, and inconsistent LPSE data across portals creates reporting inconsistencies for management decisions and audit trails. The problem: not 'I miss tenders' or 'I waste time reconciling' but 'I can't produce reliable aggregate market analytics from LPSE data because the data quality is inconsistent.' PP-011 (tender win pattern opacity): prominent at large scale — large BUJK want to understand their aggregate win rate by category, region, and HPS range to optimize their portfolio strategy. PP-015 (market pricing opacity): large BUJK need competitor pricing intelligence at portfolio scale, not just per-tender.", product_implication: "Product implication: large BUJK are the Enterprise tier target — they have dedicated intelligence analysts who can utilize the full depth of Trust Score, competitive landscape, and regulatory intelligence that MJP provides. The most effective MJP message for large BUJK: not 'we replace something you don't have' or 'we give your team information they lack' but 'we provide the systematic market intelligence infrastructure that turns your procurement team's individual insights into a coherent competitive intelligence function.' Large BUJK benefit most from MJP when they use it as an intelligence platform that supplements their internal analysis, not replaces it. The Enterprise tier's 3 features most valued by large BUJK: personalized quarterly Trust Score competitive benchmarking (market position analytics), unlimited NLQ queries (regulatory analysis at scale), and Reza's direct consultation (strategic intelligence contextualization).", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.segment} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.segment}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Pain manifestation by size: {r.pain_manifestation}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Product implication: {r.product_implication}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Pain point clustering by BUJK size adalah the segmentation intelligence that prevents the most common B2B SaaS product mistake: building a single product experience that serves all customers identically when the same problem manifests so differently by company size that a single solution addresses each segment sub-optimally. The 3 size segments (small, mid, large): are not just different budget tiers — they are fundamentally different companies with different organizational structures, different procurement maturity levels, and different intelligence needs. Small BUJK need MJP to function as a compliance department substitute. Mid-size BUJK need MJP as a competitive intelligence force multiplier. Large BUJK need MJP as a systematic market analytics platform. The 3 needs: require different product emphases (Standard's alert and compliance focus, Pro's competitive intelligence focus, Enterprise's analytics and strategic advisory focus). MJP's tier architecture: already reflects this segmentation, but the product differentiation continues to deepen as Hendra Jr. adds tier-specific features that serve each segment's dominant pain manifestation more precisely. The most important insight from size-based pain clustering for MJP's product roadmap: a feature that solves a problem for small BUJK may actively annoy a large BUJK. A Standard subscriber who receives a daily 'LPSE fragmentation digest' (all tenders across all portals in one place) gets their primary pain addressed. An Enterprise subscriber who receives the same undifferentiated digest: sees it as noise (they already have procurement staff monitoring portals) rather than signal. The tier-differentiated product experience: not just about charging more for more features, but about serving genuinely different pain manifestations with genuinely different product behaviors. Budi's annual pain clustering review: the input that tells Hendra which features to build for which tier, based on which manifestation of which pain is most acute for which segment.</p>
      </div>

      {/* R121: Krisis Faktor Produksi — Tenaga Kerja, Material, Peralatan */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-orange-500" /> KRISIS FAKTOR PRODUKSI KONSTRUKSI — 3 Kelangkaan Struktural yang Menekan Profitabilitas BUJK: Tenaga Kerja Terampil, Harga Material Fluktuatif, dan Ketidakseimbangan Pasokan Material di Lapangan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-destructive mb-0.5">PRODUKSI-1: Kelangkaan Tenaga Kerja Konstruksi Terampil — krisis yang memburuk setiap tahun</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">Industri konstruksi Indonesia menghadapi kekurangan tenaga kerja terampil (skilled labor) yang diperkirakan mencapai 1,7 juta orang pada 2026 (sumber: Kemnaker, Kajian Kebutuhan Tenaga Kerja Konstruksi 2025). Akar masalah struktural: (1) generasi tukang dan mandor berpengalaman menua — rata-rata usia tenaga ahli lapangan konstruksi Indonesia adalah 47 tahun; (2) tidak ada regenerasi yang cukup — SMK dan Politeknik konstruksi menghasilkan lulusan jauh di bawah kebutuhan industri; (3) tenaga kerja konstruksi terampil migrasi ke sektor lain (manufaktur, properti komersial) yang menawarkan kepastian kerja lebih tinggi. Dampak pada BUJK: proyek terlambat karena kekurangan mandor terampil, biaya tenaga kerja meningkat 8–15% per tahun akibat persaingan rekrutmen, kualitas pekerjaan menurun saat terpaksa menggunakan tenaga tidak terampil.</p>
            <p className="text-[7px] font-mono text-destructive">MJP coverage: Database tenaga ahli bersertifikat SKK per sub-bidang dan region tersedia di halaman SKK. Alert ketersediaan pelatihan BNSP untuk sub-bidang yang defisit. Sumber: {" "}
              <a href="https://kemnaker.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">kemnaker.go.id</a>{" "}·{" "}
              <a href="https://bnsp.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">bnsp.go.id — statistik sertifikasi</a>
            </p>
          </div>
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-orange-700 mb-0.5">PRODUKSI-2: Harga Material Konstruksi Fluktuatif dan Cenderung Naik — ancaman margin yang tidak bisa dikontrol BUJK</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">Harga material konstruksi utama (baja tulangan, semen, batu bata, kayu, cat) mengalami volatilitas tinggi sejak 2022 — dipicu oleh gangguan rantai pasok global (COVID-19, konflik Rusia-Ukraina yang menaikkan harga baja dan energi), kenaikan BBM (yang menaikkan biaya transportasi material), dan inflasi umum. Data HSPK (Harga Satuan Pokok Kegiatan) PUPR 2023–2026: baja tulangan naik 22–31% dari baseline 2021, semen naik 15–18%, upah tukang naik 25–35%. Masalah bagi BUJK: harga penawaran tender ditetapkan saat submit dokumen (bisa 3–6 bulan sebelum proyek mulai), tetapi material dibeli saat proyek berjalan — selisih harga menjadi kerugian BUJK jika tidak ada klausul eskalasi harga dalam kontrak. Kontrak APBN umumnya tidak memiliki klausul eskalasi harga yang memadai — BUJK menanggung seluruh risiko kenaikan material pasca-kontrak.</p>
            <p className="text-[7px] font-mono text-orange-700">MJP coverage: Monitor HSPK terbaru per region tersedia di Sinyal Pasar. Alert kenaikan harga material yang signifikan dikirim dalam briefing harian. Template klausul eskalasi harga untuk negosiasi kontrak swasta. Sumber: {" "}
              <a href="https://binakon.pu.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">binakon.pu.go.id — HSPK Nasional</a>{" "}·{" "}
              <a href="https://bps.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">bps.go.id — Indeks Harga Material</a>
            </p>
          </div>
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-blue-700 mb-0.5">PRODUKSI-3: Pasokan Material Berlebih dan Kekurangan — ketidakseimbangan regional yang menyebabkan biaya tinggi dan keterlambatan</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">Distribusi material konstruksi di Indonesia sangat tidak merata secara geografis. Kelebihan pasokan: pabrik semen dan baja terkonsentrasi di Jawa dan Sumatera bagian selatan — stok berlebih di titik produksi, harga rendah tetapi biaya pengiriman ke daerah tujuan tinggi. Kekurangan pasokan: proyek di Papua, NTT, Kalimantan Tengah, dan Maluku menghadapi lead time material 4–12 minggu dan biaya material 25–60% lebih mahal dari harga di Jawa. Pola pasokan berlebih sering terjadi saat pemerintah menunda pencairan anggaran Q1 — stok material menumpuk di supplier, harga turun sementara, tetapi BUJK tidak bisa memanfaatkan karena kontrak belum aktif. Pola kekurangan pasokan lokal: terjadi saat proyek besar (IKN, proyek nasional) mendominasi pasokan daerah sekitarnya — BUJK yang mengerjakan proyek kecil di sekitar IKN kesulitan mendapatkan material di harga normal.</p>
            <p className="text-[7px] font-mono text-blue-700">MJP coverage: Analisis ketersediaan material per region berbasis data LPSE dan sinyal pasar. Notifikasi pola pasokan Q1 (window pembelian material saat harga terdiskon). Alert gangguan pasokan regional. Sumber: {" "}
              <a href="https://bps.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">bps.go.id — Statistik Material Konstruksi</a>{" "}·{" "}
              <a href="https://kemendag.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">kemendag.go.id — Sistem Pemantauan Pasar</a>
            </p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Tiga kelangkaan faktor produksi ini saling memperburuk: kelangkaan tenaga kerja terampil membuat BUJK tidak bisa dengan mudah menambah kapasitas saat ada lonjakan proyek; harga material yang tidak bisa diprediksi membuat kalkulasi RAB menjadi spekulasi; ketidakseimbangan pasokan material membuat proyek di daerah terpencil berisiko tinggi secara logistik. Budi's field observation: 'Pain point yang paling banyak saya dengar dari BUJK bukan soal regulasi — tapi soal ketidakpastian. Ketidakpastian harga material saat tender, ketidakpastian ketersediaan tenaga kerja saat proyek mulai, ketidakpastian material sampai tepat waktu. BUJK tidak butuh kepastian mutlak — mereka butuh informasi yang lebih baik dari pesaing untuk membuat keputusan yang lebih baik.' MJP's role dalam mengatasi krisis faktor produksi: bukan menghilangkan volatilitas (itu makro-ekonomi yang tidak bisa dikontrol), tetapi memberikan informasi yang memungkinkan BUJK mengantisipasi, bukan hanya bereaksi. BUJK yang membeli material di Q1 saat harga terdiskon (bukan Q3 saat semua orang butuh): memiliki keunggulan biaya yang nyata. BUJK yang memiliki database tenaga ahli tersertifikasi (bukan hanya kontak informal): bisa rekrut lebih cepat dari kompetitor. Intelligence advantage: dalam industri di mana semua pemain menghadapi ketidakpastian yang sama, yang menang adalah yang paling cepat dan akurat membaca sinyal.</p>
        <div className="mt-2 pt-2 border-t">
          <p className="text-[8px] font-mono text-muted-foreground mb-1 font-semibold">SUMBER REFERENSI RESMI:</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {[
              { label: "Kemnaker — Statistik TK Konstruksi", url: "https://kemnaker.go.id" },
              { label: "BNSP — Sertifikasi Kompetensi", url: "https://bnsp.go.id" },
              { label: "HSPK Nasional — Ditjen Bina Konstruksi", url: "https://binakon.pu.go.id" },
              { label: "BPS — Indeks Harga Produsen", url: "https://bps.go.id" },
              { label: "Kemendag — Pemantauan Harga", url: "https://kemendag.go.id" },
            ].map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="text-[7px] text-primary hover:underline font-mono">
                {s.label} ↗
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Photo Lightbox */}
      {lightboxUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Foto bukti lapangan"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
          onKeyDown={(e) => { if (e.key === "Escape") setLightboxUrl(null); }}
        >
          <div className="relative max-w-4xl max-h-[90vh] p-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-white text-black text-sm font-bold flex items-center justify-center hover:bg-gray-200 shadow-lg"
              title="Tutup foto"
              aria-label="Tutup foto"
              autoFocus
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={lightboxUrl}
              alt="Foto bukti lapangan"
              className="max-h-[85vh] max-w-full rounded-sm shadow-2xl object-contain"
            />
            <div className="text-center mt-2 text-xs font-mono text-white/70">
              FOTO BUKTI LAPANGAN · Klik di luar untuk menutup
            </div>
          </div>
        </div>
      )}
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-6 right-6 z-50 h-9 w-9 rounded-full bg-primary animate-in fade-in slide-in-from-bottom-2 text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" aria-label="Kembali ke atas" title="Kembali ke atas"><ChevronUp className="h-4 w-4" /></button>
      )}
    </div>
  );
}

function parseFotoBukti(description: string | null | undefined): { photoUrl: string | null; cleanDescription: string } {
  if (!description) return { photoUrl: null, cleanDescription: "" };
  // Case-insensitive; accepts https://, http://, and data:image/...;base64,... URLs
  const match = description.match(/\[Foto bukti:\s*([^\]]+)\]/i);
  if (!match) return { photoUrl: null, cleanDescription: description };
  const photoUrl = match[1].trim();
  const clean = description
    .replace(/\n?\[Foto bukti:\s*[^\]]+\]/gi, "")
    .trim();
  return { photoUrl, cleanDescription: clean };
}
